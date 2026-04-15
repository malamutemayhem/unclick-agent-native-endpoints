/**
 * UnClick MCP Endpoint — Vercel serverless function
 *
 * Serves the UnClick MCP server over Streamable HTTP (JSON-RPC + SSE).
 * Agents connect here to discover and call all UnClick tools.
 *
 * Usage:
 *   POST https://unclick.world/api/mcp
 *   Content-Type: application/json
 *   Auth (either form):
 *     - Authorization: Bearer <unclick_api_key>         (preferred)
 *     - ?key=<unclick_api_key> query param              (for clients whose
 *       "Add custom connector" dialog accepts a URL only, e.g. Claude.ai
 *       and ChatGPT's Connectors UI)
 *   Body: MCP JSON-RPC message (initialize, tools/list, tools/call, etc.)
 *
 * The endpoint is stateless — each request spins up a fresh MCP server
 * instance, which is safe for serverless and works with all MCP clients.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "../packages/mcp-server/src/server.js";

function sha256hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

interface ApiKeyContext {
  api_key_hash: string;
  tier: string;
  user_id: string | null;
}

/**
 * Look up an inbound api_key in the api_keys table. Returns the tenancy
 * context if the key is active, or null otherwise. The Supabase service-role
 * client is created on demand so the validator no-ops gracefully when env is
 * unconfigured (local tests, preview deploys without secrets).
 */
async function validateApiKey(apiKey: string): Promise<ApiKeyContext | null> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const apiKeyHash = sha256hex(apiKey);
  const { data, error } = await supabase
    .from("api_keys")
    .select("user_id, tier, is_active")
    .eq("key_hash", apiKeyHash)
    .maybeSingle();

  if (error || !data || data.is_active === false) return null;

  // Fire-and-forget last_used_at + usage_count bump
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("key_hash", apiKeyHash)
    .then(() => {});

  return {
    api_key_hash: apiKeyHash,
    tier: data.tier ?? "free",
    user_id: data.user_id ?? null,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── CORS — allow any origin so AI agents can connect from anywhere ──────────
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, mcp-session-id"
  );
  res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32601,
        message: "Method Not Allowed. POST to this endpoint with an MCP JSON-RPC message.",
      },
      id: null,
    });
  }

  // ── Auth — accept Bearer header OR ?key= query param ──────────────────────
  // Some MCP clients (Claude.ai Connectors, ChatGPT Connectors) only expose a
  // URL field in their "Add custom connector" dialog — no way to set headers.
  // For those, the key is embedded in the URL as ?key=uc_...
  const authHeader = (req.headers.authorization as string) ?? "";
  const keyFromHeader = authHeader.replace(/^Bearer\s+/i, "").trim();
  const keyRaw = req.query.key;
  const keyFromQuery =
    typeof keyRaw === "string"
      ? keyRaw.trim()
      : Array.isArray(keyRaw)
        ? (keyRaw[0] ?? "").trim()
        : "";
  const apiKey = keyFromHeader || keyFromQuery;

  if (!apiKey) {
    return res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32600,
        message:
          "Missing API key. Pass it as Authorization: Bearer <key> or as ?key=<key> in the URL. " +
          "Get a key at https://unclick.world",
      },
      id: null,
    });
  }

  // ── Validate the api_key against the api_keys table ─────────────────────
  // Hash, look up, confirm active. Reject unknown or revoked keys before
  // anything downstream sees the request. Attach the resulting context
  // (api_key_hash, tier, user_id) to per-request env so the memory backend
  // factory can route tenancy.
  const ctx = await validateApiKey(apiKey);
  if (!ctx) {
    return res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message:
          "Invalid or revoked API key. Check that the key is correct and still active. " +
          "Manage keys at https://unclick.world",
      },
      id: null,
    });
  }

  // Inject per-request context. Vercel invocations are isolated processes,
  // so mutating process.env here is safe and is the existing pattern used by
  // createClient() and the memory backend factory.
  process.env.UNCLICK_API_KEY = apiKey;
  process.env.UNCLICK_API_KEY_HASH = ctx.api_key_hash;
  process.env.UNCLICK_TIER = ctx.tier;
  if (ctx.user_id) {
    process.env.UNCLICK_USER_ID = ctx.user_id;
  } else {
    delete process.env.UNCLICK_USER_ID;
  }

  // ── MCP over Streamable HTTP (stateless per-request) ───────────────────────
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode — no sessions in serverless
  });

  const server = createServer();

  try {
    await server.connect(transport);
    // Vercel parses the body automatically; pass it through to avoid re-parsing
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/mcp] Unhandled error:", message);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  } finally {
    // Clean up after the response is sent
    server.close().catch(() => {});
  }
}

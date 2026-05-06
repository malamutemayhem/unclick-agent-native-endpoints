/**
 * UnClick MCP Endpoint - Vercel serverless function
 *
 * Serves the UnClick MCP server over Streamable HTTP (JSON-RPC + SSE).
 * Agents connect here to discover and call all UnClick tools.
 *
 * Usage:
 *   POST https://unclick.world/api/mcp
 *   Content-Type: application/json
 *   Auth (any of):
 *     - Authorization: Bearer <unclick_api_key>         (agents, preferred)
 *     - ?key=<unclick_api_key> query param              (for clients whose
 *       "Add custom connector" dialog accepts a URL only, e.g. Claude.ai
 *       and ChatGPT's Connectors UI)
 *     - Cookie with a Supabase Auth session (for calls initiated
 *       from an authenticated browser session on unclick.world).
 *       The session user_id is resolved to an api_keys row via
 *       api_keys.user_id FK; that row's key_hash becomes the tenancy
 *       context, so memory routing is identical to the api_key path.
 *   Body: MCP JSON-RPC message (initialize, tools/list, tools/call, etc.)
 *
 * The endpoint is stateless - each request spins up a fresh MCP server
 * instance, which is safe for serverless and works with all MCP clients.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "../packages/mcp-server/src/server.js";
import { normalizeAcceptHeader } from "./lib/mcp-protocol.js";
import {
  effectiveMemoryTier,
  isMemoryQuotaExemptEmail,
} from "../packages/mcp-server/src/memory/quota-policy.js";

function sha256hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

// Tool execution must require a valid api_key. Protocol/lifecycle calls and
// unknown methods are allowed through so the MCP SDK can return the proper
// JSON-RPC response codes (for example -32601 for method not found).
const AUTH_REQUIRED_METHODS = new Set<string>(["tools/call"]);

type JsonRpcId = string | number | null;

// Peek the JSON-RPC body so we can (1) echo the request id back in error
// responses (JSON-RPC 2.0 § 5.1 requires id equality) and (2) decide whether
// the request is attempting protected tool execution. Batches are handled
// conservatively: any protected or malformed entry forces auth.
function peekRpc(body: unknown): { id: JsonRpcId; authRequired: boolean } {
  const entries = Array.isArray(body) ? body : [body];
  let id: JsonRpcId = null;
  let firstHasId = false;
  let authRequired = entries.length === 0;
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      authRequired = true;
      continue;
    }
    const obj = entry as Record<string, unknown>;
    const method = typeof obj.method === "string" ? obj.method : undefined;
    if (!method || AUTH_REQUIRED_METHODS.has(method)) authRequired = true;
    if (!firstHasId && "id" in obj) {
      const raw = obj.id;
      if (typeof raw === "string" || typeof raw === "number" || raw === null) {
        id = raw;
      }
      firstHasId = true;
    }
  }
  return { id, authRequired };
}

interface ApiKeyContext {
  api_key_hash: string;
  tier: string;
  user_id: string | null;
  account_email: string | null;
  memory_quota_exempt: boolean;
}

function getSupabaseEnv(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

/**
 * Look up an inbound api_key in the api_keys table. Returns the tenancy
 * context if the key is active, or null otherwise. The Supabase service-role
 * client is created on demand so the validator no-ops gracefully when env is
 * unconfigured (local tests, preview deploys without secrets).
 */
async function validateApiKey(apiKey: string): Promise<ApiKeyContext | null> {
  const env = getSupabaseEnv();
  if (!env) return null;

  const supabase = createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const apiKeyHash = sha256hex(apiKey);
  const { data, error } = await supabase
    .from("api_keys")
    .select("user_id, tier, is_active")
    .eq("key_hash", apiKeyHash)
    .maybeSingle();

  if (error || !data || data.is_active === false) return null;

  let accountEmail: string | null = null;
  if (data.user_id) {
    try {
      const { data: userData } = await supabase.auth.admin.getUserById(data.user_id);
      accountEmail = userData.user?.email ?? null;
    } catch {
      accountEmail = null;
    }
  }
  const memoryQuotaExempt = isMemoryQuotaExemptEmail(accountEmail);

  // Fire-and-forget last_used_at + usage_count bump
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("key_hash", apiKeyHash)
    .then(() => {});

  return {
    api_key_hash: apiKeyHash,
    tier: effectiveMemoryTier(data.tier ?? "free", accountEmail),
    user_id: data.user_id ?? null,
    account_email: accountEmail,
    memory_quota_exempt: memoryQuotaExempt,
  };
}

/**
 * Read the Supabase auth session cookie off the request, verify it
 * with supabase.auth.getUser(), then resolve to an api_keys tenancy
 * context via the user_id FK added in Phase 2. Returns null if:
 *   - the cookie isn't present
 *   - the session is invalid/expired
 *   - the authenticated user has no api_keys row (edge case: user
 *     signed up via Supabase Auth without ever being issued a key)
 *
 * Returning null lets the handler fall through to the api_key path.
 * We never mix the two - session-cookie auth produces a distinct
 * ApiKeyContext where api_key_hash is still the tenancy key, but
 * derived from the user's api_keys row rather than an inbound
 * Authorization: Bearer header.
 */
async function validateSessionCookie(
  req: VercelRequest,
): Promise<ApiKeyContext | null> {
  const env = getSupabaseEnv();
  if (!env) return null;

  // Supabase stores the session in a cookie named sb-<project-ref>-auth-token
  // (or in the legacy "supabase-auth-token" slot). The value is a
  // url-encoded JSON array whose first entry is the access token. We
  // don't try to parse every shape here - we let supabase.auth.getUser
  // do the verification work, and just sniff the raw access token.
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const accessToken = extractSupabaseAccessToken(cookieHeader);
  if (!accessToken) return null;

  const supabase = createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(accessToken);
  if (userErr || !userData?.user) return null;
  const userId = userData.user.id;

  // Find an active api_keys row linked to this user. Phase 2 backfills
  // user_id where the old-shape api_keys.email matches an auth.users
  // row; the claim flow fills in the rest over time. Take the most
  // recently used key if the user has more than one.
  const { data: keyRow, error: keyErr } = await supabase
    .from("api_keys")
    .select("key_hash, tier, is_active, last_used_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (keyErr || !keyRow) return null;

  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("key_hash", keyRow.key_hash)
    .then(() => {});

  return {
    api_key_hash: keyRow.key_hash,
    tier: effectiveMemoryTier(keyRow.tier ?? "free", userData.user.email ?? null),
    user_id: userId,
    account_email: userData.user.email ?? null,
    memory_quota_exempt: isMemoryQuotaExemptEmail(userData.user.email ?? null),
  };
}

/**
 * Best-effort extraction of a Supabase access token out of the raw
 * cookie header. Supabase Auth names its cookie sb-<project>-auth-token
 * and stores a JSON-encoded array whose first element is the JWT.
 * If parsing fails we just return null and fall through.
 */
function extractSupabaseAccessToken(cookieHeader: string): string | null {
  const parts = cookieHeader.split(/;\s*/);
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (!/^sb-.*-auth-token$/.test(name) && name !== "supabase-auth-token") {
      continue;
    }
    const raw = decodeURIComponent(part.slice(eq + 1));
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && typeof parsed[0] === "string") {
        return parsed[0];
      }
      if (parsed && typeof parsed === "object" && typeof (parsed as { access_token?: unknown }).access_token === "string") {
        return (parsed as { access_token: string }).access_token;
      }
    } catch {
      // Some clients may just drop the raw JWT in. Treat the whole
      // value as the token if it looks like a JWT.
      if (/^[\w-]+\.[\w-]+\.[\w-]+$/.test(raw)) return raw;
    }
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── CORS - allow any origin so AI agents can connect from anywhere ──────────
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

  // Peek up front so error responses can echo the request id and so the auth
  // gate can recognise protected tool execution.
  const peeked = peekRpc(req.body);

  if (req.method !== "POST") {
    return res.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32601,
        message: "Method Not Allowed. POST to this endpoint with an MCP JSON-RPC message.",
      },
      id: peeked.id,
    });
  }

  // ── Auth ──────────────────────────────────────────────────────────────
  // Three paths, tried in order:
  //   1. Authorization: Bearer <unclick_api_key>   (agents)
  //   2. ?key=<unclick_api_key> query param         (Claude.ai / ChatGPT
  //      connector UIs that can't set headers)
  //   3. Supabase Auth session cookie               (browser on
  //      unclick.world after Phase 2 sign in)
  //
  // The api_key paths produce an ApiKeyContext directly. The session
  // cookie path resolves to the same ApiKeyContext shape via the
  // api_keys.user_id FK added in Phase 2, so everything downstream
  // (memory tenancy, tier checks) is identical.
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

  let ctx: ApiKeyContext | null = null;

  if (apiKey) {
    ctx = await validateApiKey(apiKey);
    if (!ctx && peeked.authRequired) {
      return res.status(401).json({
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message:
            "Invalid or revoked API key. Check that the key is correct and still active. " +
            "Manage keys at https://unclick.world",
        },
        id: peeked.id,
      });
    }
  } else if (peeked.authRequired) {
    // No api_key supplied - try resolving via Supabase session cookie.
    // Unprotected protocol methods skip this so the MCP SDK can answer them.
    ctx = await validateSessionCookie(req);
    if (!ctx) {
      return res.status(401).json({
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message:
            "Missing API key. Pass it as Authorization: Bearer <key> or as ?key=<key> in the URL. " +
            "Get a key at https://unclick.world",
        },
        id: peeked.id,
      });
    }
  }

  // Inject per-request context. Vercel invocations are isolated processes,
  // so mutating process.env here is safe and is the existing pattern used by
  // createClient() and the memory backend factory.
  //
  // UNCLICK_API_KEY is only set on the Bearer/query path because the
  // session-cookie path never sees the plaintext key. Downstream code
  // that actually needs the plaintext (BYOD credential decryption)
  // must accept that session-cookie-authenticated callers cannot
  // access it - this is the AES-256-GCM encryption property we
  // explicitly want to preserve: a logged-in user cannot decrypt
  // another device's stored credentials without holding the api_key.
  if (apiKey) {
    process.env.UNCLICK_API_KEY = apiKey;
  } else {
    delete process.env.UNCLICK_API_KEY;
  }
  // ctx is null only on unauthenticated handshake calls. Clear stale tenancy
  // env vars from prior invocations on the same warm serverless instance.
  if (ctx) {
    process.env.UNCLICK_API_KEY_HASH = ctx.api_key_hash;
    process.env.UNCLICK_TIER = ctx.tier;
    if (ctx.account_email) {
      process.env.UNCLICK_ACCOUNT_EMAIL = ctx.account_email;
    } else {
      delete process.env.UNCLICK_ACCOUNT_EMAIL;
    }
    process.env.UNCLICK_MEMORY_QUOTA_EXEMPT = ctx.memory_quota_exempt ? "true" : "false";
    if (ctx.user_id) {
      process.env.UNCLICK_USER_ID = ctx.user_id;
    } else {
      delete process.env.UNCLICK_USER_ID;
    }
  } else {
    delete process.env.UNCLICK_API_KEY_HASH;
    delete process.env.UNCLICK_TIER;
    delete process.env.UNCLICK_USER_ID;
    delete process.env.UNCLICK_ACCOUNT_EMAIL;
    delete process.env.UNCLICK_MEMORY_QUOTA_EXEMPT;
  }

  // ── MCP over Streamable HTTP (stateless per-request) ───────────────────────
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode - no sessions in serverless
  });

  const server = await createServer();

  // Normalize the Accept header before delegating to the SDK. The SDK's
  // Streamable HTTP transport bounces requests that lack both
  // "application/json" and "text/event-stream" with HTTP 406 + -32000 +
  // id:null - which cascades into RPC-002 (id null), RPC-004/MCP-006
  // (-32000 instead of -32601), and MCP-001/003/004 (initialize never
  // returns a real result). Spec-strict clients send both; spec-curious
  // ones (TestPass-core, plain JSON-RPC tools) send only application/json.
  // Stateless mode always replies with a JSON body, so being more
  // permissive than the SDK here is safe.
  normalizeAcceptHeader(req);

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
        id: peeked.id,
      });
    }
  } finally {
    // Clean up after the response is sent
    server.close().catch(() => {});
  }
}

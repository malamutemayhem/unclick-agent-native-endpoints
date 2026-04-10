/**
 * UnClick MCP Endpoint — Vercel serverless function
 *
 * Serves the UnClick MCP server over Streamable HTTP (JSON-RPC + SSE).
 * Agents connect here to discover and call all UnClick tools.
 *
 * Usage:
 *   POST https://unclick.world/api/mcp
 *   Authorization: Bearer <unclick_api_key>
 *   Content-Type: application/json
 *   Body: MCP JSON-RPC message (initialize, tools/list, tools/call, etc.)
 *
 * The endpoint is stateless — each request spins up a fresh MCP server
 * instance, which is safe for serverless and works with all MCP clients.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "../packages/mcp-server/src/server.js";

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

  // ── Auth — extract API key from Authorization header ───────────────────────
  const authHeader = (req.headers.authorization as string) ?? "";
  const apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!apiKey) {
    return res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32600,
        message:
          "Missing API key. Set Authorization: Bearer <your_unclick_api_key>. " +
          "Get a key at https://unclick.world",
      },
      id: null,
    });
  }

  // Inject the per-request API key so createClient() picks it up.
  // Vercel invocations are isolated processes, so this is safe.
  process.env.UNCLICK_API_KEY = apiKey;

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

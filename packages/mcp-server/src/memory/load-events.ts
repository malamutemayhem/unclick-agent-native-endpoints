/**
 * Load event logger for the UnClick MCP server.
 *
 * Fires a single memory_load_events row per session on the first tool
 * call, capturing everything session-state.ts has observed up to that
 * point (client info, whether instructions were sent, whether the
 * load-memory prompt fired, which memory:// resources were read, etc.).
 *
 * Designed to be fire-and-forget: any failure is swallowed so
 * instrumentation never breaks an agent's actual tool call.
 */

import * as crypto from "crypto";
import {
  sessionState,
  recordToolCall,
  type SessionState,
} from "./session-state.js";

const MEMORY_API_BASE =
  process.env.UNCLICK_MEMORY_BASE_URL ||
  process.env.UNCLICK_SITE_URL ||
  "https://unclick.world";

function sha256hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function buildPayload(state: SessionState) {
  const apiKey = process.env.UNCLICK_API_KEY;
  return {
    api_key_hash: apiKey ? sha256hex(apiKey) : null,
    session_id: state.sessionId,
    client_name: state.clientInfo?.name ?? null,
    client_version: state.clientInfo?.version ?? null,
    first_tool: state.firstToolCall,
    context_loaded: state.contextLoaded,
    tools_called_before_context: state.toolsCalledBeforeContext,
    instructions_sent: state.instructionsSent,
    prompt_used: state.promptUsed,
    resource_read: state.resourcesRead.length > 0,
    autoload_method: state.contextLoadMethod ?? "none",
  };
}

async function sendEvent(payload: Record<string, unknown>): Promise<void> {
  const apiKey = process.env.UNCLICK_API_KEY;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  await fetch(`${MEMORY_API_BASE}/api/memory-admin?action=log_tool_event`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

/**
 * Log a tool call event. Safe to call on every tool invocation: the first
 * call writes the memory_load_events row for this session, subsequent
 * calls are no-ops (we only care about the initial load pattern).
 */
export async function logToolCall(toolName: string): Promise<void> {
  recordToolCall(toolName);
  if (sessionState.logged) return;
  sessionState.logged = true;

  const payload = buildPayload(sessionState);
  // Fire-and-forget. Never let instrumentation break a tool call.
  sendEvent(payload).catch(() => {});
}

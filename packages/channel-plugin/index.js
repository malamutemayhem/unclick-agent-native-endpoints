#!/usr/bin/env node
/**
 * UnClick Channel plugin for Claude Code.
 *
 * Bridges the UnClick admin chat to a running Claude Code session so the
 * user's own Claude subscription handles the chat - no Gemini key needed.
 *
 * Speaks JSON-RPC over stdio (the same transport MCP uses). On init it
 * declares the `claude/channel` capability so Claude Code's Channel host
 * will accept notifications from us.
 *
 * Round-trip:
 *   1. Supabase Realtime fires on a pending chat_messages row.
 *   2. We mark the row `delivered` and send a `channel/message` notification
 *      over stdout so Claude Code surfaces the message in the session.
 *   3. Claude replies via the `unclick_channel_respond` tool we expose.
 *   4. We write the reply back to chat_messages (role=assistant, completed).
 *
 * A heartbeat to /api/memory-admin?action=admin_channel_heartbeat keeps the
 * admin UI informed that this channel is online.
 *
 * Env vars:
 *   UNCLICK_API_KEY        - required, the user's UnClick API key
 *   UNCLICK_API_BASE       - optional, defaults to https://unclick.world
 *   UNCLICK_SUPABASE_URL   - required (the UnClick project URL)
 *   UNCLICK_SUPABASE_ANON  - required (anon key - Realtime only needs this)
 *   UNCLICK_CHANNEL_POLL   - optional, fallback poll interval in ms (default 5000)
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import os from "node:os";
import process from "node:process";
import readline from "node:readline";
import { apiFetchJson } from "./http.js";
import { createHeartbeatGate } from "./heartbeat-gate.js";
import { readTimingConfig } from "./config.js";
import {
  getReceiptFirstTetherLadder,
  runTetherSelfCheck,
  saveConversationTurn,
  saveConversationTurnTool,
  tetherSelfCheckTool,
} from "./orchestrator-turns.js";

const API_BASE       = process.env.UNCLICK_API_BASE     || "https://unclick.world";
const API_KEY        = process.env.UNCLICK_API_KEY      || "";
const SUPABASE_URL   = process.env.UNCLICK_SUPABASE_URL || "";
const SUPABASE_ANON  = process.env.UNCLICK_SUPABASE_ANON || "";
const HEARTBEAT_MS   = 30_000;
const RESPONSE_TIMEOUT_MS = 5 * 60_000;
const timingConfig = readTimingConfig();
const POLL_INTERVAL = timingConfig.pollIntervalMs;
const API_TIMEOUT_MS = timingConfig.apiTimeoutMs;
const heartbeatGate = createHeartbeatGate();

function log(...args) {
  // Channel hosts use stdio for JSON-RPC, so keep human logs on stderr.
  process.stderr.write(`[unclick-channel] ${args.join(" ")}\n`);
}

function sha256hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function nowIso() {
  return new Date().toISOString();
}

// ─── JSON-RPC over stdio ────────────────────────────────────────────────────

function writeRpc(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

const pendingResponses = new Map(); // chat_messages.id -> { resolve, reject, timer }

function waitForResponse(messageId) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingResponses.delete(messageId);
      reject(new Error("Response timeout"));
    }, RESPONSE_TIMEOUT_MS);
    pendingResponses.set(messageId, { resolve, reject, timer });
  });
}

async function handleRpcLine(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }

  // Handle init handshake
  if (msg.method === "initialize") {
    writeRpc({
      jsonrpc: "2.0",
      id: msg.id,
      result: {
        protocolVersion: msg.params?.protocolVersion ?? "2024-11-05",
        capabilities: {
          // Declares this plugin as a Claude Code channel.
          "claude/channel": {
            name: "unclick-admin-chat",
            description: "UnClick admin chat bridge",
          },
          tools: { listChanged: false },
        },
        serverInfo: {
          name: "@unclick/channel",
          version: "0.1.0",
        },
      },
    });
    return;
  }

  if (msg.method === "notifications/initialized") {
    return;
  }

  if (msg.method === "tools/list") {
    writeRpc({
      jsonrpc: "2.0",
      id: msg.id,
      result: {
        tools: [
          {
            name: "unclick_channel_respond",
            description:
              "Send a reply back to the UnClick admin chat. Call this after processing an incoming channel/message notification. Pass the message_id from the notification and the reply content.",
            inputSchema: {
              type: "object",
              properties: {
                message_id: {
                  type: "string",
                  description: "The message_id from the channel/message notification you are replying to.",
                },
                content: {
                  type: "string",
                  description: "The reply text to send back to the admin chat.",
                },
              },
              required: ["message_id", "content"],
            },
          },
          saveConversationTurnTool,
          tetherSelfCheckTool,
        ],
      },
    });
    return;
  }

  if (msg.method === "tools/call") {
    const name = msg.params?.name;
    const args = msg.params?.arguments ?? {};
    if (name === "unclick_channel_respond") {
      const pending = pendingResponses.get(args.message_id);
      if (pending) {
        clearTimeout(pending.timer);
        pendingResponses.delete(args.message_id);
        pending.resolve(String(args.content ?? ""));
      }
      writeRpc({
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          content: [{ type: "text", text: "ok" }],
        },
      });
      return;
    }
    if (name === "unclick_save_conversation_turn") {
      try {
        const result = await saveConversationTurn(apiFetch, args);
        writeRpc({
          jsonrpc: "2.0",
          id: msg.id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    ok: true,
                    turn_id: result?.turn_id ?? null,
                    session_id: result?.session_id ?? null,
                    role: result?.role ?? null,
                    redacted: Boolean(result?.redacted),
                  },
                  null,
                  2
                ),
              },
            ],
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        writeRpc({
          jsonrpc: "2.0",
          id: msg.id,
          result: {
            isError: true,
            content: [
              {
                type: "text",
                text: `UNTETHERED: could not save Orchestrator turn: ${message}`,
              },
            ],
          },
        });
      }
      return;
    }
    if (name === "unclick_orchestrator_tether_check") {
      try {
        const result = await runTetherSelfCheck(apiFetch, args);
        writeRpc({
          jsonrpc: "2.0",
          id: msg.id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        writeRpc({
          jsonrpc: "2.0",
          id: msg.id,
          result: {
            isError: true,
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    ok: false,
                    status: "UNTETHERED",
                    missing: message,
                    guidance:
                      "Partial capture still counts: save any safe status/proof you can, then reconnect or update the missing bridge.",
                    ladder: getReceiptFirstTetherLadder(),
                  },
                  null,
                  2
                ),
              },
            ],
          },
        });
      }
      return;
    }
    writeRpc({
      jsonrpc: "2.0",
      id: msg.id,
      error: { code: -32601, message: `Unknown tool: ${name}` },
    });
    return;
  }

  if (msg.id !== undefined) {
    writeRpc({
      jsonrpc: "2.0",
      id: msg.id,
      error: { code: -32601, message: `Unknown method: ${msg.method}` },
    });
  }
}

function startStdioLoop() {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on("line", handleRpcLine);
  rl.on("close", () => process.exit(0));
}

// ─── Admin API calls ────────────────────────────────────────────────────────

async function apiFetch(action, { method = "GET", body, query = {} } = {}) {
  return apiFetchJson({
    apiBase: API_BASE,
    apiKey: API_KEY,
    action,
    method,
    body,
    query,
    timeoutMs: API_TIMEOUT_MS,
  });
}

async function sendHeartbeat() {
  if (!heartbeatGate.tryAcquire()) {
    log("heartbeat skipped: previous request still in flight");
    return;
  }

  try {
    await apiFetch("admin_channel_heartbeat", {
      method: "POST",
      body: {
        client_info: `${os.hostname()} (${os.platform()}/${os.arch()}) node ${process.version}`,
      },
    });
  } catch (err) {
    log("heartbeat failed:", err.message);
  } finally {
    heartbeatGate.release();
  }
}

// ─── Message processing ─────────────────────────────────────────────────────

const inFlight = new Set();

async function processMessage(row, supabase) {
  if (inFlight.has(row.id)) return;
  inFlight.add(row.id);

  try {
    // Claim the row so a second plugin instance won't grab it too.
    const { data: claimed, error: claimErr } = await supabase
      .from("chat_messages")
      .update({ status: "delivered", updated_at: nowIso() })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (claimErr) throw claimErr;
    if (!claimed) return; // another worker got it

    // Push the message into Claude Code via JSON-RPC notification.
    writeRpc({
      jsonrpc: "2.0",
      method: "channel/message",
      params: {
        message_id: row.id,
        session_id: row.session_id,
        role: row.role,
        content: row.content,
      },
    });

    await supabase
      .from("chat_messages")
      .update({ status: "processing", updated_at: nowIso() })
      .eq("id", row.id);

    const reply = await waitForResponse(row.id);

    await supabase.from("chat_messages").insert({
      api_key_hash: row.api_key_hash,
      session_id: row.session_id,
      role: "assistant",
      content: reply,
      status: "completed",
      metadata: { mode: "claude_code_channel" },
    });

    await supabase
      .from("chat_messages")
      .update({ status: "completed", updated_at: nowIso() })
      .eq("id", row.id);
  } catch (err) {
    log("processMessage error:", err.message);
    await supabase
      .from("chat_messages")
      .update({
        status: "error",
        updated_at: nowIso(),
        metadata: { error: err.message.slice(0, 500) },
      })
      .eq("id", row.id);
  } finally {
    inFlight.delete(row.id);
  }
}

async function pollPending(supabase, apiKeyHash) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("api_key_hash", apiKeyHash)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) {
    log("poll error:", error.message);
    return;
  }
  for (const row of data ?? []) {
    processMessage(row, supabase);
  }
}

// ─── Bootstrap ──────────────────────────────────────────────────────────────

async function main() {
  if (!API_KEY) {
    log("UNCLICK_API_KEY is not set. Exiting.");
    process.exit(1);
  }
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    log("UNCLICK_SUPABASE_URL and UNCLICK_SUPABASE_ANON must be set. Exiting.");
    process.exit(1);
  }

  const apiKeyHash = sha256hex(API_KEY);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false },
  });

  startStdioLoop();

  // Try Realtime first.
  try {
    supabase
      .channel(`chat_messages:${apiKeyHash}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `api_key_hash=eq.${apiKeyHash}`,
        },
        (payload) => {
          const row = payload.new;
          if (row && row.status === "pending") processMessage(row, supabase);
        }
      )
      .subscribe((status) => log("realtime status:", status));
  } catch (err) {
    log("realtime subscribe failed, polling only:", err.message);
  }

  // Poll as a fallback; safe because processMessage claims atomically.
  setInterval(() => pollPending(supabase, apiKeyHash), POLL_INTERVAL);

  sendHeartbeat();
  setInterval(sendHeartbeat, HEARTBEAT_MS);

  log(`ready. polling every ${POLL_INTERVAL}ms, heartbeat every ${HEARTBEAT_MS}ms`);
}

main().catch((err) => {
  log("fatal:", err.message);
  process.exit(1);
});

/**
 * Instrumentation surface for UnClick Memory.
 *
 * Two related responsibilities live here:
 *
 * 1. Low-level event logger. Writes a single row per event to
 *    memory_load_events (local JSON in dev, Supabase table in cloud).
 *    Used by the MCP Resources ReadResource handler and other callers
 *    that want to record a memory-related event directly.
 *
 * 2. Thin wrappers over session-state.ts so server.ts can keep its
 *    request handlers focused on protocol work while still recording
 *    which autoload path (instructions / prompt / resource / tool
 *    description) actually reached the agent. The session snapshot is
 *    flushed to memory_load_events by load-events.ts on the first tool
 *    call.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";

import {
  markPromptUsed,
  markResourceRead,
  markContextLoaded,
  setClientInfo,
  setInstructionsSent,
  type AutoloadMethod,
} from "./session-state.js";

const DATA_DIR = path.join(os.homedir(), ".unclick", "memory");
const TABLE = "memory_load_events";

export interface MemoryLoadEvent {
  tool_name: string;
  params?: Record<string, unknown>;
  result_bytes?: number;
  created_at: string;
}

function appendLocal(row: MemoryLoadEvent & { id: string }): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const file = path.join(DATA_DIR, `${TABLE}.json`);
    let rows: unknown[] = [];
    if (fs.existsSync(file)) {
      try {
        rows = JSON.parse(fs.readFileSync(file, "utf8"));
        if (!Array.isArray(rows)) rows = [];
      } catch {
        rows = [];
      }
    }
    rows.push(row);
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(rows, null, 2));
    fs.renameSync(tmp, file);
  } catch {
    // instrumentation must never crash the caller
  }
}

async function insertSupabase(row: MemoryLoadEvent): Promise<void> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    await sb.from(TABLE).insert(row);
  } catch {
    // table may not exist yet (chunk 0 installs it); ignore
  }
}

export function logMemoryLoadEvent(event: Omit<MemoryLoadEvent, "created_at">): void {
  const row = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ...event,
  };

  if (process.env.SUPABASE_URL) {
    void insertSupabase(row);
  } else {
    appendLocal(row);
  }
}

/** Called from the Initialize handler. */
export function trackInitialize(
  clientInfo: { name?: string; version?: string } | undefined,
  instructionsSent: boolean
): void {
  setClientInfo(clientInfo);
  setInstructionsSent(instructionsSent);
  if (instructionsSent) {
    markContextLoaded("instructions");
  }
}

/** Called from GetPromptRequest handler for any prompt read. */
export function trackPromptUsed(name: string): void {
  markPromptUsed(name);
}

/** Called from ReadResourceRequest handler for any resource read. */
export function trackResourceRead(uri: string): void {
  markResourceRead(uri);
}

/** Explicit hook for code paths that load context outside of the
 *  prompt / resource / instructions flow (e.g. direct RPC or manual). */
export function trackManualLoad(method: AutoloadMethod = "manual"): void {
  markContextLoaded(method);
}

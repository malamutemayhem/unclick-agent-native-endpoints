/**
 * Lightweight instrumentation for memory-related events.
 *
 * Writes a single row per event to memory_load_events. In local mode the row
 * lands in ~/.unclick/memory/memory_load_events.json; in cloud mode it is
 * inserted into the memory_load_events table if one exists (errors are
 * swallowed so callers never see instrumentation failures).
 *
 * Used today by the MCP Resources ReadResource handler; the same helper can
 * be reused later for tool-call logging without changing the schema.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";

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

/**
 * Backend factory for UnClick Memory.
 *
 * Auto-selects the right storage backend:
 *   - SUPABASE_URL set -> Supabase cloud mode (cross-machine sync)
 *   - Nothing set       -> Local JSON files (zero-config, instant start)
 */

import type { MemoryBackend } from "./types.js";

let backend: MemoryBackend | null = null;

export async function getBackend(): Promise<MemoryBackend> {
  if (backend) return backend;

  if (process.env.SUPABASE_URL) {
    const { SupabaseBackend } = await import("./supabase.js");
    backend = new SupabaseBackend();
  } else {
    const { LocalBackend } = await import("./local.js");
    backend = new LocalBackend();
  }

  return backend;
}

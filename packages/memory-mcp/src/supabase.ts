/**
 * Supabase client for UnClick Memory MCP
 *
 * Connects to the user's own Supabase instance (BYOD - Bring Your Own Database).
 * All memory data lives in the user's project, not ours.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) environment variables. " +
      "Set these in your MCP config's env block."
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return client;
}

/** Touch the access tracking columns on a row. */
export async function touchAccess(table: string, id: string): Promise<void> {
  const sb = getSupabase();
  await sb
    .from(table)
    .update({
      last_accessed: new Date().toISOString(),
      decay_tier: "hot",
    })
    .eq("id", id);
}

/** Run a Supabase RPC function. */
export async function rpc<T = unknown>(fn: string, params: Record<string, unknown> = {}): Promise<T> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc(fn, params);
  if (error) throw new Error(`rpc(${fn}) failed: ${error.message}`);
  return data as T;
}

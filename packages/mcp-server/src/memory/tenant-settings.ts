/**
 * Tenant-level settings for UnClick MCP server.
 *
 * Controls whether the server advertises the `instructions` field and the
 * Prompts capability during MCP initialization, and lets each tenant override
 * the default autoload instruction string.
 *
 * Source of truth (in priority order):
 *   1. `tenant_settings` row in the tenant's Supabase DB (cloud mode only),
 *      keyed by SHA-256 hash of the UnClick API key.
 *   2. Hard-coded defaults (autoload ON, prompts ON, resources ON).
 */

import * as crypto from "crypto";

export interface TenantSettings {
  /** Custom instructions string shown at MCP init. If null, the default is used. */
  autoload_instructions: string | null;
  /** If false, the server omits the `instructions` field entirely. */
  autoload_enabled: boolean;
  /** If false, the server does NOT advertise the prompts capability. */
  prompt_enabled: boolean;
  /** Reserved for a future MCP resources capability. */
  resources_enabled: boolean;
}

export const DEFAULT_AUTOLOAD_INSTRUCTIONS =
  "IMPORTANT: Before responding to the user or calling any other tool, you MUST call the " +
  "get_startup_context tool. It returns the user's business context, standing rules, project " +
  "memory, and known scars. Without it, your responses will be inaccurate and may contradict " +
  "prior decisions. This is non-negotiable - call get_startup_context first, every session.";

export const DEFAULT_TENANT_SETTINGS: TenantSettings = {
  autoload_instructions: null,
  autoload_enabled: true,
  prompt_enabled: true,
  resources_enabled: true,
};

function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

/**
 * Load tenant settings. Never throws - on any failure, returns defaults so
 * that a misconfigured tenant_settings table can never break server startup.
 */
export async function getTenantSettings(): Promise<TenantSettings> {
  const apiKey = process.env.UNCLICK_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  // Local mode or missing key: just use defaults.
  if (!apiKey || !supabaseUrl || !serviceKey) {
    return { ...DEFAULT_TENANT_SETTINGS };
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const keyHash = hashApiKey(apiKey);
    const { data, error } = await sb
      .from("tenant_settings")
      .select("autoload_instructions, autoload_enabled, prompt_enabled, resources_enabled")
      .eq("api_key_hash", keyHash)
      .maybeSingle();

    if (error || !data) return { ...DEFAULT_TENANT_SETTINGS };

    return {
      autoload_instructions:
        typeof data.autoload_instructions === "string" && data.autoload_instructions.length > 0
          ? data.autoload_instructions
          : null,
      autoload_enabled: data.autoload_enabled !== false,
      prompt_enabled: data.prompt_enabled !== false,
      resources_enabled: data.resources_enabled !== false,
    };
  } catch {
    return { ...DEFAULT_TENANT_SETTINGS };
  }
}

/**
 * Tenant settings for the UnClick MCP server.
 *
 * Controls which MCP capabilities (prompts, resources, etc.) this server
 * advertises. Values come from env vars at startup with safe defaults so the
 * server works zero-config; later chunks may hydrate these from Supabase per
 * tenant.
 */

export interface TenantSettings {
  prompts_enabled: boolean;
  resources_enabled: boolean;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const v = raw.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
  if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  return fallback;
}

let cached: TenantSettings | null = null;

export async function loadTenantSettings(): Promise<TenantSettings> {
  if (cached) return cached;
  cached = {
    prompts_enabled: envBool("UNCLICK_PROMPTS_ENABLED", true),
    resources_enabled: envBool("UNCLICK_RESOURCES_ENABLED", true),
  };
  return cached;
}

export function resetTenantSettingsCache(): void {
  cached = null;
}

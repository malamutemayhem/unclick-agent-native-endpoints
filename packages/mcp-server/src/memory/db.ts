/**
 * Backend factory for UnClick Memory.
 *
 * Auto-selects the right storage backend:
 *   - SUPABASE_URL set         -> Supabase cloud mode directly
 *   - UNCLICK_API_KEY set      -> Try to fetch BYOD config from UnClick; if
 *                                 found, use cloud mode with that config.
 *                                 Otherwise fall back to local.
 *   - Nothing set              -> Local JSON files (zero-config)
 *
 * This makes the wizard experience seamless: after setup.html succeeds, all
 * the user needs in their MCP config is UNCLICK_API_KEY — the server bootstraps
 * cloud memory automatically on startup.
 */

import type { MemoryBackend } from "./types.js";

let backend: MemoryBackend | null = null;

// The memory admin endpoints live on the main site, not the tool-calling API.
// Separate override so users can self-host either independently.
const MEMORY_API_BASE =
  process.env.UNCLICK_MEMORY_BASE_URL || process.env.UNCLICK_SITE_URL || "https://unclick.world";

async function tryFetchCloudConfig(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${MEMORY_API_BASE}/api/memory-admin?action=config`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      configured?: boolean;
      supabase_url?: string;
      service_role_key?: string;
    };
    if (!data.configured || !data.supabase_url || !data.service_role_key) return false;
    // Inject into env so the Supabase backend picks them up transparently.
    process.env.SUPABASE_URL = data.supabase_url;
    process.env.SUPABASE_SERVICE_ROLE_KEY = data.service_role_key;
    return true;
  } catch {
    return false;
  }
}

export async function getBackend(): Promise<MemoryBackend> {
  if (backend) return backend;

  // Direct env config always wins.
  if (!process.env.SUPABASE_URL && process.env.UNCLICK_API_KEY) {
    await tryFetchCloudConfig(process.env.UNCLICK_API_KEY);
  }

  const mode: "local" | "cloud" = process.env.SUPABASE_URL ? "cloud" : "local";

  if (mode === "cloud") {
    const { SupabaseBackend } = await import("./supabase.js");
    backend = new SupabaseBackend();
  } else {
    const { LocalBackend } = await import("./local.js");
    backend = new LocalBackend();
  }

  // Fire-and-forget device heartbeat (never blocks startup)
  if (process.env.UNCLICK_API_KEY) {
    import("./device.js")
      .then(({ sendDeviceHeartbeat }) => sendDeviceHeartbeat(mode))
      .catch(() => {});
  }

  return backend;
}

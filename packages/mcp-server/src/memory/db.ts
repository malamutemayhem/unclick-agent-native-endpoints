/**
 * Backend factory for UnClick Memory.
 *
 * Auto-selects the right storage backend per request. Precedence:
 *
 *   1. Validated /api/mcp request (UNCLICK_API_KEY + UNCLICK_API_KEY_HASH set):
 *      a. memory_configs row exists for this hash -> BYOD (user's own Supabase,
 *         single-tenant tables, decrypted via PBKDF2 from api_key)
 *      b. no memory_configs row                   -> managed cloud (central
 *         Supabase, mc_* tables, scoped by api_key_hash)
 *
 *   2. Standalone npm package, explicit BYOD via SUPABASE_URL env -> direct
 *      Supabase, single-tenant tables.
 *
 *   3. Standalone npm package with UNCLICK_API_KEY only -> remote BYOD lookup,
 *      falls through to local if not configured.
 *
 *   4. Local JSON files (zero-config) for the standalone npm package use case.
 *
 * Local JSON files are intentionally not available to /api/mcp serverless,
 * because Vercel /tmp wipes between cold starts.
 */

import type { MemoryBackend } from "./types.js";

// Capture the central Supabase env at module load time, before any request
// flow could mutate it. These point at UnClick's central Supabase project
// which hosts api_keys + memory_configs + the mc_* managed cloud memory tables.
const CENTRAL_SUPABASE_URL = process.env.SUPABASE_URL;
const CENTRAL_SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// The memory admin endpoints live on the main site, not the tool-calling API.
const MEMORY_API_BASE =
  process.env.UNCLICK_MEMORY_BASE_URL ||
  process.env.UNCLICK_SITE_URL ||
  "https://unclick.world";

interface ByodConfig {
  supabase_url: string;
  service_role_key: string;
}

async function fetchByodConfig(apiKey: string): Promise<ByodConfig | null> {
  try {
    const res = await fetch(`${MEMORY_API_BASE}/api/memory-admin?action=config`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<ByodConfig> & {
      configured?: boolean;
    };
    if (!data.configured || !data.supabase_url || !data.service_role_key) {
      return null;
    }
    return {
      supabase_url: data.supabase_url,
      service_role_key: data.service_role_key,
    };
  } catch {
    return null;
  }
}

// Per-tenant backend cache. Keyed so different api_keys never share a backend.
// In serverless this lives only for the lifetime of a warm instance, which is
// the right scope. In long-lived standalone use, the cache key is constant.
//
// TODO(phase-1+): bound this with an LRU if a single warm instance ever serves
// thousands of tenants. For Phase 1 the unbounded map is fine.
const backendCache = new Map<string, MemoryBackend>();

function instanceKey(): string {
  const hash = process.env.UNCLICK_API_KEY_HASH;
  if (hash) return `mc:${hash}`;
  if (process.env.SUPABASE_URL) return `byod-explicit:${process.env.SUPABASE_URL}`;
  if (process.env.UNCLICK_API_KEY) return `byod-remote:${process.env.UNCLICK_API_KEY}`;
  return "local";
}

export async function getBackend(): Promise<MemoryBackend> {
  const key = instanceKey();
  const cached = backendCache.get(key);
  if (cached) return cached;

  const backend = await buildBackend();
  backendCache.set(key, backend);

  // Fire-and-forget device heartbeat (never blocks startup). Mode label is
  // a hint for the heartbeat endpoint; it still classifies as cloud or local.
  if (process.env.UNCLICK_API_KEY) {
    const mode: "local" | "cloud" =
      backend.constructor.name === "LocalBackend" ? "local" : "cloud";
    import("./device.js")
      .then(({ sendDeviceHeartbeat }) => sendDeviceHeartbeat(mode))
      .catch(() => {});
  }

  return backend;
}

async function buildBackend(): Promise<MemoryBackend> {
  const apiKey = process.env.UNCLICK_API_KEY;
  const apiKeyHash = process.env.UNCLICK_API_KEY_HASH;

  // ── 1. Validated /api/mcp request ─────────────────────────────────────
  if (apiKey && apiKeyHash) {
    // 1a. BYOD: user has set up their own Supabase via the wizard.
    const byod = await fetchByodConfig(apiKey);
    if (byod) {
      const { SupabaseBackend } = await import("./supabase.js");
      return new SupabaseBackend({
        url: byod.supabase_url,
        serviceRoleKey: byod.service_role_key,
        tenancy: { mode: "byod" },
      });
    }

    // 1b. Managed cloud: central Supabase, scoped by api_key_hash.
    if (!CENTRAL_SUPABASE_URL || !CENTRAL_SUPABASE_KEY) {
      throw new Error(
        "Managed cloud memory unavailable: central Supabase env (SUPABASE_URL, " +
          "SUPABASE_SERVICE_ROLE_KEY) not configured on the server."
      );
    }
    const { SupabaseBackend } = await import("./supabase.js");
    return new SupabaseBackend({
      url: CENTRAL_SUPABASE_URL,
      serviceRoleKey: CENTRAL_SUPABASE_KEY,
      tenancy: { mode: "managed", apiKeyHash },
    });
  }

  // ── 2. Standalone: explicit BYOD via SUPABASE_URL env ─────────────────
  if (process.env.SUPABASE_URL) {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!serviceRoleKey) {
      throw new Error(
        "SUPABASE_URL is set but SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) is missing."
      );
    }
    const { SupabaseBackend } = await import("./supabase.js");
    return new SupabaseBackend({
      url,
      serviceRoleKey,
      tenancy: { mode: "byod" },
    });
  }

  // ── 3. Standalone: try remote BYOD lookup via api_key ─────────────────
  if (apiKey) {
    const byod = await fetchByodConfig(apiKey);
    if (byod) {
      const { SupabaseBackend } = await import("./supabase.js");
      return new SupabaseBackend({
        url: byod.supabase_url,
        serviceRoleKey: byod.service_role_key,
        tenancy: { mode: "byod" },
      });
    }
    // No remote config; fall through to local.
  }

  // ── 4. Local JSON files (zero-config standalone) ──────────────────────
  const { LocalBackend } = await import("./local.js");
  return new LocalBackend();
}

// ─── Credential Broker: vault-bridge ──────────────────────────────────────────
// Resolves platform credentials before any tool call.
// Resolution order (first match wins):
//   1. Inline args    - credentials already in the tool call (pass-through)
//   2. Env vars       - UNCLICK_{SLUG}_{FIELD} (e.g., UNCLICK_XERO_ACCESS_TOKEN)
//   3. Local vault    - keys "{slug}/{field}" in ~/.unclick/vault.enc
//                       requires UNCLICK_VAULT_PASSWORD env var to auto-unlock
//   4. Supabase       - encrypted credentials stored via unclick.world/connect/{slug}
//                       requires UNCLICK_API_KEY env var (the user's UnClick API key)
//                       fetches from https://unclick.world/api/credentials
//
// If nothing found: returns a structured error with setup instructions.
//
// Vault key convention:  "{slug}/{field_key}"  e.g.  "xero/access_token"
// Env var convention:    "UNCLICK_{SLUG}_{FIELD}"     e.g. "UNCLICK_XERO_ACCESS_TOKEN"

import { vaultAction }                   from "./vault-tool.js";
import { CONNECTORS, type ConnectorConfig } from "./connectors/index.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function envKey(slug: string, fieldKey: string): string {
  return `UNCLICK_${slug.toUpperCase()}_${fieldKey.toUpperCase().replace(/-/g, "_")}`;
}

function vaultKey(slug: string, fieldKey: string): string {
  return `${slug}/${fieldKey}`;
}

// ─── Core: resolveCredentials ─────────────────────────────────────────────────

/**
 * Resolves missing credentials for a platform tool call.
 *
 * Returns enriched args (with credentials injected) on success.
 * Returns `{ error: string, setup: {...} }` if credentials cannot be found.
 *
 * Usage in a tool file:
 *   const resolved = await resolveCredentials("xero", args);
 *   if ("error" in resolved) return resolved;
 *   // use resolved.access_token, resolved.tenant_id, etc.
 */
export async function resolveCredentials(
  slug: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const connector = CONNECTORS[slug];
  if (!connector) {
    return { error: `No connector config found for platform "${slug}".` };
  }

  // Which fields are missing from the incoming args?
  const missing = connector.credentialFields.filter(
    (f) => !args[f.key] || String(args[f.key]).trim() === ""
  );

  // All present inline - pass straight through.
  if (missing.length === 0) return args;

  const resolved: Record<string, unknown> = { ...args };
  let stillMissing = [...missing];

  // ── 1. Env vars ────────────────────────────────────────────────────────────
  for (const field of stillMissing) {
    const val = process.env[envKey(slug, field.key)];
    if (val && val.trim() !== "") {
      resolved[field.key] = val.trim();
    }
  }
  stillMissing = stillMissing.filter(
    (f) => !resolved[f.key] || String(resolved[f.key]).trim() === ""
  );
  if (stillMissing.length === 0) return resolved;

  // ── 2. Local vault ─────────────────────────────────────────────────────────
  const vaultPassword = process.env.UNCLICK_VAULT_PASSWORD?.trim();
  if (vaultPassword) {
    for (const field of stillMissing) {
      try {
        const result = await vaultAction("vault_retrieve", {
          master_password: vaultPassword,
          key:             vaultKey(slug, field.key),
          reveal:          true,
        });
        if (
          result &&
          typeof result === "object" &&
          "value" in (result as object) &&
          typeof (result as { value: unknown }).value === "string" &&
          (result as { value: string }).value.trim() !== ""
        ) {
          resolved[field.key] = (result as { value: string }).value;
        }
      } catch {
        // vault miss - continue to next source
      }
    }
    stillMissing = stillMissing.filter(
      (f) => !resolved[f.key] || String(resolved[f.key]).trim() === ""
    );
    if (stillMissing.length === 0) return resolved;
  }

  // ── 3. Supabase via UnClick API ────────────────────────────────────────────
  const apiKey  = process.env.UNCLICK_API_KEY?.trim();
  const apiBase = (process.env.UNCLICK_API_URL ?? "https://unclick.world").replace(/\/$/, "");

  if (apiKey) {
    try {
      const res = await fetch(`${apiBase}/api/credentials?platform=${encodeURIComponent(slug)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        for (const field of stillMissing) {
          if (data[field.key] && String(data[field.key]).trim() !== "") {
            resolved[field.key] = data[field.key];
          }
        }
        stillMissing = stillMissing.filter(
          (f) => !resolved[f.key] || String(resolved[f.key]).trim() === ""
        );
        if (stillMissing.length === 0) return resolved;
      }
    } catch {
      // network miss - fall through to error
    }
  }

  // ── 4. Return actionable error ─────────────────────────────────────────────
  return buildSetupError(connector, slug, stillMissing.map((f) => f.key));
}

// ─── Error builder ────────────────────────────────────────────────────────────

function buildSetupError(
  connector: ConnectorConfig,
  slug:      string,
  missingKeys: string[]
): Record<string, unknown> {
  const fields = connector.credentialFields.filter((f) => missingKeys.includes(f.key));

  const vaultCommands = fields
    .filter((f) => f.secret)
    .map((f) => `vault_store key="${vaultKey(slug, f.key)}" value="YOUR_${f.key.toUpperCase()}"`)
    .concat(
      fields
        .filter((f) => !f.secret)
        .map((f) => `vault_store key="${vaultKey(slug, f.key)}" value="YOUR_${f.key.toUpperCase()}"`)
    );

  const envVars = fields.map((f) => `${envKey(slug, f.key)}=your_value`);

  return {
    error:   `${connector.name} credentials not configured. Missing: ${missingKeys.join(", ")}.`,
    setup: {
      web:       `https://unclick.world/connect/${slug}`,
      vault:     vaultCommands,
      env_vars:  envVars,
      note:      connector.authType === "oauth2"
        ? `Visit the setup URL to complete the OAuth2 flow. Your token will be stored automatically.`
        : `Paste your credentials at the setup URL or store them directly in the vault.`,
    },
  };
}

// ─── Convenience: connectorFor ────────────────────────────────────────────────

/** Returns the connector config for a slug, or null. */
export function connectorFor(slug: string): ConnectorConfig | null {
  return CONNECTORS[slug] ?? null;
}

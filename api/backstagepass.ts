/**
 * UnClick BackstagePass admin API
 * Vercel serverless function backing the /admin/keychain surface.
 *
 * Design notes
 * ------------
 * BackstagePass stores encrypted credentials in the `user_credentials`
 * table. The encryption scheme (AES-256-GCM, PBKDF2-derived key,
 * per-row salt) uses the user's plaintext UnClick API key as the only
 * input to PBKDF2 — there is no server-side master key. That means
 * any reveal / rotate-values flow REQUIRES the caller to supply the
 * plaintext api_key. We accept it in the request body, then verify
 *   sha256(body.api_key) === api_keys.key_hash (for session.user.id)
 * before touching the vault. This gives us proof-of-possession auth on
 * top of the Supabase JWT session.
 *
 * Authentication is two-factor in the security-property sense:
 *   1. Supabase session JWT (Bearer header)       → proves identity
 *   2. Plaintext UnClick api_key (JSON body)      → proves key-holder
 * Both must match the same user row in `api_keys` for any mutation
 * that decrypts or re-encrypts. List and metadata-only update (label
 * change) only need factor 1.
 *
 * Every action writes a row to `backstagepass_audit` — success or
 * failure. Failed reveals are especially worth logging because they
 * are the primary signal of a compromised session.
 *
 * CORS is strict — unclick.world only. Admin surface should never
 * talk to this from a preview/3p origin.
 *
 * Action catalog
 * --------------
 *   GET    ?action=list
 *     Return metadata for every credential in the caller's vault.
 *     Never returns ciphertext, never returns plaintext.
 *
 *   POST   ?action=reveal        body: { id, api_key }
 *     Decrypt and return the plaintext values object for one row.
 *     Audited with success flag. Touches `last_used_at`.
 *
 *   POST   ?action=update        body: { id, label?, values?, api_key? }
 *     Label-only change (no api_key needed) — rename a credential.
 *     Values change  (api_key REQUIRED) — re-encrypt with new data.
 *     Returns the updated metadata row. Audited.
 *
 *   POST   ?action=delete        body: { id }
 *     Hard-delete the row. No soft-delete for now — the audit log
 *     preserves the existence + platform/label forever. Audited.
 *
 *   GET    ?action=audit[&credential_id=UUID][&limit=N]
 *     Return recent audit log entries for the caller. Default limit 50.
 *
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as crypto from "crypto";

// ─── Crypto helpers (mirror api/credentials.ts exactly) ───────────────────

const PBKDF2_ITERATIONS = 100_000;
const KEY_BYTES         = 32;
const IV_BYTES          = 12;
const SALT_BYTES        = 32;

function sha256hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function deriveKey(apiKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(apiKey, salt, PBKDF2_ITERATIONS, KEY_BYTES, "sha256");
}

function encrypt(
  plaintext: string,
  key:       Buffer,
): { iv: string; authTag: string; ciphertext: string; salt: Buffer } {
  const iv     = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc    = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    iv:         iv.toString("hex"),
    authTag:    cipher.getAuthTag().toString("hex"),
    ciphertext: enc.toString("hex"),
    salt:       Buffer.alloc(0), // populated by caller when rotating
  };
}

function decrypt(
  iv:         string,
  authTag:    string,
  ciphertext: string,
  key:        Buffer,
): string {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

// ─── Connection probes ───────────────────────────────────────────────────
//
// Lightweight authenticated GET per platform. The action=testConnection
// handler decrypts the stored credential, looks up the probe by platform
// slug, and makes one outbound request with a short timeout. Only a small
// curated set is supported initially. Platforms not in the map return an
// "untestable" response (ok=null) rather than throwing.
//
// To add a new platform: identify a cheap authenticated read endpoint on
// that provider (typically /me, /user, /models, /whoami) and add an entry
// here. Keep the request boring: GET, minimal headers, no body.
const PLATFORM_PROBES: Record<string, {
  url:           string;
  buildHeaders: (values: Record<string, string>) => Record<string, string>;
}> = {
  github: {
    url: "https://api.github.com/user",
    buildHeaders: (v) => ({
      Authorization: `Bearer ${v.api_key ?? v.token ?? ""}`,
      Accept:        "application/vnd.github+json",
      "User-Agent":  "unclick-backstagepass",
    }),
  },
  anthropic: {
    url: "https://api.anthropic.com/v1/models",
    buildHeaders: (v) => ({
      "x-api-key":         v.api_key ?? "",
      "anthropic-version": "2023-06-01",
    }),
  },
  openai: {
    url: "https://api.openai.com/v1/models",
    buildHeaders: (v) => ({
      Authorization: `Bearer ${v.api_key ?? ""}`,
    }),
  },
};

// ─── Supabase REST helper ────────────────────────────────────────

function supaHeaders(serviceRoleKey: string): Record<string, string> {
  return {
    apikey:         serviceRoleKey,
    Authorization:  `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

async function supaFetch(
  url:     string,
  method:  string,
  headers: Record<string, string>,
  body?:   unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res  = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: unknown = null;
  try { data = await res.json(); } catch { /* ignore */ }
  return { ok: res.ok, status: res.status, data };
}

// ─── Auth: Supabase JWT + api_keys row resolution ───────────────────────

interface Tenant {
  userId:      string;
  email:       string | null;
  apiKeyHash:  string;
}

/**
 * Verify the Bearer token is a valid Supabase Auth JWT and look up the
 * single api_keys row for the owning user. Returns null if either step
 * fails — the caller should respond with 401.
 */
async function resolveTenant(
  req:             VercelRequest,
  supabaseUrl:     string,
  serviceRoleKey:  string,
): Promise<Tenant | null> {
  const authHeader = req.headers.authorization ?? "";
  const token      = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  // Bearer tokens beginning with uc_/agt_ are UnClick api_keys — valid
  // for /api/credentials but NOT for this endpoint. Reject up front so
  // we don't treat an api_key as a JWT.
  if (token.startsWith("uc_") || token.startsWith("agt_")) return null;

  // Resolve auth user via Supabase Auth REST.
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return null;
  const user = (await userRes.json()) as { id?: string; email?: string | null };
  if (!user.id) return null;

  // Look up the user's api_keys row. Support both new-shape (key_hash
  // column, Phase-2) and legacy (api_key plaintext column, Phase-1).
  const qUrl = `${supabaseUrl}/rest/v1/api_keys?user_id=eq.${encodeURIComponent(user.id)}&select=key_hash,api_key&limit=1`;
  const { ok, data } = await supaFetch(qUrl, "GET", supaHeaders(serviceRoleKey));
  if (!ok) return null;
  const rows = (data as Array<{ key_hash?: string | null; api_key?: string | null }>) ?? [];
  const row  = rows[0];
  if (!row) return null;

  const keyHash = row.key_hash ?? (row.api_key ? sha256hex(row.api_key) : null);
  if (!keyHash) return null;

  return { userId: user.id, email: user.email ?? null, apiKeyHash: keyHash };
}

function clientIp(req: VercelRequest): string | null {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0]?.trim() || null;
  if (Array.isArray(fwd))      return fwd[0] ?? null;
  return (req.socket as { remoteAddress?: string } | undefined)?.remoteAddress ?? null;
}

function clientUa(req: VercelRequest): string | null {
  const ua = req.headers["user-agent"];
  return typeof ua === "string" ? ua : null;
}

// ─── Audit writer ────────────────────────────────────────────────

async function writeAudit(params: {
  supabaseUrl:    string;
  serviceRoleKey: string;
  tenant:         Tenant;
  req:            VercelRequest;
  action:         string;
  credentialId?:  string | null;
  platformSlug?:  string | null;
  label?:         string | null;
  success?:       boolean;
  metadata?:      Record<string, unknown>;
}): Promise<void> {
  try {
    const row = {
      actor_user_id: params.tenant.userId,
      api_key_hash:  params.tenant.apiKeyHash,
      action:        params.action,
      credential_id: params.credentialId ?? null,
      platform_slug: params.platformSlug ?? null,
      label:         params.label ?? null,
      ip:            clientIp(params.req),
      user_agent:    clientUa(params.req),
      success:       params.success ?? true,
      metadata:      params.metadata ?? {},
    };
    await supaFetch(
      `${params.supabaseUrl}/rest/v1/backstagepass_audit`,
      "POST",
      supaHeaders(params.serviceRoleKey),
      row,
    );
  } catch {
    // Audit must never break the caller's request. Log and move on.
    // eslint-disable-next-line no-console
    console.error("backstagepass_audit write failed");
  }
}

// ─── Connector catalog lookup (optional, enriches list responses) ────────────

async function fetchConnectorMap(
  supabaseUrl:     string,
  serviceRoleKey:  string,
): Promise<Record<string, { name: string; category: string; icon: string | null }>> {
  try {
    const url = `${supabaseUrl}/rest/v1/platform_connectors?select=id,name,category,icon`;
    const { ok, data } = await supaFetch(url, "GET", supaHeaders(serviceRoleKey));
    if (!ok) return {};
    const rows = (data as Array<{ id: string; name: string; category: string; icon: string | null }>) ?? [];
    const map: Record<string, { name: string; category: string; icon: string | null }> = {};
    for (const r of rows) map[r.id] = { name: r.name, category: r.category, icon: r.icon };
    return map;
  } catch {
    return {};
  }
}

// ─── Handler ───────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin",  "https://unclick.world");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  const supabaseUrl    = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: "Server credentials not configured." });
  }

  const tenant = await resolveTenant(req, supabaseUrl, serviceRoleKey);
  if (!tenant) return res.status(401).json({ error: "Not signed in." });

  const action = String(req.query.action ?? "").trim();
  const body   = (req.body ?? {}) as Record<string, unknown>;

  // ── GET actions ─────────────────────────────────────────────────

  if (req.method === "GET" && action === "list") {
    const url = `${supabaseUrl}/rest/v1/user_credentials`
      + `?api_key_hash=eq.${encodeURIComponent(tenant.apiKeyHash)}`
      + `&select=id,platform_slug,label,is_valid,last_tested_at,last_used_at,expires_at,created_at,updated_at`
      + `&order=platform_slug.asc,label.asc.nullsfirst`;
    const { ok, data } = await supaFetch(url, "GET", supaHeaders(serviceRoleKey));
    if (!ok) return res.status(502).json({ error: "Vault lookup failed." });

    const rows = (data as Array<Record<string, unknown>>) ?? [];
    const connectors = await fetchConnectorMap(supabaseUrl, serviceRoleKey);
    const enriched = rows.map((r) => {
      const slug = r.platform_slug as string;
      const c = connectors[slug];
      return {
        id:              r.id,
        platform:        slug,
        label:           r.label ?? null,
        is_valid:        r.is_valid !== false,
        last_tested_at:  r.last_tested_at ?? null,
        last_used_at:    r.last_used_at ?? null,
        expires_at:      r.expires_at ?? null,
        created_at:      r.created_at,
        updated_at:      r.updated_at,
        connector:       c
          ? { id: slug, name: c.name, category: c.category, icon: c.icon }
          : null,
      };
    });

    return res.status(200).json({ data: enriched });
  }

  if (req.method === "GET" && action === "audit") {
    const credentialId = typeof req.query.credential_id === "string" ? req.query.credential_id : null;
    const limit        = Math.min(Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1), 500);
    const credFilter   = credentialId
      ? `&credential_id=eq.${encodeURIComponent(credentialId)}`
      : "";
    const url = `${supabaseUrl}/rest/v1/backstagepass_audit`
      + `?api_key_hash=eq.${encodeURIComponent(tenant.apiKeyHash)}`
      + credFilter
      + `&select=id,action,credential_id,platform_slug,label,ip,user_agent,success,metadata,created_at`
      + `&order=created_at.desc&limit=${limit}`;
    const { ok, data } = await supaFetch(url, "GET", supaHeaders(serviceRoleKey));
    if (!ok) return res.status(502).json({ error: "Audit lookup failed." });
    return res.status(200).json({ data: data ?? [] });
  }

  // ── POST actions ────────────────────────────────────────────────

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  // Fetch a single credential row scoped to this tenant. Used by reveal,
  // update, delete so they can't act on rows that don't belong to them.
  // Locals copy the already-narrowed values so TS tracks them inside the closure.
  const tenantHash   = tenant.apiKeyHash;
  const sbUrl        = supabaseUrl;
  const sbServiceKey = serviceRoleKey;
  async function fetchOwnedRow(id: string): Promise<Record<string, unknown> | null> {
    const url = `${sbUrl}/rest/v1/user_credentials`
      + `?api_key_hash=eq.${encodeURIComponent(tenantHash)}`
      + `&id=eq.${encodeURIComponent(id)}`
      + `&select=*&limit=1`;
    const { ok, data } = await supaFetch(url, "GET", supaHeaders(sbServiceKey));
    if (!ok) return null;
    const rows = (data as Array<Record<string, unknown>>) ?? [];
    return rows[0] ?? null;
  }

  if (action === "reveal") {
    const id     = typeof body.id === "string" ? body.id : "";
    const apiKey = typeof body.api_key === "string" ? body.api_key : "";
    if (!id)     return res.status(400).json({ error: "id is required." });
    if (!apiKey) return res.status(400).json({ error: "api_key is required." });

    // Proof-of-possession: the submitted api_key must hash to the same
    // value stored for this user. Prevents a session hijack from
    // converting directly into a plaintext credential dump.
    if (sha256hex(apiKey) !== tenant.apiKeyHash) {
      await writeAudit({
        supabaseUrl, serviceRoleKey, tenant, req,
        action: "reveal", credentialId: id, success: false,
        metadata: { reason: "api_key_mismatch" },
      });
      return res.status(403).json({ error: "UnClick API key does not match the signed-in user." });
    }

    const row = await fetchOwnedRow(id);
    if (!row) {
      await writeAudit({
        supabaseUrl, serviceRoleKey, tenant, req,
        action: "reveal", credentialId: id, success: false,
        metadata: { reason: "not_found" },
      });
      return res.status(404).json({ error: "Credential not found." });
    }

    let values: Record<string, string>;
    try {
      const salt = Buffer.from(row.encryption_salt as string, "hex");
      const key  = deriveKey(apiKey, salt);
      const pt   = decrypt(
        row.encryption_iv  as string,
        row.encryption_tag as string,
        row.encrypted_data as string,
        key,
      );
      values = JSON.parse(pt) as Record<string, string>;
    } catch {
      await writeAudit({
        supabaseUrl, serviceRoleKey, tenant, req,
        action: "reveal", credentialId: id,
        platformSlug: row.platform_slug as string,
        label: (row.label as string) ?? null,
        success: false, metadata: { reason: "decrypt_failed" },
      });
      return res.status(500).json({ error: "Failed to decrypt credential." });
    }

    // Touch last_used_at. Fire-and-forget — a failed write shouldn't
    // block the reveal.
    supaFetch(
      `${supabaseUrl}/rest/v1/user_credentials?id=eq.${encodeURIComponent(id)}`,
      "PATCH",
      supaHeaders(serviceRoleKey),
      { last_used_at: new Date().toISOString() },
    ).catch(() => { /* ignore */ });

    await writeAudit({
      supabaseUrl, serviceRoleKey, tenant, req,
      action: "reveal", credentialId: id,
      platformSlug: row.platform_slug as string,
      label: (row.label as string) ?? null,
      success: true,
      metadata: { fields: Object.keys(values) },
    });

    return res.status(200).json({
      id,
      platform: row.platform_slug,
      label:    (row.label as string) ?? null,
      values,
    });
  }

  if (action === "testConnection") {
    const id     = typeof body.id === "string" ? body.id : "";
    const apiKey = typeof body.api_key === "string" ? body.api_key : "";
    if (!id)     return res.status(400).json({ error: "id is required." });
    if (!apiKey) return res.status(400).json({ error: "api_key is required." });

    if (sha256hex(apiKey) !== tenant.apiKeyHash) {
      await writeAudit({
        supabaseUrl, serviceRoleKey, tenant, req,
        action: "test_connection", credentialId: id, success: false,
        metadata: { reason: "api_key_mismatch" },
      });
      return res.status(403).json({ error: "UnClick API key does not match the signed-in user." });
    }

    const row = await fetchOwnedRow(id);
    if (!row) {
      await writeAudit({
        supabaseUrl, serviceRoleKey, tenant, req,
        action: "test_connection", credentialId: id, success: false,
        metadata: { reason: "not_found" },
      });
      return res.status(404).json({ error: "Credential not found." });
    }

    const platform = row.platform_slug as string;
    const probe = PLATFORM_PROBES[platform];
    if (!probe) {
      await writeAudit({
        supabaseUrl, serviceRoleKey, tenant, req,
        action: "test_connection", credentialId: id,
        platformSlug: platform, label: (row.label as string) ?? null,
        success: false, metadata: { reason: "platform_untestable" },
      });
      return res.status(200).json({
        ok:         null,
        platform,
        tested_at:  new Date().toISOString(),
        message:    `Connection testing is not yet supported for ${platform}.`,
      });
    }

    let values: Record<string, string>;
    try {
      const salt = Buffer.from(row.encryption_salt as string, "hex");
      const key  = deriveKey(apiKey, salt);
      const pt   = decrypt(
        row.encryption_iv  as string,
        row.encryption_tag as string,
        row.encrypted_data as string,
        key,
      );
      values = JSON.parse(pt) as Record<string, string>;
    } catch {
      await writeAudit({
        supabaseUrl, serviceRoleKey, tenant, req,
        action: "test_connection", credentialId: id,
        platformSlug: platform, label: (row.label as string) ?? null,
        success: false, metadata: { reason: "decrypt_failed" },
      });
      return res.status(500).json({ error: "Failed to decrypt credential." });
    }

    const testedAt = new Date().toISOString();
    let ok = false;
    let status = 0;
    let message = "";
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5_000);
      const probeRes = await fetch(probe.url, {
        method:  "GET",
        headers: probe.buildHeaders(values),
        signal:  controller.signal,
      });
      clearTimeout(timer);
      status  = probeRes.status;
      ok      = probeRes.ok;
      message = ok ? "Authenticated request succeeded." : `Platform returned ${probeRes.status}.`;
    } catch (err) {
      message = err instanceof Error && err.name === "AbortError"
        ? "Probe timed out after 5s."
        : `Probe failed: ${err instanceof Error ? err.message : "unknown error"}`;
    }

    // Touch last_tested_at so the list view can surface test freshness.
    supaFetch(
      `${supabaseUrl}/rest/v1/user_credentials?id=eq.${encodeURIComponent(id)}`,
      "PATCH",
      supaHeaders(serviceRoleKey),
      { is_valid: ok, last_tested_at: testedAt },
    ).catch(() => { /* ignore */ });

    await writeAudit({
      supabaseUrl, serviceRoleKey, tenant, req,
      action: "test_connection", credentialId: id,
      platformSlug: platform, label: (row.label as string) ?? null,
      success: ok, metadata: { status },
    });

    return res.status(200).json({ ok, status, platform, tested_at: testedAt, message });
  }

  if (action === "update") {
    const id        = typeof body.id === "string" ? body.id : "";
    const newLabel  = typeof body.label === "string" ? body.label : undefined;
    const newValues = body.values && typeof body.values === "object" ? body.values as Record<string, string> : undefined;
    const apiKey    = typeof body.api_key === "string" ? body.api_key : "";
    if (!id) return res.status(400).json({ error: "id is required." });
    if (newLabel === undefined && newValues === undefined) {
      return res.status(400).json({ error: "Provide at least one of: label, values." });
    }

    const row = await fetchOwnedRow(id);
    if (!row) return res.status(404).json({ error: "Credential not found." });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (newLabel !== undefined) {
      // Label-only change — no decrypt required. Empty string → NULL.
      patch.label = newLabel.trim() === "" ? null : newLabel.trim();
    }

    let valuesRotated = false;
    if (newValues !== undefined) {
      // Values change — require proof-of-possession api_key, derive a
      // fresh salt/iv and re-encrypt. Verify the submitted key hashes
      // to the session's api_key_hash first.
      if (!apiKey) {
        return res.status(400).json({ error: "api_key is required to change credential values." });
      }
      if (sha256hex(apiKey) !== tenant.apiKeyHash) {
        await writeAudit({
          supabaseUrl, serviceRoleKey, tenant, req,
          action: "update_values", credentialId: id, success: false,
          metadata: { reason: "api_key_mismatch" },
        });
        return res.status(403).json({ error: "UnClick API key does not match the signed-in user." });
      }
      const salt      = crypto.randomBytes(SALT_BYTES);
      const key       = deriveKey(apiKey, salt);
      const plaintext = JSON.stringify(newValues);
      const enc       = encrypt(plaintext, key);
      patch.encrypted_data  = enc.ciphertext;
      patch.encryption_iv   = enc.iv;
      patch.encryption_tag  = enc.authTag;
      patch.encryption_salt = salt.toString("hex");
      // Fresh rotation → assume valid until re-tested.
      patch.is_valid        = true;
      patch.last_tested_at  = null;
      valuesRotated = true;
    }

    const url = `${supabaseUrl}/rest/v1/user_credentials?id=eq.${encodeURIComponent(id)}`;
    const { ok, status } = await supaFetch(
      url, "PATCH",
      { ...supaHeaders(serviceRoleKey), Prefer: "return=representation" },
      patch,
    );
    if (!ok) {
      await writeAudit({
        supabaseUrl, serviceRoleKey, tenant, req,
        action: valuesRotated ? "update_values" : "update_label",
        credentialId: id,
        platformSlug: row.platform_slug as string,
        label: (row.label as string) ?? null,
        success: false, metadata: { status },
      });
      return res.status(502).json({ error: "Failed to update credential." });
    }

    await writeAudit({
      supabaseUrl, serviceRoleKey, tenant, req,
      action: valuesRotated ? "update_values" : "update_label",
      credentialId: id,
      platformSlug: row.platform_slug as string,
      label: (patch.label as string | null | undefined) ?? (row.label as string | null),
      success: true,
      metadata: {
        changed: {
          label:  newLabel !== undefined,
          values: valuesRotated,
        },
        prev_label: (row.label as string) ?? null,
      },
    });

    return res.status(200).json({ id, updated: true });
  }

  if (action === "delete") {
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return res.status(400).json({ error: "id is required." });

    const row = await fetchOwnedRow(id);
    if (!row) return res.status(404).json({ error: "Credential not found." });

    const url = `${supabaseUrl}/rest/v1/user_credentials?id=eq.${encodeURIComponent(id)}`;
    const { ok, status } = await supaFetch(url, "DELETE", supaHeaders(serviceRoleKey));
    if (!ok) {
      await writeAudit({
        supabaseUrl, serviceRoleKey, tenant, req,
        action: "delete", credentialId: id,
        platformSlug: row.platform_slug as string,
        label: (row.label as string) ?? null,
        success: false, metadata: { status },
      });
      return res.status(502).json({ error: "Failed to delete credential." });
    }

    await writeAudit({
      supabaseUrl, serviceRoleKey, tenant, req,
      action: "delete", credentialId: id,
      platformSlug: row.platform_slug as string,
      label: (row.label as string) ?? null,
      success: true,
    });

    return res.status(200).json({ id, deleted: true });
  }

  return res.status(400).json({ error: `Unknown action: ${action || "(empty)"}` });
}

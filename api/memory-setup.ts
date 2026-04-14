/**
 * UnClick Memory Setup API
 *
 * POST /api/memory-setup
 *   Body: { api_key, service_role_key, supabase_url?, email? }
 *   Validates the service_role key, decodes its JWT to auto-extract the project
 *   URL (so users only paste one thing), runs the memory schema, and stores
 *   encrypted credentials keyed by the UnClick API key.
 *
 * GET /api/memory-setup?api_key=...
 *   Returns whether memory is configured for this key + masked URL + schema health.
 *
 * Encryption mirrors /api/credentials: AES-256-GCM with a PBKDF2 key derived
 * from the UnClick API key. Only the key-holder can decrypt their own config.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const PBKDF2_ITERATIONS = 100_000;
const KEY_BYTES = 32;
const IV_BYTES = 12;
const SALT_BYTES = 32;

function sha256hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function deriveKey(apiKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(apiKey, salt, PBKDF2_ITERATIONS, KEY_BYTES, "sha256");
}

function encrypt(plaintext: string, key: Buffer): { iv: string; authTag: string; ciphertext: string } {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("hex"),
    authTag: cipher.getAuthTag().toString("hex"),
    ciphertext: enc.toString("hex"),
  };
}

/** Decode a Supabase service_role JWT and return the project ref. */
function decodeProjectRef(jwt: string): string | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    // base64url -> base64
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as {
      ref?: string;
      role?: string;
    };
    if (payload.role !== "service_role") return null;
    return payload.ref ?? null;
  } catch {
    return null;
  }
}

/** Load the bundled memory schema SQL (co-located with the deployed function). */
function loadSchemaSql(): string {
  // Try several candidate locations so the function works in local dev + Vercel.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "..", "packages", "memory-mcp", "schema.sql"),
    path.join(here, "..", "..", "packages", "memory-mcp", "schema.sql"),
    path.join(process.cwd(), "packages", "memory-mcp", "schema.sql"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  }
  throw new Error("schema.sql not found in expected locations");
}

function supabaseHeaders(serviceRoleKey: string): Record<string, string> {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

/** Run the memory schema against the user's Supabase via the exec_sql RPC or pg_meta. */
async function installSchema(supabaseUrl: string, serviceRoleKey: string): Promise<{ ok: boolean; error?: string }> {
  const sql = loadSchemaSql();
  // Supabase doesn't expose arbitrary SQL over REST without an RPC. We fall back
  // to returning the SQL so the wizard can prompt the user to run it manually.
  // Prefer the exec_sql RPC if the user has it set up (some do for migrations).
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: supabaseHeaders(serviceRoleKey),
      body: JSON.stringify({ sql }),
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: "exec_sql RPC not available" };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Probe that the schema is installed by checking for one of the six tables. */
async function verifySchema(supabaseUrl: string, serviceRoleKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/business_context?select=id&limit=1`, {
      headers: supabaseHeaders(serviceRoleKey),
    });
    // 200 = exists, even if empty. 404/400/401 = not installed or bad creds.
    return res.ok;
  } catch {
    return false;
  }
}

async function supabaseFetch(url: string, method: string, headers: Record<string, string>, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: unknown;
  try { data = await res.json(); } catch { data = null; }
  return { ok: res.ok, status: res.status, data };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  const unclickSupabaseUrl = process.env.SUPABASE_URL;
  const unclickServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!unclickSupabaseUrl || !unclickServiceKey) {
    return res.status(500).json({ error: "Server not configured" });
  }

  // ── GET: check existing config ─────────────────────────────────────────
  if (req.method === "GET") {
    const apiKey = String(req.query.api_key ?? "").trim();
    if (!apiKey) return res.status(400).json({ error: "api_key required" });

    const apiKeyHash = sha256hex(apiKey);
    const lookupUrl = `${unclickSupabaseUrl}/rest/v1/memory_configs?api_key_hash=eq.${encodeURIComponent(apiKeyHash)}&select=supabase_url,schema_installed,schema_installed_at,last_used_at,updated_at`;
    const { ok, data } = await supabaseFetch(lookupUrl, "GET", supabaseHeaders(unclickServiceKey));
    if (!ok) return res.status(502).json({ error: "Lookup failed" });

    const rows = data as Array<Record<string, unknown>>;
    if (!rows || rows.length === 0) {
      return res.status(200).json({ configured: false });
    }
    return res.status(200).json({
      configured: true,
      supabase_url: rows[0].supabase_url,
      schema_installed: rows[0].schema_installed,
      schema_installed_at: rows[0].schema_installed_at,
      last_used_at: rows[0].last_used_at,
      updated_at: rows[0].updated_at,
    });
  }

  // ── POST: create / update config ───────────────────────────────────────
  if (req.method === "POST") {
    const body = req.body as {
      api_key?: string;
      service_role_key?: string;
      supabase_url?: string;
      email?: string;
    };
    const apiKey = (body?.api_key ?? "").trim();
    const serviceRoleKey = (body?.service_role_key ?? "").trim();
    let supabaseUrl = (body?.supabase_url ?? "").trim();
    const email = body?.email?.trim().toLowerCase();

    if (!apiKey) return res.status(400).json({ error: "api_key required" });
    if (!apiKey.startsWith("uc_") && !apiKey.startsWith("agt_")) {
      return res.status(400).json({ error: "Invalid api_key format" });
    }
    if (!serviceRoleKey || serviceRoleKey.length < 40) {
      return res.status(400).json({ error: "service_role_key looks invalid" });
    }

    // Auto-extract the project URL from the JWT so users only paste one thing.
    if (!supabaseUrl) {
      const ref = decodeProjectRef(serviceRoleKey);
      if (!ref) {
        return res.status(400).json({
          error: "Could not read project ref from key. Paste the Supabase URL too.",
          need_url: true,
        });
      }
      supabaseUrl = `https://${ref}.supabase.co`;
    }

    // Validate the credentials by pinging Supabase. Schema might not exist yet.
    const pingRes = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    if (!pingRes.ok && pingRes.status !== 404) {
      return res.status(400).json({
        error: `Supabase rejected that key (HTTP ${pingRes.status}). Double-check you copied the service_role key, not anon.`,
      });
    }

    // Try to install the schema. If exec_sql isn't available, fall back to
    // returning the SQL for manual run + verify.
    const install = await installSchema(supabaseUrl, serviceRoleKey);
    const schemaInstalled = install.ok || (await verifySchema(supabaseUrl, serviceRoleKey));

    // Encrypt the service_role key with a PBKDF2 key derived from UNCLICK_API_KEY.
    const salt = crypto.randomBytes(SALT_BYTES);
    const encKey = deriveKey(apiKey, salt);
    const { iv, authTag, ciphertext } = encrypt(serviceRoleKey, encKey);
    const apiKeyHash = sha256hex(apiKey);

    const row = {
      api_key_hash: apiKeyHash,
      email: email ?? null,
      supabase_url: supabaseUrl,
      encrypted_service_key: ciphertext,
      encryption_iv: iv,
      encryption_tag: authTag,
      encryption_salt: salt.toString("hex"),
      schema_installed: schemaInstalled,
      schema_installed_at: schemaInstalled ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const tableUrl = `${unclickSupabaseUrl}/rest/v1/memory_configs`;
    const headers = {
      ...supabaseHeaders(unclickServiceKey),
      Prefer: "resolution=merge-duplicates,return=representation",
    };
    const { ok, status } = await supabaseFetch(tableUrl, "POST", headers, row);
    if (!ok) {
      return res.status(status).json({ error: "Failed to store memory config" });
    }

    return res.status(200).json({
      success: true,
      supabase_url: supabaseUrl,
      schema_installed: schemaInstalled,
      schema_sql: schemaInstalled ? undefined : loadSchemaSql(),
      message: schemaInstalled
        ? "Memory cloud sync is live. Restart your MCP client."
        : "Credentials saved. Run the included SQL in your Supabase SQL editor, then you're done.",
    });
  }

  // ── DELETE: remove config (user-initiated disconnect) ──────────────────
  if (req.method === "DELETE") {
    const apiKey = String(req.query.api_key ?? "").trim();
    if (!apiKey) return res.status(400).json({ error: "api_key required" });
    const apiKeyHash = sha256hex(apiKey);
    const delUrl = `${unclickSupabaseUrl}/rest/v1/memory_configs?api_key_hash=eq.${encodeURIComponent(apiKeyHash)}`;
    const { ok } = await supabaseFetch(delUrl, "DELETE", supabaseHeaders(unclickServiceKey));
    if (!ok) return res.status(502).json({ error: "Failed to disconnect" });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

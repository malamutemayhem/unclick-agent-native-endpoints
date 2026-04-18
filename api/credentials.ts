/**
 * UnClick Credentials API
 * Vercel serverless function - serves GET and POST for platform credentials.
 *
 * GET  /api/credentials?platform=xero
 *   Authorization: Bearer <unclick_api_key>
 *   Returns decrypted credential fields for the platform.
 *   Used by vault-bridge.ts in the MCP server (UNCLICK_API_KEY env var).
 *
 * POST /api/credentials
 *   Body: { platform: string, credentials: Record<string, string>, api_key: string }
 *   Encrypts and stores credentials in Supabase user_credentials table.
 *   Used by Connect.tsx for bot_token / api_key flows (no OAuth exchange needed).
 *
 * Encryption: AES-256-GCM with PBKDF2 key derived from the user's API key.
 *             The API key is never stored - only its SHA-256 hash for lookups.
 *             This means only the key-holder can decrypt their own credentials.
 *
 * Required env vars (server-side only, never exposed to frontend):
 *   SUPABASE_URL            - same value as VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key (bypasses RLS)
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as crypto from "crypto";

// ─── Crypto helpers ───────────────────────────────────────────────────────────

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

function encrypt(plaintext: string, key: Buffer): { iv: string; authTag: string; ciphertext: string } {
  const iv     = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc    = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    iv:         iv.toString("hex"),
    authTag:    cipher.getAuthTag().toString("hex"),
    ciphertext: enc.toString("hex"),
  };
}

function decrypt(
  iv: string,
  authTag: string,
  ciphertext: string,
  key: Buffer
): string {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

function supabaseHeaders(serviceRoleKey: string): Record<string, string> {
  return {
    apikey:          serviceRoleKey,
    Authorization:   `Bearer ${serviceRoleKey}`,
    "Content-Type":  "application/json",
    Prefer:          "return=representation",
  };
}

async function supabaseFetch(
  url:     string,
  method:  string,
  headers: Record<string, string>,
  body?:   unknown
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: unknown;
  try { data = await res.json(); } catch { data = null; }
  return { ok: res.ok, status: res.status, data };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin",  "https://unclick.world");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const supabaseUrl     = process.env.SUPABASE_URL;
  const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: "Server credentials not configured." });
  }

  // ── GET: retrieve decrypted credentials ───────────────────────────────────
  if (req.method === "GET") {
    const authHeader = req.headers.authorization ?? "";
    const apiKey     = authHeader.replace(/^Bearer\s+/i, "").trim();
    const platform   = String(req.query.platform ?? "").trim();

    if (!apiKey)   return res.status(401).json({ error: "Authorization header required." });
    if (!platform) return res.status(400).json({ error: "platform query param required." });

    const apiKeyHash = sha256hex(apiKey);
    const tableUrl   = `${supabaseUrl}/rest/v1/user_credentials?api_key_hash=eq.${encodeURIComponent(apiKeyHash)}&platform_slug=eq.${encodeURIComponent(platform)}&select=*`;

    const { ok, data } = await supabaseFetch(tableUrl, "GET", supabaseHeaders(serviceRoleKey));
    if (!ok) return res.status(502).json({ error: "Supabase lookup failed." });

    const rows = data as Array<Record<string, unknown>>;
    if (!rows || rows.length === 0) {
      return res.status(404).json({
        error:     `No credentials stored for platform "${platform}".`,
        setup_url: `https://unclick.world/connect/${platform}`,
      });
    }

    const row = rows[0];
    try {
      const salt         = Buffer.from(row.encryption_salt as string, "hex");
      const key          = deriveKey(apiKey, salt);
      const plaintext    = decrypt(
        row.encryption_iv  as string,
        row.encryption_tag as string,
        row.encrypted_data as string,
        key
      );
      const credentials = JSON.parse(plaintext) as Record<string, string>;
      return res.status(200).json(credentials);
    } catch {
      return res.status(500).json({ error: "Failed to decrypt credentials. The API key may have changed." });
    }
  }

  // ── POST: store encrypted credentials ────────────────────────────────────
  if (req.method === "POST") {
    const body = req.body as {
      platform:    string;
      credentials: Record<string, string>;
      api_key:     string;
    };

    const { platform, credentials, api_key } = body ?? {};
    if (!platform)    return res.status(400).json({ error: "platform is required." });
    if (!credentials) return res.status(400).json({ error: "credentials is required." });
    if (!api_key)     return res.status(400).json({ error: "api_key is required." });

    // Validate API key format (basic sanity check)
    if (!api_key.startsWith("uc_") && !api_key.startsWith("agt_")) {
      return res.status(400).json({ error: "Invalid api_key format." });
    }

    const salt       = crypto.randomBytes(SALT_BYTES);
    const key        = deriveKey(api_key, salt);
    const plaintext  = JSON.stringify(credentials);
    const { iv, authTag, ciphertext } = encrypt(plaintext, key);

    const row = {
      api_key_hash:    sha256hex(api_key),
      platform_slug:   platform,
      encrypted_data:  ciphertext,
      encryption_iv:   iv,
      encryption_tag:  authTag,
      encryption_salt: salt.toString("hex"),
      updated_at:      new Date().toISOString(),
    };

    const tableUrl = `${supabaseUrl}/rest/v1/user_credentials`;
    const headers  = {
      ...supabaseHeaders(serviceRoleKey),
      // Upsert on (api_key_hash, platform_slug) unique constraint
      Prefer: "resolution=merge-duplicates,return=representation",
    };

    const { ok, status } = await supabaseFetch(tableUrl, "POST", headers, row);
    if (!ok) {
      return res.status(status).json({ error: "Failed to store credentials." });
    }

    return res.status(200).json({
      success:  true,
      platform,
      message:  `${platform} credentials stored successfully.`,
    });
  }

  return res.status(405).json({ error: "Method not allowed." });
}

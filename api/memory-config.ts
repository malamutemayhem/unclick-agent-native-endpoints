/**
 * UnClick Memory Config Fetch API
 *
 * GET /api/memory-config
 *   Authorization: Bearer <unclick_api_key>
 *   Returns the user's decrypted Supabase URL + service_role key so the MCP
 *   server can connect to their BYOD cloud memory on startup.
 *
 * This is the counterpart to /api/memory-setup. The MCP server calls this
 * endpoint when UNCLICK_API_KEY is set and SUPABASE_URL is not, bootstrapping
 * cloud mode without any local env config.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as crypto from "crypto";

const PBKDF2_ITERATIONS = 100_000;
const KEY_BYTES = 32;

function sha256hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function deriveKey(apiKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(apiKey, salt, PBKDF2_ITERATIONS, KEY_BYTES, "sha256");
}

function decrypt(iv: string, authTag: string, ciphertext: string, key: Buffer): string {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

function supabaseHeaders(serviceRoleKey: string): Record<string, string> {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const unclickSupabaseUrl = process.env.SUPABASE_URL;
  const unclickServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!unclickSupabaseUrl || !unclickServiceKey) {
    return res.status(500).json({ error: "Server not configured" });
  }

  const authHeader = req.headers.authorization ?? "";
  const apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!apiKey) return res.status(401).json({ error: "Authorization header required" });

  const apiKeyHash = sha256hex(apiKey);
  const lookupUrl = `${unclickSupabaseUrl}/rest/v1/memory_configs?api_key_hash=eq.${encodeURIComponent(apiKeyHash)}&select=*`;
  const lookupRes = await fetch(lookupUrl, { headers: supabaseHeaders(unclickServiceKey) });
  if (!lookupRes.ok) return res.status(502).json({ error: "Lookup failed" });

  const rows = (await lookupRes.json()) as Array<Record<string, unknown>>;
  if (!rows || rows.length === 0) {
    return res.status(404).json({ error: "No memory config for this API key", configured: false });
  }

  const row = rows[0];
  try {
    const salt = Buffer.from(row.encryption_salt as string, "hex");
    const key = deriveKey(apiKey, salt);
    const serviceRoleKey = decrypt(
      row.encryption_iv as string,
      row.encryption_tag as string,
      row.encrypted_service_key as string,
      key
    );

    // Update last_used_at (fire and forget)
    fetch(`${unclickSupabaseUrl}/rest/v1/memory_configs?api_key_hash=eq.${encodeURIComponent(apiKeyHash)}`, {
      method: "PATCH",
      headers: supabaseHeaders(unclickServiceKey),
      body: JSON.stringify({ last_used_at: new Date().toISOString() }),
    }).catch(() => {});

    return res.status(200).json({
      configured: true,
      supabase_url: row.supabase_url,
      service_role_key: serviceRoleKey,
      schema_installed: row.schema_installed,
    });
  } catch {
    return res.status(500).json({
      error: "Failed to decrypt memory config. Your API key may have changed — rerun setup.",
    });
  }
}

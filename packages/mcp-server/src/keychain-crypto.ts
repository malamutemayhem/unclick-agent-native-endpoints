// ─── Keychain Crypto ──────────────────────────────────────────────────────────
// AES-256-GCM encryption for platform credentials.
// Key derivation: PBKDF2 with a deterministic salt derived from the API key.
// No external dependencies - Node.js built-in crypto only.

import * as crypto from "crypto";

const PBKDF2_ITERATIONS = 100_000;
const KEY_BYTES         = 32; // AES-256
const IV_BYTES          = 12; // 96-bit IV recommended for GCM

// Deterministic salt: avoids storing a per-credential salt while still
// using PBKDF2 for slow key derivation. The secret material is the API key.
const KEYCHAIN_PEPPER = "unclick-keychain-v1";

function deriveKey(apiKey: string): Buffer {
  const salt = crypto
    .createHash("sha256")
    .update(`${KEYCHAIN_PEPPER}:${apiKey}`)
    .digest();
  return crypto.pbkdf2Sync(apiKey, salt, PBKDF2_ITERATIONS, KEY_BYTES, "sha256");
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Key is derived from the caller's UnClick API key via PBKDF2.
 */
export function encrypt(
  plaintext: string,
  apiKey: string
): { encrypted_value: string; iv: string; auth_tag: string } {
  const key    = deriveKey(apiKey);
  const iv     = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc    = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    encrypted_value: enc.toString("hex"),
    iv:              iv.toString("hex"),
    auth_tag:        cipher.getAuthTag().toString("hex"),
  };
}

/**
 * Decrypt a value previously encrypted with encrypt().
 */
export function decrypt(
  encrypted_value: string,
  iv:              string,
  auth_tag:        string,
  apiKey:          string
): string {
  const key      = deriveKey(apiKey);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(auth_tag, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted_value, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Returns the first 12 hex characters of the SHA-256 hash of the API key.
 * Used as a human-readable namespace in logs and error messages.
 */
export function hashKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex").slice(0, 12);
}

/**
 * Returns the full SHA-256 hex hash of the API key.
 * Used as the lookup key in Supabase (never store the raw API key).
 */
export function hashKeyFull(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

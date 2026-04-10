import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─────────────────────────────────────────────────────────────────────────────
// SQL MIGRATIONS: run in Supabase dashboard (SQL Editor)
//
// ── Table 1: api_keys (existing) ─────────────────────────────────────────────
// Run this SQL in your Supabase dashboard (SQL Editor) to set up the table:
//
// CREATE TABLE api_keys (
//   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//   email TEXT NOT NULL,
//   api_key TEXT NOT NULL UNIQUE,
//   created_at TIMESTAMPTZ DEFAULT NOW(),
//   status TEXT DEFAULT 'active'
// );
//
// ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
//
// -- Allow anyone to insert a new key
// CREATE POLICY "Allow inserts" ON api_keys
//   FOR INSERT WITH CHECK (true);
//
// -- Allow reading only by matching email (filtered client-side too)
// CREATE POLICY "Allow select by email" ON api_keys
//   FOR SELECT USING (true);
//
// ── Table 2: user_credentials (new, OAuth credential broker) ─────────────────
// Stores platform OAuth tokens and API keys encrypted with AES-256-GCM.
// The user's UnClick API key is the encryption key (PBKDF2 derived).
// Only the SHA-256 hash of the API key is stored; the key itself is never stored.
// Read/write is done server-side via SUPABASE_SERVICE_ROLE_KEY (not anon key).
//
// CREATE TABLE user_credentials (
//   id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
//   api_key_hash     TEXT        NOT NULL,
//   platform_slug    TEXT        NOT NULL,
//   encrypted_data   TEXT        NOT NULL,
//   encryption_iv    TEXT        NOT NULL,
//   encryption_tag   TEXT        NOT NULL,
//   encryption_salt  TEXT        NOT NULL,
//   expires_at       TIMESTAMPTZ,
//   created_at       TIMESTAMPTZ DEFAULT NOW(),
//   updated_at       TIMESTAMPTZ DEFAULT NOW(),
//   UNIQUE(api_key_hash, platform_slug)
// );
//
// ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
//
// -- Block all direct client access (read/write only via service role in API functions)
// CREATE POLICY "No direct access" ON user_credentials
//   USING (false)
//   WITH CHECK (false);
//
// -- Optional: index for fast lookup by api_key_hash + platform
// CREATE INDEX idx_user_credentials_lookup
//   ON user_credentials(api_key_hash, platform_slug);
//
// Required Vercel env vars (server-side only, never in VITE_ prefix):
//   SUPABASE_URL              = same value as VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY = from Supabase dashboard > Settings > API > service_role
//
// Per-platform OAuth env vars (set when you register each app):
//   XERO_CLIENT_ID, XERO_CLIENT_SECRET, XERO_REDIRECT_URI
//   REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_REDIRECT_URI
//   SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET

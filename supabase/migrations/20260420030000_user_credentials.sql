-- user_credentials: the table the /api/credentials POST/GET handler has
-- always been expecting but that was never actually created in the DB.
--
-- Root cause: the original schema lived only as a SQL comment block in
-- src/lib/supabase.ts; no migration was ever added. Every POST to
-- /api/credentials returned 400 "Failed to store credentials." because
-- the upsert target did not exist. See api/credentials.ts for the exact
-- column set the handler reads/writes.
--
-- Scheme: AES-256-GCM. The user's UnClick API key is the encryption key
-- (PBKDF2-derived with a per-row salt). We store only the SHA-256 hash
-- of the API key for lookups — the key itself is never persisted.
-- Read/write happens server-side via SUPABASE_SERVICE_ROLE_KEY, never
-- from the anon client.

CREATE TABLE IF NOT EXISTS user_credentials (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_hash     TEXT        NOT NULL,
  platform_slug    TEXT        NOT NULL,
  encrypted_data   TEXT        NOT NULL,
  encryption_iv    TEXT        NOT NULL,
  encryption_tag   TEXT        NOT NULL,
  encryption_salt  TEXT        NOT NULL,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (api_key_hash, platform_slug)
);

CREATE INDEX IF NOT EXISTS idx_user_credentials_lookup
  ON user_credentials (api_key_hash, platform_slug);

ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;

-- Block all direct client access; only the service role (in Vercel API
-- functions) may read or write.
--
-- Idempotency guard: CREATE POLICY has no IF NOT EXISTS form in Postgres,
-- so each policy is wrapped in a pg_policies check so re-running this
-- migration is safe.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_credentials' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON user_credentials
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_credentials' AND policyname = 'block_anon_access'
  ) THEN
    CREATE POLICY "block_anon_access" ON user_credentials
      FOR ALL TO anon USING (false) WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_credentials' AND policyname = 'block_authenticated_direct_access'
  ) THEN
    CREATE POLICY "block_authenticated_direct_access" ON user_credentials
      FOR ALL TO authenticated USING (false) WITH CHECK (false);
  END IF;
END $$;

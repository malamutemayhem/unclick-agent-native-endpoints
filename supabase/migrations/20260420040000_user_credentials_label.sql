-- Extend user_credentials with an optional `label` column so a single user
-- can store multiple credentials for the same platform (e.g. two Anthropic
-- keys: one for claude-code, one for bailey-plex-3).
--
-- Keeps the common "one credential per platform" case unchanged: if callers
-- don't pass label, it's NULL, and the GET handler returns that row as the
-- default. Labels are metadata for the user to distinguish duplicates — they
-- are NOT used for runtime routing by the MCP vault-bridge (which only knows
-- platform slug).
--
-- Uniqueness: (api_key_hash, platform_slug, label) with NULLS NOT DISTINCT
-- (Postgres 15+) so NULL behaves as a single distinct "default" value rather
-- than many (Postgres's default NULL != NULL would otherwise allow dupes).
-- This lets PostgREST's `on_conflict=api_key_hash,platform_slug,label` work
-- without needing an expression index — which PostgREST can't target.

ALTER TABLE user_credentials
  ADD COLUMN IF NOT EXISTS label TEXT;

-- Drop the old unique constraint (if it exists) and rebuild with label.
-- The constraint was created in 20260420030000_user_credentials.sql.
ALTER TABLE user_credentials
  DROP CONSTRAINT IF EXISTS user_credentials_api_key_hash_platform_slug_key;

-- Drop any older label-related indexes from earlier iterations (idempotent).
DROP INDEX IF EXISTS user_credentials_hash_platform_label_key;
DROP INDEX IF EXISTS idx_user_credentials_lookup;

-- Unique index on the three columns with NULLS NOT DISTINCT so:
--   (hash, 'anthropic', NULL)          conflicts with  (hash, 'anthropic', NULL)
--   (hash, 'anthropic', 'claude-code') OK alongside    (hash, 'anthropic', 'bailey-plex-3')
-- PostgREST can target this via on_conflict=api_key_hash,platform_slug,label.
CREATE UNIQUE INDEX IF NOT EXISTS user_credentials_hash_platform_label_key
  ON user_credentials (api_key_hash, platform_slug, label)
  NULLS NOT DISTINCT;

-- Non-unique lookup index for the common GET path (/api/credentials
-- ?platform=xero — no label — returns the default / first row).
CREATE INDEX IF NOT EXISTS idx_user_credentials_hash_platform
  ON user_credentials (api_key_hash, platform_slug);

COMMENT ON COLUMN user_credentials.label IS
  'Optional user-facing label to distinguish multiple credentials for the same platform (e.g. "claude-code", "bailey-plex-3"). NULL = the default / only credential for this platform.';

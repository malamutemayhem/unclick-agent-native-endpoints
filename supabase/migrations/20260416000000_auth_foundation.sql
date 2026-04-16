-- ============================================================
-- UnClick Phase 2 - Auth Foundation
-- ============================================================
-- Links Supabase Auth (auth.users) to the existing api_keys table
-- and adds the auth_devices table used by the device-pair flow.
--
-- This migration is DEFENSIVE because the production api_keys table
-- has two column shapes coexisting (see Phase 2 session notes):
--   - Old:  email / api_key (plaintext) / status
--   - New:  key_hash / key_prefix / user_id / tier / is_active
-- ApiKeySignup.tsx still writes the old shape; api/mcp.ts (Phase 1)
-- reads the new shape. Both paths work in production today, which
-- means the table has both sets of columns bolted on. This migration
-- makes no assumptions and no-ops gracefully on anything that's
-- already in place or missing.
--
-- Scope:
--   1. Ensure api_keys.user_id exists (keychain_mvp already creates
--      it, but be defensive).
--   2. Add FK constraint api_keys.user_id -> auth.users(id) if not
--      already present.
--   3. Backfill api_keys.user_id from auth.users.email where the
--      old-shape email column is present.
--   4. Create auth_devices table for the device-pair stub.
-- ============================================================

-- ─── 1. Ensure api_keys.user_id exists ─────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'api_keys'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.api_keys ADD COLUMN user_id UUID;
  END IF;
END $$;

-- ─── 2. Add FK constraint api_keys.user_id -> auth.users(id) ───────────────
-- ON DELETE SET NULL: if an auth.users row is deleted, orphan the api_key
-- rather than cascade-delete it. api_keys carries usage history and
-- platform credentials that outlive the account.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'api_keys'
      AND constraint_name = 'api_keys_user_id_fkey'
  ) THEN
    ALTER TABLE public.api_keys
      ADD CONSTRAINT api_keys_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);

-- ─── 3. Backfill user_id from email match (only if email column exists) ────
-- This is best-effort. It only backfills rows that are unambiguous:
-- one api_keys row per email, one auth.users row per email, both
-- emails match exactly (case-insensitive). Rows with multiple api_keys
-- per email are left alone and handled later by the claim flow.
DO $$
DECLARE
  has_email BOOLEAN;
  has_status BOOLEAN;
  backfilled INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'api_keys'
      AND column_name = 'email'
  ) INTO has_email;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'api_keys'
      AND column_name = 'status'
  ) INTO has_status;

  IF NOT has_email THEN
    RAISE NOTICE 'auth_foundation: api_keys.email not present, skipping backfill';
    RETURN;
  END IF;

  -- Use dynamic SQL so this block parses even if the columns don't
  -- exist at parse time on a fresh database.
  IF has_status THEN
    EXECUTE $sql$
      UPDATE public.api_keys ak
      SET user_id = u.id
      FROM auth.users u
      WHERE ak.user_id IS NULL
        AND ak.email IS NOT NULL
        AND lower(ak.email) = lower(u.email)
        AND u.email_confirmed_at IS NOT NULL
        AND COALESCE(ak.status, 'active') = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM public.api_keys ak2
          WHERE lower(ak2.email) = lower(ak.email)
            AND ak2.id <> ak.id
        )
    $sql$;
  ELSE
    EXECUTE $sql$
      UPDATE public.api_keys ak
      SET user_id = u.id
      FROM auth.users u
      WHERE ak.user_id IS NULL
        AND ak.email IS NOT NULL
        AND lower(ak.email) = lower(u.email)
        AND u.email_confirmed_at IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.api_keys ak2
          WHERE lower(ak2.email) = lower(ak.email)
            AND ak2.id <> ak.id
        )
    $sql$;
  END IF;

  GET DIAGNOSTICS backfilled = ROW_COUNT;
  RAISE NOTICE 'auth_foundation: backfilled % api_keys rows with user_id', backfilled;
END $$;

-- ─── 4. auth_devices table ────────────────────────────────────────────────
-- Paired devices per authenticated user. Schema is multi-device ready
-- even though the UI ships single-device for this phase. device_id is
-- the client-supplied stable ID (e.g. machine fingerprint), device_name
-- is the human label shown in the UI.
--
-- Distinct from memory_devices (Phase 1, api_key_hash-keyed, tracks
-- where memory is stored). auth_devices is user_id-keyed and tracks
-- authenticated sessions.
CREATE TABLE IF NOT EXISTS public.auth_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_name TEXT,
  paired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_auth_devices_user ON public.auth_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_devices_active
  ON public.auth_devices(user_id, last_seen_at DESC)
  WHERE revoked_at IS NULL;

-- RLS: service role only. Device pairing goes through memory-admin.ts
-- which uses the service-role client. Direct anon/authenticated access
-- is denied. Defense in depth; service role bypasses RLS anyway.
ALTER TABLE public.auth_devices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'auth_devices'
      AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON public.auth_devices
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- DONE.
-- ============================================================

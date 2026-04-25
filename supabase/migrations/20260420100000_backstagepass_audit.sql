-- backstagepass_audit: append-only audit log for every action taken
-- on a credential in the BackstagePass vault.
--
-- Rationale: user_credentials is encrypted with the user's own UnClick
-- api_key, so the server cannot decrypt without the plaintext key.
-- That's a strong privacy property, but it also means that without an
-- audit log, a credential reveal is invisible after the fact. This
-- table answers "who touched which credential, when, from where" for
-- every reveal / update / delete / test action.
--
-- Scope: one row per action. NOT tied to request lifecycle — if a
-- request triggers N internal decrypts, that's N rows. Append-only.
-- Never mutated. Read-only to the owner via /api/backstagepass?action=audit.
--
-- Scoped by api_key_hash (same as user_credentials) so the row survives
-- an api_key rotation even though the owning user's JWT may change.
-- Also records actor_user_id (Supabase auth uid) so we can distinguish
-- "owner accessed" from "admin acted on their behalf" when multi-user
-- admin lands.

CREATE TABLE IF NOT EXISTS backstagepass_audit (
  id              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Who acted (Supabase auth user.id if available) and which vault it
  -- affected (api_key_hash of the owning user). These are usually the
  -- same user today — but decoupling them now means admin-on-behalf-of
  -- flows can slot in later without a schema change.
  actor_user_id   UUID,
  api_key_hash    TEXT         NOT NULL,

  -- What happened. Keep this as a loose TEXT rather than an enum so we
  -- can add new action types without a migration. Expected values:
  --   list            - GET /api/backstagepass?action=list
  --   reveal          - POST ?action=reveal (decrypt + return plaintext)
  --   update_label    - POST ?action=update (label change only, no decrypt)
  --   update_values   - POST ?action=update (re-encrypt with new values)
  --   delete          - POST ?action=delete
  --   test            - POST ?action=test (health-check the credential)
  --   export          - future: bulk export
  action          TEXT         NOT NULL,

  -- Which credential was targeted. Nullable for list/export where the
  -- action spans many rows. platform_slug + label let an admin read the
  -- log without joining against user_credentials (which may have been
  -- deleted by the time the log is read).
  credential_id   UUID,
  platform_slug   TEXT,
  label           TEXT,

  -- Where from. IP + UA are best-effort; Vercel forwards x-forwarded-for
  -- so we record that string verbatim. Don't treat these as
  -- authentication signals — they're just breadcrumbs.
  ip              TEXT,
  user_agent      TEXT,

  -- Result signal. TRUE for successful reveal/update/delete/test, FALSE
  -- for "attempted but failed" (e.g. wrong api_key on reveal). Both are
  -- logged — a stream of failed reveals is a signal worth seeing.
  success         BOOLEAN      DEFAULT TRUE,

  -- Free-form extras. Examples: { "reason": "wrong_api_key" },
  -- { "bytes": 420, "fields": ["api_key"] }, { "prev_label": "foo" }.
  -- Never put plaintext credential values here.
  metadata        JSONB        DEFAULT '{}'::jsonb,

  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- Indexes tuned for the admin audit-viewer read patterns:
--   1) "Show me this user's recent audit trail" → api_key_hash + created_at
--   2) "Show me everything that touched credential X"  → credential_id + created_at
--   3) "Find failed reveals on any platform"           → success + action + created_at
CREATE INDEX IF NOT EXISTS idx_bp_audit_user_recent
  ON backstagepass_audit (api_key_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bp_audit_credential
  ON backstagepass_audit (credential_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bp_audit_failures
  ON backstagepass_audit (success, action, created_at DESC)
  WHERE success = FALSE;

-- Lock down: service role only. Never directly queryable from the browser.
-- The /api/backstagepass endpoint is the sole read/write path.
ALTER TABLE backstagepass_audit ENABLE ROW LEVEL SECURITY;

-- Idempotency guard: CREATE POLICY has no IF NOT EXISTS form in Postgres,
-- so each policy is wrapped in a pg_policies check so re-running this
-- migration is safe.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'backstagepass_audit' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON backstagepass_audit
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'backstagepass_audit' AND policyname = 'block_anon_access'
  ) THEN
    CREATE POLICY "block_anon_access" ON backstagepass_audit
      FOR ALL TO anon USING (false) WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'backstagepass_audit' AND policyname = 'block_authenticated_direct_access'
  ) THEN
    CREATE POLICY "block_authenticated_direct_access" ON backstagepass_audit
      FOR ALL TO authenticated USING (false) WITH CHECK (false);
  END IF;
END $$;

COMMENT ON TABLE backstagepass_audit IS
  'Append-only audit log of every action against user_credentials via the BackstagePass admin surface. Source of truth for "who revealed/updated/deleted what, when". Read via /api/backstagepass?action=audit.';

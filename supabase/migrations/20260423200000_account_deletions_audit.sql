-- Append-only audit table for self-serve account deletions.
-- Written BEFORE any destructive steps so partial failures leave a trail.

CREATE TABLE IF NOT EXISTS account_deletions_audit (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash      text,
  email             text,
  deleted_at        timestamptz NOT NULL DEFAULT now(),
  reason            text,
  tables_affected   text[]      NOT NULL DEFAULT '{}',
  rows_deleted      jsonb       NOT NULL DEFAULT '{}',
  partial_failure   boolean     NOT NULL DEFAULT false,
  failure_detail    text
);

CREATE INDEX IF NOT EXISTS idx_ada_deleted_at ON account_deletions_audit(deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_ada_email       ON account_deletions_audit(email);

ALTER TABLE account_deletions_audit ENABLE ROW LEVEL SECURITY;

-- Service role has full access; no direct client access.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'account_deletions_audit'
      AND policyname = 'account_deletions_audit_service_role'
  ) THEN
    CREATE POLICY account_deletions_audit_service_role
      ON account_deletions_audit
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

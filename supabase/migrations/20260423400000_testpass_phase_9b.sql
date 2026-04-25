-- TestPass Phase 9B: report layer
-- Idempotent migration

-- Reports table
CREATE TABLE IF NOT EXISTS mc_testpass_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash text NOT NULL,
  target text NOT NULL,
  pack_id text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'complete', 'abandoned')),
  run_sequence uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

-- Ensure exactly one open report per (api_key_hash, target, pack_id)
CREATE UNIQUE INDEX IF NOT EXISTS mc_testpass_reports_open_unique
  ON mc_testpass_reports (api_key_hash, target, pack_id)
  WHERE status = 'open';

-- Link runs to reports
ALTER TABLE testpass_runs
  ADD COLUMN IF NOT EXISTS report_id uuid REFERENCES mc_testpass_reports(id);

-- RLS: service role only
ALTER TABLE mc_testpass_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mc_testpass_reports' AND policyname = 'service_role_only'
  ) THEN
    CREATE POLICY service_role_only ON mc_testpass_reports
      USING (auth.role() = 'service_role');
  END IF;
END $$;

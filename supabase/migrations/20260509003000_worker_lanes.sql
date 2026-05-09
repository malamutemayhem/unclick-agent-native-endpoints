-- Worker lanes foundation for role-fit routing.
-- Rows are opt-in. If a seat has no row, legacy claim behavior remains valid.

CREATE TABLE IF NOT EXISTS worker_lanes (
  api_key_hash text NOT NULL,
  agent_id text NOT NULL,
  role text NOT NULL,
  scope_allowlist jsonb NOT NULL DEFAULT '[]'::jsonb,
  scope_denylist jsonb NOT NULL DEFAULT '[]'::jsonb,
  enforce_mode text NOT NULL DEFAULT 'warn'
    CHECK (enforce_mode IN ('warn', 'enforce')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (api_key_hash, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_worker_lanes_role
  ON worker_lanes(api_key_hash, role);

ALTER TABLE worker_lanes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'worker_lanes'
      AND policyname = 'worker_lanes_service_role_all'
  ) THEN
    CREATE POLICY "worker_lanes_service_role_all"
      ON worker_lanes FOR ALL USING (auth.role() = 'service_role');
  END IF;
END$$;

NOTIFY pgrst, 'reload schema';


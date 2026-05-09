-- Autopilot control ledger v1
-- Append-only typed events for claim/build/proof/review/ship/close state.
-- Boardroom posts and GitHub comments are mirrors; this table is the durable
-- tenant-scoped state spine for automation readers.

CREATE TABLE IF NOT EXISTS mc_autopilot_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash text NOT NULL,
  event_type text NOT NULL
    CHECK (event_type IN (
      'claim',
      'lease_refresh',
      'lease_expired',
      'release',
      'build_start',
      'build_end',
      'proof_request',
      'proof_result',
      'ack',
      'blocker',
      'merge_decision',
      'watch_start',
      'watch_end',
      'dispatch',
      'pick',
      'todo_state_change'
    )),
  actor_agent_id text NOT NULL,
  ref_kind text NOT NULL
    CHECK (ref_kind IN ('todo', 'pr', 'dispatch', 'agent', 'run')),
  ref_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  seq bigserial UNIQUE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mc_autopilot_events_idempotency
  ON mc_autopilot_events(api_key_hash, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_mc_autopilot_events_ref
  ON mc_autopilot_events(api_key_hash, ref_kind, ref_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mc_autopilot_events_type
  ON mc_autopilot_events(api_key_hash, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mc_autopilot_events_actor
  ON mc_autopilot_events(api_key_hash, actor_agent_id, created_at DESC);

ALTER TABLE mc_autopilot_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mc_autopilot_events'
      AND policyname = 'mc_autopilot_events_service_role_all'
  ) THEN
    CREATE POLICY "mc_autopilot_events_service_role_all"
      ON mc_autopilot_events FOR ALL USING (auth.role() = 'service_role');
  END IF;
END$$;

NOTIFY pgrst, 'reload schema';

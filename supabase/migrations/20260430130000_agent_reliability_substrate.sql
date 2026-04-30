-- Agent reliability substrate v1
-- Adds dispatch + heartbeat tables for idempotent worker dispatch,
-- lease tracking, stale reclaim, and WakePass-ready ACK telemetry.

CREATE TABLE IF NOT EXISTS mc_agent_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash text NOT NULL,
  dispatch_id text NOT NULL,
  source text NOT NULL
    CHECK (source IN ('fishbowl', 'connectors', 'wakepass', 'testpass', 'uxpass', 'flowpass', 'securitypass', 'manual')),
  target_agent_id text NOT NULL,
  task_ref text,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'leased', 'completed', 'failed', 'stale', 'cancelled')),
  lease_owner text,
  lease_expires_at timestamptz,
  last_real_action_at timestamptz,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(api_key_hash, dispatch_id)
);

CREATE INDEX IF NOT EXISTS idx_mc_agent_dispatches_tenant_status
  ON mc_agent_dispatches(api_key_hash, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mc_agent_dispatches_lease_expiry
  ON mc_agent_dispatches(api_key_hash, lease_expires_at)
  WHERE lease_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mc_agent_dispatches_target
  ON mc_agent_dispatches(api_key_hash, target_agent_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS mc_agent_heartbeats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash text NOT NULL,
  agent_id text NOT NULL,
  dispatch_id text,
  state text NOT NULL
    CHECK (state IN ('idle', 'received', 'accepted', 'working', 'blocked', 'completed')),
  current_task text,
  next_action text,
  eta_minutes integer,
  blocker text,
  last_real_action_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mc_agent_heartbeats_tenant_agent
  ON mc_agent_heartbeats(api_key_hash, agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mc_agent_heartbeats_dispatch
  ON mc_agent_heartbeats(api_key_hash, dispatch_id, created_at DESC)
  WHERE dispatch_id IS NOT NULL;

ALTER TABLE mc_agent_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_agent_heartbeats ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mc_agent_dispatches'
      AND policyname = 'mc_agent_dispatches_service_role_all'
  ) THEN
    CREATE POLICY "mc_agent_dispatches_service_role_all"
      ON mc_agent_dispatches FOR ALL USING (auth.role() = 'service_role');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mc_agent_heartbeats'
      AND policyname = 'mc_agent_heartbeats_service_role_all'
  ) THEN
    CREATE POLICY "mc_agent_heartbeats_service_role_all"
      ON mc_agent_heartbeats FOR ALL USING (auth.role() = 'service_role');
  END IF;
END$$;

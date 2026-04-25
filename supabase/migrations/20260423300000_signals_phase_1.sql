CREATE TABLE IF NOT EXISTS mc_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash text NOT NULL,
  tool text NOT NULL,
  action text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','action_needed','critical')),
  summary text NOT NULL,
  deep_link text,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz,
  read_via text,
  read_by_agent_id text
);

CREATE INDEX IF NOT EXISTS idx_mc_signals_api_key ON mc_signals(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_mc_signals_unread ON mc_signals(api_key_hash, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mc_signals_tool_action ON mc_signals(tool, action);

ALTER TABLE mc_signals ENABLE ROW LEVEL SECURITY;

-- Idempotency guard: CREATE POLICY has no IF NOT EXISTS form in Postgres,
-- so wrap in a pg_policies check so re-running this migration is safe.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mc_signals' AND policyname = 'mc_signals_service_role_all'
  ) THEN
    CREATE POLICY "mc_signals_service_role_all"
      ON mc_signals FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS mc_signal_preferences (
  api_key_hash text PRIMARY KEY,
  email_enabled boolean DEFAULT false,
  email_address text,
  phone_push_enabled boolean DEFAULT true,
  telegram_enabled boolean DEFAULT false,
  telegram_chat_id text,
  quiet_hours_start time,
  quiet_hours_end time,
  min_severity text DEFAULT 'info' CHECK (min_severity IN ('info','action_needed','critical')),
  per_tool_overrides jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE mc_signal_preferences ENABLE ROW LEVEL SECURITY;

-- Idempotency guard: CREATE POLICY has no IF NOT EXISTS form in Postgres,
-- so wrap in a pg_policies check so re-running this migration is safe.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mc_signal_preferences' AND policyname = 'mc_signal_preferences_service_role_all'
  ) THEN
    CREATE POLICY "mc_signal_preferences_service_role_all"
      ON mc_signal_preferences FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

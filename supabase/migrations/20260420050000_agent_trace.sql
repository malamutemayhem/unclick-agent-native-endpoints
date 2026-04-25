-- agent_trace: raw per-turn trace log for every agent run hitting UnClick.
--
-- Purpose: "install the CCTV today, hire the detective later". A future
-- meta-harness (or cheaper: a nightly scorer) can read from this table to
-- spot which prompts / tool patterns / surfaces produce bad outcomes and
-- then tune system prompts, tool descriptions, or context-assembly rules.
--
-- Today nothing reads from it — it's append-only capture. That's the point:
-- start collecting now so the data exists when we have a reason to learn
-- from it. Without this, any future optimization pass starts from zero.
--
-- Scoped by api_key_hash (same as user_credentials) so we never store the
-- raw UnClick API key, and we can later per-user-segment the analytics.
--
-- Note on the name: the first draft of this migration called the table
-- `agent_activity`, which collided with a pre-existing usage-ledger table
-- of the same name (id, api_key_hash, agent_id, action, tool_slug,
-- tokens_used, created_at) from 20260418000000_agent_profiles.sql.
-- Renamed to `agent_trace` so both can coexist. The older `agent_activity`
-- usage-ledger is still read by admin_agent_activity in api/memory-admin.ts.

CREATE TABLE IF NOT EXISTS agent_trace (
  id                 UUID        DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Grouping identifiers. run_id groups the turns of one conversation;
  -- parent_run_id links a sub-agent run back to its caller.
  run_id             UUID        NOT NULL,
  turn_number        INTEGER     NOT NULL DEFAULT 1,
  parent_run_id      UUID,

  -- Who + where. api_key_hash is sha256 of the UnClick API key (matches
  -- user_credentials.api_key_hash for cross-join). surface lets us split
  -- Desktop vs Cowork vs Code vs web behaviour later.
  api_key_hash       TEXT,
  surface            TEXT,
  model              TEXT,

  -- What happened. prompt is the user's turn (null for model-initiated
  -- continuations). tool_calls is a jsonb array of
  --   { name, input, output, duration_ms, is_error }
  -- response_text is the assistant's final surface text for the turn.
  prompt             TEXT,
  tool_calls         JSONB       DEFAULT '[]'::jsonb,
  response_text      TEXT,

  -- Outcome signals (all optional, filled later or by post-hoc scorers).
  outcome            TEXT,        -- success | error | interrupted | unknown
  user_reaction      TEXT,        -- thumb_up | thumb_down | retry | correction | null
  score              SMALLINT,    -- 1-5 quality score; nullable
  error_signal       BOOLEAN      DEFAULT FALSE,

  -- Free-form metadata: token counts, cost, latency, client version, etc.
  metadata           JSONB        DEFAULT '{}'::jsonb,

  created_at         TIMESTAMPTZ  DEFAULT NOW()
);

-- Indexes tuned for the read patterns a meta-harness would want:
--   1) "Show me all turns of this run"           → run_id + turn_number
--   2) "Show me this user's recent activity"     → api_key_hash + created_at
--   3) "Show me all bad outcomes on X surface"   → surface + outcome + created_at
CREATE INDEX IF NOT EXISTS idx_agent_trace_run
  ON agent_trace (run_id, turn_number);

CREATE INDEX IF NOT EXISTS idx_agent_trace_user_recent
  ON agent_trace (api_key_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_trace_surface_outcome
  ON agent_trace (surface, outcome, created_at DESC);

-- Lock it down: only the service role (serverless API functions) can read
-- or write. No direct client access — agents append via /api/trace,
-- analytics reads via the admin surface.
ALTER TABLE agent_trace ENABLE ROW LEVEL SECURITY;

-- Idempotency guard: CREATE POLICY has no IF NOT EXISTS form in Postgres,
-- so each policy is wrapped in a pg_policies check so re-running this
-- migration is safe.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'agent_trace' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON agent_trace
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'agent_trace' AND policyname = 'block_anon_access'
  ) THEN
    CREATE POLICY "block_anon_access" ON agent_trace
      FOR ALL TO anon USING (false) WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'agent_trace' AND policyname = 'block_authenticated_direct_access'
  ) THEN
    CREATE POLICY "block_authenticated_direct_access" ON agent_trace
      FOR ALL TO authenticated USING (false) WITH CHECK (false);
  END IF;
END $$;

COMMENT ON TABLE agent_trace IS
  'Append-only per-turn trace log of every agent run. Input to future meta-harness / nightly-scorer work. See /api/trace. (Renamed from agent_activity to avoid collision with pre-existing usage-ledger table.)';

-- ============================================================
-- UnClick Memory load events
-- Instrumentation for memory reliability: every tool call is
-- logged so we can compute get_startup_context compliance and
-- spot sessions that skipped the session-start protocol.
-- ============================================================

CREATE TABLE IF NOT EXISTS memory_load_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  api_key_hash TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  session_identifier TEXT,
  client_type TEXT,
  was_first_call_in_session BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_memory_load_events_hash_created
  ON memory_load_events (api_key_hash, created_at DESC);

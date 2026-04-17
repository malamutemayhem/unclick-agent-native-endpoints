-- Memory load events: tracks every MCP tool call for measuring
-- whether get_startup_context fires reliably at session start.
-- Part of Phase 5: Memory Reliability Foundation.

CREATE TABLE IF NOT EXISTS memory_load_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  api_key_hash text NOT NULL,
  tool_name text NOT NULL,
  session_identifier text,
  client_type text,
  was_first_call_in_session boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_memory_load_events_hash_created
  ON memory_load_events (api_key_hash, created_at DESC);

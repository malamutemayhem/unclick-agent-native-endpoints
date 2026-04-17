-- ============================================================
-- UnClick Memory Load Events - instrumentation table
-- Tracks every MCP session and whether/how startup context was
-- loaded so we can measure autoload effectiveness per client.
-- ============================================================

CREATE TABLE IF NOT EXISTS memory_load_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash TEXT,
  session_id TEXT,
  client_name TEXT,
  client_version TEXT,
  first_tool TEXT,
  context_loaded BOOLEAN DEFAULT false,
  tools_called_before_context INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Columns tracking HOW memory was loaded (added via ALTER for idempotency
-- so we can re-run this migration on top of any earlier bootstrap).
ALTER TABLE memory_load_events
  ADD COLUMN IF NOT EXISTS instructions_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS prompt_used BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS resource_read BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS autoload_method TEXT;

CREATE INDEX IF NOT EXISTS idx_memory_load_events_created_at
  ON memory_load_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memory_load_events_api_key_hash
  ON memory_load_events (api_key_hash);

CREATE INDEX IF NOT EXISTS idx_memory_load_events_client_name
  ON memory_load_events (client_name);

CREATE INDEX IF NOT EXISTS idx_memory_load_events_session_id
  ON memory_load_events (session_id);

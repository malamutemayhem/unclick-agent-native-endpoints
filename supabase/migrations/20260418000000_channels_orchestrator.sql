-- ============================================================
-- UnClick Channels Orchestrator
--
-- Bridges the admin chat UI to a user's local Claude Code session
-- via a Supabase-backed message queue.
--
-- Flow:
--   1. Admin chat writes a user message to chat_messages (pending).
--   2. Local Channel plugin subscribes to Realtime, picks up the
--      pending row, pushes it into Claude Code, and writes back the
--      assistant response (completed).
--   3. Admin UI receives the response via Realtime subscription.
--
-- channel_status tracks per-user heartbeats so the admin UI can
-- detect whether a Channel plugin is currently online.
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_messages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash  TEXT        NOT NULL,
  session_id    TEXT        NOT NULL,
  role          TEXT        NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content       TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'delivered', 'processing', 'completed', 'error')),
  metadata      JSONB       DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session
  ON chat_messages (api_key_hash, session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_chat_messages_pending
  ON chat_messages (api_key_hash, status, created_at)
  WHERE status = 'pending';

-- All reads/writes happen via service-role in /api/memory-admin.
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access" ON chat_messages;
CREATE POLICY "No direct access" ON chat_messages
  USING (false)
  WITH CHECK (false);

-- Enable Realtime so the admin UI and the Channel plugin can subscribe
-- to INSERT/UPDATE events.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages';
  END IF;
END$$;

-- Per-user heartbeat row so the admin UI can tell if a local Channel
-- plugin is currently online. The plugin calls admin_channel_heartbeat
-- every 30 seconds and the UI considers the channel active if the
-- last_seen timestamp is within the last 90 seconds.
CREATE TABLE IF NOT EXISTS channel_status (
  api_key_hash  TEXT        PRIMARY KEY,
  client_info   TEXT,
  last_seen     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channel_status_last_seen
  ON channel_status (last_seen DESC);

ALTER TABLE channel_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access" ON channel_status;
CREATE POLICY "No direct access" ON channel_status
  USING (false)
  WITH CHECK (false);

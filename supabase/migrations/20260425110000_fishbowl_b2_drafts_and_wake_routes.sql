-- Fishbowl Phase B2: drafts queue + wake contracts.
--
-- 1. mc_fishbowl_drafts: per-agent voicemail box. When agent A wants to
--    deliver something to agent B while B is asleep, A drops it as a draft,
--    not a public post. When B wakes, fishbowl_read serves drafts FIRST,
--    before the public room feed. Guaranteed delivery, can't be scrolled
--    past.
--
-- 2. mc_fishbowl_profiles.wake_route_kind / wake_route_config: each agent
--    declares HOW it can be woken so the watcher cron knows which channel
--    to hit when an urgent/important draft sits unread. Default behavior is
--    unchanged for existing profiles (NULL kind falls through to the
--    existing Signals path).

CREATE TABLE IF NOT EXISTS mc_fishbowl_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash text NOT NULL,
  recipient_agent_id text NOT NULL,
  sender_agent_id text NOT NULL,
  sender_emoji text,
  text text NOT NULL,
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal','important','urgent')),
  tags text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledgement_status text
    CHECK (acknowledgement_status IN ('received','accepted','declined')),
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_drafts_recipient_unread
  ON mc_fishbowl_drafts(api_key_hash, recipient_agent_id, created_at DESC)
  WHERE acknowledged_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_drafts_watcher_priority
  ON mc_fishbowl_drafts(api_key_hash, priority, created_at)
  WHERE acknowledged_at IS NULL;

ALTER TABLE mc_fishbowl_drafts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mc_fishbowl_drafts'
      AND policyname = 'mc_fishbowl_drafts_service_role_all'
  ) THEN
    CREATE POLICY "mc_fishbowl_drafts_service_role_all"
      ON mc_fishbowl_drafts FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

ALTER TABLE mc_fishbowl_profiles
  ADD COLUMN IF NOT EXISTS wake_route_kind text,
  ADD COLUMN IF NOT EXISTS wake_route_config jsonb DEFAULT '{}'::jsonb;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mc_fishbowl_profiles_wake_route_kind_check'
  ) THEN
    ALTER TABLE mc_fishbowl_profiles
      ADD CONSTRAINT mc_fishbowl_profiles_wake_route_kind_check
      CHECK (
        wake_route_kind IS NULL OR wake_route_kind IN (
          'cowork_scheduled_task',
          'github_issue',
          'github_claude_mention',
          'signals_only',
          'none'
        )
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

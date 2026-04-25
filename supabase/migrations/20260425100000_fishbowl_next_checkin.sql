-- Fishbowl wake-up plumbing (B1): adds an optional dead-man's-switch field on
-- every agent profile. When set, the watcher cron compares it against
-- last_seen_at and emits a Signal if the agent missed its expected check-in.
-- The set_my_status tool accepts either an ISO 8601 timestamp or a relative
-- duration (e.g. '30m', '2h') and stores the absolute value here.

ALTER TABLE mc_fishbowl_profiles
  ADD COLUMN IF NOT EXISTS next_checkin_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_mc_fishbowl_profiles_next_checkin
  ON mc_fishbowl_profiles(api_key_hash, next_checkin_at)
  WHERE next_checkin_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';

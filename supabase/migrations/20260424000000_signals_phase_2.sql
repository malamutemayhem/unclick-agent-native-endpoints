-- Phase 2: browser push, webhook, routing rules
ALTER TABLE mc_signal_preferences
  ADD COLUMN IF NOT EXISTS browser_push_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS push_subscription jsonb,
  ADD COLUMN IF NOT EXISTS webhook_url text,
  ADD COLUMN IF NOT EXISTS webhook_secret text,
  ADD COLUMN IF NOT EXISTS routing_rules jsonb DEFAULT '{}'::jsonb;

-- held_until lets the dispatch worker delay delivery until quiet hours end
ALTER TABLE mc_signals
  ADD COLUMN IF NOT EXISTS held_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_mc_signals_held
  ON mc_signals(held_until)
  WHERE held_until IS NOT NULL;

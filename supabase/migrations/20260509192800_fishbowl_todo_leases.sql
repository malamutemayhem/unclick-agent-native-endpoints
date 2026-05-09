-- Fishbowl todo claim leases v1.
-- Adds conservative nullable lease columns so live runners can prove they
-- still own a claim before mutating a Boardroom todo.

ALTER TABLE IF EXISTS mc_fishbowl_todos
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS lease_token text,
  ADD COLUMN IF NOT EXISTS reclaim_count integer NOT NULL DEFAULT 0
    CHECK (reclaim_count >= 0);

CREATE INDEX IF NOT EXISTS idx_mc_fishbowl_todos_claimable_open
  ON mc_fishbowl_todos(api_key_hash, status, assigned_to_agent_id, lease_expires_at)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_mc_fishbowl_todos_lease_token
  ON mc_fishbowl_todos(api_key_hash, lease_token)
  WHERE lease_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mc_fishbowl_todos_stale_leases
  ON mc_fishbowl_todos(api_key_hash, lease_expires_at)
  WHERE lease_expires_at IS NOT NULL
    AND status IN ('open', 'in_progress');

NOTIFY pgrst, 'reload schema';

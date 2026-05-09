-- Add lane-check event types for role-fit routing and Performance Monitor work.
-- This only widens the existing ledger event_type check.

ALTER TABLE mc_autopilot_events
  DROP CONSTRAINT IF EXISTS mc_autopilot_events_event_type_check;

ALTER TABLE mc_autopilot_events
  ADD CONSTRAINT mc_autopilot_events_event_type_check
  CHECK (event_type IN (
    'claim',
    'lease_grant',
    'lease_refresh',
    'lease_expired',
    'lane_check',
    'lane_violation',
    'release',
    'build_start',
    'build_end',
    'proof_request',
    'proof_result',
    'ack',
    'blocker',
    'merge_decision',
    'watch_start',
    'watch_end',
    'dispatch',
    'pick',
    'todo_state_change'
  ));

NOTIFY pgrst, 'reload schema';

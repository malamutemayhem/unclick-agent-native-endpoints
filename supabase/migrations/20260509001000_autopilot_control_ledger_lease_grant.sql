-- Add explicit lease grant events to the Autopilot control ledger.
-- Existing deployments already have mc_autopilot_events, so this migration
-- updates the event_type check instead of relying on the original create file.

ALTER TABLE mc_autopilot_events
  DROP CONSTRAINT IF EXISTS mc_autopilot_events_event_type_check;

ALTER TABLE mc_autopilot_events
  ADD CONSTRAINT mc_autopilot_events_event_type_check
  CHECK (event_type IN (
    'claim',
    'lease_grant',
    'lease_refresh',
    'lease_expired',
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

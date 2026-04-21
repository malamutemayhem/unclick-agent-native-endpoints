-- Tighten the agent_trace contract at the DB layer.
--
-- The original migration (20260420050000_agent_trace.sql) documented
-- `outcome` as one of four specific values (success, error, interrupted,
-- unknown) and `score` as a 1-5 quality score, but did not enforce either
-- at the schema level. /api/trace accepts anything the client sends
-- (SMALLINT overflow aside). Before the meta-harness / nightly scorer
-- starts reading from this table we want the contract enforced so
-- downstream aggregations don't have to handle garbage values.
--
-- Existing rows: none yet at time of this migration (no readers, nothing
-- has written real data), so both CHECK constraints apply cleanly. If a
-- stale dev row violates them, drop and re-run /api/trace.

ALTER TABLE agent_trace
  ADD CONSTRAINT chk_agent_trace_score
  CHECK (score IS NULL OR score BETWEEN 1 AND 5);

ALTER TABLE agent_trace
  ADD CONSTRAINT chk_agent_trace_outcome
  CHECK (outcome IS NULL OR outcome IN ('success', 'error', 'interrupted', 'unknown'));

COMMENT ON CONSTRAINT chk_agent_trace_score ON agent_trace IS
  'Score is a 1-5 quality rating. NULL means not yet scored.';

COMMENT ON CONSTRAINT chk_agent_trace_outcome ON agent_trace IS
  'Outcome is one of success, error, interrupted, unknown. NULL means not yet resolved.';

-- Fix invalidate_fact RPCs failing with "invalidated_at is ambiguous".
-- The RETURNS TABLE column named invalidated_at is also a PL/pgSQL variable,
-- so table references in WHERE clauses need explicit aliases.

CREATE OR REPLACE FUNCTION mc_invalidate_fact(
  p_api_key_hash TEXT,
  p_fact_id      UUID,
  p_reason       TEXT    DEFAULT NULL,
  p_session_id   TEXT    DEFAULT NULL
)
RETURNS TABLE (invalidated_at TIMESTAMPTZ)
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
BEGIN
  UPDATE mc_extracted_facts AS f
  SET
    invalidated_at            = v_now,
    invalidated_by_session_id = p_session_id,
    updated_at                = v_now
  WHERE f.id             = p_fact_id
    AND f.api_key_hash   = p_api_key_hash
    AND f.invalidated_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'fact % not found or already invalidated for tenant', p_fact_id;
  END IF;

  INSERT INTO mc_facts_audit (fact_id, op, payload, actor, at)
  VALUES (
    p_fact_id,
    'invalidate',
    jsonb_build_object('reason', p_reason, 'session_id', p_session_id),
    COALESCE(p_session_id, 'agent'),
    v_now
  );

  RETURN QUERY SELECT v_now AS invalidated_at;
END;
$$;

CREATE OR REPLACE FUNCTION invalidate_fact(
  p_fact_id    UUID,
  p_reason     TEXT DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL
)
RETURNS TABLE (invalidated_at TIMESTAMPTZ)
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
BEGIN
  UPDATE extracted_facts AS f
  SET
    invalidated_at            = v_now,
    invalidated_by_session_id = p_session_id,
    updated_at                = v_now
  WHERE f.id             = p_fact_id
    AND f.invalidated_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'fact % not found or already invalidated', p_fact_id;
  END IF;

  INSERT INTO facts_audit (fact_id, op, payload, actor, at)
  VALUES (
    p_fact_id,
    'invalidate',
    jsonb_build_object('reason', p_reason, 'session_id', p_session_id),
    COALESCE(p_session_id, 'agent'),
    v_now
  );

  RETURN QUERY SELECT v_now AS invalidated_at;
END;
$$;

-- ============================================================
-- UnClick Memory Health -- chunk 1 of 4
-- ============================================================
-- Per-tenant memory health scoring. Adds mc_memory_health (one row
-- per api_key_hash) plus mc_score_memory_health() that derives
-- duplication / staleness / entropy heuristics from mc_extracted_facts
-- and upserts the result.
--
-- Nightly scoring: pg_cron is not enabled in this project (no
-- CREATE EXTENSION pg_cron in any prior migration), so scheduling
-- lives in the edge function at supabase/functions/score-memory-health.
-- That function loops every api_key_hash and calls the pg function
-- via the service role. The Supabase dashboard cron UI fires it at
-- 02:00 UTC. If pg_cron is enabled later, the schedule can move
-- back into SQL with:
--   SELECT cron.schedule('memory-health-nightly', '0 2 * * *',
--     $$ ... $$);
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS mc_memory_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash TEXT NOT NULL UNIQUE,
  duplication_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  staleness_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  entropy NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_facts INT NOT NULL DEFAULT 0,
  duplicate_groups JSONB NOT NULL DEFAULT '[]',
  last_scored_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mc_memory_health_last_scored_idx
  ON mc_memory_health (last_scored_at);

-- ─── updated_at trigger ────────────────────────────────────────
-- Reuses mc_update_updated_at() from 20260415000000_memory_managed_cloud.sql.
-- Guarded with CREATE OR REPLACE in case this migration runs first.
CREATE OR REPLACE FUNCTION mc_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mc_mh_updated ON mc_memory_health;
CREATE TRIGGER trg_mc_mh_updated
  BEFORE UPDATE ON mc_memory_health
  FOR EACH ROW EXECUTE FUNCTION mc_update_updated_at();

-- ─── Row Level Security ────────────────────────────────────────
-- Matches mc_skills pattern (PR #37): service_role_all only. No
-- anon/authenticated policies. Admin functions gate user access.
ALTER TABLE mc_memory_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON mc_memory_health;
CREATE POLICY "service_role_all" ON mc_memory_health
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- Scoring function
-- ============================================================
-- Heuristics:
--   duplication_pct = facts that share 3+ keyword tokens with
--                     another fact / total active facts * 100
--   staleness_pct   = facts older than 90 days / total * 100
--   entropy         = distinct tokens / total tokens * 100
--                     (scaled to the same 0..100 range as the
--                      percentage fields for UI consistency)
-- Tokens: lowercased alphanumeric runs of length >= 4.
-- ============================================================
CREATE OR REPLACE FUNCTION mc_score_memory_health(p_api_key_hash TEXT)
RETURNS mc_memory_health AS $$
DECLARE
  v_total_facts INT := 0;
  v_duplication_pct NUMERIC(5,2) := 0;
  v_staleness_pct NUMERIC(5,2) := 0;
  v_entropy NUMERIC(5,2) := 0;
  v_duplicate_groups JSONB := '[]'::jsonb;
  v_row mc_memory_health;
BEGIN
  SELECT COUNT(*) INTO v_total_facts
  FROM mc_extracted_facts
  WHERE api_key_hash = p_api_key_hash
    AND status = 'active';

  IF v_total_facts = 0 THEN
    INSERT INTO mc_memory_health (
      api_key_hash, duplication_pct, staleness_pct, entropy,
      total_facts, duplicate_groups, last_scored_at, updated_at
    ) VALUES (
      p_api_key_hash, 0, 0, 0, 0, '[]'::jsonb, now(), now()
    )
    ON CONFLICT (api_key_hash) DO UPDATE SET
      duplication_pct = 0,
      staleness_pct = 0,
      entropy = 0,
      total_facts = 0,
      duplicate_groups = '[]'::jsonb,
      last_scored_at = now(),
      updated_at = now()
    RETURNING * INTO v_row;
    RETURN v_row;
  END IF;

  SELECT ROUND(
    (COUNT(*) FILTER (WHERE created_at < now() - INTERVAL '90 days')::numeric
      / v_total_facts::numeric) * 100, 2)
    INTO v_staleness_pct
  FROM mc_extracted_facts
  WHERE api_key_hash = p_api_key_hash
    AND status = 'active';

  WITH fact_tokens AS (
    SELECT DISTINCT
      f.id AS fact_id,
      LOWER(t.token) AS token
    FROM mc_extracted_facts f
    CROSS JOIN LATERAL regexp_split_to_table(f.fact, '[^[:alnum:]]+') AS t(token)
    WHERE f.api_key_hash = p_api_key_hash
      AND f.status = 'active'
      AND LENGTH(t.token) >= 4
  ),
  pair_overlaps AS (
    SELECT a.fact_id AS fact_a,
           b.fact_id AS fact_b,
           COUNT(*)  AS shared
    FROM fact_tokens a
    JOIN fact_tokens b
      ON a.token = b.token
     AND a.fact_id < b.fact_id
    GROUP BY a.fact_id, b.fact_id
    HAVING COUNT(*) >= 3
  ),
  duplicate_fact_ids AS (
    SELECT fact_a AS fact_id FROM pair_overlaps
    UNION
    SELECT fact_b AS fact_id FROM pair_overlaps
  ),
  token_stats AS (
    SELECT
      COUNT(*)           AS total_tokens,
      COUNT(DISTINCT token) AS distinct_tokens
    FROM fact_tokens
  ),
  groups_agg AS (
    SELECT COALESCE(
      jsonb_agg(jsonb_build_object(
        'fact_a', fact_a,
        'fact_b', fact_b,
        'shared_tokens', shared
      ) ORDER BY shared DESC),
      '[]'::jsonb
    ) AS groups
    FROM pair_overlaps
  )
  SELECT
    ROUND(((SELECT COUNT(*) FROM duplicate_fact_ids)::numeric
      / v_total_facts::numeric) * 100, 2),
    CASE WHEN (SELECT total_tokens FROM token_stats) > 0
      THEN ROUND(
        (SELECT distinct_tokens FROM token_stats)::numeric
        / (SELECT total_tokens FROM token_stats)::numeric * 100, 2)
      ELSE 0
    END,
    (SELECT groups FROM groups_agg)
  INTO v_duplication_pct, v_entropy, v_duplicate_groups;

  INSERT INTO mc_memory_health (
    api_key_hash, duplication_pct, staleness_pct, entropy,
    total_facts, duplicate_groups, last_scored_at, updated_at
  ) VALUES (
    p_api_key_hash, v_duplication_pct, v_staleness_pct, v_entropy,
    v_total_facts, v_duplicate_groups, now(), now()
  )
  ON CONFLICT (api_key_hash) DO UPDATE SET
    duplication_pct  = EXCLUDED.duplication_pct,
    staleness_pct    = EXCLUDED.staleness_pct,
    entropy          = EXCLUDED.entropy,
    total_facts      = EXCLUDED.total_facts,
    duplicate_groups = EXCLUDED.duplicate_groups,
    last_scored_at   = EXCLUDED.last_scored_at,
    updated_at       = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- DONE.
-- ============================================================

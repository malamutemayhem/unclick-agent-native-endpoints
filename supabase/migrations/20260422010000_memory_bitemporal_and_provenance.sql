-- ─── Chunk 2: Bi-temporal schema + provenance + blob preservation ──────────────
--
-- Adds bi-temporal tracking (valid_from/valid_to/invalidated_at) and provenance
-- columns (extractor_id, model_id, prompt_version, content_hash) to extracted_facts.
-- Adds canonical_docs (raw-blob store) and facts_audit (append-only audit log).
-- Replaces mc_search_memory_hybrid / search_memory_hybrid with versions that:
--   - Filter out invalidated / temporally expired facts
--   - Accept an optional as_of timestamp for point-in-time queries
--   - Run a near-dup collapse (cosine >= 0.90) on the top-20 before returning

-- ─── 1. Managed cloud: add columns to mc_extracted_facts ─────────────────────

ALTER TABLE mc_extracted_facts
  ADD COLUMN IF NOT EXISTS valid_from              TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS valid_to                TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recorded_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS invalidated_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invalidated_by_session_id TEXT,
  ADD COLUMN IF NOT EXISTS extractor_id            TEXT,
  ADD COLUMN IF NOT EXISTS prompt_version          TEXT,
  ADD COLUMN IF NOT EXISTS model_id                TEXT,
  ADD COLUMN IF NOT EXISTS content_hash            TEXT,
  ADD COLUMN IF NOT EXISTS derived_from_doc_id     UUID;   -- FK added after canonical_docs exists

-- Partial unique index: one live fact per (tenant, hash)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mc_ef_hash_live
  ON mc_extracted_facts (api_key_hash, content_hash)
  WHERE invalidated_at IS NULL AND content_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mc_ef_bitemporal
  ON mc_extracted_facts (api_key_hash, valid_from, valid_to, invalidated_at);

-- ─── 2. BYOD: add columns to extracted_facts ─────────────────────────────────

ALTER TABLE extracted_facts
  ADD COLUMN IF NOT EXISTS valid_from              TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS valid_to                TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recorded_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS invalidated_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invalidated_by_session_id TEXT,
  ADD COLUMN IF NOT EXISTS extractor_id            TEXT,
  ADD COLUMN IF NOT EXISTS prompt_version          TEXT,
  ADD COLUMN IF NOT EXISTS model_id                TEXT,
  ADD COLUMN IF NOT EXISTS content_hash            TEXT,
  ADD COLUMN IF NOT EXISTS derived_from_doc_id     UUID;   -- FK added after canonical_docs exists

CREATE UNIQUE INDEX IF NOT EXISTS idx_ef_hash_live
  ON extracted_facts (content_hash)
  WHERE invalidated_at IS NULL AND content_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ef_bitemporal
  ON extracted_facts (valid_from, valid_to, invalidated_at);

-- ─── 3. Managed cloud: mc_canonical_docs ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS mc_canonical_docs (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_hash  TEXT        NOT NULL,
  title         TEXT,
  body          TEXT        NOT NULL,
  content_hash  TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mc_cd_hash
  ON mc_canonical_docs (api_key_hash, content_hash);

CREATE INDEX IF NOT EXISTS idx_mc_cd_tenant
  ON mc_canonical_docs (api_key_hash);

-- ─── 4. BYOD: canonical_docs ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS canonical_docs (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT,
  body          TEXT        NOT NULL,
  content_hash  TEXT        NOT NULL UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 5. FK: derived_from_doc_id (now that both tables exist) ─────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_mc_ef_doc'
      AND table_name = 'mc_extracted_facts'
  ) THEN
    ALTER TABLE mc_extracted_facts
      ADD CONSTRAINT fk_mc_ef_doc
        FOREIGN KEY (derived_from_doc_id) REFERENCES mc_canonical_docs(id) ON DELETE SET NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_ef_doc'
      AND table_name = 'extracted_facts'
  ) THEN
    ALTER TABLE extracted_facts
      ADD CONSTRAINT fk_ef_doc
        FOREIGN KEY (derived_from_doc_id) REFERENCES canonical_docs(id) ON DELETE SET NULL;
  END IF;
END
$$;

-- ─── 6. Managed cloud: mc_facts_audit ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mc_facts_audit (
  id       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  fact_id  UUID        NOT NULL REFERENCES mc_extracted_facts(id) ON DELETE CASCADE,
  op       TEXT        NOT NULL CHECK (op IN ('insert', 'update', 'invalidate')),
  payload  JSONB,
  actor    TEXT,
  at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mc_fa_fact_id ON mc_facts_audit (fact_id);
CREATE INDEX IF NOT EXISTS idx_mc_fa_at      ON mc_facts_audit (at DESC);

-- ─── 7. BYOD: facts_audit ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS facts_audit (
  id       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  fact_id  UUID        NOT NULL REFERENCES extracted_facts(id) ON DELETE CASCADE,
  op       TEXT        NOT NULL CHECK (op IN ('insert', 'update', 'invalidate')),
  payload  JSONB,
  actor    TEXT,
  at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fa_fact_id ON facts_audit (fact_id);
CREATE INDEX IF NOT EXISTS idx_fa_at      ON facts_audit (at DESC);

-- ─── 8. Managed cloud: mc_invalidate_fact ────────────────────────────────────

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
  UPDATE mc_extracted_facts
  SET
    invalidated_at            = v_now,
    invalidated_by_session_id = p_session_id,
    updated_at                = v_now
  WHERE id             = p_fact_id
    AND api_key_hash   = p_api_key_hash
    AND invalidated_at IS NULL;

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

  RETURN QUERY SELECT v_now;
END;
$$;

-- ─── 9. BYOD: invalidate_fact ────────────────────────────────────────────────

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
  UPDATE extracted_facts
  SET
    invalidated_at            = v_now,
    invalidated_by_session_id = p_session_id,
    updated_at                = v_now
  WHERE id             = p_fact_id
    AND invalidated_at IS NULL;

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

  RETURN QUERY SELECT v_now;
END;
$$;

-- ─── 10. Update mc_search_facts: add bi-temporal filter ──────────────────────

CREATE OR REPLACE FUNCTION mc_search_facts(
  p_api_key_hash TEXT,
  p_search_query TEXT,
  p_max_results  INTEGER DEFAULT 20
)
RETURNS TABLE(
  id           UUID,
  fact         TEXT,
  category     TEXT,
  confidence   REAL,
  status       TEXT,
  created_at   TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT ef.id, ef.fact, ef.category, ef.confidence, ef.status, ef.created_at
  FROM mc_extracted_facts ef
  WHERE ef.api_key_hash  = p_api_key_hash
    AND ef.fact ILIKE '%' || p_search_query || '%'
    AND ef.status        = 'active'
    AND ef.invalidated_at IS NULL                                -- bi-temporal
    AND (ef.valid_to IS NULL OR ef.valid_to > now())             -- bi-temporal
  ORDER BY ef.confidence DESC, ef.created_at DESC
  LIMIT p_max_results;
END;
$$;

-- ─── 11. Update search_facts (BYOD): add bi-temporal filter ──────────────────

CREATE OR REPLACE FUNCTION search_facts(
  search_query TEXT,
  max_results  INTEGER DEFAULT 20
)
RETURNS TABLE(
  id           UUID,
  fact         TEXT,
  category     TEXT,
  confidence   REAL,
  status       TEXT,
  created_at   TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT ef.id, ef.fact, ef.category, ef.confidence, ef.status, ef.created_at
  FROM extracted_facts ef
  WHERE ef.fact ILIKE '%' || search_query || '%'
    AND ef.status        = 'active'
    AND ef.invalidated_at IS NULL
    AND (ef.valid_to IS NULL OR ef.valid_to > now())
  ORDER BY ef.confidence DESC, ef.created_at DESC
  LIMIT max_results;
END;
$$;

-- ─── 12. Replace mc_search_memory_hybrid with bi-temporal + near-dup collapse ─
--
-- Changes from Chunk 1:
--   - Added p_as_of for point-in-time queries (default NULL = current time)
--   - Facts filtered: invalidated_at IS NULL AND valid_to > as_of AND valid_from <= as_of
--   - Near-dup collapse: top-20 after RRF → CROSS JOIN on embeddings → cosine>=0.90 clusters
--     → keep highest-scored per cluster → limit to p_max_results

CREATE OR REPLACE FUNCTION mc_search_memory_hybrid(
  p_api_key_hash    TEXT,
  p_search_query    TEXT,
  p_query_embedding VECTOR(1536),
  p_max_results     INTEGER    DEFAULT 10,
  p_as_of           TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  id           UUID,
  source       TEXT,
  content      TEXT,
  category     TEXT,
  confidence   REAL,
  created_at   TIMESTAMPTZ,
  final_score  REAL,
  rrf_score    REAL,
  kw_score     REAL,
  cosine_score REAL
)
LANGUAGE plpgsql
AS $$
DECLARE
  q       TSQUERY;
  as_of_ts TIMESTAMPTZ;
BEGIN
  q        := plainto_tsquery('english', p_search_query);
  as_of_ts := COALESCE(p_as_of, now());

  RETURN QUERY
  WITH kw_facts AS (
    SELECT
      ef.id,
      'fact'::TEXT                                                              AS source,
      ef.fact                                                                   AS content,
      ef.category,
      ef.confidence,
      ef.created_at,
      ROW_NUMBER() OVER (ORDER BY ts_rank(to_tsvector('english', ef.fact), q) DESC) AS kw_rank,
      ts_rank(to_tsvector('english', ef.fact), q)::REAL                        AS kw_score
    FROM mc_extracted_facts ef
    WHERE ef.api_key_hash  = p_api_key_hash
      AND ef.status        = 'active'
      AND ef.invalidated_at IS NULL
      AND (ef.valid_to IS NULL OR ef.valid_to > as_of_ts)
      AND ef.valid_from   <= as_of_ts
      AND to_tsvector('english', ef.fact) @@ q
    LIMIT 50
  ),
  vec_facts AS (
    SELECT
      ef.id,
      'fact'::TEXT                                                              AS source,
      ef.fact                                                                   AS content,
      ef.category,
      ef.confidence,
      ef.created_at,
      ROW_NUMBER() OVER (ORDER BY ef.embedding <=> p_query_embedding)          AS vec_rank,
      (1.0 - (ef.embedding <=> p_query_embedding))::REAL                       AS cosine_score
    FROM mc_extracted_facts ef
    WHERE ef.api_key_hash  = p_api_key_hash
      AND ef.status        = 'active'
      AND ef.invalidated_at IS NULL
      AND (ef.valid_to IS NULL OR ef.valid_to > as_of_ts)
      AND ef.valid_from   <= as_of_ts
      AND ef.embedding IS NOT NULL
    ORDER BY ef.embedding <=> p_query_embedding
    LIMIT 50
  ),
  kw_sessions AS (
    SELECT
      ss.id,
      'session'::TEXT                                                           AS source,
      ss.summary                                                                AS content,
      'session'::TEXT                                                           AS category,
      1.0::REAL                                                                 AS confidence,
      ss.created_at,
      ROW_NUMBER() OVER (ORDER BY ts_rank(to_tsvector('english', ss.summary), q) DESC) AS kw_rank,
      ts_rank(to_tsvector('english', ss.summary), q)::REAL                     AS kw_score
    FROM mc_session_summaries ss
    WHERE ss.api_key_hash = p_api_key_hash
      AND to_tsvector('english', ss.summary) @@ q
    LIMIT 50
  ),
  vec_sessions AS (
    SELECT
      ss.id,
      'session'::TEXT                                                           AS source,
      ss.summary                                                                AS content,
      'session'::TEXT                                                           AS category,
      1.0::REAL                                                                 AS confidence,
      ss.created_at,
      ROW_NUMBER() OVER (ORDER BY ss.embedding <=> p_query_embedding)          AS vec_rank,
      (1.0 - (ss.embedding <=> p_query_embedding))::REAL                       AS cosine_score
    FROM mc_session_summaries ss
    WHERE ss.api_key_hash = p_api_key_hash
      AND ss.embedding IS NOT NULL
    ORDER BY ss.embedding <=> p_query_embedding
    LIMIT 50
  ),
  rrf_facts AS (
    SELECT
      COALESCE(k.id,         v.id)         AS id,
      COALESCE(k.source,     v.source)     AS source,
      COALESCE(k.content,    v.content)    AS content,
      COALESCE(k.category,   v.category)   AS category,
      COALESCE(k.confidence, v.confidence) AS confidence,
      COALESCE(k.created_at, v.created_at) AS created_at,
      (COALESCE(1.0 / (60.0 + k.kw_rank),  0.0)
     + COALESCE(1.0 / (60.0 + v.vec_rank), 0.0))::REAL AS rrf_score,
      COALESCE(k.kw_score,     0.0)::REAL  AS kw_score,
      COALESCE(v.cosine_score, 0.0)::REAL  AS cosine_score
    FROM kw_facts k
    FULL OUTER JOIN vec_facts v ON k.id = v.id
  ),
  rrf_sessions AS (
    SELECT
      COALESCE(k.id,         v.id)         AS id,
      COALESCE(k.source,     v.source)     AS source,
      COALESCE(k.content,    v.content)    AS content,
      COALESCE(k.category,   v.category)   AS category,
      COALESCE(k.confidence, v.confidence) AS confidence,
      COALESCE(k.created_at, v.created_at) AS created_at,
      (COALESCE(1.0 / (60.0 + k.kw_rank),  0.0)
     + COALESCE(1.0 / (60.0 + v.vec_rank), 0.0))::REAL AS rrf_score,
      COALESCE(k.kw_score,     0.0)::REAL  AS kw_score,
      COALESCE(v.cosine_score, 0.0)::REAL  AS cosine_score
    FROM kw_sessions k
    FULL OUTER JOIN vec_sessions v ON k.id = v.id
  ),
  combined AS (
    SELECT * FROM rrf_facts
    UNION ALL
    SELECT * FROM rrf_sessions
  ),
  -- Pre-dedup: compute final_score, take top-20 before near-dup collapse
  pre_dedup AS (
    SELECT
      c.id, c.source, c.content, c.category, c.confidence, c.created_at,
      c.rrf_score, c.kw_score, c.cosine_score,
      (c.rrf_score * c.confidence
        * EXP(-EXTRACT(EPOCH FROM (now() - c.created_at)) / (90.0 * 86400.0))
      )::REAL AS final_score
    FROM combined c
    ORDER BY
      c.rrf_score * c.confidence
      * EXP(-EXTRACT(EPOCH FROM (now() - c.created_at)) / (90.0 * 86400.0))
      DESC
    LIMIT 20
  ),
  -- Near-dup collapse: fetch embeddings for the fact rows in pre_dedup
  fact_embeddings AS (
    SELECT pd.id, pd.final_score, ef.embedding
    FROM pre_dedup pd
    JOIN mc_extracted_facts ef ON ef.id = pd.id
    WHERE pd.source = 'fact'
      AND ef.embedding IS NOT NULL
  ),
  -- Identify dominated members of near-dup clusters (cosine >= 0.90, lower score)
  dominated AS (
    SELECT DISTINCT
      CASE
        WHEN a.final_score > b.final_score  THEN b.id
        WHEN a.final_score < b.final_score  THEN a.id
        ELSE LEAST(a.id::TEXT, b.id::TEXT)::UUID   -- tie-break: lower UUID dominated
      END AS dominated_id
    FROM fact_embeddings a
    CROSS JOIN fact_embeddings b
    WHERE a.id != b.id
      AND (1.0 - (a.embedding <=> b.embedding)) >= 0.90
  )
  SELECT
    pd.id, pd.source, pd.content, pd.category, pd.confidence, pd.created_at,
    pd.final_score, pd.rrf_score, pd.kw_score, pd.cosine_score
  FROM pre_dedup pd
  WHERE pd.id NOT IN (SELECT dominated_id FROM dominated)
  ORDER BY pd.final_score DESC
  LIMIT p_max_results;
END;
$$;

-- ─── 13. Replace search_memory_hybrid (BYOD) ─────────────────────────────────

CREATE OR REPLACE FUNCTION search_memory_hybrid(
  search_query    TEXT,
  query_embedding VECTOR(1536),
  max_results     INTEGER    DEFAULT 10,
  as_of           TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  id           UUID,
  source       TEXT,
  content      TEXT,
  category     TEXT,
  confidence   REAL,
  created_at   TIMESTAMPTZ,
  final_score  REAL,
  rrf_score    REAL,
  kw_score     REAL,
  cosine_score REAL
)
LANGUAGE plpgsql
AS $$
DECLARE
  q       TSQUERY;
  as_of_ts TIMESTAMPTZ;
BEGIN
  q        := plainto_tsquery('english', search_query);
  as_of_ts := COALESCE(as_of, now());

  RETURN QUERY
  WITH kw_facts AS (
    SELECT
      ef.id,
      'fact'::TEXT                                                              AS source,
      ef.fact                                                                   AS content,
      ef.category,
      ef.confidence,
      ef.created_at,
      ROW_NUMBER() OVER (ORDER BY ts_rank(to_tsvector('english', ef.fact), q) DESC) AS kw_rank,
      ts_rank(to_tsvector('english', ef.fact), q)::REAL                        AS kw_score
    FROM extracted_facts ef
    WHERE ef.status       = 'active'
      AND ef.invalidated_at IS NULL
      AND (ef.valid_to IS NULL OR ef.valid_to > as_of_ts)
      AND ef.valid_from  <= as_of_ts
      AND to_tsvector('english', ef.fact) @@ q
    LIMIT 50
  ),
  vec_facts AS (
    SELECT
      ef.id,
      'fact'::TEXT                                                              AS source,
      ef.fact                                                                   AS content,
      ef.category,
      ef.confidence,
      ef.created_at,
      ROW_NUMBER() OVER (ORDER BY ef.embedding <=> query_embedding)            AS vec_rank,
      (1.0 - (ef.embedding <=> query_embedding))::REAL                         AS cosine_score
    FROM extracted_facts ef
    WHERE ef.status      = 'active'
      AND ef.invalidated_at IS NULL
      AND (ef.valid_to IS NULL OR ef.valid_to > as_of_ts)
      AND ef.valid_from <= as_of_ts
      AND ef.embedding IS NOT NULL
    ORDER BY ef.embedding <=> query_embedding
    LIMIT 50
  ),
  kw_sessions AS (
    SELECT
      ss.id,
      'session'::TEXT                                                           AS source,
      ss.summary                                                                AS content,
      'session'::TEXT                                                           AS category,
      1.0::REAL                                                                 AS confidence,
      ss.created_at,
      ROW_NUMBER() OVER (ORDER BY ts_rank(to_tsvector('english', ss.summary), q) DESC) AS kw_rank,
      ts_rank(to_tsvector('english', ss.summary), q)::REAL                     AS kw_score
    FROM session_summaries ss
    WHERE to_tsvector('english', ss.summary) @@ q
    LIMIT 50
  ),
  vec_sessions AS (
    SELECT
      ss.id,
      'session'::TEXT                                                           AS source,
      ss.summary                                                                AS content,
      'session'::TEXT                                                           AS category,
      1.0::REAL                                                                 AS confidence,
      ss.created_at,
      ROW_NUMBER() OVER (ORDER BY ss.embedding <=> query_embedding)            AS vec_rank,
      (1.0 - (ss.embedding <=> query_embedding))::REAL                         AS cosine_score
    FROM session_summaries ss
    WHERE ss.embedding IS NOT NULL
    ORDER BY ss.embedding <=> query_embedding
    LIMIT 50
  ),
  rrf_facts AS (
    SELECT
      COALESCE(k.id,         v.id)         AS id,
      COALESCE(k.source,     v.source)     AS source,
      COALESCE(k.content,    v.content)    AS content,
      COALESCE(k.category,   v.category)   AS category,
      COALESCE(k.confidence, v.confidence) AS confidence,
      COALESCE(k.created_at, v.created_at) AS created_at,
      (COALESCE(1.0 / (60.0 + k.kw_rank),  0.0)
     + COALESCE(1.0 / (60.0 + v.vec_rank), 0.0))::REAL AS rrf_score,
      COALESCE(k.kw_score,     0.0)::REAL  AS kw_score,
      COALESCE(v.cosine_score, 0.0)::REAL  AS cosine_score
    FROM kw_facts k
    FULL OUTER JOIN vec_facts v ON k.id = v.id
  ),
  rrf_sessions AS (
    SELECT
      COALESCE(k.id,         v.id)         AS id,
      COALESCE(k.source,     v.source)     AS source,
      COALESCE(k.content,    v.content)    AS content,
      COALESCE(k.category,   v.category)   AS category,
      COALESCE(k.confidence, v.confidence) AS confidence,
      COALESCE(k.created_at, v.created_at) AS created_at,
      (COALESCE(1.0 / (60.0 + k.kw_rank),  0.0)
     + COALESCE(1.0 / (60.0 + v.vec_rank), 0.0))::REAL AS rrf_score,
      COALESCE(k.kw_score,     0.0)::REAL  AS kw_score,
      COALESCE(v.cosine_score, 0.0)::REAL  AS cosine_score
    FROM kw_sessions k
    FULL OUTER JOIN vec_sessions v ON k.id = v.id
  ),
  combined AS (
    SELECT * FROM rrf_facts
    UNION ALL
    SELECT * FROM rrf_sessions
  ),
  pre_dedup AS (
    SELECT
      c.id, c.source, c.content, c.category, c.confidence, c.created_at,
      c.rrf_score, c.kw_score, c.cosine_score,
      (c.rrf_score * c.confidence
        * EXP(-EXTRACT(EPOCH FROM (now() - c.created_at)) / (90.0 * 86400.0))
      )::REAL AS final_score
    FROM combined c
    ORDER BY
      c.rrf_score * c.confidence
      * EXP(-EXTRACT(EPOCH FROM (now() - c.created_at)) / (90.0 * 86400.0))
      DESC
    LIMIT 20
  ),
  fact_embeddings AS (
    SELECT pd.id, pd.final_score, ef.embedding
    FROM pre_dedup pd
    JOIN extracted_facts ef ON ef.id = pd.id
    WHERE pd.source = 'fact'
      AND ef.embedding IS NOT NULL
  ),
  dominated AS (
    SELECT DISTINCT
      CASE
        WHEN a.final_score > b.final_score  THEN b.id
        WHEN a.final_score < b.final_score  THEN a.id
        ELSE LEAST(a.id::TEXT, b.id::TEXT)::UUID
      END AS dominated_id
    FROM fact_embeddings a
    CROSS JOIN fact_embeddings b
    WHERE a.id != b.id
      AND (1.0 - (a.embedding <=> b.embedding)) >= 0.90
  )
  SELECT
    pd.id, pd.source, pd.content, pd.category, pd.confidence, pd.created_at,
    pd.final_score, pd.rrf_score, pd.kw_score, pd.cosine_score
  FROM pre_dedup pd
  WHERE pd.id NOT IN (SELECT dominated_id FROM dominated)
  ORDER BY pd.final_score DESC
  LIMIT max_results;
END;
$$;

-- ─── 14. RLS: mirror existing policies on new tables ─────────────────────────

ALTER TABLE mc_canonical_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_facts_audit    ENABLE ROW LEVEL SECURITY;

-- Service role has full access (same pattern as all other mc_* tables).
--
-- Idempotency guard: CREATE POLICY has no IF NOT EXISTS form in Postgres,
-- so each policy is wrapped in a pg_policies check so re-running this
-- migration is safe.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mc_canonical_docs' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON mc_canonical_docs
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mc_facts_audit' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON mc_facts_audit
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- BYOD tables use the same per-user auth pattern as existing tables
ALTER TABLE canonical_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE facts_audit    ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'canonical_docs' AND policyname = 'Users can manage their own canonical_docs'
  ) THEN
    CREATE POLICY "Users can manage their own canonical_docs" ON canonical_docs
      FOR ALL TO authenticated
      USING ((SELECT auth.uid()) IS NOT NULL)
      WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'facts_audit' AND policyname = 'Users can manage their own facts_audit'
  ) THEN
    CREATE POLICY "Users can manage their own facts_audit" ON facts_audit
      FOR ALL TO authenticated
      USING ((SELECT auth.uid()) IS NOT NULL)
      WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
  END IF;
END $$;

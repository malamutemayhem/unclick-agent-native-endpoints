-- ─── Hybrid retrieval: embedding columns + RRF search functions ────────────────
--
-- Adds pgvector embeddings to extracted_facts and session_summaries for both
-- managed (mc_*) and BYOD (single-tenant) schemas.
--
-- Pipeline: BM25 keyword top-50 + pgvector cosine top-50 → RRF(k=60) →
-- post-fusion multiply by confidence * recency_decay(90d) → top-N.
--
-- Embedding model: text-embedding-3-small (1536 dims).
-- New columns are nullable so backfill is gradual; search degrades gracefully
-- to keyword-only for rows without embeddings.

-- ─── 1. Enable pgvector ───────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── 2. Managed cloud: mc_extracted_facts ─────────────────────────────────────
ALTER TABLE mc_extracted_facts
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_created_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_mc_ef_embedding
  ON mc_extracted_facts USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE embedding IS NOT NULL;

-- ─── 3. Managed cloud: mc_session_summaries ──────────────────────────────────
ALTER TABLE mc_session_summaries
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_created_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_mc_ss_embedding
  ON mc_session_summaries USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE embedding IS NOT NULL;

-- ─── 4. BYOD: extracted_facts ────────────────────────────────────────────────
ALTER TABLE extracted_facts
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_created_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ef_embedding
  ON extracted_facts USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE embedding IS NOT NULL;

-- ─── 5. BYOD: session_summaries ───────────────────────────────────────────────
ALTER TABLE session_summaries
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_created_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ss_embedding
  ON session_summaries USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE embedding IS NOT NULL;

-- ─── 6. Managed cloud: mc_search_memory_hybrid ───────────────────────────────
--
-- Searches extracted_facts and session_summaries via RRF over keyword + vector
-- lanes. Falls back to keyword-only for rows without embeddings.
--
-- RRF score: Σ 1/(k + rank_i) with k=60
-- Final score: rrf_score * confidence * exp(-age_days / 90)  (tiebreakers)
CREATE OR REPLACE FUNCTION mc_search_memory_hybrid(
  p_api_key_hash    TEXT,
  p_search_query    TEXT,
  p_query_embedding vector(1536),
  p_max_results     INTEGER DEFAULT 10
)
RETURNS TABLE(
  id                UUID,
  source            TEXT,
  content           TEXT,
  category          TEXT,
  confidence        REAL,
  created_at        TIMESTAMPTZ,
  final_score       REAL,
  rrf_score         REAL,
  kw_score          REAL,
  cosine_score      REAL
)
LANGUAGE plpgsql
AS $$
DECLARE
  q tsquery;
BEGIN
  -- plainto_tsquery never throws on empty/garbage input
  q := plainto_tsquery('english', p_search_query);

  RETURN QUERY
  WITH kw_facts AS (
    SELECT
      ef.id,
      'fact'::TEXT                                                            AS source,
      ef.fact                                                                 AS content,
      ef.category,
      ef.confidence,
      ef.created_at,
      ROW_NUMBER() OVER (ORDER BY ts_rank(to_tsvector('english', ef.fact), q) DESC)  AS kw_rank,
      ts_rank(to_tsvector('english', ef.fact), q)::REAL                      AS kw_score
    FROM mc_extracted_facts ef
    WHERE ef.api_key_hash = p_api_key_hash
      AND ef.status = 'active'
      AND to_tsvector('english', ef.fact) @@ q
    LIMIT 50
  ),
  vec_facts AS (
    SELECT
      ef.id,
      'fact'::TEXT                                                            AS source,
      ef.fact                                                                 AS content,
      ef.category,
      ef.confidence,
      ef.created_at,
      ROW_NUMBER() OVER (ORDER BY ef.embedding <=> p_query_embedding)        AS vec_rank,
      (1.0 - (ef.embedding <=> p_query_embedding))::REAL                     AS cosine_score
    FROM mc_extracted_facts ef
    WHERE ef.api_key_hash = p_api_key_hash
      AND ef.status = 'active'
      AND ef.embedding IS NOT NULL
    ORDER BY ef.embedding <=> p_query_embedding
    LIMIT 50
  ),
  kw_sessions AS (
    SELECT
      ss.id,
      'session'::TEXT                                                         AS source,
      ss.summary                                                              AS content,
      'session'::TEXT                                                         AS category,
      1.0::REAL                                                               AS confidence,
      ss.created_at,
      ROW_NUMBER() OVER (ORDER BY ts_rank(to_tsvector('english', ss.summary), q) DESC) AS kw_rank,
      ts_rank(to_tsvector('english', ss.summary), q)::REAL                   AS kw_score
    FROM mc_session_summaries ss
    WHERE ss.api_key_hash = p_api_key_hash
      AND to_tsvector('english', ss.summary) @@ q
    LIMIT 50
  ),
  vec_sessions AS (
    SELECT
      ss.id,
      'session'::TEXT                                                         AS source,
      ss.summary                                                              AS content,
      'session'::TEXT                                                         AS category,
      1.0::REAL                                                               AS confidence,
      ss.created_at,
      ROW_NUMBER() OVER (ORDER BY ss.embedding <=> p_query_embedding)        AS vec_rank,
      (1.0 - (ss.embedding <=> p_query_embedding))::REAL                     AS cosine_score
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
  )
  SELECT
    c.id,
    c.source,
    c.content,
    c.category,
    c.confidence,
    c.created_at,
    (c.rrf_score
      * c.confidence
      * EXP(-EXTRACT(EPOCH FROM (NOW() - c.created_at)) / (90.0 * 86400.0))
    )::REAL                                AS final_score,
    c.rrf_score,
    c.kw_score,
    c.cosine_score
  FROM combined c
  ORDER BY
    c.rrf_score
    * c.confidence
    * EXP(-EXTRACT(EPOCH FROM (NOW() - c.created_at)) / (90.0 * 86400.0))
    DESC
  LIMIT p_max_results;
END;
$$;

-- ─── 7. BYOD: search_memory_hybrid ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_memory_hybrid(
  search_query    TEXT,
  query_embedding vector(1536),
  max_results     INTEGER DEFAULT 10
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
  q tsquery;
BEGIN
  q := plainto_tsquery('english', search_query);

  RETURN QUERY
  WITH kw_facts AS (
    SELECT
      ef.id,
      'fact'::TEXT                                                           AS source,
      ef.fact                                                                AS content,
      ef.category,
      ef.confidence,
      ef.created_at,
      ROW_NUMBER() OVER (ORDER BY ts_rank(to_tsvector('english', ef.fact), q) DESC) AS kw_rank,
      ts_rank(to_tsvector('english', ef.fact), q)::REAL                     AS kw_score
    FROM extracted_facts ef
    WHERE ef.status = 'active'
      AND to_tsvector('english', ef.fact) @@ q
    LIMIT 50
  ),
  vec_facts AS (
    SELECT
      ef.id,
      'fact'::TEXT                                                           AS source,
      ef.fact                                                                AS content,
      ef.category,
      ef.confidence,
      ef.created_at,
      ROW_NUMBER() OVER (ORDER BY ef.embedding <=> query_embedding)         AS vec_rank,
      (1.0 - (ef.embedding <=> query_embedding))::REAL                      AS cosine_score
    FROM extracted_facts ef
    WHERE ef.status = 'active'
      AND ef.embedding IS NOT NULL
    ORDER BY ef.embedding <=> query_embedding
    LIMIT 50
  ),
  kw_sessions AS (
    SELECT
      ss.id,
      'session'::TEXT                                                        AS source,
      ss.summary                                                             AS content,
      'session'::TEXT                                                        AS category,
      1.0::REAL                                                              AS confidence,
      ss.created_at,
      ROW_NUMBER() OVER (ORDER BY ts_rank(to_tsvector('english', ss.summary), q) DESC) AS kw_rank,
      ts_rank(to_tsvector('english', ss.summary), q)::REAL                  AS kw_score
    FROM session_summaries ss
    WHERE to_tsvector('english', ss.summary) @@ q
    LIMIT 50
  ),
  vec_sessions AS (
    SELECT
      ss.id,
      'session'::TEXT                                                        AS source,
      ss.summary                                                             AS content,
      'session'::TEXT                                                        AS category,
      1.0::REAL                                                              AS confidence,
      ss.created_at,
      ROW_NUMBER() OVER (ORDER BY ss.embedding <=> query_embedding)         AS vec_rank,
      (1.0 - (ss.embedding <=> query_embedding))::REAL                      AS cosine_score
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
  )
  SELECT
    c.id,
    c.source,
    c.content,
    c.category,
    c.confidence,
    c.created_at,
    (c.rrf_score
      * c.confidence
      * EXP(-EXTRACT(EPOCH FROM (NOW() - c.created_at)) / (90.0 * 86400.0))
    )::REAL                                AS final_score,
    c.rrf_score,
    c.kw_score,
    c.cosine_score
  FROM combined c
  ORDER BY
    c.rrf_score
    * c.confidence
    * EXP(-EXTRACT(EPOCH FROM (NOW() - c.created_at)) / (90.0 * 86400.0))
    DESC
  LIMIT max_results;
END;
$$;

-- ─── 8. RLS: mirror existing service_role_all policies ────────────────────────
-- New columns inherit existing table-level policies; no extra policies needed.
-- The ivfflat indexes are only accessible via the service role, which already
-- has full access through the "service_role_all" policies on each table.

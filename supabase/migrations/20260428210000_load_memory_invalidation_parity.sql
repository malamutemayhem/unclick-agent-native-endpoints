-- ============================================================
-- load_memory invalidation parity (managed + BYOD)
-- ============================================================
-- Closes the parity gap between load_memory.active_facts and search_memory.
--
-- search_memory (mc_search_facts, search_facts, *_search_memory_hybrid)
-- already filters out invalidated / temporally expired facts:
--   AND ef.invalidated_at IS NULL
--   AND (ef.valid_to IS NULL OR ef.valid_to > now())
--
-- load_memory (mc_get_startup_context, get_startup_context) does not. It
-- only filters by status = 'active', which is independent of the bi-temporal
-- invalidated_at column added in 20260422010000_memory_bitemporal_and_provenance.sql.
-- That meant a fact invalidated via mc_invalidate_fact / invalidate_fact
-- would correctly disappear from search_memory but still surface in
-- load_memory.active_facts on the next session start.
--
-- This migration is a pure CREATE OR REPLACE of both functions: signatures,
-- return shape, and all unrelated logic are preserved verbatim. Only the
-- fact selection and the matching access_count UPDATE gain the bi-temporal
-- predicates.

-- ─── 1. Managed cloud: mc_get_startup_context ────────────────────────────────

CREATE OR REPLACE FUNCTION mc_get_startup_context(
  p_api_key_hash TEXT,
  p_num_sessions INTEGER DEFAULT 5
)
RETURNS JSONB AS $$
DECLARE
  ctx JSONB;
  lib JSONB;
  sessions JSONB;
  facts JSONB;
BEGIN
  -- Business context (hot + warm only)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'category', category,
      'key', key,
      'value', value,
      'priority', priority
    ) ORDER BY priority DESC, category, key
  ), '[]'::jsonb)
  INTO ctx
  FROM mc_business_context
  WHERE api_key_hash = p_api_key_hash
    AND decay_tier IN ('hot', 'warm');

  UPDATE mc_business_context
  SET access_count = access_count + 1,
      last_accessed = now()
  WHERE api_key_hash = p_api_key_hash
    AND decay_tier IN ('hot', 'warm');

  -- Library index
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'slug', slug,
      'title', title,
      'category', category,
      'tags', tags,
      'version', version,
      'updated_at', updated_at
    ) ORDER BY updated_at DESC
  ), '[]'::jsonb)
  INTO lib
  FROM mc_knowledge_library
  WHERE api_key_hash = p_api_key_hash
    AND decay_tier IN ('hot', 'warm');

  -- Recent session summaries
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'session_id', session_id,
      'platform', platform,
      'summary', summary,
      'decisions', decisions,
      'open_loops', open_loops,
      'topics', topics,
      'created_at', created_at
    ) ORDER BY created_at DESC
  ), '[]'::jsonb)
  INTO sessions
  FROM (
    SELECT * FROM mc_session_summaries
    WHERE api_key_hash = p_api_key_hash
    ORDER BY created_at DESC
    LIMIT p_num_sessions
  ) recent;

  -- Active hot facts (bi-temporal: exclude invalidated + expired)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'fact', fact,
      'category', category,
      'confidence', confidence,
      'created_at', created_at
    ) ORDER BY confidence DESC, created_at DESC
  ), '[]'::jsonb)
  INTO facts
  FROM (
    SELECT * FROM mc_extracted_facts
    WHERE api_key_hash = p_api_key_hash
      AND status = 'active'
      AND decay_tier = 'hot'
      AND invalidated_at IS NULL
      AND (valid_to IS NULL OR valid_to > now())
    ORDER BY confidence DESC, created_at DESC
    LIMIT 50
  ) hot_facts;

  UPDATE mc_extracted_facts
  SET access_count = access_count + 1,
      last_accessed = now()
  WHERE api_key_hash = p_api_key_hash
    AND status = 'active'
    AND decay_tier = 'hot'
    AND invalidated_at IS NULL
    AND (valid_to IS NULL OR valid_to > now());

  RETURN jsonb_build_object(
    'business_context', ctx,
    'knowledge_library_index', lib,
    'recent_sessions', sessions,
    'active_facts', facts,
    'loaded_at', now()
  );
END;
$$ LANGUAGE plpgsql;

-- ─── 2. BYOD: get_startup_context ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_startup_context(num_sessions INTEGER DEFAULT 5)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  ctx JSONB;
  lib JSONB;
  sessions JSONB;
  facts JSONB;
BEGIN
  -- Business context (hot + warm only)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'category', category,
      'key', key,
      'value', value,
      'priority', priority
    ) ORDER BY priority DESC, category, key
  ), '[]'::jsonb)
  INTO ctx
  FROM business_context
  WHERE decay_tier IN ('hot', 'warm');

  UPDATE business_context
  SET access_count = access_count + 1,
      last_accessed = now()
  WHERE decay_tier IN ('hot', 'warm');

  -- Library index (titles + slugs, not full content)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'slug', slug,
      'title', title,
      'category', category,
      'tags', tags,
      'version', version,
      'updated_at', updated_at
    ) ORDER BY updated_at DESC
  ), '[]'::jsonb)
  INTO lib
  FROM knowledge_library
  WHERE decay_tier IN ('hot', 'warm');

  -- Recent session summaries
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'session_id', session_id,
      'platform', platform,
      'summary', summary,
      'decisions', decisions,
      'open_loops', open_loops,
      'topics', topics,
      'created_at', created_at
    ) ORDER BY created_at DESC
  ), '[]'::jsonb)
  INTO sessions
  FROM (
    SELECT * FROM session_summaries
    ORDER BY created_at DESC
    LIMIT num_sessions
  ) recent;

  -- Active extracted facts (hot tier only; bi-temporal: exclude invalidated + expired)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'fact', fact,
      'category', category,
      'confidence', confidence,
      'created_at', created_at
    ) ORDER BY confidence DESC, created_at DESC
  ), '[]'::jsonb)
  INTO facts
  FROM (
    SELECT * FROM extracted_facts
    WHERE status = 'active'
      AND decay_tier = 'hot'
      AND invalidated_at IS NULL
      AND (valid_to IS NULL OR valid_to > now())
    ORDER BY confidence DESC, created_at DESC
    LIMIT 50
  ) hot_facts;

  UPDATE extracted_facts
  SET access_count = access_count + 1,
      last_accessed = now()
  WHERE status = 'active'
    AND decay_tier = 'hot'
    AND invalidated_at IS NULL
    AND (valid_to IS NULL OR valid_to > now());

  result := jsonb_build_object(
    'business_context', ctx,
    'knowledge_library_index', lib,
    'recent_sessions', sessions,
    'active_facts', facts,
    'loaded_at', now()
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- DONE.
-- ============================================================

-- Fix load_memory / get_startup_context invalidation visibility parity.
--
-- search_memory_hybrid (mc_search_memory_hybrid) excludes rows where
-- invalidated_at IS NOT NULL, so an invalidated fact disappears from search.
-- get_startup_context (and mc_get_startup_context) only filtered by
-- status = 'active' AND decay_tier = 'hot', so an invalidated fact still
-- showed up in the active_facts payload returned to load_memory. That gave
-- agents stale facts they had explicitly told memory to forget.
--
-- This migration adds invalidated_at IS NULL to both the SELECT that builds
-- active_facts and the UPDATE that bumps access counters. status flips to
-- 'active' OR 'superseded' on invalidate today (depending on path), so we
-- cannot rely on status alone for the filter; invalidated_at IS NULL is the
-- canonical "live row" signal used everywhere else.
--
-- Idempotent: CREATE OR REPLACE FUNCTION. Auto-applies on merge.

-- ─── mc_get_startup_context (managed cloud) ──────────────────────────────────
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

  -- Active hot facts (must match the invalidation filter used by
  -- mc_search_memory_hybrid: invalidated_at IS NULL).
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
    ORDER BY confidence DESC, created_at DESC
    LIMIT 50
  ) hot_facts;

  UPDATE mc_extracted_facts
  SET access_count = access_count + 1,
      last_accessed = now()
  WHERE api_key_hash = p_api_key_hash
    AND status = 'active'
    AND decay_tier = 'hot'
    AND invalidated_at IS NULL;

  RETURN jsonb_build_object(
    'business_context', ctx,
    'knowledge_library_index', lib,
    'recent_sessions', sessions,
    'active_facts', facts,
    'loaded_at', now()
  );
END;
$$ LANGUAGE plpgsql;

-- ─── get_startup_context (BYOD) ──────────────────────────────────────────────
-- Mirrors the managed function above without the api_key_hash predicate.
-- Kept in sync per the precedent set by 20260426015700_fix_invalidate_fact_ambiguous_columns.sql.
CREATE OR REPLACE FUNCTION get_startup_context(num_sessions INTEGER DEFAULT 5)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  ctx JSONB;
  lib JSONB;
  sessions JSONB;
  facts JSONB;
BEGIN
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

  -- Active hot facts (parity with search_memory_hybrid: invalidated_at IS NULL).
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
    ORDER BY confidence DESC, created_at DESC
    LIMIT 50
  ) hot_facts;

  UPDATE extracted_facts
  SET access_count = access_count + 1,
      last_accessed = now()
  WHERE status = 'active'
    AND decay_tier = 'hot'
    AND invalidated_at IS NULL;

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

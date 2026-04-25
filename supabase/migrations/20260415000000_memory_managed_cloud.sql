-- ============================================================
-- UnClick Memory - Managed Cloud Mode
-- ============================================================
-- Multi-tenant memory schema living in UnClick's central Supabase.
-- Every row is tagged with api_key_hash. The MCP server connects with
-- the service role and is responsible for filtering / inserting the
-- correct api_key_hash on every operation.
--
-- This is distinct from the BYOD schema (packages/memory-mcp/schema.sql)
-- which is single-tenant and lives in each user's own Supabase project.
-- BYOD users are unaffected by this migration.
--
-- Tables:
--   mc_business_context, mc_knowledge_library, mc_knowledge_library_history,
--   mc_session_summaries, mc_extracted_facts, mc_conversation_log, mc_code_dumps
--
-- RPCs (all take p_api_key_hash as the first parameter):
--   mc_get_startup_context, mc_search_memory, mc_search_facts,
--   mc_search_library, mc_get_library_doc, mc_list_library,
--   mc_get_conversation_detail, mc_supersede_fact, mc_manage_decay,
--   mc_get_storage_bytes, mc_get_fact_count
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── LAYER 1: Business Context ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mc_business_context (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_hash TEXT NOT NULL,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  priority INTEGER DEFAULT 0,
  access_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMPTZ DEFAULT now(),
  decay_tier TEXT DEFAULT 'hot' CHECK (decay_tier IN ('hot', 'warm', 'cold')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(api_key_hash, category, key)
);

CREATE INDEX IF NOT EXISTS idx_mc_bc_tenant ON mc_business_context(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_mc_bc_decay_tier ON mc_business_context(api_key_hash, decay_tier);

-- ─── LAYER 2: Knowledge Library (versioned) ────────────────────────────────
CREATE TABLE IF NOT EXISTS mc_knowledge_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_hash TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  version INTEGER DEFAULT 1,
  access_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMPTZ DEFAULT now(),
  decay_tier TEXT DEFAULT 'hot' CHECK (decay_tier IN ('hot', 'warm', 'cold')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(api_key_hash, slug)
);

CREATE INDEX IF NOT EXISTS idx_mc_kl_tenant ON mc_knowledge_library(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_mc_kl_tags ON mc_knowledge_library USING GIN(tags);

CREATE TABLE IF NOT EXISTS mc_knowledge_library_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_hash TEXT NOT NULL,
  library_id UUID REFERENCES mc_knowledge_library(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version INTEGER NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mc_klh_tenant ON mc_knowledge_library_history(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_mc_klh_lib ON mc_knowledge_library_history(library_id);

-- Version trigger: archive old content + bump version on update
CREATE OR REPLACE FUNCTION mc_archive_library_version()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.content IS DISTINCT FROM NEW.content THEN
    INSERT INTO mc_knowledge_library_history (api_key_hash, library_id, title, content, version, changed_at)
    VALUES (OLD.api_key_hash, OLD.id, OLD.title, OLD.content, OLD.version, now());
    NEW.version := OLD.version + 1;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mc_archive_library ON mc_knowledge_library;
CREATE TRIGGER trg_mc_archive_library
  BEFORE UPDATE ON mc_knowledge_library
  FOR EACH ROW EXECUTE FUNCTION mc_archive_library_version();

-- ─── LAYER 3: Session Summaries ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mc_session_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_hash TEXT NOT NULL,
  session_id TEXT NOT NULL,
  platform TEXT DEFAULT 'unknown',
  summary TEXT NOT NULL,
  decisions JSONB DEFAULT '[]',
  open_loops JSONB DEFAULT '[]',
  topics TEXT[] DEFAULT '{}',
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mc_ss_tenant ON mc_session_summaries(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_mc_ss_recent ON mc_session_summaries(api_key_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mc_ss_topics ON mc_session_summaries USING GIN(topics);

-- ─── LAYER 4: Extracted Facts ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mc_extracted_facts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_hash TEXT NOT NULL,
  fact TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  confidence REAL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  source_session_id TEXT,
  source_type TEXT DEFAULT 'extraction',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'archived', 'disputed')),
  superseded_by UUID REFERENCES mc_extracted_facts(id),
  access_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMPTZ DEFAULT now(),
  decay_tier TEXT DEFAULT 'hot' CHECK (decay_tier IN ('hot', 'warm', 'cold')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mc_ef_tenant ON mc_extracted_facts(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_mc_ef_active ON mc_extracted_facts(api_key_hash, status, decay_tier);
CREATE INDEX IF NOT EXISTS idx_mc_ef_source ON mc_extracted_facts(api_key_hash, source_session_id);

-- ─── LAYER 5: Conversation Log ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mc_conversation_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_hash TEXT NOT NULL,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  has_code BOOLEAN DEFAULT false,
  tokens_estimated INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mc_cl_tenant ON mc_conversation_log(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_mc_cl_session ON mc_conversation_log(api_key_hash, session_id);
CREATE INDEX IF NOT EXISTS idx_mc_cl_recent ON mc_conversation_log(api_key_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mc_cl_content_fts
  ON mc_conversation_log USING GIN(to_tsvector('english', content));

-- ─── LAYER 6: Code Dumps ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mc_code_dumps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_hash TEXT NOT NULL,
  session_id TEXT NOT NULL,
  conversation_log_id UUID REFERENCES mc_conversation_log(id) ON DELETE SET NULL,
  language TEXT DEFAULT 'unknown',
  filename TEXT,
  content TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mc_cd_tenant ON mc_code_dumps(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_mc_cd_session ON mc_code_dumps(api_key_hash, session_id);

-- ─── Updated_at trigger function ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION mc_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mc_bc_updated ON mc_business_context;
CREATE TRIGGER trg_mc_bc_updated BEFORE UPDATE ON mc_business_context
  FOR EACH ROW EXECUTE FUNCTION mc_update_updated_at();

DROP TRIGGER IF EXISTS trg_mc_ef_updated ON mc_extracted_facts;
CREATE TRIGGER trg_mc_ef_updated BEFORE UPDATE ON mc_extracted_facts
  FOR EACH ROW EXECUTE FUNCTION mc_update_updated_at();

-- ============================================================
-- RPC FUNCTIONS
-- All multi-tenant: api_key_hash is the first parameter.
-- ============================================================

-- ─── mc_get_startup_context ────────────────────────────────────────────────
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

  -- Active hot facts
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
    ORDER BY confidence DESC, created_at DESC
    LIMIT 50
  ) hot_facts;

  UPDATE mc_extracted_facts
  SET access_count = access_count + 1,
      last_accessed = now()
  WHERE api_key_hash = p_api_key_hash
    AND status = 'active'
    AND decay_tier = 'hot';

  RETURN jsonb_build_object(
    'business_context', ctx,
    'knowledge_library_index', lib,
    'recent_sessions', sessions,
    'active_facts', facts,
    'loaded_at', now()
  );
END;
$$ LANGUAGE plpgsql;

-- ─── mc_search_memory ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mc_search_memory(
  p_api_key_hash TEXT,
  p_search_query TEXT,
  p_max_results INTEGER DEFAULT 20
)
RETURNS TABLE(
  id UUID,
  session_id TEXT,
  role TEXT,
  content TEXT,
  created_at TIMESTAMPTZ,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cl.id,
    cl.session_id,
    cl.role,
    cl.content,
    cl.created_at,
    ts_rank(to_tsvector('english', cl.content), plainto_tsquery('english', p_search_query)) AS rank
  FROM mc_conversation_log cl
  WHERE cl.api_key_hash = p_api_key_hash
    AND to_tsvector('english', cl.content) @@ plainto_tsquery('english', p_search_query)
  ORDER BY rank DESC, cl.created_at DESC
  LIMIT p_max_results;
END;
$$ LANGUAGE plpgsql;

-- ─── mc_search_facts ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mc_search_facts(
  p_api_key_hash TEXT,
  p_search_query TEXT,
  p_max_results INTEGER DEFAULT 20
)
RETURNS TABLE(
  id UUID,
  fact TEXT,
  category TEXT,
  confidence REAL,
  status TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT ef.id, ef.fact, ef.category, ef.confidence, ef.status, ef.created_at
  FROM mc_extracted_facts ef
  WHERE ef.api_key_hash = p_api_key_hash
    AND ef.fact ILIKE '%' || p_search_query || '%'
    AND ef.status = 'active'
  ORDER BY ef.confidence DESC, ef.created_at DESC
  LIMIT p_max_results;
END;
$$ LANGUAGE plpgsql;

-- ─── mc_search_library ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mc_search_library(
  p_api_key_hash TEXT,
  p_search_query TEXT,
  p_max_results INTEGER DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  slug TEXT,
  category TEXT,
  tags TEXT[],
  content TEXT,
  version INTEGER,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT kl.id, kl.title, kl.slug, kl.category, kl.tags, kl.content, kl.version, kl.updated_at
  FROM mc_knowledge_library kl
  WHERE kl.api_key_hash = p_api_key_hash
    AND (
      kl.title ILIKE '%' || p_search_query || '%'
      OR kl.content ILIKE '%' || p_search_query || '%'
      OR p_search_query = ANY(kl.tags)
    )
  ORDER BY kl.updated_at DESC
  LIMIT p_max_results;
END;
$$ LANGUAGE plpgsql;

-- ─── mc_get_library_doc ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mc_get_library_doc(
  p_api_key_hash TEXT,
  p_doc_slug TEXT
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  UPDATE mc_knowledge_library
  SET access_count = access_count + 1,
      last_accessed = now()
  WHERE api_key_hash = p_api_key_hash
    AND slug = p_doc_slug;

  SELECT jsonb_build_object(
    'id', kl.id,
    'title', kl.title,
    'slug', kl.slug,
    'category', kl.category,
    'content', kl.content,
    'tags', kl.tags,
    'version', kl.version,
    'created_at', kl.created_at,
    'updated_at', kl.updated_at,
    'history', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('version', h.version, 'changed_at', h.changed_at)
        ORDER BY h.version DESC
      )
      FROM mc_knowledge_library_history h
      WHERE h.library_id = kl.id
    ), '[]'::jsonb)
  )
  INTO result
  FROM mc_knowledge_library kl
  WHERE kl.api_key_hash = p_api_key_hash
    AND kl.slug = p_doc_slug;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ─── mc_list_library ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mc_list_library(p_api_key_hash TEXT)
RETURNS TABLE(
  slug TEXT,
  title TEXT,
  category TEXT,
  tags TEXT[],
  version INTEGER,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT kl.slug, kl.title, kl.category, kl.tags, kl.version, kl.updated_at
  FROM mc_knowledge_library kl
  WHERE kl.api_key_hash = p_api_key_hash
  ORDER BY kl.category, kl.title;
END;
$$ LANGUAGE plpgsql;

-- ─── mc_get_conversation_detail ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mc_get_conversation_detail(
  p_api_key_hash TEXT,
  p_session_id TEXT
)
RETURNS TABLE(
  id UUID,
  role TEXT,
  content TEXT,
  has_code BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT cl.id, cl.role, cl.content, cl.has_code, cl.created_at
  FROM mc_conversation_log cl
  WHERE cl.api_key_hash = p_api_key_hash
    AND cl.session_id = p_session_id
  ORDER BY cl.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- ─── mc_supersede_fact ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mc_supersede_fact(
  p_api_key_hash TEXT,
  p_old_fact_id UUID,
  p_new_fact_text TEXT,
  p_new_category TEXT DEFAULT NULL,
  p_new_confidence REAL DEFAULT 1.0
)
RETURNS UUID AS $$
DECLARE
  new_id UUID;
  old_category TEXT;
BEGIN
  -- Tenant guard: only supersede a fact owned by this tenant.
  SELECT category INTO old_category
  FROM mc_extracted_facts
  WHERE id = p_old_fact_id AND api_key_hash = p_api_key_hash;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fact % not found for tenant', p_old_fact_id;
  END IF;

  IF p_new_category IS NULL THEN
    p_new_category := COALESCE(old_category, 'general');
  END IF;

  INSERT INTO mc_extracted_facts (api_key_hash, fact, category, confidence, source_type)
  VALUES (p_api_key_hash, p_new_fact_text, p_new_category, p_new_confidence, 'manual')
  RETURNING id INTO new_id;

  UPDATE mc_extracted_facts
  SET status = 'superseded',
      superseded_by = new_id,
      updated_at = now()
  WHERE id = p_old_fact_id AND api_key_hash = p_api_key_hash;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- ─── mc_manage_decay (per-tenant; cron will iterate Pro tenants) ──────────
CREATE OR REPLACE FUNCTION mc_manage_decay(p_api_key_hash TEXT)
RETURNS JSONB AS $$
DECLARE
  bc_updated INTEGER := 0;
  kl_updated INTEGER := 0;
  ef_updated INTEGER := 0;
BEGIN
  UPDATE mc_business_context SET decay_tier = 'cold'
  WHERE api_key_hash = p_api_key_hash
    AND decay_tier != 'cold' AND last_accessed < now() - INTERVAL '90 days';
  GET DIAGNOSTICS bc_updated = ROW_COUNT;

  UPDATE mc_business_context SET decay_tier = 'warm'
  WHERE api_key_hash = p_api_key_hash
    AND decay_tier = 'hot' AND last_accessed < now() - INTERVAL '30 days'
    AND last_accessed >= now() - INTERVAL '90 days';

  UPDATE mc_knowledge_library SET decay_tier = 'cold'
  WHERE api_key_hash = p_api_key_hash
    AND decay_tier != 'cold' AND last_accessed < now() - INTERVAL '90 days';
  GET DIAGNOSTICS kl_updated = ROW_COUNT;

  UPDATE mc_knowledge_library SET decay_tier = 'warm'
  WHERE api_key_hash = p_api_key_hash
    AND decay_tier = 'hot' AND last_accessed < now() - INTERVAL '30 days'
    AND last_accessed >= now() - INTERVAL '90 days';

  UPDATE mc_extracted_facts SET decay_tier = 'cold'
  WHERE api_key_hash = p_api_key_hash
    AND status = 'active' AND decay_tier != 'cold' AND last_accessed < now() - INTERVAL '60 days';
  GET DIAGNOSTICS ef_updated = ROW_COUNT;

  UPDATE mc_extracted_facts SET decay_tier = 'warm'
  WHERE api_key_hash = p_api_key_hash
    AND status = 'active' AND decay_tier = 'hot' AND last_accessed < now() - INTERVAL '21 days'
    AND last_accessed >= now() - INTERVAL '60 days';

  RETURN jsonb_build_object(
    'ran_at', now(),
    'business_context_decayed', bc_updated,
    'knowledge_library_decayed', kl_updated,
    'extracted_facts_decayed', ef_updated
  );
END;
$$ LANGUAGE plpgsql;

-- ─── mc_get_storage_bytes (cap enforcement helper) ────────────────────────
-- Approximate per-tenant bytes used. Used by free-tier cap enforcement.
CREATE OR REPLACE FUNCTION mc_get_storage_bytes(p_api_key_hash TEXT)
RETURNS BIGINT AS $$
DECLARE
  total BIGINT := 0;
BEGIN
  SELECT COALESCE(SUM(octet_length(value::text)), 0) INTO total
  FROM mc_business_context WHERE api_key_hash = p_api_key_hash;

  total := total + COALESCE((
    SELECT SUM(octet_length(content) + octet_length(title))
    FROM mc_knowledge_library WHERE api_key_hash = p_api_key_hash
  ), 0);

  total := total + COALESCE((
    SELECT SUM(octet_length(summary))
    FROM mc_session_summaries WHERE api_key_hash = p_api_key_hash
  ), 0);

  total := total + COALESCE((
    SELECT SUM(octet_length(fact))
    FROM mc_extracted_facts WHERE api_key_hash = p_api_key_hash AND status = 'active'
  ), 0);

  total := total + COALESCE((
    SELECT SUM(octet_length(content))
    FROM mc_conversation_log WHERE api_key_hash = p_api_key_hash
  ), 0);

  total := total + COALESCE((
    SELECT SUM(octet_length(content))
    FROM mc_code_dumps WHERE api_key_hash = p_api_key_hash
  ), 0);

  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- ─── mc_get_fact_count (cap enforcement helper) ───────────────────────────
CREATE OR REPLACE FUNCTION mc_get_fact_count(p_api_key_hash TEXT)
RETURNS INTEGER AS $$
DECLARE
  cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM mc_extracted_facts
  WHERE api_key_hash = p_api_key_hash AND status = 'active';
  RETURN cnt;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY
-- The MCP server connects via service role, which bypasses RLS in
-- Supabase. RLS policies below are defense in depth: if these tables
-- are ever exposed to anon/authenticated roles via PostgREST, they
-- are deny-by-default. The backend still must filter by api_key_hash
-- in every query, because service role bypasses RLS entirely.
-- ============================================================
ALTER TABLE mc_business_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_knowledge_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_knowledge_library_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_session_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_extracted_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_conversation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_code_dumps ENABLE ROW LEVEL SECURITY;

-- Service role gets full access (this is also the default in Supabase
-- since service_role bypasses RLS, but the explicit policy makes intent
-- visible).
--
-- Idempotency guard: CREATE POLICY has no IF NOT EXISTS form in Postgres,
-- so a re-run on a database where the policy already exists raises
-- "policy already exists" and aborts the whole migration. This blocked
-- auto-apply for ~20 subsequent migrations. Each policy is wrapped in a
-- pg_policies existence check so re-running is safe.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mc_business_context' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON mc_business_context FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mc_knowledge_library' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON mc_knowledge_library FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mc_knowledge_library_history' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON mc_knowledge_library_history FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mc_session_summaries' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON mc_session_summaries FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mc_extracted_facts' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON mc_extracted_facts FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mc_conversation_log' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON mc_conversation_log FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mc_code_dumps' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON mc_code_dumps FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- No policies for anon / authenticated: deny by default.

-- ============================================================
-- DONE.
-- ============================================================

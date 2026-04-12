-- ============================================================
-- UnClick Cloud Memory Schema v2
-- 6-Layer Persistent Memory Architecture
-- Enhanced with: decay management, extracted facts, access tracking
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- LAYER 1: Business Context (Standing rules, clients, preferences)
-- Always loaded. Tiny footprint. The stuff that never changes.
-- ============================================================
CREATE TABLE IF NOT EXISTS business_context (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  priority INTEGER DEFAULT 0,
  access_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMPTZ DEFAULT now(),
  decay_tier TEXT DEFAULT 'hot' CHECK (decay_tier IN ('hot', 'warm', 'cold')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category, key)
);

CREATE INDEX IF NOT EXISTS idx_bc_category ON business_context(category);
CREATE INDEX IF NOT EXISTS idx_bc_decay_tier ON business_context(decay_tier);
CREATE INDEX IF NOT EXISTS idx_bc_priority ON business_context(priority DESC);

-- ============================================================
-- LAYER 2: Knowledge Library (Versioned reference documents)
-- Vendor profiles, CVs, client briefs, specs.
-- Auto-versioned with full history.
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  version INTEGER DEFAULT 1,
  access_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMPTZ DEFAULT now(),
  decay_tier TEXT DEFAULT 'hot' CHECK (decay_tier IN ('hot', 'warm', 'cold')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kl_category ON knowledge_library(category);
CREATE INDEX IF NOT EXISTS idx_kl_slug ON knowledge_library(slug);
CREATE INDEX IF NOT EXISTS idx_kl_tags ON knowledge_library USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_kl_decay_tier ON knowledge_library(decay_tier);

-- Version history for knowledge library
CREATE TABLE IF NOT EXISTS knowledge_library_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  library_id UUID REFERENCES knowledge_library(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version INTEGER NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_klh_library_id ON knowledge_library_history(library_id);

-- Auto-version trigger: archives old content before updates
CREATE OR REPLACE FUNCTION archive_library_version()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.content IS DISTINCT FROM NEW.content THEN
    INSERT INTO knowledge_library_history (library_id, title, content, version, changed_at)
    VALUES (OLD.id, OLD.title, OLD.content, OLD.version, now());
    NEW.version := OLD.version + 1;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_archive_library ON knowledge_library;
CREATE TRIGGER trg_archive_library
  BEFORE UPDATE ON knowledge_library
  FOR EACH ROW EXECUTE FUNCTION archive_library_version();

-- ============================================================
-- LAYER 3: Session Summaries (What happened, when)
-- One summary per session. New sessions read last N to pick up context.
-- ============================================================
CREATE TABLE IF NOT EXISTS session_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  platform TEXT DEFAULT 'unknown',
  summary TEXT NOT NULL,
  decisions JSONB DEFAULT '[]',
  open_loops JSONB DEFAULT '[]',
  topics TEXT[] DEFAULT '{}',
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ss_created_at ON session_summaries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ss_platform ON session_summaries(platform);
CREATE INDEX IF NOT EXISTS idx_ss_topics ON session_summaries USING GIN(topics);
CREATE INDEX IF NOT EXISTS idx_ss_session_id ON session_summaries(session_id);

-- ============================================================
-- LAYER 4: Extracted Facts (Atomic, searchable knowledge)
-- Nightly extraction distils conversations into individual facts.
-- Facts supersede rather than delete.
-- ============================================================
CREATE TABLE IF NOT EXISTS extracted_facts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fact TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  confidence REAL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  source_session_id TEXT,
  source_type TEXT DEFAULT 'extraction',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'archived', 'disputed')),
  superseded_by UUID REFERENCES extracted_facts(id),
  access_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMPTZ DEFAULT now(),
  decay_tier TEXT DEFAULT 'hot' CHECK (decay_tier IN ('hot', 'warm', 'cold')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ef_status ON extracted_facts(status);
CREATE INDEX IF NOT EXISTS idx_ef_category ON extracted_facts(category);
CREATE INDEX IF NOT EXISTS idx_ef_decay_tier ON extracted_facts(decay_tier);
CREATE INDEX IF NOT EXISTS idx_ef_created_at ON extracted_facts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ef_source_session ON extracted_facts(source_session_id);

-- ============================================================
-- LAYER 5: Conversation Log (Full verbatim, searchable)
-- Every exchange timestamped. Code blocks stored separately.
-- ============================================================
CREATE TABLE IF NOT EXISTS conversation_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  has_code BOOLEAN DEFAULT false,
  tokens_estimated INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cl_session_id ON conversation_log(session_id);
CREATE INDEX IF NOT EXISTS idx_cl_created_at ON conversation_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cl_role ON conversation_log(role);
CREATE INDEX IF NOT EXISTS idx_cl_content_fts ON conversation_log USING GIN(to_tsvector('english', content));

-- ============================================================
-- LAYER 6: Code Dumps (Expandable on demand)
-- Code stored separately. Only loaded when needed.
-- ============================================================
CREATE TABLE IF NOT EXISTS code_dumps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  conversation_log_id UUID REFERENCES conversation_log(id) ON DELETE SET NULL,
  language TEXT DEFAULT 'unknown',
  filename TEXT,
  content TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cd_session_id ON code_dumps(session_id);
CREATE INDEX IF NOT EXISTS idx_cd_language ON code_dumps(language);
CREATE INDEX IF NOT EXISTS idx_cd_filename ON code_dumps(filename);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS trg_bc_updated ON business_context;
CREATE TRIGGER trg_bc_updated BEFORE UPDATE ON business_context
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_ef_updated ON extracted_facts;
CREATE TRIGGER trg_ef_updated BEFORE UPDATE ON extracted_facts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- get_startup_context(num_sessions) - THE KEY FUNCTION
-- Returns business context + library index + recent sessions + active facts
-- Called on every session start
-- ============================================================
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

  -- Active extracted facts (hot tier only for startup, keep it lean)
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
    WHERE status = 'active' AND decay_tier = 'hot'
    ORDER BY confidence DESC, created_at DESC
    LIMIT 50
  ) hot_facts;

  UPDATE extracted_facts
  SET access_count = access_count + 1,
      last_accessed = now()
  WHERE status = 'active' AND decay_tier = 'hot';

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
-- search_memory(query) - Full-text search across conversation logs
-- ============================================================
CREATE OR REPLACE FUNCTION search_memory(search_query TEXT, max_results INTEGER DEFAULT 20)
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
    ts_rank(to_tsvector('english', cl.content), plainto_tsquery('english', search_query)) AS rank
  FROM conversation_log cl
  WHERE to_tsvector('english', cl.content) @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC, cl.created_at DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- search_facts(query) - Search extracted facts
-- ============================================================
CREATE OR REPLACE FUNCTION search_facts(search_query TEXT, max_results INTEGER DEFAULT 20)
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
  SELECT
    ef.id,
    ef.fact,
    ef.category,
    ef.confidence,
    ef.status,
    ef.created_at
  FROM extracted_facts ef
  WHERE ef.fact ILIKE '%' || search_query || '%'
    AND ef.status = 'active'
  ORDER BY ef.confidence DESC, ef.created_at DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- search_library(query) - Search knowledge library
-- ============================================================
CREATE OR REPLACE FUNCTION search_library(search_query TEXT, max_results INTEGER DEFAULT 10)
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
  SELECT
    kl.id,
    kl.title,
    kl.slug,
    kl.category,
    kl.tags,
    kl.content,
    kl.version,
    kl.updated_at
  FROM knowledge_library kl
  WHERE kl.title ILIKE '%' || search_query || '%'
     OR kl.content ILIKE '%' || search_query || '%'
     OR search_query = ANY(kl.tags)
  ORDER BY kl.updated_at DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- get_library_doc(doc_slug) - Get full document + update access tracking
-- ============================================================
CREATE OR REPLACE FUNCTION get_library_doc(doc_slug TEXT)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  UPDATE knowledge_library
  SET access_count = access_count + 1,
      last_accessed = now()
  WHERE slug = doc_slug;

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
        jsonb_build_object(
          'version', h.version,
          'changed_at', h.changed_at
        ) ORDER BY h.version DESC
      )
      FROM knowledge_library_history h
      WHERE h.library_id = kl.id
    ), '[]'::jsonb)
  )
  INTO result
  FROM knowledge_library kl
  WHERE kl.slug = doc_slug;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- list_library() - List all documents in the knowledge library
-- ============================================================
CREATE OR REPLACE FUNCTION list_library()
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
  FROM knowledge_library kl
  ORDER BY kl.category, kl.title;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- get_conversation_detail(sid) - Get full conversation for a session
-- ============================================================
CREATE OR REPLACE FUNCTION get_conversation_detail(sid TEXT)
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
  FROM conversation_log cl
  WHERE cl.session_id = sid
  ORDER BY cl.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- supersede_fact(old_fact_id, new_fact_text) - Replace a fact cleanly
-- ============================================================
CREATE OR REPLACE FUNCTION supersede_fact(
  old_fact_id UUID,
  new_fact_text TEXT,
  new_category TEXT DEFAULT NULL,
  new_confidence REAL DEFAULT 1.0
)
RETURNS UUID AS $$
DECLARE
  new_id UUID;
  old_category TEXT;
BEGIN
  IF new_category IS NULL THEN
    SELECT ef.category INTO old_category FROM extracted_facts ef WHERE ef.id = old_fact_id;
    new_category := COALESCE(old_category, 'general');
  END IF;

  INSERT INTO extracted_facts (fact, category, confidence, source_type)
  VALUES (new_fact_text, new_category, new_confidence, 'manual')
  RETURNING extracted_facts.id INTO new_id;

  UPDATE extracted_facts
  SET status = 'superseded',
      superseded_by = new_id,
      updated_at = now()
  WHERE extracted_facts.id = old_fact_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- manage_decay() - Nightly decay management function
-- Moves items between hot/warm/cold based on access patterns
-- ============================================================
CREATE OR REPLACE FUNCTION manage_decay()
RETURNS JSONB AS $$
DECLARE
  bc_updated INTEGER := 0;
  kl_updated INTEGER := 0;
  ef_updated INTEGER := 0;
  result JSONB;
BEGIN
  -- Business Context decay
  UPDATE business_context SET decay_tier = 'cold'
  WHERE decay_tier != 'cold' AND last_accessed < now() - INTERVAL '90 days';
  GET DIAGNOSTICS bc_updated = ROW_COUNT;

  UPDATE business_context SET decay_tier = 'warm'
  WHERE decay_tier = 'hot' AND last_accessed < now() - INTERVAL '30 days'
    AND last_accessed >= now() - INTERVAL '90 days';
  bc_updated := bc_updated + (SELECT COUNT(*) FROM business_context WHERE decay_tier = 'warm' AND last_accessed < now() - INTERVAL '30 days');

  -- Knowledge Library decay
  UPDATE knowledge_library SET decay_tier = 'cold'
  WHERE decay_tier != 'cold' AND last_accessed < now() - INTERVAL '90 days';
  GET DIAGNOSTICS kl_updated = ROW_COUNT;

  UPDATE knowledge_library SET decay_tier = 'warm'
  WHERE decay_tier = 'hot' AND last_accessed < now() - INTERVAL '30 days'
    AND last_accessed >= now() - INTERVAL '90 days';

  -- Extracted Facts decay
  UPDATE extracted_facts SET decay_tier = 'cold'
  WHERE status = 'active' AND decay_tier != 'cold' AND last_accessed < now() - INTERVAL '60 days';
  GET DIAGNOSTICS ef_updated = ROW_COUNT;

  UPDATE extracted_facts SET decay_tier = 'warm'
  WHERE status = 'active' AND decay_tier = 'hot' AND last_accessed < now() - INTERVAL '21 days'
    AND last_accessed >= now() - INTERVAL '60 days';

  result := jsonb_build_object(
    'ran_at', now(),
    'business_context_decayed', bc_updated,
    'knowledge_library_decayed', kl_updated,
    'extracted_facts_decayed', ef_updated
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE business_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_library_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_dumps ENABLE ROW LEVEL SECURITY;

-- Policies: allow all for authenticated users (single-tenant BYOD)
CREATE POLICY "Users can manage their own business_context" ON business_context
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage their own knowledge_library" ON knowledge_library
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Users can view knowledge_library_history" ON knowledge_library_history
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage their own session_summaries" ON session_summaries
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage their own extracted_facts" ON extracted_facts
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage their own conversation_log" ON conversation_log
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage their own code_dumps" ON code_dumps
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- SEED DATA - Chris's business context
-- ============================================================
INSERT INTO business_context (category, key, value, priority) VALUES
  ('standing_rules', 'communication_style', '"Direct, no fluff. Technical depth welcome. Use analogies for complex concepts. Emoji-light."'::jsonb, 100),
  ('standing_rules', 'decision_framework', '"Bias toward action. Ship fast, iterate. Open source where possible. Ethical always."'::jsonb, 99),
  ('standing_rules', 'tech_preferences', '{"frontend": "React + TypeScript + Vite + Tailwind + Radix UI", "backend": "Cloudflare Workers + Supabase", "deployment": "Vercel (frontend) + Cloudflare (API)", "mcp": true}'::jsonb, 98),
  ('clients', 'primary_project', '{"name": "UnClick", "url": "unclick.world", "description": "The operating system for AI agents. Tools to act, memory to remember, credentials to authenticate, reputation to prove value.", "products": ["Tools (172+ MCP tools)", "Memory (persistent cross-session context)", "BackstagePass (credential vault)", "Arena (AI agent competition)"]}'::jsonb, 95),
  ('infrastructure', 'github', '{"org": "malamutemayhem", "repos": ["unclick-agent-native-endpoints"], "frontend_stack": "React + TS + Vite"}'::jsonb, 80),
  ('infrastructure', 'supabase', '{"project": "xmooqsylqlknuksiddca", "region": "ap-southeast-2", "use": "UnClick backend + Memory BYOD"}'::jsonb, 80),
  ('infrastructure', 'cloudflare', '{"use": "Workers for API/orchestration, DNS"}'::jsonb, 75),
  ('preferences', 'naming', '"Products: UnClick (parent), Memory, BackstagePass, Arena, Tools. Person: Chris. AI assistant persona: Bailey Amarok."'::jsonb, 70),
  ('preferences', 'pricing_model', '{"free": "172+ tools (100/day), Memory (self-hosted direct), BackstagePass (5 creds)", "pro_29": "Unlimited tools, Memory proxy + extraction + decay + dashboard, unlimited BackstagePass, Arena reputation", "team_79": "5 seats, multi-user memory, shared business context, role-based creds"}'::jsonb, 90)
ON CONFLICT (category, key) DO UPDATE SET
  value = EXCLUDED.value,
  priority = EXCLUDED.priority,
  updated_at = now();

-- Seed some initial extracted facts
INSERT INTO extracted_facts (fact, category, confidence, source_type) VALUES
  ('UnClick repo is at github.com/malamutemayhem/unclick-agent-native-endpoints', 'technical', 1.0, 'manual'),
  ('Frontend stack is React + TypeScript + Vite + Tailwind + Radix UI', 'technical', 1.0, 'manual'),
  ('Supabase project ID is xmooqsylqlknuksiddca (ap-southeast-2)', 'technical', 1.0, 'manual'),
  ('Chris prefers direct communication, no fluff, with technical depth', 'preference', 1.0, 'manual'),
  ('UnClick pricing: Free / Pro $29/mo / Team $79/mo', 'financial', 1.0, 'manual'),
  ('Memory product uses BYOD architecture - user data stays in their database', 'technical', 1.0, 'manual'),
  ('Main competitor for Memory is Mem0 at $249/mo', 'financial', 0.9, 'manual'),
  ('Arena uses reputation tiers: Rookie -> Expert -> Master -> Legend', 'technical', 1.0, 'manual'),
  ('Site needs new pages: /memory, /pricing, /tools', 'technical', 1.0, 'manual'),
  ('Claude Code session bridge is a key feature - sessions read startup context and write summaries', 'technical', 1.0, 'manual');

-- ============================================================
-- DONE. Schema ready for UnClick Memory.
-- Run manage_decay() on a nightly cron for tier management.
-- ============================================================

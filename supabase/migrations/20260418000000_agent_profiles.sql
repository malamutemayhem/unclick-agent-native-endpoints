-- Agent profiles: named agents with role, tools, memory scope, activity tracking.
-- Backward compatible: when no agents exist for an api_key_hash, the MCP server
-- falls back to default behaviour (all tools, all memory).

-- Agents (one row per named agent per user)
CREATE TABLE IF NOT EXISTS agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  system_prompt TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(api_key_hash, slug)
);

CREATE INDEX IF NOT EXISTS agents_api_key_hash_idx ON agents(api_key_hash);
CREATE INDEX IF NOT EXISTS agents_default_idx ON agents(api_key_hash) WHERE is_default = true;

-- Agent to tool bindings. connector_id is TEXT to match platform_connectors.id.
-- Empty set for an agent means "all tools" (backward compatible default).
CREATE TABLE IF NOT EXISTS agent_tools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  connector_id TEXT REFERENCES platform_connectors(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, connector_id)
);

CREATE INDEX IF NOT EXISTS agent_tools_agent_id_idx ON agent_tools(agent_id);

-- Agent memory layer scoping. One row per (agent, layer). Layers:
-- business_context, extracted_facts, session_summaries, knowledge_library,
-- conversation_log, code_dumps. Empty set means "all layers" enabled.
CREATE TABLE IF NOT EXISTS agent_memory_scope (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  memory_layer TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, memory_layer)
);

CREATE INDEX IF NOT EXISTS agent_memory_scope_agent_id_idx ON agent_memory_scope(agent_id);

-- Per-agent activity log for usage tracking and the agent card stats.
CREATE TABLE IF NOT EXISTS agent_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_hash TEXT NOT NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  tool_slug TEXT,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_activity_agent_id_idx ON agent_activity(agent_id);
CREATE INDEX IF NOT EXISTS agent_activity_api_key_hash_idx ON agent_activity(api_key_hash);
CREATE INDEX IF NOT EXISTS agent_activity_created_at_idx ON agent_activity(created_at DESC);

-- RLS (mirror existing keychain pattern)
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory_scope ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON agents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON agent_tools FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON agent_memory_scope FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON agent_activity FOR ALL TO service_role USING (true) WITH CHECK (true);

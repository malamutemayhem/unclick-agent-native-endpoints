-- ============================================================
-- UnClick: All New Tables Migration
-- Run this in Supabase SQL Editor (paste the whole thing)
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS)
-- ============================================================

-- 1. Tenant Settings (auto-load config, per-user settings)
CREATE TABLE IF NOT EXISTS tenant_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash text NOT NULL UNIQUE,
  autoload_instructions text,
  autoload_enabled boolean NOT NULL DEFAULT true,
  prompt_enabled boolean NOT NULL DEFAULT true,
  resources_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_settings_hash ON tenant_settings (api_key_hash);

-- 2. Conflict Detections (competing memory tool warnings)
CREATE TABLE IF NOT EXISTS conflict_detections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_hash TEXT NOT NULL,
  conflicting_tool TEXT NOT NULL,
  platform TEXT,
  detected_at TIMESTAMPTZ DEFAULT now(),
  dismissed BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  dismiss_type TEXT CHECK (dismiss_type IN ('temporary', 'permanent'))
);

CREATE INDEX IF NOT EXISTS idx_conflict_detections_hash ON conflict_detections(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_conflict_detections_tool ON conflict_detections(conflicting_tool);

-- 3. Tool Detections (awareness of all MCP tools in user sessions)
CREATE TABLE IF NOT EXISTS tool_detections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_hash TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  tool_category TEXT NOT NULL,
  classification TEXT NOT NULL CHECK (classification IN ('replaceable', 'conflicting', 'compatible')),
  detected_via TEXT DEFAULT 'session',
  last_nudged_at TIMESTAMPTZ,
  nudge_dismissed BOOLEAN DEFAULT false,
  first_detected_at TIMESTAMPTZ DEFAULT now(),
  last_detected_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tool_detections_unique ON tool_detections(api_key_hash, tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_detections_hash ON tool_detections(api_key_hash);

-- 4. Agents (agent profiles with roles, prompts, personalities)
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
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(api_key_hash, slug)
);

-- 5. Agent Tools (which tools each agent can use)
CREATE TABLE IF NOT EXISTS agent_tools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  connector_id TEXT REFERENCES platform_connectors(id),
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, connector_id)
);

-- 6. Agent Memory Scope (which memory layers each agent can access)
CREATE TABLE IF NOT EXISTS agent_memory_scope (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  memory_layer TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, memory_layer)
);

-- 7. Agent Activity (per-agent usage tracking)
CREATE TABLE IF NOT EXISTS agent_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_hash TEXT NOT NULL,
  agent_id UUID REFERENCES agents(id),
  action TEXT NOT NULL,
  tool_slug TEXT,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Done! All 7 tables created.
-- Verify with: SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

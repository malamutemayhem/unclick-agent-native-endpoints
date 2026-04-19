-- Projects hierarchy for UnClick Memory.
--
-- Adds mc_projects so a single tenant (api_key_hash) can partition facts,
-- business context, sessions, and conversation logs into named projects.
-- All child rows use ON DELETE SET NULL so removing a project falls back
-- to org-global scope rather than destroying data. project_id is always
-- nullable; existing rows stay org-global with zero behavior change.

CREATE TABLE IF NOT EXISTS mc_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  repo_url text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (api_key_hash, slug)
);

CREATE INDEX IF NOT EXISTS idx_mc_projects_tenant ON mc_projects (api_key_hash);

ALTER TABLE mc_extracted_facts
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES mc_projects(id) ON DELETE SET NULL;

ALTER TABLE mc_business_context
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES mc_projects(id) ON DELETE SET NULL;

ALTER TABLE mc_session_summaries
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES mc_projects(id) ON DELETE SET NULL;

ALTER TABLE mc_conversation_log
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES mc_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mc_facts_project ON mc_extracted_facts (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mc_context_project ON mc_business_context (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mc_sessions_project ON mc_session_summaries (project_id) WHERE project_id IS NOT NULL;

CREATE OR REPLACE FUNCTION mc_get_default_project(p_api_key_hash text)
RETURNS uuid AS $$
  SELECT id FROM mc_projects
  WHERE api_key_hash = p_api_key_hash AND is_default = true
  LIMIT 1;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION mc_resolve_project(p_api_key_hash text, p_slug text)
RETURNS uuid AS $$
  SELECT id FROM mc_projects
  WHERE api_key_hash = p_api_key_hash AND slug = p_slug
  LIMIT 1;
$$ LANGUAGE sql STABLE;

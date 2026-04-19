-- ============================================================
-- UnClick Skills Library -- chunk 1 (mc_skills table)
-- ============================================================
-- Tenant-scoped skills catalogue. Each row is a reusable skill an
-- agent can load on demand (keyword-triggered or explicit search).
-- Every row is tagged with api_key_hash. Access is via admin
-- functions only; no direct anon/authenticated RLS policies.
--
-- The mc_projects table does not yet exist in this schema, so the
-- project_id column is stored as a plain UUID for now. A follow-up
-- migration will attach the FK (references mc_projects(id) on
-- delete set null) once mc_projects lands.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS mc_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash TEXT NOT NULL,
  project_id UUID,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  trigger_keywords TEXT[] NOT NULL DEFAULT '{}',
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (api_key_hash, name)
);

CREATE INDEX IF NOT EXISTS mc_skills_api_key_hash_idx
  ON mc_skills (api_key_hash);

CREATE INDEX IF NOT EXISTS mc_skills_trigger_keywords_idx
  ON mc_skills USING GIN (trigger_keywords);

CREATE INDEX IF NOT EXISTS mc_skills_project_id_idx
  ON mc_skills (project_id);

-- ─── updated_at trigger ────────────────────────────────────────────────────
-- Reuses mc_update_updated_at() from 20260415000000_memory_managed_cloud.sql.
-- Guarded with a CREATE OR REPLACE fallback in case this migration runs
-- before that one on a fresh DB.
CREATE OR REPLACE FUNCTION mc_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mc_skills_updated ON mc_skills;
CREATE TRIGGER trg_mc_skills_updated
  BEFORE UPDATE ON mc_skills
  FOR EACH ROW EXECUTE FUNCTION mc_update_updated_at();

-- ─── Row Level Security ────────────────────────────────────────────────────
-- Service role bypasses RLS in Supabase, but we add the explicit
-- service_role_all policy for intent + defense in depth. No anon /
-- authenticated policies: deny by default. All user-facing access
-- must go through admin functions (chunk 2).
ALTER TABLE mc_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON mc_skills;
CREATE POLICY "service_role_all" ON mc_skills
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ─── Seed: automate skill ──────────────────────────────────────────────────
-- Seed skipped: no existing api_key_hash seed data for mc_projects is
-- present in this repo (mc_projects table does not yet exist). The
-- automate skill row will be inserted via the admin API in chunk 2,
-- keyed to Bailey's api_key_hash at install time.
--
-- Reference payload (for chunk 2):
--   name:        automate
--   description: Autonomous job execution engine. Orchestrates Claude
--                Code builds from Cowork via research, chunking,
--                delegation, and reporting. Eliminates copy-paste
--                handoffs.
--   keywords:    build, implement, automate, delegate, run this job,
--                send to claude code, execute this brief, make this
--                happen, do this build, ship this, deploy this change
--   metadata:    {"version":"1.0","source":"20260419 Handover",
--                 "installed_by":"Bailey"}

-- ============================================================
-- DONE.
-- ============================================================

-- ============================================================
-- UnClick tenant settings
-- Per-tenant configuration for MCP server behavior. Controls
-- memory auto-load directive, prompt advertising, and resource
-- subscription advertising. Missing rows imply defaults (all on).
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_settings (
  api_key_hash TEXT PRIMARY KEY,
  autoload_enabled BOOLEAN NOT NULL DEFAULT true,
  prompt_enabled BOOLEAN NOT NULL DEFAULT true,
  resources_enabled BOOLEAN NOT NULL DEFAULT true,
  autoload_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

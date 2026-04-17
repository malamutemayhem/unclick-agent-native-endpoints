-- ============================================================
-- UnClick Tenant Settings
-- Per-tenant overrides for MCP server behavior:
--   - custom autoload instructions shown at MCP init
--   - opt-out toggles for the instructions field, prompts, and resources
-- Default behavior (no row present) is: autoload ON, prompts ON, resources ON.
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash TEXT NOT NULL UNIQUE,
  autoload_instructions TEXT,
  autoload_enabled BOOLEAN NOT NULL DEFAULT true,
  prompt_enabled BOOLEAN NOT NULL DEFAULT true,
  resources_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_settings_hash ON tenant_settings (api_key_hash);

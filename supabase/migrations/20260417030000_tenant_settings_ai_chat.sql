-- AI chat columns for tenant_settings.
-- Depends on 20260417000000_tenant_settings.sql (creates the base table).

ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS ai_chat_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_chat_provider text NOT NULL DEFAULT 'google',
  ADD COLUMN IF NOT EXISTS ai_chat_model text NOT NULL DEFAULT 'gemini-2.0-flash',
  ADD COLUMN IF NOT EXISTS ai_chat_api_key_encrypted text,
  ADD COLUMN IF NOT EXISTS ai_chat_system_prompt text,
  ADD COLUMN IF NOT EXISTS ai_chat_max_turns integer NOT NULL DEFAULT 20;

CREATE INDEX IF NOT EXISTS tenant_settings_ai_chat_enabled_idx
  ON tenant_settings (ai_chat_enabled)
  WHERE ai_chat_enabled = true;

-- Orchestrator/admin AI chat should be available by default.
-- The global AI_CHAT_ENABLED env flag still remains the system kill switch.

ALTER TABLE tenant_settings
  ALTER COLUMN ai_chat_enabled SET DEFAULT true;

UPDATE tenant_settings
SET ai_chat_enabled = true,
    updated_at = now()
WHERE ai_chat_enabled = false;

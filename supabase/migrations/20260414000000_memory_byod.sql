-- ============================================================
-- UnClick Memory BYOD (Bring Your Own Database)
-- Stores users' encrypted Supabase credentials + device fingerprints
-- for the least-clicks-possible cloud memory setup wizard.
-- ============================================================

-- Encrypted Supabase credentials per UnClick user
CREATE TABLE IF NOT EXISTS memory_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash TEXT NOT NULL UNIQUE,
  email TEXT,
  supabase_url TEXT NOT NULL,
  -- AES-256-GCM encrypted service role key (same pattern as user_credentials)
  encrypted_service_key TEXT NOT NULL,
  encryption_iv TEXT NOT NULL,
  encryption_tag TEXT NOT NULL,
  encryption_salt TEXT NOT NULL,
  -- Track schema health
  schema_installed BOOLEAN DEFAULT false,
  schema_installed_at TIMESTAMPTZ,
  -- Last successful MCP handshake
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_configs_hash ON memory_configs(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_memory_configs_email ON memory_configs(email);

-- Device fingerprints per UnClick user (detects multi-machine usage to nudge cloud sync)
CREATE TABLE IF NOT EXISTS memory_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash TEXT NOT NULL,
  -- SHA-256 hash of (hostname + platform + arch + home-dir) - no PII
  device_fingerprint TEXT NOT NULL,
  -- Friendly label ("MacBook Pro", "Dev Desktop") - user-editable
  label TEXT,
  platform TEXT,
  storage_mode TEXT NOT NULL CHECK (storage_mode IN ('local', 'cloud')),
  first_seen TIMESTAMPTZ DEFAULT now(),
  last_seen TIMESTAMPTZ DEFAULT now(),
  nudge_dismissed BOOLEAN DEFAULT false,
  UNIQUE(api_key_hash, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_memory_devices_hash ON memory_devices(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_memory_devices_last_seen ON memory_devices(last_seen DESC);

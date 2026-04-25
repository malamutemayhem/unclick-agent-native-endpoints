-- API keys for master key auth
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  user_id UUID,
  label TEXT DEFAULT 'default',
  tier TEXT DEFAULT 'free',
  is_active BOOLEAN DEFAULT true,
  usage_count BIGINT DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform credentials (encrypted)
CREATE TABLE IF NOT EXISTS platform_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key_hash TEXT NOT NULL,
  platform TEXT NOT NULL,
  label TEXT DEFAULT 'default',
  encrypted_value TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  is_valid BOOLEAN DEFAULT true,
  last_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(key_hash, platform, label)
);

-- Platform connector registry
CREATE TABLE IF NOT EXISTS platform_connectors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  auth_type TEXT NOT NULL DEFAULT 'api_key',
  description TEXT,
  setup_url TEXT,
  test_endpoint TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0
);

-- Metering (for future billing)
CREATE TABLE IF NOT EXISTS metering_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key_hash TEXT NOT NULL,
  platform TEXT NOT NULL,
  operation TEXT NOT NULL,
  success BOOLEAN DEFAULT true,
  response_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE metering_events ENABLE ROW LEVEL SECURITY;

-- Service role access for all tables.
--
-- Idempotency guard: CREATE POLICY has no IF NOT EXISTS form in Postgres,
-- so a re-run on a database where the policy already exists raises
-- "policy already exists" and aborts the migration. Wrap each policy in
-- a pg_policies existence check so re-running is safe.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'api_keys' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON api_keys FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'platform_credentials' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON platform_credentials FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'platform_connectors' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON platform_connectors FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'metering_events' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON metering_events FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- Anon can read connectors (public catalog)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'platform_connectors' AND policyname = 'anon_read_connectors'
  ) THEN
    CREATE POLICY "anon_read_connectors" ON platform_connectors FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- Seed the 5 MVP platform connectors
INSERT INTO platform_connectors (id, name, category, auth_type, description, setup_url, test_endpoint, sort_order) VALUES
('github', 'GitHub', 'Developer Tools', 'api_key', 'Repos, issues, PRs, actions, and more', 'https://github.com/settings/tokens', 'https://api.github.com/user', 1),
('supabase', 'Supabase', 'Developer Tools', 'api_key', 'Databases, edge functions, storage, auth', 'https://supabase.com/dashboard/project/_/settings/api', 'https://{project_ref}.supabase.co/rest/v1/', 2),
('vercel', 'Vercel', 'Developer Tools', 'api_key', 'Deploy, domains, env vars, analytics', 'https://vercel.com/account/tokens', 'https://api.vercel.com/v6/projects', 3),
('stripe', 'Stripe', 'Business', 'api_key', 'Payments, subscriptions, invoices, customers', 'https://dashboard.stripe.com/apikeys', 'https://api.stripe.com/v1/balance', 4),
('cloudflare', 'Cloudflare', 'Developer Tools', 'api_key', 'DNS, Workers, Pages, R2, security', 'https://dash.cloudflare.com/profile/api-tokens', 'https://api.cloudflare.com/client/v4/user/tokens/verify', 5);

BEGIN;

ALTER TABLE memory_configs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='memory_configs' AND policyname='memory_configs_service_role_all') THEN
    CREATE POLICY "memory_configs_service_role_all" ON memory_configs FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

ALTER TABLE memory_devices ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='memory_devices' AND policyname='memory_devices_service_role_all') THEN
    CREATE POLICY "memory_devices_service_role_all" ON memory_devices FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS mc_admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash text NOT NULL,
  action text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  performed_at timestamptz DEFAULT now()
);

ALTER TABLE mc_admin_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mc_admin_audit_service_role_all" ON mc_admin_audit FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS mc_admin_audit_api_key_hash_idx ON mc_admin_audit(api_key_hash);
CREATE INDEX IF NOT EXISTS mc_admin_audit_performed_at_idx ON mc_admin_audit(performed_at DESC);

NOTIFY pgrst, 'reload schema';
COMMIT;

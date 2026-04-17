-- ============================================================
-- Build Desk: tasks that can be dispatched to AI coding workers
-- Isolated per UnClick user via api_key_hash.
-- ============================================================

CREATE TABLE IF NOT EXISTS build_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash text NOT NULL,
  title text NOT NULL,
  description text,
  acceptance_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_build_tasks_hash ON build_tasks (api_key_hash, status);
CREATE INDEX IF NOT EXISTS idx_build_tasks_created ON build_tasks (api_key_hash, created_at DESC);

-- Keep updated_at fresh on UPDATE
CREATE OR REPLACE FUNCTION touch_build_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_build_tasks_updated ON build_tasks;
CREATE TRIGGER trg_build_tasks_updated
  BEFORE UPDATE ON build_tasks
  FOR EACH ROW EXECUTE FUNCTION touch_build_tasks_updated_at();

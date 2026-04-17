-- Build Desk tables: the orchestration layer for dispatching
-- work to AI coding workers (Claude Code, Codex, Cursor, etc.)
-- Part of Phase 5: Build Desk Foundation.

-- Build tasks: structured work items with acceptance criteria
CREATE TABLE IF NOT EXISTS build_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  api_key_hash text NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','planned','dispatched','in_progress','review','done','failed')),
  plan_json jsonb DEFAULT '{}',
  acceptance_criteria_json jsonb DEFAULT '[]',
  assigned_worker_id uuid,
  parent_task_id uuid REFERENCES build_tasks(id)
);

CREATE INDEX idx_build_tasks_hash ON build_tasks (api_key_hash, created_at DESC);

-- Build workers: registered AI coding backends
CREATE TABLE IF NOT EXISTS build_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  api_key_hash text NOT NULL,
  name text NOT NULL,
  worker_type text NOT NULL DEFAULT 'claude_code'
    CHECK (worker_type IN ('claude_code','codex','cursor_cli','gemini_cli','custom_mcp')),
  connection_config_json jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'offline'
    CHECK (status IN ('available','busy','offline')),
  last_health_check_at timestamptz
);

CREATE INDEX idx_build_workers_hash ON build_workers (api_key_hash);

-- Build dispatch events: audit trail for every task dispatch
CREATE TABLE IF NOT EXISTS build_dispatch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  api_key_hash text NOT NULL,
  task_id uuid NOT NULL REFERENCES build_tasks(id),
  worker_id uuid NOT NULL REFERENCES build_workers(id),
  event_type text NOT NULL DEFAULT 'dispatched'
    CHECK (event_type IN ('dispatched','accepted','progress','completed','failed')),
  payload_json jsonb DEFAULT '{}'
);

CREATE INDEX idx_build_dispatch_hash ON build_dispatch_events (api_key_hash, created_at DESC);

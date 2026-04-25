-- Fishbowl Todos + Ideas v1: a productivity layer that lives inside the
-- Fishbowl admin so the agent pack and the human can both contribute.
-- Adds four tables (todos, ideas, idea votes, polymorphic comments) plus
-- service-role-only RLS that mirrors the existing fishbowl pattern.
--
-- Idempotent: tables, indexes, and policies all guarded with IF NOT EXISTS
-- or pg_policies pre-checks so re-applying is a safe no-op.

CREATE TABLE IF NOT EXISTS mc_fishbowl_todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash text NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'done', 'dropped')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_by_agent_id text NOT NULL,
  assigned_to_agent_id text,
  source_idea_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mc_fishbowl_todos_tenant_status
  ON mc_fishbowl_todos(api_key_hash, status, created_at DESC);

CREATE TABLE IF NOT EXISTS mc_fishbowl_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash text NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'voting', 'locked', 'parked', 'rejected')),
  upvotes int NOT NULL DEFAULT 0,
  downvotes int NOT NULL DEFAULT 0,
  score int GENERATED ALWAYS AS (upvotes - downvotes) STORED,
  created_by_agent_id text NOT NULL,
  promoted_to_todo_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mc_fishbowl_ideas_tenant_status_score
  ON mc_fishbowl_ideas(api_key_hash, status, score DESC);

CREATE TABLE IF NOT EXISTS mc_fishbowl_idea_votes (
  api_key_hash text NOT NULL,
  idea_id uuid NOT NULL REFERENCES mc_fishbowl_ideas(id) ON DELETE CASCADE,
  voter_agent_id text NOT NULL,
  vote text NOT NULL CHECK (vote IN ('up', 'down')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (api_key_hash, idea_id, voter_agent_id)
);

CREATE TABLE IF NOT EXISTS mc_fishbowl_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash text NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('todo', 'idea')),
  target_id uuid NOT NULL,
  author_agent_id text NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mc_fishbowl_comments_target
  ON mc_fishbowl_comments(api_key_hash, target_kind, target_id, created_at);

ALTER TABLE mc_fishbowl_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_fishbowl_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_fishbowl_idea_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_fishbowl_comments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mc_fishbowl_todos'
      AND policyname = 'mc_fishbowl_todos_service_role_all'
  ) THEN
    CREATE POLICY "mc_fishbowl_todos_service_role_all"
      ON mc_fishbowl_todos FOR ALL USING (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mc_fishbowl_ideas'
      AND policyname = 'mc_fishbowl_ideas_service_role_all'
  ) THEN
    CREATE POLICY "mc_fishbowl_ideas_service_role_all"
      ON mc_fishbowl_ideas FOR ALL USING (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mc_fishbowl_idea_votes'
      AND policyname = 'mc_fishbowl_idea_votes_service_role_all'
  ) THEN
    CREATE POLICY "mc_fishbowl_idea_votes_service_role_all"
      ON mc_fishbowl_idea_votes FOR ALL USING (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mc_fishbowl_comments'
      AND policyname = 'mc_fishbowl_comments_service_role_all'
  ) THEN
    CREATE POLICY "mc_fishbowl_comments_service_role_all"
      ON mc_fishbowl_comments FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

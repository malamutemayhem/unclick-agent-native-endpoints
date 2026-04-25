-- Fishbowl Todos + Ideas v1
-- Adds a productivity layer inside Fishbowl: a Todos kanban (open / in_progress
-- / done / dropped) and an Ideas list with up/down voting. Both surfaces accept
-- comments via a polymorphic comments table keyed by (target_kind, target_id).
-- Humans (admin UI) and AI agents (MCP) write to the same tables; the API
-- layer enforces the human-* anti-spoof check (see fishbowl_post).

-- TODOs ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mc_fishbowl_todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash text NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','dropped')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  created_by_agent_id text NOT NULL,
  assigned_to_agent_id text,
  source_idea_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fishbowl_todos_tenant_status
  ON mc_fishbowl_todos(api_key_hash, status, created_at DESC);

-- IDEAS ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mc_fishbowl_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash text NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','voting','locked','parked','rejected')),
  upvotes integer NOT NULL DEFAULT 0,
  downvotes integer NOT NULL DEFAULT 0,
  created_by_agent_id text NOT NULL,
  promoted_to_todo_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fishbowl_ideas_tenant_status_score
  ON mc_fishbowl_ideas(api_key_hash, status, ((upvotes - downvotes)) DESC);

-- VOTES ----------------------------------------------------------------------
-- One row per (tenant, idea, voter). Re-voting upserts the row. A trigger
-- below recomputes upvotes/downvotes on the parent idea so the columns are
-- always consistent without callers having to do it by hand.
CREATE TABLE IF NOT EXISTS mc_fishbowl_idea_votes (
  api_key_hash text NOT NULL,
  idea_id uuid NOT NULL REFERENCES mc_fishbowl_ideas(id) ON DELETE CASCADE,
  voter_agent_id text NOT NULL,
  vote text NOT NULL CHECK (vote IN ('up','down')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (api_key_hash, idea_id, voter_agent_id)
);

-- COMMENTS (polymorphic on target_kind) --------------------------------------
CREATE TABLE IF NOT EXISTS mc_fishbowl_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash text NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('todo','idea')),
  target_id uuid NOT NULL,
  author_agent_id text NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fishbowl_comments_target
  ON mc_fishbowl_comments(api_key_hash, target_kind, target_id, created_at);

-- Vote score recomputation trigger ------------------------------------------
CREATE OR REPLACE FUNCTION mc_fishbowl_recompute_idea_score()
RETURNS trigger AS $$
DECLARE
  target_idea uuid;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    target_idea := OLD.idea_id;
  ELSE
    target_idea := NEW.idea_id;
  END IF;

  UPDATE mc_fishbowl_ideas
  SET
    upvotes = (
      SELECT COUNT(*)::int FROM mc_fishbowl_idea_votes
      WHERE idea_id = target_idea AND vote = 'up'
    ),
    downvotes = (
      SELECT COUNT(*)::int FROM mc_fishbowl_idea_votes
      WHERE idea_id = target_idea AND vote = 'down'
    ),
    updated_at = now()
  WHERE id = target_idea;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fishbowl_recompute_idea_score ON mc_fishbowl_idea_votes;
CREATE TRIGGER trg_fishbowl_recompute_idea_score
AFTER INSERT OR UPDATE OR DELETE ON mc_fishbowl_idea_votes
FOR EACH ROW EXECUTE FUNCTION mc_fishbowl_recompute_idea_score();

-- Touch updated_at on todo/idea writes --------------------------------------
CREATE OR REPLACE FUNCTION mc_fishbowl_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fishbowl_todos_touch_updated_at ON mc_fishbowl_todos;
CREATE TRIGGER trg_fishbowl_todos_touch_updated_at
BEFORE UPDATE ON mc_fishbowl_todos
FOR EACH ROW EXECUTE FUNCTION mc_fishbowl_touch_updated_at();

DROP TRIGGER IF EXISTS trg_fishbowl_ideas_touch_updated_at ON mc_fishbowl_ideas;
CREATE TRIGGER trg_fishbowl_ideas_touch_updated_at
BEFORE UPDATE ON mc_fishbowl_ideas
FOR EACH ROW EXECUTE FUNCTION mc_fishbowl_touch_updated_at();

-- RLS: service-role-only on all four (matches existing fishbowl pattern) ----
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

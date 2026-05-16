CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS memory_typed_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('fact', 'conversation_turn')),
  source_id TEXT NOT NULL,
  relation TEXT NOT NULL CHECK (relation IN ('authored', 'decided', 'references', 'ships', 'blocks', 'owns', 'relates_to')),
  target_kind TEXT NOT NULL CHECK (target_kind IN ('person', 'todo', 'pr', 'commit', 'file', 'receipt', 'url', 'job', 'tool', 'unknown')),
  target_text TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  evidence_start INTEGER NOT NULL CHECK (evidence_start >= 0),
  evidence_end INTEGER NOT NULL CHECK (evidence_end >= evidence_start),
  evidence_text TEXT NOT NULL,
  redaction_state TEXT NOT NULL DEFAULT 'clean' CHECK (redaction_state IN ('clean', 'blocked_secret_risk')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_typed_links_unique
  ON memory_typed_links(source_kind, source_id, relation, target_kind, target_text);
CREATE INDEX IF NOT EXISTS idx_memory_typed_links_source
  ON memory_typed_links(source_kind, source_id);
CREATE INDEX IF NOT EXISTS idx_memory_typed_links_target
  ON memory_typed_links(target_kind, target_text);

CREATE TABLE IF NOT EXISTS mc_memory_typed_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_hash TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('fact', 'conversation_turn')),
  source_id TEXT NOT NULL,
  relation TEXT NOT NULL CHECK (relation IN ('authored', 'decided', 'references', 'ships', 'blocks', 'owns', 'relates_to')),
  target_kind TEXT NOT NULL CHECK (target_kind IN ('person', 'todo', 'pr', 'commit', 'file', 'receipt', 'url', 'job', 'tool', 'unknown')),
  target_text TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  evidence_start INTEGER NOT NULL CHECK (evidence_start >= 0),
  evidence_end INTEGER NOT NULL CHECK (evidence_end >= evidence_start),
  evidence_text TEXT NOT NULL,
  redaction_state TEXT NOT NULL DEFAULT 'clean' CHECK (redaction_state IN ('clean', 'blocked_secret_risk')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mc_memory_typed_links_unique
  ON mc_memory_typed_links(api_key_hash, source_kind, source_id, relation, target_kind, target_text);
CREATE INDEX IF NOT EXISTS idx_mc_memory_typed_links_source
  ON mc_memory_typed_links(api_key_hash, source_kind, source_id);
CREATE INDEX IF NOT EXISTS idx_mc_memory_typed_links_target
  ON mc_memory_typed_links(api_key_hash, target_kind, target_text);

ALTER TABLE memory_typed_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_memory_typed_links ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE memory_typed_links TO service_role;
GRANT ALL ON TABLE mc_memory_typed_links TO service_role;

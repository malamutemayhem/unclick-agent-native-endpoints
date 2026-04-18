-- ============================================================
-- UnClick Conflict Detection
-- Logs competing-memory-tool detections so the admin panel and
-- the MCP server can throttle warnings and show history.
-- ============================================================

CREATE TABLE IF NOT EXISTS conflict_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash TEXT NOT NULL,
  conflicting_tool TEXT NOT NULL,
  platform TEXT,
  detected_at TIMESTAMPTZ DEFAULT now(),
  dismissed BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  dismiss_type TEXT CHECK (dismiss_type IN ('temporary', 'permanent'))
);

CREATE INDEX IF NOT EXISTS idx_conflict_detections_hash ON conflict_detections(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_conflict_detections_tool ON conflict_detections(conflicting_tool);
CREATE INDEX IF NOT EXISTS idx_conflict_detections_detected_at ON conflict_detections(detected_at DESC);

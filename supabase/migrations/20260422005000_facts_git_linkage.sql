-- Git-linkage columns for mc_extracted_facts
-- Adds optional commit_sha and pr_number so facts with categories
-- "built", "shipped", or "change" can be traced back to a code change.
-- These are pure audit-metadata columns; they do not touch bi-temporal
-- columns (valid_from, valid_to, system_from, system_to) which are
-- reserved for Chunk 2.

ALTER TABLE mc_extracted_facts
  ADD COLUMN IF NOT EXISTS commit_sha text,
  ADD COLUMN IF NOT EXISTS pr_number  integer;

COMMENT ON COLUMN mc_extracted_facts.commit_sha IS
  'Optional Git commit SHA linking this fact to a code change.';
COMMENT ON COLUMN mc_extracted_facts.pr_number IS
  'Optional PR number linking this fact to a code review.';

-- Index for GIT-LINK-001 audit queries
CREATE INDEX IF NOT EXISTS idx_mc_ef_git_link
  ON mc_extracted_facts(api_key_hash, category)
  WHERE commit_sha IS NOT NULL OR pr_number IS NOT NULL;

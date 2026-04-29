-- W2: add startup-context eligibility marker for managed and BYOD facts.
-- This chip only adds/write-enables the marker. Read-time filtering and
-- startup view switches stay in the follow-up R3 chip.

ALTER TABLE IF EXISTS mc_extracted_facts
  ADD COLUMN IF NOT EXISTS startup_fact_kind TEXT NOT NULL DEFAULT 'legacy_unspecified';

ALTER TABLE IF EXISTS extracted_facts
  ADD COLUMN IF NOT EXISTS startup_fact_kind TEXT NOT NULL DEFAULT 'legacy_unspecified';

DO $$
BEGIN
  IF to_regclass('public.mc_extracted_facts') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'mc_extracted_facts_startup_fact_kind_check'
         AND conrelid = 'public.mc_extracted_facts'::regclass
     ) THEN
    ALTER TABLE mc_extracted_facts
      ADD CONSTRAINT mc_extracted_facts_startup_fact_kind_check
      CHECK (startup_fact_kind IN ('durable', 'operational', 'excluded', 'legacy_unspecified'));
  END IF;

  IF to_regclass('public.extracted_facts') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'extracted_facts_startup_fact_kind_check'
         AND conrelid = 'public.extracted_facts'::regclass
     ) THEN
    ALTER TABLE extracted_facts
      ADD CONSTRAINT extracted_facts_startup_fact_kind_check
      CHECK (startup_fact_kind IN ('durable', 'operational', 'excluded', 'legacy_unspecified'));
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.mc_extracted_facts') IS NOT NULL THEN
    COMMENT ON COLUMN mc_extracted_facts.startup_fact_kind IS
      'Startup-context eligibility marker: durable, operational, excluded, or legacy_unspecified.';
  END IF;

  IF to_regclass('public.extracted_facts') IS NOT NULL THEN
    COMMENT ON COLUMN extracted_facts.startup_fact_kind IS
      'Startup-context eligibility marker: durable, operational, excluded, or legacy_unspecified.';
  END IF;
END $$;

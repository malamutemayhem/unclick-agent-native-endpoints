-- Crews: run-snapshot fields for Pass-template reproducibility.
-- Records the template, version, resolved roster, and a config hash on each
-- mc_crew_runs row so UXPass / FlowPass scoring can compare like-for-like runs.
-- Idempotent: ADD COLUMN IF NOT EXISTS per project migration discipline.

alter table mc_crew_runs
  add column if not exists template_key       text,
  add column if not exists template_version   text,
  add column if not exists resolved_agent_ids jsonb,
  add column if not exists config_hash        text;

create index if not exists mc_crew_runs_config_hash on mc_crew_runs(config_hash);

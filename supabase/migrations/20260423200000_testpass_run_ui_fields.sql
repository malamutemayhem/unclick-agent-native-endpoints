-- Phase 9A: add fields needed by the visual run UI

-- Fix recipe: ordered list of remediation steps per check (jsonb array of strings)
alter table testpass_items
  add column if not exists fix_recipe jsonb not null default '[]';

-- Pack name snapshot so the runs list can display it without a join
alter table testpass_runs
  add column if not exists pack_name text not null default '';

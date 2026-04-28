-- Idempotent task IDs for run-creating tools (MCP SEP-1686 pattern).
--
-- Adds an optional, client-generated `task_id` to the three run-creating
-- tables and enforces uniqueness PER ACTOR via a partial unique index. The
-- index is partial so historical rows (where task_id is NULL) do not all
-- collide on a single NULL value. The index is compound (actor + task_id)
-- so that a UUIDv5 collision across two different actors is treated as
-- two distinct rows, not a 23505 leaked across tenants.
--
-- This file lives outside supabase/migrations/ on purpose. The repo's
-- apply-migrations workflow had a 4-day silent failure that PR #229 just
-- unblocked, so this migration is intended to be applied via Supabase
-- MCP `apply_migration` rather than the file-based workflow. After it
-- lands in production, the file may be moved into supabase/migrations/
-- (or deleted) at the maintainer's discretion.

-- ── testpass_runs ───────────────────────────────────────────────────────────
alter table testpass_runs add column if not exists task_id text;
create unique index if not exists testpass_runs_task_id_actor_uniq
  on testpass_runs(actor_user_id, task_id)
  where task_id is not null;

-- ── uxpass_runs ─────────────────────────────────────────────────────────────
alter table uxpass_runs add column if not exists task_id text;
create unique index if not exists uxpass_runs_task_id_actor_uniq
  on uxpass_runs(actor_user_id, task_id)
  where task_id is not null;

-- ── mc_crew_runs ────────────────────────────────────────────────────────────
-- mc_crew_runs is API-key-scoped (api_key_hash) rather than user-scoped, so
-- the compound key uses api_key_hash for the same defense-in-depth purpose.
alter table mc_crew_runs add column if not exists task_id text;
create unique index if not exists mc_crew_runs_task_id_tenant_uniq
  on mc_crew_runs(api_key_hash, task_id)
  where task_id is not null;

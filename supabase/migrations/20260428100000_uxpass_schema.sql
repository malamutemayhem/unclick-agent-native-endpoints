-- UXPass: AI agent UI/UX quality control runner
-- Pack:    a named UXPass pack (URL, viewports, themes, hats, budgets)
-- Run:     an execution of a pack against a target (URL or pack_id)
-- Finding: one issue raised by a hat within a run
-- Evidence: raw captured data (screenshots, axe JSON, lighthouse JSON, etc.)
--
-- Mirrors testpass_* schema (see 20260421040000_testpass_schema.sql) so
-- api/uxpass.ts can lean on the same patterns: pack slug lookup, actor
-- ownership scoping, RLS = auth.uid() at read time, service role for
-- server-side writes. UXPass-specific fields: ux_score, breakdown jsonb
-- (the five headline components), per-finding viewport and theme tags.

create table if not exists uxpass_packs (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  version         text not null default '0.1.0',
  description     text not null default '',
  yaml            jsonb not null default '{}',
  owner_user_id   uuid references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists uxpass_runs (
  id               uuid primary key default gen_random_uuid(),
  pack_id          uuid references uxpass_packs(id) on delete set null,
  target_url       text not null,
  hats             text[] not null default '{}',
  viewports        text[] not null default '{}',
  themes           text[] not null default '{}',
  status           text not null default 'queued' check (status in ('queued','running','complete','failed','budget_exceeded')),
  ux_score         numeric(5,2),
  breakdown        jsonb not null default '{}',
  summary          text,
  started_at       timestamptz not null default now(),
  completed_at     timestamptz,
  actor_user_id    uuid not null references auth.users(id) on delete cascade,
  cost_usd         numeric(10,6) not null default 0,
  tokens_used      integer not null default 0,
  error            text
);

create table if not exists uxpass_evidence (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references uxpass_runs(id) on delete cascade,
  kind        text not null check (kind in ('screenshot','axe_json','lighthouse_json','web_vitals','har','dom_snapshot','a11y_tree','video','llms_txt')),
  hat_id      text,
  viewport    text,
  theme       text,
  payload     jsonb not null default '{}',
  binary_url  text,
  created_at  timestamptz not null default now()
);

create table if not exists uxpass_findings (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null references uxpass_runs(id) on delete cascade,
  hat_id          text not null,
  title           text not null,
  description     text not null default '',
  severity        text not null check (severity in ('critical','high','medium','low')),
  selector        text,
  viewport        text,
  theme           text,
  evidence_ref    uuid references uxpass_evidence(id) on delete set null,
  evidence        jsonb not null default '{}',
  remediation     jsonb not null default '[]',
  cost_usd        numeric(10,6) not null default 0,
  created_at      timestamptz not null default now()
);

-- Indexes for common access patterns
create index if not exists uxpass_runs_actor_idx       on uxpass_runs(actor_user_id);
create index if not exists uxpass_runs_pack_idx        on uxpass_runs(pack_id);
create index if not exists uxpass_runs_status_idx      on uxpass_runs(status);
create index if not exists uxpass_runs_started_idx     on uxpass_runs(started_at desc);
create index if not exists uxpass_findings_run_idx     on uxpass_findings(run_id);
create index if not exists uxpass_findings_hat_idx     on uxpass_findings(hat_id);
create index if not exists uxpass_findings_severity_idx on uxpass_findings(severity);
create index if not exists uxpass_evidence_run_idx     on uxpass_evidence(run_id);
create index if not exists uxpass_packs_owner_idx      on uxpass_packs(owner_user_id);

-- Auto-update updated_at on packs (reuses testpass helper if it exists,
-- otherwise creates a uxpass-specific one. Both are no-op-safe.)
create or replace function uxpass_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists uxpass_packs_updated_at on uxpass_packs;
create trigger uxpass_packs_updated_at
  before update on uxpass_packs
  for each row execute function uxpass_set_updated_at();

-- RLS
alter table uxpass_packs    enable row level security;
alter table uxpass_runs     enable row level security;
alter table uxpass_findings enable row level security;
alter table uxpass_evidence enable row level security;

-- Idempotency guard: CREATE POLICY has no IF NOT EXISTS form in Postgres,
-- so each policy is wrapped in a DO block that checks pg_policies first.
-- Without these guards, re-running this migration errors with 42710.

-- Packs: public readable if no owner (built-in); owner-scoped otherwise
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'uxpass_packs'
      and policyname = 'uxpass_packs_read'
  ) then
    create policy "uxpass_packs_read" on uxpass_packs
      for select using (owner_user_id is null or owner_user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'uxpass_packs'
      and policyname = 'uxpass_packs_insert'
  ) then
    create policy "uxpass_packs_insert" on uxpass_packs
      for insert with check (owner_user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'uxpass_packs'
      and policyname = 'uxpass_packs_update'
  ) then
    create policy "uxpass_packs_update" on uxpass_packs
      for update using (owner_user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'uxpass_packs'
      and policyname = 'uxpass_packs_delete'
  ) then
    create policy "uxpass_packs_delete" on uxpass_packs
      for delete using (owner_user_id = auth.uid());
  end if;
end $$;

-- Runs: actor-scoped
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'uxpass_runs'
      and policyname = 'uxpass_runs_all'
  ) then
    create policy "uxpass_runs_all" on uxpass_runs
      for all using (actor_user_id = auth.uid());
  end if;
end $$;

-- Findings: scoped via run ownership
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'uxpass_findings'
      and policyname = 'uxpass_findings_all'
  ) then
    create policy "uxpass_findings_all" on uxpass_findings
      for all using (
        exists (
          select 1 from uxpass_runs r
          where r.id = uxpass_findings.run_id
            and r.actor_user_id = auth.uid()
        )
      );
  end if;
end $$;

-- Evidence: scoped via run ownership
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'uxpass_evidence'
      and policyname = 'uxpass_evidence_all'
  ) then
    create policy "uxpass_evidence_all" on uxpass_evidence
      for all using (
        exists (
          select 1 from uxpass_runs r
          where r.id = uxpass_evidence.run_id
            and r.actor_user_id = auth.uid()
        )
      );
  end if;
end $$;

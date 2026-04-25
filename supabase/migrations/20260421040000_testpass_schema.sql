-- TestPass: AI agent QA checklist runner
-- Pack: a named, versioned checklist of items (stored as YAML in jsonb)
-- Run:  an execution of a pack against a target (MCP server, URL, etc.)
-- Item: one check result within a run
-- Evidence: raw captured data attached to an item

create table if not exists testpass_packs (
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

create table if not exists testpass_runs (
  id               uuid primary key default gen_random_uuid(),
  pack_id          uuid not null references testpass_packs(id) on delete cascade,
  target           jsonb not null default '{}',
  profile          text not null default 'standard' check (profile in ('smoke','standard','deep')),
  started_at       timestamptz not null default now(),
  completed_at     timestamptz,
  status           text not null default 'running' check (status in ('running','complete','failed','budget_exceeded')),
  verdict_summary  jsonb not null default '{}',
  actor_user_id    uuid not null references auth.users(id) on delete cascade,
  cost_usd         numeric(10,6) not null default 0,
  tokens_used      integer not null default 0
);

create table if not exists testpass_evidence (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('tool_list','snapshot','screenshot','http_trace','log')),
  payload     jsonb not null default '{}',
  binary_url  text,
  created_at  timestamptz not null default now()
);

create table if not exists testpass_items (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null references testpass_runs(id) on delete cascade,
  check_id        text not null,
  title           text not null,
  category        text not null,
  severity        text not null check (severity in ('critical','high','medium','low')),
  verdict         text not null default 'pending' check (verdict in ('check','na','fail','other','pending')),
  on_fail_comment text,
  evidence_ref    uuid references testpass_evidence(id) on delete set null,
  time_ms         integer not null default 0,
  cost_usd        numeric(10,6) not null default 0,
  created_at      timestamptz not null default now()
);

-- Indexes for common access patterns
create index if not exists testpass_runs_actor_idx      on testpass_runs(actor_user_id);
create index if not exists testpass_runs_pack_idx       on testpass_runs(pack_id);
create index if not exists testpass_items_run_idx       on testpass_items(run_id);
create index if not exists testpass_items_verdict_idx   on testpass_items(verdict);
create index if not exists testpass_packs_owner_idx     on testpass_packs(owner_user_id);

-- Auto-update updated_at on packs
create or replace function testpass_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Idempotency guard: Postgres has no IF NOT EXISTS for CREATE TRIGGER, so drop-then-create
-- ensures re-runs of this migration do not error with 42710 "trigger already exists".
drop trigger if exists testpass_packs_updated_at on testpass_packs;
create trigger testpass_packs_updated_at
  before update on testpass_packs
  for each row execute function testpass_set_updated_at();

-- RLS
alter table testpass_packs    enable row level security;
alter table testpass_runs     enable row level security;
alter table testpass_items    enable row level security;
alter table testpass_evidence enable row level security;

-- Idempotency guard: CREATE POLICY has no IF NOT EXISTS form in Postgres,
-- so each policy is wrapped in a DO block that checks pg_policies first.
-- Without these guards, re-running this migration errors with 42710.

-- Packs: public readable if no owner (built-in); owner-scoped otherwise
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'testpass_packs'
      and policyname = 'testpass_packs_read'
  ) then
    create policy "testpass_packs_read" on testpass_packs
      for select using (owner_user_id is null or owner_user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'testpass_packs'
      and policyname = 'testpass_packs_insert'
  ) then
    create policy "testpass_packs_insert" on testpass_packs
      for insert with check (owner_user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'testpass_packs'
      and policyname = 'testpass_packs_update'
  ) then
    create policy "testpass_packs_update" on testpass_packs
      for update using (owner_user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'testpass_packs'
      and policyname = 'testpass_packs_delete'
  ) then
    create policy "testpass_packs_delete" on testpass_packs
      for delete using (owner_user_id = auth.uid());
  end if;
end $$;

-- Runs: actor-scoped
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'testpass_runs'
      and policyname = 'testpass_runs_all'
  ) then
    create policy "testpass_runs_all" on testpass_runs
      for all using (actor_user_id = auth.uid());
  end if;
end $$;

-- Items: scoped via run ownership
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'testpass_items'
      and policyname = 'testpass_items_all'
  ) then
    create policy "testpass_items_all" on testpass_items
      for all using (
        exists (
          select 1 from testpass_runs r
          where r.id = testpass_items.run_id
            and r.actor_user_id = auth.uid()
        )
      );
  end if;
end $$;

-- Evidence: accessible if the related item's run belongs to the user
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'testpass_evidence'
      and policyname = 'testpass_evidence_all'
  ) then
    create policy "testpass_evidence_all" on testpass_evidence
      for all using (
        exists (
          select 1 from testpass_items i
          join testpass_runs r on r.id = i.run_id
          where i.evidence_ref = testpass_evidence.id
            and r.actor_user_id = auth.uid()
        )
      );
  end if;
end $$;

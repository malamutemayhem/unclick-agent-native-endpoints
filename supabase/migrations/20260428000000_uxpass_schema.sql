-- UXPass: AI-driven UI/UX QC for live URLs
-- Run:     an execution of a UXPass pack against a target URL
-- Finding: one verdict from one check within a run

create table if not exists uxpass_runs (
  id              uuid primary key default gen_random_uuid(),
  target          jsonb not null default '{}',
  pack_slug       text not null default 'uxpass-core',
  status          text not null default 'queued' check (status in ('queued','running','complete','failed')),
  ux_score        numeric(5,2),
  summary         jsonb not null default '{}',
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  actor_user_id   uuid not null references auth.users(id) on delete cascade,
  cost_usd        numeric(10,6) not null default 0,
  tokens_used     integer not null default 0
);

create table if not exists uxpass_findings (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid not null references uxpass_runs(id) on delete cascade,
  hat           text not null default 'deterministic',
  check_id      text not null,
  title         text not null,
  category      text not null default 'general',
  severity      text not null check (severity in ('critical','high','medium','low','info')),
  verdict       text not null default 'pending' check (verdict in ('pass','fail','na','pending')),
  evidence      jsonb not null default '{}',
  remediation   text,
  time_ms       integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists uxpass_runs_actor_idx       on uxpass_runs(actor_user_id);
create index if not exists uxpass_runs_status_idx      on uxpass_runs(status);
create index if not exists uxpass_runs_started_idx     on uxpass_runs(started_at desc);
create index if not exists uxpass_findings_run_idx     on uxpass_findings(run_id);
create index if not exists uxpass_findings_verdict_idx on uxpass_findings(verdict);
create index if not exists uxpass_findings_severity_idx on uxpass_findings(severity);

alter table uxpass_runs     enable row level security;
alter table uxpass_findings enable row level security;

-- Idempotency guard: CREATE POLICY has no IF NOT EXISTS in Postgres.
-- Each policy is wrapped in a DO block so re-running this migration is safe.

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

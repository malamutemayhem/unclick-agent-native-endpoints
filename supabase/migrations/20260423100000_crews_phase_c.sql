-- Phase C: Crew run transcript table
-- Idempotent: CREATE TABLE IF NOT EXISTS + conditional policy blocks

create table if not exists mc_run_messages (
  id           uuid primary key default gen_random_uuid(),
  api_key_hash text not null,
  run_id       uuid not null references mc_crew_runs(id) on delete cascade,
  agent_id     uuid references mc_agents(id) on delete set null,
  role         text not null check (role in ('advisor','chairman','user','system')),
  stage        text not null check (stage in ('opinion','peer_review','synthesis')),
  content      text not null default '',
  tokens_in    integer not null default 0,
  tokens_out   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists mc_run_messages_run_id on mc_run_messages(run_id);

alter table mc_run_messages enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'mc_run_messages' and policyname = 'mc_run_messages_service_role'
  ) then
    create policy mc_run_messages_service_role on mc_run_messages
      to service_role using (true) with check (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'mc_run_messages' and policyname = 'mc_run_messages_own_rows'
  ) then
    create policy mc_run_messages_own_rows on mc_run_messages
      for all to authenticated
      using (
        api_key_hash = (current_setting('request.jwt.claims', true)::json->>'api_key_hash')
      )
      with check (
        api_key_hash = (current_setting('request.jwt.claims', true)::json->>'api_key_hash')
      );
  end if;
end $$;

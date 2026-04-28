-- Seed the four starter Crews from src/data/starterCrews.ts.
-- Idempotent: existing tenant/name/template rows are left alone.

with tenant_hashes as (
  select distinct api_key_hash from mc_fishbowl_messages where api_key_hash is not null
  union
  select distinct api_key_hash from mc_extracted_facts where api_key_hash is not null
  union
  select distinct api_key_hash from mc_business_context where api_key_hash is not null
  union
  select distinct api_key_hash from mc_session_summaries where api_key_hash is not null
  union
  select '9940983a9d420f63d298f2bc1b26b9a4018014dbc02d9263016dc64237ab9f1e'::text
),
starter_crews(name, description, template, agent_slugs) as (
  values
    (
      'Business Council',
      'CEO, CFO, CMO, CTO, and Creative Director deliberate your business decision together. Each brings their own lens. The Chairman synthesises.',
      'council',
      array['ceo','cfo','cmo','cto','cco-creative']::text[]
    ),
    (
      'Launch Stress Test',
      'A Contrarian, Security Engineer, Growth Hacker, and Customer Success Manager attack and defend your launch plan. Red attacks, blue defends, white scores.',
      'red_blue',
      array['contrarian','security-engineer','growth-hacker','csm']::text[]
    ),
    (
      'Creative Studio',
      'Creative Director, Copywriter, Art Director, and Brand Strategist collaborate on your brief. Draft, shape, verify, stress-test.',
      'editorial',
      array['creative-director','copywriter','art-director','brand-strategist']::text[]
    ),
    (
      'Decision Desk',
      'First Principles Thinker, Pragmatist, Outsider, Executor, and Chairman reason through your decision from five independent angles.',
      'council',
      array['first-principles','pragmatist','outsider','executor','chairman']::text[]
    )
),
resolved_crews as (
  select
    tenant_hashes.api_key_hash,
    starter_crews.name,
    starter_crews.description,
    starter_crews.template,
    starter_crews.agent_slugs,
    array_agg(mc_agents.id order by array_position(starter_crews.agent_slugs, mc_agents.slug)) as agent_ids,
    count(mc_agents.id) as found_agents
  from tenant_hashes
  cross join starter_crews
  join mc_agents
    on mc_agents.api_key_hash is null
   and mc_agents.slug = any(starter_crews.agent_slugs)
  group by
    tenant_hashes.api_key_hash,
    starter_crews.name,
    starter_crews.description,
    starter_crews.template,
    starter_crews.agent_slugs
)
insert into mc_crews (api_key_hash, name, description, template, agent_ids)
select api_key_hash, name, description, template, agent_ids
from resolved_crews
where found_agents = cardinality(agent_slugs)
  and not exists (
    select 1
    from mc_crews existing
    where existing.api_key_hash = resolved_crews.api_key_hash
      and existing.name = resolved_crews.name
      and existing.template = resolved_crews.template
  );

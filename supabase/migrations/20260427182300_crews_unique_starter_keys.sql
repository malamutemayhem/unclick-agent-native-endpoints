-- Crews: prevent duplicate starter templates per tenant.
-- The runtime list_crews fallback can be hit by simultaneous first loads, so the
-- database owns idempotency for tenant/name/template.

with ranked_crews as (
  select
    id,
    row_number() over (
      partition by api_key_hash, name, template
      order by created_at asc, id asc
    ) as duplicate_rank
  from mc_crews
)
delete from mc_crews
where id in (
  select id
  from ranked_crews
  where duplicate_rank > 1
);

create unique index if not exists mc_crews_tenant_name_template_unique
  on mc_crews(api_key_hash, name, template);

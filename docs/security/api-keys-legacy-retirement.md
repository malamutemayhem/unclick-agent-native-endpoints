# api_keys_legacy Retirement Packet

Prepared: 2026-05-16

Linked job: `9c419db6-7071-4e46-aacc-a822ab0e474f`

This packet scopes the safe retirement of the legacy plaintext `api_keys_legacy`
path. It is intentionally read-only and documentation-only. It does not execute
database changes, print key material, rotate credentials, or change production
configuration.

## Current Evidence

- Jobs room evidence says `api_keys_legacy` still has 3 active plaintext rows.
- Prior comments say anon PostgREST exposure was fixed and the remaining policy
  posture is service-role-only.
- Read-only repo grep on current `origin/main` found no tracked runtime reference
  to `api_keys_legacy`.
- The only tracked match is a Jobs room fixture in
  `scripts/pinballwake-autonomous-runner.test.mjs`, which names this security
  todo for queue routing coverage.
- Out-of-repo callers are still uncertain. Treat that uncertainty as the reason
  for a soft-disable grace window before deletion.

Command used for the tracked reference check:

```sh
rg -n "api_keys_legacy" -- .
```

Observed tracked match:

```text
scripts/pinballwake-autonomous-runner.test.mjs:2021
```

## Hard Stop Conditions

- Do not run `UPDATE`, `DELETE`, `DROP`, migration SQL, or table policy changes
  until Chris explicitly authorizes the production operation.
- Do not print, copy, export, or log plaintext key values.
- Do not use service-role credentials in a shared transcript or PR body.
- Do not rotate credentials as part of this packet unless Chris separately
  authorizes rotation and owns the off-platform follow-up.
- Stop if the live schema does not have a clear soft-disable column such as
  `active`, `disabled_at`, `revoked_at`, or equivalent.

## Owner Authorization Needed

Before any live production mutation, capture an explicit owner approval comment
on the Jobs room todo or Boardroom thread.

Suggested approval wording:

```text
Chris authorizes the soft-disable of active api_keys_legacy rows in production.
Use sanitized counts only, no plaintext values, and keep a rollback window.
```

Without that approval, the correct result is `BLOCKER: owner authorization
missing`.

## Read-Only Preflight

Run these checks from an authorized admin channel that can see production schema
and counts without exposing values.

```sql
-- Schema shape only. Do not select plaintext key columns.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'api_keys_legacy'
order by ordinal_position;
```

```sql
-- Count only. Do not select key values.
select
  count(*) as total_rows,
  count(*) filter (where active is true) as active_rows
from public.api_keys_legacy;
```

If the table uses a different soft-disable field, rewrite the count query to use
that field and record the field name in the proof receipt.

## Authorized Soft-Disable Plan

Run this only after owner approval and after the read-only preflight confirms
the soft-disable field.

```sql
begin;

-- Optional audit write if the production schema has an audit table for this
-- operation. Record counts and reason only, never plaintext values.
-- insert into public.mc_admin_audit (...)
-- values (...);

update public.api_keys_legacy
set
  active = false,
  deactivated_at = now(),
  deactivation_reason = 'legacy plaintext api_keys_legacy retirement'
where active is true;

select
  count(*) as total_rows,
  count(*) filter (where active is true) as active_rows
from public.api_keys_legacy;

commit;
```

If `deactivated_at` or `deactivation_reason` does not exist, do not add columns
inside this live operation. Use the existing approved soft-disable field and
record the limited schema in the proof.

## Grace Window

After soft-disable, watch for at least one agreed grace window before any delete
or drop step. Suggested minimum: 24 hours.

During the grace window, monitor only safe signals:

- application errors that mention the legacy key path by table or route name
- support reports from known internal callers
- counts of active rows, total rows, and newly inserted legacy rows
- audit event ids or admin action ids

Do not monitor by exposing plaintext key values.

## Rollback Plan

If an approved caller breaks during the grace window, re-enable only rows changed
by the authorized retirement action. Use the recorded timestamp or audit id from
the proof receipt.

```sql
begin;

update public.api_keys_legacy
set
  active = true,
  deactivated_at = null,
  deactivation_reason = null
where active is false
  and deactivation_reason = 'legacy plaintext api_keys_legacy retirement'
  and deactivated_at >= :authorized_retirement_started_at;

commit;
```

If the production schema lacks those metadata columns, use the exact rollback
selector captured before the soft-disable. If no safe selector exists, stop
before mutation and ask for a schema-specific owner decision.

## Later Deletion Or Drop

Deletion or table drop is a separate operation after the grace window.

Acceptance for that later step:

- active rows are 0
- no new legacy rows appeared during the grace window
- no approved caller broke after soft-disable
- owner explicitly authorizes the delete or drop step
- rollback limitations are documented before the destructive action

## Proof Receipt Template

Use this shape for the Jobs room comment after the authorized operation.

```text
PASS: api_keys_legacy soft-disable completed after owner authorization;
proof: <audit/admin action id>, total_rows=<count>, active_rows_after=0,
schema_soft_disable_field=<field>, grace_window=<duration>;
next: observe grace window before any delete/drop.
```

If owner authorization is still missing:

```text
BLOCKER: api_keys_legacy live mutation not authorized;
checked: tracked grep shows no runtime repo references, read-only packet prepared;
need: Chris approval for production soft-disable.
```

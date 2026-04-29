# Active Facts Implementation Spec

**Status**: Draft  
**Last updated**: 2026-04-29  
**Depends on**: `docs/memory/active_facts-contract-v1.md`

## Purpose

This document translates the V1 contract into a concrete implementation shape for the SQL-backed startup-context paths.

It covers:

- the write-time marker to add on `mc_extracted_facts` and `extracted_facts`
- the managed and BYOD SQL changes needed to make startup-context parity explicit
- the regression seed shape for startup-context tests
- a migration sequence that preserves existing rows and avoids breakage during rollout

This is intentionally doc-only. It does not change code or migrations by itself.

## Current baseline

The current managed function `mc_get_startup_context` in `supabase/migrations/20260415000000_memory_managed_cloud.sql` and the current BYOD function `get_startup_context` in `packages/memory-mcp/schema.sql` both:

- select active facts directly from the base extracted-facts table
- filter only on `status = 'active'` and `decay_tier = 'hot'`
- rank by `confidence DESC, created_at DESC`
- bump `access_count` and `last_accessed` for the entire hot active pool rather than the surfaced top set

Later provenance work already added `invalidated_at`, `valid_from`, and `valid_to` on both managed and BYOD fact tables. That means the remaining contract gap is primarily startup eligibility and surfaced-set metric behavior.

## Live probe evidence

This spec is now backed by live probe results from `🍿`'s verification batch, not only by repo reading.

### Confirmed gaps

- **W2 confirmed gap**: cron and system self-report rows are not being marked distinctly at write time today
- **R2 confirmed gap**: `load_memory` still returns invalidated facts in the surfaced startup payload
- **R3 confirmed gap**: probe batch measured roughly **33% startup-context pollution**, with near-duplicate cron-style rows occupying slots `5` and `6`
- **R4 partial confirmation**: high-value durable facts still win the very top slot in at least some cases, for example Chris's timezone at `#1`, but cron self-reports still push other real facts down into slots `#7` through `#9`
- **M1 unprobed**: startup metric reinforcement could not be verified from API responses because access metrics are not currently exposed in the relevant surface

### What that means for implementation order

The probe results sharpen the implementation priority:

1. **R2 first**: stop surfacing invalidated facts
2. **R3 second**: stop operational self-report rows from occupying startup slots
3. **R4 third**: improve ranking quality once the invalidation and pollution gates are in place
4. **W2 is a prerequisite for durable R3**: long-term operational-noise filtering is not stable until write-time marking exists
5. **M1 stays verification-only for now**: metric correctness still belongs in the spec, but the first implementation chip should not block on a probe that current API surfaces cannot observe directly

### Practical takeaway

This means the first implementation chip should be framed as a measured bug-fix sequence, not a speculative refactor:

- add the invalidation filter now
- introduce startup eligibility marking
- cut operational noise from the surfaced set
- then tune ranking once the candidate pool is no longer polluted

## Proposed marker shape

### Recommendation

Add a dedicated startup marker column rather than overloading `source_type`.

Managed:

- table: `mc_extracted_facts`
- new column: `startup_fact_kind TEXT`

BYOD:

- table: `extracted_facts`
- new column: `startup_fact_kind TEXT`

### Allowed values

Use a constrained enum-like text domain implemented as a check constraint with these V1 values:

- `durable`
- `operational`
- `excluded`
- `legacy_unspecified`

### Value meaning

- `durable`: normal startup-eligible durable user or standing knowledge
- `operational`: stored fact is valid for search/audit/history, but must not appear in V1 `active_facts`
- `excluded`: explicitly not startup-eligible for non-operational reasons
- `legacy_unspecified`: pre-migration or otherwise unclassified row that still needs safe fallback behavior

### Why this shape

This is the smallest shape that satisfies the contract:

- it separates durable user knowledge from operational self-report at write time
- it generalizes beyond heartbeat-only rows
- it avoids relying on `source_type = 'manual'` as a proxy for startup value
- it gives a non-breaking placeholder for old rows

### Why not only use `source_type`

The contract already notes that `source_type` is too blunt because ordinary writes can share the same value. Reusing it for startup filtering would force string-level policy into a provenance field that already has other meanings.

The recommended rule is:

- keep `source_type` as provenance
- add `startup_fact_kind` as startup-eligibility intent

## Read-time SQL shape

### Design goal

Managed and BYOD should use the same logical pipeline:

1. define a startup-eligible view over extracted facts
2. select the surfaced top-N from that view
3. bump metrics only for the surfaced rows returned in the payload

This keeps the product contract anchored in one reusable filter rather than duplicating ad hoc predicates inside each RPC.

## Managed path changes

### New helper view

Add a helper view for the managed multi-tenant table:

- name: `mc_active_facts_startup_v1`

Recommended semantics:

- source from `mc_extracted_facts`
- require `status = 'active'`
- require `decay_tier = 'hot'`
- require `invalidated_at IS NULL`
- require `valid_to IS NULL OR valid_to > now()`
- require `startup_fact_kind = 'durable'`

Recommended output columns:

- `id`
- `api_key_hash`
- `fact`
- `category`
- `confidence`
- `created_at`
- `startup_fact_kind`

If the implementation prefers a SQL function instead of a view, the same filter contract should still apply. The important part is having one shared read-time definition.

### Changes to `mc_get_startup_context`

Update `mc_get_startup_context` so the active-facts section:

1. reads from `mc_active_facts_startup_v1`
2. scopes by `api_key_hash = p_api_key_hash`
3. orders by `confidence DESC, created_at DESC`
4. limits to the surfaced set size, currently `50`
5. updates access metrics only for the selected row ids

Recommended implementation shape:

- select surfaced fact ids into a CTE or temp result
- build the JSON payload from that surfaced result
- run the metric bump with `WHERE id IN (surfaced ids)`

This directly closes the current bug where all hot active rows get startup metric credit.

### Optional helper for metrics

If the SQL starts getting repetitive, a second helper function is acceptable:

- `mc_touch_startup_facts(p_api_key_hash TEXT, p_fact_ids UUID[])`

That helper should only update the passed ids and must not widen back out to all hot facts for the tenant.

## BYOD path changes

### New helper view

Add the BYOD parity view:

- name: `active_facts_startup_v1`

Recommended semantics match managed, minus tenancy:

- source from `extracted_facts`
- require `status = 'active'`
- require `decay_tier = 'hot'`
- require `invalidated_at IS NULL`
- require `valid_to IS NULL OR valid_to > now()`
- require `startup_fact_kind = 'durable'`

Recommended output columns:

- `id`
- `fact`
- `category`
- `confidence`
- `created_at`
- `startup_fact_kind`

### Changes to `get_startup_context`

Update `get_startup_context` so the active-facts section mirrors managed behavior:

1. select the surfaced rows from `active_facts_startup_v1`
2. keep the existing payload shape of `fact`, `category`, `confidence`, and `created_at`
3. bump `access_count` and `last_accessed` only for surfaced row ids

This preserves V1 payload minimalism while aligning filtering and metric behavior with the managed path.

## Legacy-row behavior

### Startup behavior for old rows

Existing rows will not have the new marker on day one. The migration must therefore preserve reads while preventing silent promotion of obvious operational noise.

Recommended V1 fallback:

- schema default for the new column is `legacy_unspecified`
- startup-context views do not include `legacy_unspecified`
- one-time backfill updates durable-looking historical rows to `durable`
- known cron/system self-report rows are backfilled to `operational`

This is stricter than treating all legacy rows as durable, and it matches the contract statement that rows lacking minimum provenance must not be implicitly treated as durable user facts.

### Practical rollout note

If excluding all `legacy_unspecified` rows at once would create an unacceptable startup-context drop during rollout, use a temporary phase gate:

Phase 1 behavior:

- views allow `startup_fact_kind IN ('durable', 'legacy_unspecified')`
- plus an explicit denylist on clearly operational patterns or provenance

Phase 2 behavior:

- once backfill coverage is acceptable, tighten views to `startup_fact_kind = 'durable'`

This phased option is safer operationally, but the end state should still be durable-only.

### Probe-informed caution

Because live probes already show meaningful pollution and invalidation leakage, a rollout that leaves `legacy_unspecified` broadly startup-visible for too long risks preserving the current bad behavior under a new column name.

So the preferred temporary gate is:

- allow `legacy_unspecified` only behind a narrow fallback window
- explicitly exclude rows that match known operational provenance or known invalidation states
- remove the fallback once backfill coverage is good enough to protect the top startup slots

## Test seed shape

### Required fixture categories

Every managed and BYOD startup-context regression should seed at least these rows:

1. one durable hot fact that should surface
2. one operational hot fact that should not surface
3. one invalidated formerly-hot fact that should not surface
4. one warm durable fact that should not surface in startup V1
5. one active hot durable fact outside the top-N cutoff when the fixture needs metric-trim coverage

### Canonical seed columns

Managed seed rows should populate at least:

- `api_key_hash`
- `fact`
- `category`
- `confidence`
- `source_session_id`
- `source_type`
- `status`
- `decay_tier`
- `startup_fact_kind`
- `created_at`
- `valid_from`
- `valid_to`
- `invalidated_at`
- `access_count`
- `last_accessed`

BYOD uses the same shape without `api_key_hash`.

### Example fixture shape

| label | status | decay_tier | startup_fact_kind | invalidated_at | confidence | expected in active_facts |
| --- | --- | --- | --- | --- | --- | --- |
| durable_profile | active | hot | durable | null | 0.95 | yes |
| cron_heartbeat | active | hot | operational | null | 0.99 | no |
| stale_invalidated | active | hot | durable | non-null | 0.98 | no |
| warm_preference | active | warm | durable | null | 0.97 | no |
| trimmed_extra | active | hot | durable | null | 0.10 | no when above top-N |

### Assertions

Tests should assert all of the following:

- only the durable hot valid row appears in the surfaced set from the seed above
- operational rows are absent even when more recent or higher confidence
- invalidated rows are absent even when still marked `status = 'active'`
- warm rows are absent from V1 startup context
- only surfaced row ids receive any access metric bump
- excluded, invalidated, or trimmed rows show no startup-read metric reinforcement

### Probe-aligned regression expectations

The first regression should explicitly encode the behavior seen in the live probes:

- invalidated rows must disappear completely from surfaced startup facts
- operational near-duplicates must not occupy adjacent top slots
- at least one durable user fact that was previously pushed down by cron noise should move back upward once the filter is active

## Migration plan

### Goals

- do not break existing inserts
- do not break existing startup-context reads during deployment
- allow backfill and enforcement to happen incrementally

### Recommended sequence

1. Add nullable-or-defaulted marker columns on both fact tables.
2. Set default value to `legacy_unspecified`.
3. Add a check constraint for the four allowed values.
4. Patch startup-context reads to exclude invalidated rows immediately.
5. Update write paths so all new fact writes set `startup_fact_kind` explicitly.
6. Backfill existing rows into `durable` or `operational` where provenance is clear.
7. Add the startup helper views.
8. Update startup-context functions to read from the views and bump metrics only for surfaced ids.
9. After backfill confidence is high, tighten the views to durable-only if a temporary phase allowed `legacy_unspecified`.

### Probe-informed priority inside that sequence

If the work needs to split into more than one chip, the recommended order is:

1. invalidation read filter
2. write-time operational marking
3. startup view switch for operational exclusion
4. metric-bump narrowing
5. ranking cleanup

### Non-breaking guarantees

This plan avoids breaking existing rows because:

- old rows remain queryable and searchable regardless of startup classification
- the new column has a safe default
- the payload contract of `active_facts` does not change
- invalidation and temporal columns already exist, so the startup views only consume them

### Backfill guidance

The spec does not require one exact heuristic, but the backfill should prioritize signals already present in the schema or write path, such as:

- known cron/system writer identity
- recognizable operational session ids
- machine-generated provenance fields
- category or content patterns that are already accepted as operational narration

The important invariant is:

- durable must be explicit by the end state
- operational must be explicit for known self-report rows
- unknown legacy rows should not remain permanently ambiguous

## Recommended end-state rules

### Writes

- new durable user facts write `startup_fact_kind = 'durable'`
- cron/system self-report writes `startup_fact_kind = 'operational'`
- intentionally blocked startup rows write `startup_fact_kind = 'excluded'`

### Reads

- startup-context only reads durable, active, hot, still-valid facts
- invalidated or expired facts are filtered before ranking
- operational rows never consume startup slots in V1

### Metrics

- startup access bumps apply only to surfaced fact ids
- candidate-pool rows do not receive startup-context reinforcement

## Open implementation decisions

The contract leaves these as implementation choices, and this spec keeps them open too:

- whether the helper layer is a view, SQL function, or both
- the exact surfaced top-N constant if `50` changes later
- the exact backfill heuristic for identifying historical operational rows
- whether local file-backed paths adopt the same marker name immediately or through a compatibility adapter

## Decision summary

The recommended V1 implementation is:

- add `startup_fact_kind` to managed and BYOD fact tables
- use `durable`, `operational`, `excluded`, and `legacy_unspecified`
- centralize startup eligibility in one helper view per SQL path
- update startup-context RPCs to read only surfaced durable rows
- bump fact metrics only for surfaced row ids
- backfill legacy data incrementally without changing the public payload shape

# Session: Phase 1, Memory Backend Completion

**Date:** 2026-04-15
**Branch:** `claude/phase-1-memory-backend` (cut off `claude/setup-malamute-mayhem-zkquO`)
**Plan:** `docs/UNCLICK_ADMIN_BUILD_PLAN.md` (v2)
**Platform:** Claude Code on the web
**Operator:** Chris Byrne

## TL;DR

Phase 1 work items 1 to 5 landed on the phase branch. Item 6 (npm publish target)
is deferred per Chris's instruction. The branch is ready for review and a manual
verification pass before merging back to `claude/setup-malamute-mayhem-zkquO`.

## Decisions logged this session

1. **Item 6 deferred.** Chris elected to skip the npm publish target decision
   this session. Re-raise next time before any code that touches `packages/`
   layout.
2. **Cap enforcement scoped to managed cloud + free tier only.** BYOD users
   own their database, so caps don't apply to them. Pro tier (or any non-free
   tier) bypasses the check entirely.
3. **Nightly extraction (LLM fact distillation) deferred.** The cron landed
   for decay-only. Extraction needs Chris to pick a model first (see open
   loops).
4. **MCP-tools gap.** The UnClick MCP server was not connected to this
   Claude Code session, so `get_startup_context` and `write_session_summary`
   are not callable as tools. Per Chris's choice, this file replaces the
   missing `write_session_summary` call.

## Work completed

### Item 1: `/api/mcp` api_key validation (`api/mcp.ts`)

Added a `validateApiKey()` helper that:

- Hashes the inbound api_key with sha-256.
- Looks it up in the `api_keys` table.
- Confirms `is_active` is not false.
- Returns `{ api_key_hash, tier, user_id }`.
- Bumps `last_used_at` fire-and-forget.

The handler now rejects unknown or revoked keys with a clear 401 + JSON-RPC
error message before any downstream code runs. On success it injects the
context into per-request env vars (`UNCLICK_API_KEY_HASH`, `UNCLICK_TIER`,
`UNCLICK_USER_ID`) so the memory backend factory can route tenancy without
threading a context object through every function call. This matches the
existing pattern for `UNCLICK_API_KEY`.

The validator no-ops gracefully when `SUPABASE_URL`/`SERVICE_ROLE_KEY` are
unset (preview deploys, local tests). In that case the request is rejected
with the invalid-key error path, which is the safer default.

### Item 2: Managed cloud memory schema migration

New migration: `supabase/migrations/20260415000000_memory_managed_cloud.sql`.

Creates 6-layer memory tables prefixed with `mc_` to keep them distinct from
the single-tenant BYOD schema (`packages/memory-mcp/schema.sql`):

- `mc_business_context`
- `mc_knowledge_library` (+ `mc_knowledge_library_history` + version trigger)
- `mc_session_summaries`
- `mc_extracted_facts` (with self-FK for supersede)
- `mc_conversation_log` (with FTS GIN index)
- `mc_code_dumps`

Every table has `api_key_hash TEXT NOT NULL`, an index on it, and adjusted
unique constraints (e.g., `mc_business_context UNIQUE(api_key_hash, category, key)`).
The `superseded_by` self-FK on `mc_extracted_facts` is kept; tenancy is
enforced in code because Postgres can't express a "FK must share a column
value with parent" check natively.

RPC functions are mc_-prefixed and take `p_api_key_hash` as their first
parameter:

- `mc_get_startup_context`, `mc_search_memory`, `mc_search_facts`,
  `mc_search_library`, `mc_get_library_doc`, `mc_list_library`,
  `mc_get_conversation_detail`, `mc_supersede_fact`, `mc_manage_decay`
- `mc_get_storage_bytes` and `mc_get_fact_count` (helpers for the cap
  enforcement in item 4)

`mc_supersede_fact` includes a tenant guard: it raises if the old fact id
isn't owned by the requesting tenant.

RLS is enabled on every `mc_*` table. The MCP server connects via the
service role and so bypasses RLS, but explicit `service_role_all` policies
make intent visible. There are no policies for `anon` / `authenticated`,
which means deny-by-default if those roles are ever exposed via PostgREST.
**The backend is responsible for filtering by `api_key_hash` in every query.**
Service role bypasses RLS entirely; do not rely on it.

### Item 3: Memory backend factory + `SupabaseBackend` rewrite

Two big shifts:

#### `packages/mcp-server/src/memory/db.ts`

Rewritten precedence order, now matching the v2 plan:

1. Validated `/api/mcp` request (`UNCLICK_API_KEY` + `UNCLICK_API_KEY_HASH` set):
   - **1a.** `memory_configs` row exists (via `fetchByodConfig` ->
     `/api/memory-admin?action=config`): BYOD mode against the user's own
     Supabase. Encryption property preserved (the API endpoint decrypts
     `service_role_key` with PBKDF2 from the api_key the user just sent).
   - **1b.** No `memory_configs` row: managed cloud mode against the central
     Supabase, scoped by `api_key_hash`.
2. Standalone npm with explicit `SUPABASE_URL` env: BYOD-explicit (single
   tenant, original tables).
3. Standalone npm with `UNCLICK_API_KEY` only: try remote BYOD lookup, fall
   through if unconfigured.
4. Local JSON files (zero-config standalone). Not used by `/api/mcp`
   serverless.

The central Supabase env (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) is
captured at module load time, before any request flow can mutate it. This
prevents the previous bug where one tenant's BYOD env-injection could
contaminate the next tenant's request.

The previous singleton `let backend = null` was replaced with a per-tenant
`Map<string, MemoryBackend>` keyed so different api_keys never share a
backend. There is a TODO comment about adding LRU bounds in a later phase
if a single warm Vercel instance ever serves thousands of tenants.

#### `packages/mcp-server/src/memory/supabase.ts`

`SupabaseBackend` now takes `{ url, serviceRoleKey, tenancy }` in its
constructor instead of reading from `process.env`. The tenancy discriminated
union is:

```ts
type Tenancy =
  | { mode: "byod" }
  | { mode: "managed"; apiKeyHash: string };
```

Every method branches on `tenancy.mode`:

- Direct `.from()` queries use a `TableNames` lookup (`BYOD_TABLES` vs
  `MANAGED_TABLES`).
- A `withTenancy()` helper adds `api_key_hash` to insert/upsert rows in
  managed mode.
- A `rpc()` helper takes both the BYOD and managed names + their respective
  param shapes, picks the right one, and prepends `p_api_key_hash` for the
  managed path.
- Reads add `.eq("api_key_hash", apiKeyHash)` filters in managed mode.
- `setBusinessContext` switches the upsert `onConflict` from
  `category,key` (BYOD) to `api_key_hash,category,key` (managed).

Existing BYOD users are unaffected. The single-tenant tables, the original
RPC names, and the original encryption flow all continue to work.

### Item 4: Free-tier cap enforcement

Added to `SupabaseBackend`:

- `FREE_TIER_CAPS = { storage_bytes: 50 MB, facts: 5000 }` (starting values
  from the v2 build plan).
- A `CapExceededError` class. Its message is human-readable and surfaces
  back to the agent verbatim through the existing MCP tool error path.
- A private `enforceCaps(kind: "fact" | "general")` method that:
  - No-ops in BYOD mode.
  - No-ops if `process.env.UNCLICK_TIER` is anything other than `free`.
  - For `kind: "fact"`, calls `mc_get_fact_count` and refuses if at or above
    5000 active facts.
  - Always calls `mc_get_storage_bytes` and refuses if at or above 50 MB.
  - Fails open on counter errors (a transient DB hiccup should not break
    legitimate writes), but logs to stderr.

Wired into all six write methods: `addFact` (with `kind: "fact"`),
`writeSessionSummary`, `logConversation`, `storeCode`, `setBusinessContext`,
`upsertLibraryDoc` (all with `kind: "general"`).

### Item 5: Nightly decay cron

Vercel 12-function cap forced consolidation: I added a `nightly_decay`
action to the existing `api/memory-admin.ts` instead of creating a new
endpoint file.

The action:

- Requires `Authorization: Bearer <CRON_SECRET>` (Vercel cron's standard
  pattern). Refuses to run at all if `CRON_SECRET` is unset, so the endpoint
  is fail-closed.
- Selects all active api_keys with `tier != 'free'`.
- For each, calls `mc_manage_decay(p_api_key_hash)` against the central
  managed-cloud schema.
- Returns a per-tenant result list with success/failure per row.
- Returns an explicit note in the response that **nightly extraction (LLM
  fact distillation from `mc_conversation_log`) is not yet implemented**.

`vercel.json` got a `crons` section pointing at
`/api/memory-admin?action=nightly_decay` on a `0 4 * * *` schedule. **This
requires Vercel Pro plan to actually trigger.** If Chris is still on Hobby,
the schedule will be ignored at deploy time and the action can be invoked
manually (or from a GitHub Actions cron) instead. Flagged in open loops.

### Item 6: deferred per Chris

Skipped this session.

## Files touched

| File | Change |
|---|---|
| `api/mcp.ts` | Added `validateApiKey()` + per-request context injection. |
| `api/memory-admin.ts` | Added `nightly_decay` cron action (extraction flagged). |
| `packages/mcp-server/src/memory/db.ts` | Rewrote factory for managed cloud mode + per-tenant cache. |
| `packages/mcp-server/src/memory/supabase.ts` | Constructor config, tenancy discriminated union, `enforceCaps`, mc_* table/rpc routing. |
| `supabase/migrations/20260415000000_memory_managed_cloud.sql` | NEW. mc_* schema + RPCs + RLS. |
| `vercel.json` | Added `crons` block. |

## Build status

- `cd packages/mcp-server && npm run build` -> green.
- `npx tsc --noEmit api/mcp.ts api/memory-admin.ts` (with @vercel/node
  installed `--no-save` for the type check) -> green.

## Verification still TODO (cannot run from this session)

The acceptance criteria in the build plan call for end-to-end runs against a
real Supabase. None of those have been executed yet because this session has
no Supabase credentials and no deployed environment to point at. Chris (or
the next session with secrets) needs to run:

1. **Migration**: Apply
   `supabase/migrations/20260415000000_memory_managed_cloud.sql` to the
   central Supabase project (`xmooqsylqlknuksiddca`).
2. **Fresh-install path**: `POST /api/mcp` with a valid api_key that has no
   `memory_configs` row, call `add_fact`, call `search_memory`, confirm
   persistence across two consecutive requests.
3. **Invalid-key path**: `POST /api/mcp` with `?key=garbage`, confirm 401 +
   the new error message.
4. **BYOD-preservation**: Seed a `memory_configs` row for a test api_key,
   `POST /api/mcp` with that key, call `add_fact`, confirm the write goes
   to the user's own Supabase (not `mc_extracted_facts` in the central
   project). Confirm the encrypted service_role still requires PBKDF2 from
   the api_key to decrypt.
5. **Cap enforcement**: Force 5001 fact writes for a free-tier test key,
   confirm the 5001st returns `CapExceededError` with the upgrade message.
6. **Cron**: Manually `curl` the nightly_decay endpoint with the
   CRON_SECRET, confirm it iterates all Pro tenants.

If item 1 (migration) does not apply cleanly because of a column or table
collision in the central Supabase, fall back to a separate Postgres schema
namespace (e.g., `unclick_memory.business_context`) and update the
`MANAGED_TABLES` map plus the migration. This was not necessary on
inspection of the existing migrations but is a known fallback.

## Open questions for Chris (raise these before merging)

1. **Npm publish target (deferred this session).** Ship from
   `packages/mcp-server/` as-is, or extract `src/memory/` into a new
   dedicated `@unclick/memory` package? See Phase 1 work item 6 in the
   build plan.
2. **Nightly extraction model.** Which LLM should the cron use to distil
   `mc_conversation_log` rows into facts? Same Claude that powers the
   agent, or a cheaper Haiku tier for cost? This is the "Pro tier" half of
   item 5 that I left unimplemented.
3. **Vercel plan.** The cron block in `vercel.json` requires Vercel Pro to
   actually fire. If Chris is still on Hobby, the schedule is a no-op at
   deploy time, and we need a different scheduler (GitHub Actions cron,
   Supabase pg_cron, or external) for the same `nightly_decay` endpoint.
4. **CRON_SECRET env var.** Needs to be set in Vercel project env before
   the cron action will accept any caller. The action fails closed if the
   var is unset.
5. **Free-tier caps.** Starting at 50 MB / 5000 facts per the build plan.
   Is that comfortable for launch, or does Chris want different numbers?
   They live in `FREE_TIER_CAPS` in `supabase.ts`, easy to tune.
6. **Drift in `api/memory-admin.ts:99`.** The BYOD setup wizard still loads
   schema SQL from `packages/memory-mcp/schema.sql`. That package is
   deprecated but the file is still present, so the loader still works for
   now. This wants a follow-up to either move the schema into
   `packages/mcp-server/` or document `packages/memory-mcp/schema.sql` as
   the canonical BYOD schema artifact even though the rest of that package
   is deprecated. Out of Phase 1 scope.

## Open loops carried forward

- **Verification pass on a real Supabase** (see the 6-step list above).
- **Apply migration `20260415000000_memory_managed_cloud.sql`** to the
  central Supabase before merging the branch.
- **Set `CRON_SECRET` env var** in Vercel before the cron block in
  `vercel.json` will work.
- **Confirm Vercel plan** is Pro before relying on the cron schedule.
- **Implement nightly extraction** (LLM-driven fact distillation) once
  Chris picks a model.
- **Resolve npm publish target** (deferred item 6).
- **Tune free-tier caps** based on real data once there is any.

## Topics for memory tags

`phase-1`, `memory`, `byod`, `managed-cloud`, `supabase`,
`api-key-validation`, `tenancy`, `cap-enforcement`, `vercel-cron`,
`unclick-admin-build-plan`

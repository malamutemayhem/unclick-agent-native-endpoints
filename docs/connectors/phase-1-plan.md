# Connectors Phase 1 Plan

**Status**: Draft
**Last updated**: 2026-04-29
**Owner**: `🦾`
**Purpose**: Define the first implementation slice after Connectors Phase 0

## Goal

Phase 1 ships the first real user-facing Connections surface without attempting a backend rename or vault rewrite.

It should make three things true:

1. operators see `Connections`, not `BackstagePass`, in the main admin story
2. connection state is driven from the existing `platform_connectors` + `user_credentials` substrate
3. proof-of-possession and API key reset consequences are surfaced honestly

This is still an incremental implementation phase.
It is not the final architecture.

## What ships in Phase 1

Phase 1 should ship:

- user-facing copy migration from Keychain or BackstagePass to Connections
- a clearer connection status model on top of existing `user_credentials` state
- catalog and setup metadata that lets the UI explain how a connector is configured
- consistent admin entry points for browsing, testing, reconnecting, and managing credentials
- a single product story across frontend, admin API, and MCP-adjacent connector metadata

Phase 1 should not ship:

- a route rename away from `/admin/keychain`
- an `/api/backstagepass` endpoint rename
- a crypto redesign
- team/shared vault semantics
- full OAuth broker orchestration for every provider
- connector auto-refresh or automatic token rotation

## Product outcome

At the end of Phase 1, an operator should be able to:

1. open `Connections` from admin navigation
2. understand which third-party services are available
3. see whether each service is connected, broken, or needs reconnection
4. complete API key or bot token setup from the Connections surface
5. understand when an API key reset invalidates saved credentials

## Existing source of truth to preserve

Phase 1 should continue to treat:

- `platform_connectors` as the connector catalog layer
- `user_credentials` as the live secret and connection-state substrate
- `backstagepass_audit` as the sensitive action audit log
- `api/backstagepass.ts` as the proof-of-possession admin API

Phase 1 may improve naming and metadata around these layers, but should not fork them into a second competing source of truth.

## Files that should change

### Frontend admin surfaces

These are the Phase 1 user-facing copy and UX surfaces:

- `src/pages/admin/AdminShell.tsx`
- `src/pages/admin/AdminKeychain.tsx`
- `src/pages/admin/AdminTools.tsx`
- `src/pages/admin/tools/ConnectedServices.tsx`
- `src/pages/admin/AdminYou.tsx`

Expected changes:

- rename visible nav and headings to `Connections`
- update helper copy using the migration plan wording
- surface status labels that match the Phase 0 spec
- make reissue warning speak in connection lifecycle language

### Frontend connector metadata

- `src/lib/connectors.ts`

Expected changes:

- extend connector metadata beyond `authType` alone
- add setup-oriented fields that the UI can render honestly
- keep browser-safe shape aligned with server registry

Recommended additive fields:

- `setupFlow`: `oauth_redirect` | `manual_token` | `manual_api_key` | `hybrid`
- `supportsConnectionTest`: boolean
- `capabilitySummary`: short operator-facing text
- optional `docsUrl` normalization if currently uneven

RotatePass consumes only safe metadata from this layer. Use
`docs/rotatepass-connector-metadata.md` for owner hints, used-by tags,
probe kinds, evidence sources, rotation dates, and redaction boundaries.

### MCP and server connector registry

- `packages/mcp-server/src/connectors/index.ts`
- per-connector config files under `packages/mcp-server/src/connectors/*`

Expected changes:

- keep the registry structurally aligned with the frontend connector metadata
- add the same setup-flow semantics so admin UI and MCP do not drift
- avoid expanding auth promises beyond what the current broker can really do

### Admin APIs

- `api/backstagepass.ts`
- `api/credentials.ts`
- `api/oauth-callback.ts`
- `api/memory-admin.ts`

Expected changes:

#### `api/backstagepass.ts`

- keep endpoint name for now
- return or derive status information in the Phase 1 connection vocabulary
- make `testConnection` support visible in metadata
- keep proof-of-possession boundary intact for reveal, values update, export, and delete

#### `api/credentials.ts`

- align credential-upsert behavior with the Connections story
- stay as the manual credential write path for API key and bot token connectors
- do not become a parallel connection-state system

#### `api/oauth-callback.ts`

- ensure OAuth-backed connectors that are already partially supported can write into `user_credentials` consistently
- keep honest distinction between “OAuth-capable in theory” and “fully redirect-wired in Phase 1”

#### `api/memory-admin.ts`

- continue powering `admin_tools` and related admin read surfaces
- update any response shaping needed so Connections cards can render catalog + credential state consistently

## Database and migration work

Phase 1 should prefer additive migrations over table replacement.

### 1. `platform_connectors` metadata expansion

Current repo reality already stores:

- `id`
- `name`
- `category`
- `auth_type`
- `description`
- `setup_url`
- `test_endpoint`
- `sort_order`

Phase 1 should add enough metadata to tell the truth about setup:

- `setup_flow` text
- `docs_url` text if not already present in DB
- `capability_summary` text
- `supports_connection_test` boolean default false

Why:

- `auth_type` alone is not enough to explain the real operator path
- many connectors are effectively manual even if the long-term direction is OAuth

### 2. `user_credentials` connection-state expansion

Current repo already has:

- `is_valid`
- `last_tested_at`
- `last_used_at`
- `last_rotated_at`
- `expires_at`

Phase 1 should add only the fields needed to support honest user-facing states:

- `setup_completed_at` timestamptz nullable
- `status_reason` text nullable
- `connected_via` text nullable, for example `oauth_redirect`, `manual_api_key`, `manual_token`

Why:

- `is_valid` alone cannot distinguish broken, incomplete, and reconnect-required states
- the UI needs to explain why a row is not healthy without overloading one boolean

### 3. No table split

Phase 1 should not create a new `connections` table unless a later phase proves it necessary.

The existing `user_credentials` table is already the live encrypted substrate and should stay the operational source of truth for this slice.

## Status model to ship

Phase 1 should render the following states:

- `Not connected`
- `Connected`
- `Needs reconnection`
- `Connection error`
- `Setup incomplete`

Recommended initial mapping:

- no row in `user_credentials` -> `Not connected`
- row exists, `is_valid = true`, not expired, setup complete -> `Connected`
- row exists, expired or invalidated by lifecycle reset -> `Needs reconnection`
- row exists, `is_valid = false`, `status_reason` present -> `Connection error`
- row exists, missing setup completion or required fields -> `Setup incomplete`

## UI surfaces to ship

### Admin navigation

Change:

- `AdminShell.tsx` nav label to `Connections`

Do not change yet:

- route path `/admin/keychain`
- component symbol `AdminKeychain`

### Connections page

Primary file:

- `src/pages/admin/AdminKeychain.tsx`

Phase 1 additions:

- new page heading and helper copy from the migration plan
- clearer grouping between catalog browsing and saved credentials
- setup-flow-aware CTAs
- visible health/status pills based on the new mapping
- reconnect wording where credentials have expired or gone invalid

### Tools page

Primary files:

- `src/pages/admin/AdminTools.tsx`
- `src/pages/admin/tools/ConnectedServices.tsx`

Phase 1 additions:

- `Connections` naming parity
- empty state that explains setup honestly
- cards that show connection state, not just valid versus invalid

### Identity page

Primary file:

- `src/pages/admin/AdminYou.tsx`

Phase 1 additions:

- API key reset warning rewritten in connection lifecycle language
- explicit note that saved Connections credentials may need re-save after key reset

## API behavior to preserve

Phase 1 must preserve these guardrails:

- session JWT required for admin access
- proof-of-possession for decrypt, rotate-values, export, and delete flows
- no plaintext credential material in audit rows
- no hidden claim that API key reset keeps credentials readable

## Test and verification plan

Phase 1 should include:

### Unit or integration coverage

- connector registry shape parity between frontend and server
- status mapping from `user_credentials` row state to UI label
- proof-of-possession flows still reject mismatched keys

### UI verification

- admin nav shows `Connections`
- Connections page copy reflects the migration plan
- Tools page empty state says `Go to Connections`
- API key reissue warning reflects re-save requirement

### Manual smoke

1. create one manual API key connection
2. create one bot-token connection
3. verify they appear as `Connected`
4. force one failed test and verify `Connection error`
5. rotate or invalidate one key and verify `Needs reconnection`

## Recommended rollout order

### Step 1

Ship schema additions for `platform_connectors` and `user_credentials`.

### Step 2

Update admin APIs to emit or derive the new setup and status semantics.

### Step 3

Update frontend admin surfaces to use `Connections` language and new status mapping.

### Step 4

Run a manual smoke across one API key, one bot token, and one partial or broken setup.

## Non-goals to defend

Avoid these in Phase 1:

- renaming every legacy `backstagepass` symbol
- introducing a second connection-state table
- claiming all OAuth connectors are fully redirect-complete
- broadening proof-of-possession exemptions for convenience

## Deliverable summary

If Phase 1 lands cleanly, the product story becomes:

- `Connections` is what the operator sees
- `platform_connectors` describes what can be connected
- `user_credentials` stores what is connected
- `backstagepass_audit` records what sensitive actions happened
- `/api/backstagepass` remains the secure admin substrate until a later rename phase

That is enough to make Connectors feel like a product, not just a vault wrapper.

# Connectors Phase 0

**Status**: Draft  
**Last updated**: 2026-04-29  
**Owner**: `🦾`

## Purpose

Phase 0 locks the product and architecture contract for Connectors so later UI and implementation work stops drifting between:

- connector catalog
- live tenant connection state
- encrypted secret storage
- legacy BackstagePass language

This is a doc-first phase.
It does not replace the vault, introduce server-side inference, or redesign provider integrations.

## Architecture lock

Phase 0 assumes the current platform direction:

- the user's chat model does the cognition
- UnClick owns orchestration, prompts, schemas, memory boundaries, audit trail, and connection state
- Connectors are a platform capability, not an LLM capability
- no server-side model routing is added for connector setup in v1

## Noun lock

Phase 0 locks four terms:

- **Connector**: the static platform definition for a service integration such as Slack, Xero, Shopify, or Figma
- **Connection**: a tenant's live configured relationship to one connector
- **Credential**: the secret material or OAuth token set that powers a connection
- **BackstagePass**: the encrypted storage and audit subsystem behind the scenes, not the primary user-facing noun

User-facing surfaces should prefer:

- Connections
- Connect a service
- Reconnect
- Connection health

BackstagePass can stay visible as an advanced or legacy surface during transition, but it should not be the main product story.

## Current repo reality

The repo already has most of the building blocks, but not one coherent contract:

- frontend connector registry in `src/lib/connectors.ts`
- MCP/server connector registry in `packages/mcp-server/src/connectors/index.ts`
- connector catalog data in `platform_connectors`
- encrypted credential storage in `user_credentials`
- connection-adjacent admin UI in `src/pages/admin/tools/ConnectedServices.tsx`
- vault API and audit writes in `api/backstagepass.ts`

Today those surfaces drift in wording, source-of-truth assumptions, and auth/setup behavior.
Phase 0 exists to stop that drift before a larger Connections or Plugboard surface lands.

## In-scope decisions

### 1. Product boundary

The user-facing story is:

- browse available connectors
- see what is connected
- see whether a connection is healthy
- reconnect, remove, or finish setup
- understand what capability a connection unlocks

The user should not need to think about salts, IVs, auth tags, or vault internals unless they intentionally open an advanced surface.

### 2. Connector definition versus connection state

Phase 0 separates:

- **public connector metadata**
- **tenant-scoped connection metadata**
- **secret credential material**

These must not be blurred together in UI or API shape.

Minimum distinction:

- connector catalog can be public or metadata-only
- connection rows must always be tenant-scoped by `api_key_hash`
- plaintext secret access must stay behind explicit sensitive flows

### 3. Source of truth

Phase 0 locks these current truths:

- `platform_connectors` is the connector catalog surface
- `user_credentials` is the live secret substrate for connection state
- `platform_credentials` is legacy or compatibility-only and should not become the primary live connection store

The product may still have duplicated connector definitions during Phase 0, but the contract should assume the system is moving toward one canonical connector definition source that generates or feeds the others.

## Auth and permission boundaries

Phase 0 locks three auth surfaces:

### Browser session JWT

Used for signed-in admin and operator flows.

Appropriate for:

- browsing connector catalog
- listing connection metadata
- viewing status
- editing non-secret metadata

### Agent or MCP API-key bearer

Used by agent clients through `UNCLICK_API_KEY` or bearer auth.

Appropriate for:

- tenant-scoped agent operations
- MCP tool access
- connection-aware tooling that never exposes plaintext secrets to the browser

### Proof-of-possession

Sensitive connection actions require dual proof:

- signed-in session context
- plaintext UnClick API key

Phase 0 should treat the following as proof-of-possession actions:

- reveal secret values
- add credential values
- rotate or replace credential values
- validate or test live credentials
- export credential material
- remove a live connection

This is stricter than some current legacy behavior, but it is the cleaner Phase 0 security boundary.

## Auth type versus setup flow

Phase 0 explicitly separates:

- `auth_type`
- `setup_flow`

Current `auth_type` values in code are:

- `oauth2`
- `api_key`
- `bot_token`

That is not enough on its own.

An `oauth2` connector must also declare whether Phase 0 supports:

- real OAuth redirect and token exchange
- manual token paste only
- hybrid or partial setup

This matters because several connectors are labeled `oauth2` while the real operator experience is still closer to manual token entry.

## Storage and encryption contract

Phase 0 preserves the current storage model.

### Credential substrate

The real secret store remains `user_credentials`.

Minimum row shape Phase 0 assumes:

- `api_key_hash`
- `platform_slug`
- nullable `label`
- `encrypted_data`
- `encryption_iv`
- `encryption_tag`
- `encryption_salt`
- `expires_at`
- `is_valid`
- `last_tested_at`
- `last_used_at`
- `last_rotated_at`
- timestamps

Connection views derive from this substrate plus catalog metadata.

### Encryption stance

Credential material remains:

- encrypted per row
- AES-256-GCM at rest
- derived from the user's plaintext UnClick API key via PBKDF2
- unique salt and IV per row
- no server-side master decryption key

Phase 0 does not introduce:

- KMS migration
- shared team vaults
- plaintext-at-rest mode

### API key rotation rule

Current repo behavior means resetting the UnClick API key makes existing credentials unreadable until re-saved.

Phase 0 locks the honest rule:

- **API key reset invalidates existing live connections unless or until a future re-wrap path exists**

That means the product must surface reset as a connection lifecycle event, not pretend the old connections remain healthy.

## Audit contract

Phase 0 preserves append-only audit semantics.

At minimum, sensitive connection actions should produce an audit row with:

- `actor_user_id`
- `api_key_hash`
- `credential_id`
- `platform_slug`
- nullable `label`
- `action`
- `success`
- `metadata`
- `created_at`

Audit metadata must never contain plaintext secret values.

Phase 0 also calls out the current split:

- `api/backstagepass.ts` is the audited admin surface
- legacy `/api/credentials` uses the same crypto model but does not currently provide the same audit behavior

Phase 0 should not create a second divergent secret contract.
Any broader audit unification is later work.

## Connection status model

Phase 0 keeps the user-facing status model intentionally small:

- **Not connected**
- **Connected**
- **Needs reconnection**
- **Connection error**
- **Setup incomplete**

Recommended mapping:

| Status | Meaning |
| --- | --- |
| `Not connected` | No usable credential row exists for this tenant and connector |
| `Connected` | Credential exists, latest validation is healthy, and expiry or scope state is acceptable |
| `Needs reconnection` | Credential exists but has expired, lost required scopes, or was invalidated by lifecycle changes such as API-key reset |
| `Connection error` | Validation or usage failed for a reason not yet resolved by simple reconnect |
| `Setup incomplete` | The connector has been started but required fields or setup steps are missing |

Important honesty note:

The current repo does not fully encode every one of these states yet.
In particular, `Needs reconnection` and `Setup incomplete` need either explicit state mapping rules or extra persisted fields beyond today's simple `is_valid` and timestamp set.

That gap should be treated as implementation work, not hidden by the spec.

## Capability unlock contract

A connection is valuable because it unlocks actions.

Every connector surface should leave room for:

- a short "what this unlocks" summary
- a future "used by these tools" mapping

Phase 0 does not require a full dependency graph yet.
It only locks the expectation that connections are described in capability language, not vault language.

## Out of scope

Phase 0 does not include:

- replacing BackstagePass crypto
- KMS adoption
- automatic credential rotation
- provider token refresh orchestration
- outbound API call brokering
- shared team vaults
- a full marketplace app model
- a full rename of every legacy BackstagePass symbol
- server-side inference for connection help

## Immediate implementation follow-up

After this spec is accepted, the next implementation slice should:

1. move the user-facing narrative from Keychain or BackstagePass to Connections
2. reuse `user_credentials` as the live connection substrate
3. keep `platform_connectors` as the catalog layer
4. make proof-of-possession boundaries explicit in the UI and API contract
5. expose connection state honestly, including reconnect and invalidation cases

## Summary

Phase 0 locks this direction:

- **Connections** is the user-facing product concept
- **Connector** is the static definition
- **BackstagePass** remains the encrypted credential substrate
- **user_credentials** remains the live secret store
- **api_key_hash** remains the tenant boundary
- sensitive actions use **proof-of-possession**
- API key reset is a **connection lifecycle event**, not a hidden internal detail

That is enough to keep later UI, MCP, and storage work moving in one direction.

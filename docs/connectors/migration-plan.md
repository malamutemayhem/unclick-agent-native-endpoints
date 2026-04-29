# BackstagePass to Connections Migration Plan

**Status**: Audit complete (Phase 0 baseline)  
**Last updated**: 2026-04-29  
**Owner**: `🦾`

**Implementation note**: This document is a baseline audit captured before the full rename landed on `main`.
Some user-facing copy changes identified here have already shipped, so this file should be read as migration grounding and wording history, not as a fresh unblock list.

## Goal

Audit every relevant `src/pages/admin/*` mention tied to the BackstagePass to Connections product-language migration, and separate:

- copy that should change for operators
- technical implementation terminology that should stay technical

This document is intentionally limited to admin-surface wording.
No code changes are included here.

## Naming rule

Use this split consistently:

- `Connections` for the user-facing surface
- `Connected services` for the catalog of available service integrations
- `Connect a service` / `Reconnect` for user actions
- `Credentials` for the stored secret material when user-facing copy needs precision
- `connector` for internal platform definitions, IDs, and tool wiring
- `BackstagePass` only when the storage subsystem itself is the subject

## Audit result

I verified all `BackstagePass`, `Keychain`, and adjacent `connector` / `connection` mentions under `src/pages/admin`.

There are **6 user-facing copy changes** to make for Phase 0, plus **1 optional developer-comment cleanup**.

## User-facing copy to change

### 1. Admin nav label

**File + line**

`src/pages/admin/AdminShell.tsx:246`

**Current**

`Keychain (BackstagePass)`

**Why this changes**

This is the primary admin navigation label, so it should lead with the operator task, not the storage subsystem.

**Recommended replacement**

`Connections`

### 2. Admin page title

**File + line**

`src/pages/admin/AdminKeychain.tsx:507`

**Current**

`BackstagePass`

**Why this changes**

This is the main page heading for `/admin/keychain`, so it currently presents the vault as the product surface.

**Recommended replacement**

`Connections`

### 3. Admin page supporting copy

**File + lines**

`src/pages/admin/AdminKeychain.tsx:508-509`

**Current**

`Your encrypted credential vault. {credentials.length} credential{credentials.length === 1 ? "" : "s"} stored.`

**Why this changes**

The current helper text is accurate but vault-first. The operator-facing story should start with managing service connections, while still acknowledging credentials.

**Recommended replacement**

`Connect services, monitor connection health, and manage the credentials behind them. {credentials.length} credential{credentials.length === 1 ? "" : "s"} stored.`

### 4. Tools page section label and helper copy

**File + lines**

`src/pages/admin/AdminTools.tsx:79-84`

**Current heading**

`Connected Services`

**Current info-card title**

`What are Connected Services?`

**Current description**

`Third-party platforms you've linked API keys for - like GitHub, Stripe, or Cloudflare. Your agent can use these on your behalf.`

**Current learn-more**

`Store credentials securely in Keychain, and your agent can interact with these services during conversations. Credentials are encrypted and only accessible to your agent.`

**Why this changes**

This section is already close, but still mixes old setup framing (`linked API keys`, `Keychain`) into a user-facing explainer.

**Recommended replacements**

- Heading: `Connections`
- Info-card title: `What are Connections?`
- Description: `Third-party services you've connected for your agent, like GitHub, Stripe, or Cloudflare. Your agent can use them on your behalf during conversations.`
- Learn-more: `Connect services your agent can use during conversations. Connection state is managed here, and the underlying credentials stay encrypted behind the scenes.`

### 5. Connected services empty state

**File + lines**

`src/pages/admin/tools/ConnectedServices.tsx:33-39`

**Current body copy**

`Third-party service integrations - connect your API keys in Keychain to enable these tools.`

**Current CTA**

`Go to Keychain`

**Why this changes**

This is direct setup copy shown when nothing is connected yet, so it needs to match the new model exactly.

**Recommended replacements**

- Body copy: `Connect the services your agent needs to use. Some connections use API keys, others use OAuth or bot tokens, but the setup starts here.`
- CTA: `Go to Connections`

### 6. API key reissue warning

**File + line**

`src/pages/admin/AdminYou.tsx:523`

**Current**

`Key not visible? Your browser may have cleared it. Re-issuing generates a new key and invalidates the old one - any BackstagePass encrypted credentials will need to be re-saved.`

**Why this changes**

This warning is user-visible and operationally important, but it currently names the storage layer instead of the product surface.

**Recommended replacement**

`Key not visible? Your browser may have cleared it. Re-issuing generates a new key and invalidates the old one - any saved Connections credentials will need to be re-saved.`

**If implementation honesty is important here**

`Key not visible? Your browser may have cleared it. Re-issuing generates a new key and invalidates the old one - any saved Connections credentials in BackstagePass will need to be re-saved.`

## Optional developer-comment cleanup

### 7. Top-of-file page comment

**File + line**

`src/pages/admin/AdminKeychain.tsx:2`

**Current**

`AdminKeychain — BackstagePass admin surface (/admin/keychain)`

**Why this is optional**

This is not user-visible, so it is not required for Phase 0. Still, it will keep the old product language alive in future edits if left alone.

**Recommended replacement**

`AdminKeychain — Connections admin surface (/admin/keychain)`

Keep `AdminKeychain` and `/admin/keychain` unchanged for now; those are implementation names, not product copy.

## Verified technical references to leave alone

These mentions were checked and should **not** be blanket-renamed as part of this migration.

### BackstagePass internals in `AdminKeychain`

**Files + lines**

- `src/pages/admin/AdminKeychain.tsx:21`
- `src/pages/admin/AdminKeychain.tsx:23`
- `src/pages/admin/AdminKeychain.tsx:234`
- `src/pages/admin/AdminKeychain.tsx:276`
- `src/pages/admin/AdminKeychain.tsx:332`
- `src/pages/admin/AdminKeychain.tsx:377`
- `src/pages/admin/AdminKeychain.tsx:431`
- `src/pages/admin/AdminKeychain.tsx:456`
- `src/pages/admin/AdminKeychain.tsx:1082`
- `src/pages/admin/AdminKeychain.tsx:1160`
- `src/pages/admin/AdminKeychain.tsx:1231`

These refer to the backend subsystem, audit table, and API endpoints:

- `backstagepass_audit`
- `/api/backstagepass?...`

Those should remain technical unless the backend itself is renamed later.

### Internal connector terminology

**Files + lines**

- `src/pages/admin/AdminAgents.tsx:48`
- `src/pages/admin/AdminAgents.tsx:58`
- `src/pages/admin/AdminAgents.tsx:108`
- `src/pages/admin/AdminAgents.tsx:128`
- `src/pages/admin/AdminAgents.tsx:179`
- `src/pages/admin/AdminAgents.tsx:769`
- `src/pages/admin/agentTemplates.ts:5-6`
- `src/pages/admin/Fishbowl.tsx:144-145`
- `src/pages/admin/Fishbowl.tsx:158-159`
- `src/pages/admin/AdminSettings.tsx:636`

These are describing one of:

- connector records / IDs
- tool-assignment wiring
- the MCP connector as a technical integration mechanism
- generic database or service connectors

Do not convert these to `Connections` unless the sentence is explicitly about the operator-facing product surface.

### Existing connection wording that is already correct

**Files + lines**

- `src/pages/admin/AdminSettings.tsx:447-450`
- `src/pages/admin/AdminOrchestrator.tsx:6`
- `src/pages/admin/BrainMap.tsx:114`

These already use `Connection` in the literal sense of live connectivity or setup state, which matches the intended Phase 0 language.

### Internal comment in `AdminYou`

**File + lines**

`src/pages/admin/AdminYou.tsx:31-32`

`BackstagePass` appears in a developer comment about masking values. This is not a product-surface issue and does not need migration work unless the broader implementation vocabulary is cleaned up later.

## Surfaces checked

Reviewed mentions across:

- `src/pages/admin/AdminShell.tsx`
- `src/pages/admin/AdminKeychain.tsx`
- `src/pages/admin/AdminTools.tsx`
- `src/pages/admin/tools/ConnectedServices.tsx`
- `src/pages/admin/AdminYou.tsx`
- `src/pages/admin/AdminSettings.tsx`
- `src/pages/admin/AdminAgents.tsx`
- `src/pages/admin/AdminOrchestrator.tsx`
- `src/pages/admin/BrainMap.tsx`
- `src/pages/admin/Fishbowl.tsx`
- `src/pages/admin/agentTemplates.ts`

## Rollout recommendation

### Phase 0

Apply only the six user-facing copy changes above.

### Phase 0.5

Optionally update the `AdminKeychain.tsx:2` comment so future edits follow the new language.

### Later, only if desired

Evaluate route and symbol renames such as:

- `/admin/keychain`
- `AdminKeychain`
- backend `backstagepass` endpoint naming

Those are implementation changes and are explicitly out of scope for this wording migration.

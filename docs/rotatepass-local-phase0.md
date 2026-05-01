# RotatePass / UnClick Local Phase 0 Boundary

Status: draft support slice
Scope: boundary spec only, no browser extension implementation
Related docs: `docs/connectors/spec.md`, `docs/rotatepass-chunk-2-prd.md`, `docs/prd/backstagepass.md`

## Intent

UnClick needs a clear local-first boundary before building any browser extension or local helper. The System Credentials / RotatePass work should make credentials observable without exposing secrets, while keeping cookies, MFA, passkeys, and provider sessions under the user's local control.

Phase 0 defines that boundary. It is intentionally documentation-only: no extension code, no native messaging host, no new vault, no migrations, and no auth-provider changes.

## Product Promise

The user keeps browser session material locally. UnClick may track redacted metadata, approved action mandates, health status, and proof receipts, but agents do not receive ambient browser authority.

Any AI-driven local action must be scoped, approved, revocable, and auditable. The cloud should know what capability was approved and whether it worked, not the raw cookie, token, passkey, or MFA material that made it possible.

## Trust Boundary

Local device:

- Holds cookies, MFA state, passkeys, browser profiles, and provider sessions.
- Performs approved browser actions after user consent.
- Returns redacted receipts and health signals only.

BackstagePass and cloud services:

- Store supported service credentials when already part of the secure substrate.
- Store credential metadata, ownership hints, usage mapping, status, last checked time, and safe rotation notes.
- Store approved action mandates and revocation state.
- Never store or display raw browser cookies, passkeys, MFA secrets, or local session exports.

## Non-Goals

- Do not build a broad new vault.
- Do not export or sync browser cookies, passkeys, MFA secrets, or session tokens.
- Do not bypass provider MFA, consent screens, rate limits, or account controls.
- Do not grant agents broad browser control by default.
- Do not run background purchases, posts, sends, deletes, or account changes without explicit scoped approval.
- Do not change auth providers, billing, DNS, domains, or database schema.

## Phase 0 Skeleton

Future local capabilities can be described with a small manifest before any implementation exists:

```yaml
capability_id: local.testpass.receipt-view
provider: example-provider
action: read_latest_receipt
risk_level: low
requires_user_confirmation: true
allowed_inputs:
  - receipt_url
  - run_id
disallowed_inputs:
  - raw_cookie
  - passkey_material
  - mfa_secret
session_material: local_only
revocation_key: local.testpass.receipt-view
verification_hint: redacted receipt timestamp and status
```

This is a planning shape, not a committed schema or migration.

## Approved Action Lifecycle

1. Discover: UnClick identifies that a local capability could reduce credential confusion or manual toil.
2. Explain: The UI tells the user what the action can do, what it cannot do, what service it touches, and what proof it returns.
3. Approve: The user grants a scoped mandate for one action type, account, and time window.
4. Execute locally: The local helper or browser extension uses the user's existing local session without exporting session material.
5. Report: The helper returns a redacted proof receipt and health status.
6. Revoke: One-button revoke disables the mandate and removes the tool exposure for agents.

## System Credentials Integration

The Connections/Admin System Credentials panel can represent local capabilities without exposing secrets:

- Credential name: human-readable capability or service name.
- Owner/account/email: only when safely knowable from redacted metadata or user-provided labels.
- Used by: TestPass PR checks, scheduled TestPass, Fishbowl, OpenRouter, Vercel, Supabase, or approved local capabilities.
- Status: healthy, untested, failing, stale, needs rotation, or revoked.
- Last checked: timestamp of the last safe probe or redacted receipt.
- Safe rotation notes: what breaks if revoked or rotated, and where the user should act.

For local browser capabilities, the credential row should communicate "local session controlled by this browser profile" rather than implying UnClick has copied or stored the secret.

## Safe Health Probes

Allowed probes:

- Local helper or extension installed.
- Local helper or extension version.
- Mandate exists and has not expired.
- Provider session appears present locally, without returning cookie or token values.
- Last approved action completed with a redacted receipt.
- Last approved action failed with a safe reason such as expired session, permission denied, or user revoked.

Disallowed probes:

- Reading, printing, exporting, or syncing cookies.
- Reading passkey material or MFA secrets.
- Decrypting browser or OS credential stores.
- Testing by making destructive provider changes.
- Treating a successful quiet health check as an ACK-required WakePass dispatch.

## Revocation

One-button revoke should:

- Disable the local capability mandate.
- Remove the capability from agent tool exposure.
- Mark the System Credentials row as revoked or needs attention.
- Stop future scheduled or background attempts that depend on the mandate.
- Keep provider-side session revocation as a clearly linked user action when needed.

Revocation should not require UnClick to possess or delete raw cookies, passkeys, or MFA material, because those remain local.

## Phase 0 Acceptance Criteria

- The boundary is documented before extension implementation begins.
- System Credentials can reference local capabilities using redacted metadata only.
- Agents receive scoped approved actions, not broad browser authority.
- Users keep cookies, MFA, passkeys, and sessions locally.
- One-button revoke is part of the product contract from the start.
- BackstagePass remains the secure substrate; this does not create a second vault.

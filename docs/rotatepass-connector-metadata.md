# RotatePass Connector Metadata Intake

**Status:** Draft contract  
**Owner:** UnClick fleet  
**Purpose:** Define the metadata RotatePass can consume from Connections/System Credentials without reading or storing raw secret values.

## Summary

RotatePass should make credential rotation visible without becoming a second vault.

This contract defines the safe metadata shape that can flow from Connections, BackstagePass, System Credentials, SecurityPass, TestPass, Fishbowl, and Signals into future RotatePass cards.

The rule is simple:

> RotatePass receives evidence about credentials, not credential contents.

## Hard Boundaries

RotatePass intake must never include:

- raw API keys
- passwords
- bearer tokens
- OAuth refresh tokens
- webhook signing secrets
- browser cookies
- passkeys
- MFA secrets
- full authorization headers
- request or response payloads that may contain secrets
- unredacted provider error bodies

RotatePass intake may include:

- provider label
- credential label
- credential type
- owner hint
- account hint
- used-by tags
- last checked timestamp
- last rotated timestamp
- next due timestamp
- expiry timestamp
- health status
- rotation status
- safe probe kind
- evidence source
- redacted error reason
- post-rotation verification target

## Metadata Shape

The future implementation should keep this shape additive. Missing fields should produce an `unknown` status, not a failed rotation item.

```ts
interface RotatePassCredentialMetadata {
  provider: string;
  credentialLabel: string | null;
  credentialType: CredentialType | "unknown";
  ownerHint: string | null;
  accountHint: string | null;
  usedBy: string[];
  lastCheckedAt: string | null;
  lastRotatedAt: string | null;
  nextDueAt: string | null;
  expiresAt: string | null;
  healthStatus: "healthy" | "untested" | "failing" | "stale" | "unknown";
  rotationStatus: "healthy" | "due_soon" | "stale" | "urgent" | "unknown" | "retired";
  safeProbeKind: "none" | "metadata_only" | "client_side" | "server_side_redacted";
  evidenceSource: EvidenceSource;
  redactedReason: string | null;
  verificationTarget: string | null;
}
```

## Credential Types

Initial credential types:

- `api_key`
- `personal_access_token`
- `service_role_key`
- `webhook_signing_secret`
- `oauth_client_secret`
- `oauth_access_token`
- `oauth_refresh_token`
- `deploy_token`
- `database_password`
- `app_password`
- `bot_token`
- `provider_token`
- `unknown`

Type is metadata. It is not permission to reveal, copy, rotate, or revoke a secret.

## Used-By Tags

`usedBy` should explain blast radius in plain English.

Examples:

- `TestPass PR checks`
- `scheduled TestPass smoke`
- `Fishbowl/WakePass routing`
- `GitHub workflows`
- `Vercel deployments`
- `Supabase admin APIs`
- `OpenRouter wake classifier`
- `PostHog analytics`
- `Slack notifications`
- `manual agent connection`

The same credential can have multiple tags.

## Owner Hints

Owner hints are advisory. They can come from:

- the signed-in UnClick account email
- a label such as `creativelead` or `byrneck`
- a provider account ID
- a GitHub/Vercel secret naming convention
- a manually entered note

Owner hints must not be used as authorization proof.

If owner is not confidently known, use `not recorded` or `unknown`.

## Evidence Sources

RotatePass can accept evidence from these sources:

| Source | Safe payload |
| --- | --- |
| `connections_metadata` | Existing BackstagePass/Connections row metadata |
| `system_credentials_panel` | Derived UI metadata such as health and last checked |
| `testpass_result` | Pass/fail status, run ID, target label, timestamp |
| `securitypass_finding` | Redacted finding kind and severity |
| `fishbowl_todo` | Todo ID, status, tags, redacted title |
| `mc_signal` | Signal ID, tool, unread/ack state, redacted reason |
| `github_secret_inventory` | Secret name only, updated timestamp if available |
| `vercel_env_inventory` | Env var name only, target environment, updated timestamp if available |
| `manual_note` | Human-entered metadata, redacted |

Evidence source must never contain the secret value itself.

## Probe Kinds

### `none`

No test is available. RotatePass can still track age, ownership, and missing metadata.

### `metadata_only`

The system can verify that a credential record exists and has required metadata, but cannot prove the secret works.

### `client_side`

The user's machine or an already-trusted runtime performs the provider call and reports only safe result metadata.

Preferred for high-risk credentials, local browser sessions, passkeys, cookies, or no-OAuth services.

### `server_side_redacted`

The server performs a cheap authenticated probe and stores only:

- success/failure
- HTTP status class if safe
- safe reason code
- timestamp

The server must not store request headers, token prefixes, raw provider bodies, or provider responses that may contain secret material.

## Rotation Status Mapping

Recommended first mapping:

| Input | Rotation status |
| --- | --- |
| missing enough metadata | `unknown` |
| active and inside rotation window | `healthy` |
| due date inside warning window | `due_soon` |
| due date passed | `stale` |
| leaked, plaintext, public, over-privileged, or failing privileged key | `urgent` |
| credential intentionally removed | `retired` |

`healthy` means "no rotation action due now." It does not mean the credential is secure.

## Redaction Rules

RotatePass output must pass these checks:

1. No field may include a value matching common secret prefixes such as `sk-`, `xoxb-`, `ghp_`, `gho_`, `ghs_`, `pat_`, or `uc_` unless it is an approved redacted example in documentation.
2. No token may be shown with more than four leading or trailing characters.
3. Provider error text should be mapped to safe reason codes such as `auth_failed`, `rate_limited`, `expired`, `missing_scope`, `not_configured`, or `probe_unavailable`.
4. Fishbowl posts and Signals must use redacted titles and IDs only.
5. Logs should include credential IDs and evidence IDs, not secret-adjacent values.

## Fishbowl Routing

Only actionable items should create Fishbowl work.

Create a Fishbowl todo for:

- `urgent`
- stale privileged credentials
- failed post-rotation verification
- missing owner on a credential used by production automation

Do not create a Fishbowl todo for:

- healthy inventory
- low-risk due-soon reminders
- ordinary metadata-only scans
- every successful probe

## TestPass Routing

When a credential is rotated, RotatePass should attach the relevant verification target when known.

Examples:

- `TESTPASS_TOKEN` -> PR TestPass smoke
- `TESTPASS_CRON_SECRET` -> scheduled TestPass smoke
- `Vercel token` -> deployment or cron smoke
- `PostHog key` -> analytics capture smoke
- `OpenRouter key` -> wake classifier smoke

If no check exists, use `verificationTarget: null` and show a manual checklist.

## Implementation Acceptance Criteria

A future implementation slice is complete when:

1. RotatePass can ingest metadata rows without any raw secret field.
2. Missing metadata produces `unknown`, not a crash.
3. Redaction tests reject common token prefixes and full auth headers.
4. `urgent` and stale privileged rows can create one Fishbowl todo.
5. Healthy rows stay quiet.
6. A rotated credential can link to a safe TestPass or smoke target when one exists.
7. Logs, browser UI, Fishbowl posts, Signals, and API responses contain metadata only.

## Relationship To Other Docs

- `docs/rotatepass-chunk-2-prd.md` defines the product surface and rotation queue.
- `docs/connectors/system-credentials-health-panel.md` defines the Connections/Admin health panel.
- `docs/rotatepass-local-phase0.md` defines the local/browser boundary for sessions that should stay on the user's machine.

This document is the intake vocabulary between those surfaces.

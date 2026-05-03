# Connections Setup Metadata Vocabulary

**Status:** Phase 1B implementation guide
**Owner:** Connections / RotatePass
**Scope:** metadata-only connector setup language
**Related docs:** `docs/connectors/phase-1-plan.md`, `docs/connectors/system-credentials-health-panel.md`, `docs/rotatepass-connector-metadata.md`

## Purpose

Connections needs a small, shared vocabulary for rendering connector setup cards honestly.

The Phase 1A/1B UI should be able to answer:

- how this connector is set up
- whether UnClick can safely test it
- what capability the connection unlocks
- where the operator should go for setup details
- what kind of evidence can support a health badge

This document defines those setup-facing fields. It does not define secret storage, provider writes, automatic rotation, or browser extension behavior.

## Safety Boundary

Setup metadata is descriptive. It is not a credential record.

Allowed:

- setup flow labels
- capability summary copy
- documentation URLs
- whether a safe connection test exists
- safe probe kind labels
- evidence source labels
- redacted setup requirements
- operator-facing rotation notes by name only

Not allowed:

- raw API keys
- token prefixes
- passwords
- cookies
- passkeys
- MFA secrets
- auth headers
- provider response bodies
- decrypted values
- automatic revoke or rotate actions

If a connector cannot describe a field without exposing secret material, use `unknown`, `not_applicable`, or omit the optional field.

## Metadata Shape

The setup metadata should be additive and browser-safe.

```ts
interface ConnectorSetupMetadata {
  connectorId: string;
  displayName: string;
  setupFlow: SetupFlow;
  ownerConfidence: OwnerConfidence;
  supportsConnectionTest: boolean;
  capabilitySummary: string;
  docsUrl: string | null;
  safeProbeKind: SafeProbeKind;
  evidenceSource: SetupEvidenceSource;
  setupRequirementSummary: string | null;
  rotationNote: string | null;
}

type SetupFlow =
  | "oauth_redirect"
  | "manual_api_key"
  | "manual_token"
  | "system_secret"
  | "local_only"
  | "hybrid"
  | "not_applicable";

type OwnerConfidence =
  | "owner_mapped"
  | "owner_inferred"
  | "owner_unknown";

type SafeProbeKind =
  | "none"
  | "metadata_only"
  | "workflow_receipt"
  | "mcp_smoke"
  | "provider_metadata_read"
  | "local_helper_receipt";

type SetupEvidenceSource =
  | "connections_metadata"
  | "system_credentials_inventory"
  | "workflow_run"
  | "pass_receipt"
  | "wakepass_dispatch"
  | "provider_metadata"
  | "operator_note"
  | "not_available";
```

Do not put values such as `token`, `secret`, `password`, `cookie`, or `authorization` into this object unless they are part of a safe enum name documented here. Do not add a free-form `value` field.

## Field Definitions

### `connectorId`

Stable machine name for the connector.

Examples:

- `github`
- `vercel`
- `supabase`
- `openrouter`
- `posthog`
- `testpass`
- `uxpass`

### `displayName`

Short UI name for the connector.

Examples:

- `GitHub`
- `Vercel`
- `Supabase`
- `OpenRouter`

### `setupFlow`

How the operator should expect to connect or verify the connector.

| Value | Meaning | Example |
| --- | --- | --- |
| `oauth_redirect` | User authorizes through a provider redirect | GitHub OAuth |
| `manual_api_key` | User provides an API key or provider-generated key | OpenRouter key |
| `manual_token` | User provides a token with scoped permissions | GitHub fine-grained token |
| `system_secret` | Credential is configured as deployment or workflow secret | TestPass token |
| `local_only` | Credential/session stays on the user's device | Browser profile session |
| `hybrid` | More than one setup path is valid | Vercel OAuth plus token fallback |
| `not_applicable` | Connector has no user setup step | Public docs link |

Use `system_secret` for GitHub Actions or Vercel env names that appear in System Credentials. Do not imply UnClick can read the value.

### `ownerConfidence`

How certain the setup metadata is about owner mapping, based on metadata only.

| Value | Meaning |
| --- | --- |
| `owner_mapped` | Owner mapping is explicitly documented in inventory metadata |
| `owner_inferred` | Owner mapping is inferred from scope, source, or workflow context |
| `owner_unknown` | No safe owner mapping is known yet |

UI copy should not claim certainty from these values alone. Prefer labels like `Owner mapped`, `Owner inferred`, and `Owner unknown`. Avoid copy like `Owner verified` unless human review evidence exists.

### `supportsConnectionTest`

Whether UnClick has a safe way to test the connection.

`true` means one of these exists:

- read-only provider metadata call
- workflow receipt
- MCP smoke test
- Pass receipt
- WakePass dispatch proof
- local helper receipt

`false` means the connector can still exist, but the UI should not claim a live health result.

Do not mark this `true` from presence alone.

### `capabilitySummary`

One short sentence describing what the connection enables.

Good examples:

- `Lets UnClick review pull requests and read workflow status.`
- `Lets scheduled TestPass prove the public MCP route is alive.`
- `Lets WakePass route action-needed handoffs to the right worker.`

Avoid:

- vague marketing claims
- guarantees that depend on missing credentials
- secret-specific details
- provider response snippets

### `docsUrl`

Operator-facing setup documentation.

Rules:

- Prefer internal UnClick docs when they exist.
- Use provider docs only when the setup step is provider-specific.
- Do not link to pages that require exposing secret values in query strings.
- Use `null` if the connector is not ready for setup docs.

### `safeProbeKind`

The strongest safe test available for the setup card.

| Value | Meaning |
| --- | --- |
| `none` | No safe test exists yet |
| `metadata_only` | Metadata can be checked without proving the credential works |
| `workflow_receipt` | A workflow proves the credential worked or failed |
| `mcp_smoke` | A controlled MCP call proves the integration path |
| `provider_metadata_read` | A read-only provider call returns safe status metadata |
| `local_helper_receipt` | A local helper reports success/failure without exposing local secrets |

Use the weakest honest value. If only a secret name is known, use `metadata_only`, not `provider_metadata_read`.

### `evidenceSource`

Where the latest setup or health evidence came from.

| Value | Safe payload |
| --- | --- |
| `connections_metadata` | Existing connector row metadata |
| `system_credentials_inventory` | Secret/env name and expected workload only |
| `workflow_run` | Workflow name, conclusion, timestamp, run URL |
| `pass_receipt` | Pass name, run ID, verdict, timestamp |
| `wakepass_dispatch` | Dispatch ID, owner, ACK state, timestamp |
| `provider_metadata` | Redacted provider account or resource metadata |
| `operator_note` | Human-entered note with no secret material |
| `not_available` | No evidence yet |

Do not store provider response bodies as evidence.

### `setupRequirementSummary`

Optional human-readable note about what must exist before setup can pass.

Good examples:

- `Requires TESTPASS_TOKEN as a GitHub Actions secret.`
- `Requires TESTPASS_CRON_SECRET in the scheduled runner environment.`
- `Requires a GitHub token with repository workflow read access.`

Bad examples:

- `Token starts with a provider-specific prefix.`
- `Paste the current secret into this field.`
- `Copy the Authorization header from the browser.`

### `rotationNote`

Optional safe note describing what to recheck after rotation.

Good examples:

- `After rotation, rerun the TestPass PR check and scheduled smoke.`
- `After rotation, confirm WakePass can create an ACK-required dispatch.`
- `After rotation, run a read-only provider metadata probe.`

Do not provide automatic revoke or rotate instructions in this setup metadata. RotatePass may own those workflows later with explicit approval.

## UI Copy Guidance

Setup cards should speak in status and evidence language, not secret language.

Use:

- `Configured by name`
- `Last checked by workflow`
- `Untested`
- `Safe probe available`
- `Needs operator setup`
- `Rotation note available`

Avoid:

- `Secret value loaded`
- `Token looks valid`
- `We can see your key`
- `Click to rotate automatically`
- `Copy key here`

## Example Rows

### TestPass PR Check

```ts
{
  connectorId: "testpass-pr-check",
  displayName: "TestPass PR Check",
  setupFlow: "system_secret",
  supportsConnectionTest: true,
  capabilitySummary: "Lets pull requests prove TestPass can reach the public MCP route.",
  docsUrl: "/docs/testpass/ci-bearer-token",
  safeProbeKind: "workflow_receipt",
  evidenceSource: "workflow_run",
  setupRequirementSummary: "Requires TESTPASS_TOKEN as a GitHub Actions secret.",
  rotationNote: "After rotation, rerun the TestPass PR check."
}
```

### OpenRouter Wake Classifier

```ts
{
  connectorId: "openrouter-wake-classifier",
  displayName: "OpenRouter Wake Classifier",
  setupFlow: "system_secret",
  supportsConnectionTest: false,
  capabilitySummary: "Helps classify ambiguous wake events without becoming the worker.",
  docsUrl: null,
  safeProbeKind: "metadata_only",
  evidenceSource: "system_credentials_inventory",
  setupRequirementSummary: "Requires OPENROUTER_API_KEY in the runtime environment.",
  rotationNote: "After rotation, run a static classifier dry-run if approved."
}
```

### Local Browser Session

```ts
{
  connectorId: "local-browser-session",
  displayName: "Local Browser Session",
  setupFlow: "local_only",
  supportsConnectionTest: true,
  capabilitySummary: "Lets the user's machine approve scoped browser actions without sharing cookies.",
  docsUrl: "/docs/rotatepass-local-phase0",
  safeProbeKind: "local_helper_receipt",
  evidenceSource: "operator_note",
  setupRequirementSummary: "Requires local helper approval on the user's machine.",
  rotationNote: "Revoke locally if the machine or browser profile is no longer trusted."
}
```

## Implementation Checklist

- Keep setup metadata separate from credential values.
- Treat presence as `metadata_only`, never `healthy`.
- Render unknown fields as `Untested` or `Not recorded`.
- Reuse `docs/rotatepass-connector-metadata.md` for credential health, owner hints, used-by tags, rotation dates, and redaction rules.
- Keep System Credentials name inventory in `src/pages/admin/systemCredentialInventory.ts`.
- Do not duplicate inventory rows in this setup metadata.
- Add unit tests before wiring this object into UI or API output.

## Acceptance Tests for Future Code

Future implementation PRs should prove:

1. Setup metadata renders without raw secret values.
2. `supportsConnectionTest: false` never displays a healthy badge.
3. `system_secret` rows show secret names only, not values or prefixes.
4. `workflow_receipt` rows require a timestamped workflow result.
5. Unknown optional fields degrade to `Untested` or `Not recorded`.
6. Local-only rows never imply server-side cookie, passkey, or MFA access.

## Non-Goals

- No UI implementation in this doc.
- No new API endpoint.
- No migration.
- No provider integration.
- No secret scanning.
- No browser extension implementation.
- No automatic revoke or rotation workflow.

# System Credentials Health Panel

**Status:** Phase 1B contract draft
**Last updated:** 2026-05-01
**Owner:** Connections / RotatePass
**Implementation lane:** Connections admin surface, backed by the existing BackstagePass substrate

## Intent

The System Credentials health panel makes UnClick's operational keys observable without making them visible.

The TESTPASS_TOKEN / TESTPASS_CRON_SECRET confusion showed the gap: operators need to know which credential powers which workflow, whether it works, who owns it, and what breaks if it is rotated. They do not need the raw secret value.

The panel should answer four questions quickly:

1. What credential is this?
2. What depends on it?
3. Is it healthy right now?
4. What is the safe rotation path?

## Product placement

This belongs inside **Connections** in the admin surface.

It should be framed as **System Credentials** or **System credential health**, not as a separate vault product. RotatePass owns the rotation-status language. BackstagePass remains the secure storage and audit substrate.

Recommended first placement:

- `/admin/keychain` while that remains the implementation route
- visible page language: `Connections`
- panel heading: `System Credentials`
- helper copy: `Operational keys, tokens, and secrets that power UnClick itself. Values are never shown.`

## Non-goals

This slice must not:

- print raw secret values
- show full token prefixes
- reveal bearer tokens in logs, Fishbowl, Signals, browser UI, or test output
- add a broad new vault
- rename BackstagePass endpoints
- change auth providers
- change billing, DNS, domains, or OAuth app configuration
- auto-rotate provider credentials
- require a database migration for the first read-only panel
- claim a credential is healthy when it has not been tested

## Source of truth

Phase 1B should read from existing sources first:

- environment and workflow metadata for GitHub Actions and Vercel usage
- BackstagePass / user credential metadata where a credential is stored there
- known code references to env var names
- TestPass, UXPass, Dogfood, and WakePass run signals where those prove usage
- RotatePass metadata when rotation dates are known
- manual operator notes for owner and rotation steps

If a value cannot be known safely, show `Unknown`, `Untested`, or `Manual check required`.

Do not infer secret ownership from secret values.

## Credential card shape

Each card should render this safe shape:

```ts
type SystemCredentialHealth = {
  id: string;
  name: string;
  provider: string;
  credentialType: CredentialType;
  owner: CredentialOwner;
  usedBy: CredentialUsage[];
  status: CredentialHealthStatus;
  lastCheckedAt: string | null;
  lastRotatedAt: string | null;
  rotationWindowDays: number | null;
  rotationNotes: string[];
  healthEvidence: HealthEvidence[];
  safeActions: SafeCredentialAction[];
};
```

### Credential types

Use simple labels:

- `api_key`
- `service_role_key`
- `webhook_secret`
- `oauth_client_secret`
- `oauth_refresh_token`
- `personal_access_token`
- `bot_token`
- `database_password`
- `signing_secret`
- `unknown`

### Owner shape

Show owner only when safely knowable:

```ts
type CredentialOwner = {
  label: string;
  accountEmail?: string;
  providerAccountId?: string;
  tenant?: string;
  confidence: "known" | "inferred" | "unknown";
};
```

Rules:

- Use `confidence: "known"` only when returned by a provider API, admin metadata, or explicit operator configuration.
- Use `confidence: "inferred"` only for safe metadata such as `GitHub Actions secret in malamutemayhem/unclick`.
- Use `confidence: "unknown"` when only the env var name is known.
- Never derive owner from a secret value.

### Usage shape

```ts
type CredentialUsage = {
  surface: string;
  purpose: string;
  runtime: "github_actions" | "vercel" | "mcp_server" | "admin_api" | "browser" | "local" | "unknown";
  blastRadius: string;
  verificationHint: string;
};
```

Examples:

- TestPass PR checks
- scheduled TestPass
- Dogfood receipt runner
- Fishbowl wake router
- Fishbowl auto-close
- OpenRouter classifier
- Vercel deployment runtime
- Supabase service role operations
- PostHog analytics
- GitHub repository automation

## Status model

System Credentials uses a status model that can be shared with RotatePass.

| Status | Meaning | UI color |
| --- | --- | --- |
| `healthy` | Last safe probe succeeded within the allowed window | Green |
| `untested` | Default for configured or referenced credentials when only safe metadata exists and no recent safe probe evidence is available | Neutral info |
| `failing` | A safe probe failed or a dependent workflow is auth-failing | Red |
| `stale` | Last check or rotation evidence is older than the configured window | Amber |
| `needs_rotation` | Rotation is due, manually requested, or prompted by a security finding | Orange |
| `unknown` | Metadata is incomplete and the panel cannot make a useful claim | Gray |

Do not show `healthy` from presence alone. `Untested` is a deliberate safety label, not a warning by itself.
Treat metadata activity timestamps as inventory evidence only. Metadata activity alone must not upgrade a credential to `healthy`.

`healthy` requires one of:

- a provider metadata probe succeeded
- a dependent workflow succeeded with that credential after the last known rotation
- an MCP/admin smoke test succeeded with that credential after the last known rotation
- a verified operator check-in marked the credential valid with timestamped evidence

## Initial inventory

The first panel should include the credentials that already cause operational confusion.

| Credential | Used by | First safe status source | Rotation note |
| --- | --- | --- | --- |
| `TESTPASS_TOKEN` | TestPass PR check, scheduled TestPass if shared | latest TestPass PR check auth result | If rotated, rerun TestPass PR check and scheduled smoke |
| `TESTPASS_CRON_SECRET` | scheduled TestPass / cron gate | scheduled smoke receipt or explicit cron auth probe | If rotated, update scheduler secret and run manual scheduled trigger |
| `UXPASS_TOKEN` | UXPass dogfood / scheduled capture | latest UXPass dogfood receipt | If rotated, run UXPass capture smoke |
| `FISHBOWL_WAKE_TOKEN` | Event Wake Router / WakePass handoffs | latest wake-router dispatch proof | If rotated, run a dry `/wake` issue-comment route |
| `FISHBOWL_AUTOCLOSE_TOKEN` | Fishbowl todo auto-close on PR merge | latest auto-close workflow result | If rotated, merge-test or run safe dry proof |
| `OPENROUTER_API_KEY` | wake/no-wake classifier for ambiguous events | classifier health probe or latest routed ambiguous event | If rotated, run classifier dry-run with no user data |
| `VERCEL_TOKEN` | deployments and Vercel API operations | Vercel API whoami/project probe | If rotated, verify deployment listing before deploy |
| `SUPABASE_SERVICE_ROLE_KEY` | privileged admin/server operations | Supabase lightweight metadata probe | Rotate with human review only |
| `POSTHOG_KEY` | analytics capture | analytics startup/pageview proof | If rotated, confirm pageview capture |
| `GITHUB_TOKEN` | GitHub Actions and repo automation | GitHub Actions context or API rate-limit probe | Built-in token does not rotate like a stored secret |

This table is a seed, not a complete registry.

## Safe health probes

Probes must be read-only and low blast-radius.

Allowed examples:

- GitHub: rate limit or repository metadata read using the intended token.
- Vercel: project/deployment metadata read, no deploy or env write.
- Supabase: non-secret metadata or a controlled health RPC that returns no row data.
- TestPass: dry smoke against `https://unclick.world/api/mcp` that records auth result only.
- WakePass: dry-run event routing that creates no external user action unless explicitly in test mode.
- OpenRouter: model list or minimal classifier dry-run with a static non-sensitive prompt.
- PostHog: only use existing receipt evidence unless a safe test event is explicitly allowed.

For the current analytics reliability scout and the first-party fallback boundary,
see `docs/analytics-reliability-scout.md`.

Disallowed examples:

- printing token prefixes for debugging
- provider write calls
- key creation, deletion, or rotation
- revealing decrypted values
- testing by intentionally leaking a value into logs
- storing probe responses that include sensitive payloads

## Rotation notes

Every credential card should include a short safe rotation note.

The note should tell the operator:

- where the credential is configured
- what depends on it
- what to run after rotation
- who must be involved if human approval is needed
- what should not be touched

Example:

```text
Rotating TESTPASS_TOKEN affects TestPass PR checks. Update the GitHub secret,
rerun the TestPass PR check, then run the scheduled TestPass smoke. Do not
weaken fail-closed behavior to make the check pass.
```

## Audit trail

The panel should create or reuse audit events for:

- health probe started
- health probe succeeded
- health probe failed
- rotation marked complete
- rotation marked needed
- owner metadata changed

Audit events must not include raw values, decrypted payloads, full token prefixes, or provider responses with secrets.

## Fishbowl and Signals routing

Healthy credentials should stay quiet.

Create Fishbowl or Signal output only for:

- `failing`
- `needs_rotation`
- `stale` on privileged credentials
- missing owner on a critical credential
- a dependent workflow failing due to auth

Recommended Fishbowl todo title shape:

```text
Rotate/check <credential name>: <safe reason>
```

Example:

```text
Rotate/check TESTPASS_TOKEN: TestPass PR check is auth-failing against /api/mcp
```

## Connections UI acceptance

The first implementation is acceptable when:

- System Credentials appears inside the Connections admin story.
- Cards show name, owner/account when safely knowable, used-by, status, last checked, and rotation notes.
- No raw secret value or sensitive prefix is rendered.
- Untested credentials are labelled `Untested`, not `healthy`.
- Failing credential state points at the dependent workflow or probe evidence.
- Rotation copy explains what breaks if rotated.
- BackstagePass remains the secure substrate.
- No migration is required for the first static/read-only slice unless Chris explicitly approves one.

## Test plan

Minimum tests for the first implementation:

- static inventory renders without secret values
- `healthy`, `untested`, `failing`, `stale`, and `needs_rotation` badges render correctly when those states are implemented
- static metadata-only inventory rows default to `untested` until safe probe evidence exists
- missing owner displays `Unknown`, not an empty string
- raw secret-looking strings are blocked from fixture output
- rotation notes render for every seeded critical credential
- health evidence timestamps format consistently
- no Fishbowl/Signal output is emitted for healthy/no-op inventory reads

## Browser extension boundary

UnClick Local / browser extension work remains later-phase.

If a Phase 0 skeleton is needed, it should be a separate local-first spec only:

- user keeps cookies, MFA, passkeys, and browser fingerprint locally
- AI receives scoped approved actions only
- every action has a visible user grant
- one-button revoke is mandatory
- no cloud session export by default
- no consumer-site automation in this System Credentials slice

The System Credentials panel may eventually show whether the local helper is connected, but it must not implement the extension.

## Open questions

- Which credentials should be in the critical seed list for the first UI PR?
- Should last-checked data come from existing workflow receipts first, or from a new read-only health action?
- Which credential owners can be safely known from provider metadata without extra scopes?
- Should RotatePass own the `needs_rotation` badge copy centrally, or should Connections own it until RotatePass implementation starts?
- Do we need a manual operator note field before adding any database metadata?

## Recommended next slice

Ship a UI-only Phase 1B panel that uses a static safe inventory plus existing workflow evidence where available.

Do not add a migration yet.

Do not add secret reveal or provider writes.

Do not rename BackstagePass endpoints.

Once the panel proves useful, the next slice can add a read-only `system_credentials_health` admin action that assembles the same shape server-side.

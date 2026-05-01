# RotatePass Chunk 2 PRD

**Status:** Draft, ready for Bailey review  
**Owner:** Chris Byrne / Malamute Mayhem  
**Implementer:** Unassigned  
**Product posture:** Free and integrated. RotatePass is ecosystem glue, not a paid standalone Pass.  
**Build order:** Queued behind UXPass for implementation. This PRD can land now to clear design backlog.

---

## 1. Intent

RotatePass keeps credentials boring.

It watches the credentials already stored or referenced by BackstagePass, identifies which ones are stale, risky, leaked, legacy, or missing rotation evidence, then turns that into a plain-English rotation queue.

The product promise in one sentence:

> Know which keys need rotating, why they matter, and what to do next.

Chunk 2 defines the first real product surface for RotatePass. It is scope-only and doc-first. It does not implement the UI, database, scanners, provider APIs, or automatic rotation.

## 2. Product role

RotatePass is not another paid verdict product. It is free integrated hygiene that makes the rest of UnClick safer.

It sits between:

- **BackstagePass:** stores credentials and connection state
- **Signals:** sends rotation reminders and urgent warnings
- **Fishbowl:** turns rotation work into visible todos
- **SecurityPass:** escalates leaked or over-privileged credential findings
- **TestPass:** verifies that rotations did not break critical tool paths

The product should feel like part of the operating system rather than a separate destination.

## 3. Scope

### 3.1 In scope for Chunk 2

- A RotatePass PRD for the MVP product surface
- Credential inventory rules
- Rotation status model
- Severity model
- Plain-English remediation copy
- Signals and Fishbowl routing rules
- BackstagePass integration boundaries
- Acceptance criteria for a later implementation chip
- Test plan for a later implementation chip

### 3.2 Out of scope for Chunk 2

- Any code implementation
- Any database migration
- Any automatic secret rotation
- Any provider API write calls
- Any destructive revoke/delete action
- Any new vault or secret-storage model
- Any paid tier gating
- Any compliance dashboard
- Any attempt to replace BackstagePass

### 3.3 Non-goals

RotatePass does not promise to rotate every provider credential automatically.

RotatePass does not certify that a key is safe.

RotatePass does not expose secret values in reports, logs, Fishbowl posts, Signals, or browser UI.

## 4. User stories

### 4.1 Founder/operator

As a founder, I want one clear list of keys that need attention so I am not guessing from memory after a security incident.

### 4.2 Agent coordinator

As Bailey or another coordinator, I want rotation work to become Fishbowl todos with enough context to route safely, without exposing secret values.

### 4.3 Security reviewer

As a SecurityPass reviewer, I want leaked, plaintext, public, or over-privileged credential findings to trigger urgent RotatePass follow-up.

### 4.4 Developer

As a developer, I want a rotation checklist that includes post-rotation verification so I know which TestPass or smoke checks to run.

## 5. Credential inventory

RotatePass reads metadata about credentials. It does not read or display raw secret values.

### 5.1 Credential types

The MVP inventory should recognise:

- API keys
- personal access tokens
- service role keys
- webhook signing secrets
- OAuth client secrets
- deploy tokens
- database passwords
- app passwords
- provider-specific integration tokens

### 5.2 Provider examples

Initial provider labels:

- GitHub
- Vercel
- Supabase
- Stripe
- PostHog
- OpenAI
- Anthropic
- Google
- Cloudflare
- Resend
- UnClick internal

Provider labels are metadata only in Chunk 2. Provider-specific rotation automation is out of scope.

### 5.3 Inventory source

BackstagePass remains the source of truth for stored credentials and connection metadata.

The metadata intake vocabulary is defined in `docs/rotatepass-connector-metadata.md`.
RotatePass should consume that contract before inventing new credential fields.

RotatePass may also consume findings from:

- SecurityPass credential findings
- Fishbowl todos tagged as credential or rotation work
- Signals tripwires
- Memory facts that record past rotations

Those inputs should be treated as metadata and evidence, not as secret material.

## 6. Rotation status model

Each credential receives one rotation status.

| Status | Meaning |
| --- | --- |
| `healthy` | No rotation action due now |
| `due_soon` | Rotation window is approaching |
| `stale` | Rotation window has passed |
| `urgent` | Key is leaked, overexposed, legacy, plaintext, public, or otherwise unsafe |
| `unknown` | Missing enough metadata to judge |
| `retired` | Credential is no longer active but kept for audit history |

### 6.1 Default age windows

Suggested defaults:

- webhook signing secrets: 180 days
- low-risk read-only API keys: 180 days
- ordinary API keys: 90 days
- write-capable provider tokens: 60 days
- service role or admin tokens: 30 days
- leaked or publicly exposed keys: immediate

These are defaults, not policy law. The implementation should allow later per-provider overrides.

## 7. Severity model

RotatePass uses simple severity labels that match the rest of UnClick.

| Severity | Use when |
| --- | --- |
| `info` | Metadata is missing or a low-risk reminder is not yet due |
| `warning` | Rotation is due soon, stale, or incomplete |
| `action_needed` | A stale or privileged credential needs operator action |
| `blocker` | A key appears leaked, public, plaintext, or still active in a legacy unsafe table |

Plain-English copy matters more than clever scoring. A user should know why the item exists in one sentence.

## 8. Rotation card shape

Each future RotatePass card should include:

- provider
- credential label
- credential type
- status
- severity
- why this matters
- last rotated date if known
- next due date if known
- evidence source
- owner if known
- recommended next action
- post-rotation verification steps

It must not include:

- raw secret values
- full token prefixes beyond a safe redacted hint
- service-role keys in logs
- copyable credential values

## 9. Recommended next actions

RotatePass should prefer concrete checklist language:

- "Create a replacement key in Vercel."
- "Update the Vercel environment variable."
- "Redeploy without build cache."
- "Run the TestPass smoke check."
- "Confirm the old key no longer works."
- "Mark the rotation complete."

Avoid vague copy:

- "Review credential."
- "Investigate security."
- "Consider rotating."

## 10. Routing rules

### 10.1 Signals

Signals receives:

- urgent leaked or exposed key findings
- stale privileged credential reminders
- rotation failures
- post-rotation verification failures

Signals should not receive ordinary healthy inventory updates.

### 10.2 Fishbowl

Fishbowl receives:

- one todo per actionable rotation item
- one completion note when a rotation is verified
- one blocker note when a credential is unsafe and cannot be rotated by an agent

Fishbowl text must be redacted and operator-safe.

### 10.3 SecurityPass

SecurityPass may escalate:

- plaintext key storage
- permissive RLS policy on credential tables
- token values detected in code, logs, docs, or build artefacts
- orphaned legacy credential tables

RotatePass turns those findings into the rotation queue.

### 10.4 TestPass

TestPass is the post-rotation safety check.

Every rotation item should name the relevant smoke or integration check if one exists.

## 11. MVP surface

The eventual UI can live inside BackstagePass or as a small sibling page.

Recommended route:

- `/admin/connections/rotate`

If the product surface needs a separate nav item later, label it:

- `Rotation`

Do not create a paid-product landing page for Chunk 2.

## 12. Empty states

### 12.1 No credentials

Copy:

> No credentials to rotate yet. Add a connection in BackstagePass and RotatePass will track its rotation health.

### 12.2 All healthy

Copy:

> Nothing needs rotating right now. RotatePass will warn you before the next key goes stale.

### 12.3 Missing metadata

Copy:

> Some credentials are missing rotation dates. Add the last rotated date so RotatePass can warn you at the right time.

## 13. Implementation acceptance criteria

The later implementation chip is complete when all of these are true:

1. Stored credentials can be listed without exposing secret values.
2. Each listed credential receives one rotation status.
3. Privileged stale credentials become `action_needed`.
4. Leaked, plaintext, public, or legacy-unsafe credential findings become `blocker`.
5. Healthy credentials do not create Fishbowl noise.
6. Actionable items can create one Fishbowl todo with redacted context.
7. Rotation completion can record an audit event.
8. Post-rotation verification can link to a relevant TestPass check when available.
9. No UI, log, API response, Fishbowl post, or Signal includes raw secret values.
10. The feature remains free and integrated.

## 14. Test plan for implementation

### 14.1 Unit tests

- status calculation by credential age
- severity calculation by risk signal
- redaction helper never returns raw values
- due-date calculation for each default cadence
- Fishbowl todo payload contains context but no secret value

### 14.2 Integration tests

- BackstagePass credential metadata flows into RotatePass inventory
- SecurityPass exposed-key finding creates urgent RotatePass item
- stale admin token creates one Fishbowl todo, not duplicates
- completed rotation writes audit event
- TestPass verification link attaches when a matching check exists

### 14.3 Manual QA

- confirm no raw keys appear in the browser
- confirm no raw keys appear in network responses
- confirm no raw keys appear in logs
- confirm empty states are plain English
- confirm healthy inventories stay quiet

## 15. Risks

### 15.1 False confidence

Risk: users think "healthy" means secure.

Mitigation: use "nothing needs rotating right now" instead of "secure."

### 15.2 Over-notification

Risk: every old low-risk credential becomes noise.

Mitigation: route only stale privileged credentials and urgent findings to Signals. Keep low-risk reminders inside the RotatePass surface.

### 15.3 Secret leakage through helpful UI

Risk: the product tries to be helpful by showing too much token detail.

Mitigation: enforce redaction at the formatter layer and test it directly.

### 15.4 Provider automation temptation

Risk: teams try to ship automatic revoke/regenerate in the first pass.

Mitigation: keep Chunk 2 manual checklist first. Provider automation can come later, one provider at a time.

## 16. Open decisions

None blocking for this PRD.

Implementation can decide later whether RotatePass is a BackstagePass subpage or its own small admin page. Default recommendation is BackstagePass subpage because RotatePass is free integrated glue.

## 17. Chunk 3 preview

Chunk 3 should be the first implementation slice:

- inventory read model
- redaction helper
- status calculator
- simple admin list
- Fishbowl todo creation for urgent and stale privileged items

Automatic provider rotation stays out until the manual loop is reliable.

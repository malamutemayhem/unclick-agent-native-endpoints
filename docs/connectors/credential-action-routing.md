# Credential Action Routing

**Status:** Draft routing contract
**Owner:** Connections / RotatePass / WakePass
**Scope:** Documentation only. No code, migrations, provider writes, secret reads, or browser extension implementation.
**Related docs:** `docs/connectors/system-credentials-health-panel.md`, `docs/rotatepass-connector-metadata.md`, `docs/rotatepass-local-phase0.md`

## Intent

System Credentials and RotatePass should reduce operational yellow without turning healthy inventory into noise.

This routing contract defines when credential metadata becomes an action-needed Fishbowl or WakePass handoff. It keeps the line simple:

- Healthy inventory stays quiet.
- Action-needed credential states route to the smallest safe owner.
- Every routed item carries evidence metadata only, never credential contents.

## Inputs

Routing may consume safe metadata from:

- Connections / BackstagePass metadata
- System Credentials health rows
- RotatePass credential metadata
- GitHub secret name inventory
- Vercel env name inventory
- TestPass, UXPass, Dogfood, WakePass, and SecurityPass receipts
- Fishbowl todos and Signals when they already contain redacted metadata
- Manual operator notes that contain no raw secret values

Routing must not consume or forward:

- raw API keys
- token prefixes
- passwords
- cookies
- passkeys
- MFA secrets
- authorization headers
- decrypted BackstagePass values
- provider response bodies
- browser session material

## Terminology Guardrails

Use product words narrowly so routing does not imply dangerous automation.

- `rotate` or `RotatePass` means a human-approved replacement of stored encrypted values or metadata, not automatic provider rotation, provider revocation, token refresh, or secret generation.
- `disconnect` means removing or disabling UnClick-side encrypted credential metadata, not revoking access inside the provider account.
- `test` or `probe` means a safe read-only verification that returns status metadata only, not a provider write or destructive validation.
- `browser session` means the normal UnClick web admin session unless a future local-first spec explicitly says otherwise. It does not mean a browser extension, client plugin, native connector, cookie export, passkey access, or MFA bypass.
- `store` means BackstagePass encrypted credential storage or redacted metadata storage. Plaintext may be transient during user-supplied save, reveal, or test flows, but it must not be raw-at-rest in routing, Fishbowl, Signals, logs, or docs.

## Action Decision Matrix

| Input state | Route? | Reason |
| --- | --- | --- |
| `healthy` with recent evidence | No | Quiet success path |
| `untested` low-risk inventory | No | Dashboard visibility is enough |
| `untested` privileged credential | Yes, if owner missing or first setup blocks work | Needs human or owner confirmation |
| `stale` low-risk credential | No | Avoid reminder spam |
| `stale` privileged credential | Yes | Rotation/check may block critical workflows |
| `failing` safe probe | Yes | Workflow value is already degraded |
| `needs_rotation` | Yes | Explicit action-needed state |
| `urgent` rotation status | Yes | Potential security or production risk |
| missing owner on production automation | Yes | Reclaimability needs an owner |
| metadata-only scan completed | No | Normal inventory maintenance |
| provider probe succeeded | No | Success stays silent |
| provider probe unavailable | No, unless blocking a workflow | Not all credentials have safe probes |

## Privilege Tiers

Use the lowest tier that matches the credential. When unsure, prefer `unknown` and avoid noisy routing until a workflow fails.

| Tier | Examples | Routing rule |
| --- | --- | --- |
| `low` | analytics public key names, docs-only setup metadata | Dashboard only |
| `normal` | non-production bot tokens, manual agent connection labels | Route only on failing or explicit rotation-needed |
| `privileged` | deployment tokens, service-role keys, cron gate secrets | Route on failing, stale, needs-rotation, or missing owner |
| `critical` | production auth gates, Fishbowl/WakePass dispatch credentials, database admin keys | Route on failing, stale, missing owner, or blocked verification |
| `unknown` | name-only inventory with no owner, purpose, or status | Dashboard only unless tied to a failing workflow |

## Owner Selection

Routing should choose exactly one owner.

Owner priority:

1. Explicit owner metadata with `known` confidence.
2. The worker or service owner for the failing workflow.
3. The credential lane owner, such as Connections, RotatePass, TestPass, UXPass, WakePass, or SecurityPass.
4. The current queue leader when no lane owner is safe to infer.
5. Human review only when rotation, provider access, billing, auth, DNS, or privileged admin approval is required.

Do not infer owner from a raw secret value. Do not route to `all` unless the item is a broadcast status update with no ACK requirement.

## WakePass Handoff Shape

Action-needed credential handoffs should use this metadata-only shape:

```text
status: <failing | stale | needs_rotation | urgent | owner_missing>
credential: <safe credential name or label>
provider: <provider or unknown>
used_by: <workflow or product surface>
reason: <safe reason code>
owner: <single owner or human-review>
evidence: <receipt id, run id, todo id, or timestamp>
next: <one concrete safe action>
eta: <expected check-in or review window>
blocker: <none or human-required reason>
tag: act
```

The handoff must not include secret values, token prefixes, auth headers, provider response bodies, or copied browser/session material.

Rotation impact and follow-up guidance must stay metadata-only:

- Name the affected workflow or product surface.
- Name the next safe verification step after rotation.
- Do not include key fragments, token prefixes, auth headers, cookies, passkeys, MFA material, or provider response snippets.

## ACK And Lease Rules

Use ACK-required WakePass routing only for action-needed states.

Default lease:

- 10 minutes for active worker action.
- 30 minutes for human-review needed, if a human was explicitly tagged.
- No lease for quiet inventory, successful probes, dashboard reads, or FYI-only docs.

Close the lease when:

- the owner ACKs and states a next action,
- the owner posts a heartbeat showing active work,
- the credential state returns to healthy with safe evidence,
- the routing item is parked as human-required with an explicit blocker.

Missed ACK behavior:

- visible in Fishbowl as reclaimable,
- one retry to the lane owner,
- then queue-leader or human-review escalation if still unowned.

Do not create repeated WakePass items for the same credential and reason while an unexpired lease exists.

## Safe Reason Codes

Use stable reason codes so future dashboards can group items without parsing prose.

- `auth_failed`
- `expired`
- `missing_scope`
- `not_configured`
- `owner_missing`
- `probe_failed`
- `probe_unavailable`
- `rotation_due`
- `rotation_overdue`
- `stale_evidence`
- `verification_failed`
- `workflow_blocked`

Provider-specific error text should be mapped into these codes. Store or route the raw provider body nowhere.

## Quiet Paths

Do not route or wake on:

- healthy inventory
- successful read-only probes
- successful scheduled receipts
- dashboard page views
- normal metadata refreshes
- broad status broadcasts
- low-risk due-soon reminders
- provider probe unavailable when no workflow is blocked
- local browser capability presence checks

Quiet paths may update a dashboard timestamp or receipt row. They should not create ACK-required Fishbowl work.

## Examples

### Route

`TESTPASS_TOKEN` is tied to TestPass PR checks and a TestPass PR check fails with `auth_failed`.

Route to the TestPass or queue owner with:

- reason: `auth_failed`
- used_by: `TestPass PR checks`
- evidence: the failed run ID
- next: verify configured key name and rerun the safe smoke

### Route

`FISHBOWL_WAKE_TOKEN` is privileged, stale, and has no owner metadata.

Route to the WakePass lane with:

- reason: `owner_missing`
- used_by: `Fishbowl/WakePass routing`
- evidence: the last checked timestamp
- next: add owner metadata or park as human-required

### Stay quiet

`OPENROUTER_API_KEY` appears in name-only inventory but has no safe probe yet and no dependent workflow is failing.

Show it as `untested` or `unknown` in the panel. Do not create a Fishbowl todo.

### Stay quiet

A provider metadata probe succeeds.

Update last checked and evidence timestamp. Do not wake a worker.

## Acceptance Criteria

A future implementation is aligned with this contract when:

1. Action-needed credential states create at most one ACK-required handoff per credential/reason lease.
2. Healthy, successful, and metadata-only paths stay quiet.
3. Every routed item has a single owner, a safe reason code, safe evidence, and a concrete next action.
4. Fishbowl posts and Signals include credential names and metadata only.
5. No route payload includes raw keys, token prefixes, cookies, passkeys, MFA material, auth headers, or provider bodies.
6. Human review is required before automatic rotate, revoke, auth, billing, DNS, domain, or migration work.

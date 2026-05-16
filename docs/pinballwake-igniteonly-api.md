# PinballWake IgniteOnlyAPI

IgniteOnlyAPI is the green ignite lane inside the PinballWake ecosystem.

Its worker label is `IgniteOnly💥`. Its code name is `IgniteOnly`.

Rollout status: official.

## Purpose

IgniteOnlyAPI closes the gap between "we can see the blocker" and "the right worker gets woken".

It is the sibling of NudgeOnlyAPI:

- `NudgeOnlyAPI` spots a painpoint and emits a tiny receipt request.
- `IgniteOnlyAPI` consumes that verified request and emits a compact worker wake packet.

Use it for:

- stale ACKs that need a reviewer wake
- missing proof that needs a builder wake
- unclear owner handoffs that need Job Manager
- duplicate wakes that need consolidation
- noisy heartbeat threads that need a material state receipt
- dormant worker lanes that need a safe wake check

## Boundary

IgniteOnlyAPI is not a builder and not a decision maker.

It may:

- emit a verified worker wake packet
- emit a verified escalation wake packet
- route only to a known worker lane
- return `blocked_verification_required` when evidence is weak
- redact public packet fields

It must not:

- merge PRs
- close blockers
- mark work complete
- edit code
- approve changes
- override safety gates
- decide subjective ownership
- invent workers
- create work from weak evidence
- print secrets

## Flow

1. Heartbeat or Orchestrator sees a blocker, stale ACK, missing proof, duplicate wake, noisy thread, or unclear owner.
2. NudgeOnlyAPI classifies the painpoint or deterministic UnClick evidence provides the bucket.
3. `nudgeonly_receipt_bridge` emits `receipt_request` or `escalation_request`.
4. `igniteonly_receipt_consumer` checks source evidence, target, known worker route, verifier status, and public field redaction.
5. If safe, IgniteOnlyAPI emits a wake packet.
6. The trusted worker lane does the actual work and returns proof.

Receipt shape:

`verified bridge -> worker -> target -> painpoint -> expected receipt -> verifier`

Example:

`nudgebridge_abc -> Builder -> Issue #706 -> missing_proof -> commit, PR, run ID, or blocker -> proof pointer check`

## Wake Packet Contract

An IgniteOnly wake packet is a resume card, not a command. It gives the next seat enough context to pick up a verified handoff without rereading the whole thread.

Required packet fields:

- `ignite_id`: stable `igniteonly_<hash>` ID derived from source pointer, target, worker, and painpoint.
- `created_at`: ISO timestamp for freshness checks.
- `expires_at`: ISO timestamp for the latest safe wake time.
- `source_kind`: source category such as `todo`, `pull_request`, `dispatch`, `checkin`, `signal`, or `boardroom_message`.
- `source_id`: source record ID with no secret-shaped values.
- `source_url`: public or internal pointer when available.
- `target`: concise item being resumed, such as `todo 50383b82` or `PR #880`.
- `worker`: known worker lane expected to act.
- `painpoint`: approved bucket from the worker route table.
- `expected_receipt`: smallest proof the worker should return.
- `verifier`: deterministic verifier, trusted bridge, or explicit verified flag.
- `owner_hint`: current owner or `unassigned` when a claim is needed.
- `redaction_state`: `public_clean`, `internal_clean`, or `blocked_secret_risk`.
- `authority`: always `ignite_only_wake_request_no_build_no_merge`.

Optional packet fields:

- `bridge_id`: upstream NudgeOnly bridge ID when present.
- `dedupe_key`: stable key for duplicate wake suppression.
- `prior_attempts`: compact count or IDs for recent related wakes.
- `notes`: one short sentence, no raw secrets, no broad instructions.

## Breadcrumb Location

Breadcrumbs live on the source item, not in a loose chat thread.

- For Jobs work, add the packet as a todo comment and include the todo ID in `source_id`.
- For PR work, add the packet as a PR comment or check note and include the PR number in `target`.
- For Orchestrator-only continuity, save the packet to the session receipt and point `source_kind` at the original event.
- For duplicate wake suppression, store and compare `dedupe_key` before emitting a new packet.

Do not create a new job just to hold an IgniteOnly breadcrumb. If no source item exists, return `blocked_verification_required` with the missing source named.

## Proof, Owner, And Expiry Rules

- Proof is the worker's next expected receipt, not the IgniteOnly packet itself.
- Owner stays with the existing source owner unless the source is unassigned and the target worker is the Job Manager.
- A packet may suggest a claim, but it must not assign ownership by itself.
- Default expiry is 30 minutes for stale ACK, missing proof, duplicate wake, and noisy thread packets.
- Default expiry is 60 minutes for dormant worker and unclear owner packets.
- Expired packets should be ignored unless the source still shows the same blocker after a fresh read.
- If the verifier changes, emit a new packet with a new `ignite_id` and leave the old packet as superseded.

## Lane Choice

Use the lowest-force lane that can produce the needed next receipt.

| Situation | Lane | Allowed result |
| --- | --- | --- |
| Weak signal, missing context, or a reminder only | NudgeOnly | Receipt request or advisory note. |
| Verified handoff needs a worker to wake and resume | IgniteOnly | Public wake packet with expected receipt. |
| Verified packet must be delivered into an existing worker push channel | PushOnly | Worker push envelope only. |
| Build, review, merge, close, or mutate source truth | Trusted worker lane | Actual work plus proof receipt. |

If the lane choice is unclear, fall back to NudgeOnly or return `blocked_verification_required`. IgniteOnly should never upgrade itself into PushOnly or a trusted worker action.

## Worker Routes

| Painpoint | Worker | Reason |
| --- | --- | --- |
| `stale_ack` | Reviewer | A stale ACK needs a review receipt, blocker receipt, or WakePass escalation. |
| `duplicate_wake` | Job Manager | Duplicate wakes need consolidation or a clear reason to keep both. |
| `unclear_owner` | Job Manager | A visible blocker needs an owning job and next expected receipt. |
| `missing_proof` | Builder | A claimed or expected build step needs a commit, PR, run ID, receipt, or blocker. |
| `noisy_thread` | Heartbeat Seat | Repeated pulse noise needs a compact material state receipt. |
| `dormant_worker` | Job Manager | A dormant worker lane needs a safe owner check before a specialist is woken. |

## Quality Gates

Quality beats movement. A bad wake is worse than no wake.

Hard gates:

- Require source evidence before creating a wake packet.
- Require a deterministic verifier, trusted bridge, or explicit verified flag before action.
- Prefer no wake over waking the wrong worker.
- Only route to a known worker lane.
- Emit public compact fields only.
- Every wake packet must include an `ignite_id`, source pointer, target, worker, painpoint, and receipt line.

## Evidence Trail

Every wake result includes:

- `ignite_id`: stable `igniteonly_<hash>` ID.
- `bridge_id`: upstream NudgeOnly bridge ID when present.
- `source_id` and `source_url`: upstream wake, dispatch, PR, issue, or event pointers when present.
- `wake_packet`: the compact public packet the trusted worker lane can consume.
- `receipt_line`: the worker, target, painpoint, expected receipt, and verifier.
- `authority`: always `ignite_only_wake_request_no_build_no_merge`.

Working means fewer blockers sitting visible but unowned. It is not counted as a win until the woken worker returns proof and the trusted lane records it.

## MCP Tools

- `igniteonly_policy`: returns the PinballWake/IgniteOnlyAPI guardrails.
- `igniteonly_api`: deterministic alias for the receipt consumer. It emits the same safe wake packet shape.
- `igniteonly_receipt_consumer`: consumes a NudgeOnly bridge result or direct deterministic evidence and returns `quiet`, `blocked_verification_required`, `wake_request`, or `escalation_wake_request`.


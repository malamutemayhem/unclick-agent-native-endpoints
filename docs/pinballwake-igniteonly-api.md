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


# Vercel Workflow Worker Movement Pilot

## Decision

Chris greenlit the worker-movement infrastructure split on 2026-05-16:

- Use Vercel Workflow or Vercel Queues first for short reliable background tasks.
- Use Railway only if UnClick needs a true always-running watcher or reclaimer and Vercel cannot keep that loop reliable.

This pilot should prove the Vercel path before adding a separate Railway worker.

## Job

Boardroom job: `ae075a74-86a6-450a-8986-c14fca8cecd5`

Title: Vercel Workflow pilot: worker movement proof-first job

Owner hint: `unclick-fleet-action-runner`

## Goal

Add a proof-first Vercel Workflow pilot that can run the worker-movement decision loop safely:

1. Find at most one stale or expired claim candidate.
2. Reuse the existing worker self-healing planner logic.
3. Decide whether the candidate is safe to act on.
4. Post Boardroom proof with the candidate id, owner age, decision, and next safe step.
5. Keep the current cron watcher as fallback until the pilot proves durable behavior.

## Existing Anchors

Reuse these files before creating new concepts:

- `api/fishbowl-watcher.ts`
  - Missed check-in handling.
  - Stale dispatch reclaim and reroute handling.
  - Worker self-healing todo lease signal sweep.
  - Planner-style helpers such as `planWorkerSelfHealingDecision`, `buildWorkerSelfHealingSignal`, and `planWorkerSelfHealingTodoSignal`.
- `api/lib/fishbowl-todo-handoff.ts`
  - Todo claim, refresh, release, lease expiry, and `reclaim_count` helpers.
- `api/signals-dispatch.ts`
  - Delivery path for `mc_signals` after signal creation.

## Vercel Split

Use Vercel Workflow when the pilot needs step-based durable execution, retry, pause or resume behavior, and dashboard visibility.

Use raw Vercel Queues only if the implementation needs explicit topics, consumer groups, delayed delivery, fanout, or polling outside Vercel.

Keep Railway out of this PR unless the Vercel pilot cannot provide reliable movement after proof.

## Safety Rules

The first implementation must be proof-first and non-destructive.

Do not reclaim or mutate:

- Security-gated jobs.
- Owner-auth jobs.
- Billing, DNS, secret, production deploy, or data deletion jobs.
- Jobs with a pending human decision.
- Active leases that have not expired.

Do not print lease tokens, API keys, auth values, or private credentials.

## Acceptance

- The workflow run is idempotent by todo id, lease id, or other stable candidate id.
- The default mode is dry-run or proof-only.
- Each run evaluates at most one candidate.
- Unsafe candidates produce a refusal proof instead of action.
- Stale detection and refusal paths have a small focused test.
- Boardroom proof includes candidate id, owner age, decision, and next safe step.
- The existing cron watcher remains in place as fallback.

## Suggested First Slice

Add a thin workflow route or workflow module that wraps existing planner logic and posts proof only.

Do not add a new job table. Do not add a new scheduler family. Do not introduce Railway.

The useful first PR can be as small as:

- Workflow entrypoint.
- Shared candidate decision wrapper that calls existing helpers.
- Test fixtures for one stale safe candidate and one unsafe refused candidate.
- Boardroom proof text builder.

## Current PR Slice

PR #816 now adds the workflow-ready planner shape before adding a live Workflow DevKit dependency:

- `planWorkerMovementWorkflowPilot` wraps the existing worker self-healing decision logic.
- Default mode is `dry_run`.
- The plan evaluates one candidate and emits either `start_dry_run`, `post_refusal_proof`, or `skip_no_action`.
- Security, owner-auth, billing, DNS, secrets, production deploy, data deletion, and pending human decision titles are refused before a workflow run is started.
- `buildWorkerMovementWorkflowPilotProofText` formats the Boardroom proof line.
- Tests cover a safe stale candidate, a security-gated refusal, and a no-action skip.

## Follow-Up Slice

The next proof-only slice adds `planWorkerMovementWorkflowPilotProofSignal`, which turns a dry-run planner result into a safe `mc_signals` insert row:

- Safe candidates produce `worker_movement_workflow_pilot_pass` with `severity: "info"`.
- Refused candidates produce `worker_movement_workflow_pilot_blocker` with `severity: "action_needed"`.
- Payloads carry candidate id, owner age, decision, next safe step, proof status, and emitted time.
- Lease tokens remain redacted, only `has_lease_token` is exposed.
- The helper returns null if tenant hash or emitted time is missing.

## API Entrypoint Slice

The next slice adds `/api/worker-movement-pilot` as a protected dry-run entrypoint:

- Auth uses the same `Bearer ${CRON_SECRET}` pattern as the existing watcher jobs.
- Each run fetches at most one expired Boardroom todo lease candidate.
- The route reuses `planWorkerMovementWorkflowPilot` and `planWorkerMovementWorkflowPilotProofSignal`.
- It inserts PASS or BLOCKER proof into `mc_signals` only.
- It dedupes proof for the same candidate and signal action for 30 minutes.
- It does not reclaim, release, reassign, complete, or mutate the todo lease.
- A later Workflow wrapper can call this route once the proof-only behavior is stable.

## Scheduler Gate Slice

The scheduler-ready slice adds a quiet Vercel cron call to `/api/worker-movement-pilot` every 15 minutes.

- The endpoint still requires `Bearer ${CRON_SECRET}`.
- The endpoint now also requires `WORKER_MOVEMENT_PILOT_ENABLED` to be `1`, `true`, or `enabled`.
- With `WORKER_MOVEMENT_PILOT_ENABLED` unset, the cron call returns `skip_disabled` without querying todos or inserting proof.
- With `WORKER_MOVEMENT_PILOT_ENABLED` enabled but `WORKER_MOVEMENT_PILOT_PROOF_WRITES_ENABLED` unset, the route can fetch and plan one expired candidate, then returns `proof_planned` without dedupe checks or `mc_signals` inserts.
- `mc_signals` proof writes require `WORKER_MOVEMENT_PILOT_PROOF_WRITES_ENABLED` to be `1`, `true`, or `enabled`.
- This lets production exercise the protected route and candidate planner safely before Chris or an operator enables proof inserts.

## Proof-Write Gate Slice

The proof-write gate adds a second opt-in around signal insertion:

- `WORKER_MOVEMENT_PILOT_ENABLED` means the pilot may read one expired lease candidate and build a dry-run plan.
- `WORKER_MOVEMENT_PILOT_PROOF_WRITES_ENABLED` means the pilot may dedupe and insert PASS or BLOCKER proof into `mc_signals`.
- If proof writes are disabled, the route does not call `hasRecentProof` or `insertProof`.
- Focused tests cover safe PASS planning, BLOCKER refusal planning, explicit proof-write env parsing, and the existing insert path.

## Proof Trail

- Greenlight receipt: `876f228a-38fa-45a3-8373-d24a319a0670`
- Job request receipt: `4a35502c-4c36-44a4-a860-0eb74a1f8b4c`
- Prior Worker self-healing todo: `2889ee70-9e9c-4568-b172-81769e0baa39`
- Prior scoping comments: `546cf029-eae9-4ee6-a92f-3550a7d5f2fe`, `7281ff3e-a29c-4b50-97a1-bfa6c753d1bc`, `b4a4b5ad-664d-43d5-bdd4-0e687e7e9f06`, `0c75d639-cb14-435d-a5cb-6b41ac0bab51`, `0d037a4c-c768-4e34-80a5-076af452b19d`

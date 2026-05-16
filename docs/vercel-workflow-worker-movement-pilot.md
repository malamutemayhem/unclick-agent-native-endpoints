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

## Proof Trail

- Greenlight receipt: `876f228a-38fa-45a3-8373-d24a319a0670`
- Job request receipt: `4a35502c-4c36-44a4-a860-0eb74a1f8b4c`
- Prior Worker self-healing todo: `2889ee70-9e9c-4568-b172-81769e0baa39`
- Prior scoping comments: `546cf029-eae9-4ee6-a92f-3550a7d5f2fe`, `7281ff3e-a29c-4b50-97a1-bfa6c753d1bc`, `b4a4b5ad-664d-43d5-bdd4-0e687e7e9f06`, `0c75d639-cb14-435d-a5cb-6b41ac0bab51`, `0d037a4c-c768-4e34-80a5-076af452b19d`

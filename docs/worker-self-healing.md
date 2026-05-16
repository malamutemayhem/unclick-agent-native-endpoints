# Worker self-healing

Closes UnClick todo "Worker self-healing: heartbeat timeout, reclaim, and resume-safe queue behavior" (green-lit efficiency build 2026-05-07).

## What it does

A pure module that takes a snapshot of every seat in the fleet (last_seen + their open claims) and returns a structured health report plus a list of reclaim recommendations.

```ts
import { evaluateFleetHealth, safeReleaseTargets } from "~/lib/workerHealthMonitor";

const report = evaluateFleetHealth([
  { id: "pinballwake-job-runner", last_seen: "2026-05-15T03:55:00Z", open_claims: [{ todo_id: "T1", claimed_at: "...", eta: null, resume_safe: true }] },
  { id: "claude-cowork-seat",     last_seen: "2026-05-09T10:00:00Z", open_claims: [] }, // dormant since May 9
  { id: "chatgpt-codex-desktop",  last_seen: "2026-05-15T03:50:00Z", open_claims: [{ todo_id: "T2", claimed_at: "...", eta: "2026-05-15T05:00:00Z" }] },
], new Date("2026-05-15T04:00:00Z"));

// report.buckets.{healthy, idle, stale, suspected_dead}
// report.reclaim_recommendations — one per todo that should be released
// safeReleaseTargets(report) — subset that can be auto-released without operator OK
```

## Status thresholds (default)

| Status | Age since last_seen |
|---|---|
| healthy | < 30 minutes |
| idle | 30 min – 4 h |
| stale | 4 h – 24 h |
| suspected_dead | > 24 h OR last_seen null |

Override with `options.idleThresholdMs`, `staleThresholdMs`, `deadThresholdMs`.

## Reclaim reasons

| Reason | When it fires |
|---|---|
| `seat_stale` | Owning seat is in the `stale` bucket. |
| `seat_suspected_dead` | Owning seat is in `suspected_dead`. Always `safe_to_release: true`. |
| `claim_eta_expired` | Claim's declared ETA is more than 1 h ago (configurable) with no PASS receipt. Fires even when seat is healthy. |

## Resume-safe vs not

Each claim carries a `resume_safe` flag. A claim is **resume-safe** when another seat can pick it up mid-stream without losing data — for example, a freshness check or a route nudge. A claim is **not resume-safe** when the seat is partway through writing code that hasn't landed yet.

When a stale seat holds a non-resume-safe claim, the monitor returns `safe_to_release: false` and the caller routes to `pendingChrisDecision(report)` for human approval. When a seat is `suspected_dead`, claims are always treated as safe to release — the original isn't coming back.

## How this hooks into existing fleet authorities

The runbook's **dormant-owner-requeue** authority already handles releasing claims (comment + `update_todo` to clear `assigned_to_agent_id`). This module supplies the *input* — which seats and claims qualify. The autonomous runner can call `evaluateFleetHealth` each tick, then act on `safeReleaseTargets(report)` directly and surface `pendingChrisDecision(report)` to the Boardroom for human routing.

Integration pseudocode:

```ts
const report = evaluateFleetHealth(snapshot, new Date());
for (const todoId of safeReleaseTargets(report)) {
  await releaseDormantClaim(todoId, /* greenlit by standing authority */);
}
const pending = pendingChrisDecision(report);
if (pending.length > 0) {
  await postBoardroomNote({
    body: `🛎 ${pending.length} stale claim(s) need a human OK before release. Details: ${JSON.stringify(pending, null, 2)}`,
  });
}
```

## Why a pure module (no DB / no MCP)

`evaluateFleetHealth` is dependency-free. The caller fetches snapshots from whichever source (UnClick MCP, GitHub PRs, Boardroom heartbeats), passes them in, gets a deterministic report. That makes the algorithm trivially testable and lets the rest of the fleet stack mock it in their own tests.

## Acceptance (ScopePack 10%)

- [x] `evaluateSeatHealth` returns one of `healthy / idle / stale / suspected_dead` based on `last_seen` age.
- [x] Each open claim gets a reclaim recommendation when the seat or ETA is past threshold.
- [x] `safe_to_release` distinguishes auto-releasable from human-OK-needed.
- [x] Tests cover threshold transitions, ETA grace window, resume_safe handling, pinned_healthy override, and the fleet-level bucketing.

## Non-goals

- No state persistence — every call is stateless. Caller stores history if it wants.
- No automatic execution — this module recommends; the caller releases.
- No identity verification of seats — assumes the caller's snapshot is trustworthy.

## Source

Drafted 2026-05-15 by `claude-cowork-coordinator-seat`. Files in `Z:\Other computers\My laptop\G\CV\_unclick-drafts\worker-self-healing\`.

# @unclick/commonsensepass

Rule-and-evidence sanity gate for AI/worker claims. Verdict-only: does not build, merge, close, or mutate source state. Workers call `commonsensepassCheck(input)` before claiming `healthy`, `quiet`, `no_work`, `pass`, `done`, `merge_ready`, or `duplicate_wake`, and respect the returned verdict.

## Verdicts

- `PASS` - claim is consistent with the evidence; safe to proceed.
- `BLOCKER` - claim is contradicted by evidence; do not proceed. Includes a `next_action`.
- `HOLD` - claim is missing required evidence; supply it and retry.
- `SUPPRESS` - claim is a duplicate / no-op; drop it silently.
- `ROUTE` - claim is valid but should be handled elsewhere (reserved; not emitted by R1-R5).

## Rules (baseline)

| Rule | Triggers on claim | Checks |
| ---- | ----------------- | ------ |
| R1   | `healthy` / `quiet` / `no_work` | Active-state mismatch: actionable queue depth > 0, or `active_jobs=0` while in-progress todos have a fresh owner (within 24h, matches the pinned formula in `orchestrator-context.ts`). |
| R2   | `pass`            | Head SHA freshness: PASS authored on `commented_on_sha` that does not match `current_head_sha` is stale. |
| R3   | `duplicate_wake`  | Wake suppression: same `id` and `state_fingerprint` emitted within the duplicate-wake window. |
| R4   | `done`            | Done-without-proof: requires `pipeline === 100` AND a `closing_ref` on the subject todo. |
| R5   | `merge_ready`     | Merge-ready-without-proof: PR must be mergeable, checks green, and have Reviewer PASS plus Safety PASS authored on the current head SHA. |

The worker-facing rule matrix and next candidate backlog live in `docs/commonsensepass-rule-matrix.md`.

## Fixture Pack

Workers can import `COMMONSENSEPASS_WORKER_FIXTURES` when they need stable local examples instead of waiting on live queue, wake, or PR state.

```ts
import {
  COMMONSENSEPASS_WORKER_FIXTURES,
  commonsensepassCheck,
} from "@unclick/commonsensepass";

for (const fixture of COMMONSENSEPASS_WORKER_FIXTURES) {
  const result = fixture.reserved_result ?? commonsensepassCheck(fixture.input!);
  console.log(fixture.id, result.verdict);
}
```

The pack covers PASS, BLOCKER, HOLD, SUPPRESS, and the reserved ROUTE verdict. Named scenarios include false quiet, stale proof, duplicate wake, no-work-with-backlog, merge-ready-without-proof, and done-without-proof. ROUTE is included as a reserved exemplar only; R1-R5 do not emit it yet.

## Evidence Receipts

Workers can wrap proof in a deterministic evidence envelope before claiming PASS, done, or merge-ready.

```ts
import {
  checkEvidenceEnvelope,
  finalizeEvidenceReceipt,
} from "@unclick/commonsensepass";

const receipt = finalizeEvidenceReceipt({
  source_kind: "pr",
  source_id: "893",
  fetched_at: new Date().toISOString(),
  head_sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  run_id: "run-893",
  proof_refs: ["checks:success", "pr:893"],
  freshness_window_ms: 30 * 60 * 1000,
});

const verdict = checkEvidenceEnvelope(
  { created_at: receipt.fetched_at, receipts: [receipt] },
  { now_ms: Date.now(), current_head_sha: receipt.head_sha },
);
```

The accepted receipt fields are `source_kind`, `source_id`, `fetched_at`, `head_sha`, `run_id`, `proof_refs`, `evidence_fingerprint`, and `freshness_window_ms`. Missing required proof returns `HOLD`; stale timestamps, stale head SHA, or fingerprint mismatch return `BLOCKER`.

## Usage

```ts
import { commonsensepassCheck } from "@unclick/commonsensepass";

const result = commonsensepassCheck({
  claim: "healthy",
  context: {
    now_ms: Date.now(),
    todos: [...],
    active_jobs: 0,
  },
});

if (result.verdict !== "PASS") {
  // do not emit the heartbeat-healthy claim; act on result.next_action
}
```

## Boundaries

This package only inspects claims and returns a verdict. It does not:

- Mutate todos, PRs, comments, or any external state.
- Close todos or merge PRs.
- Emit wakes or schedule work.

Workers and orchestrators are responsible for acting on the verdict.

## Related

- Active-state v9 formula pinned in `api/lib/orchestrator-context.ts` (`computeActiveJobsCount`) and `packages/mcp-server/src/heartbeat-protocol.ts` step 5 (PR #735).

# CommonSensePass Rule Matrix

CommonSensePass is a verdict-only sanity gate. It checks a worker claim against a small evidence packet and returns `PASS`, `BLOCKER`, `HOLD`, `SUPPRESS`, or `ROUTE`. It does not build, merge, close jobs, mutate data, or decide product direction.

This matrix turns the current R1 to R5 implementation into worker-readable rules, then names the next candidate rules so future chips can extend the pass without guessing.

## Current MVP

| Rule | Claim type | Verdict effect | Required proof | False-positive risk | Owner lane | Implementation point |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | `healthy`, `quiet`, `no_work` | `BLOCKER` when work is waiting or active job count is underreported. `PASS` when queue and active job evidence agree. | Actionable queue count, fresh in-progress todos, `active_jobs`, current time. | Medium: stale owner heartbeats or missing queue rows can make real work look absent or present. | Orchestrator, Heartbeat, QueuePush | `packages/commonsensepass/src/rules.ts::checkR1` |
| R2 | `pass` | `HOLD` when SHA evidence is missing. `BLOCKER` when the PASS was written on an old head. `PASS` when authored on current head. | `current_head_sha`, `commented_on_sha`. | Low: only compares exact SHAs. Risk is missing SHA capture, not ambiguous judgment. | Review, Safety, PR workers | `packages/commonsensepass/src/rules.ts::checkR2` |
| R3 | `duplicate_wake` | `SUPPRESS` when the same wake id and state fingerprint repeats inside the duplicate window. `PASS` when it is new. | Current wake id, current state fingerprint, recent wakes, emitted timestamps, current time. | Medium: a coarse fingerprint can suppress a useful wake, while a noisy fingerprint can allow duplicates. | WakePass, Heartbeat, QueuePush | `packages/commonsensepass/src/rules.ts::checkR3` |
| R4 | `done` | `HOLD` when the subject todo is missing. `BLOCKER` when done lacks proof. `PASS` when pipeline is 100 and a closing reference exists. | Subject todo id, todo pipeline, closing PR or commit reference. | Low: deterministic proof gate. Risk is a valid close reference not yet attached to the todo. | Job Runner, Boardroom, PR workers | `packages/commonsensepass/src/rules.ts::checkR4` |
| R5 | `merge_ready` | `HOLD` for missing PR, reviewer PASS, or safety PASS. `BLOCKER` for conflicts, red checks, or stale passes. `PASS` when all merge gates are green on head. | PR number, head SHA, mergeable state, check state, Reviewer PASS on head, Safety PASS on head. | Low to medium: external check state can lag, and review labels must be parsed consistently. | Review, Safety, Autopilot merge | `packages/commonsensepass/src/rules.ts::checkR5` |

## Worker Usage Rules

| Situation | Worker action |
| --- | --- |
| Claiming nothing is waiting | Run R1 before saying `healthy`, `quiet`, or `no_work`. |
| Posting PASS on a PR or job | Run R2 when a head SHA is involved. Attach the SHA in the receipt. |
| Handling scheduled wakes | Run R3 before emitting duplicate wake status. |
| Closing a Boardroom job | Run R4 before saying done. Attach the closing PR or commit. |
| Merging or queueing merge-ready PRs | Run R5 before merge-ready. Do not merge on stale reviewer or safety evidence. |

## Next Candidate Rules

| Candidate | Claim type | Verdict effect | Required proof | False-positive risk | Owner lane | Likely implementation point |
| --- | --- | --- | --- | --- | --- | --- |
| R6 protected surface gate | `merge_ready`, `done`, `pass` | `HOLD` or `BLOCKER` when the change touches secrets, billing, DNS, production data mutation, force push, credential rotation, or destructive SQL without explicit authorization. | Changed files, protected-surface labels, owner authorization receipt id. | Medium: filename matching can overflag migrations and docs. Needs explicit override receipt. | Safety, SecurityPass, Autopilot merge | Extend `ClaimContext` with `changed_files`, `protected_surfaces`, `authorization_receipts`. |
| R7 stale claim lease | `done`, `pass`, `merge_ready` | `HOLD` when the claiming seat has no fresh check-in or its claim is older than the policy window. | Claim timestamp, owner id, owner last seen timestamp, lease window. | Medium: offline but completed workers may be held until proof is posted. | Orchestrator, Boardroom | Extend `TodoSnapshot` with claim timestamps and lease expiry. |
| R8 active conflict guard | `pass`, `done`, `merge_ready` | `BLOCKER` when another fresh owner has a conflicting claim on the same job, PR, or files. | Current claim, active claims, owner timestamps, owned files. | Medium: claims can be stale or too broad. Needs freshness filter. | Boardroom, Job Runner | Add claim snapshot list to `ClaimContext`. |
| R9 missing ScopePack | `pass`, `done` | `HOLD` when work starts or completes without exact files, proof path, and stop conditions. | Todo scope pack, owned files, verification command, stop conditions. | Low: early scoping jobs may be intentionally broad. Allow `claim_type=scoping`. | Boardroom, Job Runner | Add `scope_pack` evidence to todo snapshots. |
| R10 proof freshness window | `pass`, `merge_ready`, `done` | `BLOCKER` when proof is older than the latest code or state change. | Proof timestamp, proof subject id, current head SHA or job updated timestamp. | Medium: non-code docs may not need full rerun. Needs proof kind. | Review, TestPass, PR workers | Add proof refs with `fetched_at` and `subject_revision`. |
| R11 reviewer independence | `merge_ready` | `HOLD` when builder and reviewer are the same seat and policy requires independent review. | Builder id, reviewer id, policy flag, review receipt. | Low: solo autopilot lanes may explicitly allow self-review. | Review, Safety | Extend PR snapshot with builder and reviewer ids. |
| R12 stale queue health | `healthy`, `quiet`, `no_work` | `BLOCKER` when queue health was computed from stale Boardroom, Jobs room, or Orchestrator reads. | Read timestamps, source freshness window, queue counts. | Medium: transient API lag could block a true quiet state. | Heartbeat, Orchestrator | Add source freshness metadata to R1 input. |
| R13 no-op status spam | `duplicate_wake`, `pass` | `SUPPRESS` when the new receipt says the same thing with the same proof id and no state delta. | New receipt fingerprint, prior receipt fingerprint, proof id, state delta. | Low: useful repeated proof may be suppressed unless state delta is included. | WakePass, Boardroom | Extend R3 beyond wakes to receipt fingerprints. |
| R14 route specialist needed | `pass`, `done`, `merge_ready` | `ROUTE` when the claim needs a specialist lane before proceeding. | Touched surfaces, lane map, missing specialist proof. | Medium: over-routing can slow simple work. Needs narrow lane map. | XPass, Bench specialists | First use of reserved `ROUTE` verdict. |
| R15 manual decision needed | `pass`, `done`, `merge_ready` | `HOLD` when the next step needs Chris or owner choice instead of more worker action. | Decision type, options, missing authorization, current owner. | Low: should be rare and explicit. | Orchestrator, Boardroom | Add decision-required evidence shape. |

## Fixture Targets

Each implemented rule should have at least one `PASS` fixture and one non-pass fixture. The current test file is `packages/commonsensepass/src/__tests__/check.test.ts`.

| Rule | Required fixture names |
| --- | --- |
| R1 | `healthy_with_empty_queue_pass`, `quiet_with_actionable_queue_blocker`, `no_work_with_fresh_active_job_blocker` |
| R2 | `pass_on_current_head_pass`, `pass_missing_sha_hold`, `pass_on_old_head_blocker` |
| R3 | `duplicate_wake_same_fingerprint_suppress`, `duplicate_wake_missing_current_hold`, `new_wake_pass` |
| R4 | `done_with_pipeline_and_closing_ref_pass`, `done_missing_subject_hold`, `done_without_closing_ref_blocker` |
| R5 | `merge_ready_all_green_pass`, `merge_ready_missing_reviewer_hold`, `merge_ready_stale_safety_blocker`, `merge_ready_red_checks_blocker` |

## Proof Envelope

CommonSensePass receipts should include:

- `claim`
- `rule_id`
- `verdict`
- `reason`
- `evidence[]`
- `next_action` when verdict is not `PASS`
- `source_kind`
- `source_id`
- `fetched_at`
- `head_sha` when a PR or commit is involved
- `proof_refs[]`
- `evidence_fingerprint`

## Stop Conditions

Do not expand CommonSensePass into an executor. If a rule needs to mutate a PR, todo, database, credential, schedule, or production surface, the rule should return a verdict and next action only. Another worker or deterministic tool owns the action.

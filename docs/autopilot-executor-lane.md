# Autopilot Executor Lane

The Autopilot Executor Lane is the narrow builder lane that turns one verified UnClick execution packet into one bounded build attempt.

It exists so heartbeat, PinballWake, BuildBait, and Jobs room routing can move from "work is visible" to "one safe worker can act" without giving any worker broad merge, deploy, schedule, or cleanup authority.

## Purpose

Use this lane when a Jobs room item already has a ScopePack and needs a write-capable builder to do exactly one bounded step.

The lane may:

- accept one eligible execution packet at a time
- check that the packet has owned files, acceptance, verification, stop conditions, proof requirements, and CommonSensePass evidence
- route a valid packet to a builder seat
- record claim, build attempt, proof, HOLD, or BLOCKER receipts
- refuse incomplete or contradictory packets with the first missing reason

The lane must not:

- create extra Codex or local schedules
- change GitHub workflow authority
- merge PRs by itself
- mark Jobs todos complete by itself
- change assignments outside the claimed packet
- deploy to production
- touch secrets, billing, DNS, data deletion, force push, or migrations
- execute arbitrary shell commands that are not explicitly named by the packet and allowed by CommonSensePass

## Required Packet

An executor packet is eligible only when it contains all of these fields.

| Field | Required meaning |
| --- | --- |
| `repo` | GitHub repo or local repo hint for the bounded work. |
| `branch_or_worktree` | Existing branch/worktree or the exact branch/worktree to create. |
| `owned_files` | Exact file list the builder may change. Empty ownership is a blocker. |
| `acceptance` | Plain acceptance checks for the one step. |
| `verification` | Smallest meaningful test or proof command list. |
| `stop_conditions` | Conditions that make the lane stop and post HOLD or BLOCKER. |
| `proof_required` | Required receipt shape before PASS can be posted. |
| `commonsensepass_result` | Precheck evidence that the packet is safe to run. |

Any missing field returns HOLD or BLOCKER before edits.

## CommonSensePass Gate

CommonSensePass is a pre-execution gate, not a rubber stamp.

It must reject or pause packets when:

- the packet asks for work outside `owned_files`
- verification is missing, vague, or impossible to run
- stop conditions are absent
- the packet asks for deploy, billing, DNS, secret, data deletion, force push, schedule expansion, or merge authority
- another fresh claim exists inside the current no-overlap window
- the branch, path, or repo does not match live state

If the gate blocks, the lane records the exact reason and the smallest next unblock step.

## Builder Flow

1. Read Memory, Orchestrator, Boardroom, Jobs room, and live repo or PR state.
2. Check for a fresh claim in the last 30 minutes.
3. Post an ACK/CLAIM with seat, job or PR, exact scope, next step, ETA, and blocker status.
4. Validate the executor packet.
5. Create or use the named branch or worktree.
6. Change only the owned files.
7. Run the smallest meaningful verification.
8. Post a proof receipt to the Jobs todo and Boardroom.
9. Stop at PASS, HOLD, or BLOCKER.

## Receipt Rules

PASS requires at least one material proof pointer:

- commit hash
- PR link
- test or check output summary
- run ID
- Jobs comment ID
- Boardroom message ID

HOLD is used when the lane intentionally skipped because another fresh claim, fresh lease, or owner is active.

BLOCKER is used when work cannot safely continue. The blocker must include what was checked, the proof pointer, and the smallest missing thing.

## Non-Overlap Rules

The lane only works inside the exact packet scope.

Do not combine this lane with BuildBait crumb sequencing, Orchestrator story UI, Jobsmith product work, or quiet-window proof helper creation unless the current packet explicitly owns those files.

When another worker is active, leave a proof comment instead of writing over their work.

## Verification Baseline

For the current executor-lane ScopePack, the expected verification is:

```bash
node --test scripts/pinballwake-autonomous-runner.test.mjs scripts/pinballwake-build-executor.test.mjs
npm run test -- api/worker-lanes.test.ts api/fishbowl-todo-handoff.test.ts
git diff --check
```

If a command cannot be run, the receipt must say why and name the command that would verify the work.


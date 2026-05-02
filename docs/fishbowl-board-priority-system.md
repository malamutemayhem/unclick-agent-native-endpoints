# Fishbowl Board Priority System

This document defines how workers should classify the Fishbowl todo board so a large list stays usable.

The goal is not to make the board small. The goal is to make the board truthful and easy to act on.

## Priority Lanes

Use these five lanes when triaging or commenting on todos.

| Lane | Meaning | Worker action |
| --- | --- | --- |
| NOW | Active release-lane work | Pick up, review, merge, or unblock soon |
| NEXT | Important but behind NOW | Keep ready, but do not interrupt NOW |
| LATER | Useful backlog | Leave open with a clear next action |
| PARKED | Intentionally not active | Keep as a tracker, do not wake workers |
| BLOCKED | Cannot move without external input | State the exact blocker and owner |

These lanes can be represented in comments, titles, tags, or future UI. Do not require a schema change for the first pass.

## Current NOW Stack

The current ring-fence order is:

1. Clean PR review and merge queue.
2. Old dirty PR close, slice, or rebuild decisions.
3. Connectors and RotatePass visibility.
4. WakePass and PinballWake reliability.
5. TestPass proof gate and scheduled receipts.
6. Fishbowl admin Action lane and worker readability.
7. Evidence-based board housekeeping.

Workers should choose from this stack before pulling random lower-priority work.

## Lane Rules

### NOW

Use NOW for work that directly improves current operations or release confidence.

Examples:

- Clean green PRs awaiting review.
- Current Connectors or RotatePass slices.
- WakePass missed-ACK reliability.
- TestPass proof and fail-closed checks.
- Fishbowl board readability blockers.
- Stale worker or cold-route fixes.

NOW work should have:

- Clear owner or unclaimed status.
- Clear next action.
- Low overlap risk.
- Recent evidence.

### NEXT

Use NEXT for work that is valuable soon but should not interrupt the NOW stack.

Examples:

- Follow-on UI improvements after a spec merges.
- Additional dogfood proofs after the core receipt works.
- Small hardening tests for already-landed behavior.
- Non-urgent admin usability polish.

NEXT work should be ready for a worker to pick up when NOW queue drains.

### LATER

Use LATER for valid backlog that is not release-critical.

Examples:

- Future Pass expansion.
- Marketplace polish.
- Search Console cleanup.
- Directory submissions.
- Long-tail memory features.

LATER todos should still have a one-line next action. If nobody can state the next action, clarify or park it.

### PARKED

Use PARKED for intentional trackers.

Examples:

- Master trackers for future product lanes.
- Research reminders.
- Future browser extension ideas.
- Pass products waiting for proof rails.

PARKED items should not wake workers. They are memory anchors, not active work.

If the current board view has no lane filter, do not rely on a `PARKED:` or `FUTURE:` title prefix alone. An open card can still appear in actionable queues.

Use this rule:

- Keep a PARKED item open only when it has a real next action and should remain visible to workers soon.
- If the next action is intentionally "not now", leave an evidence comment and move the todo to `dropped`.
- Treat `dropped` as "parked for history", not "deleted".
- Create a fresh open todo when the parked lane becomes active again.

### BLOCKED

Use BLOCKED when work cannot move without a specific external input.

Examples:

- Secret/token/env change needed from Chris.
- Auth, billing, DNS, domain, migration, or security approval needed.
- Provider access missing.
- Upstream CI or platform outage.

BLOCKED items must say:

- Who owns the unblock.
- What exact input is needed.
- What happens after unblock.

## Triage Rules

When a worker handles a stale todo:

1. Check linked PRs, comments, and recent Fishbowl messages.
2. Decide lane: NOW, NEXT, LATER, PARKED, or BLOCKED.
3. Add a short evidence comment.
4. Close only if done.
5. Drop if obsolete, superseded, or intentionally parked with no current next action.
6. Do not bulk delete.

Good comment format:

```text
lane: PARKED
evidence: SecurityPass tracker is still useful, but current NOW stack is TestPass proof + RotatePass + WakePass reliability.
next: revisit after proof rails are stable.
```

## Merge Queue Rules

Clean green PRs are normally NOW if they are:

- Docs-only.
- Test-only.
- Low-risk reliability hardening.
- Small Connectors or RotatePass visibility improvements.
- Small Fishbowl readability improvements.

Hold PRs when they are:

- Dirty.
- Failing checks.
- Draft without owner lift.
- Auth, secrets, billing, DNS, migrations, security, analytics, or provider settings.
- Old branches that conflict with newer landed work.

Old dirty PRs should usually become:

- CLOSE if superseded.
- SLICE if a small useful part remains.
- REBUILD if the idea is still valid but the branch is stale.
- HOLD if it touches gated surfaces.

## Housekeeping Cadence

Scheduled board housekeeping should make one careful improvement per run.

Preferred actions:

- Close one done todo with evidence.
- Drop one obsolete todo with evidence.
- Add one lane comment to a vague todo.
- Clarify one stale title.
- Identify one blocker for Chris.

Avoid:

- Bulk deletion.
- Large renaming waves.
- Reprioritizing many items without context.
- Closing because old.

## Public Product Notes

If Fishbowl becomes public-facing, these lanes can become visible board filters:

- Now
- Next
- Later
- Parked
- Blocked

The public product should make it normal to have a large backlog without making users feel lost.

The win is not a tiny list. The win is a list where every item has a truthful state.


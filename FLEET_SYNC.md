# UnClick Fleet Sync

This is the current operating agreement for UnClick workers across Lenovo, Plex, cloud agents, scheduled automations, and future worker hosts.

Read this first when a worker starts, resumes, or is spawned into an existing lane. Older courier notes are historical references. This file is the live alignment layer.

## Source Of Truth Order

When instructions conflict, use this order:

1. Direct instruction from Chris in the current chat or Fishbowl assignment.
2. This file.
3. `AUTOPILOT.md` for autonomy tiers and scheduled worker policy.
4. `CLAUDE.md` for repo architecture and tool surface.
5. `AGENTS.md` for cloud async proof, scope, and platform safety rules.
6. Historical external notes such as old courier setup guides.

If two repo docs conflict, stop and open a small docs alignment PR instead of guessing.

## Core Workflow

- GitHub `main` is the code source of truth.
- Pull requests are the unit of change.
- Fishbowl is the coordination room for todos, handoffs, ideas, worker status, and blockers.
- UnClick memory is long-term context, not a substitute for live GitHub and Fishbowl state.
- Automations are workers. They must follow the same safety and no-stomp rules as chat workers.
- PinballWake and WakePass are the reliability layer for action-needed handoffs.

Every material task should move through this path:

1. Refresh live GitHub, Actions, and Fishbowl state.
2. Confirm the work is unclaimed or explicitly assigned.
3. Claim one small chip.
4. Work in a branch or worktree.
5. Open a draft PR first when risk is unclear.
6. Run focused verification.
7. Post Fishbowl status and set next check-in.
8. Lift from draft only when scope is clean and checks are green.
9. Merge only under the current merge policy.
10. Close or update linked Fishbowl todos after merge.

## Local Workspace And Google Drive

`C:\G\UnClick` is a shared project workspace that may exist on Lenovo and Plex through Google Drive sync.

Use it for:

- Shared reference notes.
- Research dumps.
- Drafts and deliverables.
- Cross-PC handoff files.
- Worker setup notes.

Do not treat Google Drive as the code source of truth. GitHub is the code source of truth.

High-risk pattern:

- Lenovo and Plex both editing the same synced Git repo folder at the same time.
- Google Drive syncing `.git` internals while a worker is committing, rebasing, switching branches, or installing dependencies.
- Multiple workers using one synced `repos/<repo>` checkout as if it were a shared live worktree.

Safer pattern:

- Each PC and worker uses its own local clone or worktree for code changes.
- Workers exchange code through Git branches and PRs, not Google Drive file sync.
- `C:\G\UnClick` can hold notes, references, and delivered reports that help workers understand context.
- If a Git repo exists under `C:\G\UnClick\repos`, only one host should actively write to that checkout at a time.
- Before using a synced checkout, refresh from GitHub and confirm no other worker owns the same files.

If a worker is unsure whether a checkout is shared, assume it is shared and use it read-only until ownership is clear.

Memory-independent guardrails:

- Put the same rule in local workspace notes, repo docs, and worker prompts.
- Treat any checkout under a synced cloud folder as read-mostly unless ownership is explicit.
- A worker with bad memory should still be safe if it follows the start ritual: read this file, inspect Git status, inspect Fishbowl ownership, then claim one chip.
- If `git status` shows unexpected changes, stop and report before editing.
- If the checkout path includes Google Drive, OneDrive, Dropbox, or another sync layer, do not rebase, force-push, install dependencies, or run broad generated writes until the worker confirms it owns that checkout.
- Prefer a fresh local clone outside synced storage for implementation work.

## New Machine Onboarding

Any future Lenovo, Plex, cloud VM, laptop, server, or hosted worker must onboard before doing code work.

Minimum onboarding:

1. Identify the machine and worker lane in Fishbowl.
2. Confirm which local paths are shared cloud folders and which are private local clones.
3. Read this file and `AUTOPILOT.md`.
4. Create or select a private implementation checkout that is not a shared synced checkout.
5. Verify GitHub auth can push branches, not main.
6. Verify the worker can read Fishbowl and post status.
7. Run one read-only scout task before the first code PR.
8. Post an onboarding ACK with machine name, worker lane, code checkout path, shared reference path, and next check-in.

Do not let a new machine start by picking a random open PR or editing the shared Google Drive checkout.

Recommended path pattern:

- Shared reference: `C:\G\UnClick`
- Private implementation clone: a machine-local path outside Google Drive, OneDrive, Dropbox, or other synced storage
- Coordination: Fishbowl
- Code exchange: GitHub PRs

## Hard Stops

A worker must stop and ask or post a blocker when any of these are true:

- The worker does not know whether its checkout is shared or private.
- `git status` shows unexpected local changes.
- Another worker owns the same files or PR surface.
- The task touches secrets, env vars, auth, billing, DNS, domains, migrations, RLS, CSP, analytics, or provider settings.
- The task requires force-pushing a branch owned by another worker.
- Checks are failing and the proposed fix is to weaken the gate.
- The worker is about to use Google Drive sync as a replacement for GitHub branches and PRs.

## Worker Roster

Current common worker lanes:

| Lane | Common name | Main role |
| --- | --- | --- |
| Human | Chris | Final authority for secrets, billing, domains, legal, risky merges, and strategy |
| Lenovo Claude | Bailey or Wolf | Original orchestrator, sentinel, queue hygiene, continuity checks |
| Lenovo Codex | Codex worker | Backlog drain, PR review, code chips, board hygiene |
| Plex ChatGPT | Plex builder | High-throughput implementation lane |
| Plex Claude | Claude Plex or Popcorn | QC, heartbeat, merge-readiness, and code-dispatch when local courier is available |
| Navigator | Navigator | Scout, review, and next-chip recommendation |
| Relay | Relay | Simple status, cross-worker summaries, handoff clarity |
| Forge | Forge | Focused implementation lane |
| XPass Assistant | XPass assistant | Pass-family proof, TestPass, UXPass, SecurityPass, and dogfood lanes |
| Scheduled automations | Cron workers | Repeated health checks, triage, safe build lanes, and continuity audits |

Names may vary between chats. The lane and live Fishbowl status matter more than the display name.

## Start Or Resume Ritual

Every worker should do this before acting:

1. Pull or inspect latest `main`.
2. Read this file, then `AUTOPILOT.md`.
3. Check open PRs and recent merged PRs.
4. Check Fishbowl direct mentions, assigned todos, and current worker statuses.
5. Check whether the intended files are already owned by another active worker.
6. Post or update worker status if starting material work.
7. Choose one small chip or report the exact blocker.

Do not act from stale queue memory.

## No-Stomp Rules

- One builder owns a PR surface.
- Helpers may scout, test, or review, but must not edit the same files as the builder.
- Do not force-push another worker's branch.
- Do not rework a merged lane unless there is a fresh bug or explicit assignment.
- If two workers overlap, the later worker stops, posts what they found, and pivots.
- If a worker is cold, stale, or unreachable, use WakePass reclaim or Fishbowl handoff before taking over.

## Autopilot Rules

Autopilot is allowed when it is small, reversible, and covered by `AUTOPILOT.md`.

Autopilot workers may:

- Close or clarify stale Fishbowl todos with evidence.
- Review clean green PRs.
- Ship tiny docs alignment PRs.
- Ship tiny reliability, wake, or board-hygiene chips.
- Continue approved Connectors, RotatePass, Pass proof, and PinballWake lanes within stated safety limits.
- Post clear handoffs when blocked.

Autopilot workers must not:

- Touch secrets, env files, billing, domains, DNS, auth provider settings, migrations, RLS, CSP, or security policy.
- Print raw secret values.
- Add broad new vault, browser extension, or provider-write behavior without approval.
- Merge failing checks.
- Turn quiet health checks into noisy wake loops.
- Start a broad refactor or new product lane because it seems useful.

## PinballWake And WakePass

Use PinballWake for action-needed handoffs that expect an ACK.

Wrap these:

- Direct worker handoffs.
- Assigned todo that needs a worker.
- Failed scheduled jobs that need action.
- Stuck TestPass, UXPass, SecurityPass, or dogfood proof.
- PR ready-review or blocker-cleared events that need a reviewer.
- Cold worker or missed next-check-in recovery.

Do not wrap these:

- Quiet health checks.
- Dashboard reads.
- Successful receipts.
- No-op heartbeats.
- Broad all-hands chatter.
- Green-check echo events that do not require a worker.

The normal pattern is:

`dispatch proof -> owner -> ACK required -> 10 minute lease -> ACK or heartbeat closes it -> missed ACK becomes visible and reclaimable`

## Fishbowl Rules

Use Fishbowl for material changes only.

Post when:

- A PR opens, blocks, lifts from draft, merges, or closes.
- Ownership changes.
- A direct handoff is created.
- A blocker needs Chris or another worker.
- A stale todo is closed or materially changed.

Stay quiet when:

- A health check finds no change.
- A heartbeat has no material event.
- A worker only refreshed state.

Every material status should include:

- Current status.
- Next action.
- Blocker, if any.
- PR, todo, or issue link.
- ETA or next check-in.

Use `docs/fishbowl-board-priority-system.md` when triaging the todo board.
The active board lanes are NOW, NEXT, LATER, PARKED, and BLOCKED. A large
todo list is acceptable when items are truthful, evidenced, and clearly
classified.

## PR And Merge Policy

- Keep one PR to one chip.
- Draft first when risk is unclear.
- Checks should be green before ready-review.
- Use squash merge by default.
- Low-risk green PRs may be merged by an approved reviewer under current standing rules.
- Do not self-merge unless Chris has explicitly allowed that worker and lane.
- Security, auth, env, migration, billing, DNS, domain, and provider-setting PRs need Chris approval.
- Dependency major bumps need explicit compatibility review.

## Connectors And RotatePass

Connectors and RotatePass are priority lanes because API key, token, and environment confusion has already slowed TestPass and dogfood proof.

Build toward:

- System credential health visibility.
- Owner and used-by mapping.
- Safe status checks.
- Rotation impact notes.
- No raw secret display.
- BackstagePass as the secure substrate.

Do not build:

- A broad new vault.
- Raw key storage in UI.
- Automatic provider writes.
- Automatic rotation.
- Full browser extension implementation.

Browser or local extension ideas remain Phase 0 until explicitly promoted.

## Pass And Dogfood Lanes

Pass work should prove UnClick is using itself.

Priority order:

1. TestPass trust gate and scheduled proof.
2. UXPass stuck or failed run clarity.
3. SecurityPass dogfood receipt clarity.
4. Public dogfood report accuracy.
5. New Pass product expansion only after foundation lanes are stable.

Do not weaken fail-closed checks to make CI green. Fix the blocker or report it.

## Historical Notes

The original courier workflow and Plex courier setup are useful history. They explain how the system grew from a smaller Lenovo/Plex setup into a wider fleet.

They are not the current master process. If they conflict with this file, follow this file and update the old note or related repo doc.

## Continuity Audit

Continuity audits should check:

- Worker roster drift.
- Conflicting docs.
- Stale automations.
- Open PRs that no current worker owns.
- Fishbowl todos linked to merged or closed PRs.
- Wake dispatches with no ACK path.
- Workers with stale `current_status` or missed `next_checkin_at`.

The outcome should be a small PR, a Fishbowl advisory, or silence if no material drift exists.

# UnClick Fleet Worker Roles

**Status:** Current operating reference
**Last updated:** 2026-05-02
**Owner:** UnClick fleet

## Intent

This note keeps new worker chats aligned before they act.

Every worker must refresh live GitHub and Fishbowl state before acting. This file is not a substitute for live state. It is the role map that prevents duplicate work, stale assumptions, and unclear handoffs.

For group pushes, use `docs/fleet-broadcast-template.md`. That file is the
canonical copy-paste message for waking or aligning multiple workers at once.

## Core rules

- Refresh live GitHub and Fishbowl before acting.
- Register or update Fishbowl status before material work.
- Set `current_status` and `next_checkin_at`.
- Use draft PRs first unless the change is trivial and explicitly safe.
- One builder owns each PR.
- Helpers can scout or review, but must not edit the same files as the builder.
- Do not force-push another worker's branch.
- Do not touch secrets, auth, billing, DNS/domains, migrations, or destructive cleanup without explicit approval.
- Hold risky merges even when CI is green.

## Active workers

| Emoji | Worker | Primary role | Should do | Should avoid |
| --- | --- | --- | --- | --- |
| 🦾 | ChatGPT Plex PC | Implementation / build | Build focused slices, fix tests, ship scoped PRs | Broad refactors, risky self-merges |
| 🍿 | Claude Plex | QC / review / merge-readiness | Review PRs, spot blockers, verify non-overlap | Building over active owner files |
| 🤖 | ChatGPT Lenovo PC | CEO assistant / backlog drain | Summaries, backlog cleanup, safe review | Acting on stale queue memory |
| 🧪 | XPass Assistant | Pass-family proof | TestPass, UXPass, XPass, EnterprisePass proof and receipts | Over-claiming certification |
| 🛠️ | Forge | Focused implementation | Small safe implementation PRs | Large multi-surface changes |
| 🧭 | Navigator | Scout / non-overlap | Find safe next paths, inspect overlap, recommend owners | Owning broad builds |
| 🛰️ | Relay | Simple status | Concise status, material-change summaries | Noisy healthy-cycle chatter |
| ♻️ | Loop | Continuous improvement | Find repeated friction, stale docs, missing proof, stale todos | Taking over feature lanes |
| 📣 | Courier | Fleet push / handoff | Wake stale workers, route PRs, surface exact blockers | Spamming healthy workers |

## Optional worker

| Emoji | Worker | Use when |
| --- | --- | --- |
| 🛡️ | Gatekeeper | Add when the fleet needs a dedicated release-safety and anti-stomp reviewer. Gatekeeper should inspect duplicate PRs, risky merges, incomplete verification, and scope creep. |

Gatekeeper is not active unless Chris creates a new chat and registers it in Fishbowl.

## Routing guide

- Send implementation chips to 🦾 or 🛠️.
- Send Pass-family proof work to 🧪.
- Send QC and merge-readiness to 🍿.
- Send scouting and non-overlap checks to 🧭.
- Send concise status summaries to 🛰️.
- Send process friction and tiny improvement ideas to ♻️.
- Send stale worker nudges and queue-routing to 📣.
- Send release-safety decisions to 🛡️ if active, otherwise to 🍿 plus 🧭.

## Bench Readiness Checklist

Before calling up a bench worker, check:

- Identity: the worker has a known Fishbowl or Boardroom identity and a fresh enough pulse.
- Lane: the packet matches the worker's proven lane, such as builder, reviewer, XPass proof, queue, or relay.
- Repo context: implementation workers can read the repo, branch, and current proof trail.
- XPass access: Pass-family workers know which XPass tool or report to use, or the packet stays context-only.
- Proof format: the worker can reply with PASS/BLOCKER, owned files, tests, PR or receipt, and next action.
- Stop conditions: the packet names secrets, billing, DNS, data deletion, deploy, migration, force-push, and ownership limits.
- Next ACK wording: the worker can ACK one bounded action, not a broad project promise.

Bench call-up routing is deterministic:

- Implementation packets go only to `builder_ready` or `scoped_builder` runners.
- Queue-management and owner-decision packets go to Jobs Worker first.
- QC packets can go to review-only workers.
- XPass and status relay packets can go to context-ready workers.
- Needs-probe or offline workers produce a BLOCKER reason and a next probe instead of receiving the packet.

## Report format

Use this shape for material work:

```text
status:
chosen work / pushed:
owned files:
non-overlap:
tests:
PR:
blocker:
next:
traffic light:
```

Traffic lights:

- 🟢 safe / moving
- 🟡 hold / needs proof
- 🔴 blocked / risky

## Merge posture

Merge only when:

- CI is green
- verification is complete
- scope is narrow
- no active overlap exists
- no risky surface is touched
- PR body says what was tested
- blocker notes are resolved

If verification is incomplete, leave the PR draft or hold it with the exact missing proof.

# UnClick Fleet Broadcast Template

**Status:** Current operating template
**Owner:** UnClick fleet
**Use when:** Chris or a relay worker needs to push the whole fleet forward without creating duplicate work.

This template is the safe default for mass worker pushes across Lenovo, Plex, cloud agents, scheduled automations, and future hosts.

Before pasting it into worker chats, adjust the **Current focus** and **Known holds** sections if needed. Do not add secret values, raw tokens, DNS instructions, billing changes, or private customer data.

## Copy-Paste Broadcast

```text
🚀 UnClick fleet push: safe throughput, no stomp

Goal:
Keep UnClick moving unattended while protecting secrets, auth, billing, domains, migrations, and public claims.

First rule:
Refresh live GitHub, Actions, and Fishbowl before acting. Do not trust stale chat memory.

Read before action:
- FLEET_SYNC.md
- AUTOPILOT.md
- docs/fleet-worker-roles.md
- docs/fishbowl-emoji-role-registry.md
- docs/unclick-deep-context.md if making product, roadmap, or summary judgments

Current focus:
1. Drain clean green PRs safely.
2. Close or clarify stale Fishbowl todos only with evidence.
3. Continue approved Connectors / RotatePass / System Credentials work without exposing secrets.
4. Continue Pass proof work without over-claiming compliance or certification.
5. Improve PinballWake / WakePass only for action-needed handoffs, not quiet health checks.
6. Improve fleet safety docs, proof checks, and no-stomp guardrails when an obvious gap appears.

Known holds:
- Do not touch secrets, env vars, auth, billing, DNS/domains, migrations, RLS, CSP, or destructive cleanup without Chris.
- Do not print raw secret values.
- Do not weaken TestPass, UXPass, SecurityPass, EnterprisePass, WakePass, or dogfood gates just to turn checks green.
- Do not start broad new product lanes from old notes unless Chris explicitly reactivates them.
- Do not edit another worker's active files or force-push another worker's branch.
- If a PR has incomplete verification, hold it with the exact missing proof.

Worker routing:
- 🦾 ChatGPT Plex PC: focused implementation chips.
- 🍿 Claude Plex: QC, review, merge-readiness, blockers.
- 🤖 ChatGPT Lenovo PC: CEO assistant, backlog drain, board cleanup.
- 🧪 XPass Assistant: TestPass, UXPass, SecurityPass, EnterprisePass, dogfood proof.
- 🛠️ Forge: focused implementation, small non-overlap fixes.
- 🧭 Navigator: scouting, non-overlap, next-chip recommendations.
- 🛰️ Relay: concise status and cross-worker summaries.
- ♻️ Loop: continuous improvement, stale process cleanup, friction removal.
- 📣 Courier: wake stale workers, route handoffs, keep queue moving.
- 🛡️ Gatekeeper: only if active; release safety, anti-stomp, incomplete-proof review.

Allowed autopilot work:
- Review clean green low-risk PRs.
- Open tiny docs/test/proof PRs.
- Fix current-process doc drift.
- Add focused regression tests for confirmed bugs.
- Close stale todos linked to merged/closed PRs with evidence.
- Post one clear handoff when blocked.

Not allowed on autopilot:
- Secrets, env values, auth provider settings, billing, DNS/domains, migrations, RLS, CSP, security policy.
- Raw key storage or raw key display.
- Broad browser extension implementation.
- Compliance, legal, investor, or certification claims beyond "guidance/report/proof".
- Large refactors or dependency waves.

Status discipline:
Every material update must include:
status:
chosen work:
owned files:
non-overlap:
tests:
PR:
blocker:
next:
traffic light:

Traffic lights:
🟢 working / safe
🟡 needs proof / hold
🔴 blocked / risky

If you cannot identify yourself:
Stop and answer the Fishbowl identity ACK first:
who:
agent_id:
role:
machine/session:
current lane:
next_checkin_at:

If nothing useful changed:
Stay quiet or post only a concise no-action status. Do not create heartbeat noise.
```

## When To Use A Shorter Push

Use a shorter push when the fleet is already aligned and only needs one queue nudge:

```text
Fleet nudge:
Refresh GitHub + Fishbowl, pick one unclaimed safe chip, avoid active files, post status + next_checkin_at.
Priorities: clean green PR review, exact stale todo cleanup, small proof/test/doc gap.
Hold secrets/auth/billing/DNS/migrations/risky merges.
Report status, PR, blocker, next, traffic light.
```

## Notes For Relay Workers

- Do not paste mass pushes into every worker every cycle.
- Use mass pushes when the fleet needs a reset, a new policy, or a bigger queue push.
- Use targeted handoffs for one worker and one next action.
- If a worker is healthy and already has a current status, do not nudge it unless the status is stale or blocked.
- If a worker misses two expected check-ins, route through WakePass or Fishbowl handoff before taking over the work.

# UnClick Autopilot

This file defines what workers may do without waiting for Chris, what needs one approval, and what remains gated. It is the shared decision matrix for Fishbowl handoffs, scheduled workers, and async coding agents.

Read `FLEET_SYNC.md` first. It is the current cross-PC fleet alignment layer and defines source-of-truth order, worker lanes, no-stomp rules, and continuity expectations. This file only defines autonomy tiers.

The goal is simple: keep the fleet moving while protecting secrets, security, billing, migrations, and public claims.

## Operating Principles

- Prefer small, reversible chips over broad refactors.
- Keep the board truthful. Close done work, return stale work to the pool, and mark blockers clearly.
- Use Fishbowl for material changes only. Healthy or no-event cycles should stay silent.
- Use Ideas for speculative work. Use Todos for work that is ready to execute.
- Run `/review` before opening PRs that change code, config, docs policy, or user-facing behavior.
- Do not start new product lanes while an urgent foundation chip is blocked.

## Command And Control Doctrine

Autopilot can delegate work, but it cannot delegate responsibility to a black box. Any room or worker that can trigger workflows, call tools, change data, modify code, publish, merge, or roll back must leave a control trail clear enough for a human or safety room to answer five questions:

- Who requested the action?
- Which room or worker approved it?
- What exact scope was approved?
- What proof or review allowed it to continue?
- How can it be stopped if the agent drifts?

Core rules:

- Autonomy without observability is a blocker, not a feature.
- Status chatter is not authority. A PASS, approval, proof, or blocker must come from a trusted lane, room, master, or system event.
- High-impact actions need explicit command authority before execution. Examples: merge, publish, rollback, destructive cleanup, secrets, auth, billing, DNS, migrations, or production data changes.
- Every action that crosses a safety boundary must be reconstructable from an event ledger or audit trail, including actor, authority, scope, timestamp, source, and result.
- Kill switches must be checked before high-impact execution. If the kill switch state is unclear, choose the safest interpretation and stop.
- Human-readable prompts are allowed, but the system must convert them into structured scope, ownership, authority, and proof before acting.
- Continuous Improvement owns repeated resistance. If the same manual nudge, missing ACK, stale proof, or routing confusion recurs, create a front-of-line improvement job instead of normalizing the friction.

In short: agents may move the work, but UnClick must keep the chain of command visible.

## Worker Name Transition

Use simple public worker names in UI, user-facing docs, and onboarding. Keep the existing internal lane names, emoji routing, and Fishbowl/Boardroom IDs as aliases until the automation substrate is explicitly migrated. Public names are labels; internal names are delivery addresses.

| Public worker name | Emoji | Internal lane / alias | Plain role |
| --- | --- | --- | --- |
| Coordinator | 🧭 | Master / creativelead | Chooses priority, merge order, and owner decisions |
| Builder | 🛠️ | Forge | Implements focused chips and opens PRs |
| Tester | 🧪 | Proof Executor / TestPass lanes | Runs proof, tests, and test receipts |
| Reviewer | 🔍 | Popcorn / QC | Checks user experience, scope, and final QC |
| Safety Checker | 🛡️ | Gatekeeper | Blocks unsafe, dirty, overlapping, or risky releases |
| Researcher | 🔬 | Research Room | Explores feasibility, options, risks, and outside ideas |
| Planner | 📋 | Planning Room | Turns research or intent into buildable ScopePacks |
| Messenger | 📣 | Courier | Delivers targeted handoffs without making product decisions |
| Watcher | 👁️ | Relay / Navigator / watchers | Watches status, stale work, and proof drift |
| Publisher | 🚀 | Publish Room | Handles publish readiness and post-publish proof |
| Repairer | 🩹 | Repair Room | Routes failed checks or broken builds to a focused fix |
| Improver | ♻️ | Continuous Improvement / Loop | Turns repeated friction into front-of-line improvements |

Do not structurally rename database tables, MCP tools, GitHub labels, or worker agent IDs just to match public names. Rename the surface first, then migrate plumbing only with tests that prove old aliases still route correctly.

## XPass Gate

Autopilot should dogfood UnClick with UnClick. XPass is the conductor for that proof: it chooses the relevant Pass-family checks for a target and returns one combined receipt. It should not blindly run every Pass on every change.

Selection defaults:

- UI, dashboard, navigation, and admin changes select UXPass, plus visual evidence where available.
- Tool, connector, MCP, and native endpoint changes select TestPass.
- Auth, keys, tokens, redaction, and security-sensitive changes select SecurityPass.
- Public wording, docs, and claims select CopyPass.
- Public pages, metadata, sitemap, and discoverability changes select SEOPass.
- Legal, pricing, billing copy, privacy, terms, and compliance-sensitive wording select LegalPass.
- Code changes select QualityPass when a quality/smell receipt is useful.

The gate may run in advisory mode while Pass-family coverage is still catching up. Enforcement should only turn on after the relevant Pass has a stable runner, clear receipt shape, and enough dogfood proof to avoid noisy false blockers.

## Continuous QC Project

Continuous QC is now a standing Autopilot project, not a one-off cleanup. The goal is to keep running UnClick through its own proof system until the product feels coherent, visible, and trustworthy across public pages, admin pages, worker setup, Autopilot, XPass, Memory, Apps, Passport, Ledger, and Boardroom.

Operating shape:

- XPass Gate runs first in advisory mode and names the checks a change should receive.
- Missing Passes are recorded as missing or skipped, never treated as PASS.
- Continuous Improvement owns repeated QC friction and turns it into front-of-line build chips.
- Dogfood Room owns realistic user journeys, not just isolated component checks.
- Ledger should receive receipts for meaningful QC outcomes as the receipt surface matures.

Priority order:

1. Finish UXPass enough to support visual/site sweeps, screenshot evidence, console errors, obvious layout problems, navigation confusion, and mobile/desktop checks.
2. Finish QualityPass enough to catch messy AI-build risks, weak abstractions, brittle tests, and obvious maintainability problems.
3. Finish CopyPass enough to catch unclear product wording, old names, mixed metaphors, and overcomplicated user-facing copy.
4. Harden SecurityPass for auth, keys, sessions, redaction, permissions, browser extension, OAuth, API keys, and Password Bridge surfaces.
5. Add SEOPass and LegalPass when public, pricing, docs, legal, privacy, or compliance surfaces change.

Enforcement path:

- Phase 1: advisory only. XPass says what should run and what is missing.
- Phase 2: enforce completed Passes only. A missing incomplete Pass is a recorded skip, not a blocker.
- Phase 3: enforce all relevant completed Passes before merge for Autopilot, admin UI, public pages, tools/connectors, and security-sensitive surfaces.

This project should bias toward fixing real user-visible confusion over inventing new dashboards. When in doubt, dogfood the current product, write down the friction, and ship the smallest improvement that removes it.

## Autonomy Tiers

| Tier | Meaning | Worker action |
| --- | --- | --- |
| Ship without ask | Low-risk, reversible, already aligned with standing direction | Do the work, open a PR, post the result |
| Ask once, then ship | Valuable but policy-shaped or user-visible enough to need one clear yes | Ask Chris or Bailey for the rule, then keep applying it |
| Gated | Risky, irreversible, security-sensitive, billing-sensitive, or public-positioning sensitive | Do not act without explicit Chris approval |

## Ship Without Ask

Workers may ship these without waiting when the change is small and scoped:

- Board hygiene: close todos linked to merged PRs, return stale owned work to open, prune clearly obsolete no-owner cards, and clarify stale card descriptions.
- Heartbeat hygiene: add silent-exit behavior, remove padding posts, and make status updates shorter.
- Review hygiene: add `/review` reminders, PR checklist wording, and non-blocking review proof fields.
- Error-message polish: make internal errors actionable when the behavior is unchanged.
- Docs alignment: fix stale tool names, broken links, typo-level drift, and current-process docs that contradict merged code.
- Known-trap notes: document a confirmed failure mode so future agents avoid repeating it.
- While-in-the-area polish: one adjacent low-risk fix per PR, called out in the PR body.
- Test-only regressions for already-confirmed bugs, provided they do not change production behavior.

Acceptance for this tier:

- One focused PR.
- Clear summary.
- Verification command or reason tests are not needed.
- Fishbowl post only when a PR opens, merges, blocks, or changes ownership.

## Ask Once, Then Ship

Workers should ask once before turning these into standing behavior:

- Auto-merge rules for clear green PRs.
- Dependency auto-merge policy for patch and minor updates.
- Public dogfood reports and public status pages.
- New recurring scheduled jobs.
- Pass-family documentation generation.
- Memory public-release checklist changes.
- Any rule that changes who owns a class of work.

After the answer is recorded, future matching work can follow that rule without repeating the question.

## Gated

Only Chris can approve these:

- Secrets, tokens, environment variables, billing, domains, or Vercel project settings.
- Auth, OAuth, RLS, CSP, security headers, migrations, or database policy changes.
- Production deploys that alter customer data or access control.
- Public legal, trademark, compliance, or security claims.
- New product launches, pricing, or positioning changes.
- Merge calls for security-sensitive PRs or anything with failing checks.
- Destructive Git operations, branch deletion, database cleanup, or irreversible data changes.

## Confidence Routing

Use this routing when deciding what to do next:

| Confidence | Action |
| --- | --- |
| High confidence, low risk | Ship without ask |
| High confidence, medium risk | Ask once, then ship |
| Medium confidence, low risk | Comment with plan, then ship if no blocker is visible |
| Medium confidence, medium risk | Ask Bailey or Chris |
| Low confidence or high risk | Stop and ask Chris |

Examples:

- A stale todo says a merged PR is still open: ship without ask by closing or clarifying the card.
- A draft PR is green but marked draft on purpose: ask before marking ready.
- A missing env var blocks production: gated, Chris action required.
- A docs file names retired tools: ship without ask if current code is clear.
- A new cron will make changes on a schedule: ask once, then ship after approval.

## Canonical Heartbeat Template

Scheduled workers and recurring wakeups should use `.claude/agents/heartbeat.md`
as the in-repo heartbeat source of truth. If a broadcast instruction conflicts
with that template, update the template in a PR instead of patching each worker
by prose. The silent-exit rule is explicit: a zero-event cycle must not call
`post_message`.

## Fishbowl Handoff Rules

Every handoff should include:

- Owner
- Current status
- Expected next action
- Blocker, if any
- Linked PR, issue, or todo
- ETA or next check-in

Every worker should acknowledge a direct handoff within the next expected cycle. If there is no ack after two cycles, Bailey may reassign or return the card to the pool.

When the MCP `ack_handoff` tool is available, use it instead of a free-form
reply. It posts a standard ACK card with current chip, next action, ETA, and
blocker so the fleet can measure handoff latency without the human translating
status prose.

## Event Wakeups

Ready work should wake the right worker immediately instead of waiting for the
next heartbeat. Cron remains the safety net, not the primary trigger.

PinballWake should be called before the first delivery route for any event that
expects a worker ACK. That gives the event an idempotent dispatch, lease, and
reclaim path even if the first route fails. Do not wrap quiet health checks,
dashboard reads, or zero-event heartbeats in PinballWake, because that creates
alert noise without useful recovery.

Scheduled TestPass success is a receipt, not a wake. Scheduled TestPass failure
is action-needed and should wake through PinballWake immediately.

## Scheduled TestPass Clock

GitHub Actions `schedule` is a backup clock, not the primary TestPass cadence.
On 2026-05-01, the workflow was configured for every 5 minutes but natural
GitHub runs arrived about 70 minutes apart during the first overnight proof
window. Treat GitHub schedule events as useful receipts, not precise timing.

Use Vercel Cron as the primary scheduled TestPass clock when the project plan
supports minute-level cron. Keep the cron request authenticated with
`CRON_SECRET`, include `source=scheduled`, and leave a TestPass run plus signal
receipt so the fleet can prove unattended execution without reading provider
logs.

Wake targets:

- Target: event-to-visible-worker-action under 2 minutes.
- Warning: over 5 minutes.
- Fail: 16 minutes or more, because that is no better than the old heartbeat delay.

Use the cheapest reliable wake path first:

1. No-LLM watcher routes clear events such as green PR checks, draft lifted, blocker cleared, todo assigned, or verification ready.
2. Optional cheap triage may use OpenRouter when `OPENROUTER_API_KEY` and `OPENROUTER_WAKE_MODEL` are configured. This layer is only a doorbell/classifier: it may decide wake/no-wake and route to an owner, but it must not code, review diffs, summarize large files, or make product decisions.
3. Claude/Codex wakeups are escalation paths, not heartbeat loops.

Cost guardrails:

- Do not use Claude GitHub Action as the default heartbeat.
- Do not type the raw Claude trigger phrase in GitHub unless a Claude run is intended.
- Measure request count and token usage for every AI-backed wake test.
- Prefer one wake signal per event; duplicate triggers are treated as failures.

Ledger rule:

- Every wake-router run writes a GitHub Actions summary and a `wake-ledger-*` JSON artifact with event id, source, route, timing, Fishbowl post result, and ACK thresholds.
- Fishbowl wake posts include `Wake event id:` and ask the target worker to reply `ACK <event_id>` with their next action.
- ACK tracking is measured against the same thresholds: target under 2 minutes, warning over 5 minutes, failure at 16 minutes.

## PR Rules

Before opening a PR:

- Pull from the latest main branch.
- Keep the change to one chip.
- Run the smallest useful verification.
- Run `/review` when available.
- Mention whether the change is ship-without-ask, ask-once, or gated.
- If the PR finishes a Fishbowl todo, link it in the PR body with `Closes Fishbowl todo: <uuid>` (one line per todo, case-insensitive, `closes-fishbowl-todo:` also accepted). The `auto-close-fishbowl-todo` workflow scans merged PR bodies and calls `fishbowl_complete_todo` for each match; a Fishbowl outage logs a warning and never blocks merge cleanup.

Before merging:

- Checks must be green unless Chris explicitly overrides.
- Draft PRs must be marked ready by the owner or by explicit instruction.
- Security, auth, env, migration, and billing changes need Chris approval.

## Current Priority Rule

Autopilot foundation work comes before new Pass-family expansion. Pass dogfood work may continue when it supports autopilot, but new Pass product lanes should wait until the autopilot rails are landed.

<!-- build-d probe 4920fa -->

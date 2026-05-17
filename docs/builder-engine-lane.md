# Builder Engine Lane

## Intent

UnClick is the factory. Builder engines are machines inside the factory.

OpenHands, Codex, Claude Code, Cursor, SWE-agent-style runners, and future tools are interchangeable worker engines. They do not replace UnClick. A build still happens inside UnClick when the job, context, routing, proof, memory, and safety gates are owned by UnClick.

This lane exists to remove coordination drag. Workers should spend less time saying they are claiming work and more time returning a patch, a review, a blocker, or a proof receipt.

## Standard Conveyor

1. Jobs room selects one high-value job.
2. A ScopePack defines owned files, acceptance criteria, verification, safety stops, and expected proof.
3. The router picks a builder engine by job shape and live health.
4. The engine works in a branch, sandbox, draft PR, or controlled local workspace.
5. Verification runs the smallest useful check first, then GitHub checks when responsive.
6. A separate reviewer role returns PASS or BLOCKER.
7. Risky work adds a safety role before merge or ship.
8. The result is logged back to the job with changed files, tests, PR link, and next step.

## Engine Routing

Pick the engine by fit, not by brand.

- OpenHands: best first open-source adapter for autonomous GitHub issue-to-PR work and reproducible proof runs.
- Codex: strong fit for local repo surgery, integration work, and follow-through from this desktop tether.
- Claude Code: strong fit for code edits and review when its GitHub calls and channel are responsive.
- SWE-agent style: useful pattern for issue-to-fix loops, not necessarily the first runtime.
- Other engines: acceptable when they can accept a ScopePack and return a patch, PR, review, or proof receipt.

The first implementation can use OpenHands because the adapter already exists, but the product language must stay engine-agnostic.

## Review Policy

Normal work needs two roles:

- Builder: creates the patch or PR.
- Reviewer: checks scope, behavior, and proof.

Risky work needs three roles:

- Builder.
- Reviewer.
- Safety reviewer.

A single subscription or tether may serve more than one role only when the role switch is explicit and logged. The important boundary is role separation inside UnClick, not how many paid accounts are involved.

## GitHub Checks

GitHub Actions are useful green and red lights, but they are not the whole factory.

- If checks are green and fresh, treat them as proof.
- If checks fail, route a focused fix.
- If checks are queued, stale, or non-responsive, set a timeout.
- After timeout, run a local targeted check, reroute, or mark BLOCKER with proof.

Do not let a stalled external check freeze the lane.

## Bottlenecks To Remove

- Claim-only loops where no code or proof changes.
- Repeated nudges when a builder engine could act directly.
- Waiting for a missing coder seat after a ScopePack is already ready.
- Stale owner holds without a narrow ScopePack.
- Jobs that are too large for one bounded patch.
- Reviewer waits with no fallback reviewer role.

## Safety Stops

Do not run autonomous mutation for:

- Secrets or credentials.
- Billing.
- DNS.
- Production data.
- Owner-auth work.
- Force pushes.
- Destructive migrations.
- Production deploys.

Those can still be prepared, audited, and routed, but mutation needs explicit approval and proof.

## First Dry Run

Use a docs-only job for the first real conveyor proof:

1. Create a tiny ScopePack with one owned docs file.
2. Route it through one builder engine.
3. Require a patch or draft PR.
4. Run one local targeted check.
5. Log builder PASS and reviewer PASS or BLOCKER.
6. Record the proof link on the job.

The goal is boring throughput: one clear job goes in, one safe result comes out.

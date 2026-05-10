# Quality Ops Worker Pack

**Status**: Draft lane charter
**Last updated**: 2026-05-10 UTC
**Linked todo**: `1ed47811-af80-4883-ab56-02b446fb7117`
**Scope**: non-destructive quality lanes for recurring engineering health, cleanup discovery, test gap discovery, legacy naming cleanup, and dependency watch

## Purpose

Quality Ops keeps UnClick shipping without letting speed turn into tangled code, weak proof, or stale product language. It is not a new product surface and it is not a parallel Worker Registry. It is a lane charter for workers that turn architecture and quality signals into small, safe, reviewable chips.

The pack is intentionally conservative:

1. read production state only when a task already permits it;
2. prefer reports, ranked risks, and tiny child todos before code changes;
3. make safe mechanical PRs only when a ScopePack names owned files, tests, and stop conditions;
4. never perform broad rewrites, destructive cleanup, migrations, auth, billing, DNS, secrets, or production execute-mode work.

## Operating Contract

Every Quality Ops worker must produce one of four receipts:

| Receipt | Meaning | Required proof |
| --- | --- | --- |
| `PASS` | A bounded step completed safely | PR, todo comment, report path, test run, or live read-only source |
| `BLOCKER` | Work stopped for a safe reason | Exact blocker, last checked source, next recommended fix |
| `HOLD` | A human or owner decision is needed | Decision point, options, and why the worker should not choose |
| `COMMENT` | A read-only finding or ScopePack was added | Todo comment id, report path, or linked source |

All receipts include cleanup status: temp rows, proof agents, one-time schedules, leases, local scratch files, and branches.

## Lane Summary

| Lane | Trigger | Repo surface | Allowed checks | Prohibited mutations | Proof receipt | Escalation rule |
| --- | --- | --- | --- | --- | --- | --- |
| Engineering Steward | Repeated boundary drift, oversized files, weak ownership, unsafe PR expansion | `docs/architecture/*`, focused code surfaces named in ScopePacks | `git diff --check`, focused unit tests, `npm run build`, read-only grep scans | New runtime worker routing, broad refactors, migrations, secrets, release actions | Architecture note, ScopePack, or PR with focused tests | Escalate if the fix needs a new taxonomy, owner boundary, package strategy, or runtime migration |
| Architecture Steward | System maps, target-state drift, recurring design debt, package boundary issues | Architecture docs, PR templates, named package boundaries | Read-only scans, doc build checks, focused package tests when scoped | Editing unrelated product code, changing public routes without compatibility plan | Updated architecture map or child cleanup chips | Escalate when an architecture choice changes product strategy or deployment shape |
| Cleanup Worker | Duplicate helpers, dead code candidates, extractable components, stale test fixtures | Owned files listed in a cleanup ScopePack | `git diff --check`, focused tests for touched helpers, build | Deleting files without proof, sweeping rename PRs, touching multiple ownership lanes | Tiny cleanup PR or ranked cleanup todo | Escalate if cleanup crosses more than one module owner or lacks behavioral proof |
| Test Gap Scout | Regressions without focused coverage, risky shared helpers, PRs that add untested branching | Test files next to named behavior, docs with test plan | Test discovery, one focused failing or passing test, build if UI touched | Adding broad brittle snapshot suites, changing production behavior to make tests pass | Test-gap todo, minimal test PR, or test plan comment | Escalate if private credentials or live production mutation are needed |
| Legacy Name Scout | Fishbowl, Popcorn, Master, Bailey, or other old labels confusing current Boardroom and Seats language | UI copy, docs, tests, route aliases, API alias docs named in ScopePack | Read-only scans, focused copy tests, route compatibility tests | Breaking route or API aliases, bulk replacement without compatibility map | Compatibility map or tiny user-facing copy PR | Escalate if a rename affects API action names, stored events, URLs, or public docs |
| Dependency Gardener | Deprecation warnings, stale toolchains, vulnerable packages, package boundary drift | `package.json`, lockfile, CI config, package docs, named packages | `npm audit` where safe, `npm outdated`, package tests, build | Major upgrades without owner approval, lockfile churn without a package reason, paid service changes | Dependency risk note or one-package upgrade PR | Escalate if upgrade changes runtime, auth, billing, deployment, or customer-visible behavior |

## Lane Details

### Engineering Steward

Engineering Steward is the first stop for quality issues that do not belong to a feature owner yet. It reads recent PRs, architecture docs, file size signals, and package boundary signals, then creates small child work with explicit owned files.

Default outputs:

- a ScopePack for a bounded build or cleanup chip;
- a ranked risk note on the parent todo;
- a docs-only PR if the missing piece is a charter, checklist, or compatibility plan.

Stop when the work would require new runtime roles, route ownership changes, package publishing strategy, or production execution.

### Architecture Steward

Architecture Steward keeps the current-state and target-state maps honest. It does not rewrite the codebase. It updates maps, creates compatibility notes, and prevents multiple agents from inventing incompatible patterns for the same job.

Default outputs:

- architecture map updates;
- reuse and boundary checklist language;
- child chips that start with the smallest package, route, or component boundary.

Stop when a choice would decide platform direction, cloud runtime, database migration shape, or public API compatibility.

### Cleanup Worker

Cleanup Worker handles tiny mechanical cleanup only after proof exists. A cleanup PR should be boring: one helper extraction, one compatibility-preserving rename, one component split, or one deleted branch guarded by tests.

Default outputs:

- focused cleanup PR with tests;
- cleanup candidate list with risk rank;
- blocker if the cleanup needs wider owner context.

Stop when cleanup crosses lanes, touches secrets/auth/billing/DNS/migrations, deletes data, or changes behavior without a test.

### Test Gap Scout

Test Gap Scout looks for shared behavior that has become important enough to deserve a focused test. It should prefer one high-signal test over large test sweeps.

Default outputs:

- a test-gap todo with exact behavior and file surface;
- a minimal test PR when the owned files are clear;
- a note that a task cannot be proved without a scheduled or live run.

Stop when proving the behavior requires private credentials, production mutation, paid calls, or broad fixture changes.

### Legacy Name Scout

Legacy Name Scout protects current product language while keeping compatibility intact. It handles old Boardroom/Fishbowl, worker, and seat labels by mapping old names to current public labels before any rename PR.

Default outputs:

- compatibility map: stored name, public label, API alias, UI route, test coverage, deprecation state;
- tiny copy PR for low-risk visible strings;
- blocker when route/API compatibility is unclear.

Stop when stored events, API action names, URLs, or public docs would change without a compatibility plan.

### Dependency Gardener

Dependency Gardener watches for package warnings, stale browser data, vulnerable dependencies, deprecated APIs, and package export drift. It prefers inventory and one-package PRs over broad upgrades.

Default outputs:

- dependency risk note with package, current version, target version, reason, and blast radius;
- one-package upgrade PR when tests are local and safe;
- package-boundary chip when imports use internals instead of public exports.

Stop when the update changes runtime, requires account access, touches billing, changes deploy settings, or upgrades a major version without owner approval.

## How Quality Ops Feeds Other Systems

### Architecture QC

Quality Ops feeds Architecture QC by turning recurring signals into child chips:

- duplicate helper or route pattern becomes a cleanup chip;
- package-boundary drift becomes a package export chip;
- oversized file growth becomes a split plan;
- legacy naming drift becomes a compatibility map.

Architecture QC remains the report and priority layer. Quality Ops is the lane pack that performs the safe follow-through.

### Worker Registry

Quality Ops does not create a separate registry. Worker Registry stays the source of truth for worker lanes and activation state. Quality Ops contributes:

- lane definitions;
- capability tags;
- fallback rules;
- receipt standards;
- promotion evidence from successful small chips.

The Worker Registry can later map these lanes to active, bench, or fallback workers, but this charter does not change runtime routing.

### Performance Monitor

Performance Monitor supplies signals such as repeated check failures, long PR queues, stale proof, growing files, build warnings, and slow handoffs. Quality Ops converts those signals into ranked risks and small todos.

### Safety Checker

Safety Checker remains the gate for sensitive work. Quality Ops workers must escalate to Safety Checker before any task that touches secrets, auth, billing, DNS, migrations, production data mutation, destructive cleanup, or live user messaging.

### Improver

Improver receives small, non-destructive follow-up chips from Quality Ops. Quality Ops supplies the scope, proof requirement, and stop conditions. Improver can then refine or route the chip without inventing a new quality process.

### Runner Queue

Runner Queue should only receive Quality Ops work that has:

- a clear ScopePack;
- owned files;
- allowed checks;
- a single proof target;
- explicit cleanup requirements;
- stop conditions.

No Quality Ops lane may queue broad rewrites or ambiguous cleanup.

### PR Checklist Gates

Quality Ops recommends this advisory checklist for PR descriptions and reviews:

> Reuse and boundary check: list the existing helper, route, component, package export, or worker pattern you reused. If adding a new pattern, explain why reuse was not enough. Confirm the patch does not add new relative imports into package internals or create or expand a file beyond 300 lines without a split plan.

This remains advisory until at least two cleanup chips prove the pattern.

## First Safe Child Chips After Approval

1. `Quality Ops: Engineering Steward registry alias map v1`
   - Build goal: map Engineering Steward and Architecture Steward to Worker Registry lane aliases without runtime activation changes.
   - Owned files: Worker Registry docs or the smallest existing registry alias test surface.
   - Proof: focused route/discovery tests or docs-only proof if no runtime files are touched.

2. `Quality Ops: Cleanup Worker duplicate helper candidate queue v1`
   - Build goal: turn the Architecture QC crypto and package-boundary findings into cleanup-ready ScopePacks.
   - Owned files: docs or UnClick todo comments only.
   - Proof: todo ids and source-linked scan evidence.

3. `Quality Ops: Test Gap Scout first shared-helper test v1`
   - Build goal: add one focused test around a shared helper or high-risk branch named by Architecture QC.
   - Owned files: one test file plus the smallest helper surface needed.
   - Proof: focused test command and build if needed.

4. `Quality Ops: Legacy Name Scout Boardroom map v1`
   - Build goal: produce the compatibility map before any Boardroom/Fishbowl rename.
   - Owned files: `docs/architecture/boardroom-legacy-name-map.md`.
   - Proof: read-only scan counts and route/API compatibility table.

5. `Quality Ops: Dependency Gardener warning inventory v1`
   - Build goal: inventory current package warnings without changing dependencies.
   - Owned files: `docs/architecture/dependency-gardener-inventory.md`.
   - Proof: command output summary, no lockfile change.

## Non-Goals

- No runtime worker registration or routing changes.
- No production config changes.
- No auth, billing, DNS, migration, or secret handling.
- No broad refactors or sweeping cleanup.
- No release action or merge from this charter.
- No deletion without source-linked proof and focused tests.

## Suggested Acceptance

This charter is complete when:

1. the six Quality Ops lanes each have a trigger, repo surface, allowed checks, prohibited mutations, proof receipt, and escalation rule;
2. the charter explains how Quality Ops feeds Architecture QC, Worker Registry, Performance Monitor, Safety Checker, Improver, Runner Queue, and PR checklist gates;
3. the first safe child chips are listed but not activated;
4. the only repo change is this docs charter.

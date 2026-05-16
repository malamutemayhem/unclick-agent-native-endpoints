# Review enforcement (Build E)

Closes UnClick todo "Build E: /review enforcement bundle (PR template + CI warning + local dry-run wrapper)".

## What this is

A throughput-boosting bundle that nudges PR authors and reviewers toward the rank-10 review pattern from the consolidated automation methods doc:

> Reviewer/Safety/Coordinator gates and PASS on latest head SHA — rank-10, 90% effective.

The bundle is **non-blocking by default**. Merge gates live in the dedicated Reviewer/Safety/Coordinator workflow. Build E only surfaces *warnings* when a PR drifts from the convention.

## Three pieces

| File | Role |
|---|---|
| `.github/PULL_REQUEST_TEMPLATE.md` | Pre-fills PR description with the review checklist + slots for Closes/Refs, test plan, and Reviewer/Safety PASS markers. |
| `.github/workflows/review-enforcement-warning.yml` | GitHub Action that runs on every PR and emits a warning annotation if required markers are missing. `continue-on-error: true` keeps it non-blocking. |
| `scripts/review-dry-run.mjs` | Local CLI wrapper that runs the same check authors can use *before* pushing. Also unit-tested. |

## How authors use it

1. Open a PR — the template auto-loads.
2. Fill in Summary, Closes, Test plan.
3. **Before pushing**, run `node scripts/review-dry-run.mjs --body-file my-pr-body.md` to dry-run the check locally. (Or pipe from a draft commit message.)
4. After Reviewer/Safety PASS comments land on the latest HEAD SHA, the autopilot merge gate clears the PR.

## How reviewers use it

1. Open the PR.
2. Verify the code + protected-paths checklist.
3. Leave a comment containing `Reviewer PASS <SHA>` where SHA is the latest HEAD commit on the branch.
4. A safety seat (or the same reviewer if combined) leaves `Safety PASS <SHA>`.
5. If the branch is bumped after PASS, the comments are stale and must be re-issued.

## Upgrade path

To convert Build E from advisory warning into a hard gate later:

1. In `.github/workflows/review-enforcement-warning.yml`, set the body-check step's `continue-on-error` to `false`.
2. Add `review-enforcement-warning / body-check` to the branch protection required-checks list on `main`.
3. Add a `release:` field to the workflow trigger if you want it gated on release-eligible PRs only.

## Acceptance (from the ScopePack at 100%)

- [x] `.github/PULL_REQUEST_TEMPLATE.md` exists and lists Reviewer PASS + Safety PASS + Closes/Refs + Test plan slots.
- [x] `.github/workflows/review-enforcement-warning.yml` runs on PR open/edit/sync and emits a `::warning` annotation when markers are missing; non-blocking.
- [x] `scripts/review-dry-run.mjs` runs the same check locally; supports `--body-file`, `--pr`, `--stdin`; exit 0 on OK, 1 on warn, 2 on usage error.
- [x] `scripts/review-dry-run.test.mjs` exercises all check variants and the renderer.

## Source

Drafted 2026-05-15 by `claude-cowork-coordinator-seat` under Chris's any-worker-hat greenlight. Files live on disk at `Z:\Other computers\My laptop\G\CV\_unclick-drafts\build-e-review-enforcement\`.

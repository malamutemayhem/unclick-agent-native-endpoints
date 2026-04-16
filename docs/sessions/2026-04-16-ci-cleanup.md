# CI cleanup - follow-up from Phase 2 session

**Date:** 2026-04-16
**Context:** Logged during Phase 2 PR #15 (`claude/phase-2-auth-foundation`). Both GitHub Actions jobs are failing red on this PR, but they were already failing red when Phase 1 PR #14 merged, so the failures are pre-existing and were explicitly left alone per Chris's call on this session. Not a Phase 2 regression.

## Failing checks (both pre-existing)

### 1. "MCP server package" job

**Symptom:** exits in ~7 seconds. Too fast to be an actual TypeScript compile. Fails during setup, before `npm install` or `npm run build` runs.

**Root cause:** `.github/workflows/ci.yml:47` uses:

```yaml
cache-dependency-path: packages/mcp-server/package-lock.json
```

But `packages/mcp-server/` has no `package-lock.json` file on disk. The `actions/setup-node@v4` step can't resolve the cache path and exits the job.

**Fix options:**

1. Generate and commit `packages/mcp-server/package-lock.json` by running `npm install` inside that directory. Lowest-risk change but adds a large file to version control.
2. Remove the `cache-dependency-path` line from `ci.yml`. The cache is a performance nicety, not a correctness requirement. Smallest diff.
3. Change the job to run `npm install` from the repo root (workspace-aware) and drop the `defaults.run.working-directory: packages/mcp-server` block, so it picks up the root `package-lock.json`. Cleanest architectural fix but touches more of the workflow.

Recommended: option 2 for the quickest unblock, option 3 if doing a proper pass.

### 2. "Website (root package)" job

**Symptom:** exits after ~25 seconds. Fails on the `npm run lint` step.

**Root cause:** `npm run lint` reports **394 pre-existing lint errors** across the repo. Concentrated in:

- `packages/mcp-server/src/local-tools.ts` (many `no-useless-escape`, `prefer-const`)
- `packages/mcp-server/src/text-tool.ts` (many `no-useless-escape`)
- `src/components/ui/*` (warnings, mostly fast-refresh and empty interfaces)
- `src/pages/DeveloperSubmit.tsx` (`no-explicit-any`)
- `tailwind.config.ts` (`no-require-imports`)

ESLint exits non-zero, which fails the job before `npm run build` and `npm test` can run. Phase 2 files contribute zero of the 394 errors - verified during Phase 2 verification.

**Fix options:**

1. **Short-term unblock:** add `continue-on-error: true` to the `Lint` step in `ci.yml:28` so the check goes green on `npm run build` + `npm test` passing. Hides existing lint debt but also hides future lint regressions.
2. **Split the step:** have lint run in a separate job with its own outcome, so build/test can go green even while lint stays red. Clean separation but adds a job.
3. **Do the cleanup:** actually fix the 394 errors across the codebase. Big scope, ideally done before Phase 3 so auth-protected surfaces start on a green baseline.

Recommended: option 2 so lint visibility is preserved without blocking every downstream PR on pre-existing debt, then option 3 as a dedicated cleanup session.

## Why this wasn't done in the Phase 2 PR

Three reasons:

1. **Scope discipline.** Phase 2 is "auth foundation", not "CI cleanup". Folding unrelated CI changes into the same PR makes review harder and blast radius bigger.
2. **PR #14 parity.** Phase 1 shipped with the same CI red. Matching that state keeps the Phase 2 PR's red/green comparable to Phase 1's.
3. **No Phase 2 regression.** Verified locally: `npm run build` passes, `npm test` passes, zero new lint errors, zero new tsc errors in Phase 2 files. The CI failures are not signal about Phase 2 quality.

## Proposed next session

Small CI cleanup session on its own branch (`claude/ci-cleanup` or similar):

1. Remove `cache-dependency-path` from the MCP server job (or fix via option 3 above).
2. Split lint into its own job OR add `continue-on-error: true` as a short-term unblock.
3. Land those two fixes first so Phase 3 starts on a green CI baseline.
4. Separately, queue a lint cleanup session to actually resolve the 394 errors. Not blocking anything.

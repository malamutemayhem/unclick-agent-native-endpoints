# Architecture QC Tidy Pass

**Status**: Draft QC report  
**Last updated**: 2026-05-10 UTC  
**Linked todo**: `87fb888e-cf6d-43f8-93e3-d3126b08b80b`  
**Scope**: non-destructive scan for duplicate helpers, route and component bulk, legacy labels, weak boundaries, and test gaps

## Executive read

The repo is healthy enough to keep shipping, but the next quality bottleneck is not one bug. It is repeated architecture pressure in four places:

1. security-sensitive crypto helpers are copied across API handlers;
2. API handlers import package source files directly instead of stable package exports;
3. legacy Boardroom/Fishbowl naming is still spread across API, UI, tests, and docs;
4. a few files are large enough that new features will keep landing in the same modules unless PRs get a reuse/split checklist.

This report does not propose a broad rewrite. It creates small follow-up chips with exact surfaces and checks.

## Scan inputs

Commands run from repo root:

- `gh pr list --state open --limit 10 --json number,title,isDraft,mergeStateStatus,statusCheckRollup,url,headRefName`
- PowerShell `Select-String` scans for `Fishbowl`, `Popcorn`, `Bailey`, `Master (`, and `Claude Cowork`
- PowerShell `Select-String` scans for `pbkdf2`, `createCipheriv`, `createDecipheriv`, and `AES-256-GCM`
- PowerShell `Select-String -SimpleMatch '../src/'` and package source import scans under `api/`
- PowerShell line-count scan for non-test `*.ts`, `*.tsx`, `*.mjs`, and `*.js` files over 300 lines

Open PR state at scan time: no open GitHub PRs.

## Confirmed findings

### F1. Crypto helper duplication remains in security-sensitive API handlers

Evidence:

- `api/backstagepass.ts:65`, `api/backstagepass.ts:87`, `api/backstagepass.ts:95`, `api/backstagepass.ts:111`
- `api/credentials.ts:34`, `api/credentials.ts:44`, `api/credentials.ts:49`, `api/credentials.ts:64`
- `api/memory-admin.ts:193`, `api/memory-admin.ts:485`, `api/memory-admin.ts:490`, `api/memory-admin.ts:500`, `api/memory-admin.ts:632`, `api/memory-admin.ts:5851`

Why it matters:

- AES-256-GCM and PBKDF2 policy should have one implementation and one known-answer test suite.
- Duplicated key derivation and cipher code makes rotation, hardening, and audit harder.
- `docs/architecture/target-state.md` already calls for a shared crypto package, so this is aligned with the existing target.

Recommended child chip:

- Extract one shared crypto helper for API credential encryption and decryption.
- Keep callers behavior-compatible.
- Add round-trip and tamper-tag tests before deleting duplicate helpers.

### F2. API handlers import workspace package source files directly

Evidence:

- `api/mcp.ts:30` imports `../packages/mcp-server/src/server.js`
- `api/memory-admin.ts:167` imports `../packages/mcp-server/src/cards/card.js`
- `api/memory-admin.ts:177` imports `../packages/mcp-server/src/reliability.js`
- `api/memory-admin.ts:178` imports `../packages/mcp-server/src/signals/emit.js`
- `api/testpass.ts:31`, `api/testpass.ts:38`, `api/testpass.ts:43` through `api/testpass.ts:51` import TestPass source modules
- `api/testpass-run.ts:16`, `api/testpass-run.ts:23` through `api/testpass-run.ts:31` import TestPass source modules
- `api/uxpass.ts:21`, `api/uxpass.ts:26`, `api/uxpass.ts:27`, `api/uxpass.ts:32` import UXPass source modules
- `api/uxpass-run.ts:20`, `api/uxpass-run.ts:21`, `api/uxpass-run.ts:22` import UXPass source modules

Why it matters:

- The API layer is coupled to package internals rather than public exports.
- Package source file moves can break Vercel handlers without a package version or export contract catching it.
- It blurs ownership between API runtime behavior and publishable packages.

Recommended child chip:

- Add explicit package exports for the small helper surfaces the API uses, then move API imports to package names.
- Start with one package, preferably TestPass, because the import cluster is clear and already route-owned.

### F3. Legacy Boardroom/Fishbowl naming remains in live and test surfaces

Evidence from grouped scan:

- `api/memory-admin.ts`: 33 matches
- `api/lib/fishbowl-todo-handoff.ts`: 33 matches
- `src/pages/admin/Fishbowl.tsx`: 27 matches
- `api/fishbowl-message-handoff.test.ts`: 24 matches
- `api/lib/fishbowl-idea-council.ts`: 16 matches
- `api/lib/fishbowl-message-handoff.ts`: 15 matches
- `src/pages/admin/fishbowl/messageLanes.ts`: 14 matches
- `api/fishbowl-idea-council.test.ts`: 13 matches
- `src/pages/admin/AdminAgentsSeatUtils.ts`: 8 matches
- `src/pages/admin/fishbowl/Settings.tsx`: 7 matches

Why it matters:

- The product language has moved toward Boardroom, Seats, Heartbeat, Worker Registry, and AutoPilot.
- Legacy labels can confuse users and agents when the same concept has more than one public name.
- This is not just text replacement: API action names, tests, docs, and UI route compatibility need a compatibility plan.

Recommended child chip:

- Produce a compatibility map first: internal identifier, public label, route/API alias, and planned deprecation state.
- Only rename user-facing copy after tests lock route/API compatibility.

### F4. Oversized files create repeated landing zones for unrelated work

Largest non-test files by line count:

| Lines | File |
| ---: | --- |
| 13343 | `packages/mcp-server/src/tool-wiring.ts` |
| 9346 | `api/memory-admin.ts` |
| 3398 | `src/components/Tools.tsx` |
| 2185 | `packages/mcp-server/src/catalog.ts` |
| 2102 | `packages/mcp-server/src/server.ts` |
| 1777 | `src/pages/admin/AdminKeychain.tsx` |
| 1565 | `apps/api/src/db/index.ts` |
| 1511 | `scripts/pinballwake-autonomous-runner.mjs` |
| 1378 | `src/pages/admin/AdminJobs.tsx` |
| 1334 | `src/pages/admin/AdminOrchestrator.tsx` |
| 1149 | `packages/mcp-server/src/local-catalog-handlers.ts` |
| 1137 | `packages/mcp-server/src/memory/supabase.ts` |
| 1079 | `src/pages/admin/AdminAgents.tsx` |
| 1036 | `packages/mcp-server/src/csuite-tool.ts` |
| 1020 | `api/backstagepass.ts` |
| 1015 | `api/lib/orchestrator-context.ts` |

Why it matters:

- Large files make review weaker because unrelated concerns sit together.
- They encourage "just add one more branch" patches.
- Several of these are product-critical, so every split needs small compatibility steps and focused tests.

Recommended child chip:

- Start with a report-to-checklist gate and one file-specific split. The cleanest first split candidate is `src/components/Tools.tsx`, because it is user-facing, large, and likely extractable into search, filters, grid, and tool-card modules without API risk.

### F5. API-to-SPA import smell appears resolved, but package boundary smell replaced it

Evidence:

- `Select-String -SimpleMatch '../src/'` under `api/` returned no matches in this scan.
- API-to-package-source imports are still present, listed in F2.

Why it matters:

- This is good progress from the older architecture map, but the boundary rule should be updated.
- The new rule should not only say "do not import from `src/`." It should also say "do not import package internals by relative path unless a chip explicitly scopes that exception."

## Candidate findings needing owner decision

### C1. `apps/api/src/db/index.ts` contains substantial inline bootstrap SQL

Evidence:

- `apps/api/src/db/index.ts` is 1565 non-test lines.
- The first section shows `initDb()` executing inline `CREATE TABLE IF NOT EXISTS` statements.

Why this needs an owner decision:

- This may be intentional for a PGlite local service path.
- Splitting it could improve readability, but it touches DB bootstrap semantics and should not be bundled into a cleanup PR without a scoped owner.

### C2. Published MCP package file size may need code generation, not manual splitting

Evidence:

- `packages/mcp-server/src/tool-wiring.ts` is 13343 lines.
- `packages/mcp-server/src/catalog.ts` is 2185 lines.
- `packages/mcp-server/src/server.ts` is 2102 lines.

Why this needs an owner decision:

- These files may be generated-like wiring even if they are checked in manually.
- Manual splitting can increase drift unless the manifest/codegen direction is chosen first.

## Recommended PR checklist addition

Add this lightweight item to PR descriptions or review templates:

> Reuse and boundary check: list the existing helper, route, component, package export, or worker pattern you reused. If adding a new pattern, explain why reuse was not enough. Confirm the patch does not add new relative imports into package internals or create/expand a file beyond 300 lines without a split plan.

This checklist should be advisory at first. It can become a CI or reviewer gate after two or three cleanup chips prove the pattern.

## Child chips to create

### 1. Shared API crypto helper v1

Owned files:

- `api/backstagepass.ts`
- `api/credentials.ts`
- `api/memory-admin.ts`
- new helper under `api/lib/` or `packages/crypto/`
- focused tests for helper and at least one caller

Tests:

- `npm run build`
- focused API crypto helper test
- `git diff --check`

Exit criteria:

- PBKDF2 and AES-256-GCM implementation exists in one helper.
- Existing encrypted payload format remains readable.
- Tampered auth tag rejection is covered.

### 2. TestPass API package-boundary cleanup v1

Owned files:

- `api/testpass.ts`
- `api/testpass-run.ts`
- `packages/testpass/package.json`
- `packages/testpass/src/index.ts` or equivalent public export file

Tests:

- focused TestPass API/unit tests if present
- `npm run build`
- `git diff --check`

Exit criteria:

- API handlers import TestPass helpers through package exports or one documented boundary module.
- No behavior change to run creation, pack loading, or reporting.

### 3. Boardroom/Fishbowl naming compatibility map v1

Owned files:

- `docs/architecture/boardroom-fishbowl-compatibility-map.md`
- `src/pages/admin/Fishbowl.tsx`
- `src/pages/admin/fishbowl/*`
- `api/lib/fishbowl-*`
- `api/fishbowl-*.test.ts`

Tests:

- `npm run build`
- relevant fishbowl/boardroom focused tests
- `git diff --check`

Exit criteria:

- The map identifies each internal identifier and its current public label.
- User-facing copy decisions are separated from route/API compatibility.
- No route or API rename happens without tests.

### 4. Tools component split v1

Owned files:

- `src/components/Tools.tsx`
- new components under `src/components/tools/`

Tests:

- `npm run build`
- focused UI test if one exists or a minimal render test if added in the chip
- `git diff --check`

Exit criteria:

- Tool search/filter/grid/card concerns are split into smaller components.
- Behavior and visual copy stay unchanged.
- No marketing or product content rewrite is included.

### 5. Architecture reuse checklist v1

Owned files:

- `.github/pull_request_template.md` or current PR template location
- `docs/architecture/architecture-qc-tidy-pass.md`

Tests:

- `git diff --check`

Exit criteria:

- PR authors have a lightweight reuse/boundary checklist.
- Checklist names file-size, helper reuse, package-boundary, and abstraction-justification checks.

## Non-goals for this pass

- No production code edits.
- No destructive cleanup.
- No route deletion or rename.
- No migration changes.
- No build or deploy configuration changes.
- No broad refactor of `api/memory-admin.ts`, `tool-wiring.ts`, or admin surfaces.

## Suggested closure

Once this report merges and the child chips exist in Boardroom, close or downgrade the parent Architecture QC todo. The child work should carry implementation risk from here.

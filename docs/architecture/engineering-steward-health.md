# Engineering Steward Health Snapshot v1

Source date: 2026-05-16
Parent lane: Permanent Engineering Steward
ScopePack: f2b73510-77c7-401c-967b-efbb90687c2c

## Current Picture

UnClick is a working monorepo with a Vite React app, Vercel serverless APIs, Supabase, pgvector-backed Memory, MCP tooling, TestPass, Signals, Build Desk, Crews, and marketplace plumbing. The current-state map identifies the commercial center as `@unclick/mcp-server`, with the root app, Vercel API layer, Supabase migrations, and admin surfaces all sharing one repository.

The platform architecture is strong in product coverage but uneven in boundaries. Current docs show several clear pressure points: `api/memory-admin.ts` is a 5,401-line action switch, MCP tool wiring is very large, crypto helpers are duplicated, some server code imports from React-side `src/lib`, and several database areas still need stronger RLS or audit posture.

## Target Gap Summary

The target architecture already defines a sensible north star:

- Move toward first-class `apps/web` and `apps/api` boundaries.
- Finish the Hono API path or thin Vercel handler path.
- Add shared `packages/types`, `packages/auth`, `packages/db`, and `packages/crypto`.
- Move business rules into services and tenant-safe repositories.
- Enforce destructive-action audit logging and table-level tenancy safeguards.
- Split large frontend and API files with behavior-preserving, incremental PRs.

The gap is not lack of vision. The main risk is that broad target-state work can sprawl unless each improvement ships as a small ScopePack with exact files, tests, and stop conditions.

## Top Risks And Opportunities

1. God-handler risk in `api/memory-admin.ts`.
   Evidence: `current-state.md` lists a 5,401-line handler with 92 actions. Target: route groups and thin handlers in `target-state.md` section 2. This should be split through small service or route chips, not one large rewrite.

2. Tenant-safety and audit gaps.
   Evidence: `current-state.md` calls out missing RLS on tables such as `memory_configs`, `memory_devices`, `build_*`, `memory_load_events`, and `tenant_settings`, plus missing audit coverage for some destructive writes. Target: `target-state.md` sections 5.2 and 5.3.

3. Package-boundary drift.
   Evidence: `current-state.md` notes `api/memory-admin.ts` imports `../src/lib/crews/engine`, crossing from API code into React app code. Target: move council logic out of `src/lib` into a service or package boundary.

4. Duplicated security-sensitive helpers.
   Evidence: `current-state.md` records three PBKDF2 and AES-GCM helper copies across `api/backstagepass.ts`, `api/credentials.ts`, and `api/memory-admin.ts`. Target: `packages/crypto` as one tested source.

5. Oversized product surfaces slow review.
   Evidence: `current-state.md` names large frontend files such as `DeveloperDocs.tsx`, `Tools.tsx`, `Connect.tsx`, `SmartHome.tsx`, `MemorySetup.tsx`, and `MemoryConnect.tsx`. Target: feature folders, component size budget, and focused extraction PRs in `target-state.md` section 7.

## Recommended Child ScopePacks

- Security RLS coverage check v1: inspect current migrations against the documented gap list and add a no-behavior-change report or migration ScopePack. Stop before applying production data changes.
- Memory-admin route split starter v1: move one low-risk read action behind a thin shared handler pattern with tests, leaving the compatibility surface intact.
- API crypto helper consolidation v1: use the existing Architecture QC child job for a behavior-compatible crypto helper and round-trip tests.
- Crews engine boundary v1: move the server-consumed council engine out of React `src/lib` into a server-safe package or service facade without changing behavior.
- Tools component split v1: use the existing Architecture QC child job to split `src/components/Tools.tsx` with render coverage and no product redesign.

## Steward Rules For The Parent Lane

- Keep the parent open as a recurring health lane.
- Create child ScopePacks for implementation.
- Prefer documentation, inventory, and proof when a broad decision is needed.
- Do not merge, deploy, change secrets, change billing, change DNS, run migrations, or rewrite large surfaces from the parent.
- Every child ScopePack should name owned files, non-overlap, smallest safe step, verification, and stop conditions.

## Verification Plan For This Snapshot

- `git diff --check`
- Zero em dash scan on `docs/architecture/engineering-steward-health.md`
- Markdown lint only if a repository script exists

# ADR-0008: Monorepo with bounded contexts

**Status**: Accepted
**Date**: 2026-04-25
**Supersedes/Extends**: None

## Context

UnClick has six first-class products (Memory, BackstagePass, Crews, TestPass, Signals, Build Desk) plus the umbrella platform and marketplace. Two structural options exist for organising the code. Option A is multiple repos, one per product, each independently released and versioned. Option B is a single monorepo with packages split by product. A third, bad option is a single monorepo split by layer: `controllers/`, `services/`, `models/`.

Multi-repo works for independent teams with independent release cycles, but creates friction for tightly-coupled products that must ship coordinated changes. UnClick's products share a tenant model, a memory layer, and an MCP tool-wiring surface; coordinated releases are the norm, not the exception. Layer-based splits create cross-cutting dependencies: every feature touches the controllers, services, and models folders, so a PR is spread across the tree and review becomes difficult.

## Decision

Single git repository. Packages split by product (crews, testpass, memory, etc.) and not by layer (controllers, services, models). Each product package owns its domain logic, types, and API surface. Shared concerns (auth resolution, crypto primitives, generated Supabase types) live in dedicated shared packages. The monorepo is a pnpm/npm workspaces setup with Turbo for task orchestration.

The current layout has drift (see `docs/architecture/current-state.md` sections 1 and 2): `src/` is the website at the repo root rather than `apps/web`, `apps/api` coexists with the Vercel `api/` functions, and `packages/memory-mcp` is deprecated. The target layout (see `docs/architecture/target-state.md` section 1) codifies the bounded-context split. Rearranging is incremental; the rule is that new work lives in the correct bounded context.

## Consequences

**Benefits:**
- Products are independently deployable via the build graph. Turbo runs only what changed.
- Domain logic stays co-located with its package. A developer working on Crews reads `packages/crews/` top to bottom.
- Cross-product refactors ship as a single PR. Coordination is cheap.
- Shared packages (types, crypto, auth) prevent duplication of security-critical code.

**Drawbacks / trade-offs:**
- Single repo means a single blast radius for pushes. A broken `main` blocks every product.
- Monorepo tooling (Turbo, pnpm workspaces) adds complexity over a simple repo.
- The current layout has legacy drift. Migrating to the bounded-context target is a multi-phase job; mixed states will exist in the meantime.

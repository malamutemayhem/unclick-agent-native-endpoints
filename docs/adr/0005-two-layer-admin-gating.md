# ADR-0005: Two-layer admin gating

**Status**: Accepted
**Date**: 2026-04-25
**Supersedes/Extends**: None

## Context

Several UnClick surfaces are admin-only: `/admin/users`, `/admin/moderation`, `/admin/system-health`, `/admin/audit-log`, `/admin/orchestrator`, `/admin/analytics`, `/admin/codebase`. Gating has two components that interact. The server must refuse unauthorised actions, because anything less is a security failure. The frontend must also hide the unauthorised UI, because showing a broken link or a 403 page creates noise for normal users and makes non-admin tenants think the product is buggy. Relying on only one layer picks between a security hole and a broken user experience.

## Decision

Every admin-only action is refused at the server level AND hidden at the frontend level. Both layers are required for every admin surface. Server-side refusal uses the `ADMIN_EMAILS` env var checked in the tenant resolver; unauthorised requests get `{ error: "admin only" }` with the appropriate status. Frontend hiding uses the `<RequireAdmin>` component which removes the route from the sidebar and redirects away if accessed directly by URL.

An admin feature that ships server-only refusal without frontend hiding (or vice versa) is treated as a bug, not a partial win. A PR adding an admin surface must wire both layers in the same change.

## Consequences

**Benefits:**
- Defence in depth. A frontend bug that leaks a link does not leak data; a server bug that misses a check does not reach a user who does not know the endpoint exists.
- Clean non-admin UX. Normal users never see admin surfaces or get 403 pages for features they are not meant to have.
- Security review is simpler. Both layers are checked together; we do not argue about whether one was "enough."

**Drawbacks / trade-offs:**
- Every admin PR has a double surface: backend check plus frontend gate. Slightly more code per feature.
- `ADMIN_EMAILS` env var rotation requires a redeploy. Low cost, but not runtime-configurable. A future enhancement is an admin role column on `api_keys`.
- Two layers means two test paths: the server refusal path and the frontend hide path must both be covered.

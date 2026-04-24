# ADR-0004: Multi-tenant via `api_key_hash`

**Status**: Accepted
**Date**: 2026-04-25
**Supersedes/Extends**: None

## Context

UnClick serves agents via MCP and humans via a web app. Agents authenticate with a bearer API key (`uc_*` or `agt_*`). Humans authenticate with Supabase Auth, which issues JWTs. Both surfaces need a single tenant identifier so every row in the database can be scoped to one owner. The obvious choice is Supabase `user_id`, but that path fails immediately: memory predates the Supabase Auth wiring (`api_keys.user_id` was added later as a nullable column), and BYOD users store memory in their own Supabase project where our `auth.users` table does not exist. A tenant key that works for both auth paths and for BYOD mode must live above the auth table.

## Decision

`api_key_hash` (SHA-256 of the user's API key) is the canonical tenant identifier. Every user-scoped row includes an `api_key_hash` column. Every serverless handler that uses `service_role` adds a manual `.eq("api_key_hash", tenant.apiKeyHash)` filter to every query in addition to Row Level Security policies. RLS alone is not enough because most application code uses service_role which bypasses RLS; manual filters alone are not enough because any future unfiltered query leaks cross-tenant. Both layers are required, not either.

For the browser auth path, the client never supplies its own `api_key_hash`. `resolveSessionUser()` validates the Supabase JWT server-side, then re-derives the hash from `api_keys` by `user_id`. For the bearer path, `resolveApiKeyHash()` SHA-256s the inbound key directly. The two helpers unify into a single `TenantContext` shape used by every handler.

## Consequences

**Benefits:**
- One tenant key across managed cloud, BYOD, and both auth modes.
- Independent of Supabase Auth mode changes (OAuth, magic link, MFA, etc.).
- Works in BYOD where UnClick's `auth.users` is not reachable.
- Replayed localStorage tokens cannot cross tenants because the hash is always re-derived server-side.

**Drawbacks / trade-offs:**
- Two layers of enforcement (RLS + manual filter) are both required at every query site. A missed manual filter leaks today even with RLS on; a table with no RLS leaks if a non-service_role path is ever introduced. See `docs/security/current-posture.md` C1 and C3 for the class of bug this creates.
- No compile-time guarantee that every query is scoped. The structural fix is the repository layer proposed in `docs/architecture/target-state.md` section 4.
- Tenants cannot change their api_key without a hash rotation. `reset_api_key` is supported but requires downstream data migration for users running agents with the old key cached.

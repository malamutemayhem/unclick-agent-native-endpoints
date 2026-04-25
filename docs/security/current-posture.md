# UnClick - Current Security Posture

**Phase 1 Ground Floor QC. Generated 2026-04-24. Snapshot of `main` at commit `4f655f2`.**

This document audits the security posture of UnClick as it stands today. Every rating is tied to a concrete file or migration. CRITICAL items are flagged up front and **must** be resolved before Phase 3 (see [`../architecture/target-state.md`](../architecture/target-state.md#migration-strategy-how-we-get-from-current-to-target)). For threat modelling see [`threat-model.md`](./threat-model.md).

---

## Critical findings (fix before Phase 3)

### C1. `memory_configs` and `memory_devices` have no RLS enabled
**File**: `supabase/migrations/20260414000000_memory_byod.sql`.
- `memory_configs` (lines 8-25) stores the **AES-256-GCM encrypted Supabase service-role key per user**, plus IV, auth tag, and salt.
- `memory_devices` (lines 31-44) stores device fingerprints and labels per user.
- **Neither table has `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`**, and no `CREATE POLICY` statements exist for them (grep confirms).

Impact: any code path that uses the anon key (not service_role) would see all rows. Current application code happens to always use service_role and a manual `WHERE api_key_hash = ...` filter, so production is not leaking today. But RLS is the defence-in-depth layer: a future bug, an added debug endpoint, or a third-party Supabase client connection would leak cross-tenant. For a table holding encrypted service-role keys this is the wrong shape.

**Action**: enable RLS with `service_role` bypass + `block_anon_access` + `block_authenticated_direct_access` policies, matching the pattern used on `user_credentials` (`20260420030000_user_credentials.sql`).

### C2. `admin_clear_all` nukes user memory with no audit log
**File**: `api/memory-admin.ts:3976-4014`.
- Deletes from 7 user-scoped tables (`mc_extracted_facts`, `mc_business_context`, `mc_session_summaries`, `mc_conversation_log`, `mc_code_dumps`, `mc_knowledge_library`, `mc_knowledge_library_history`) scoped to the caller's `api_key_hash`.
- Guard: `body.confirm === "DELETE"` string check.
- **No row is written to any audit table** before or after the cascade.

Contrast with `delete_account` (lines 3432-3582) which records `account_deletions_audit` + `backstagepass_audit` before the delete cascade. The same pattern should apply here.

**Action**: write an `account_deletions_audit`-shaped row (or new `memory_wipe_audit`) before the delete sequence, including row counts per table.

### C3. `admin_tools` leaks the global `platform_connectors` catalog
**File**: `api/memory-admin.ts:3602-3604`.
```ts
const { data: connectors } = await supabase
  .from("platform_connectors")
  .select("*");
```
No `.eq("api_key_hash", ...)` or similar filter. Any authenticated user can enumerate every connector registered to the system.

If `platform_connectors` only holds public catalog data, the disclosure is low-severity. But the same pattern appears elsewhere and the schema comment (`20260410100000_keychain_mvp.sql:31`) does not forbid per-tenant entries. This is a latent cross-tenant read.

**Action**: either confirm the table is global-public and add a comment, or add per-tenant scoping.

### C4. 32 npm vulnerabilities, 18 High (including SQL injection and XSS)
`npm audit` on the root workspace reports:
- **32 vulnerabilities: 3 low, 11 moderate, 18 high**.

High-severity highlights:
- **`drizzle-orm` < 0.45.2** - SQL injection via improperly escaped identifiers (GHSA-gpj5-g38j-94v9). Used in `apps/api`. Current version < 0.45.2 per lockfile.
- **`@remix-run/router` <= 1.23.1** - XSS via open redirects in React Router (GHSA-2w69-qvjg-hvjx). Affects `react-router-dom@^6.30.1`.
- **`undici` <= 6.23.0** - Multiple High issues: CRLF injection, HTTP smuggling, unbounded decompression, insufficient randomness. Pulled in via `@vercel/node`.
- **`@vercel/node`** - multiple transitive highs (esbuild dev-server access, path-to-regexp, undici).
- **`flatted`** - prototype pollution + unbounded recursion DoS.
- **`tar` / `@mapbox/node-pre-gyp`** - hardlink path traversal.
- **`glob` 10.2.0-10.4.5** - CLI command injection (lower practical concern; we do not shell out via `glob`).

Fix path: `npm audit fix --force` requires major-version upgrades of `drizzle-kit`, `@vercel/node`, and `jsdom`. Plan a dedicated PR.

**Action**: run `npm audit fix`, then triage each remaining High via targeted upgrades.

---

## Full audit by area

### 1. Secret management - strong

**Findings**:
- `.gitignore` excludes `*.local`, `*.local.json`, `.vercel` (`.gitignore:1-27`).
- `.env.local.example` contains only template values (no real secrets).
- `git log --all -p -- .env .env.local .env.production .env.development` returns no results. **No env file has ever been committed.**
- Grep for `eyJ` (JWT prefix) in source returns only legitimate schema validation and test data, no leaked tokens.
- Grep for hardcoded `sk_`, `sk-`, Anthropic `ant-*`, or Stripe keys returns no hits outside `.env.local.example` placeholders.

**Rating**: strong.

### 2. service_role usage audit - mixed

Every file that uses `SUPABASE_SERVICE_ROLE_KEY`:

| File | Usage | Manual tenancy filter? |
|---|---|---|
| `api/memory-admin.ts:1261-1268` | Single handler-level client for all 92 actions. | Yes, every query adds `.eq("api_key_hash", hash)`. |
| `api/memory-admin.ts:173-203` | `installSchema()` on user's BYOD Supabase project. | N/A (operates on user-supplied project). |
| `api/memory-admin.ts:2019-2096` | `setup` action validates a user-provided service_role_key, encrypts, stores in `memory_configs`. | Scoped by user. |
| `api/memory-admin.ts:3558` | `auth.admin.deleteUser()` in `delete_account`. | Scoped by session user. |
| `api/credentials.ts` | BackstagePass legacy vault. | Yes, `api_key_hash` scoped. |
| `api/backstagepass.ts` | BackstagePass vault. | Yes, `api_key_hash` + JWT + plaintext api_key (timing-safe). |
| `src/lib/crews/engine.ts:37` | Creates service_role client for council engine; used from `api/memory-admin.ts`. | All RPC calls scope by `api_key_hash`. |
| `packages/mcp-server/src/memory/supabase.ts:75-149` | MANAGED-mode memory backend. `withTenancy()` wrapper on lines 162-167 adds tenancy filter. | Yes. |

Commentary: the service-role pattern plus manual scoping is the standard Supabase practice and is consistently applied. The failure mode is a **missed filter**; there is no way to tell statically from the codebase that every query is scoped. See [target-state.md section 4](../architecture/target-state.md#4-repository-layer) for the type-system enforcement proposal.

**Rating**: needs attention (strong discipline today, but no compile-time guarantee).

### 3. RLS coverage per table - needs attention

RLS is enabled on **31 tables** (see [`../architecture/current-state.md` section 6](../architecture/current-state.md#6-database-schema-inventory)).

**Confirmed without RLS** (critical in bold):
- **`memory_configs`** (see C1).
- **`memory_devices`** (see C1).
- `build_tasks`, `build_workers`, `build_dispatch_events` (`20260417000000_build_desk.sql` - no ENABLE ROW LEVEL SECURITY).
- `memory_load_events` (both `20260417000000_memory_load_events.sql` and `20260417010000_memory_load_events.sql` create the table without RLS).
- `tenant_settings` (created by three separate migrations, none enable RLS).
- `conflict_detections`, `tool_detections` (standalone creation migrations bare).
- `bug_reports` (RLS status unverified; no ENABLE statement in migrations grep).
- `mc_agents`, `mc_crews`, `mc_crew_runs` (Phase B migration is 52KB; RLS statements exist for some but full audit needed).

**Rating**: needs attention (5+ tables without RLS; one holds encrypted service-role keys).

### 4. Two-layer gating (server guard + frontend hide) - mostly enforced

Server-side guards exist via:
- `resolveApiKeyHash()` / `resolveSessionUser()` / `resolveSessionTenant()` in `api/memory-admin.ts:205-391`.
- `ADMIN_EMAILS` env var checked for admin-only actions (`admin_profile`, admin pages).
- `RequireAdmin` wrapper in `src/App.tsx:147-153` hides admin routes from the sidebar.

Gaps:
- `admin_tools` does the frontend hide but the server-side does **not** filter `platform_connectors` (see C3).
- Three actions accept `?api_key=...` in the query string (see section 8 below), which partially negates the Bearer-only guard.

**Rating**: needs attention.

### 5. Input validation - fix now

Zod is imported at `api/memory-admin.ts:100` and used **only** in the MCP tool-definition helper at lines 855-915. None of the 92 request handlers validate a body schema with Zod. Validation pattern is ad-hoc:

- Required-field checks: `if (!fact_id) return res.status(400)...`.
- Enum checks hardcoded inline: `["replaceable", "conflicting", "compatible"].includes(d.classification)` (line 3695).
- Numeric bounds: `Math.min(Math.max(limit, 1), 200)` for list limits (line 4702).
- **`JSON.parse(body.value)` without try/catch** on `update_business_context` line 1564 - crashes the function on malformed JSON.
- No request size limits, no rate limits on the Vercel surface (see section 10), no content-type enforcement.

The same applies to `api/arena.ts`, `api/backstagepass.ts`, `api/credentials.ts`, `api/oauth-callback.ts`: string casting without schema validation.

**Rating**: fix now.

### 6. XSS surface - strong

Frontend (`src/`) `dangerouslySetInnerHTML` hits found by grep:
- `src/pages/BackstagePass.tsx:246` - JSON-stringified schema.org structured data. Safe (no user input).
- `src/components/ui/chart.tsx:70` - hardcoded theme CSS map. Safe.

No `innerHTML =` assignments. No `eval`. React's default escaping protects all dynamic UI.

**Rating**: strong.

### 7. CORS + security headers - fix now

CORS (`Access-Control-Allow-*` headers set in each handler):
- `api/arena.ts:395,414,425` - `Access-Control-Allow-Origin: '*'` on a public read surface.
- `api/backstagepass.ts`, `api/credentials.ts` - `https://unclick.world` only (strict, correct).
- `api/mcp.ts`, developer endpoints - `'*'`.

Security headers: **none set**. Grep across the repo returns zero matches for:
- `Content-Security-Policy`.
- `X-Frame-Options`.
- `X-Content-Type-Options`.
- `Strict-Transport-Security`.
- `Referrer-Policy`.
- `Permissions-Policy`.

`vercel.json` has no `headers` block.

**Rating**: fix now.

### 8. Query-string authentication - needs attention

Three actions in `api/memory-admin.ts` accept `?api_key=...` in the URL as an alternative to the Bearer header:
- `setup_status` (line 2007).
- `conflict_check` (line 2781).
- `health_summary` (line 2918).

Query strings are captured by Vercel access logs, CDN logs, browser history, and shared links. The correct pattern (used everywhere else in `memory-admin.ts`) is Bearer header only.

**Rating**: needs attention.

### 9. Dependency vulnerabilities - fix now

See C4. Totals: **32 vulnerabilities (3 low, 11 moderate, 18 high)**. Breakdown above.

**Rating**: fix now.

### 10. Rate limiting - fix now

- `apps/api/src/middleware/rate-limit.ts:1-67` implements a sliding-window limiter for the Hono service (free=60, pro=300, team=1000 req/min). This code is **not** deployed in front of the Vercel surface.
- `api/*` Vercel serverless functions have **zero rate limiting**. Any caller with a Bearer token can hit `delete_fact`, `admin_clear_all`, `setup`, `generate_api_key`, `reset_api_key`, `oauth-callback`, `report-bug`, `backstagepass` at unbounded rates.

**Rating**: fix now.

### 11. Audit log coverage - needs attention

Audit tables present:
- `backstagepass_audit` (`20260420100000_backstagepass_audit.sql`) - RLS service_role-only. Records every BackstagePass action (`api/backstagepass.ts` writes on list / reveal / update / delete).
- `account_deletions_audit` (`20260423200000_account_deletions_audit.sql`) - RLS service_role-only. Recorded by `delete_account` before cascade (line 3471).
- `facts_audit` + `mc_facts_audit` (`20260422010000_memory_bitemporal_and_provenance.sql`) - fact mutation trail (fire-and-forget inserts from `packages/mcp-server/src/memory/supabase.ts`).

Destructive actions **without** audit:
- `admin_clear_all` (the full memory wipe) - **critical gap**.
- `delete_fact` (single fact soft-delete) - no audit.
- `delete_session` (single session delete) - no audit.
- `admin_agent_delete` - no audit.
- `delete_crew` - no audit.
- `update_business_context` (upsert of standing rules) - no audit.
- `admin_update_fact` (manual fact rewrite) - no audit.
- `reset_api_key` (rotates the tenant's primary API key) - no audit.

**Rating**: needs attention.

### 12. Auth flow review - mostly strong, one gap

Flows:
- **Magic link / password / MFA** via Supabase Auth UI at `src/pages/Login.tsx`, `src/pages/Signup.tsx`, `src/pages/AuthCallback.tsx`, `src/pages/VerifyMfa.tsx`. Supabase handles token issuance; client stores JWT in Supabase client (cookie + localStorage).
- **OAuth** for platform connectors (Xero, Reddit, Shopify) via `api/oauth-callback.ts`. Token exchange happens server-side; credentials stored via `api/credentials.ts` POST.
- **API keys** (`uc_*`, `agt_*`) generated via `generate_api_key` / `reset_api_key` in `api/memory-admin.ts`. Stored as SHA-256 hash in `api_keys` table; raw key shown once to the user.

Bypass paths:
- `api/oauth-callback.ts` docstring (line 11) says state token is "validated client-side before this call" - server-side CSRF state verification is missing. A browser-side CSRF token can be bypassed with devtools. The practical impact depends on each platform's OAuth spec and the redirect URI allow-list at the provider level, but we should not rely on client-side validation.
- Several older `api/*` files pull `action` from `req.query` and switch without body-schema validation; this is not a bypass per se, but a source of unpredictable behaviour.

**Rating**: needs attention.

### 13. Prompt injection surface - needs attention

AI-model entry points:
- `packages/mcp-server/src/memory/supabase.ts:39-50` - OpenAI call for atomic fact extraction. User-supplied fact text is passed into the prompt with only `.slice(0, 4000)` truncation.
- `src/lib/crews/engine.ts:74-180` - Anthropic `messages.create()` calls. `taskPrompt` comes from `mc_crew_runs.task_prompt`. Agents' `seed_prompt` is interpolated directly into the system message. No jailbreak filtering, no output validation.
- `api/memory-admin.ts#admin_ai_chat` - Gemini fallback via `@ai-sdk/google`. User-authored input flows directly into `streamText`.

A malicious tenant could craft `seed_prompt` or `taskPrompt` fields that, when run by another tenant's crew that uses the same system agent, alter its behaviour. Because `system` agents are shared (marked `is_system=true`), one tenant's edit to a cloned system agent propagates only to their own clone - so the blast radius is self-contained, but we still have in-tenant injection risk (exfiltration via tool calls, etc.).

**Rating**: needs attention.

### 14. Destructive operations - needs attention

`.delete()` call sites in `api/memory-admin.ts`:
- Lines 1540, 1763, 1792, 1832, 2104, 2258, 3023, 3097, 3572, 4314.

All scope by `api_key_hash` (good) but most have no audit log (see section 11). The most dangerous path is `admin_clear_all` (C2).

No `DROP TABLE` or `TRUNCATE` statements exist anywhere under `api/` or in non-migration SQL. Migrations are additive. Good.

**Rating**: needs attention.

### 15. Secret scanning / git history - strong

- `git log --all -p -- .env*` returns nothing.
- `.gitignore` covers `*.local`, `*.local.json`, `.vercel`.
- GitHub push protection status should be confirmed at the repo level; the codebase does not indicate whether it is on. **Recommend: verify via GitHub settings and screenshot for audit.**

Gaps in `.gitignore`:
- No explicit `*.pem`, `*.key`, `*.p12`, `*.pfx` patterns. These are unlikely to be present today but a defensive addition costs nothing.

**Rating**: strong.

---

## Ratings summary

| Area | Rating |
|---|---|
| Secret management (source + git history) | strong |
| service_role usage | needs attention |
| RLS coverage | needs attention (C1) |
| Two-layer gating | needs attention (C3) |
| Input validation | **fix now** |
| XSS surface | strong |
| CORS + security headers | **fix now** |
| Query-string auth | needs attention |
| Dependency CVEs | **fix now** (C4) |
| Rate limiting | **fix now** |
| Audit log coverage | needs attention (C2) |
| Auth flow review | needs attention |
| Prompt injection | needs attention |
| Destructive operations | needs attention |
| Git history / secret scanning | strong |

---

## Appendix A. Near-miss incident recap (2026-04-22)

Per prior session notes and the bitemporal migration timestamp (`20260422010000_memory_bitemporal_and_provenance.sql`), a cross-tenant data leak scare occurred on 2026-04-22 involving the facts surface. Mitigations shipped:
- `api_key_hash` scoping reinforced on all facts queries.
- `mc_facts_audit` added (`20260422010000_memory_bitemporal_and_provenance.sql:113`) to record every fact mutation.
- Bitemporal columns (`valid_from`, `valid_to`) added so soft-deletes do not lose history.

The fact **write** path is now defensible. The **read** path is defensible because every query filters by `api_key_hash`. The residual risk is the class of bugs that would add an unfiltered query in the future (C1, C3 both fall into this class). Closing it structurally requires the repository layer proposed in [target-state.md section 4](../architecture/target-state.md#4-repository-layer).

---

**End of current-posture.md.**

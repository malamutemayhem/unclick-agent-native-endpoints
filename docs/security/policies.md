# UnClick Security Policies

**Baseline**: PR #128 ground-floor QC audit (2026-04-24, commit `4f655f2`).
**Fixes applied**: PR #129 (open) closes C1 (RLS on `memory_configs` + new `mc_admin_audit` table), C2 (audit log before destructive admin actions: `admin_clear_all`, `reset_api_key`, `admin_agent_delete`), C3 (confirmed `platform_connectors` is global-public by design, added explicit scope comments, verified `platform_credentials` and `memory_configs` are correctly tenant-scoped), and C4 in part (32 -> 19 npm vulnerabilities via `npm audit fix`; remaining 9 high are in `undici` via `@vercel/node@^3` and require an approved major bump).

These policies codify the operating rules. Every engineer and agent working on UnClick follows them.

---

## 1. Secret management

- No hardcoded keys anywhere in the repo. Not in source, not in tests, not in fixtures, not in docs.
- Secrets live in environment variables only. Vercel environment vars for runtime, GitHub Actions secrets for CI, local `.env.local` files (gitignored) for development.
- User-provided credentials are stored in BackstagePass (`api/backstagepass.ts`). Storage format is AES-256-GCM at rest with PBKDF2 key derivation from the user's own api_key.
- `.gitignore` excludes `*.local`, `*.local.json`, `.vercel`, and standard credential file patterns. `.env*` files have never been committed and must never be committed.
- GitHub push protection with secret scanning must remain enabled on the repo. If it is ever disabled, the repo is frozen until it is re-enabled.
- Service-role Supabase keys must be used only from server-side code. The anon key is the only Supabase key that ever reaches the browser.

## 2. Two-layer gating

- Every admin-only action is refused at the server level AND hidden at the frontend level. Both layers are required, not either. See [ADR-0005](../adr/0005-two-layer-admin-gating.md).
- Server-side refusal uses the `ADMIN_EMAILS` env var checked in the tenant resolver.
- Frontend hiding uses `<RequireAdmin>` which removes the route from the sidebar and redirects on direct URL access.
- A PR that adds an admin surface without both layers is blocked at review.

## 3. Tenant isolation

- Every `service_role` query MUST have a manual `WHERE api_key_hash = <tenant_hash>` filter. Row Level Security policies are the second layer, not the first.
- `api_key_hash` is the canonical tenant identifier (SHA-256 of the user's API key). See [ADR-0004](../adr/0004-multi-tenant-via-api-key-hash.md).
- The client never supplies `api_key_hash`. Browser sessions re-derive it server-side from the Supabase JWT via `resolveSessionUser()`. Bearer requests derive it by hashing the inbound key via `resolveApiKeyHash()`.
- Every new table that holds user-scoped data gets RLS enabled in its creation migration. No exceptions. `service_role_all`, `block_anon_access`, and `block_authenticated_direct_access` are the default policy set.
- PR #129 enabled RLS on `memory_configs`. Phase 3 completes the remaining gaps: `memory_devices`, `build_tasks`, `build_workers`, `build_dispatch_events`, `memory_load_events`, `tenant_settings`, `conflict_detections`, `tool_detections`, and an RLS audit of `mc_agents`, `mc_crews`, `mc_crew_runs`.

## 4. Destructive operations

- Every destructive action writes to `mc_admin_audit` (or a product-specific audit table such as `backstagepass_audit`, `account_deletions_audit`) BEFORE the destructive operation executes.
- The audit write must succeed before the destructive write proceeds. If the audit insert fails, the destructive operation aborts. PR #129 established this pattern on `admin_clear_all`, `reset_api_key`, and `admin_agent_delete`.
- Audit rows include: `api_key_hash`, action name, timestamp, payload (tables affected, row counts, reason).
- Audit tables are append-only at the RLS layer. Only `service_role` can insert; no client path can update or delete rows.
- Phase 3 extends the pattern to `delete_fact`, `delete_session`, `delete_crew`, `update_business_context`, and `admin_update_fact`.

## 5. Input validation

- Every new API input must have a Zod schema at the handler boundary. No handler executes business logic on unvalidated input.
- Schemas live alongside the handler file and are exported for testability.
- Validation failure returns a structured 400 with a field-level error list. No generic "bad request" responses.
- Existing handlers in `api/memory-admin.ts` that use ad-hoc `if (!field)` checks are migrated to Zod schemas incrementally in Phase 4 (see target-state section 4).
- JSON parse operations (e.g. `JSON.parse(body.value)`) must be wrapped in try/catch. Never call `JSON.parse` on unvalidated input.

## 6. Rate limiting

- Every public endpoint must have rate limiting. No unlimited-access surface ships.
- Authenticated endpoints: per-tenant limits keyed on `api_key_hash`. Tier-based (free=60, pro=300, team=1000 req/min as the current baseline).
- Unauthenticated endpoints (`/api/arena`, `/api/mcp` discovery, `/api/report-bug`): per-IP limits with burst tolerance.
- The Hono rate limiter in `apps/api/src/middleware/rate-limit.ts` is the reference implementation. Phase 3 either ports it into a helper used by Vercel handlers or migrates the surface to Hono on Vercel (see target-state section 2.3).
- A rate-limit breach returns 429 with a `Retry-After` header. Breach events log to Signals for the tenant.

## 7. Pre-commit hooks

- Pre-commit hooks block `.env` files, `.env.*` files (except `.env.local.example`), and raw key strings matching known patterns: `sk-`, `eyJ`, `AKIA`, `xoxb-`, `ghp_`, `ghs_`, `ya29.`.
- Pre-commit hooks run on every commit locally. Repository-level GitHub push protection enforces the same rules server-side.
- Disabling hooks via `--no-verify` is not permitted. If a hook fires a false positive, fix the hook regex or explicitly allowlist the path in the hook config.
- Hook bypass attempts (`--no-verify`, `--no-gpg-sign`) in pushed commits are flagged in review.

## 8. PR review requirements

- PRs touching authentication, RLS, credential handling, or tenant-scoping logic require at minimum one human review pass. An `@claude`-authored PR does not satisfy this requirement; a human reviewer must sign off.
- Security-critical paths: `api/backstagepass.ts`, `api/memory-admin.ts` tenant resolvers (lines 205-391), `api/credentials.ts`, any `supabase/migrations/*` that adds or alters RLS, any change to `packages/mcp-server/src/memory/supabase.ts` tenancy wrapper, any change to `ADMIN_EMAILS` checks.
- TestPass compliance must pass on the PR check (`testpass-pr-check.yml`).
- `npm audit` results are reviewed on every PR; new High/Critical findings block merge.
- PR descriptions for security-critical changes reference the relevant ADR and threat-model scenarios affected.

## 9. Dependency management

- `npm audit` runs weekly (nightly pipeline, see target-state section 8.1). High/Critical findings are triaged within 72 hours.
- Triage outcomes: (a) apply `npm audit fix` and merge, (b) pin to a safe version with a rationale, (c) file a tracking issue if no fix exists and document the residual risk in `docs/security/current-posture.md`.
- Major-version dependency bumps require an approving review from Chris. Example: the `@vercel/node@^3` to `@vercel/node@^5` bump needed to close the remaining undici CVEs is queued and awaits approval.
- Transitive dependency risk is monitored via the lockfile. Lockfile diffs on PRs are reviewed as part of the security pass.
- Dependencies that carry High CVEs known at install time are not added. The exception is a written rationale in the PR description.

---

## Known baseline (PR #128 findings, as of 2026-04-24 commit `4f655f2`)

These are the critical findings from Phase 1 and the current status after PR #129. The pre-PR-#129 state is documented for continuity.

- **C1 (closed by PR #129)**: `memory_configs` and `memory_devices` have no RLS enabled. `memory_configs` holds AES-256-GCM encrypted Supabase service-role keys per user. Status: PR #129 enables RLS with `service_role`-only policy on `memory_configs` and adds the `mc_admin_audit` table. `memory_devices` RLS closure remains a Phase 3 item.
- **C2 (closed by PR #129)**: `admin_clear_all` nuked user memory with no audit log before the cascade. Status: PR #129 adds pre-op audit rows to `mc_admin_audit` for `admin_clear_all`, `reset_api_key`, and `admin_agent_delete`. Additional destructive actions (`delete_fact`, `delete_session`, `delete_crew`, `update_business_context`, `admin_update_fact`) remain Phase 3.
- **C3 (closed by PR #129)**: `admin_tools` read `platform_connectors` with no tenant filter. Status: PR #129 confirms `platform_connectors` is a global connector catalog with an explicit `anon_read_connectors` RLS policy allowing public read by design. Explicit comments added. Per-tenant scoping was already correct on `platform_credentials` and `memory_configs`.
- **C4 (partially closed by PR #129)**: 32 npm vulnerabilities, 18 High. Status: PR #129 ran `npm audit fix` (no `--force`), reducing to 19 vulnerabilities (9 High). The remaining 9 High are in `undici` pulled transitively via `@vercel/node@^3` and require a major bump to `@vercel/node@^5`, which is queued for a follow-up PR after Chris approves the `vercel.json` runtime migration.

Residual items to close in Phase 3 per `docs/security/current-posture.md` and `docs/security/threat-model.md`:

- Enable RLS on the remaining gap tables (`memory_devices`, `build_*`, `memory_load_events`, `tenant_settings`, `conflict_detections`, `tool_detections`).
- Remove `?api_key=...` query-string auth from `setup_status`, `conflict_check`, `health_summary`.
- Add security headers (CSP, X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy, Permissions-Policy).
- Land application-level rate limiting on the Vercel surface.
- Complete the `@vercel/node@^5` major bump to close the remaining 9 undici High CVEs.
- Promote `backstagepass_audit` and similar into a unified `audit_events` table with read-optimised views.

---

**End of policies.md.**

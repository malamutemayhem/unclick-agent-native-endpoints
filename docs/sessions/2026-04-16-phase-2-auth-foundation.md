# Phase 2 - Auth Foundation

**Date:** 2026-04-16
**Branch:** `claude/phase-2-auth-foundation` (cut off `claude/setup-malamute-mayhem-zkquO` @ `bac1848` after Phase 1 PR #14 merged)
**Preflight doc:** `docs/sessions/2026-04-15-phase-2-preflight.md`

## Scope shipped

All six Phase 2 deliverables from the preflight:

1. `/login` and `/signup` routes (magic link + Google + Microsoft)
2. `/auth/callback` route
3. `api_keys.user_id` FK migration + backfill
4. localStorage-to-auth claim flow (`ClaimKeyBanner`)
5. Session cookies + route protection (`RequireAuth`, gating `/memory/admin`)
6. `POST /api/auth/device-pair` stub - folded into `memory-admin.ts` as `auth_device_pair`

## Decisions (from preflight, not re-litigated)

- Magic link + Google + Microsoft only. No GitHub, no passwords anywhere.
- Default Supabase email template for this phase.
- Resend SMTP (Chris confirmed `RESEND_API_KEY` set in Vercel + Supabase).
- Supabase Auth provider toggles already flipped by Chris.

## Collision notes found during kickoff scan

### `api_keys` table has two column shapes in production

Phase 1 (`20260410100000_keychain_mvp.sql`) declares the new shape with `key_hash` / `user_id` / `tier` / `is_active`. The older shape with `email` / `api_key` (plaintext) / `status` is still queried by `src/components/ApiKeySignup.tsx` and `api/install-ticket.ts`. Production must carry both column sets for signup to work today. The Phase 2 migration and `claim_api_key` action both handle this drift:

- Migration: defensive `DO $$ ... $$` blocks that no-op if `email` / `status` columns aren't present. Backfill only runs when the old-shape columns exist.
- `claim_api_key`: tries a new-shape lookup first (`eq(key_hash, ...)`), falls back to old-shape (`eq(api_key, ...)`). Treats `42703` (undefined column) as "not found" rather than a hard failure, so it won't break on a fresh database.

### mcp.ts session-cookie branch

Added a parallel auth path in `api/mcp.ts` that:

1. Reads the Supabase session cookie from the request.
2. Calls `supabase.auth.getUser(token)` to verify.
3. Looks up an active api_keys row via the Phase 2 `user_id` FK.
4. Returns the same `ApiKeyContext` shape as the api_key path.

The api_key path is unchanged. Session-cookie auth explicitly does NOT populate `process.env.UNCLICK_API_KEY` (only the hash), which preserves the BYOD AES-256-GCM property: vault-bridge.ts short-circuits without the plaintext key, so a browser-session-authenticated caller cannot decrypt stored BYOD credentials.

### Vercel 12-function cap

Confirmed 12 `.ts` files under `api/` (11 top-level + `api/tools/demo.ts`). No new files added. All Phase 2 server endpoints fold into `memory-admin.ts` via distinct action names:

- `claim_api_key` - link anonymous api_keys row to auth.users row
- `auth_device_pair` - stub device pairing (upsert into `auth_devices`)
- `auth_device_list` - list paired devices for the session user
- `auth_device_revoke` - soft-delete a device pairing

Namespaced as `auth_device_*` to avoid colliding with the existing Phase 1 memory device actions (`device_check`, `list_devices`, `remove_device`) which operate on `memory_devices` (api_key_hash-keyed, tracks where memory lives). Distinct concepts, distinct tables, distinct handlers.

## Files changed

### New files

| File | Purpose |
|------|---------|
| `supabase/migrations/20260416000000_auth_foundation.sql` | FK + backfill + auth_devices table |
| `src/lib/auth.ts` | Magic link / OAuth helpers + `useSession` hook |
| `src/pages/Login.tsx` | `/login` route |
| `src/pages/Signup.tsx` | `/signup` route |
| `src/pages/AuthCallback.tsx` | `/auth/callback` route |
| `src/components/RequireAuth.tsx` | Client-side route guard |
| `src/components/ClaimKeyBanner.tsx` | localStorage-to-auth claim UI |

### Modified files

| File | Change |
|------|--------|
| `src/App.tsx` | Registered `/login`, `/signup`, `/auth/callback` routes. Wrapped `/memory/admin` in `<RequireAuth>`. |
| `src/pages/MemoryAdmin.tsx` | Mounted `<ClaimKeyBanner />` at top of main content. |
| `api/memory-admin.ts` | Added `resolveSessionUser` helper + 4 new actions (`claim_api_key`, `auth_device_pair`, `auth_device_list`, `auth_device_revoke`). |
| `api/mcp.ts` | Added `validateSessionCookie` + `extractSupabaseAccessToken` helpers. Session-cookie auth runs as a parallel path to api_key auth. |

### Pulled onto branch

| File | Purpose |
|------|---------|
| `docs/sessions/2026-04-15-phase-2-preflight.md` | Previous-session kickoff doc, pulled from `claude/unclick-admin-phase-2-AcJy3` |

## Verification

- `npm run build` passes clean (Vite build finishes in ~10s)
- `npm test` passes (1 test, example)
- `npm run lint` produces 394 pre-existing issues, zero of which are in Phase 2 files
- `tsc --noEmit -p tsconfig.app.json` produces only 2 pre-existing ArenaNav errors, zero in Phase 2 files

**Not verified in this session (belongs in a follow-up verification session):**

- Migration has not been applied against the live Supabase instance. Chris should run it in the SQL editor and confirm the `DO $$` blocks fire without error.
- End-to-end magic link has not been clicked. Needs a real session once Chris runs the migration.
- Google + Microsoft OAuth buttons have not been clicked through. The Supabase dashboard toggles were confirmed in the preflight doc but the round-trip hasn't been tested.
- `RequireAuth` gating on `/memory/admin` has not been tested with an unauthenticated session in the browser.
- `ClaimKeyBanner` has not been tested against a real `unclick_api_key` in localStorage.

## Follow-up / open loops

- Branded magic-link email template (preflight decision was default-template for this phase).
- Real device-pair protocol (current `auth_device_pair` is a stub: it just upserts a row. A nonce + client-confirmation flow is a later phase).
- `ApiKeySignup.tsx` still writes the old `email` / `api_key` / `status` column shape. Consolidating to the Phase 1 `key_hash` shape is a separate refactor.
- `vercel.json` could get a rewrite for `/api/auth/device-pair` -> `/api/memory-admin?action=auth_device_pair` if we want a prettier external URL. Not needed for the stub.

## BYOD encryption property - verification trace

Walked through every path that could decrypt BYOD creds:

1. `api/credentials.ts:138` - `deriveKey(apiKey, salt)` where `apiKey` is the Bearer header value. Never receives a session JWT: session-authenticated MCP requests don't forward their token here, and `/api/credentials` is only called by `vault-bridge.ts`.
2. `packages/mcp-server/src/vault-bridge.ts:105-128` - reads `process.env.UNCLICK_API_KEY` and short-circuits if unset. Phase 2 session-cookie branch in `api/mcp.ts` explicitly does NOT set `UNCLICK_API_KEY` (only the hash and user_id).
3. `api/memory-admin.ts` `config` action (line 528+) - `deriveKey(apiKey, salt)` where `apiKey` is from `bearerFrom(req)`. Same story: session JWTs are rejected upstream because `resolveSessionUser` is only called for `claim_api_key` / `auth_device_*`, and the `config` action still requires a plaintext api_key.
4. New `claim_api_key` action - accepts a plaintext api_key in the POST body from the browser (sourced from localStorage at the moment of claim). Hashes it for row lookup. Never derives a PBKDF2 key. Never stores the plaintext.

**Result:** logged-in users still cannot decrypt BYOD creds without holding the plaintext api_key. Staff with service role access can read `encrypted_data` and `salt` but cannot compute the PBKDF2 key without the plaintext. Property preserved.

# Phase 2 Preflight - Session Stopped Before Start

**Date:** 2026-04-15
**Branch:** `claude/unclick-admin-phase-2-AcJy3` (harness-pinned scratch branch)
**Status:** Stopped cleanly. No code touched, no branches cut, no PRs opened.
**Next session target branch:** `claude/phase-2-auth-foundation` (cut off `claude/setup-malamute-mayhem-zkquO` AFTER Phase 1 merges in)

## Why this session stopped

The Phase 2 prompt instructed me to verify PR #14 was merged before starting any code work. It is not.

| Field | Value |
|---|---|
| PR | malamutemayhem/unclick-agent-native-endpoints#14 |
| Title | Phase 1: Memory backend (managed cloud + caps + validation) |
| State | `open`, `draft: true`, `merged: false` |
| Mergeable state | `unstable` |
| Head | `claude/phase-1-memory-backend` @ `3accaf5` |
| Base | `claude/setup-malamute-mayhem-zkquO` @ `27b71d4` |
| Files changed | 7 (+1612 / -153) |

PR body says: "Code compiles cleanly but has not been verified against a live Supabase. Keeping this as a draft until verification runs in a follow-up session" and "Do not merge until verification passes."

## Collision risk if Phase 2 had started on unverified Phase 1

Phase 2's file surface overlaps Phase 1 in several places, so starting Phase 2 before Phase 1 is verified and merged would have produced rebase pain:

- `api/mcp.ts` - Phase 1 rewrote the api_key validation and per-request env injection. Phase 2 needs to add session-cookie handling that reads `user_id` alongside the existing api_key hash path.
- `api/memory-admin.ts` - Phase 1 folded `nightly_decay` in here to stay under the Vercel 12-function cap. Phase 2 was going to fold `/api/auth/device-pair` into this same handler for the same reason.
- `supabase/migrations/` - Phase 1 adds `20260415000000_memory_managed_cloud.sql`. Phase 2 needs a new migration for the `api_keys.user_id` FK, the `auth_devices` table, and the localStorage-to-auth backfill. Migration ordering matters and both branches would have been adding ordered files in the same directory.
- `packages/mcp-server/src/memory/supabase.ts` and `db.ts` - Phase 1 rewrote both as a per-tenant factory. Any Phase 2 tenancy change (attaching session `user_id` to the tenancy context) rebases into pain.

## Decisions recorded (Chris answered these before session close)

These are the four open questions I raised at the start of the session. Answers below. The next Phase 2 session should treat these as settled and not re-ask.

### 1. PR #14 handling

**Decision:** Option (a). Stop this session entirely. Chris will verify Phase 1 against live Supabase and merge PR #14 in separate sessions before resuming Phase 2.

**Rationale:** Analysis of collision risk (above) is right. Not eating merge pain on unverified code.

### 2. Branch name for Phase 2

**Decision:** `claude/phase-2-auth-foundation`. Override the harness-pinned `claude/unclick-admin-phase-2-AcJy3`. Explicit permission granted.

Cut it off `claude/setup-malamute-mayhem-zkquO` AFTER Phase 1 has been merged into that branch. Do NOT cut off `claude/phase-1-memory-backend` directly.

### 3. GitHub OAuth

**Decision:** Skip for this phase. Ship Phase 2 with Google and Microsoft OAuth only, plus magic link.

**Rationale:** GitHub OAuth needs a new OAuth app at github.com/settings/developers which Claude cannot create (requires human-authenticated session, client secret shown once). A 15-minute follow-up after Phase 2 lands is cleaner than blocking on it.

Phase 2 code should:
- Render ONLY two OAuth buttons on `/login` and `/signup`: Google and Microsoft
- Not leave a dead "GitHub" button or a commented-out placeholder
- Not reference a `GITHUB_OAUTH_CLIENT_ID` env var (don't prepare for it yet)

### 4. SMTP for magic link delivery

**Decision:** Resend.

**Rationale:** Cleanest DX, free for early volume, five-minute Supabase integration. Postmark / SendGrid are more enterprise-y but heavier lift.

**Chris's action before next session:** Sign up for Resend, verify sending domain for `unclick.world`, drop `RESEND_API_KEY` into Vercel env and into Supabase Auth > SMTP Settings.

### 5. Magic link email copy

**Decision:** Default Supabase template for this phase.

**Rationale:** Ship functional first. Custom UnClick-branded email is a 15-minute polish-pass task post-Phase-2. The magic link working matters more than it being on-brand at this stage.

### 6. Supabase Auth provider toggles

**Decision:** Chris handles the dashboard toggles himself, not via Management API. No `SUPABASE_ACCESS_TOKEN` handed to Claude.

**Chris's action before next session** (Supabase project `xmooqsylqlknuksiddca`):

- Auth > Providers > Email: enable, "Confirm email" on, "Secure email change" on
- Auth > Providers > Google: enable with existing Google client ID and secret
- Auth > Providers > Azure (Microsoft): enable with "Bailey" app client ID, secret, tenant
- Auth > URL Configuration > Site URL: `https://unclick.world`
- Auth > URL Configuration > Redirect allowlist:
  - `https://unclick.world/auth/callback`
  - `http://localhost:5173/auth/callback`
- Auth > SMTP Settings: paste Resend credentials once Resend is signed up

Chris will confirm all of these are done before pasting the Phase 2 prompt into the next session.

## Explicit plan

1. **Separate session(s):** Verify PR #14 against a live Supabase instance per the verification checklist in the PR body. Fix any issues surfaced by verification. Mark PR #14 ready for review, then merge into `claude/setup-malamute-mayhem-zkquO`.
2. **Chris prep work** (in parallel or before step 3):
   - Sign up for Resend, verify `unclick.world` sending domain, get `RESEND_API_KEY`
   - Toggle Supabase Auth providers and URL config per section 6 above
   - Drop `RESEND_API_KEY` into Vercel env
   - Drop Google and Microsoft OAuth credentials into Supabase Auth provider settings
3. **Fresh Phase 2 session:** New Claude Code session on a new branch. Fetch `claude/setup-malamute-mayhem-zkquO` (now containing Phase 1). Cut `claude/phase-2-auth-foundation`. Read this preflight doc FIRST to avoid re-litigating the six decisions above. Then read `docs/UNCLICK_ADMIN_BUILD_PLAN.md` (CODEBASE GROUND TRUTH + Phase 2 sections), `docs/sessions/2026-04-15-phase-1-memory-backend.md`, and project root `CLAUDE.md`. Then execute Phase 2.

## Phase 2 scope reminder (for the next session)

Not re-deciding, just caching the scope so the next session doesn't have to re-read the whole build plan before starting:

- Supabase Auth: magic link + Google + Microsoft OAuth (NO GitHub, NO passwords anywhere)
- `/login` and `/signup` routes in `src/pages/` or `src/app/auth/` - minimal UI, email input + two OAuth buttons, UnClick dark + amber `#E2B93B` palette
- Migration: `api_keys.user_id` FK to `auth.users.id`, plus backfill where `api_keys.email` matches a verified `auth.users.email`
- localStorage-to-auth claim flow: users with `unclick_api_key` in localStorage get prompted to claim, magic link to `api_keys.email`, on verify set `api_keys.user_id`
- Session cookies + route protection: all `/app/*` routes require an authenticated session, unauthenticated users get 302 to `/login`
- `POST /api/auth/device-pair` stub folded into an existing handler (Vercel 12-function cap still applies). Create `auth_devices` schema (`user_id`, `device_id`, `device_name`, `paired_at`, `last_seen_at`). Single-device UI, multi-device ready schema.

## Non-blocking out-of-session noise

- Glama email hit partway through this session: "The build for UnClick MCP Server has succeeded... to make these changes available to users, you must create a new release." Unrelated to Phase 2. Chris's call whether to cut a release now or wait until after Phase 2 merges. No code action required here.

## Where this doc lives

Committed and pushed to `claude/unclick-admin-phase-2-AcJy3` (the harness-pinned scratch branch). The next Phase 2 session will start on `claude/phase-2-auth-foundation` cut from `claude/setup-malamute-mayhem-zkquO`, which will NOT have this file on disk by default. Two options for the next session:

1. `git show origin/claude/unclick-admin-phase-2-AcJy3:docs/sessions/2026-04-15-phase-2-preflight.md` - read-only access from any branch
2. `git checkout origin/claude/unclick-admin-phase-2-AcJy3 -- docs/sessions/2026-04-15-phase-2-preflight.md` then commit onto the Phase 2 branch so it lives alongside the Phase 2 session summary

Option 2 is cleaner and Chris should include that as the first command in the next Phase 2 prompt.

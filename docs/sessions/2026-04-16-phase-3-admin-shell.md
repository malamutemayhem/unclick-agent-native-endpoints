# Phase 3: Five-Surface Admin Shell

**Date:** 2026-04-16
**Branch:** `claude/phase-3-admin-shell-sBAZm`
**PR target:** `claude/setup-malamute-mayhem-zkquO`
**Base:** Phase 2 auth foundation (PR #15) + CI cleanup (PR #16)

## What landed

### Shell layout (AdminShell.tsx)
- Persistent sidebar on desktop (md+) with five surface icons/labels
- Mobile/tablet top bar with hamburger nav
- Active surface highlighted in amber (#E2B93B)
- User email + logout button in sidebar footer
- Floating chat assistant placeholder (bottom-right bubble, "Coming soon" panel)
- Dark palette: background #0A0A0A, cards #111111, accent #E2B93B

### Five surfaces

1. **You** (`/admin/you`) - Identity surface
   - User email, auth provider, member-since date
   - Linked API key info (prefix, tier, status, usage count, last used)
   - ClaimKeyBanner for unclaimed localStorage keys
   - Paired devices list (from auth_devices) with revoke
   - Logout button

2. **Memory** (`/admin/memory`) - Memory facts surface
   - Storage usage bar (bytes used vs tier cap: 50MB free)
   - Fact count bar (vs tier cap: 5,000 free)
   - Search/filter facts with text query
   - Show archived toggle
   - Inline edit (textarea) and archive (soft delete) per fact
   - Decay tier badges (hot/warm/cold), category tags, timestamps

3. **Keychain** (`/admin/keychain`) - Credentials surface
   - AES-256-GCM encryption notice
   - Credentials grouped by connector category
   - Status indicators (active/expired)
   - Reconnect/remove buttons (placeholder, UI wired but no backend action yet)
   - Link to BackstagePass for adding new services

4. **Tools** (`/admin/tools`) - Tool catalog surface
   - Reads platform_connectors (public table, anon-readable)
   - Category grouping with counts
   - Search across name, category, description
   - Auth type badge per tool
   - External link to setup URL

5. **Activity** (`/admin/activity`) - Usage surface
   - Stats cards: today, this week, this month API calls, success rate
   - Metering events grouped by day with status icons
   - Recent conversation sessions with message counts
   - Two-column layout (events 3/5, sessions 2/5)

### API additions (api/memory-admin.ts)
No new Vercel functions created (0 new, still at 11). All folded into
existing memory-admin.ts via action routing:

- `resolveSessionTenant` helper - JWT -> user_id -> api_key_hash (handles both old/new api_keys shape)
- `admin_profile` - user info + linked api_key details
- `admin_facts` - mc_extracted_facts scoped to tenant, with search
- `admin_delete_fact` - archive a fact (session-authenticated)
- `admin_update_fact` - update fact text (session-authenticated)
- `admin_activity` - metering_events + mc_conversation_log summary
- `admin_credentials` - platform_credentials enriched with connector info
- `admin_storage` - mc_get_storage_bytes + mc_get_fact_count RPCs with tier caps

### Routing changes
- `/admin` redirects to `/admin/you`
- `/memory/admin` redirects to `/admin/memory` (preserves old bookmarks)
- All five `/admin/*` routes wrapped with RequireAuth
- Login/Signup/AuthCallback now redirect to `/admin` instead of `/memory/admin`
- Nested route layout via React Router Outlet

## What's stretch (not in this PR)

- BYOD config panel on Memory surface
- Tool enable/disable toggles on Tools surface
- Reconnect/remove credential actions on Keychain surface
- Chat assistant wiring (currently a stub)
- Mobile-first responsive refinements
- Marketplace tools section

## Decisions made

- **Admin is a shell, not a settings page.** Five loosely coupled surfaces, each extractable as a native app. No shared state between surfaces beyond the session.
- **No new Vercel functions.** All 7 new admin actions folded into memory-admin.ts (still at 11/12 cap).
- **Session JWT auth for all admin actions.** resolveSessionTenant bridges JWT -> api_key_hash using the Phase 2 claim flow.
- **Both api_keys shapes handled.** new-shape (key_hash) preferred, old-shape (api_key plaintext, compute hash) as fallback.
- **Tier caps hardcoded in API.** Free: 50MB/5K facts, Pro: 500MB/50K, Team: 2GB/200K. Will move to a config table later.

## Files changed

| File | Change |
|------|--------|
| `api/memory-admin.ts` | +resolveSessionTenant, +7 admin_* actions |
| `src/App.tsx` | +admin routes, /memory/admin redirect, admin imports |
| `src/pages/admin/AdminShell.tsx` | NEW - shell layout |
| `src/pages/admin/AdminYou.tsx` | NEW - identity surface |
| `src/pages/admin/AdminMemory.tsx` | NEW - memory facts surface |
| `src/pages/admin/AdminKeychain.tsx` | NEW - keychain surface |
| `src/pages/admin/AdminTools.tsx` | NEW - tools catalog surface |
| `src/pages/admin/AdminActivity.tsx` | NEW - activity surface |
| `src/pages/Login.tsx` | Redirect to /admin |
| `src/pages/Signup.tsx` | Redirect to /admin |
| `src/pages/AuthCallback.tsx` | Redirect to /admin |
| `docs/sessions/2026-04-16-phase-3-admin-shell.md` | NEW - this doc |

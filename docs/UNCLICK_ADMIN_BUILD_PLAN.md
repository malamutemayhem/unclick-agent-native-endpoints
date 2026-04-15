# UNCLICK ADMIN SHELL + HOSTED MEMORY BUILD PLAN

**For execution by Claude Code**
**Author: Chris Byrne (with Cowork strategy session, April 15, 2026)**
**Repo: malamutemayhem/unclick-agent-native-endpoints**
**Production branch: `claude/setup-malamute-mayhem-zkquO`**

---

## BEFORE YOU START

1. Call `get_startup_context` to load Chris's full operating context (Bailey charter, standing rules, infrastructure details, etc.).
2. Read `packages/memory-mcp/CLAUDE.md` for the session bridge protocol.
3. Work on the production branch `claude/setup-malamute-mayhem-zkquO`. Do not push to `main`; it is stale.
4. At the end of the session, call `write_session_summary` before leaving.

---

## WHY WE ARE BUILDING THIS

UnClick today is invisible plumbing. Agents call it, humans never see it. The next step is the visible shell: an admin dashboard that turns UnClick into a coherent product a normal human can install, understand, and manage. This shell is also the seed of what UnClick could eventually become as an operating system layer for agents. Every decision here needs to survive that far-vision future.

The build must honor Chris's standing rules:
- No em dashes anywhere in code, copy, or comments. Use regular dashes or restructure.
- Card-based UI (OS shell foundation). Not traditional pages.
- Memory is the #1 priority. It enables cross-session consistency across multiple Claude Code accounts.
- Default to action. Escalate to Chris only at genuine brick walls.
- Business-first priority. Speed over polish.
- Cloud-first architecture. Source of truth lives on GitHub + Supabase + Vercel env vars.
- Conversation-first, visual as companion.

---

## STRATEGIC DECISIONS ALREADY LOCKED IN (DO NOT RE-LITIGATE)

1. **Path B is the path.** UnClick is the identity, memory, credentials, and economy layer every harness needs. Not a harness itself, not a model, not a device OS today. Stripe for agents, not Windows for agents.

2. **The admin has 5 surfaces, not 9.** You, Memory, Keychain, Tools, Activity. Everything else is either a feature inside one of those five or not needed yet.

3. **The AI assistant is a floating element across every surface.** Not its own surface. Always visible, context-aware, can read and act on anything in the admin.

4. **Auth is magic link plus OAuth. No passwords, ever.** Supabase Auth handles both. Google, Microsoft, and GitHub as OAuth providers (Chris already has Google OAuth and Azure AD configured in env).

5. **Memory is hosted by default, with caps on free tier.** BYOD Supabase stays available as an escape hatch for power users and privacy-first customers. One-click onboarding beats five-step setup every time.

6. **Free tier caps (starting values, adjust with real data later):** 50 MB storage per user, 5,000 facts max, basic layers only, no nightly extraction. Pro tier at $29/mo removes all caps and enables nightly extraction plus decay.

7. **Third-party MCP tools are not fought.** They coexist. The agent resolves conflicts via user preference (stored in memory) first, then capability match, then default to UnClick Suite.

8. **Marketplace infrastructure is built but doors are closed.** Developer portal says "coming soon." Stripe Connect is wired. Revenue split is 80 to developer, 20 to UnClick. Launch is a switch-flip later.

9. **Every surface is loosely coupled.** Each one should be extractable as a standalone app later if UnClick ever ports to native desktop or phone. No shared state beyond identity.

10. **Data portability is a first-class feature.** Export everything as a button. "Bring your own database anytime." This is the trust anchor that makes hosted-by-default acceptable.

---

## KNOWN BLOCKERS CLAUDE CODE CANNOT SOLVE

Flag these to Chris when you hit them. Do not work around them silently.

1. **NPM publish token for @unclick/memory-mcp.** Two automation tokens exist but are masked. Chris needs to either generate a fresh one or set up a GitHub Actions workflow (.github/workflows/publish.yml) with NPM_TOKEN as a GitHub secret for permanent auto-publish. The workflow path is recommended for permanence.

2. **Vercel Hobby plan 12-function cap.** Current count is already at or near 12. New API endpoints cannot be added as separate files. Either consolidate existing endpoints into action-routed handlers (like `/api/memory-admin` already does with 12+ actions), or Chris upgrades to Vercel Pro. Recommend consolidation unless Chris says otherwise.

3. **GitHub push permissions.** Recent sessions have had intermittent 403s on push. If this recurs, stop and ask Chris rather than looping on retries.

---

## PHASE-BY-PHASE PLAN

Each phase has a goal, concrete work, acceptance criteria, and a verification step. Complete each phase in order. Do not start the next until the current one verifies.

---

### PHASE 1: Memory backend completion

**Goal:** Memory works end-to-end for every user out of the box, zero setup, persisting across sessions.

**Current state:**
- `packages/memory-mcp` is 100% publish-ready, 17 tools, local and Supabase backends.
- LocalBackend breaks in serverless (Vercel `/tmp` wipes between cold starts). This is the critical bug to fix.
- BYOD Supabase works but requires 5-step setup.
- The remote `/api/mcp?key=...` install path is what most users use and it has no working memory today.

**Work:**

1. **Add UnClick-hosted cloud mode as the new default.** The existing Supabase project (xmooqsylqlknuksiddca.supabase.co) gets a memory schema (see `packages/memory-mcp/schema.sql`). Every authenticated UnClick user gets a row-level-security-scoped slice of this shared Postgres. New users get this automatically. No Supabase account creation required.

2. **Modify `packages/memory-mcp/src/db.ts` backend factory** to add a third mode: "managed cloud" (connects to UnClick's central Supabase using the user's api_key as the auth context). Order of precedence becomes:
   - `SUPABASE_URL` env set -> direct Supabase (existing BYOD explicit mode)
   - `UNCLICK_API_KEY` set AND no BYOD override -> managed cloud via `/api/memory-admin`
   - `UNCLICK_API_KEY` set AND BYOD configured via `/api/memory-admin?action=config` -> user's own Supabase
   - Nothing set -> local JSON files

3. **Add free-tier cap enforcement** in the server layer. When a user hits 50 MB or 5,000 facts, new writes return a "limit reached, upgrade or prune" response. Caps are configurable per user (paid tiers lift them).

4. **Add nightly extraction + decay job** (Pro tier). Scheduled Vercel cron that runs once per 24h, processes new conversation log entries into extracted facts, runs the hot/warm/cold decay on existing facts. Gate by tier.

5. **Publish `@unclick/memory-mcp` to npm.** Blocked on token; see "Known Blockers." Recommend setting up the GitHub Actions workflow as the permanent fix.

**Acceptance criteria:**
- A fresh install of UnClick via `/api/mcp?key=NEWUSER_KEY` writes a fact, reads it back in a second request, and the fact persists. No Supabase setup from the user.
- Existing BYOD users are unaffected. Their service_role key continues to route their memory to their own Supabase.
- Free tier cap enforcement returns a clear, actionable error message when hit.
- Memory-mcp is live on npm at `@unclick/memory-mcp` and installable via `npx`.

**Verification:**
- Write a test agent that calls `add_fact`, `search_memory`, `get_startup_context` on a fresh api_key. Verify all three work.
- Force 5,001 fact writes on a free-tier test user. Verify the 5,001st returns a cap error.
- Confirm npm install succeeds: `npx @unclick/memory-mcp@latest` runs and prints help.

---

### PHASE 2: Authentication foundation

**Goal:** Users have real accounts tied to an email they own. localStorage is no longer the only identity.

**Work:**

1. **Enable Supabase Auth** on the existing Supabase project. Turn on magic link. Configure OAuth providers using existing credentials:
   - Google OAuth (client ID `480838614384-k6ghbumplurq70uh41vcnp67i78rbvtd.apps.googleusercontent.com`, secret in env)
   - Microsoft (Azure AD app "Bailey," tenant `21aa822d-4ed2-4892-b79c-c6d927294917`)
   - GitHub (use an existing or new OAuth App tied to malamutemayhem)

2. **Build `/login` and `/signup` routes.** Minimal UI. Email field, three OAuth buttons. That is it. No password field anywhere.

3. **Tie `api_keys.email` to `auth.users.id`.** Schema migration: add `api_keys.user_id UUID REFERENCES auth.users(id)`. Backfill where possible (where email matches an existing auth user).

4. **Build the localStorage-to-auth migration path.** An existing user with `unclick_api_key` in localStorage visits the dashboard, is prompted "Claim this account by verifying your email." Magic link sent to the email on record. On verify, `api_keys.user_id` is set, and the api_key becomes a child of the user account.

5. **Add session cookies and route protection.** All admin routes require an authenticated session. Unauthenticated users are redirected to `/login`.

6. **Add `POST /api/auth/device-pair` stub endpoint** (no UI yet). Schema: `auth_devices` table with `user_id`, `device_id`, `device_name`, `paired_at`, `last_seen_at`. Even though the UI is single-device for now, the schema being in place means adding phone or desktop later is additive, not a migration.

**Acceptance criteria:**
- New user can sign up via magic link or OAuth and land on an authenticated dashboard.
- Existing user with a localStorage api_key can claim their account via email verification.
- All `/app/*` routes return 302 to `/login` if no session.
- No password field exists anywhere in the codebase.

**Verification:**
- End-to-end test: sign up with a new email, receive magic link, click, land on `/app/you`. Passes.
- Manually inspect: grep the codebase for "password" and confirm zero user-facing password fields.

---

### PHASE 3: The 5-surface admin shell

**Goal:** The skeleton of the dashboard is live. Users can navigate between the five surfaces. Each surface is a placeholder at this stage (filled in by later phases).

**Work:**

1. **Create the shell layout at `src/app/`.** Separate from the marketing site (`src/pages/`). Shared header with UnClick branding (dark plus amber #E2B93B accent). Left sidebar with five surfaces. Global search bar top-center. Floating AI assistant docked bottom-right.

2. **Routes:**
   - `/app/you`
   - `/app/memory`
   - `/app/keychain`
   - `/app/tools`
   - `/app/activity`

3. **Build the `<AssistantChat>` component.** Floating, dockable, collapsible. Visible on every `/app/*` route. Placeholder chat UI; the actual agent wiring is Phase 9.

4. **Build the `<GlobalSearch>` component.** Keyboard shortcut Ctrl+K. Returns results across all five surfaces (memory facts, connected services, tool names, activity events, account settings). Start with a simple text match; can be upgraded to semantic search later.

5. **Each surface is a separate React module under `src/app/surfaces/*`.** No shared state beyond the auth context. This is the extractability principle: each surface should be packageable as its own bundle later.

6. **Mobile responsive from day one.** The surfaces should work on a phone (even though no phone OS exists yet), because this is the visual DNA of the future UnClick Phone.

**Acceptance criteria:**
- Authenticated user lands at `/app/you` by default.
- Sidebar navigation between all five surfaces works.
- Floating assistant is visible and expandable.
- Global search bar opens via Ctrl+K and has search-result UI.
- Layout is usable on a 375px-wide viewport (iPhone SE).

**Verification:**
- Playwright or manual: navigate all 5 surfaces, open assistant, open global search, resize to 375px. All passes.

---

### PHASE 4: Surface - You

**Goal:** Identity, account, and subscription management. Apple ID equivalent.

**Work:**

1. **Profile card:** display name, email, profile picture (optional, default monogram).
2. **Subscription card:** current tier (Free / Pro / Team), next billing date, manage billing link (Stripe customer portal). Stripe is already scaffolded for developer payouts; extend for subscription billing.
3. **Paired devices card:** list of devices paired to this account. UI is minimal for now (just "This device" shown). Schema is ready for multi-device later.
4. **Security card:** active sessions, "sign out of all devices" button.
5. **Danger zone card:** "Export everything" (downloads a zip of memory, credentials metadata, and account data as JSON) and "Delete my account" (hard delete after confirmation).

**Acceptance criteria:**
- User can view and update their display name.
- User can initiate an export and receive a downloadable archive.
- User can sign out of all devices.
- Account deletion works and cascades correctly (memory wiped, api_keys revoked, credentials purged).

---

### PHASE 5: Surface - Memory (THE MARQUEE FEATURE)

**Goal:** The memory UI no competitor has. Chris is visual. This is where UnClick becomes the leader.

**Work:**

1. **Header pulse indicator.** Small live dot that pulses whenever memory is being written. Subscribe via a Supabase realtime channel on the memory tables.

2. **Six layer shelves.** Each layer (Business Context, Knowledge Library, Session Summaries, Extracted Facts, Conversation Log, Code Dumps) rendered as a horizontal strip. Each strip shows: layer name, fill percentage, last-touched timestamp, count of items. Click to expand.

3. **Fact cards.** Inside each layer, items are cards, not rows. Each card shows:
   - The fact or summary text in plain language
   - Confidence as a visual cue (full saturation for high, faded for low)
   - Last-used stamp
   - Heat indicator (hot / warm / cold, three color states from amber to gray)
   - Three actions: pin (prevents decay), edit, forget

4. **Timeline view toggle.** Memories grouped by day. "On April 10, your agent learned these twelve things." Scroll horizontally by week.

5. **Relationship graph view toggle.** Click a fact, see visually what other facts it is related to (shared session, shared entity reference, semantic similarity). Use a lightweight force-directed graph library (d3-force or react-force-graph).

6. **"What does my agent see" preview.** An input box where the user types a hypothetical prompt. Below it, UnClick shows exactly which memories the agent would pull for that prompt, ranked. This is the transparency feature.

7. **Usage heatmap.** GitHub-style calendar grid showing memory read/write activity over the last 90 days.

8. **Global search with autocomplete,** scoped to memory, integrated with the shell's Ctrl+K search.

9. **BYOD migration button** in a corner card: "Bring your own database." Opens the existing `/memory/setup` wizard.

**Acceptance criteria:**
- All six layers render with real data from the user's memory.
- Pin, edit, forget actions work and persist.
- Timeline view correctly groups memories by day.
- Relationship graph shows at least direct relationships (same session).
- "What does my agent see" preview returns the same facts the MCP `search_memory` tool would return for the same query.

**Verification:**
- End-to-end: as a test user, seed 50 facts across 3 sessions with varying confidence. Verify all views render, actions work, preview is consistent with MCP responses.

---

### PHASE 6: Surface - Keychain

**Goal:** Visual wrapper around BackstagePass. User sees every third-party service UnClick can act on, and can manage each.

**Work:**

1. **Service cards.** One card per connected platform (Google, Xero, Slack, etc.). Each shows: service logo, connection status (healthy / expiring / broken), last used, "reconnect" and "remove" actions.

2. **"Add a connection" card** lists all 40+ BackstagePass-supported platforms with "Connect" buttons. Each launches the platform's OAuth flow.

3. **Credential health monitor.** Background job (weekly) that pings each stored credential. Expired or revoked ones surface as "needs reconnection" with a yellow dot.

4. **Never show the actual secret.** Only redacted metadata (platform, last used, scopes granted, expiry date if known).

**Acceptance criteria:**
- User can add a Google connection via OAuth and see it appear as a card.
- User can disconnect and the credential is purged.
- Broken credentials surface with a clear "reconnect" path.

---

### PHASE 7: Surface - Tools

**Goal:** The user sees every capability their agent has, grouped sensibly, with per-tool toggles and preference controls.

**Work:**

1. **Category browser.** Use the existing 20 categories from `tool-wiring.ts`. Each category is a collapsible section.

2. **Tool cards.** For each of the 172+ tools: name, one-line description, "enabled for my agent" toggle (default on), "prefer this for category X" button.

3. **Preference storage.** When the user sets a preference, store in the memory business_context layer under `tool_preference` category. The agent's tool resolution order picks these up automatically (preference wins over defaults).

4. **"Third-party tools you have connected" card** (optional for now, ship stub). Detects other MCP servers the agent has access to by observing tool call patterns. Surfaces with a gentle "UnClick can handle this too, want to consolidate?" suggestion.

5. **Reserved card: "Marketplace apps" with "coming soon" badge.** Placeholder for the future marketplace.

**Acceptance criteria:**
- User can toggle any tool off and the agent stops calling it.
- User can set a preference ("prefer UnClick Calendar over the direct Google Calendar MCP") and it sticks.

---

### PHASE 8: Surface - Activity

**Goal:** Observability. What has UnClick been doing.

**Work:**

1. **Today card.** Summary of the last 24h: tool calls, facts written, credentials used. Quick at-a-glance.

2. **Usage heatmap.** 90-day calendar grid (similar to Memory's heatmap but for tool usage, not just memory).

3. **Activity timeline.** Reverse-chronological list of recent events (tool calls with timestamp, input summary, outcome). Filter by category or tool.

4. **System status card.** UnClick service health (API status, memory backend status, credential service status). Uses existing or adds basic health endpoints.

5. **Data source:** existing `tool_usage_events` Supabase table.

**Acceptance criteria:**
- User sees a live feed of their agent's actions.
- Heatmap reflects real usage.
- System status shows "all systems operational" when healthy.

---

### PHASE 9: AI Settings Assistant (the floating chat)

**Goal:** The assistant that lives in the corner becomes functional. User can ask it to do anything the admin can do.

**Work:**

1. **Create a scoped MCP context** for the assistant. It has access to:
   - Read/write the current user's memory (all layers)
   - Read/write the current user's credentials (metadata only, never secrets)
   - Read/modify the current user's account (email, subscription, tool preferences)
   - Read the current user's activity
   - NOT access any other user's data (enforced by Row Level Security plus assistant scope)

2. **Wire the assistant to Claude** (or whatever LLM is configured) using the existing UnClick MCP infrastructure. The assistant itself is just another agent that happens to be scoped to the admin.

3. **Example flows to support from day one:**
   - "Remove my credit card" -> opens Stripe billing portal
   - "What does my agent know about Rinnai?" -> queries memory, returns list
   - "Forget everything about my calendar preferences" -> deletes matching facts with confirmation
   - "Change my email to new@example.com" -> sends verification email, on confirm updates
   - "Show me my Slack connection" -> navigates to `/app/keychain` and highlights Slack card
   - "Unsubscribe me" -> cancels subscription via Stripe customer portal

4. **Every action the assistant takes gets a confirmation step** for destructive operations. For read-only queries, no confirmation needed.

**Acceptance criteria:**
- User can complete at least five end-to-end admin actions by typing into the assistant instead of clicking.
- Destructive actions always confirm before executing.
- Assistant cannot access another user's data (test with two accounts).

---

### PHASE 10: Marketplace infrastructure (doors closed)

**Goal:** The plumbing is in place. Launch is a config flip.

**Work:**

Most of this already exists. Verify and fill gaps:

1. **Developer portal** at `/developers` already exists. Add a "Marketplace coming soon, sign up for early access" banner. Capture emails in a waitlist table.

2. **Tool submission flow** already exists in `api/developer-submit-tool.ts`. Verify it stores submissions with status = "pending."

3. **Stripe Connect wiring** already exists via `api/developer-stripe-onboard.ts`. Verify the 80/20 revenue split logic is coded but gated behind a feature flag.

4. **Marketplace tools in the Tools surface** have a "coming soon" state. Reserve the UI slot.

5. **Do not open the doors.** Chris decides when marketplace launches. Not now.

**Acceptance criteria:**
- A developer can register, submit a tool, and see "pending review" status.
- Revenue split is configured but no payouts fire (feature flag off).
- Marketplace card in user Tools surface shows "coming soon."

---

## WHAT NOT TO DO

- Do not build RBAC, team seats, SSO, or SAML. Single-user for now. Team tier is Phase 11+.
- Do not add billing inside the admin's core UI until Phase 4's subscription card. Marketing-site pricing is fine.
- Do not build an appearance or theming system. Dark + amber, ship it.
- Do not build a separate mobile app. The responsive web shell is the mobile experience for now.
- Do not try to own the harness layer. UnClick is not a Claude Code competitor.
- Do not allow anything to happen in the admin that cannot also happen via the AI assistant. Every visual action has a conversational equivalent. Test this discipline.
- Do not use em dashes. Anywhere.

---

## QUESTIONS TO ASK CHRIS IF UNCERTAIN

1. Free tier caps (50 MB storage, 5k facts): comfortable starting values, or different numbers?
2. OAuth providers: all three (Google, Microsoft, GitHub), or just Google and Microsoft?
3. Export format: JSON-only, or also CSV/Markdown for human-readable memory export?
4. Assistant model: same Claude that powers the agent, or a dedicated smaller model for cost?
5. Domain: admin lives at `unclick.world/app` or its own subdomain like `app.unclick.world`?

---

## PHASE ORDERING PRINCIPLE

Each phase reduces resistance for the next. Memory first (Chris's priority and the foundation for the assistant). Auth second (every surface needs identity). Shell third (the skeleton). Then fill surfaces in order of how foundational they are: You, Memory, Keychain, Tools, Activity. Assistant last because it depends on all surfaces existing. Marketplace in parallel, low priority, doors closed.

Do not parallelize. Solo operator resource budget is not built for parallel tracks.

---

## FINAL NOTE

The admin shell being built here is the public face of UnClick for the next two years. Every user, investor, and developer will form their first opinion from it. Build it like it is the future, because it is. Polish over speed within each phase. Speed over polish across phases (ship one surface well, move on, do not perfect everything at once).

When in doubt, ask: does this work as part of an OS shell in 3 years? If the answer is clearly no, do not build it.

End of plan.

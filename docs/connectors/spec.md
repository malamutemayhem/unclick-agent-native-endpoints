# Connectors — Phase 0 Specification

**Status:** Locked 2026-04-27
**Owner:** Chris Byrne / Malamute Mayhem
**Replaces:** BackstagePass-as-vault (paused, infrastructure preserved, not deleted)
**Related ADRs:** ADR-0009 (Build Desk), ADR-0006 (subscription-only billing), ADR-0010 (bolt-on Signals)
**Related memory:** `agent/memory/project-plugboard.md`, `agent/memory/feedback-platform-philosophy.md`, `agent/memory/project-unclick-orchestrator-wizard.md`

---

## 1. Intent

**Connectors is the rail that lets a user connect a service once and have every current and future AI agent inherit access automatically.** It replaces the BackstagePass-as-vault model with an OAuth-first, pass-through-second, browser-mediated-third architecture. UnClick never holds raw credentials for the high-value cases.

The customer-facing promise is one line: **"Connect once, every agent inherits."** A user authorizes Gmail through Connectors, and from that moment Claude Desktop, ChatGPT, Cursor, Codex, and any future MCP-aware client immediately see Gmail tools when calling UnClick with the user's API key. Disconnect once, gone everywhere.

Connectors is a **rail**, not a Pass family product. It does not get a colorful internal codename. The user-facing label and the internal name are both "Connectors" (interchangeable with "Connections" on UI surfaces).

## 2. Why this exists

The BackstagePass-as-vault model was structurally unsound for a sole-trader operator without a corporate shield:

- Holding raw credentials (especially LLM API keys) creates Privacy Act 1988 + Notifiable Data Breach exposure that disclaimers can never fully eliminate.
- Cloud-side credential brokering became legally radioactive after Amazon v. Perplexity (March 2026) — Judge Chesney's preliminary injunction held that user permission alone does not equal platform authorization under CFAA.
- Chrome 146 Device Bound Session Credentials and JA4 fingerprinting killed the stealth-headless-Chrome economic model that competitors like Anon and Browserbase rely on.
- Standards have moved decisively to user-issued, cryptographically signed agent mandates (Cloudflare Web Bot Auth, Visa Trusted Agent Protocol, Mastercard Agent Pay, Google AP2). Holding credentials is the wrong shape; issuing mandates is the right shape.

Connectors is the user-side identity broker for the agentic web. UnClick's customer is the user. That position is structurally unavailable to the agent labs (Anthropic, OpenAI, Google), the platform-side security vendors (Cloudflare, Akamai), the developer-side auth companies (Stytch, Auth0, WorkOS), the vertical-specific aggregators (Plaid for banking), or the cloud credential brokers (Anon, Browserbase). Each of those serves a different primary customer.

## 3. The three credential paths

Connectors handles credentials through three lanes, ranked by liability:

### 3.1 OAuth (lowest liability)

For services that support OAuth — GitHub, Slack, Google (Gmail, Calendar, Drive), Notion, Linear, Stripe, Microsoft, Asana, Figma, Discord, Spotify, and most modern SaaS — UnClick stores a scoped, revocable token. The token is encrypted at rest using AES-256-GCM with a per-row salt and authenticated tag. The encryption key is derived from data only the user controls.

OAuth tokens are a fundamentally lower-liability primitive than raw API keys: they are scoped (only the permissions the user approved), revocable (the user can kill them anytime from the upstream provider), refreshable (short-lived access tokens with longer-lived refresh tokens), and recoverable in the case of a leak (the upstream service can rotate or invalidate without UnClick being involved).

This is what every modern SaaS does. It is not novel. It is correct.

### 3.2 Pass-through (zero storage)

For services that issue raw API keys without OAuth — primarily LLM providers like Anthropic and OpenAI — UnClick never sees the key. The user's MCP client (Claude Desktop, Cursor, Codex, ChatGPT) holds the key in its own configuration and passes it through with each LLM call. UnClick acts as a relay; the key transits memory only for the duration of a single request.

This sidesteps the entire LLM-key liability surface. A breach of UnClick's database yields no LLM keys because they are never stored.

The companion architecture for autonomous LLM workflows (background tasks where the user is not actively connected) is Subscription LLM Billing per `feedback-platform-philosophy.md` — UnClick pays Anthropic/OpenAI directly under its own account, charges users on subscription, and dispatches LLM calls without needing the user's personal key.

### 3.3 Browser-mediated (for consumer services without OAuth)

For consumer websites that have no public API — Amazon, Netflix, Uber, banking, utilities, the long tail — UnClick exposes per-site capabilities through an optional browser extension and local helper. The user's browser session, cookies, passkeys, and fingerprint never leave the user's device. UnClick orchestrates intent; the user's browser executes the action.

Three execution modes within this lane (detailed in Phase 7+):

- **Loaner Sessions** (default) — agent issues commands, browser silently executes through user's actual logged-in session.
- **Co-Pilot Bridge** (for hostile platforms with strong agent detection) — agent stages the action, user clicks confirm in their actual browser.
- **Bonded Cloud Sessions** (opt-in only) — scoped, time-boxed, mandate-signed session bundle exported to a sandboxed cloud browser for single-purpose background execution.

## 4. Phasing

Connectors ships in twelve phases. Phases 0-6 constitute Connectors V1 (the OAuth + pass-through layer). Phases 7-12 constitute UnClick Local (the browser extension and mandate layer that turn Connectors into the user-side identity broker for the entire agentic web).

### Phase 0 — Spec (this document)

Lock the architecture, the naming, the OAuth platform list, and the three-lane credential model. Output: this spec, committed to docs/connectors/spec.md.

### Phase 1 — Plumbing

New `plugboard_connections` table alongside the existing user_credentials infrastructure (which stays parked). OAuth flow scaffolding: state token, redirect handler, callback handler, token-refresh worker. New `/admin/connections` page placeholder. Hide BackstagePass admin link from main navigation. Keep the existing routes alive for rollback.

### Phase 2 — First OAuth integration (GitHub)

End-to-end GitHub OAuth: connect, list connections, test connection, disconnect. Proves the entire connection flow shape that Phases 3 and onward will follow.

Passport Git durable connection model: see `docs/connectors/passport-git-durable-connection-model.md` for the cross-device GitHub connection boundary, reconnect path, revoke path, agent usage path, and manual token fallback rules.

### Phase 3 — Bulk OAuth integrations

Slack, Google (Gmail + Calendar + Drive), Notion, Linear, Stripe. Each follows the GitHub pattern. Six platforms total at the end of Phase 3.

### Phase 4 — MCP tools

Expose Connector capabilities to agents through MCP tools: `list_connections`, `connect_platform`, `disconnect_platform`, `test_connection`. Lights up Claude Desktop, Cursor, Codex, ChatGPT usage.

### Phase 5 — Subscription LLM bridge

Route LLM calls for cron jobs and autonomous workflows through UnClick's subscription billing instead of holding user LLM keys. Pass-through stays for live MCP-client use. Closes the gap between "user offline" and "scheduled task needs an LLM."

### Phase 6 — Legal + launch

Privacy Policy + Terms of Service drafts (AI-multi-hat reviewed, AU + global hybrid coverage). Online lawyer review at $300-500 AUD. SECURITY.md publication. Marketing copy update from "vault" framing to "Connections" framing.

**End of Connectors V1.** Phases 0-6 ship the OAuth + pass-through + subscription LLM rails. ~5-6 chip weeks senior eng + 1 chip week marketing/legal.

### Phase 7 — Browser extension MVP

Fork `hangwin/mcp-chrome` (MIT, working reference impl) for the Chrome extension + Native Messaging transport. Ship a small signed Rust binary that runs a local MCP server on a stable loopback port. Cloudflare Tunnel with bearer-token auth for per-user subdomains (e.g. `u-bailey.unclick.dev`). Initial site coverage: Amazon read-only, Netflix queue, Uber ride request, Gmail summarise, Notion edit. WebAuthn step-up gate for high-stakes tools.

### Phase 8 — Co-Pilot Bridge

For Amazon, eBay, banking, and any platform with strong agent-detection: agent stages the action (find product, fill cart, pick address), user clicks the confirm button in their actual browser. The user is the legal actor; the agent is demoted to advisor. Default mode for any platform flagged in the agent-policy registry.

### Phase 9 — Alias email + TOTP relay

Each user gets `@unclick.email` aliases. Magic-link parser exposed as MCP tools with 90-second expiry windows. Per-account TOTP seed storage with Twilio SMS relay (paid tier). Owns the password-reset path for ~80% of consumer accounts.

### Phase 10 — User-signed mandate layer (Web Bot Auth)

Per-user keypair generated on first install, registered to email-bound DID or `<handle>.unclick.dev`. Every outbound action carries a Web Bot Auth signed header attesting user ID + agent ID + mandate hash + UnClick countersignature. User-controlled `agents.txt` at `<handle>.unclick.dev/.well-known/agents.txt` declaring authorized agents and outstanding mandates.

### Phase 11 — Self-healing skill marketplace

Explore-replay-self-heal pattern (Skyvern / Browser Use / Stagehand convergence). Each completed flow on a long-tail site becomes a captured skill: deterministic Playwright script + LLM-readable intent. PII-stripped sharing across users. Section 230-style platform posture.

### Phase 12 — Bonded Cloud Sessions

For tasks the user wants run while their machine is offline. Scoped, time-boxed, single-purpose session bundles encrypted with a key split between UnClick HSM and user's device passkey. Decryption only inside an enclave (Browserbase or Anon-style sandbox), bound to a passkey-signed mandate. Single-purpose, evicts after task complete. Strict opt-in only.

**End of UnClick Local.** Phases 7-12 ship the browser extension, alias email, mandate layer, skill marketplace, and Bonded Cloud. ~13 chip weeks senior eng.

**Combined V1 + UnClick Local total:** ~18-20 chip weeks senior eng = ~12-16 calendar weeks with parallel chips.

## 5. Locked decisions

| Decision | Value | Rationale |
|---|---|---|
| Public + internal name | Connectors | Rails do not get codenames; the user-facing label and team label are the same |
| Replaces BackstagePass-as-vault | Yes (paused, infrastructure preserved) | Sole-trader liability profile + post-Amazon-v-Perplexity legal landscape make vault model untenable |
| Phase 1 first OAuth | GitHub | Universal among the dev cohort, well-documented OAuth, low-risk for the proof-of-pattern |
| Phase 3 OAuth platforms | Slack, Google (Gmail+Calendar+Drive), Notion, Linear, Stripe | Highest-leverage starter list for the 25-44 AI professional audience |
| Crypto recipe | AES-256-GCM with Argon2id KDF (PBKDF2 → Argon2id migration in flight) | OWASP 2023 alignment; vetted primitives only |
| Tenant isolation | Postgres RLS on every multi-tenant table + manual filter in service-role queries | Two-layer gating per `feedback-admin-gating-pattern.md` |
| Browser extension fork base | hangwin/mcp-chrome (MIT) | Working reference implementation; saves weeks of transport plumbing |
| Mandate layer protocol | Web Bot Auth (RFC 9421 HTTP Message Signatures, Ed25519) + AP2-style mandates | Industry-standard substrate that platforms have already begun honoring |
| Bonded Cloud opt-in only | Yes | Loaner default, Co-Pilot for hostile sites, Bonded Cloud only when user actively wants offline tasks |

## 6. What stays parked

The existing BackstagePass infrastructure stays in the repo and the database. It is not deleted. Specifically preserved:

- All existing tables: `user_credentials`, `credentials`, `platform_credentials`, `backstagepass_audit`
- All existing endpoints: `api/backstagepass.ts`, `api/credentials.ts`
- The encryption code (already zero-knowledge by design, already correct in shape)

This is intentional. If Path C (wrap an audited vault like Bitwarden) ever becomes attractive — for example if a paying enterprise customer demands an SOC 2 audited credentials vault — the path back is short. The infrastructure is parked, not destroyed.

## 7. Open decisions still requiring Chris's call

- **Lawyer for the Phase 6 ToS review.** Lawpath, LegalVision, or a personal contact. Targeted at $300-500 AUD for the online review tier.
- **Trademark clearance budget.** $300-1500 USD for a paid USPTO/EU/AU TM clearance opinion before any major paid marketing spend on the Connectors name. Defer until launch week is acceptable.
- **Priority slot for Phase 7 dispatch.** Top-3 priority (parallel-track with V1, ship the browser extension in the 9-month window) was provisionally greenlit. Lock when V1 Phase 6 lands.

## 8. Trigger conditions to dispatch each phase

Phases gate on the prior phase shipping plus any external prerequisites listed below.

- **Phase 0:** none. Ships with this PR.
- **Phase 1:** Phase 0 merged.
- **Phase 2:** Phase 1 deployed; GitHub OAuth app registered under the malamutemayhem account.
- **Phase 3:** Phase 2 in production for at least 72 hours with one paying user actively using it (or Chris using it himself, equivalent).
- **Phase 4:** Phase 3 with at least three platforms live.
- **Phase 5:** Phase 4 deployed; Stripe subscription billing infrastructure ready for LLM cost pass-through (existing).
- **Phase 6:** Privacy Policy + ToS drafted (already complete as of 2026-04-27); lawyer review commissioned.
- **Phase 7:** Connectors V1 in production; first publicly-shareable customer screenshot. Browser extension build can also pre-empt this if Chris greenlights parallel track.
- **Phase 8-12:** sequential after Phase 7, scope per the phase descriptions above.

## 9. Cross-references

- `agent/memory/project-plugboard.md` — full memory file, source of truth
- `agent/memory/feedback-platform-philosophy.md` — subscription-not-credits rule
- `agent/memory/project-unclick-orchestrator-wizard.md` — load-bearing for Phase 5 LLM bridge
- `agent/memory/business-malamute-mayhem.md` — sole trader status drove the connector pattern over the vault pattern
- `uploads/019dcea7-Browser.txt` Concepts 1 + 2 — the deep research synthesis for Phases 7-12
- ADR-0009 — Build Desk (separate product, parked, distinct from Connectors)

## 10. Acceptance for Phase 0

Phase 0 is complete when this document is merged to `main`. There is no other deliverable for Phase 0. Phase 1 dispatch can begin once this is merged.

# UnClick Deep Context

This note is for workers who need the older UnClick story, not just the current GitHub queue.

For current product taxonomy, read `docs/unclick-context-boot-packet.md` first. If this older context says "Pass products" or lists Pass-era names beside Autopilot, treat that as historical wording. Current wording is XPass products, and UnClick Autopilot sits higher as the development assembly line.

Recent Fishbowl and PR state explains what is moving now. This file explains why the work is shaped this way.

This is not a roadmap promise. Some items are locked decisions, some are shipped foundations, and some are parked strategic options.

## One Sentence

UnClick began as an agent-native MCP marketplace and grew into a platform where memory, identity, credentials, Pass products, Fishbowl coordination, WakePass reliability, and proof reports help AI agents act safely for users.

## Current Active Lanes

These are moving now or recently active:

- Fishbowl - worker room, todos, ideas, status, handoffs, and board hygiene.
- PinballWake and WakePass - action-needed wake routing, ACK leases, missed-ACK visibility, and reclaim.
- TestPass - proof gate for PR checks, scheduled smoke, and product confidence.
- Connectors and RotatePass - credential confusion reducer, safe setup metadata, and rotation impact clarity.
- System Credentials - metadata-only health surface for keys and env-backed services.
- Dogfood Report - public and internal proof that UnClick tests itself.
- Fleet Sync - multi-machine, multi-worker operating rules.
- EnterprisePass - proposed readiness lane for corporate, investor, and audit-style review.

## Original Product DNA

- UnClick started as an agent-native tool marketplace.
- The early promise was verified MCP tools, an arena for agent capability, and a curated front door for AI-native actions.
- The agent-native angle matters. Human apps and AI-agent tools need different rules, proof, and safety rails.
- Pass products, Fishbowl, reliability handoffs, and dogfood reports are layers on top of that marketplace thesis.

## Locked Business And Brand Decisions

Treat these as standing context unless Chris changes them:

- UnClick is closer to the agent-native equivalent of Stripe than an app store or operating system.
- Market to end users and businesses first. Developers follow when the front door proves demand.
- Subscription-only billing is preferred. UnClick should pay AI providers directly where possible instead of asking users to manage API credits.
- Do not make normal users think about raw keys, model billing, or provider setup if the product can absorb that complexity.
- Brand direction includes plain English, low-friction action, and strong anti-slop copy discipline.
- Chris is operating with sole-trader risk context, so Connectors and credential handling must reduce liability and avoid holding raw key data unnecessarily.

## Early Foundations

These predate the recent Fishbowl/WakePass wave:

- MCP server and tool platform.
- Memory tools: load, save, search, active facts, identity, session summaries, invalidation, and embeddings.
- Auth and API-key model, including tenant scoping by API key hash.
- Admin shell and operations pages.
- Supabase backend, RLS-sensitive tables, and service-role caution.
- Signals: check_signals, needs-doing warnings, read attribution, and fallback links.
- Strict MCP schemas and runtime extra-argument rejection.
- Architecture docs, ADRs, security posture, and current/target state docs.
- CI and npm publishing pipeline for MCP and Pass packages.
- Claude/Codex worker setup, review commands, and QA/security/doc reviewer lanes.

## Product Surfaces

Active, shipped, early, parked, or discontinued product names may all matter when reading old notes.

- Memory - persistent agent memory and identity context.
- TestPass - most painful but most necessary proof gate.
- UXPass - UX run findings, critic flow, and failed-run handling.
- WakePass - reliability product powered by PinballWake.
- PinballWake - reusable wake, ACK, lease, and reclaim engine.
- Connectors - external service setup and status surface.
- RotatePass - credential health, rotation impact, and safe key metadata.
- Dogfood Report - proof that UnClick tests itself.
- EnterprisePass - corporate/investor/auditor readiness concept.
- BackstagePass - discontinued as an active product name, but plumbing remains.
- LegalPass - legal-style verdict and disclaimer proof concept.
- SecurityPass - scanner and security proof concept, early or parked.
- SEOPass and GEOPass - search and geo visibility concepts, parked.
- CopyPass - copy quality verdict concept.
- SlopPass - AI output/code quality verdict concept.
- Crews - productized multi-role worker or decision council concept.
- Hacker Squad - security concept, distinct from SecurityPass.
- Build Desk and UnClick Build - future customer-facing worker coordination surfaces.

## Infrastructure And Operating Context

Useful background that may explain old decisions:

- Mission Control existed as a separate MCP surface, distinct from UnClick MCP.
- Telegram relay existed for off-channel status.
- PostHog replaced earlier analytics experiments.
- Vibe Kanban and local Windows scheduling influenced early worker automation.
- Google Drive shared folders were used as cross-PC reference shelves, not code source of truth.
- GitHub main and PRs are now the code source of truth.
- Multiple PCs and workers can participate, but each code worker should use a private implementation checkout.

## Process Rules That Shape The Product

These are load-bearing cultural rules:

- Default to action on safe, obvious work.
- Push back on risky or unclear work.
- Use Fishbowl for material worker coordination.
- Use memory for long-term context, but refresh GitHub and Fishbowl for live state.
- Prefer evidence over claims.
- No raw secret values in docs, logs, screenshots, reports, or PR bodies.
- Do not weaken gates just to make checks green.
- Do not use Google Drive sync as a replacement for Git branches and PRs.
- Treat service-role access as dangerous. Manually filter tenant/user scope when needed.
- Remember that VITE-style environment values can be baked at build time.
- Avoid broad refactors unless explicitly assigned.
- Use small chips, draft PRs when risk is unclear, and focused verification.

## Parked Strategic Options

These are context, not current commitments:

- UnClick Local browser extension.
- Local MCP helper.
- Loaner sessions for hostile or closed platforms.
- Co-pilot bridge for web platforms that resist direct integration.
- Alias email and TOTP relay.
- User-signed mandate layer or Web Bot Auth.
- Self-healing skill marketplace.
- Bonded cloud sessions.
- Affiliate and merchant commerce layers.
- Australian CDR Accredited Action Initiator path.
- EU EUDI Wallet integration.
- Public MCP-server-in-30-min template.
- Build Desk and visual worker cockpit.
- Council-mode strategic review of the master plan.

## Summary-Blindness Warning

A worker reading only recent PRs will see coordination, reliability, Connectors, and proof reports.

A worker reading only old docs may see marketplace, Memory, billing, Crews, Pass products, and strategy.

Both views are incomplete. Workers should combine:

1. Live GitHub and Fishbowl state for what is moving now.
2. `FLEET_SYNC.md` for current operating rules.
3. This file for historical and strategic context.
4. Product PRDs and ADRs for lane-specific detail.

## Worker Rule

If a summary of UnClick ignores the earlier MCP, Memory, business, brand, infrastructure, and strategy layers, say that it is a recent-work summary, not a full UnClick summary.

If a parked idea appears in old notes, do not assume it is active. Label it as parked unless Fishbowl, an open PR, or Chris says otherwise.

If an old product name conflicts with a newer decision, prefer the newer decision and note the older name as historical context.

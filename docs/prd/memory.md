# PRD: Memory

**Status**: Shipped. Phase 1 memory backend complete. Bi-temporal + pgvector hybrid retrieval live.
**Last updated**: 2026-04-25.

## Problem statement

Agents forget. A user who spent an hour yesterday teaching Claude their preferences starts from scratch the next morning, or loses that context when they switch to Cursor, or loses it when a new model drops. Session-scoped memory is the default across every LLM harness. For a user who lives in agents, this is a productivity tax: every session starts with a catch-up tax that humans never agree to pay twice.

Memory belongs to the user, not the harness. It should survive model upgrades, harness switches, and new devices. It should be private by default, encrypted at rest, and recoverable by export.

## Target user

- **Agent-native users.** People whose primary interface to their work is an LLM chat. They notice immediately when a new session does not know them.
- **Business operators who switch harnesses.** Claude this morning, ChatGPT at a client meeting, Cursor in the afternoon. Memory must be harness-agnostic.
- **Privacy-first power users.** BYOD (bring your own database) mode lets users store memory in their own Supabase project with service-role keys encrypted client-side so UnClick staff cannot decrypt.

## Core capabilities

1. **Six memory layers, each mapped to a real agent workflow.**
   - Business context: standing rules the agent loads on every turn.
   - Sessions: summaries of prior conversations.
   - Facts: atomic statements with confidence, category, and supersede chain.
     Troubleshooting facts use category `troubleshooting` and the shape `Issue: <symptom>. Solution: <fix>` so solved client, browser, connector, or tool problems can be found again.
   - Library: canonical documents with provenance and history.
   - Conversations: raw conversation log for replay and debugging.
   - Code: code dumps and architecture snapshots.
2. **Bi-temporal schema.** Every fact has `valid_from` and `valid_to`. Soft-deletes retain provenance. The write path is defensible; the audit trail is auditable.
3. **Hybrid retrieval.** pgvector semantic search combined with keyword filters and recency. Sub-second recall across millions of rows.
4. **Managed cloud by default, BYOD as an escape hatch.** Free-tier users get a managed Supabase slice scoped by `api_key_hash`. Power users configure their own Supabase via the Memory Setup wizard and keep their service-role key encrypted with PBKDF2 from their own api_key.
5. **Five direct MCP tools.** `load_memory`, `save_session`, `save_fact`, `search_memory`, `save_identity`. These name the session protocol agents should follow. The other 12 operations are callable via `unclick_call`.
6. **Tier-based caps and decay.** Free tier: 50 MB and 5,000 facts with basic layers. Pro tier removes caps and enables nightly extraction plus hot/warm/cold decay.
7. **Data portability as a first-class feature.** `admin_export_all` returns the user's full memory in a portable shape. "Bring your own database anytime" is the trust anchor.

## 2026-05 next-generation direction

The next Memory phase keeps Postgres and Supabase as the durable state layer, then adds compact, source-linked context above it. See [Memory Direction Next-Gen Brief](../research/memory-direction-next-gen.md).

Build priorities:

- Profile Card: compact current-state context for fresh AI Seats.
- Library Snapshots: taxonomy shelves that summarize canonical docs while linking back to raw sources.
- Provenance Trail: receipts for facts, summaries, documents, conversation chunks, code snapshots, and exports.
- Cheap-First Retrieval: business context and deterministic summaries before semantic or graph retrieval.
- Data Island Export: portable memory packages with snapshots, receipts, raw-source manifests, and redaction reports.

The guiding rule is that Memory is product state with provenance. Vector and graph features can improve retrieval, but they should not become an uninspectable storage layer.

## Success metrics

- **Session-two recall rate.** Percentage of users whose second session calls `load_memory`. Ceiling: 100% via auto-load in supported harnesses.
- **Memory volume per active user.** Average facts per tenant after 30 days. A user with 0 facts has not adopted memory; a user with 500 facts has.
- **Retrieval latency (p95).** Sub-second at any corpus size we support on-tier.
- **BYOD activation rate.** Power-user segment proxy. Low-single-digit percentage is expected and healthy.
- **Export events.** Users who export confirm the portability promise. A high export-without-churn rate is positive; export-then-churn flags a product issue.

## Out-of-scope

- **We do not index files on the user's disk.** Memory is what the user or agent explicitly saves, not ambient capture.
- **We do not run embeddings on arbitrary URLs.** The library layer accepts canonical docs that the user or agent submits.
- **We do not sell memory separately.** Memory is bundled with the platform tier. See [ADR-0002](../adr/0002-subscription-only-billing.md).
- **We do not share memory across tenants.** Every row is scoped by `api_key_hash`. Cross-tenant retrieval is structurally impossible via the supported API.

## Key decisions and why

- **`api_key_hash` is the tenant key, not `user_id`.** Memory predated the Supabase Auth wiring. Hash-scoping keeps memory independent of auth mode and works for both BYOD and managed. See [ADR-0004](../adr/0004-multi-tenant-via-api-key-hash.md).
- **Bi-temporal over hard-delete.** The 2026-04-22 near-miss incident made the case for provenance. Soft-delete with `valid_from` / `valid_to` columns plus `mc_facts_audit` records every mutation.
- **pgvector over a vector database.** Supabase is the single source of truth. One database simplifies ops, backups, and tenant scoping. Hybrid retrieval closes the precision gap.
- **Managed cloud default, BYOD escape hatch.** One-click onboarding beats five-step setup every time. Users who need air-gap control can still move to BYOD without losing their data.
- **Five direct memory tools (not all 17).** The five cover the session protocol an agent should follow. The other 12 stay behind `unclick_call` to keep the tool list readable in clients with limited UI.

## Platform philosophy alignment

- **Idiot-proof UX.** Managed cloud needs zero Supabase knowledge. The Memory Setup wizard for BYOD walks the user through schema install. No one has to paste SQL to get memory working.
- **Subscription-based (no LLM billing).** Memory is priced by storage, facts, and extraction jobs. Users supply their own embedding model calls or use the default OpenAI adapter at their own cost. UnClick never marks up model tokens.
- **MCP-first.** The five direct memory tools are the canonical agent interface. The admin UI exists for humans and for support; MCP is what agents see.

# PRD: UnClick Platform

**Status**: Active. Umbrella PRD for the platform. Child PRDs cover each product pillar.
**Last updated**: 2026-04-25.

## Problem statement

Agents are powerful but homeless. Every harness (Claude Desktop, Cursor, ChatGPT, custom clients) re-invents the same missing layer: identity, persistent memory, shared credentials, a trustworthy tool catalog, and a way for developers to earn from what they build. Today a user who switches harnesses loses their memory, loses their tool wiring, and starts from zero. Developers who build tools have nowhere to distribute them at scale.

The market is producing agents faster than the infrastructure they need to be useful. UnClick closes the infrastructure gap. One npm install gives an agent access to 450+ callable endpoints across 60+ integrations and persistent cross-session memory, all via the MCP protocol.

## Target user

Two audiences, one platform:

- **Creative professionals and business operators.** Non-coders who pay for Claude, ChatGPT, or Cursor and want their agent to remember them, take actions across their tools (Notion, Slack, Stripe, Gmail, GitHub), and coordinate real work. They do not want to install six MCP servers and wire credentials by hand.
- **Developers building MCP tools.** People who want to ship a tool, reach an installed base, and earn from usage. Marketplace infrastructure is built; doors are closed until the curation layer is ready.

## Core capabilities

1. **MCP-first surface.** Every capability is exposed through the Model Context Protocol. One marketplace search tool (`unclick_search`) plus five direct memory tools. Agents discover and invoke the rest dynamically.
2. **Persistent cross-session memory.** Six layers (business context, sessions, facts, library, conversations, code), bi-temporal schema, hybrid retrieval. Users keep context when they switch models or harnesses.
3. **Credential vault (BackstagePass).** AES-256-GCM at rest, PBKDF2 key derivation, proof-of-possession auth, full audit log. One place for user-owned API keys and OAuth tokens.
4. **Signals.** Notifications hub with a shared `withSignals` bolt-on so every tool emits the same shape of events.
5. **Crews.** Composable AI crews assembled from agent personas (developer, researcher, writer, organiser). Users run multi-agent workflows without writing orchestration code.
6. **TestPass.** QA pack runner for MCP servers. Developers ship a tool; TestPass proves it meets compliance before it reaches users.
7. **Agents (Build Desk).** Task and worker orchestration across multiple code backends (Claude Code, Codex, Cursor, Gemini CLI). One desk, many engines.
8. **Marketplace.** Developer portal with Stripe Connect and an 80/20 revenue split. Coming soon.

## Success metrics

- **Agent reach.** 450+ callable endpoints across 60+ integrations is the baseline. Growth of the wired catalog is tracked against integration demand.
- **Retention via memory.** Users who call `load_memory` on session two and beyond are the retention signal. A user who never recalls memory is not yet locked in.
- **BackstagePass activation.** Credential vault usage correlates with the user moving real work onto the platform.
- **Marketplace GMV (post-launch).** Gross developer revenue run through Stripe Connect is the marketplace proof point.
- **TestPass coverage.** Percentage of cataloged tools with a passing TestPass compliance run.

## Out-of-scope

- **We do not host a chat interface.** The user's own LLM client is the orchestrator. Building a competing chat creates a category conflict.
- **We do not middle-man LLM costs.** Users bring their own Claude, GPT, or Gemini subscription. We do not proxy tokens, meter prompts, or mark up model usage.
- **We do not build a harness.** Claude Desktop, Cursor, ChatGPT are our substrate, not our competition.
- **We do not ship a device OS.** Path B is locked: infrastructure, not operating system. See [ADR-0003](../adr/0003-stripe-model-not-windows.md).
- **We do not publish closed-source tools as developer work.** Marketplace submissions must pass TestPass and disclose their endpoints.

## Key decisions and why

- **MCP-first protocol.** Every capability exposed through MCP. Pick one protocol, be the best at it. See [ADR-0001](../adr/0001-mcp-first-agent-protocol.md).
- **Subscription-only billing.** Users pay their own AI provider. UnClick bills for platform features (memory quota, BackstagePass slots, Crews seats, marketplace revenue share), never for LLM tokens. See [ADR-0002](../adr/0002-subscription-only-billing.md).
- **Stripe model, not Windows model.** UnClick is the identity, memory, credentials, and economy rails for every agent harness. It is not itself a harness, a chat, or a device OS. See [ADR-0003](../adr/0003-stripe-model-not-windows.md).
- **Multi-tenant via `api_key_hash`.** SHA-256 of the user's API key is the canonical tenant identifier. Two-layer JWT-to-api_key_hash resolution in every handler. See [ADR-0004](../adr/0004-multi-tenant-via-api-key-hash.md).
- **Two-layer admin gating.** Server refuses AND frontend hides. Frontend-only hiding is not security; server-only refusal is bad UX. See [ADR-0005](../adr/0005-two-layer-admin-gating.md).
- **Orchestrator is user chat.** Claude Desktop, Cursor, and friends orchestrate. UnClick is infrastructure. See [ADR-0006](../adr/0006-orchestrator-is-user-chat.md).
- **Idiot-proof UX as platform rule.** Non-coder UX is the bar for every surface. See [ADR-0007](../adr/0007-idiot-proof-as-platform-rule.md).

## Platform philosophy alignment

- **Idiot-proof UX.** Every product pillar ships with a non-coder path. Wizards, sensible defaults, card-based UI. A creative professional can set up memory in under three minutes and never see a Supabase dashboard.
- **Subscription-based (no LLM billing).** UnClick charges for platform features, not for tokens. Users keep their own AI subscriptions. The commercial relationship is with the user, not with the model provider.
- **MCP-first.** Every capability is reachable through the MCP protocol. No parallel REST-only surface is the supported path for agents. The website and admin shell exist for humans; MCP is the canonical surface for agents.

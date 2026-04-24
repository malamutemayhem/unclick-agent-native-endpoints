# PRD: Signals

**Status**: Shipped. Phase 1 MVP live. `withSignals` wrapper applied at tool wiring.
**Last updated**: 2026-04-25.

## Problem statement

An agent that runs in the background without observability is a liability. Users who have hundreds of tool calls a day need a way to see what happened, what succeeded, what failed, and what needs their attention. Today most MCP harnesses throw model output at the user and call it done; anything that happens inside a tool call is invisible unless the agent narrates it.

UnClick is also the layer that needs to alert users: memory cap approaching, credential expiring, crew run finished, marketplace tool updated. A uniform notifications surface is the only sane way to do that across 450+ endpoints without bolting a notification stanza onto every tool.

## Target user

- **Agent-native users running many actions.** The more an agent does per day, the more a user needs a signals inbox.
- **Business operators coordinating multi-step workflows.** Crew runs, TestPass runs, long-running tasks need completion notifications.
- **Developers shipping tools.** A tool that wants to alert the user (quota hit, auth expired, integration degraded) uses Signals rather than inventing its own channel.

## Core capabilities

1. **Notifications hub.** `mc_signals` table stores every signal with title, body, severity, category, read state, and source tool. Accessible via the admin Signals page and directly through MCP.
2. **`withSignals` bolt-on wrapper.** A higher-order wrapper applied at tool wiring time. Every wrapped tool emits signals for success, failure, and user-alert cases without per-tool code.
3. **Preferences per category.** Users mute categories, choose email digest vs realtime, and set quiet hours. `mc_signal_preferences` stores the per-tenant settings.
4. **Cron-driven dispatch.** `api/signals-dispatch.ts` runs every minute via `vercel.json` cron. Fan-out handles email, web push (future), and webhook delivery.
5. **Read state and bulk actions.** Mark one, mark all, filter unread, search. The surface is designed as an inbox, not a log.
6. **Uniform shape.** Every signal regardless of source has the same fields. Clients never special-case per tool.

## Success metrics

- **Signals per active tenant per day.** A tenant with 0 signals is not yet getting value from their integrations. A tenant with thousands is being spammed.
- **Read rate.** Percentage of signals the user marks read (or that are auto-marked by open events). Low read rates suggest noise.
- **Mute rate by category.** High mute on a category is a signal to the category owner that its noise-to-signal ratio is bad.
- **Time-to-read on High-severity.** How fast users acknowledge incidents. A latency signal for the product surface itself.
- **Cron job SLO.** `signals-dispatch` completes inside its one-minute budget 99.9 percent of the time.

## Out-of-scope

- **We do not send SMS in v1.** Email, in-app, and webhook only. SMS has carrier complexity that does not fit Phase 1.
- **We do not support per-signal routing rules.** Routing is per-category. A rules engine is a Phase 3 feature if demand proves out.
- **We do not store signal bodies forever.** A retention window applies; users who need permanent record should export.
- **We do not relay third-party notifications we did not generate.** Signals is UnClick's bus, not an aggregator.

## Key decisions and why

- **One bolt-on wrapper, not per-tool emit code.** 450+ tools cannot each have bespoke observability code. `withSignals` at the wiring layer guarantees coverage and uniform shape. See [ADR-0010](../adr/0010-bolt-on-signals-pattern.md).
- **Cron over long-polling worker.** Vercel's Hobby plan has no always-on worker; a one-minute cron is cheap, reliable, and idempotent. Latency under 60 seconds is acceptable for the MVP.
- **Category-based preferences over per-tool.** Scaling per-tool preferences to 450+ integrations would drown the user in setting rows. Categories (billing, memory, credentials, runs) keep the preference surface small.
- **Same schema regardless of source.** A crew run signal and an integration signal share a shape. Clients stay simple; future channels (mobile, webhook) do not need source-specific code.
- **Phase 1 MVP over a perfect build.** The current system does in-app read, basic email digest, and webhook. Advanced routing, mobile, and SMS are Phase 2+. We shipped minimum viable to close the observability gap, not the perfect inbox.

## Platform philosophy alignment

- **Idiot-proof UX.** The Signals page is a familiar inbox. Click, read, mark. Preferences are three toggles per category. No concept of webhooks or delivery rules is required for the default user.
- **Subscription-based (no LLM billing).** Signals is part of the platform tier. Free tier gets a daily digest; Pro gets realtime. No LLM calls are involved; no token costs flow through UnClick.
- **MCP-first.** Agents read and act on signals through `unclick_call` (list, mark, preferences). An agent can process its own inbox as part of a planning turn. The web UI is human-facing, the MCP path is agent-facing.

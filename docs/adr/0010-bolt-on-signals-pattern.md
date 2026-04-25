# ADR-0010: Bolt-on `withSignals` pattern for tool observability

**Status**: Accepted
**Date**: 2026-04-25
**Supersedes/Extends**: None

## Context

UnClick wires 450+ callable endpoints across 60+ integrations. Every one of those endpoints can succeed, fail, or hit a user-alert condition (quota reached, auth expired, rate limited). Users need a uniform way to see what happened. The Signals product is the inbox surface; the question is how each tool emits into it.

Option A is to require every tool implementation to write to the `mc_signals` table directly. This scales linearly with tool count, and every new tool adds boilerplate that can drift: different field names, missing emission on failure, forgotten emission on success. After 450 tools, uniformity collapses.

Option B is a higher-order wrapper applied at the wiring layer. One piece of code observes every tool call, reads its name and outcome, and writes a signal with a uniform shape. Tool implementations stay focused on business logic.

## Decision

All UnClick tools emit observability signals through a shared `withSignals` wrapper rather than inline telemetry code per tool. The wrapper is applied in `packages/mcp-server/src/tool-wiring.ts` at the site where each tool is registered, so every new tool gains signal emission on day one. Tool implementations do not call `mc_signals` directly in the normal case. Special cases that need non-default signal shape (e.g. a long-running tool emitting progress signals) extend the wrapper rather than bypass it.

## Consequences

**Benefits:**
- Uniform signal shape across all 450+ tools. Clients render identical cards regardless of source.
- Zero per-tool overhead. A new tool is observable immediately on registration.
- Centralised telemetry policy. Changing severity rules, mute logic, or retention is one file, not 450.
- Lower risk of drift. New tools cannot accidentally ship without observability.

**Drawbacks / trade-offs:**
- The wrapper must handle every tool's success and failure shape. When a tool returns something odd, the wrapper has to be smart or the signal degrades gracefully.
- Per-tool customisation requires extending the wrapper, which is a mild coupling. Tools with genuinely unique signal needs (progress bars, multi-step outputs) pay a small cost.
- Centralised patterns hide behaviour. A developer tracing "why did this signal appear" has to know to look in the wrapper, not in the tool.

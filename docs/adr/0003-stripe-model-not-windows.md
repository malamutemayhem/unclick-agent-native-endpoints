# ADR-0003: Stripe model, not Windows model

**Status**: Accepted
**Date**: 2026-04-25
**Supersedes/Extends**: None

## Context

Two paths exist for a company in the agent-infrastructure layer. Path A is to become a vertically integrated agent operating system: build the harness, build the chat UI, build the model orchestration, own the device experience end-to-end. This is the Windows model. Path B is to be the identity, memory, credentials, and economy layer every harness needs: do one thing, do it well, and be embedded in everyone else's product. This is the Stripe model. Stripe did not build an e-commerce site; it became the rails every site runs on. The Windows model competes with every harness for the user's primary interface. The Stripe model is complementary to every harness.

## Decision

UnClick follows Path B. We are the identity, memory, credentials, and economy layer that every agent harness needs. We are not a harness, not a chat UI, not a model, not a device operating system. Claude Desktop, Cursor, ChatGPT, and the next ten entrants to the space are our substrate, not our competition. Every decision is measured against this: if the change moves UnClick toward becoming a harness, it is out of scope. If it strengthens UnClick as rails, it is in scope.

## Consequences

**Benefits:**
- We do not compete with Anthropic, OpenAI, or any harness vendor. We enable all of them.
- Addressable market is every agent user, regardless of which harness they use.
- Focus. One category, one bar. We are the best memory + credentials + catalog layer rather than a second-rate everything.
- Clean investor story. "Stripe for agents" is a one-sentence pitch that maps to a known business shape.

**Drawbacks / trade-offs:**
- We rely on the harnesses to ship MCP support. If a major harness refuses MCP, our reach through it is limited.
- We give up the device UX play. A user's front door is their harness, not UnClick. We surface inside; we do not own the glass.
- Feature requests that look like "build a chat" or "build your own agent" are permanent no's. We must say no consistently, including when the ask is tempting.

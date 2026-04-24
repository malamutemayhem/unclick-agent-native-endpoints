# ADR-0002: Subscription-only billing

**Status**: Accepted
**Date**: 2026-04-25
**Supersedes/Extends**: None

## Context

Agent platforms have two billing models. The first is to sit between the user and the LLM provider, meter tokens, mark them up, and bill the user for consumption. The second is to stay out of the LLM relationship entirely and charge for platform features. Many emerging platforms pick the first because it promises usage-based revenue that scales with the user's activity. The hidden costs are significant: negotiating provider rates, handling failed charges, explaining margin to users who already pay the provider directly, and taking on the fraud and billing-dispute surface of a payment middleware business. Users already have Claude Pro, ChatGPT Plus, Cursor Pro, or Gemini Advanced subscriptions. They do not want a second token bill for the same tokens.

## Decision

Users pay their own AI provider subscription (Claude, GPT, Cursor, Gemini, or any other MCP-compatible client). UnClick does NOT proxy or meter LLM usage. UnClick charges for platform features: memory storage and extraction tier, BackstagePass vault size, Crews seats, worker fleet size, and the marketplace revenue share. Tools that call LLMs do so via the user's own credentials, not an UnClick-managed model account. A user who uses UnClick heavily sees one bill from Anthropic (or OpenAI, etc.) plus one bill from UnClick. The two are unrelated.

## Consequences

**Benefits:**
- Pricing is predictable and explainable. Users already know what they pay their AI provider; the UnClick line is separate and fixed for their tier.
- Zero margin compression risk from provider price changes. If Anthropic drops or raises prices, we are unaffected.
- No billing middleware surface. No 3D Secure disputes over token cost, no payment processor risk on LLM charges.
- Aligns with user mental model. "I pay OpenAI for the AI. I pay UnClick for the agent infrastructure." Clean separation.

**Drawbacks / trade-offs:**
- Revenue does not scale linearly with a user's LLM burn. A user who makes 10x more tool calls pays the same tier.
- We cannot offer a single bundled price with LLM cost included, which is sometimes a customer ask.
- Some tools (e.g. Crews) that orchestrate model calls still hit the user's provider. A misconfigured crew spends the user's tokens; we need to make the cost model transparent in the UI.

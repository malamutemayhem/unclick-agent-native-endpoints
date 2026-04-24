# ADR-0007: Idiot-proof UX as a platform rule

**Status**: Accepted
**Date**: 2026-04-25
**Supersedes/Extends**: None

## Context

UnClick has two audiences: creative professionals and business operators (non-coders) on one side, developers submitting to the marketplace on the other. When a product serves both, the default bias is usually to optimise for developers because developers are easier to please and give the loudest feedback. That choice quietly makes the product unusable for the larger non-coder audience. Every dialog, error message, setup step, and glossary term becomes a cliff the non-coder cannot climb.

We have seen this on prior projects. A feature ships, developers love it, real users never adopt it because they bounce off the first unfamiliar word. The fix is always slower than building the non-coder path in the first place.

## Decision

Non-coder UX is the bar for every surface. If a non-coder cannot understand it, it ships with better UX or does not ship. This rule applies to setup wizards, admin pages, error messages, and tool descriptions. Developer power-user features are additive, never the default. When a conflict arises between "make this easier for developers" and "make this easier for non-coders," non-coders win unless the feature is explicitly and exclusively for developers (e.g. the TestPass CLI).

Practical implications:
- Dialogs use plain language. No jargon without a parenthetical explanation.
- Setup flows default to the managed path. BYOD is a toggle, not a required step.
- Error messages state what happened and what to do next, in user terms, not system terms.
- Every new feature has a non-coder walkthrough before launch. If we cannot explain it to a non-coder, we cannot ship it.

## Consequences

**Benefits:**
- Adoption widens. Non-coders are the larger market; our default surface reaches them.
- Support burden drops. Error messages that explain themselves prevent tickets.
- Design discipline. The rule forces every feature to be simple enough to explain.
- Brand differentiation. The agent space is littered with developer-first tools. Being the one that is actually usable is a moat.

**Drawbacks / trade-offs:**
- Developer users sometimes want raw power and get a wizard instead. Escape hatches mitigate this but they are extra work.
- Shipping velocity is lower than a developer-first product of the same scope; hand-holding UI costs real time.
- The rule is subjective. Judgement calls about what counts as "idiot-proof" can slow down PR review; mitigate with explicit non-coder walkthrough gates.

# FlowPass Product Brief

FlowPass checks whether an important product path can work end-to-end. It is the journey-completion member of the Pass family: TestPass checks tools, UXPass checks human experience, SEOPass checks search readiness, and FlowPass checks that a user can start, move through, recover from errors, and reach a handoff or receipt.

## Chunk 1 Scope

This chip is a scaffold only. It adds the FlowPass package, plan-only schemas, a fixture-driven flow plan, a verdict-pack helper, focused tests, and this brief.

It does not run live signup, auth, checkout, billing, email, domains, production database writes, or destructive submissions. The first surface is intentionally static and fixture-driven so future runners can add live-readonly evidence without unsafe product actions.

## Default Hats

- Entry route loads.
- Primary CTA is reachable.
- Form is ready for fixture input.
- Success state is represented.
- Failure state is represented.
- Navigation continuity is preserved.
- Handoff proof is available.

## Shared Scanner Boundary

FlowPass consumes the shared GEOPass scanner contract only as source context. The current adapter records the target URL and shared check ids, especially aggregate AI engine readiness, but it does not duplicate GEOPass scanner internals.

## Build Sequence

1. Chunk 1: schema, flow plan, verdict pack, package scaffold, tests, brief.
2. Chunk 2: fixture runner receipts for route, CTA, form, success, failure, navigation, and handoff proof.
3. Chunk 3: admin report surface and Boardroom or Signals routing.
4. Chunk 4: optional live-readonly runner with explicit protected-flow exclusions.

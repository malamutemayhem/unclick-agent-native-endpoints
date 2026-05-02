# PRD: XPass

**Status**: Naming contract locked. Implementation slices land through the individual Pass products.
**Last updated**: 2026-05-01.
**Owner**: Product and Pass-family maintainers.

## Why this exists

The Pass family is growing quickly. TestPass, UXPass, SEOPass, CopyPass, LegalPass, SecurityPass, SlopPass, FlowPass, GEOPass, RotatePass, and WakePass each need their own scope contract, but users should not have to remember which Pass to call for every situation.

XPass is the umbrella/action name for orchestration across the Pass family.

It prevents three sources of drift:

1. inventing competing umbrella names like AllPass, PassRun, or PassHub
2. describing XPass as another sibling product instead of the conductor
3. routing every new check into a new Pass before the existing Pass surfaces are dogfooded

## One-sentence definition

XPass is the Pass-family conductor that chooses and runs the relevant scoped Pass checks for a target, then returns one combined receipt with evidence and exclusions.

## Naming contract

Use:

- **XPass** for the umbrella/conductor product
- **XPass run** for one orchestrated run across one or more Pass checks
- **XPass receipt** for the combined result users can inspect or share
- **Pass-family check** for a single underlying check such as TestPass, UXPass, or SecurityPass
- **Pass-family result** for the scoped output from one underlying Pass

Do not introduce:

- AllPass
- PassRun
- PassHub
- MetaPass
- SuperPass
- PassSuite as the product name

The sentence "XPass your build" means "run the relevant Pass-family checks for this target." The letter X is the variable, not a new sibling category.

## Product posture

XPass should feel:

- like an operator for the checks UnClick already trusts
- evidence-led and conservative
- easy to explain to a non-developer
- useful for unattended dogfooding and marketplace readiness

XPass should not feel:

- like a magic quality stamp
- like a replacement for the underlying Pass scopes
- like a way to bypass individual disclaimers
- like a broad product expansion before Connections and reliability substrate work are stable

## Relationship to individual Passes

XPass does not own the finding logic for each Pass. It owns orchestration and presentation.

| Layer | Owns | Examples |
| --- | --- | --- |
| XPass | selection, ordering, shared run receipt, summary, exclusions | "Run TestPass plus SecurityPass because this is an MCP PR." |
| Individual Pass | domain checks, disclaimer, evidence, pass/fail semantics | TestPass probe results, CopyPass claim findings, SecurityPass hygiene findings |
| WakePass | action-required dispatch and missed-ACK visibility | failed scheduled run needs a worker, stale check needs reclaim |
| Connections | credential and provider status used by checks | GitHub token valid, Search Console needs reconnect |

## Current family map

Working or exposed:

- TestPass
- UXPass
- SEOPass
- CopyPass
- LegalPass

In build or scoped:

- SlopPass
- FlowPass
- SecurityPass
- GEOPass
- RotatePass
- EnterprisePass
- WakePass

Archived or parked:

- BackstagePass as a brand/product. Old code may be borrowed when useful, but current user-facing language should prefer Connections or Connectors.

## Run receipt requirements

Every XPass receipt must show:

1. **Target**
   The exact PR, URL, MCP server, page, connector, or artifact inspected.
2. **Checks selected**
   Which Pass-family checks ran and why they were selected.
3. **Checks skipped**
   Which relevant checks did not run and why.
4. **Evidence**
   Links or structured artifacts from each underlying Pass result.
5. **Action needed**
   Clear next step when a result needs owner action.
6. **Staleness**
   When the receipt was generated and whether newer code, credentials, or deploys may invalidate it.

## Public copy rules

Allowed public claims:

- XPass runs the relevant UnClick Pass-family checks for a target.
- XPass produces a combined receipt showing evidence, skipped checks, and next actions.
- XPass helps UnClick dogfood its own QA, UX, security, SEO, copy, and legal-review surfaces.

Disallowed public claims:

- XPass certifies quality, security, legality, SEO ranking, or production readiness.
- XPass replaces TestPass, UXPass, SecurityPass, CopyPass, LegalPass, or any other individual Pass.
- XPass proves every issue is gone.
- XPass can run checks when credentials, tokens, target access, or provider setup are missing.

## Routing rules

Use XPass when:

- the user asks for "all relevant checks"
- a PR or release needs a combined dogfood receipt
- a marketplace submission needs more than one Pass-family gate
- a scheduled dogfood run should produce one public receipt

Use an individual Pass when:

- the user asks for one specific domain
- the result needs a domain-specific disclaimer
- the check is still being built or validated
- credentials or target setup only exist for one Pass

Use WakePass when:

- a run failed and somebody must act
- a scheduled check missed its ACK window
- a stale check needs reclaim or retry visibility

## Non-goals

XPass does not:

- invent new checks outside the Pass family
- merge individual Pass scope contracts
- hide uncertainty or missing credentials
- rename existing endpoints in this slice
- authorize broad Pass expansion while reliability substrate or Connections work is the current priority

## Implementation notes

The first useful implementation is not a dashboard. It is a small receipt orchestrator that can:

1. accept a target
2. choose a small set of already-working Pass checks
3. run or reference those checks
4. produce a combined JSON receipt
5. hand off failed action-needed paths to WakePass

Future UI should treat XPass as the top-level action and individual Passes as expandable evidence sections.

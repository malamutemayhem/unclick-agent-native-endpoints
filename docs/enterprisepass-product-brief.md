# EnterprisePass Product Brief

## Positioning

EnterprisePass is the enterprise-readiness report for early software teams.

It helps a founder, builder, investor, or future enterprise buyer answer:

> Are we building in a way that will age well, or are we creating avoidable regret?

EnterprisePass is not a compliance certificate, SOC report, ISO audit, legal opinion, or substitute for a qualified auditor. It is a guidance and evidence layer that points teams toward better foundations before those foundations become expensive to change.

## Short Definition

EnterprisePass scans a product, repo, and operating surface, then produces an evidence-backed readiness report with traffic-light findings, plain-English risk notes, and practical next steps.

## Core Promise

EnterprisePass should help a team avoid six-year regret.

Examples:

- "We wish we had written down security ownership earlier."
- "We wish we had a clean audit trail for credentials and deploys."
- "We wish investors did not read the code and assume it was careless vibe coding."
- "We wish enterprise buyers did not ask for evidence we had never collected."
- "We wish our claims had links to real tests, commits, docs, or workflows."

## Audience

Primary users:

- early founders trying to look credible without pretending to be enterprise already
- technical investors doing a first-pass quality read
- startup engineering teams preparing for larger customers
- AI-native teams that need proof, not just confident claims

Secondary users:

- enterprise procurement teams
- external consultants
- future auditors

EnterprisePass should be useful to auditors, but it does not replace them.

## Report Shape

Every EnterprisePass report should include:

1. **Readiness score**
   A directional score with a traffic-light band.
2. **Evidence**
   File paths, PRs, workflow runs, docs, config, or public receipts.
3. **Gaps**
   Clear findings where evidence is missing, stale, weak, or contradicted.
4. **Next actions**
   Small, practical fixes a team can do now.
5. **Future regret notes**
   Plain-English warnings about what becomes painful later if ignored.
6. **Exclusions**
   What was not checked and why.
7. **Disclaimer**
   The report is readiness guidance, not formal compliance certification.

## Categories

Phase 0 should stay small and evidence-led:

| Category | What It Looks For |
| --- | --- |
| Code maintainability | tests, build, lint, type safety, file-size outliers, brittle structure |
| Secure development | security policy, branch protection, dependency checks, secret scanning signals |
| Evidence over claims | bold claims linked to real proof, no unsupported "enterprise ready" language |
| Documentation quality | README, ADRs, runbooks, architecture notes, onboarding |
| Credential and environment hygiene | ownership, rotation notes, used-by mapping, staleness |
| Investor readiness | license, bus-factor signals, audit trail, operational discipline |
| AI governance readiness | model/provider inventory, human oversight, data/source notes where AI is used |

## Relationship To Other Passes

EnterprisePass should not duplicate the domain logic of the other Pass products.

It should collect, summarize, and cross-reference their evidence.

| Product | EnterprisePass Uses It For |
| --- | --- |
| TestPass | proof that checks actually run |
| SecurityPass | security hygiene findings and scope-gated security evidence |
| SlopPass | code quality, structure, comment quality, maintainability concerns |
| LegalPass | risky claims, disclaimers, jurisdiction-sensitive wording |
| RotatePass | credential ownership, staleness, rotation blast radius |
| WakePass | action-needed handoffs for failed or stale evidence |
| XPass | combined run receipt when multiple Pass checks are needed |

EnterprisePass is the board report. The other Passes are the specialist evidence sources.

## Naming Guardrail

Use:

- EnterprisePass
- EnterprisePass report
- enterprise-readiness report
- readiness indicator
- evidence alignment
- future-regret risk

Do not use:

- certified
- compliant
- audit passed
- ISO approved
- SOC ready as a guarantee
- legally safe
- enterprise certified

Allowed phrasing:

> EnterprisePass highlights enterprise-readiness gaps and evidence.

Disallowed phrasing:

> EnterprisePass certifies your startup is enterprise compliant.

## Phase 0 Scope

Build Phase 0 as a report and guidance layer, not a broad scanner platform.

Phase 0 can include:

- static repo/docs scan
- workflow and package metadata checks
- links to existing Pass receipts
- manual evidence placeholders
- traffic-light report JSON
- rendered admin/public view
- plain-English next actions

Phase 0 should avoid:

- formal ISO/SOC mappings presented as compliance
- legal or audit conclusions
- network security probing
- storing raw secrets
- broad credential vault work
- automated customer-facing claims
- pretending unknown evidence is a pass

## Low-Hanging Fruit EnterprisePass Can Recommend

These are safe early recommendations:

- add or update `SECURITY.md`
- add a lightweight architecture overview
- add an ADR folder and decision records
- add a credential ownership matrix
- add a third-party service inventory
- add runbooks for deploy, incident response, and key rotation
- document test and release gates
- add evidence links to major product claims
- flag stale TODOs, oversized files, and unsupported marketing claims

## Product Tone

EnterprisePass should feel:

- calm
- conservative
- evidence-first
- useful to non-experts
- honest about uncertainty
- practical rather than scary

It should not feel:

- like fake enterprise theatre
- like an AI pretending to be an auditor
- like a giant compliance project
- like a legal guarantee
- like another noisy dashboard

## First Useful Output

The first useful artifact is:

`public/enterprise/latest.json`

And a rendered view that says:

- what was checked
- what passed
- what is weak
- what was unknown
- what to do next
- what evidence backs the answer

That is enough to start dogfooding EnterprisePass without overbuilding it.


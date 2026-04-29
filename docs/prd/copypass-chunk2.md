# CopyPass Chunk 2
**Status**: Draft
**Last updated**: 2026-04-29
**Owner**: `🦾`
**Purpose**: Lock the CopyPass scope contract before implementation or packaging expands

## Why this exists
CopyPass needs a clear boundary before it ships as a product surface.
This chunk defines:
- what CopyPass is allowed to claim
- what evidence a run must return
- what it must explicitly decline to promise
- what banner language should stay visible in product surfaces
This is a doc-first scope lock, not an implementation PR.

## One-sentence definition
CopyPass is a scoped copy-quality verdict engine that reports evidence-based findings for the AI-generated copy it inspected.
It is not a guarantee that the copy is correct, safe, lawful, or fit for every audience or use case.

## Product posture
CopyPass should feel:
- concrete
- evidence-led
- conservative in claims
- useful to an operator who needs next actions
CopyPass should not feel:
- like a creative-writing oracle
- like a legal approval
- like a brand-signoff substitute
- like a blanket publish-safe stamp

## Core promise
CopyPass promises:
1. it will inspect a defined body of AI-generated copy and review scope
2. it will return findings tied to observable evidence in that copy
3. it will distinguish observed issues from uncertainty, subjectivity, or missing context
4. it will say what it did not evaluate
CopyPass does not promise:
1. that the copy is objectively good
2. that no factual, legal, editorial, or brand issues remain
3. that the result satisfies regulatory, platform, or client requirements
4. that every audience, locale, or downstream channel interpretation was tested
5. that the result remains valid after later prompt, model, policy, or copy changes

## Disclaimer banner
This should mirror the LegalPass pattern: plain language, always visible, hard to misread.

### Banner headline
`CopyPass is a scoped review, not a guarantee of copy quality or safety.`

### Banner body
`CopyPass reports evidence-based copy-quality findings it can observe in the AI-generated copy and scope for this run. It does not certify factual accuracy, legal compliance, brand approval, conversion performance, or fitness for every audience, channel, or future edit.`

### Compact variant
`Scoped review only. Not legal approval, brand sign-off, or a guarantee of quality, safety, or performance.`

## Required run artifact
Every CopyPass result must show four things:
1. **Target**
   - exact copy block, prompt output, asset, route, or campaign text under review
2. **Scope performed**
   - exact checks attempted
3. **Findings**
   - issues observed, with severity and evidence
4. **Not checked**
   - exclusions, blocked checks, and unknowns
If any of those are missing, the run is incomplete as a product artifact.

## In-scope review areas
CopyPass may check:

### 1. Claim clarity and support
- unsupported product claims
- vague superlatives presented as facts
- copy that implies evidence it does not show
- missing qualifiers where certainty is overstated

### 2. Internal consistency
- contradictions inside the same copy set
- mismatched numbers, dates, or named entities
- headline-to-body drift
- CTA language that conflicts with the stated offer

### 3. Audience and tone fit
- tone that misses the intended audience
- wording that creates unnecessary confusion
- inconsistent voice across adjacent sections
- phrasing that reads robotic, bloated, or unnatural

### 4. Risky persuasion and trust signals
- pressure language that overreaches
- testimonials or authority cues with unclear support
- misleading urgency or scarcity framing
- trust language that implies guarantees not actually offered

### 5. Product-surface honesty
- UI copy that overclaims what the product or workflow can do
- missing disclosure of meaningful uncertainty
- hidden gaps between the evidence reviewed and the confidence presented

## Evidence contract
CopyPass should return evidence that is inspectable, not mystical.
Acceptable evidence may include:
- exact quoted spans from the inspected copy
- location references for where the issue appears
- comparison between conflicting statements in the same artifact
- rationale for why a claim appears unsupported, overstated, or unclear
- notes about missing context when a verdict cannot be made cleanly
Evidence should avoid:
- unexplained scores with no textual support
- blanket judgments without quoted examples
- simulated certainty where the issue is subjective
- hidden chain-of-thought or private internal reasoning

## Explicitly out of scope
CopyPass should not claim to cover:

### 1. Legal or regulatory approval
- formal legal review
- advertising-law sign-off
- industry-specific regulatory certification
- jurisdiction-by-jurisdiction compliance interpretation

### 2. Full factual verification
- source-checking every statement against external reality
- validating future-looking claims
- confirming customer outcomes or performance promises
- proving that cited numbers remain current

### 3. Full brand or editorial approval
- final brand-team sign-off
- creative-director preference arbitration
- exhaustive style-guide enforcement unless the guide is explicitly in scope
- perfect localization for every market

### 4. Performance prediction
- guaranteed conversion uplift
- guaranteed engagement outcomes
- guaranteed deliverability or platform acceptance
- guaranteed protection from user complaints or moderation actions

## Output contract
Each finding should include:
- title
- severity
- why it matters
- evidence
- suggested fix
- confidence note when needed
Each run summary should include:
- one-sentence posture summary
- counts by severity
- a coverage or confidence note

## Severity model
- `critical`: severe overclaim, high-risk deception, or dangerous copy issue with immediate business or trust impact
- `high`: serious clarity, support, or trust problem likely to mislead users or create material risk
- `medium`: real quality weakness, but not clearly catastrophic alone
- `low`: limited-impact clarity, tone, or polish issue
- `info`: observation or improvement suggestion without current evidence of material harm

## Failure modes to avoid
CopyPass should not:
- emit a green-sounding top-line summary when important scope was skipped
- collapse subjective uncertainty into implied certainty
- present style preference as a confirmed defect without saying so
- hide blocked checks or missing context
- describe copy as approved, compliant, or safe when the run only inspected text quality signals

## UI and API acceptance bar
Before implementation is called done:
1. every result surface must show the disclaimer banner or compact equivalent
2. every result payload must expose target, scope, findings, and not-checked sections
3. every summary must preserve uncertainty and non-coverage instead of flattening them away
4. no marketing or UI copy may describe CopyPass as approval, certification, or a guarantee of quality, legality, or performance

## Recommended next step
When Chunk 2 is approved, the next implementation slice should wire the disclaimer banner and output-shape requirements into the first CopyPass result surface before broader marketplace packaging or automation work proceeds.

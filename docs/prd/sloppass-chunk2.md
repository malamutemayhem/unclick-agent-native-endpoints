# SlopPass Chunk 2
**Status**: Draft
**Last updated**: 2026-04-29
**Owner**: `🦾`
**Purpose**: Lock the SlopPass scope contract before implementation or packaging expands
## Why this exists
SlopPass needs a clear boundary before it ships as a product surface.
This chunk defines:
- what SlopPass is allowed to claim
- what evidence a run must return
- what it must explicitly decline to promise
- what banner language should stay visible in product surfaces
This is a doc-first scope lock, not an implementation PR.

## One-sentence definition
SlopPass is a scoped code-quality verdict engine that reports evidence-based slop signals in the AI-generated code it inspected.
It is not a guarantee that the code is good, correct, or production-ready.

## Product posture
SlopPass should feel:
- concrete
- evidence-led
- conservative in claims
- useful to an operator who needs next actions
SlopPass should not feel:
- like a style cop
- like a taste-based code review
- like a correctness certification
- like a blanket approval stamp

## Core promise
SlopPass promises:
1. it will inspect a defined target and review scope
2. it will return slop findings tied to observable evidence
3. it will distinguish observed quality failures from unknown or untested areas
4. it will say what it did not evaluate
SlopPass does not promise:
1. that the code is bug-free
2. that no hidden defects, regressions, or security issues remain
3. that the result satisfies team style, architecture, or hiring standards
4. that every runtime path, edge case, dependency, or framework interaction was validated
5. that the result remains valid after later code, prompt, model, env, or dependency changes

## Disclaimer banner
This should mirror the LegalPass pattern: plain language, always visible, hard to misread.
### Banner headline
`SlopPass is a scoped quality review, not a guarantee that the code is good.`
### Banner body
`SlopPass reports evidence-based code quality risks it can observe in the target and scope for this run. It does not certify correctness, replace full testing or human review, or verify every runtime path, dependency, environment, or future change.`
### Compact variant
`Scoped review only. Not a correctness certification, full test suite, or quality guarantee.`

## Required run artifact
Every SlopPass result must show four things:
1. **Target**
   - exact repo, branch, diff, files, PR, or artifact under review
2. **Scope performed**
   - exact checks attempted
3. **Findings**
   - slop signals observed, with severity and evidence
4. **Not checked**
   - exclusions, blocked checks, and unknowns
If any of those are missing, the run is incomplete as a product artifact.

## In-scope review areas
SlopPass may check:
### 1. Grounding and API reality
- invented framework APIs
- wrong library methods or signatures
- imports that do not exist
- config keys copied from the wrong version or ecosystem
- code paths that look plausible but are not wired to anything real
### 2. Logic plausibility
- conditionals that cannot produce the claimed outcome
- unreachable branches
- silent fall-through behaviour
- broken async flow
- missing awaits, swallowed promises, or unhandled error paths
- state updates that appear cosmetically right but do not actually preserve invariants
### 3. Scaffold-without-substance patterns
- placeholder helpers presented as completed logic
- TODO-shaped code wrapped in polished naming
- dead abstractions added to look sophisticated
- generic wrappers that increase indirection without adding working behaviour
- copy-pasted modules with renamed nouns but unchanged semantics
### 4. Test and proof theatre
- tests that only snapshot happy-path output
- mocks that prove the mock, not the feature
- assertions too weak to catch the claimed behaviour
- fixtures that bypass the risky path entirely
- comments or PR copy that overstate what was verified
### 5. Karpathy-style slopocalypse failure modes
- verbose code that hides a simple missing constraint
- pattern-matched architecture with no fit to the actual problem
- fake robustness via retries, flags, or wrappers that do not solve the failure
- cargo-cult security, performance, or accessibility changes
- polished-looking structure pasted in ahead of basic correctness
- confidence-heavy explanations that are not backed by executable reality
### 6. Maintenance and change-risk signals
- duplicated logic that will drift quickly
- inconsistent naming across one generated slice
- broad edits that touch many files without preserving local conventions
- migrations, schema assumptions, or env dependencies not reflected in the surrounding code
- code that future humans will not be able to reason about from the evidence present

## Explicitly out of scope
SlopPass should not claim to cover:
### 1. Full correctness proof
- formal verification
- exhaustive path exploration
- mathematical proof of business logic
- guarantee of zero regressions
### 2. Full testing
- complete unit coverage
- end-to-end environment validation
- production load or concurrency behaviour
- real-device or cross-browser confidence unless explicitly run
### 3. Full security review
- exploit research
- auth bypass analysis
- secret exposure hunting beyond what quality checks incidentally reveal
- compliance mapping or secure-design sign-off
### 4. Team-specific taste and architecture lawyering
- preferred code style if the code is otherwise sound
- framework ideology disputes
- blanket bans on abstraction level without evidence of harm
- hiring-quality judgments about the author

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

## Evidence contract
SlopPass should return evidence that lets a skeptical reviewer audit the verdict.
That evidence may include:
- file and line references
- exact suspicious snippet or behaviour summary
- failed or skipped checks
- mismatch between claimed API and documented API
- mismatch between tests and implementation
- duplication or drift indicators across touched files
- confidence notes when a signal is heuristic rather than definitive
Evidence should prefer "here is the break or mismatch" over "this feels AI-generated."

## Severity model
- `critical`: the generated change creates a clear, high-impact break or false-safety condition likely to ship unnoticed
- `high`: strong evidence of non-trivial wrongness, fake completeness, or major maintenance risk
- `medium`: real weakness, likely bug source, or misleading scaffold that needs human cleanup
- `low`: limited impact, local cleanup, or readability issue with some evidence of future drift
- `info`: observation, smell, or recommendation without current evidence of concrete breakage

## Failure modes to avoid
SlopPass should not:
- emit a green-sounding top-line summary when important scope was skipped
- collapse unknown coverage into implied quality
- present "AI-ish style" as a finding without a concrete code-quality consequence
- punish unconventional but working code just because it is unfamiliar
- hide blocked checks or tool limitations
- use certification-like language unless the run actually performed that stronger review

## What SlopPass can claim publicly
Safe claims:
- SlopPass reviewed the submitted code within a defined scope
- SlopPass found evidence of specific slop risks
- SlopPass found no major slop signals in the areas it evaluated
- SlopPass reports what it checked and what it did not check
Unsafe claims:
- this code is production-ready
- this PR is good
- this feature is correct
- this repository is free of AI slop
- this result replaces tests, senior review, or real-world usage

## UI and API acceptance bar
Before implementation is called done:
1. every result surface must show the disclaimer banner or compact equivalent
2. every result payload must expose target, scope, findings, and not-checked sections
3. every summary must preserve uncertainty and skipped coverage instead of flattening it away
4. no marketing or UI copy may describe SlopPass as a certification, correctness proof, or guarantee

## Recommended next step
When Chunk 2 is approved, the next implementation slice should wire the disclaimer banner and output-shape requirements into the first SlopPass result surface before broader marketplace packaging or automation work proceeds.

# SlopPass Product Brief

SlopPass is UnClick's scoped review layer for sloppy code and risky AI-generated output. It does not certify correctness. It collects evidence-backed static signals, states exactly what was checked, and leaves unknown runtime paths as unknown.

## Chunk 1

Chunk 1 is a fixture-only package scaffold. It focuses on deterministic source text checks that can run without executing untrusted code, crawling production, calling paid APIs, reading credentials, or writing production rows.

The first smell library covers:

- Placeholder logic that still needs implementation.
- Broad type bypasses such as `any` and TypeScript suppression comments.
- Dynamic code execution such as `eval` and `new Function`.
- Secret-looking literals with redacted evidence.
- Catch-all fallback paths that hide failure.
- Reliability wording that needs evidence, such as retry and wrapper claims.
- Generated-copy markers that need human review.

## Verdict Shape

Each report includes the target, inspected files, attempted checks, not-checked areas, evidence-backed findings, severity counts, and a verdict. Critical or high signals fail the fixture report. Medium, low, or info signals warn. No findings pass within the inspected fixture scope.

## Boundaries

SlopPass must not execute customer code, inspect private repositories without permission, print secrets, use paid providers by default, or imply a quality guarantee. Later chunks can connect shared scanner output and richer review hats, but chunk 1 stays self-contained and safe.

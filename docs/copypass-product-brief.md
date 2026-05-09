# CopyPass Product Brief

CopyPass is a fixture-first product-copy review pass for UnClick. It flags copy that is unclear, overconfident, stale, or missing a direct next action before the wording reaches a public surface.

## First Slice

- Run only on caller-provided fixture text.
- Detect vague hero language, missing CTAs, missing trust signals, unsupported superiority claims, placeholder copy, and risky guarantee language.
- Return a structured advisory verdict pack with findings, evidence, not-checked boundaries, and disclaimers.
- Avoid paid model calls, production crawls, private customer copy, live analytics writes, migrations, scheduled jobs, and production test rows.

## Product Guardrails

CopyPass is advisory. It does not promise legal, compliance, revenue, ranking, conversion, accessibility, or safety outcomes. Its job is to make the next human copy review sharper and easier to audit.

## Future Fit

The package is intentionally small so it can later consume shared scanner output from the Pass family without coupling this first slice to GEOPass, SEOPass, FlowPass, LegalPass, SlopPass, UXPass, SecurityPass, or TestPass internals.

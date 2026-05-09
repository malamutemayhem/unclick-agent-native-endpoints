# GEOPass Product Brief

GEOPass is the Pass family product for generative-engine readiness. It diagnoses how prepared a public website is to be understood, cited, and represented by AI answer engines such as ChatGPT, Claude, Perplexity, Gemini, Copilot, Grok, and Meta AI.

GEOPass does not promise rankings or citations. The correct promise is readiness: surface public gaps, explain why they matter, and give the user practical next steps that may increase the likelihood of accurate AI discovery.

## Chunk 1 Scope

This first scaffold creates a package-level contract only. It defines report, check, finding, evidence, severity, verdict, engine, bot, and cross-pass signal shapes. It also adds a scanner plan that documents the future shared scanner stack without running crawlers, using paid APIs, reading credentials, or writing production data.

The v0 diagnostic hats are:

- AI bot crawlability matrix across GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Bingbot, Twitterbot, and FacebookBot.
- llms.txt presence and quality.
- schema.org citation-grade validation.
- Brand mention readiness across the seven answer engines.
- Wikidata presence.
- Common Crawl presence.
- Aggregate AI engine readiness score.

## Shared Scanner Relationship

GEOPass owns the shared scanner contract for the Pass family. SEOPass should become a thin verdict pack on top of this package, reusing the same evidence and report language where possible. FlowPass, LegalPass, SlopPass, and UXPass can consume `cross_pass_signals` without each inventing a second scanner shape.

## Safety Rules

- No guaranteed citations, guaranteed rankings, or rank-one language.
- No live crawler execution in this scaffold.
- No paid API calls.
- No credentials, auth, billing, domains, migrations, or production database writes.
- Source-linked public evidence only.

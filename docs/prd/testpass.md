# PRD: TestPass

**Status**: Shipped. Phase 9A visual run UI live. GitHub Action wired. Anti-stomp pack published.
**Last updated**: 2026-04-25.

## Problem statement

MCP servers are easy to ship and hard to trust. A user who installs a tool has no guarantee that its endpoints match its documentation, that it handles bad input gracefully, that it respects rate limits, or that it behaves predictably under load. The MCP spec does not mandate compliance; every server is whatever the developer wrote.

A marketplace without a compliance bar is a malware distribution system. A QA runner that proves basic correctness before a tool reaches users is a prerequisite for opening the marketplace doors.

## Target user

- **Developers submitting tools to the UnClick marketplace.** TestPass is the gate; submissions must pass.
- **Developers building MCP servers in general.** TestPass is released as a standalone package. Any MCP server author can run it in CI regardless of whether they intend to list with UnClick.
- **UnClick internal QA.** We run TestPass against every first-party tool before catalog changes ship.

## Core capabilities

1. **YAML test packs.** Packs declare probes against MCP server endpoints: expected input, expected output, timeout, repeat count. Human-readable, version-controlled, reviewable.
2. **Probe runner.** Executes the pack against a live MCP server (local or remote). Records pass, fail, skip, timeout per probe.
3. **Compliance reports.** Machine-readable JSON plus human-readable markdown. Designed for PR comments and CI output.
4. **Anti-stomp pack.** Detects tools that overwrite or inject into the user's memory without consent. A known class of misbehaviour by non-UnClick MCP servers; the anti-stomp pack is how we guard our users.
5. **GitHub Action.** `testpass-pr-check.yml` runs TestPass on every PR touching tool wiring. The check is required on `main`.
6. **Visual run UI.** Phase 9A shipped a live run page (`/admin/testpass`) with idiot-proof pack catalog and a wizard. Non-developer users can kick off a run against their own tools and see results without leaving the browser.

## Success metrics

- **First-party tool coverage.** Percentage of wired UnClick tools with a passing TestPass run per release. Target 100 percent.
- **Third-party submission pass rate.** For the eventual marketplace: percentage of submissions that pass first try. Low numbers here mean the bar is unclear; high numbers mean the developer experience is healthy.
- **Mean time to first successful run.** From `testpass init` to first passing probe. Target under five minutes for a developer.
- **Anti-stomp detections per month.** Detections of tools trying to tamper with memory. Zero is the target; non-zero is the justification for the pack.

## Out-of-scope

- **We do not run security fuzzing.** TestPass proves declared behaviour; it does not probe for injection, auth bypasses, or timing attacks. That is a security scan, not a compliance run.
- **We do not certify tool usefulness.** A tool can pass TestPass and still be worthless. Compliance is not quality.
- **We do not guarantee market fitness.** Passing tools appear in the marketplace; marketplace curation is a separate product surface.
- **We do not host the MCP servers under test.** TestPass connects to a server the developer supplies.

## Key decisions and why

- **YAML packs, not code.** Tests are config, reviewable by non-developers, diffable in PRs. Anyone comfortable with a compose file can write or audit a pack.
- **Standalone npm package.** `packages/testpass/` is independently installable. A developer who never uses UnClick can still run our compliance suite. This also makes it trivial to open-source if we choose.
- **Anti-stomp as a first-class pack.** The cross-tenant memory-tampering risk is real (see `docs/security/threat-model.md` UC-4). Anti-stomp is the structural defence that lets users install third-party MCP tools without UnClick losing control of their memory.
- **GitHub Action over homegrown CI.** We live on GitHub. TestPass feedback appears where developers already work: in the PR.
- **Visual run UI in addition to CLI.** Developers use CLI; users of the platform need a GUI. The Phase 9A run page lets a non-developer tenant verify a tool they installed without opening a terminal.

## Platform philosophy alignment

- **Idiot-proof UX.** The admin run page lists packs as cards, the wizard walks through pack selection and target server input. A non-developer can run TestPass on a tool they installed and get a clear pass or fail.
- **Subscription-based (no LLM billing).** TestPass does not call LLMs. It is deterministic probing against MCP servers. No token spend passes through UnClick.
- **MCP-first.** TestPass is the compliance floor for MCP servers. By design it speaks MCP and nothing else. Every UnClick tool and every third-party submission is validated against its MCP contract.

# ADR-0009: Path 3 Vibe Kanban routing for multi-chunk code work

**Status**: Accepted
**Date**: 2026-04-25
**Supersedes/Extends**: None

## Context

AI coding work happens in three size classes. Small fixes are one line, one file, one turn: a typo, a renamed variable, a missing null check. Medium tasks are a few files, a few turns, but still a single focused session: add a new API endpoint, wire a new MCP tool. Large tasks span many turns, touch many files, may hit dead ends, and need rollback: refactor the auth pipeline, build a new product pillar. Treating all three the same is a source of repeated mistakes. Small fixes done in a full worktree waste setup time. Large tasks done in a direct chat overflow context and corrupt earlier work with no rollback path.

Three routing paths have evolved. Path 1: `@claude` comments on GitHub issues or PRs, for small in-place fixes. Path 2: direct courier session, for medium tasks where the full context fits. Path 3: Vibe Kanban (VK), which creates an isolated worktree branch and enforces a mandatory PR completion protocol, for multi-chunk work.

## Decision

Code tasks longer than a single chat turn are routed through Vibe Kanban as isolated worktrees with mandatory PR completion protocol. The cloud repo is the source of truth; the VK worktree is scratch space. Every task completes with a PR against `main` (or a feature branch), never a direct commit. Path 1 and Path 2 remain available for their respective size classes; Path 3 is the default for anything that does not fit Path 1 or Path 2 cleanly.

Practical rules:
- A VK worktree is ephemeral. If the work succeeds, the PR merges and the worktree is discarded. If it fails, the branch is deleted.
- No VK agent pushes to `main` directly. Completion means "PR opened and URL reported."
- The harness enforces the completion protocol. An agent that tries to call work done without a PR URL has not completed the task.

## Consequences

**Benefits:**
- Multi-chunk work has isolation. A failed experiment does not contaminate `main` or earlier sessions.
- PR review is mandatory. A human sees every significant change before it lands.
- Context windows are cleaner. The VK worktree starts from repo HEAD, not from a chat that has drifted over hours.
- Rollback is a branch delete. No post-hoc surgery on `main`.

**Drawbacks / trade-offs:**
- VK setup is a small overhead for tasks that turn out to be smaller than they looked.
- Multiple VK worktrees for the same product can diverge. Coordinated PRs may require rebases.
- The harness must faithfully enforce PR-on-completion, or the benefit evaporates. Tooling correctness is a load-bearing assumption.

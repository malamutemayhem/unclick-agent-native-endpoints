# PRD: Agents (Build Desk)

**Status**: Shipped through Phase 5. Multi-backend worker support live.
**Last updated**: 2026-04-25.

## Problem statement

A user who wants a coding task done has to choose a harness (Claude Code, Codex, Cursor, Gemini CLI), paste context into it, shepherd it through the work, and then track what it produced. Every harness is its own silo: different repo state, different context, different output format. A user who wants to use more than one is running three or four dashboards at once.

Build Desk is the single orchestration surface: one desk, many engines. A user creates a task, picks a worker backend, and watches progress. Context and credentials come from UnClick. The harness is an interchangeable runtime.

## Target user

- **Solo developers and small teams.** People who code daily and want to route work across whichever AI coder is best for the job today.
- **Non-developer tenants running code-adjacent work.** A marketer who wants a one-off script. An operator who wants a data export. Build Desk turns code-based work into a task they can delegate.
- **Power users orchestrating multi-worker workflows.** The same user who composes Crews for writing can compose worker fleets for code.

## Core capabilities

1. **Task registry.** `build_tasks` table stores user-created tasks with title, description, status, assigned worker, and a link to the resulting PR or artifact. Status moves through todo, in-progress, review, done.
2. **Worker registry.** `build_workers` captures every coder backend the tenant has registered: Claude Code, Codex, Cursor, Gemini CLI. Each worker has a health check and last-seen timestamp.
3. **Dispatch events.** `build_dispatch_events` records every task handoff: when, to which worker, with what context, and what came back. Audit trail and debugging surface in one.
4. **Multi-backend support.** Workers are pluggable. Adding a new backend is a registration entry plus a dispatch adapter; the UI treats all backends uniformly.
5. **Task composer UI.** `src/pages/BuildDesk.tsx` provides the card-based task composer. Non-developers can file a task and pick a worker without writing a prompt.
6. **Integration with Crews and Memory.** A Build Desk task can include facts, library docs, or a crew run as context. The worker starts with the tenant's shared knowledge, not a blank slate.

## Success metrics

- **Tasks completed per active tenant per week.** Primary adoption metric.
- **Workers registered per tenant.** A tenant running multiple backends is using the desk as designed.
- **Worker health SLO.** Percentage of registered workers passing health check at any moment. Dormant workers are acceptable; unhealthy workers are a UX failure.
- **Dispatch success rate.** Percentage of dispatches that return a valid result. Low rates indicate backend or context issues.
- **Average task turnaround.** Time from created to done. Signals whether the orchestration is saving the user time.

## Out-of-scope

- **We do not embed a code editor.** Workers are external harnesses. Build Desk is the orchestration surface, not an IDE.
- **We do not ship our own coding agent.** Backends are third-party. UnClick stays in the orchestration lane. See [ADR-0003](../adr/0003-stripe-model-not-windows.md).
- **We do not auto-merge PRs from workers.** Completed tasks raise a PR; the human reviews and merges. No silent writes to `main`.
- **We do not store the worker's API keys beyond what BackstagePass holds.** Credentials used by a worker flow through BackstagePass; Build Desk does not duplicate them.

## Key decisions and why

- **Worker registry instead of hardcoded backend list.** Tenants run whatever harness they prefer. Hardcoding `backends = ["claude-code", "cursor"]` would freeze the product against the user's environment.
- **`build_dispatch_events` as audit and debug.** Multi-backend orchestration fails in creative ways. An event log per dispatch is the only way to investigate a bad handoff.
- **PR-gated completion.** Workers never push to `main` directly. Every task outcome is a PR against a branch the user can review. This mirrors Path 3 Vibe Kanban routing. See [ADR-0009](../adr/0009-path-3-vibe-kanban-routing.md).
- **Context comes from UnClick, not the worker.** Memory facts, library docs, credentials all travel with the task. A Codex worker with the user's memory is a different product from a Codex worker without it.
- **No RLS on `build_*` tables today.** Documented in `docs/security/current-posture.md` as a known gap. Scoping is enforced at the service layer; RLS is planned in Phase 3 security work.

## Platform philosophy alignment

- **Idiot-proof UX.** The task card asks for title, description, and worker choice. Three inputs. A user filing a task does not see a prompt template, tool list, or context wiring.
- **Subscription-based (no LLM billing).** Workers burn the user's own AI subscription. A Claude Code worker spends against the user's Anthropic bill, not UnClick's. The platform tier covers the orchestration layer itself.
- **MCP-first.** Build Desk exposes task create, dispatch, and status via `unclick_call`. An agent can file its own task, watch it complete, and act on the outcome. The web UI is for humans; agents reach the desk through MCP.

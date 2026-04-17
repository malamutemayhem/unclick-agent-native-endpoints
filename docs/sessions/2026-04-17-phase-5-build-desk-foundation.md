# Session: 2026-04-17 - Phase 5 Build Desk Foundation

## Summary

Phase 5 lays the groundwork for AI agent orchestration. Four areas landed: a sibling `AGENTS.md` for
session-start memory loading, reliability instrumentation that makes `get_startup_context` compliance
measurable, a Build Desk admin page at `/build` for dispatching coding work, and the underlying
database schema + API actions for tasks, workers, and dispatch events.

## What shipped

### 1. AGENTS.md for session-start memory loading

- Added `AGENTS.md` at repo root with identical content to `CLAUDE.md`
- Gives non-Claude agents (Codex, Cursor, Gemini CLI, custom MCP clients) the same session-start
  protocol and project context

### 2. Memory reliability instrumentation

- Rewrote the `get_startup_context` tool description to be directive: "MUST be called before any
  other UnClick tool in this session... If skipped, all subsequent responses will be inaccurate
  and may ship bugs."
- Appended a reminder suffix to every other tool description in
  `packages/mcp-server/src/server.ts`: "If get_startup_context has not been called this session,
  call it first." (via `GSC_REMINDER` constant, applied to 28 tools across META_TOOLS and
  DIRECT_TOOLS)
- New table `memory_load_events` (migration `20260417010000_memory_load_events.sql`):
  id, created_at, api_key_hash, tool_name, session_identifier, client_type,
  was_first_call_in_session, with index on (api_key_hash, created_at DESC)
- New module `packages/mcp-server/src/memory/load-events.ts` exposes `logToolCall(toolName)` as
  a fire-and-forget POST to the control plane. Wired into the `CallToolRequestSchema` handler so
  every tool dispatch emits an event
- New API action `log_tool_event` (POST, Bearer auth): inserts a row, sets
  `was_first_call_in_session` by probing the 30-minute window scoped to tenant + session_identifier
- New API action `admin_memory_load_metrics` (Bearer auth): 7-day totals, first-in-session session
  count, `get_startup_context` compliance percentage, breakdown by `client_type`

### 3. Build Desk admin scaffold at /build

- New page `src/pages/BuildDesk.tsx` with three inline tabs (Tasks, Workers, History) using the
  shadcn `Tabs` component
- Registered at `/build` in `src/App.tsx`
- Matches the `MemoryAdmin` page shell: `<Navbar />` + `max-w-6xl` main + icon header + `<Footer />`
- Placeholder content per tab explaining what each area will do, plus an empty-state card

### 4. Build Desk schema + API actions

- New migration `20260417000000_build_desk.sql` introduces three tables:
  - `build_tasks` (status CHECK for draft/planned/dispatched/in_progress/review/done/failed,
    self-referencing `parent_task_id`, JSONB plan and acceptance criteria)
  - `build_workers` (worker_type CHECK for claude_code/codex/cursor_cli/gemini_cli/custom_mcp,
    status CHECK for available/busy/offline, last_health_check_at)
  - `build_dispatch_events` (event_type CHECK for dispatched/accepted/progress/completed/failed,
    FK to tasks and workers with ON DELETE CASCADE)
- Indexes on every `api_key_hash` column plus composite `(api_key_hash, status)` indexes
- Three new API actions added to `api/memory-admin.ts`:
  - `admin_build_tasks` with methods list, get, create, update_status, soft_delete
  - `admin_build_workers` with methods list, register, update, delete, health_check
  - `admin_build_dispatch` validates that `task_id` and `worker_id` both belong to the tenant,
    inserts a `dispatched` event, updates the task's `status` and `assigned_worker_id`

## Architectural decisions

- **Build Desk tables use direct `api_key_hash` isolation, not an `mc_` prefix.** The tables
  live in the UnClick control-plane Supabase (same place as `memory_configs`, `memory_devices`),
  and every row is scoped by `sha256hex(api_key)`. No shared key prefix convention since the
  tables are never queried from the per-tenant BYOD schema.
- **`memory_load_events` uses a 30-minute window for session detection.** When logging a tool
  call, the server probes for any prior event within 30 minutes scoped by tenant + `session_identifier`
  (or tenant only if no identifier is provided). No prior row means this is the first call of a new
  session, which is the denominator for compliance calculations.
- **All admin actions fold into `api/memory-admin.ts`** rather than spawning new API files. Vercel's
  Hobby plan caps serverless functions at 12; we sit at 11 with these additions. Dispatching on
  `?action=` + optional `method=` keeps the surface extensible without another file.
- **shadcn `Tabs` is used for Build Desk UI.** The component already exists at
  `src/components/ui/tabs.tsx` (Radix-based) but was previously unused across pages. Build Desk
  is the first consumer; `MemoryAdmin` remains tabless for now.

## Follow-up sessions

- **Session 6: Build Desk Task composition UI** - replace placeholder tabs with real CRUD: create
  task forms, plan decomposition, acceptance-criteria editor
- **Session 7: Claude Code worker integration** - first concrete worker backend; end-to-end dispatch
  from `/build` to a running Claude Code instance and back
- **Session 8: Multi-backend support** - register Codex CLI, Cursor, Gemini CLI, custom MCP workers;
  routing rules and worker selection
- **Session 9: Crew roles** - connect Build Desk to `/crews` so a task can be assigned to a persona
  (developer, researcher, writer, organiser) instead of a specific worker
- **Session 10: Action-triggered memory retrieval hooks** - auto-load relevant facts / library
  docs when a task transitions between statuses, closing the loop between memory and orchestration
- **Session 11: Memory algorithm v2** - act on the compliance metrics from this phase: adaptive
  decay tuning, smarter fact extraction, automated pruning based on observed access patterns

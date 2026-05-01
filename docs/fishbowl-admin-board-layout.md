# Fishbowl Admin Board Layout

This spec defines the target layout for the Fishbowl admin board. It is UX-only. It does not require schema, API, auth, migration, or routing changes.

## Goal

Fishbowl should make the worker fleet readable at a glance.

The admin board should answer five questions quickly:

1. Who is active right now?
2. What needs action?
3. What is blocked?
4. What changed recently?
5. Which ideas are worth promoting?

## Current Ground Truth

The current Fishbowl admin surface already has these pieces:

- Now Playing worker strip in `src/pages/admin/Fishbowl.tsx`.
- Message feed with threads and recipients.
- Todos board in `src/pages/admin/fishbowl/Todos.tsx`.
- Ideas board in `src/pages/admin/fishbowl/Ideas.tsx`.
- Comments component shared by Todos and Ideas.
- Settings panel in `src/pages/admin/fishbowl/Settings.tsx`.
- Profile clustering in `src/pages/admin/fishbowl/clusterProfiles.ts`.

This spec should guide layout changes around those existing pieces. Do not rebuild the substrate.

## First View

The first viewport should be an operational board, not an explainer page.

Recommended order:

1. Header with room name, refresh state, and compact action buttons.
2. Now Playing worker strip.
3. Action lane with blockers, direct handoffs, and overdue check-ins.
4. Work board with Todos and PR-related handoffs.
5. Ideas council.
6. Message feed.
7. Settings and explanation panels.

Explainers should be collapsed by default after the user has seen them once.

## Layout

Desktop layout:

- Top band: header and health summary.
- Second band: Now Playing worker strip.
- Main grid:
  - Left column: Action lane.
  - Middle column: Todos board.
  - Right column: Ideas council and recent decisions.
- Bottom or secondary tab: full message feed.

Mobile layout:

- Header.
- Now Playing worker strip.
- Segmented tabs:
  - Action
  - Todos
  - Ideas
  - Feed
  - Settings
- No horizontal overflow.
- Cards must not resize the board when status text changes.

## Action Lane

The action lane is the most important part of the page.

Show these first:

- Direct handoffs addressed to a worker.
- Blockers that need Chris.
- Missed `next_checkin_at`.
- WakePass dispatches with no ACK.
- PRs that are green and ready for review.
- Todos assigned to cold or inactive workers.

Do not show:

- Successful heartbeats.
- Quiet health checks.
- Green-check echoes that require no worker action.
- Old chatter with no open action.

Every action card should show:

- Owner.
- Source.
- Age.
- Next expected action.
- Blocker, if any.
- Linked PR, todo, idea, wake event, or message thread.

## Worker Strip

The worker strip should be dense and scannable.

Each worker chip should show:

- Emoji and display name.
- Current status.
- Last seen.
- Next check-in.
- State: active, idle, MIA, blocked, or stale alias.

Rules:

- Hide stale idle duplicate profiles after the existing stale-idle window.
- Keep MIA rows visible while they are still operationally useful.
- Group stale aliases under the current primary profile.
- Do not let long status text expand chip height unpredictably.

## Todos Board

Todos should be treated as executable work, not a chat archive.

Columns:

- Open.
- In progress.
- Done.
- Dropped, hidden behind a filter by default.

Useful filters:

- Priority.
- Assignee.
- Stale.
- Linked PR.
- Blocked.
- No owner.

Cards should show:

- Title.
- Priority.
- Status.
- Assignee.
- Age.
- Comment count.
- Linked PR or source idea when present.

Safe actions:

- Add todo.
- Comment.
- Mark done with evidence.
- Drop as obsolete with evidence.
- Reassign.

Do not add bulk delete as a primary action.

## Ideas Council

Ideas are for continuous improvement and discussion before work is ready.

The Ideas panel should encourage participation without making noise.

Recommended lanes:

- Proposed.
- Voting.
- Locked.
- Parked.
- Rejected, hidden by default.

Idea cards should show:

- Title.
- Score.
- Vote buttons.
- Status.
- Recent comment count.
- Promote-to-todo action when locked.

Good idea prompts:

- What would reduce manual Chris work?
- What would prevent a silent failure?
- What would improve dogfood proof?
- What would make Connectors or RotatePass less confusing?

## Message Feed

The message feed is the audit trail, not the primary work board.

Default feed should prioritize:

- Direct mentions.
- Handoffs.
- Blockers.
- Done posts.
- Decision posts.

Healthy no-change cycles should not appear as new visual noise.

Thread replies should stay grouped. Long status dumps should be collapsible.

## Visual Rules

- Keep the UI dense and operational.
- Use compact cards for repeated work items.
- Do not nest cards inside cards.
- Avoid landing-page hero styling.
- Keep text readable on desktop and mobile.
- Use stable dimensions for worker chips, cards, and columns so live status updates do not shift the board.
- Use existing dark admin styling and amber accent.

## Acceptance Criteria

A future implementation should pass these checks:

- Chris can identify active workers and blockers in under 10 seconds.
- A cold worker with assigned work is visible.
- A green PR awaiting review is visible.
- Quiet successful heartbeats do not dominate the board.
- Todos, Ideas, and Messages are clearly separate surfaces.
- The mobile layout works without horizontal scrolling.
- No schema or API change is required for the first implementation slice.

## Suggested First Implementation Slice

Build a read-only Action lane using existing Fishbowl response data.

Scope:

- Add a compact Action lane above Todos.
- Derive cards from existing profiles and messages.
- Show blockers, direct handoffs, missed check-ins, and green-review wakes.
- Keep Todos, Ideas, Settings, and existing feed behavior unchanged.

Non-goals:

- New tables.
- New MCP tools.
- New migrations.
- Bulk todo actions.
- New wake routing behavior.


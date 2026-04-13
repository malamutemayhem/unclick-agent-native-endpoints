# UnClick Memory – Claude Code Session Bridge

You have access to **persistent cross-session memory** via the `unclick-memory` MCP server.
This memory survives between sessions and across platforms (Claude Code, Cowork, Cursor, etc.).

## Session Start Protocol

**At the START of every session**, before doing anything else:

1. Call `get_startup_context` with `num_sessions: 5`
2. Read the returned business context, recent session summaries, and hot facts
3. Use this context to understand the user's ongoing projects, preferences, and open loops
4. Reference relevant context naturally — don't dump it, just use it

## During the Session

Use memory tools as needed:

- **`search_memory`** — when you need to recall something from a previous session
- **`search_facts`** — when checking a specific preference, decision, or piece of knowledge
- **`search_library`** — when looking for reference documents (vendor profiles, specs, etc.)
- **`add_fact`** — when the user states a preference, makes a decision, or shares important info
  - Facts should be atomic: one fact = one statement
  - Good: "Team prefers Tailwind CSS over CSS modules"
  - Bad: "We talked about styling and mentioned several frameworks"
- **`supersede_fact`** — when information changes (old fact → new fact, never delete)
- **`set_business_context`** — for standing rules that should ALWAYS be loaded
- **`upsert_library_doc`** — for longer reference material (briefs, specs, profiles)
- **`store_code`** — for important code blocks you want searchable later
- **`log_conversation`** — for critical exchanges worth preserving verbatim

## Session End Protocol

**Before the session ends** (when the user says goodbye, or context is running low):

1. Call `write_session_summary` with:
   - `session_id`: Use a unique identifier (timestamp or UUID)
   - `summary`: Narrative of what happened — decisions made, work completed, problems solved
   - `topics`: Array of topic tags for searchability
   - `open_loops`: Unfinished tasks, questions, or next steps
   - `platform`: "claude-code" (or appropriate platform)

2. Extract any new facts learned during the session using `add_fact`

## Key Principles

- **Read before you work, write before you leave**
- **Facts are atomic** — one piece of knowledge per fact
- **Supersede, never delete** — when info changes, supersede the old fact
- **Business context is sacred** — standing rules go in Layer 1
- **Session summaries are your handoff notes** — write them like a colleague is picking up tomorrow

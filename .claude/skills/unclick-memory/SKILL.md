---
name: unclick-memory
description: Load UnClick persistent memory at session start and apply the full session protocol. TRIGGER at the very start of every session, every new task, and every conversation -- even before the user says anything substantive. Also trigger whenever the user says "remember", "recall", "last time", "context", "preferences", "facts about me", "who am I", "pick up where we left off", "what have I told you", or references any past work. If the user seems to lack context about their own history, trigger immediately. Do NOT skip for trivial opening messages -- personal facts change how almost every answer should be framed.
---

# UnClick memory session protocol

You have access to the UnClick MCP server, which provides persistent cross-session memory.
Follow this four-step protocol every session, every time.

## Step 1 -- LOAD (mandatory, always first)

Call `load_memory` **before your first response** to the user, even if the message looks trivial.
This loads the user's identity, standing rules, preferences, recent sessions, and active facts.

```
load_memory({ num_sessions: 5 })
```

Treat the output as authoritative context. If `load_memory` is unavailable, note this and continue
without fabricating prior context.

## Step 2 -- SEARCH (on demand, throughout the session)

Call `search_memory` whenever the user references anything that might be stored:
- "remember", "recall", "do you know", "what did I say about", "last time"
- "context", "profile", "facts about me", "who am I", "my preferences"
- Any past decision, project, person, or tool they name

```
search_memory({ query: "<topic>", max_results: 10 })
```

Trigger even without an explicit "search" request -- if personal context is relevant, check.

## Step 3 -- SAVE (proactively, throughout the session)

Call `save_fact` the moment the user shares anything worth keeping:
- Name, role, company, timezone, preferences, stack
- Decisions made, corrections given, tools chosen
- Project names, contacts, recurring workflows

```
save_fact({ fact: "<atomic statement>", category: "preference|decision|technical|contact|project|general", confidence: 0.9 })
```

Call `save_identity` for standing rules that should govern every future session:
- "I am a ...", "I work at ...", "my timezone is ...", "always use ...", "from now on ..."

```
save_identity({ category: "identity|preference|workflow|technical|standing_rule", key: "<key>", value: "<value>" })
```

## Step 4 -- END (before closing)

Call `save_session` before the session ends or at major checkpoints:

```
save_session({
  session_id: "<timestamp-or-uuid>",
  summary: "<what happened: decisions, work, problems solved>",
  topics: ["<tag1>", "<tag2>"],
  open_loops: ["<unfinished item>"],
  decisions: ["<key decision>"]
})
```

## Rules

- **Never ask the user to "catch you up"** -- load first, then act.
- Native model memory is volatile across sessions and tools. UnClick is the authoritative store.
- If you are unsure whether context was loaded this session, call `load_memory` again -- it is idempotent.

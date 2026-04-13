# @unclick/memory-mcp

Persistent cross-session memory for AI agents. An MCP server that gives Claude Code, Cursor, and any MCP client a 6-layer memory architecture.

**Zero-config local mode** - works out of the box, no database needed.
**Supabase cloud mode** - sync across machines with your own database.

## Quick Start (Local Mode - 30 seconds)

Add to your MCP config and you're done. No accounts, no keys, no database.

### Claude Code

Add to `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "unclick-memory": {
      "command": "npx",
      "args": ["-y", "@unclick/memory-mcp"]
    }
  }
}
```

### Claude Desktop

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "unclick-memory": {
      "command": "npx",
      "args": ["-y", "@unclick/memory-mcp"]
    }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "unclick-memory": {
      "command": "npx",
      "args": ["-y", "@unclick/memory-mcp"]
    }
  }
}
```

Restart your AI tool. Memory is now active. Data is stored locally at `~/.unclick/memory/`.

### Setup Wizard (optional)

```bash
npx @unclick/memory-mcp setup
```

Interactive setup that auto-detects your MCP clients and writes the config for you.

## Upgrade to Supabase Cloud

For cross-machine sync, team sharing, or backup, connect your own Supabase project:

1. Create a free project at [supabase.com](https://supabase.com)
2. Run `schema.sql` in your Supabase SQL Editor
3. Update your MCP config:

```json
{
  "mcpServers": {
    "unclick-memory": {
      "command": "npx",
      "args": ["-y", "@unclick/memory-mcp"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key"
      }
    }
  }
}
```

Your data lives in YOUR Supabase. UnClick never sees it.

## Enable the Session Bridge

Copy `CLAUDE.md` to your project root or `~/.claude/CLAUDE.md`. This teaches the agent to:

- Load memory at session start (`get_startup_context`)
- Store important facts during the session (`add_fact`)
- Write a summary before the session ends (`write_session_summary`)

This is what makes memory work across sessions. Without it, the agent has the tools but won't use them automatically.

## Memory Layers

| Layer | Name | Purpose | Loaded at startup? |
|-------|------|---------|-------------------|
| 1 | Business Context | Standing rules, preferences, client info | Yes |
| 2 | Knowledge Library | Versioned reference docs (briefs, specs, CVs) | Index only |
| 3 | Session Summaries | One per session - decisions, open loops | Last 5 |
| 4 | Extracted Facts | Atomic searchable knowledge | Hot facts |
| 5 | Conversation Log | Full verbatim history | No - search only |
| 6 | Code Dumps | Language-tagged code blocks | No - on demand |

## MCP Tools (17)

| Tool | Description |
|------|-------------|
| `get_startup_context` | Load business context + recent sessions + hot facts |
| `search_memory` | Full-text search across conversation logs |
| `search_facts` | Search extracted facts |
| `search_library` | Search knowledge library docs |
| `get_library_doc` | Get a specific library document by slug |
| `list_library` | List all library documents |
| `write_session_summary` | Save end-of-session summary |
| `add_fact` | Add an atomic fact to memory |
| `supersede_fact` | Replace an outdated fact (never deletes) |
| `log_conversation` | Log a message to conversation history |
| `store_code` | Store a code block |
| `get_business_context` | Get all business context entries |
| `set_business_context` | Add/update a business context entry |
| `upsert_library_doc` | Create/update a library document |
| `manage_decay` | Run memory decay management |
| `get_conversation_detail` | Get full conversation for a session |
| `memory_status` | Overview of memory usage and stats |

## How It Works

**Session Start:** Agent calls `get_startup_context` - loads standing rules, recent session summaries, and hot facts.

**During Session:** Agent uses `add_fact`, `search_memory`, `set_business_context` etc. as needed.

**Session End:** Agent calls `write_session_summary` - next session picks up where this one left off.

## Storage Modes

| Mode | Trigger | Data location | Best for |
|------|---------|---------------|----------|
| Local | Default (no env vars) | `~/.unclick/memory/` | Solo use, getting started |
| Supabase | Set `SUPABASE_URL` | Your Supabase project | Teams, cross-machine sync |

## Decay Management

Memory uses a hot/warm/cold tier system. Recent and frequently accessed items stay "hot" (loaded at startup). Older items decay to "warm" then "cold" based on access patterns. Nothing is ever deleted - cold items are still searchable, just not auto-loaded.

## License

MIT

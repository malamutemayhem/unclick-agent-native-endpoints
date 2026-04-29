# @unclick/mcp-server

**The app store for AI agents.** [unclick.world](https://unclick.world)

450+ callable endpoints across 172+ tools, available to any MCP-compatible AI client. New tools ship to the API continuously. Your agent picks them up automatically; no package update is needed.
<!-- Update counts from src/config/site-stats.ts -->

## Install

**Using `npx` (no installation required):**
```json
{
  "mcpServers": {
    "unclick": {
      "command": "npx",
      "args": ["@unclick/mcp-server"]
    }
  }
}
```

Add this to your `claude_desktop_config.json` (or equivalent for Cursor, Windsurf, etc).

**Or install globally:**
```bash
npm install -g @unclick/mcp-server
```

## Operational Notes

This repo follows the AGENTS.md fence rules for agent work.

## What it does

Gives your agent access to a growing catalog of tools across developer utilities, social media, e-commerce, finance, messaging, media, security, and more. You don't need to install separate packages for each integration. One server provides access to everything in the catalog.

## Tool Surface

UnClick exposes a small direct surface for daily agent workflows, plus hidden internal discovery tools for the full catalog.

| Tool group | Tools |
|------------|-------|
| Memory session protocol | `load_memory`, `save_fact`, `search_memory`, `save_identity`, `save_session` |
| Signals and Fishbowl coordination | `check_signals`, `read_messages`, `post_message`, `create_todo`, `list_todos`, `update_todo`, `complete_todo`, `create_idea`, `list_ideas`, `vote_on_idea`, `promote_idea_to_todo` |
| Hidden internal catalog tools | `unclick_search`, `unclick_browse`, `unclick_tool_info`, `unclick_call` |

The agent starts with memory, uses direct Fishbowl tools for coordination, and can still call the hidden catalog tools by name when it needs dynamic endpoint discovery.

## Requirements

- Node.js 18+
- An API key from [unclick.world](https://unclick.world)

Set your key as an environment variable:
```bash
UNCLICK_API_KEY=your_key_here
```

Or pass it via the MCP config:
```json
{
  "mcpServers": {
    "unclick": {
      "command": "npx",
      "args": ["@unclick/mcp-server"],
      "env": {
        "UNCLICK_API_KEY": "your_key_here"
      }
    }
  }
}
```

## More

Full catalog, docs, and API keys at [unclick.world](https://unclick.world).

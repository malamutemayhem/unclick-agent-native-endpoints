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

## What it does

Gives your agent access to a growing catalog of tools across developer utilities, social media, e-commerce, finance, messaging, media, security, and more. You don't need to install separate packages for each integration. One server provides access to everything in the catalog.

## The 3 tools

| Tool | What it does |
|------|-------------|
| `unclick_search` | Search the catalog by keyword or category |
| `unclick_tool_info` | Get the full schema and parameters for a specific tool |
| `unclick_call` | Call any tool in the catalog |

The agent searches for what it needs, checks the schema, and then calls the tool. Discovery is built into the workflow.

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

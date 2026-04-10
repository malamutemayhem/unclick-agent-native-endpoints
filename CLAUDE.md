# UnClick

AI agent tool marketplace. One npm install gives agents access to 450+ callable endpoints across 60+ integrations via the MCP protocol.

## Monorepo structure

```
packages/mcp-server/   # npm package (@unclick/mcp-server) published to npm
src/                   # React website (Vite + TypeScript)
api/                   # Vercel serverless functions (REST API endpoints)
```

## Key files

| File | Purpose |
|------|---------|
| `packages/mcp-server/src/server.ts` | MCP server entrypoint, registers the 4 meta-tools |
| `packages/mcp-server/src/tool-wiring.ts` | Maps tool names to API calls |
| `src/pages/tools/Tools.tsx` | Website tools grid, one tile per integration |

## The 4 meta-tools architecture

Rather than exposing every endpoint as an MCP tool, UnClick exposes 4 meta-tools that let agents discover and call anything dynamically:

- `unclick_search` - find tools by keyword
- `unclick_browse` - list all tools, optionally by category
- `unclick_tool_info` - get endpoints and params for a specific tool
- `unclick_call` - execute any endpoint with parameters

## Adding a new tool

1. Create `api/*-tool.ts` with the Vercel handler and endpoint logic
2. Wire it in `packages/mcp-server/src/tool-wiring.ts` (add name, description, category, and endpoint mapping)
3. Add a tile in `src/pages/tools/Tools.tsx`

## Style rules

- No em dashes anywhere in code or content (use a regular dash or restructure the sentence)
- No per-tool MCP registrations (everything goes through the 4 meta-tools)

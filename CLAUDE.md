# UnClick

AI agent operating system. One npm install gives agents access to 450+ callable endpoints across 60+ integrations AND persistent cross-session memory, all via the MCP protocol.

## Monorepo structure

```
packages/mcp-server/            # THE npm package (@unclick/mcp-server) - published to npm
packages/mcp-server/src/memory/ # Built-in memory module (6-layer architecture)
packages/memory-mcp/            # DEPRECATED standalone package (kept for reference)
src/                            # React website (Vite + TypeScript)
api/                            # Vercel serverless functions (REST API endpoints)
```

## Key files

| File | Purpose |
|------|---------|
| `packages/mcp-server/src/server.ts` | MCP server entrypoint, registers meta-tools + 5 direct memory tools |
| `packages/mcp-server/src/tool-wiring.ts` | Maps tool names to API calls |
| `packages/mcp-server/src/memory/handlers.ts` | Memory operation dispatcher (all 17 ops) |
| `packages/mcp-server/src/memory/db.ts` | Backend factory (local JSON or Supabase) |
| `src/pages/tools/Tools.tsx` | Website tools grid, one tile per integration |

## Architecture

**4 meta-tools** let agents discover and call anything dynamically:

- `unclick_search` - find tools by keyword
- `unclick_browse` - list all tools, optionally by category
- `unclick_tool_info` - get endpoints and params for a specific tool
- `unclick_call` - execute any endpoint with parameters (including `memory.*`)

**5 direct memory tools** expose the session protocol agents should follow:

- `get_startup_context` - call FIRST in every session
- `write_session_summary` - call BEFORE session ends
- `add_fact` - record preferences, decisions, important info
- `search_memory` - recall anything from prior sessions
- `set_business_context` - set standing rules (always loaded)

The other 12 memory operations (manage_decay, store_code, log_conversation, supersede_fact, upsert_library_doc, etc.) are callable via `unclick_call` with `endpoint_id: "memory.<op>"`.

## Adding a new tool

1. Create `api/*-tool.ts` with the Vercel handler and endpoint logic
2. Wire it in `packages/mcp-server/src/tool-wiring.ts` (add name, description, category, and endpoint mapping)
3. Add a tile in `src/pages/tools/Tools.tsx`

## Style rules

- No em dashes anywhere in code or content (use a regular dash or restructure the sentence)
- No per-tool MCP registrations EXCEPT the 5 direct memory tools (everything else goes through the 4 meta-tools)

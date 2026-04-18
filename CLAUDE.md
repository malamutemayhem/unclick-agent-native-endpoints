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
| `packages/mcp-server/src/server.ts` | MCP server entrypoint, registers the 5 direct memory tools + unclick_search |
| `packages/mcp-server/src/tool-wiring.ts` | Maps tool names to API calls |
| `packages/mcp-server/src/memory/handlers.ts` | Memory operation dispatcher (all 17 ops) |
| `packages/mcp-server/src/memory/db.ts` | Backend factory (local JSON or Supabase) |
| `src/pages/tools/Tools.tsx` | Website tools grid, one tile per integration |

## Architecture

**1 marketplace search tool** lets agents discover additional capabilities:

- `unclick_search` - find tools by keyword

The raw meta-tools (`unclick_browse`, `unclick_tool_info`, `unclick_call`) remain callable but are hidden from the tool list to keep things clean for end users.

**5 direct memory tools** expose the session protocol agents should follow:

- `load_memory` - call FIRST in every session (was `get_startup_context`)
- `save_session` - call BEFORE session ends (was `write_session_summary`)
- `save_fact` - record preferences, decisions, important info (was `add_fact`)
- `search_memory` - recall anything from prior sessions
- `save_identity` - set standing rules, always loaded (was `set_business_context`)

The old tool names still work as aliases for backward compatibility. The other 12 memory operations (manage_decay, store_code, log_conversation, supersede_fact, upsert_library_doc, etc.) are callable via `unclick_call` with `endpoint_id: "memory.<op>"`.

## Adding a new tool

1. Create `api/*-tool.ts` with the Vercel handler and endpoint logic
2. Wire it in `packages/mcp-server/src/tool-wiring.ts` (add name, description, category, and endpoint mapping)
3. Add a tile in `src/pages/tools/Tools.tsx`

## Style rules

- No em dashes anywhere in code or content (use a regular dash or restructure the sentence)
- No per-tool MCP registrations EXCEPT the 5 direct memory tools (everything else goes through the 4 meta-tools)

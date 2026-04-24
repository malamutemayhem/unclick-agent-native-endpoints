# ADR-0001: MCP-first agent protocol

**Status**: Accepted
**Date**: 2026-04-25
**Supersedes/Extends**: None

## Context

Agent-to-tool communication has no dominant standard. OpenAI function calling, LangChain tools, LlamaIndex callbacks, custom REST shims, and the Model Context Protocol (MCP) all compete for the same surface area. UnClick can either try to serve every protocol (thin, fragile) or commit to one and be the best at it. MCP is gaining adoption across Claude Desktop, Cursor, and a growing ecosystem of clients. It is open, versioned, and designed for agent-tool composition from the start.

## Decision

UnClick exposes every capability through MCP. The agent-facing surface is one marketplace search tool (`unclick_search`) plus five direct memory tools (`load_memory`, `save_session`, `save_fact`, `search_memory`, `save_identity`). The raw meta-tools (`unclick_browse`, `unclick_tool_info`, `unclick_call`) remain callable but are hidden from the default tool list for readability. Every other capability, including all 17 memory operations and 450+ wired endpoints, is reachable through `unclick_call` with an `endpoint_id`. No parallel REST-only protocol is maintained as a first-class agent surface. The website and admin shell exist for humans; MCP is the canonical surface for agents.

## Consequences

**Benefits:**
- Single protocol to support, document, and optimise. Deep rather than wide.
- Compatible out of the box with Claude Desktop, Cursor, and every MCP-compliant client.
- Discovery is dynamic. A user can install UnClick and gain 450+ tools without wiring each one into their client config.
- TestPass enforces MCP contracts. Compliance is a known concept.

**Drawbacks / trade-offs:**
- Clients that do not speak MCP cannot reach UnClick without a thin adapter. Today this is an acceptable cost; MCP adoption is trending.
- The meta-tool discovery pattern adds one hop between the agent and the real endpoint. Clients with poor tool-call latency notice.
- Tying ourselves to MCP means we carry its versioning risk. When MCP releases a breaking change, we adopt it; we do not fork.

# ADR-0006: Orchestrator is user chat

**Status**: Accepted
**Date**: 2026-04-25
**Supersedes/Extends**: Extends [ADR-0003](./0003-stripe-model-not-windows.md)

## Context

Many platforms in the agent space build their own chat interface. It is tempting because it is the most visible surface, because every competitor has one, and because users ask for it. But the user already has a chat: Claude Desktop, Cursor, ChatGPT, Gemini, or any MCP-compatible client they have chosen. Building an UnClick chat puts us in direct competition with those clients for the user's primary interface. It also forks the product surface: we would need a chat UI, a model abstraction, a session manager, and a long-form prompting story that other teams at Anthropic, OpenAI, and Cursor employ many people to build.

## Decision

The user's own LLM chat client IS the orchestrator. UnClick does not host a chat interface. Every user-facing interaction starts in their chat of choice and flows through MCP into UnClick's capabilities. The UnClick website and admin shell exist for settings, observability, and management of persistent artefacts (crews, signals, BackstagePass entries). They are not where the user talks to their agent.

## Consequences

**Benefits:**
- We do not compete with Claude Desktop, Cursor, or any other chat. We make all of them better.
- Product scope stays tight. No model abstraction, no session manager, no long-form prompting infrastructure.
- We ship MCP features and every compatible client gets them automatically. Leverage is maximised.
- Users stay in the client they already use. Switching cost to UnClick is zero; the agent they already trust just gains new capabilities.

**Drawbacks / trade-offs:**
- We cede the front-door UX to other vendors. If the chat they use is bad, our tools feel bad by association. We cannot fix that directly.
- Features that genuinely need a chat (like free-form conversation with a crew) are harder to deliver without building one. We route these through MCP tools that emit text the host chat renders.
- Users who want a unified "everything in one place" experience sometimes ask for a chat. We say no consistently.

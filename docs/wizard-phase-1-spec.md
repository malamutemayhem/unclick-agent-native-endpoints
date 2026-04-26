# UnClick Orchestrator Wizard - Phase 1 Spec

Status: Phase 1 (foundation only).
Owner: Bailey reviews and merges. Chris greenlit.
Companion smoke test: `docs/orchestrator-wizard-phase-1-smoke.md`.

## North star

Every UnClick MCP tool, today and forever, callable through a friendly chat.
No raw JSON ever shown to a human. The Wizard is the surface that turns a
tool result into something a non-engineer can read, act on, and trust.

The Wizard is not a new product line. It is one of several rails that
attach to every tool the moment it registers itself with the marketplace.

## Bolt-on rail framing

UnClick has four rails. A tool registers once and lights up on all of them.

| Rail | What it does for the tool |
|---|---|
| Signals | Emits a feed item every time the tool runs so other agents can see what happened. |
| Backup | Persists the tool's relevant outputs into Memory so they survive across sessions. |
| TestPass | Exposes a YAML pack the agent can run to QA the tool end to end. |
| Wizard | Wraps the tool's response in a ConversationalCard so chat surfaces can render it. |

Each rail is opt-in by default and additive. A tool that ignores the
Wizard rail keeps working exactly as it does today; nothing about the
existing response shape is taken away.

## Phase 1 scope

This phase ships the foundations the team can build on. Two pieces:

1. The `ConversationalCard` TypeScript type, in a new `@unclick/wizard`
   workspace package. Types only, no runtime dependencies.
2. One example wrap on `search_memory` proving the shape works end to end
   without breaking the existing response.

Out of scope for Phase 1: the Wizard chat UI, the orchestrator-routed LLM,
and wrapping the rest of the tool catalog.

## Out of scope: Orchestrator-routed LLM (Phase 4)

Today the MCP server pays for LLM calls per request. Every Crews run, every
fact extraction, every blob expansion bills the UnClick API key. That
metered cost grows linearly with adoption and turns every free tier user
into a marginal loss.

The fix is to route those calls through the user's own Orchestrator
(Claude Desktop, ChatGPT, Cursor, anything that supports the MCP sampling
spec). The MCP server stops calling Anthropic directly; instead it sends a
sampling request back through the protocol and the user's client pays for
it. Net cost to the UnClick server drops to zero.

This work depends on every server-side LLM call being moved behind a
sampling-aware abstraction. That work is separate. Phase 1 does not block
on it; the Card layer ships value on its own.

## ConversationalCard - the Phase 1 deliverable

A card lives alongside a tool's existing payload, never inside it. Tools
opt in by accepting an `include_card` flag (or, in later phases, by
defaulting to card-on once consumers are ready).

### Anatomy

```
ConversationalCard
├── title         required   short headline shown in bold at the top
├── summary       required   one or two sentence plain-English summary
├── severity      optional   info | success | warning | error
├── body          optional   ordered list of sections, each one of:
│     ├── text             heading + paragraph
│     ├── list             heading + bullet/ordered items
│     ├── table            heading + columns + rows
│     ├── link             label + href + optional description
│     └── action-button    label + CardAction (tool name + args + confirmation)
├── followUps     optional   suggested next-step labels, each may carry a CardAction
└── meta          optional   small free-form key-value bag for surfaces, not user-visible
```

### Design rules

1. Renderable without a schema lookup. A surface that has never seen the
   calling tool should still produce a usable card.
2. Severity drives icon and color. Default to info if omitted.
3. Body sections render top to bottom in order. Unknown section kinds MUST
   fall back to plain text so future kinds do not break old surfaces.
4. CardAction.confirmation defaults to "confirm". Surfaces ask the user
   before invoking a tool unless explicitly set to "auto".
5. No HTML in any field. Plain text or lightweight markdown only.
6. No em dashes anywhere in card content (project rule).

### Backward compatibility

A tool that wraps its response with a card must not remove fields a caller
already depends on. The recommended pattern is:

```ts
// Before
return results;

// After (opt-in)
if (includeCard) return { results, card };
return results;
```

`include_card` defaults to false in Phase 1. Phase 2 may flip the default
on a tool-by-tool basis once the Wizard surface ships.

### Existing minimal card type

`packages/mcp-server/src/cards/card.ts` already defines a five-field
`ConversationalCard` (`headline`, `summary`, `keyFacts`, `nextActions`,
`deepLink`) used by `crews-tool.ts`. The new `@unclick/wizard`
`ConversationalCard` is a richer superset. Phase 1 leaves the existing
minimal type in place so `crews-tool.ts` keeps working unchanged. Phase 2
proposes to migrate `crews-tool.ts` onto the wizard type and delete the
local one.

## Roadmap

| Phase | Deliverable |
|---|---|
| P1 (this PR) | ConversationalCard type scaffold in @unclick/wizard, one example wrap on search_memory, vitest coverage. |
| P2 | Wrap the top five tools (search_memory always-on, save_fact, save_session, check_signals, list_runs). Migrate crews-tool from the local minimal card. |
| P3 | Ship the Wizard chat UI surface. Renders ConversationalCards from any UnClick MCP tool over a single chat thread. |
| P4 | Orchestrator-routed LLM. All server-side Anthropic calls moved behind MCP sampling so users' own clients foot the LLM bill. |

## How to add a card to your tool

1. Import the type:
   ```ts
   import type { ConversationalCard } from "@unclick/wizard";
   ```
2. Build the card from your existing result. Keep titles short and
   factual. Lean on body sections to carry detail.
3. Return the card alongside (not inside) your existing payload:
   ```ts
   return { results, card };
   ```
4. Add the `include_card` opt-in flag to your MCP input schema until the
   Wizard surface is ready to be the default.

## How to test a card

1. Unit test the builder: assert title, summary, severity, body kinds, and
   meta shape.
2. Verify followUps wire to real MCP tool names with valid args.
3. Run the MCP server locally and call the tool with `include_card: true`
   to see the card in the JSON response.

## What the Wizard surface will need (P3 preview)

The chat UI renders one card per tool call. A surface should:

- Show title and summary first.
- Render body sections in order, falling back to plain text on unknown kinds.
- Treat action-button and followUp actions as proposed tool calls. Always
  confirm with the user unless the action is marked auto.
- Use severity to color the card border and pick an icon.

None of that is built in Phase 1. The point of this phase is that the
type lands, one tool proves it works, and the rest of the team can start
wrapping their tools the same way.

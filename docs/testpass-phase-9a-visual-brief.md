# TestPass Phase 9A — Visual Overhaul Brief

**Status:** Draft, ready for review
**Owner:** Chris Byrne / Malamute Mayhem
**Implementer:** 🍿 Plex (Claude on Plex PC, todo `c116075a`)
**Related:** TestPass Phase 9 plan (`agent/memory/project-testpass-phase-9.md`), Idiot-proof examples (`agent/memory/feedback-idiot-proof-examples.md`), UnClick brand copy (`agent/memory/reference-unclick-brand-copy.md`)

---

## 1. Intent

TestPass Phase 9A is the visual overhaul of the TestPass run UI. The product graduates from "YAML-editor with logs" to a conversational, idiot-proof QC product that any non-developer can use.

The end-user pitch in one sentence: *"Run a check on your AI agent. Get a checkbox-style verdict in plain English. Click the badge to share."*

Phase 9A delivers:
- A checkbox-style result grid, one card per check
- Per-check states: ✅ pass, ❌ fail, ⚠️ warn, ⏸ skipped
- Plain-English status copy on every card with expandable detail
- A friendly empty state with a starter pack picker
- A single Run TestPass button (no jargon, no settings popovers)
- A score badge that says "12/14 passing" and is publicly shareable
- A shareable URL for any run, ready for the marketplace badge play in Phase 9B

This is a public-facing product surface. End users will see it. The bar is high.

## 2. Scope

### 2.1 In scope

- React UI (TypeScript, strict mode) for the TestPass run page at `/run` and `/run/{run_id}`
- Result grid component
- Per-check card component (collapsed and expanded states)
- Empty state with starter pack picker
- Run button with loading, in-progress, and post-run states
- Score badge with score number, severity colour, and shareable link
- Shareable URL generation (deep link to a run report)
- Mobile-responsive layout (works at 375 px wide and up)
- All copy in plain English, no jargon, no em dashes

### 2.2 Out of scope (Phase 9B / 9C)

- Server-side QC chip dispatch (Phase 9C)
- Pack authoring UI (still YAML for now)
- Run history list view (Phase 9B)
- Real-time progress streaming (Phase 9B)
- Marketplace badge embed code generator (Phase 9B)
- Agent bridge polish (Phase 9B)

### 2.3 Pre-existing work to NOT redo

- `mc_testpass_runs` schema is correct, do not modify
- `qc_run_checklist`, `qc_check_api`, `qc_copy_audit` MCP tools are correct, do not modify
- `api/testpass-run` handler is correct, do not modify
- The smoke dispatch gap (todo `4c5ee8d4`) is a separate fix lane, do not address here

## 3. Page structure and routing

### 3.1 Route map

| Route | Purpose | Surface |
|---|---|---|
| `/testpass` | Marketing/landing for the product (separate from this brief) | Public, unauthenticated |
| `/testpass/run` | Run a new TestPass check (logged-in user) | Authenticated |
| `/testpass/run/{run_id}` | View a specific run's result grid | Public read, owner edit |
| `/testpass/run/{run_id}/share` | Public shareable view of a run | Public read |

### 3.2 Layout regions

The `/testpass/run` and `/testpass/run/{run_id}` pages share a layout:

```
┌─────────────────────────────────────────────────────────────┐
│  Header: TestPass logo + run title (if any) + share button │
├─────────────────────────────────────────────────────────────┤
│  Score badge region: "12/14 passing" with green/amber/red  │
├─────────────────────────────────────────────────────────────┤
│  Run controls: pack picker + Run button (or "running…")    │
├─────────────────────────────────────────────────────────────┤
│  Result grid: one card per check, 1 column mobile / 2 desktop │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ ✅ Check 1   │  │ ❌ Check 2   │                        │
│  └──────────────┘  └──────────────┘                        │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ ⚠️ Check 3   │  │ ⏸ Check 4    │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## 4. Component specifications

### 4.1 ScoreBadge

**Props:**
```ts
interface ScoreBadgeProps {
  passed: number          // e.g. 12
  total: number           // e.g. 14
  severity: "ok" | "warn" | "fail"   // computed: ok if passed===total, warn if any warn, fail if any fail
  shareUrl?: string       // optional, presence enables click-to-copy
}
```

**Visual:**
- Pill shape, ~120 px wide × 40 px tall
- Background colour by severity (green / amber / red, brand tokens)
- Bold text: `{passed}/{total} passing`
- Optional sub-text in smaller weight: `last run {timeago}`
- Shareable variant: clicking copies the share URL to clipboard, brief toast "Link copied"

**States:**
- `loading` — pulsing skeleton placeholder
- `idle` — full badge
- `copied` — green flash on click for 800 ms

### 4.2 RunButton

**Props:**
```ts
interface RunButtonProps {
  state: "idle" | "starting" | "running" | "complete" | "error"
  packId?: string
  onClick: () => void
}
```

**States and copy:**
| State | Button text | Disabled? |
|---|---|---|
| idle | "Run TestPass" | no |
| starting | "Getting ready…" | yes |
| running | "Running checks ({n}/{total})" | yes |
| complete | "Run again" | no |
| error | "Try again" | no |

Single button, full-width on mobile, fixed-width 240 px on desktop. No dropdown menu, no advanced options. The pack picker lives separately; this button only fires the run.

### 4.3 PackPicker

**Props:**
```ts
interface PackPickerProps {
  packs: Pack[]
  selectedPackId?: string
  onSelect: (packId: string) => void
}
```

**Behaviour:**
- If `packs` is empty: show empty state (see 4.5)
- If only one pack: render as locked label, no dropdown
- If multiple packs: dropdown with friendly names, no UUIDs visible

**Friendly name source:** `pack.display_name` (fall back to title-cased pack id if missing).

### 4.4 CheckCard

The headline component of Phase 9A. One card per check.

**Props:**
```ts
interface CheckCardProps {
  state: "pass" | "fail" | "warn" | "skip"
  title: string                  // friendly title, e.g. "Your MCP server replies in JSON"
  status: string                 // plain-English one-liner
  detail?: string                // optional expanded explanation
  fixUrl?: string                // optional link to "how to fix this"
  evidenceJson?: unknown         // raw evidence, hidden by default, expandable
}
```

**Layout (collapsed):**
```
┌────────────────────────────────────────────┐
│ [icon] Title                               │
│        Plain-English status                │
│                              [show detail] │
└────────────────────────────────────────────┘
```

**Layout (expanded):**
```
┌────────────────────────────────────────────┐
│ [icon] Title                               │
│        Plain-English status                │
│                                            │
│ What this means:                           │
│ {detail paragraph}                         │
│                                            │
│ How to fix: → {fixUrl}                     │
│                                            │
│ ▸ See raw evidence (JSON)                  │
└────────────────────────────────────────────┘
```

**Icon and colour by state:**
| State | Icon | Border | Background |
|---|---|---|---|
| pass | ✅ | green | white |
| fail | ❌ | red | very pale red |
| warn | ⚠️ | amber | very pale amber |
| skip | ⏸ | grey | very pale grey |

**Copy rules:**
- Titles speak to the user, not the system. Bad: `mcp_jsonrpc_envelope_check`. Good: `Your MCP server replies in JSON`.
- Status is one sentence, ends with a period. Bad: `200 OK on /api/mcp`. Good: `Your server responded successfully.`
- "What this means" explains the check in plain English to a non-developer.
- "How to fix" is always actionable, never theoretical. Bad: `Check your auth header.` Good: `Add the line `Authorization: Bearer your-key` to your config file.`

### 4.5 EmptyState

When the user has no runs yet, render the empty state:

```
┌────────────────────────────────────────────┐
│         🧪                                 │
│                                            │
│  No checks yet                             │
│  Pick a starter pack to run your first    │
│  TestPass check. It takes about 30 sec.   │
│                                            │
│  ┌────────────────────────────────────┐   │
│  │ Starter packs:                     │   │
│  │ • UnClick Core (8 checks)          │   │
│  │ • Vercel deploy health (5 checks)  │   │
│  │ • Supabase RLS sanity (6 checks)   │   │
│  └────────────────────────────────────┘   │
│                                            │
│  [Run Starter Pack]                       │
└────────────────────────────────────────────┘
```

The starter pack list is hardcoded for Phase 9A; pack discovery via API ships in Phase 9B.

## 5. Data flow

### 5.1 Page load (`/testpass/run/{run_id}`)

1. Fetch run by id from `/api/testpass-run/{id}` (existing endpoint)
2. If run not found → 404 page with "Run not found" message
3. Otherwise render the result grid with the run's checks

### 5.2 New run flow (`/testpass/run`)

1. User selects pack from PackPicker
2. User clicks Run button → button transitions to `starting` state
3. Frontend calls `POST /api/testpass-run` with `{ pack_id }`
4. Backend returns `{ run_id, status: "queued" }`
5. Frontend redirects to `/testpass/run/{run_id}`
6. Page polls `/api/testpass-run/{id}` every 2 sec until `status === "complete"` or `status === "error"`
7. While polling, RunButton shows running state with progress

### 5.3 Share URL

Each run gets a deterministic shareable URL: `https://unclick.world/testpass/run/{run_id}/share` — public read, no auth required, anonymised (no api_key visible). The ScoreBadge's share button copies this URL.

## 6. Visual standards

### 6.1 Brand alignment

- All colours from existing brand tokens (no new hex values)
- All copy banned-word-clean (no em dashes, no AI-slop terms per `feedback-writing-style.md`)
- All icons from the existing icon set (Lucide), no new SVGs

### 6.2 Idiot-proof checklist (per `feedback-idiot-proof-examples.md`)

- Every input pre-filled with a sensible default
- Every card has a "use when" hint visible in expanded state
- Empty states show what to do next, not "no data"
- Plain English everywhere, no jargon
- Zero em dashes
- Run button has one job, one click

### 6.3 Mobile-first

- Layout works at 375 px wide
- Cards stack to single column on mobile
- ScoreBadge stays at top, fixed if needed
- No horizontal scroll anywhere

## 7. Tech stack

- **React 18** with TypeScript strict mode
- **TailwindCSS** for layout and brand tokens
- **shadcn/ui** for primitive components (Button, Card, Badge)
- **Lucide React** for icons
- Existing routing in the React app, no new router introduced
- Existing Supabase client in `src/lib/supabase.ts`, no new client needed

## 8. Acceptance criteria

Phase 9A is complete when ALL of these are true:

1. A user can navigate to `/testpass/run` and see the EmptyState if they have no runs
2. A user can pick a starter pack and click "Run Starter Pack" → run starts → user redirects to result page
3. The result page polls and shows status updates while running
4. Each check renders as a CheckCard with the correct icon, copy, and colour
5. The ScoreBadge shows the correct count and severity
6. The share URL works for an unauthenticated visitor
7. Mobile layout works at 375 px wide
8. Zero em dashes anywhere in the UI copy
9. All component tests pass (vitest, ≥80% line coverage on new components)
10. No TypeScript strict-mode errors

## 9. Test plan

- **Unit tests:** ScoreBadge severity logic, RunButton state transitions, CheckCard expanded/collapsed states, PackPicker selection
- **Integration tests:** End-to-end run flow on a mock server, shareable URL accessibility
- **Visual tests:** Storybook stories for each component, all four CheckCard states, ScoreBadge in all severity buckets
- **Manual QA:** Mobile layout at 375 px, copy review by Bailey/Chris before merge

## 10. Estimated effort

- 🍿 Plex on dedicated focus: 2-3 chip-days
- Components: ~6 new (ScoreBadge, RunButton, PackPicker, CheckCard, EmptyState, ResultGrid)
- New routes: 2 (`/testpass/run`, `/testpass/run/{run_id}/share`)
- New tests: ~30 unit, 4 integration

## 11. Open decisions

None blocking. The pack picker behaviour for a single pack (lock as label, no dropdown) is the only call worth flagging. If you (Chris) prefer "always show dropdown for consistency," call it. Default in this brief is single-pack-as-label.

## 12. Phase 9B / 9C preview

For context only, not in scope here:

- **Phase 9B** — Run history list, real-time progress streaming via Supabase realtime, pack discovery API, badge embed code generator
- **Phase 9C** — Server-side QC chip dispatch (the actual smoke dispatch fix that's currently blocking the dispatcher gap), agent bridge polish, marketplace badge ranking integration

After Phase 9A merges, todo `c116075a` closes and 🍿 picks up Phase 9B per the project memory file.

# TestPass Phase 9A — Visual Brief

Status: design intent for 🍿 (frontend specialist). Do NOT start React work
from this doc — Chris reviews and approves first. Implementation is Phase 9B.

Owner: 🐺 (Claude Opus, repo author of pack expansion)
Reviewer: Chris Byrne
Implementer: 🍿 (frontend, Phase 9B)
Related: Phase 9D = marketplace tile badge integration (separate, out of scope)

---

## North star

TestPass is a **public-facing product**. End users — not engineers — will see
the result page after an agent or operator clicks "Run TestPass" against an
MCP server, an UnClick tile, or any third-party endpoint.

The page must be:

- **Idiot-proof.** Anyone reading it should understand the result in 5 seconds
  without knowing what JSON-RPC, capabilities, or RLS even mean.
- **Shareable.** A run produces a URL. That URL is what gets pasted into Slack,
  X, or onto the marketplace tile (9D wires the badge image, not 9A).
- **Aligned with the existing UnClick admin look.** Dark theme, gold accent,
  teal info pill. Not a new design language.

The current `RunDetail.tsx` is functional but reads like an engineer's
debug view. Phase 9A replaces that with a clean checkbox grid that an end
user can scan, share, and trust.

---

## Layout

A single page, three regions stacked vertically:

1. **Header** — target name, score badge, single "Run TestPass" button, share
   link affordance.
2. **Checkbox grid** — one card per check (currently 26 in `testpass-core`).
   Cards reflow into 2 / 3 / 4 columns by viewport.
3. **Footer** — pack version, profile (smoke / standard / deep), elapsed time,
   "Powered by UnClick TestPass" link.

No tabs, no left sidebar on the public view. The admin view (under
`/admin/testpass/runs/:id`) keeps its sidebar; the public route is
`/testpass/r/:reportId` and is chrome-free apart from the UnClick top bar.

---

## State model — four visual states per check

Every card lives in exactly one of these four states. Match the existing
`VERDICT_ICON` map in `src/pages/admin/testpass/testpass-ui.ts` so we do not
fork the icon set.

| State    | Icon | Meaning                                          | Border / glow                 |
|----------|------|--------------------------------------------------|-------------------------------|
| pass     | ✅   | The check ran and the server behaved correctly. | green (`#22C55E` @ 30% alpha) |
| fail     | ❌   | The check ran and the server failed.            | red (`#EF4444` @ 30% alpha)   |
| warning  | ⚠️    | The check passed with caveats (slow, partial).  | gold (`#E2B93B` @ 30% alpha)  |
| skipped  | ⏸    | The check was skipped (profile excluded it).    | grey (`#6B7280` @ 25% alpha)  |
| pending  | ⏳   | (transient) The check is still running.         | teal pulse (`#61C1C4`)        |

`pending` is transient — it shows during a live run and is replaced as soon
as the verdict lands. Treat it as a fifth visual state in the component, not
a fifth user-meaningful outcome.

---

## Per-check card content

Each card is a self-contained explainer. Anatomy:

```
┌──────────────────────────────────────────┐
│ ✅  Server says hello back                │  ← friendly title (idiot-proof)
│                                          │
│ Your MCP server replied to the           │  ← plain-English status
│ handshake in 412 ms.                     │     (1–2 sentences max)
│                                          │
│ ▸ What this means                        │  ← expandable detail (collapsed)
│                                          │
│ [How to fix →]                           │  ← only shown on fail / warning
└──────────────────────────────────────────┘
```

Mapping to the YAML pack fields (already present in `testpass-core.yaml`):

- **Friendly title** = `title` (already rewritten to be idiot-proof in the
  Phase 1 pack expansion).
- **Plain-English status** = a one-liner generated from the verdict + measured
  value, NOT the raw `description`. Example: a PASS on `MCP-008` reads
  "Server replied to ping in 187 ms." A FAIL reads "Ping did not return within
  2 seconds." 🍿 builds these formatters per check_type, with a generic
  fallback derived from `description`.
- **What this means** (expandable) = `description` from the YAML.
- **How to fix** (link) = `on_fail` from the YAML, rendered as a panel that
  slides in from the right when the user clicks the link. NOT a modal — a
  modal interrupts; the slide-in keeps the grid context.

A FAIL card with no `on_fail` (none currently exist after Phase 1 expansion,
but defensive) renders "Contact the server author" as the fallback.

---

## Score badge

Top-right of the header. Public-shareable, designed to be screenshotted.

```
┌─────────────────────┐
│   24 / 26 passing   │
│   ████████████░░    │
│   testpass-core 0.1 │
└─────────────────────┘
```

- Number is `pass / total_runnable` (skipped is excluded from total).
- Bar is the same colour as the highest-severity failing check
  (red for any critical/high fail, gold for medium/low fail, green for all
  pass). This makes screenshots self-explanatory.
- Pack name + version sits underneath in the existing teal `#61C1C4`.
- Hover reveals a tooltip: "X failed, Y skipped, Z warnings."

---

## Run button

Single primary button, header-right, replacing the wizard for the public flow.

```
┌──────────────────────┐
│  ▶  Run TestPass     │
└──────────────────────┘
```

- Background: gold `#E2B93B`. Text: black. Match the existing primary CTA
  treatment in `AdminShell`.
- Disabled while a run is in progress; replaced by a `Loader2` spinner +
  "Running… (4 / 26)" counter that ticks as cards resolve.
- No "select profile" dropdown on the public flow. The default profile is
  `standard`. Power users go via the admin view to pick `smoke` or `deep`.

---

## Empty state — starter pack picker

When the user lands on the public page with no run yet (e.g.
`/testpass/r/new?target=https://example.com`), show a starter pack picker.

```
┌──────────────────────────────────────────────────────┐
│  Pick a checklist to run                             │
│                                                      │
│  ┌──────────────────┐  ┌──────────────────┐          │
│  │ TestPass Core    │  │ Anti-Stomp v0    │          │
│  │                  │  │                  │          │
│  │ The basics every │  │ Catches silent   │          │
│  │ MCP server must  │  │ deletions and    │          │
│  │ get right. 26    │  │ orphaned code    │          │
│  │ checks, ~30 sec. │  │ in PRs. 12 checks│          │
│  └──────────────────┘  └──────────────────┘          │
│                                                      │
│           [▶ Run TestPass Core]                      │
└──────────────────────────────────────────────────────┘
```

- One tile per available pack (read from the packs registry, do not hard-code).
- Each tile shows: pack name, plain-English description, check count,
  approximate run time.
- The selected tile is highlighted with the gold accent border.
- Default selection is `testpass-core`.
- Run button text updates to match the selection ("Run Anti-Stomp", etc.).

---

## Export / share

A run is identified by `report_id` and lives at `/testpass/r/:reportId`.

- **Share link button** in the header next to the score badge. Click =
  copies the canonical URL to clipboard, fires a toast "Link copied" on
  the existing toast system. No social-share dropdown — one URL is enough.
- **Download report** as JSON (existing capability in `RunDetail.tsx` —
  preserve the `Download` icon button, just restyle to fit).
- **Embed snippet** is **out of scope for 9A**. Phase 9D wires the badge
  image / iframe target. 9A only needs the public URL to exist and look
  good when opened directly.

---

## Color palette — anchor to existing UnClick admin

Do not invent new colours. Pull from `testpass-ui.ts` and the existing
admin shell. Reference values:

| Use                     | Value                |
|-------------------------|----------------------|
| Page background         | `#0B0E14` (existing) |
| Card background         | `#11151D` (existing) |
| Card border (resting)   | `#1F2937` @ 60% alpha|
| Primary accent (gold)   | `#E2B93B`            |
| Info accent (teal)      | `#61C1C4`            |
| Pass green              | `#22C55E`            |
| Fail red                | `#EF4444`            |
| Warning gold            | `#E2B93B` (reuse)    |
| Skipped grey            | `#6B7280`            |
| Body text               | `#E5E7EB`            |
| Muted text              | `#9CA3AF`            |

Verify exact values against `tailwind.config.ts` and `AdminShell.tsx`
during implementation — these are the intent, not the source of truth.

---

## ASCII wireframe — full run dashboard

```
┌────────────────────────────────────────────────────────────────────────────┐
│  UnClick                                                       [Sign in]   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│   TestPass · example.com/mcp                          ┌──────────────────┐ │
│   testpass-core 0.1 · standard profile · 28 sec       │  24 / 26 passing │ │
│                                                       │  ████████████░░  │ │
│   [▶ Run TestPass]   [🔗 Share]   [⬇ Download]        │  testpass-core   │ │
│                                                       └──────────────────┘ │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ ✅ jsonrpc field  │  │ ✅ id field set  │  │ ✅ error shape   │          │
│  │ Every request    │  │ Requests carry   │  │ Errors return    │          │
│  │ tags 2.0.        │  │ an id field.     │  │ code + message.  │          │
│  │ ▸ What this means│  │ ▸ What this means│  │ ▸ What this means│          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                                                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ ❌ ping too slow  │  │ ✅ tools/list ok  │  │ ⚠️ slow init     │          │
│  │ Ping took 4.1s,  │  │ 9 tools, all     │  │ Took 1.8s. Watch │          │
│  │ over 2s budget.  │  │ have schemas.    │  │ for cold starts. │          │
│  │ ▸ What this means│  │ ▸ What this means│  │ ▸ What this means│          │
│  │ [How to fix →]   │  │                  │  │                  │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                                                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ ✅ search_memory │  │ ✅ save_fact ok   │  │ ⏸ post_message  │          │
│  │ Returns the     │  │ Returned an id   │  │ Skipped (deep    │          │
│  │ right shape.    │  │ for new fact.    │  │ profile only).   │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                                                            │
│  … 17 more cards reflow below at 3 / 2 / 1 columns by viewport             │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│  testpass-core 0.1 · 26 checks · 28 sec · Powered by UnClick TestPass      │
└────────────────────────────────────────────────────────────────────────────┘
```

Notes on the wireframe:

- Header score badge sits to the right of the action buttons, not inside
  the button row. Gives it enough whitespace to read at a glance.
- "How to fix →" only appears on `fail` and `warning` cards; pass / skipped
  cards are shorter, so the grid does NOT need to enforce a fixed card
  height. Let cards size to their content; CSS grid `auto-rows: min-content`.
- Footer is muted text only. No logo, no extra CTA — the score badge is
  the only thing worth screenshotting.

---

## Out of scope for Phase 9A

- **Marketplace tile badge integration** — that is Phase 9D. 9A only needs
  the shareable URL to exist; 9D wires the embeddable badge that links to it.
- **Re-running individual checks** — out of scope. A run is atomic.
- **Diffing two runs** — admin view already has this; do not port it to
  the public view.
- **Editing the pack from the UI** — packs are YAML, edited via PR.
- **Auth UI on the public route** — the public report URL is anonymous-
  readable. Auth-gated rerun is the existing admin flow.

---

## Hand-off checklist for 🍿

When Chris approves this brief, 🍿 should:

1. Create `src/pages/testpass/PublicReport.tsx` (new public route).
2. Extract reusable `<CheckCard />` and `<ScoreBadge />` components into
   `src/pages/testpass/components/`.
3. Reuse `testpass-ui.ts` constants — do not fork the icon / colour maps.
4. Wire the route into `App.tsx` at `/testpass/r/:reportId`.
5. Add a starter-pack picker at `/testpass/r/new`.
6. Leave the admin view (`src/pages/admin/testpass/RunDetail.tsx`) alone.
   The two views can share components but should not share routes.

Estimated effort: 1–2 sessions (~400 LOC component work + ~150 LOC route
wiring). Test plan: Storybook stories for each card state, plus a
Playwright smoke run against a known good MCP server.

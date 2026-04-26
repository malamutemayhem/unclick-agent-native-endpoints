# UXPass product brief and build plan

A new agent-native UI/UX QC product for UnClick, sister to TestPass. This brief covers research, design, architecture, build plan, pricing, risks, and naming. Australian English. No em dashes anywhere.

---

## 1. Executive summary

UXPass is the UI/UX equivalent of TestPass. Where TestPass answers "does this MCP server or API conform to spec," UXPass answers "is this UI optimised to the max, and can a human or an AI agent actually use it well." The product runs a panel of fifteen-plus specialised AI critics (the "hat panel") in parallel against a live URL, a Storybook component, or a Figma frame, then synthesises their verdicts into a single 0 to 100 UX Score and a remediation queue that flows into Fishbowl as todos.

The wedge is unowned. Chromatic, Percy, Applitools, Argos and Lost Pixel all do pixel diffs. Stark, axe and Lighthouse cover accessibility and performance. Hotjar and Clarity show frustration after the fact. None of them grade aesthetic coherence, motion quality, dark pattern density, agent readability, or first-run experience. UXPass owns those five dimensions as the headline composite, then layers conventional Lighthouse and axe results underneath for completeness.

Three architectural commitments make UXPass distinct from the field. First, every UnClick tool gets an internal UXPass pack auto-applied via a bolt-on module, so TestPass, Memory, Fishbowl, Crews, BackstagePass and Signals all run UI QC on themselves continuously. Second, the run loop reuses Crews for the multi-hat deliberation step, avoiding rebuild of multi-agent infrastructure. Third, results route through Signals as severity-tagged events, into Fishbowl as todos, and into BackstagePass for credential storage, all using the existing UnClick fabric.

The build is ten chunks, each one to two days for Bailey or Cowork or Codex Worker 2. Chunks one through six ship a credible MVP (one URL, four hats, one report). Chunks seven through ten add Figma, the creative-edge hats (Agent Readability, Dark Pattern Detector), the marketing site, and the full hat roster.

Pricing sits where TestPass sits: a free tier for indie developers, a Pro tier in the $19 to $39 per project per month band that competes with Vercel Speed Insights and Argos, and a Team tier around $99 per month that aligns with Argos Pro and Hotjar Plus. Enterprise is sales-led with SSO and private hat models.

The slogan: **"Every pixel earns its place."** Sister to TestPass's agent-native QC, sitting in the same UnClick family.

---

## 2. Phase 1: Open source candidates worth forking or borrowing

The research surfaced roughly forty viable candidates across visual regression, accessibility, performance, Storybook, design tokens, Figma, AI replay and aesthetic tooling. The five highest-leverage picks form the spine of the MVP. Everything else is supporting cast.

### 2.1 Top five fork or embed candidates

| Rank | Name | Licence | URL | Why it matters | UXPass role |
|---|---|---|---|---|---|
| 1 | **Lost Pixel** | MIT | github.com/lost-pixel/lost-pixel | Modern TypeScript, multi-mode capture (Storybook, Ladle, page, Playwright, custom), GitHub Action native, last release v3.22.0 in Nov 2024. Architecturally the closest cultural fit to TestPass and UXPass | Visual diff layer, screenshot capture pipeline |
| 2 | **axe-core** | MPL 2.0 | github.com/dequelabs/axe-core | Industry-standard accessibility engine, ~7.1k stars, v4.11.3 released April 2025, MPL 2.0 is file-level copyleft and safe to embed | Accessibility Auditor hat brain |
| 3 | **Lighthouse CI** | Apache 2.0 | github.com/GoogleChrome/lighthouse-ci | Canonical "fail the PR if budget regresses" pattern, v0.15.1 released June 2025. Assertion config maps one-to-one to UXPass YAML packs | Performance Engineer hat orchestrator |
| 4 | **Stagehand** | MIT | github.com/browserbase/stagehand | AI-native Playwright wrapper with act, extract, observe, agent primitives. ~22k stars, very active. Switched in v3 to using the Chrome accessibility tree as substrate, exactly the pattern UXPass needs for agent-readability scoring | Agent Readability scorer, AI-driven flow runner |
| 5 | **rrweb** | MIT | github.com/rrweb-io/rrweb | Canonical record and replay primitive used by Sentry, PostHog and OpenReplay. ~18k stars, active | Capture engine for the replay lane and motion analysis |

### 2.2 Visual regression layer

Lost Pixel is the primary fork target. Reg-suit (MIT, github.com/reg-viz/reg-suit, last commit Feb 2026) supplies the plugin model for key-generator, publisher and notifier, mapping cleanly to a YAML-pack approach. **Odiff** (MIT, github.com/dmtrKovalenko/odiff, v4.3.2 released Nov 2025) is the diff primitive of choice: SIMD-first, roughly six times faster than pixelmatch on 4K screenshots. Pixelmatch is the portable JS fallback.

Skip BackstopJS (slowing maintenance, last meaningful release Sep 2024), Loki (inactive since 2023 in any meaningful sense), Wraith (PhantomJS era, abandoned), and Galen (Java/Selenium, abandoned). Avoid forking the WebPageTest master branch outright: it is licensed Polyform Shield 1.0.0, a source-available licence with an anti-competitive clause that is hostile to commercial products. The older `apache` branch is the only safely Apache 2.0 path and it lags badly.

### 2.3 Accessibility layer

axe-core is the embedded engine. Lighthouse a11y audits piggyback on axe-core and come for free with the Performance Engineer hat. **eslint-plugin-jsx-a11y** (MIT, github.com/jsx-eslint/eslint-plugin-jsx-a11y, v6.10.2 released Jan 2025) gives UXPass a "shift-left" lint mode for component-source review. **IBM Equal Access Accessibility Checker** (Apache 2.0, github.com/IBMa/equal-access) is a credible second engine when customers want belt-and-braces a11y, with the bonus of an ACT-rule baseline-diff feature very similar to TestPass philosophy.

Skip Pa11y (LGPL 3.0, awkward licence for a closed core), Asqatasun and Equalify (AGPL v3, project-level copyleft, contagious), WAVE and Tenon (closed APIs), and the archived `react-axe` (use `@axe-core/react` in the axe-core-npm monorepo if needed, but UXPass should call axe-core directly).

### 2.4 Performance layer

Lighthouse CI is the orchestrator. **Unlighthouse** (MIT, github.com/harlan-zw/unlighthouse, v0.17 line, very active) is effectively a fully-formed perf hat already: site-wide Lighthouse with smart sampling and a modern UI. Forking gives UXPass a head start while leaving room to swap in YAML pack semantics. **web-vitals** (Apache 2.0, github.com/GoogleChrome/web-vitals, v5.x line, ~20.5M weekly npm downloads) embeds for any RUM-side beacon UXPass exposes.

### 2.5 Storybook and component layer

`@storybook/addon-a11y` (MIT) is the canonical pattern reference for the accessibility panel UX: rule overrides, story-scoped config, deep-linking. The Storybook test runner (MIT, v0.24.2 released Nov 2025, ~270 stars) is the universal Jest-plus-Playwright wrapper for non-Vite Storybooks. `chromaui/chromatic-cli` (MIT, v16.3.0 released April 2025) is a high-quality reference for git-aware change detection and JUnit reporting, but tightly coupled to Chromatic SaaS so its value is patterns rather than drop-in reuse.

Note one caveat: `@axe-core/react` does not officially support React 18 or later. Use axe-core directly.

### 2.6 Design token layer

**Style Dictionary** (Apache 2.0, github.com/amzn/style-dictionary, v4.x line) is the de facto cross-platform token engine, with v4 supporting the W3C Design Tokens Community Group format. **W3C DTCG Design Tokens Format Module** v1 stable was announced 28 October 2025 and should be UXPass's canonical wire format. **Tokens Studio for Figma** (MIT, github.com/tokens-studio/figma-plugin, v2.11.3 released March 2025) supports the DTCG format toggle and Git sync. Skip Salesforce Theo: archived.

### 2.7 Figma extraction layer

The **Figma REST API** is the foundation, used via `@figma/rest-api-spec` types and PAT auth. **figma-export** (MIT, github.com/marcomontalbano/figma-export) is the cleanest fork target with pluggable outputters (SVG, SVGR, ES6, Style Dictionary, Sass). Skip **bernaferrari/FigmaToCode** (GPL 3.0, copyleft blocker for a proprietary product) and **html.to.design** (closed-source SaaS). Builder.io's `figma-html` (MIT) is officially deprecated in favour of their hosted plugin.

### 2.8 AI evaluation and replay

**Stagehand** is the agent flow runner. **browser-use** (MIT, github.com/browser-use/browser-use, ~90k stars) is the Python alternative. **rrweb** is the capture primitive. **OpenReplay** (AGPL v3 core, AGPL plus EE) and **PostHog session replay** (MIT core plus EE) are not safe to fork because of their copyleft tail, but both are credible self-host connectors for customers who want their own replay backend.

### 2.9 Aesthetic and brand layer

**css-doodle** (MIT, github.com/css-doodle/css-doodle, ~6k stars, v0.51.0) is the leverage choice for declarative generative patterns and shaders, ideal for the Visual Designer hat's preset library. **Three.js** (MIT, ~100k stars) underpins WebGL hero shaders. Hero Patterns (CC BY 4.0) and Pattern Monster (CC0) supply seamless SVG presets. Specify parsers (MIT) are reusable for token transforms even though the hosted product is winding down. Skip Knapsack (open core too narrow), Frontify (closed API, integrate as optional connector), Haikei and BG Jar and mesh.bg (closed, inspiration only).

### 2.10 Awesome list picks

From `alexpate/awesome-design-systems`: Shopify Polaris (MIT) supplies tone and voice rules for the Content Specialist hat; USWDS (CC0) supplies baseline UX heuristics. From `bradfrost`: `frontend-guidelines-questionnaire` is a strong heuristic prompt library seed. From the broader space: `VoltAgent/awesome-design-md` supplies DESIGN.md seeds for agent-readable brand profiles.

### 2.11 Licence watch list

| Project | Licence | UXPass posture |
|---|---|---|
| WebPageTest master branch | Polyform Shield 1.0.0 | Do not fork: anti-competitive clause |
| Pa11y | LGPL 3.0 | Treat as inspiration, not embed |
| Asqatasun, Equalify | AGPL v3 | Project-level copyleft, do not embed |
| OpenReplay, PostHog EE dirs | AGPL v3 + EE | Connector only, not fork |
| FigmaToCode | GPL 3.0 | Blocked from proprietary linkage |
| Theo | BSD 3 (archived) | Use Style Dictionary instead |
| @axe-core/react | MPL 2.0 (no React 18 support) | Call axe-core directly |
| axe-core | MPL 2.0 | Safe to bundle (file-level copyleft) |
| p5.js | LGPL 2.1 | Dynamic-link friendly, static-link with care |

---

## 3. Phase 2: Competitor analysis and the differentiation strategy

Eighteen competitors covered, organised into four lanes. The summary table below is the at-a-glance map. Detail follows.

### 3.1 Competitor summary

| Competitor | Lane | Cheapest paid tier | Best feature to mirror | UXPass twist |
|---|---|---|---|---|
| Chromatic | Visual regression | $149/mo, 35k snapshots | TurboSnap (only changed components) | Score full screens for agent-readability, not just isolated components |
| Percy (BrowserStack) | Visual regression | ~$99/mo Professional | Intelli-ignore for dynamic regions | Score the dynamic content's quality, do not just suppress it |
| Applitools | Visual AI QA | ~$99 to $199/mo small team | Visual AI noise suppression | Move beyond diff to absolute aesthetic quality |
| Argos CI | OSS visual regression | $100/mo Pro, 35k screenshots | ARIA snapshots (semantic regression) | Extend ARIA snapshots into a full agent-comprehension score |
| Lost Pixel | OSS visual regression | "From $100" Platform | Composable Storybook + page + Playwright | First-class agent-native review, not just visual diffs |
| Polypane | Multi-viewport browser | $9/mo Solo annual | All breakpoints and a11y simulators on one screen | Automate Polypane's manual audit and emit a numeric score |
| Maze | Usability testing | $99/seat/mo Starter | AI moderator and 5 to 6M panel | AI agent panel returns scores in seconds, not days |
| UXtweak | Usability testing | €49/mo annual Plus | 130-country panel | Same as Maze: AI panel for CI-speed feedback |
| Stark | Accessibility | ~$600/yr 10 seats Grow | Continuous Accessibility (Figma plus code plus URL) | Bundle a11y, agent-readability, motion, dark patterns into one score |
| Figma Variables | Design tokens in Figma | $15/editor/mo Pro | Variables and modes with REST API | Grade live URLs against design intent encoded in variables |
| Builder.io Visual Copilot / Fusion | AI design-to-code | From $19/user/mo | Component mapping to your repo | Sit downstream as the grader of every Fusion-generated PR |
| Galileo AI / Uizard | AI UI generation | Galileo $19/mo, Uizard Pro $12/seat/mo | Prompt-to-UI in seconds | Score generated UI for taste and dark patterns |
| Vercel Speed Insights | Real Core Web Vitals | $10/mo per project | One-click CWV with HTML attribution | Add experience vitals beyond CWV |
| Vercel Web Analytics | Event analytics | $0.00003/event on Pro | Tightly bound to Vercel deployments | Same Vercel-adjacent positioning, design-quality lens |
| Bunny RUM | Edge perf telemetry | Bundled with CDN from $1/mo | Cheap edge perf | Position UXPass on top of any RUM, not as one |
| Ahrefs Site Audit | SEO crawler | $29/mo Starter, $129/mo Lite | 170-plus issues per crawl | Crawl for design and dark-pattern issues, not technical SEO |
| Hotjar | Behaviour analytics | $39/mo Plus, 100 sessions/day | Rage-click and dead-click detection | Map frustration signals into specific UI defects an agent can fix |
| Microsoft Clarity | Behaviour analytics | Free | No session caps, free | Free is not a moat; UXPass is preventive, Clarity is reactive |
| Lyssna | Remote usability | Free plus paid panel responses | Mix-and-match study builder | AI panel signal in seconds inside the PR |
| Vercel Toolbar / Netlify Drawer | In-context feedback | Free on all plans | Convert comment to Linear/Jira issue | Auto-file the issue an agent already detected |
| Sentry user feedback | Crash plus feedback | Free across all plans | Tied to Session Replay and stack trace | "Robot Sentry feedback": proactive AI defect reports filed in the same triage workflow |

### 3.2 The pricing band

Three of UXPass's most relevant peers anchor the per-month figure. Argos CI Pro starts at $100 per month for 35,000 screenshots with extra screenshots at $0.004 each ($0.0015 for Storybook). Chromatic starts at $149 per month for 35,000 snapshots. Vercel Speed Insights is $10 per project per month on Pro and Enterprise. UXPass should slot between Vercel Speed Insights and Argos: cheap enough that an indie developer adopts it on every project, expensive enough that the marginal LLM cost of fifteen hats is covered.

### 3.3 The blue-ocean spaces

Seven gaps no competitor occupies. UXPass should occupy all seven, but lead with the Agent Readability Score and Dark Pattern Detector because those carry the most regulatory and forward-looking weight.

The seven gaps: AI-driven first-run experience scoring (Maze and Lyssna take days, nobody does it per PR), motion design quality scoring (visual regression tools actively disable motion), dark pattern detection automated (Brignull's taxonomy plus EU DSA Article 25 plus the post-vacatur FTC ANPRM creates a regulatory wedge), vector aesthetic quality scoring (no tool grades whether a hero illustration is on-brand and well composed), generative background appropriateness (visual regression tools suppress AI-generated regions as noise), brand-voice-to-tone-of-voice match (no tool scores headline copy against a defined brand voice), and agent-readable UI semantics (Argos has ARIA snapshots and Stark has accessibility audits but both stop at human screen readers).

The headline recommendation is unchanged from the research subagent: do not compete with Chromatic, Percy or Applitools on diff fidelity, and do not compete with Hotjar or Clarity on traffic analytics. Own "agent and human comprehension score" plus motion, dark patterns, brand voice, and aesthetic coherence.

---

## 4. Phase 3: The creative edge composite, the UX Score

UXPass's headline number is a weighted 0 to 100 composite called the **UX Score**. The five components below carry the score. Five further dimensions appear as named modifiers, surfacing in the report but not contributing to the headline.

### 4.1 Headline UX Score components

| Component | Weight | Justification |
|---|---|---|
| Agent Readability | 25% | The single strongest forward-looking differentiator. As LLM browsers (Atlas, Comet) and Stagehand-class agents become primary traffic, sites that fail this score will silently lose conversions. Nobody else measures it |
| Dark Pattern Cleanliness | 25% | High weight because of regulatory teeth: EU DSA Article 25 (in force 17 Feb 2024), the forthcoming Digital Fairness Act, US state ARLs, and the post-vacatur FTC ANPRM where comments closed 13 April 2026 |
| Aesthetic Coherence | 20% | Most visible "feels expensive" signal. Maps to bento grid quality, palette discipline, type system, modern colour and motion adoption. Hardest for competitors to copy quickly |
| Motion Quality | 15% | Motion is now a brand surface (View Transitions API reached Baseline Newly Available in October 2025). Bad motion is worse than no motion |
| First-Run Quality | 15% | The activation gate. Maps directly to revenue. Currently invisible to all existing audit tools |

### 4.2 Modifiers (named, diagnostic, do not affect headline)

Cognitive Load, Mobile Designed-for vs Adapted-for, Trust Signals, Modern Interaction Patterns, and State Quality. Each appears in the report as "Trust Signals weak: minus 5 to First-Run Quality" or "Mobile Adapted-for: minus 8 to Aesthetic Coherence." This keeps the headline simple while preserving diagnostic depth.

### 4.3 Why this composite, not the obvious one

The naive composite would mirror Lighthouse: Performance, Accessibility, SEO, Best Practices. Do not compete there. Lighthouse is free, Google-owned, and good enough. UXPass should grade what nobody is grading.

### 4.4 Scoring substrate

Two methodological commitments. First, capture the **Chrome accessibility tree** via CDP `Accessibility.getFullAXTree` rather than parsing the raw DOM. This is Stagehand v3's lesson: the a11y tree is the right substrate for any agent-era UI tool, and it gives UXPass agent-readability scoring almost for free. Second, **flag LLM hat verdicts as such in the UI**, showing "Claude says..." or "Synthesiser says..." next to each judgement so they are treated as informed second opinions, not facts. Deterministic checks (axe, Lighthouse, Pixelmatch diffs) are presented unflagged; LLM judgements are explicitly attributed.

---

## 5. Phase 4: Bolt-on architecture for internal use

UXPass mirrors the bolt-on pattern of TestPass, Notifications and the upcoming Backup. Every other UnClick tool registers UI/UX checks back into UXPass for internal QC. Bolt-on modules are invisible to end users; results surface only in `/admin/uxpass/internal`.

### 5.1 The `uxpass:register` hook

Each tool's admin page calls a single function on boot:

```ts
import { registerUXPass } from '@unclick/uxpass-bolt-on'

registerUXPass({
  tool: 'testpass',
  baseUrl: '/admin/testpass',
  packs: ['testpass-admin-baseline.yaml'],
  schedule: 'daily',
  hats: ['accessibility', 'agent-readability', 'first-run', 'motion'],
  remediationTarget: 'fishbowl-todos',
})
```

The bolt-on does three things. It enrols the tool's admin URL for periodic UX QC. It supplies a baseline pack (each tool gets one auto-generated and committed at first registration). It declares which hats run by default for that tool. The tool can override anything per pack.

### 5.2 Internal packs auto-applied to UnClick tools

Six baseline packs ship with UXPass on day one, one per existing tool. Each pack covers the tool's main admin views and uses the four MVP hats. The packs live in the UXPass repo under `packs/internal/` and are versioned alongside UXPass releases.

| Tool | Pack file | Coverage |
|---|---|---|
| TestPass | `internal/testpass-admin.yaml` | `/admin/testpass`, pack list, run detail, pack editor |
| Memory | `internal/memory-admin.yaml` | `/admin/memory`, fact list, identity panel, session search |
| Fishbowl | `internal/fishbowl-admin.yaml` | `/admin/fishbowl`, todos kanban, ideas, message feed |
| Crews | `internal/crews-admin.yaml` | `/admin/crews`, council view, agent roster, run detail |
| BackstagePass | `internal/backstagepass-admin.yaml` | `/admin/backstagepass`, vault entries, audit log |
| Signals | `internal/signals-admin.yaml` | `/admin/signals`, route list, severity feed, channel config |

### 5.3 Result routing

UXPass results route through three existing UnClick layers. Severity-tagged events go to **Signals** (action_needed for any Critical, warning for High, info for Medium, debug for Low). High-severity findings auto-create **Fishbowl todos** through the Fishbowl bolt-on, mirroring TestPass exactly. Credentials for the Figma API, Browserbase keys, and any LLM provider keys live in **BackstagePass** keyed by tenant.

### 5.4 The external surface remains identical in feel to TestPass

The bolt-on is internal plumbing. The external UXPass at `/admin/uxpass` looks and feels like `/admin/testpass`: pack list, recent runs, scores over time, top failing items. End users never see the internal feed unless they explicitly navigate to `/admin/uxpass/internal`, which is admin-only.

---

## 6. Phase 5: The hat panel run loop

A UXPass run is a five-step pipeline. Each pack defines the URL or component or Figma frame, the viewports, and which hats to run. Hats run in parallel, then a Synthesiser hat composes the per-item verdict and the UX Score.

### 6.1 The pipeline

Step one: **Capture.** A headless Chromium (Playwright) loads the target URL at every viewport in the pack (mobile 390 by 844, tablet 834 by 1194, desktop 1440 by 900, plus dark and light themes). For each capture, UXPass records: full-page screenshot, accessibility tree via CDP, DOM snapshot, computed styles for all visible elements, Lighthouse JSON, axe-core JSON, web-vitals beacon, network HAR, and a thirty-second video for motion analysis.

Step two: **Evidence packaging.** The captures are bundled into per-hat evidence packets. The Accessibility hat gets axe JSON plus DOM plus a11y tree. The Performance hat gets Lighthouse JSON plus HAR plus web-vitals. The Motion hat gets the video plus the prefers-reduced-motion second pass. The Agent Readability hat gets the a11y tree plus a Stagehand probe transcript. The Visual Designer hat gets the screenshots only. This keeps token counts bounded and hats specialised.

Step three: **Parallel hat execution.** Each hat is a single LLM call with a tightly scoped rubric, the relevant evidence packet, and a strict JSON output schema (verdict, severity, evidence pointers, remediation chips). Hats run in parallel, capped at fifteen concurrent. Average run with the four MVP hats hits roughly 40 to 60 seconds end to end; with the full fifteen, two to three minutes.

Step four: **Synthesiser.** A single Synthesiser hat reads all hat verdicts and produces the per-item composite and the UX Score. The Synthesiser also resolves overlap: if Accessibility, Visual Designer and Brand Steward all flag the same low-contrast button, the Synthesiser merges them into one finding with three corroborating sources.

Step five: **Routing.** Findings flow into Signals (severity-tagged) and Fishbowl (high-severity creates a todo). The remediation chips are auto-attached to the todo so an agent picking it up has the suggested fix inline.

### 6.2 Reuse Crews where it makes sense

Crews already has 180 seeded agents in seven categories, including Designer, Architect, Skeptic and Strategist personas. UXPass should reuse Crews's agent-roster infrastructure, deliberation primitives and council-mode debate for the Synthesiser step. The fifteen-plus UXPass hats are stored as a Crews hat-set (`uxpass-default`, `uxpass-deep`, `uxpass-quick`) and the Synthesiser is a Crews council with the relevant hats invited. This avoids rebuilding parallel-LLM, deliberation and audit infrastructure.

### 6.3 The recommended hat roster

The starting list is fifteen hats. The research surfaced four additional hats worth adding: **Trust and Privacy Reviewer** (already in starting list as Privacy and Trust Reviewer, retained), **Cognitive Load Auditor** (new, applies Fitts, Hick and Miller proxies), **Aesthetic Coherence Critic** (new, focused on bento grids, palette discipline, type scale), and **Agent Readability Auditor** (new, scores the page for Stagehand-class agents). The Visual Designer hat in the starting list explicitly absorbs the modern aesthetic dimension (gradients, glassmorphism, generative meshes), so it doubles as the aesthetic critic for the MVP and splits later.

| Hat | Rubric focus | Evidence types | Notes |
|---|---|---|---|
| Graphic Designer | Visual hierarchy, typography, layout, colour, spacing, balance | Screenshots, computed styles, palette extract | Foundational |
| UX Specialist | User flow, friction, IA, microcopy, jobs-to-be-done | Screenshots, DOM, copy text | Foundational |
| Frontend Specialist | Semantic HTML, performance, Tailwind/CSS quality, component reuse | DOM, computed styles, CSS bundle | Foundational |
| Accessibility Auditor | WCAG 2.2 AA/AAA, screen reader, keyboard nav, focus, colour contrast, ARIA | axe-core JSON, DOM, a11y tree | axe-core wrapped |
| Brand Steward | Consistency with brand tokens, voice, personality | Tokens, screenshots, copy | Pulls DTCG tokens |
| Motion Designer | Transitions, easing, micro-interactions, haptics, reduced-motion respect | Video, prefers-reduced-motion second pass | New blue-ocean dim |
| Conversion Strategist | CTA hierarchy, trust signals, friction in funnels | Screenshots, copy, DOM | Maps to CRO heuristics |
| Information Architect | Navigation, page structure, hierarchy, content strategy | DOM, headings outline, sitemap | Schema-aware |
| Performance Engineer | CLS, LCP, INP, bundle size, render budget | Lighthouse JSON, web-vitals, HAR | Lighthouse CI wrapped |
| Mobile Specialist | Viewport behaviour, touch targets, gesture coverage, safe areas | Mobile screenshots, computed styles, viewport meta | WCAG 2.5.8 |
| Internationalisation Specialist | RTL support, length tolerance, locale formatting | DOM, lang attrs, screenshots in synthetic locales | Optional pack |
| Privacy and Trust Reviewer | Cookie consent UX, data flow transparency, dark patterns | DOM, banner DOM, GPC handling, badge OCR | Pairs with Dark Pattern Detector |
| Onboarding Specialist | Empty states, tooltips, progressive disclosure | Screenshots of empty containers, signup form, walkthrough probes | First-Run scorer |
| Content Specialist | Tone, plain English, voice consistency | Copy text, brand voice spec | Polaris-style ruleset |
| Visual Designer / Aesthetic Critic | Gradients, glassmorphism, vector backgrounds, generative meshes, modern aesthetic | Screenshots, SVG count, css-doodle detection | Aesthetic Coherence dim |
| **Cognitive Load Auditor (new)** | Fitts, Hick, Miller proxies, choice density, reading complexity | DOM, interactive element counts, copy text | Composite proxy |
| **Agent Readability Auditor (new)** | llms.txt, accessibility tree quality, semantic HTML density, stable selectors, structured data, DOM stability | a11y tree, llms.txt fetch, DOM diff over 2s, JSON-LD blocks | Stagehand-grade scorer |
| **Dark Pattern Detector (new)** | Brignull taxonomy, EU DSA Article 25, FTC ANPRM-aligned patterns | DOM, banner DOM, asymmetric button styling, fake urgency reload check, copy classification | Regulatory wedge |
| **Synthesiser** | Composes per-item verdicts and UX Score, resolves hat overlap | All hat outputs | Crews council |

That is eighteen hats plus the Synthesiser. Eighteen exceeds the fifteen-plus floor and matches the bold "no other tool has fifteen-plus specialised AI critics" positioning.

### 6.4 Per-hat anatomy

Each hat has four artefacts in the repo:
- A **rubric markdown** file describing what the hat scores and why.
- A **weighted scoring spec** in YAML (sub-criteria with weights summing to 100).
- A **prompt template** with placeholders for evidence types.
- A **remediation chip catalogue**: a list of pre-templated fix suggestions the hat can attach to findings, each one a small actionable recipe ("Add aria-label to icon-only button, example: <button aria-label='Close'>...").

---

## 7. Phase 6: External-facing product surface

Identical in feel to TestPass. Identical CLI shape. Identical GitHub Action. Identical MCP tool surface. Identical pack YAML structure with extra UXPass-specific fields.

### 7.1 The admin surface

`/admin/uxpass` mirrors `/admin/testpass`: pack list, recent runs, scores over time, top failing items. The pack editor has a YAML preview pane on the right and a form-driven editor on the left, same as TestPass. The run detail page is where UXPass diverges richer: annotated screenshots with bounding boxes on issues, hat-by-hat verdict cards, the Synthesiser composite, the UX Score with a sub-score breakdown, before/after visual diffs (when a previous run exists), and the remediation chip queue with one-click "send to Fishbowl" buttons.

### 7.2 The pack format

```yaml
# uxpass.yaml
name: marketing-site-baseline
url: https://example.com
viewports: [mobile, tablet, desktop]
themes: [light, dark]
hats:
  - graphic-designer
  - ux-specialist
  - frontend
  - accessibility
  - performance
  - motion
  - mobile
  - agent-readability
  - dark-pattern-detector
synthesiser: default
budgets:
  ux-score: ">= 80"
  performance: ">= 90"
  accessibility: "no critical"
  dark-patterns: "zero"
remediation:
  high-severity: fishbowl-todos
  all: report-only
```

Same shape as a TestPass pack (`name`, items, assertions). UXPass adds `viewports`, `themes`, `hats` and `budgets`.

### 7.3 The CLI

```
npx uxpass run packs/marketing-site-baseline.yaml
npx uxpass run --url https://example.com --hats accessibility,motion
npx uxpass status <run-id>
npx uxpass report <run-id> --format html|json|md
```

Mirrors `npx testpass run` exactly. The CLI is a thin client that posts to the UXPass API; for fully local runs (no cloud), `uxpass run --local` runs everything on the user's machine using local LLM credentials from BackstagePass.

### 7.4 The GitHub Action

PR triggers UXPass against the preview deployment URL (Vercel, Netlify, Cloudflare Pages, custom). Posts a comment with the UX Score, top three issues, and a link to the full run. The Action is published as `unclick/uxpass-action@v1`, mirroring `unclick/testpass-action@v1`.

```yaml
# .github/workflows/uxpass.yml
on: [pull_request]
jobs:
  uxpass:
    runs-on: ubuntu-latest
    steps:
      - uses: unclick/uxpass-action@v1
        with:
          pack: packs/marketing-site-baseline.yaml
          url: ${{ github.event.deployment.payload.web_url }}
          fail-on: critical
          token: ${{ secrets.UNCLICK_TOKEN }}
```

### 7.5 MCP tools exposed via /api/mcp

Five tools on day one, mirroring the TestPass surface.

| Tool | Description |
|---|---|
| `uxpass_run` | Start a run against a URL or pack. Returns run id |
| `uxpass_status` | Fetch status, UX Score, fail count for a run id |
| `uxpass_report_html` | Download HTML report by run id |
| `uxpass_report_json` | Download JSON report by run id |
| `uxpass_report_md` | Download Markdown report by run id |
| `uxpass_register_pack` | Save a pack YAML for the caller's tenant |

### 7.6 Public marketing site

`unclick.world/uxpass`, identical shape to the TestPass marketing page: hero, demo run, hat roster grid, three-tier pricing, a "compare against Chromatic, Argos, Stark" table, social proof, open-source pack catalogue, CLI install snippet, GitHub Action snippet.

---

## 8. Phase 7: Build chunks

Ten chunks, each chip-sized at one to two days for Bailey or Cowork or Codex Worker 2. Each ships as a single PR with TestPass coverage of its own, and each registers itself with the internal UXPass bolt-on once Chunk 5 lands.

### 8.1 Recommended ordering

| Chunk | PR scope | Days | Dependencies |
|---|---|---|---|
| 1 | Schema, MCP tools, pack format, skeleton runner with one hat (Accessibility wrapping axe-core) | 2 | None |
| 2 | Visual capture pipeline: Playwright + Odiff + screenshot storage in BackstagePass-keyed S3 | 1.5 | Chunk 1 |
| 3 | Hat panel infrastructure: parallel LLM calls, evidence packaging, Synthesiser. Bootstrap with four hats (Graphic Designer, UX Specialist, Frontend, Accessibility) | 2 | Chunks 1 to 2 |
| 4 | Report generator (HTML, JSON, MD), UX Score composite, annotated screenshots with bounding boxes, remediation chip queue | 2 | Chunk 3 |
| 5 | Bolt-on module spec; first internal integration: TestPass admin UI registers itself with UXPass | 1 | Chunk 4 |
| 6 | GitHub Action and CLI (`npx uxpass run`) | 1 | Chunks 4 to 5 |
| 7 | Figma adapter: REST API ingestion, design token diff against live URL, frame-to-page comparison hat | 2 | Chunk 4 |
| 8 | Agent Readability hat (a11y tree via CDP, llms.txt check, Stagehand probe) and Dark Pattern Detector hat | 2 | Chunk 3 |
| 9 | Marketing site at unclick.world/uxpass and admin page polish | 1.5 | Chunks 4 to 6 |
| 10 | Full hat roster expansion: add the remaining hats (Brand Steward, Motion, Conversion, IA, Performance Engineer, Mobile, i18n, Privacy and Trust, Onboarding, Content, Cognitive Load) with rubrics, scoring specs, prompts and chip catalogues | 2 | Chunks 3, 8 |

### 8.2 Adjustments from research

Three deltas from the user's suggested ordering. First, Chunk 2 uses Odiff over Pixelmatch as the diff primitive (research showed Odiff is roughly six times faster on 4K screenshots and is current as of November 2025). Second, Chunk 5 lands before Chunk 6 because the bolt-on contract is the hardest interface to evolve later, and locking it early keeps internal and external surfaces consistent. Third, Chunk 8 is moved up to roughly equal priority with Chunk 7, because Agent Readability and Dark Pattern Detector are the marquee differentiators and shipping them earlier accelerates the marketing story.

### 8.3 What ships in the MVP

After Chunks 1 to 6, UXPass can: run against any URL, capture multi-viewport screenshots, run four hats in parallel plus Synthesiser, emit a UX Score, render an annotated HTML report, post a PR comment via GitHub Action, and self-monitor TestPass admin. That is enough for an alpha.

After Chunks 7 to 10, UXPass has: Figma comparison, the agent-readability and dark-pattern wedges, the marketing site, and the full eighteen-hat roster. That is the GA shape.

---

## 9. Phase 8: Pricing and positioning

Pricing slots between Vercel Speed Insights ($10 per project per month) and Argos Pro ($100 per month for 35,000 screenshots), reflecting that UXPass costs more to run than a perf monitor (LLM hat calls) but less than a full visual regression service (no per-snapshot baselines to maintain).

### 9.1 Recommended tiers

| Tier | Monthly | What's included | Target |
|---|---|---|---|
| **Free / Indie** | $0 | 1 project, 50 runs/mo, 4 hats (the MVP set), public packs only, community Synthesiser model | Indie devs, OSS maintainers, evaluation |
| **Pro** | $29 per project | 1 project, 500 runs/mo, all 18 hats, private packs, Figma adapter, GitHub Action, Slack/Telegram via Signals, 14-day run retention | Solo SaaS, freelance designers, small agencies |
| **Team** | $99 per workspace | 5 projects bundled, 2,500 runs/mo total, SSO, brand-tokens upload, custom hats, BackstagePass-backed credential vault, 90-day retention, priority Synthesiser model | SMB SaaS teams, design system teams, mid-market agencies |
| **Enterprise** | Sales-led | Unlimited projects, dedicated Synthesiser models (private LLM), private hat marketplace, SOC 2 Type II posture, audit log, dedicated CSM | Larger orgs with procurement, regulated industries |

Add-on: extra runs at **$0.05 per run** (covers LLM cost with margin), and extra hats at **$10 per custom hat per month** for Team and above.

### 9.2 Why these numbers

Three anchors. Vercel Speed Insights at $10 per project per month sets the floor for "perf-adjacent CI gate"; UXPass costs more because it runs eighteen hats. Argos Pro at $100 per month for 35,000 screenshots sets the ceiling for visual regression; UXPass costs less because runs are bounded by hat count, not snapshot count. Hotjar Plus at $39 per month sets the SMB band; UXPass Pro at $29 undercuts it because UXPass does not store unbounded session data.

### 9.3 Positioning sentence

"UXPass is what you run before you ship. Hotjar is what you run after." That is the entire pitch.

---

## 10. Phase 9: Risks and counterarguments

Six risks, each with a mitigation already in the architecture or roadmap.

### 10.1 Hallucination on visual judgement

**Risk.** LLMs sometimes miss obvious things or invent issues that are not on the page.

**Mitigation.** Three layers. First, every LLM verdict is paired with deterministic evidence (axe rule id, computed style, accessibility tree node id, screenshot region). The Synthesiser drops findings that lack evidence pointers. Second, each finding is shown in the report tagged "Claude says..." or "Synthesiser says..." so users treat them as informed second opinions. Third, the UX Score weights deterministic checks twice as heavily as LLM-only judgements in the underlying composite.

### 10.2 Cost per run with 18 hats firing parallel LLM calls

**Risk.** Eighteen LLM calls per run plus a Synthesiser at decent context size could run $0.30 to $1.00 per run on premium models.

**Mitigation.** Two moves. The default Synthesiser model is a smaller faster model (Haiku-class, GPT-5-mini class) with the option to upgrade to a Sonnet or GPT-5 class for Team and Enterprise. Hats that operate on small evidence packets (Privacy and Trust, Content, Cognitive Load) run on the cheap tier; hats that need full screenshots and video (Visual Designer, Motion) run on the medium tier. Empirically this should land most runs at $0.08 to $0.20.

### 10.3 Visual diff false positives

**Risk.** Font subpixel anti-aliasing and dynamic content cause noisy diffs in visual regression tools.

**Mitigation.** UXPass does not lead with pixel diff. The headline metric is the UX Score; pixel diff is a secondary signal in the visual layer. When pixel diff runs, Odiff's anti-aliasing tolerance is tuned for typical browser rendering, plus a Visual Designer hat reviews regions flagged by Odiff and can override "this is just font hinting noise" before any human sees it.

### 10.4 Figma API rate limits

**Risk.** Figma REST API rate limits at the tenant level can block frequent runs.

**Mitigation.** Figma frames are cached per file version (using the file's `version` field) for 24 hours by default. The Figma adapter only re-fetches when the frame changes. For Enterprise customers with very large files, a "Figma webhook" mode listens for `FILE_UPDATE` events instead of polling.

### 10.5 Hat overlap and verdict noise

**Risk.** Accessibility, Visual Designer and Brand Steward all flagging the same low-contrast button creates noise.

**Mitigation.** The Synthesiser explicitly resolves overlap. Findings that share a DOM selector and a similar issue label are merged into one composite finding with three corroborating sources (and the merged finding is weighted higher). The user sees one issue, not three.

### 10.6 The "how is this different from Lighthouse + axe + Chromatic" pushback

**Risk.** A reasonable buyer asks why they should not just stitch together Lighthouse, axe and Chromatic.

**Mitigation.** UXPass owns five dimensions that the stitched stack does not measure: Agent Readability, Dark Pattern Cleanliness, Aesthetic Coherence, Motion Quality and First-Run Quality. The marketing site has a comparison table showing exactly which checks each of Lighthouse, axe, Chromatic and Stark cover, and which boxes only UXPass ticks. The composite UX Score is the headline because no other tool has one.

### 10.7 Legal note: regulatory accuracy

The Dark Pattern Detector hat ships with date-aware citations. The FTC click-to-cancel rule was vacated 8 July 2025 by the Eighth Circuit and is **not** in force. The FTC published an Advance Notice of Proposed Rulemaking in early 2026 and comments closed 13 April 2026. The EU DSA Article 25 has been in force since 17 February 2024. Reports must cite these accurately; saying otherwise misleads buyers.

---

## 11. Phase 10: Slogan and naming

Name confirmed: **UXPass**. Sister to TestPass. Retains the "Pass" suffix that ties to the UnClick family (TestPass, BackstagePass) and signals "this PR passes UX review."

### 11.1 Slogan options

Five candidates, all in UnClick house style: short, punchy, no em dashes, plain English.

1. **"Every pixel earns its place."** Strongest. Implies rigour, taste, and a critic's eye. Pairs with the hat panel concept.
2. **"Eighteen critics. One score."** Most concrete differentiator stated outright.
3. **"Where humans and agents both win."** Echoes the UnClick parent slogan ("Where AI belongs. Humans welcome.") and lands the agent-readability angle.
4. **"Ship UI that ships itself."** Cheeky, agent-native, says "your UI is good enough that an AI agent can sell it for you."
5. **"UX, before you ship."** Plain, factual. Pairs with the pricing positioning sentence ("UXPass before, Hotjar after").

### 11.2 Recommendation

Lead public marketing with **"Every pixel earns its place."** Use **"Eighteen critics. One score."** as the supporting subhead. Tagline pair on the marketing page:

> Every pixel earns its place.
> Eighteen specialised AI critics tear apart your UI in parallel and synthesise a verdict before your PR merges.

Tucks the hat panel into a single sentence, keeps the "AI critics" phrase that nobody else can claim today, and lands in the same typographic shape as TestPass.

---

## 12. Conclusion: the bet

UXPass wins or loses on three commitments. First, the hat panel must produce verdicts that are demonstrably better than running Lighthouse plus axe plus Chromatic separately, because that is the obvious DIY alternative. The eighteen-hat composite, the Synthesiser, and the five blue-ocean dimensions are the answer.

Second, the agent-readability angle must mature fast. Stagehand v3, browser-use's 90,000 stars, the llms.txt proposal reaching real adoption, and the rise of agentic browsers (Atlas, Comet) all point the same direction: agent-friendly UIs are the next conversion battleground. UXPass is the only tool that grades it. Owning that wedge in 2026 is the whole game.

Third, the bolt-on architecture must hold. Every UnClick tool QC'ing itself with UXPass is the proof. If TestPass's admin UI ships with a UX Score of 92 and a public report that anyone can replicate, that is more credible than any landing page copy. UnClick eats its own dog food publicly, and UXPass becomes the lens through which everyone sees the family.

The slogan ties it together. **Every pixel earns its place.** Eighteen critics, one score, and the only tool that grades a UI for the humans and the agents who will increasingly browse alongside them.
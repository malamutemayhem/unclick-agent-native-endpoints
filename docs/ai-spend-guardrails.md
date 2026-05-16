# AI spend guardrails

Closes UnClick todo "AI spend guardrails: provider inventory, cost labels, and default-off paid calls".

## What this ships

A guard wrapper for every call site that hits an external AI provider, plus an inventory script that lists all current call sites so the wrapping can be applied systematically.

| File | Role |
|---|---|
| `src/lib/aiSpendGuard.ts` | `withSpendGuard()` wrapper + provider registry + spend-event recording + `summariseSpend()` reporter. |
| `src/lib/aiSpendGuard.test.ts` | Full vitest coverage. |
| `scripts/audit-ai-call-sites.mjs` | Lists every file using OpenAI / Anthropic / Cohere / Groq / etc, grouped by provider, with a `guarded` flag per file. |

## Default behaviour

- **Free / local** call sites (e.g., self-hosted Ollama) -> allowed by default.
- **Metered** call sites (OpenAI, Anthropic, Cohere, Groq, Replicate, Stability, ElevenLabs, AssemblyAI, etc.) -> **blocked by default**. Requires an explicit env opt-in (`UNCLICK_AISPEND_<PROVIDER>_<SHORT>=1`).
- **Unknown** call sites (not in the registry) -> blocked. Fail loud is safer than silently spending.

`withSpendGuard({ label, provider }, async () => provider.call(...))` throws `SpendGuardError` when blocked. The caller decides whether to fall back to a free provider, surface to the user, or fail the request.

## Why default-off

When tests / CI / scheduled runs hit a metered endpoint, the bill silently accrues. Default-off forces explicit env opt-in per call site so:

- CI tests can't accidentally spend.
- Local dev runs can't accidentally spend unless the dev sets the env var.
- Production deployments set the env vars explicitly per-environment as part of the deploy config.

This mirrors the rank-20 "Protected surfaces, safety deny-lists, and default-deny claim rules" pattern.

## Inventory + migration recipe

```bash
node scripts/audit-ai-call-sites.mjs --json > ai-callsites.json
```

For each entry in the audit's `callSites` list with `"guarded": false`:

1. Open the file.
2. Identify the existing call:
   ```ts
   const result = await openai.chat.completions.create({ ... });
   ```
3. Wrap it:
   ```ts
   import { withSpendGuard } from "~/lib/aiSpendGuard";

   const result = await withSpendGuard(
     { provider: "openai", label: "openai/chat-completion" },
     () => openai.chat.completions.create({ ... }),
   );
   ```
4. Match the `label` to the entry in the default registry inside `aiSpendGuard.ts`. If a new label is needed (e.g., a finer-grained one for a specific model), add it to the registry first.
5. The opt-in env var is documented inline in the registry; surface it in your `.env.example`.

## Reporting

Pass a `SpendState` through to record spend events for downstream telemetry:

```ts
import { createSpendState, withSpendGuard, summariseSpend } from "~/lib/aiSpendGuard";

const state = createSpendState();
// ... many calls ...
await withSpendGuard(..., () => ..., { state });
const summary = summariseSpend(state);
// summary.allowed, summary.blocked, summary.by_provider, summary.recent_blocked
```

The admin UI can call `summariseSpend(globalState)` per request to render a "today's spend by provider" widget.

## What's NOT in scope

- No actual cost-in-dollars calculation. The guard only knows cost class. Per-token / per-request dollar math is a follow-up todo against the same parent ScopePack.
- No automatic call-site swapping. The audit script lists; workers wrap.
- No HSM / KMS-style key vault, that's separate work.
- No quota enforcement (e.g., "no more than N calls/hour"). Out of scope for v0.

## Acceptance (ScopePack 85% -> this drop brings it to ready-for-merge)

- [x] `aiSpendGuard.ts` exports `withSpendGuard`, `evaluateGuard`, `summariseSpend`, `createSpendState`, `SpendGuardError`.
- [x] Default registry covers Anthropic, OpenAI (chat + embed), Cohere, Groq, Replicate, Stability, ElevenLabs, AssemblyAI + local Ollama as the free baseline.
- [x] Metered calls require env opt-in; unknown calls default-deny.
- [x] Spend events recorded with allowed/blocked + cost class + provider + label.
- [x] `summariseSpend` returns counts by cost class, by provider, and recent_blocked.
- [x] `audit-ai-call-sites.mjs` lists every file using a known provider SDK with a `guarded` flag per file.
- [x] Tests cover happy path, default-deny, env opt-in, force_allow, unknown call, state recording, summary aggregation, recent_blocked limiting.

## Source

Drafted 2026-05-15 by `claude-cowork-coordinator-seat`. Files in `Z:\Other computers\My laptop\G\CV\_unclick-drafts\ai-spend-guardrails\`.

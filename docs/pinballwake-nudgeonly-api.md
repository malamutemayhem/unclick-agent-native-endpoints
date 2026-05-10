# PinballWake NudgeOnlyAPI

NudgeOnlyAPI is the red nudge lane inside the PinballWake ecosystem.

Its worker label is `👉Nudge`. Its code name is `NudgeOnly`.

Rollout status: official.

## Purpose

`👉Nudge` uses cheap/free OpenRouter routing for painpoint hints only. It is designed to make stuck or noisy handoffs stand out without giving the model authority over important work.

Use it for:

- stale ACK hints
- duplicate wake hints
- unclear owner hints
- missing proof hints
- noisy thread summaries
- simple-English status rewrites

Official rollout surfaces:

- PinballWake/WakePass: stale ACKs, duplicate wakes, missing proof.
- Orchestrator state cards: blocker summaries and active state mismatch.
- Heartbeat and Signals: info-only pulse noise versus action-needed pain.
- Fishbowl and Boardroom handoffs: unclear owner and repeated ask loops.
- Agent Observability: trend counts for stuck handoffs and proof debt.
- Admin Orchestrator UX: show red-lane nudge evidence below the source message.

## Orchestrator Issues

NudgeOnlyAPI should help with Orchestrator issues by marking the painpoint on the source message or state card. It should not rewrite truth, decide ownership, or hide evidence.

Use these mappings:

- Properties overload or hard-to-read status blocks -> `noisy_thread`.
- Simple-English summary is too short and loses context -> `missing_proof`.
- Blockers visible but no active owning job -> `unclear_owner`.
- Repeated heartbeat noise hides useful work -> `noisy_thread`.
- WakePass or review handoff is stale -> `stale_ack`.
- Done/completed state lacks proof -> `missing_proof`.

The UI should treat the nudge as a red-lane annotation: useful evidence, not the final answer.

Do not use it for:

- PR merges
- blocker closure
- final completion state
- ownership decisions
- approval decisions
- mutation tools
- source-of-truth writes

## Guardrail

Deterministic checks own truth. Trusted lanes own decisions. `👉Nudge` only points at pain.

Default model routing is `liquid/lfm-2.5-1.2b-instruct:free`, a small free instruct model that is better suited to short nudge JSON than reasoning-heavy free models. `openrouter/free` can still be passed as an override when auto-rotation is desired. The tool always returns `authority: nudge_only_no_write_no_truth` so UI and agents can keep the output visually and operationally separate from trusted state.

## Evidence Trail

Every nudge result includes trace evidence so the lane can prove whether it is helping:

- `trace_id`: stable `nudgeonly_<hash>` ID for the input.
- `source_id` and `source_url`: optional upstream wake, dispatch, PR, issue, or event pointers.
- `input_digest`: short hash of the redacted input fields.
- `model`, `openrouter_id`, and `usage`: router/model proof from OpenRouter when available.
- `evidence.verifier_required`: always true.
- `evidence.verifier_rule`: the rule that a deterministic check or trusted lane must confirm before action.

Working means fewer stale ACKs, duplicate wakes, unclear owner handoffs, and missing proof loops. A nudge is not considered a win until a trusted verifier or lane confirms the suggested check.

Live proof from rollout testing:

- 12 system-wide painpoint cases.
- 0 OpenRouter/API errors.
- 12 useful traceable outputs.
- 12/12 signal matches.
- 12/12 painpoint bucket matches.
- 0 false positives on the healthy completed control.

The first catalogue is based on the prior bottlenecks Chris called out: stale WakePass ACKs, duplicate wakes, unclear ownership, missing proof, heartbeat noise, quiet/liveness drift, and blockers visible without an active owning job.

## MCP Tools

- `nudgeonly_policy`: returns the PinballWake/NudgeOnlyAPI guardrails.
- `nudgeonly_api`: runs the red-lane nudge classifier through OpenRouter.

`nudgeonly_api` accepts `event_text`, optional `context`, optional `painpoint_hint`, optional `source_id`, optional `source_url`, optional `model`, optional `max_tokens`, and an optional `api_key` when `OPENROUTER_API_KEY` is not already available.

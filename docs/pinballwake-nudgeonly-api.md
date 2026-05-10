# PinballWake NudgeOnlyAPI

NudgeOnlyAPI is the red nudge lane inside the PinballWake ecosystem.

Its worker label is `👉Nudge`. Its code name is `NudgeOnly`.

## Purpose

`👉Nudge` uses cheap/free OpenRouter routing for painpoint hints only. It is designed to make stuck or noisy handoffs stand out without giving the model authority over important work.

Use it for:

- stale ACK hints
- duplicate wake hints
- unclear owner hints
- missing proof hints
- noisy thread summaries
- simple-English status rewrites

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

Default model routing is `openrouter/free`, which lets OpenRouter select an available free model for the request. The tool still returns `authority: nudge_only_no_write_no_truth` so UI and agents can keep the output visually and operationally separate from trusted state.

## Evidence Trail

Every nudge result includes trace evidence so the lane can prove whether it is helping:

- `trace_id`: stable `nudgeonly_<hash>` ID for the input.
- `source_id` and `source_url`: optional upstream wake, dispatch, PR, issue, or event pointers.
- `input_digest`: short hash of the redacted input fields.
- `model`, `openrouter_id`, and `usage`: router/model proof from OpenRouter when available.
- `evidence.verifier_required`: always true.
- `evidence.verifier_rule`: the rule that a deterministic check or trusted lane must confirm before action.

Working means fewer stale ACKs, duplicate wakes, unclear owner handoffs, and missing proof loops. A nudge is not considered a win until a trusted verifier or lane confirms the suggested check.

## MCP Tools

- `nudgeonly_policy`: returns the PinballWake/NudgeOnlyAPI guardrails.
- `nudgeonly_api`: runs the red-lane nudge classifier through OpenRouter.

`nudgeonly_api` accepts `event_text`, optional `context`, optional `painpoint_hint`, optional `source_id`, optional `source_url`, optional `model`, optional `max_tokens`, and an optional `api_key` when `OPENROUTER_API_KEY` is not already available.

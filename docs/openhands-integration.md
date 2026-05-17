# OpenHands Integration

## Status

This is the v1 test-mode adapter for the Autopilot Executor Lane. It lets UnClick prove the missing middle step: a scoped job can be handed to an OpenHands-style coder, returned as a patch, checked by the existing coding room gate, and represented as a receipt.

OpenHands is one builder engine inside UnClick, not a replacement for UnClick and not a claim that OpenHands is always the best coder. The engine-agnostic production lane is documented in [Builder Engine Lane](builder-engine-lane.md). UnClick stays the factory: it owns the job, ScopePack, routing, memory, proof, review, and safety gates.

This file does not enable production code-writing. The adapter is opt-in and requires `OPENHANDS_TEST_MODE=1` or an explicit test harness flag.

## Flow

1. The heartbeat or runner selects one safe, scoped todo.
2. The job ScopePack provides `owned_files`, acceptance, verification, and safety stops.
3. The UnClick router chooses OpenHands only when the job shape fits this adapter.
4. `scripts/pinballwake-openhands-worker.mjs` builds a narrow task prompt.
5. A caller-provided OpenHands runner returns a unified diff patch.
6. The adapter submits the patch to the coding room gate.
7. The gate accepts only changed files inside the owned set.
8. The adapter emits `openhands_worker_pass` or `openhands_worker_hold`.
9. A separate reviewer role still returns PASS or BLOCKER before ship.

`scripts/pinballwake-openhands-proof-runner.mjs` is the v1 binding for proof runs. It can use a real OpenHands CLI command supplied through `OPENHANDS_COMMAND`, or a docs-only fixture runner when `OPENHANDS_PROOF_FIXTURE_PATCH=1` is set for local and workflow tests. OpenHands CLI docs describe `--task`, `--headless`, and `--json` at https://docs.openhands.dev/openhands/usage/cli/command-reference. The OpenHands environment reference is https://docs.openhands.dev/openhands/usage/environment-variables.

## Guardrails

- Test mode is required by default.
- The adapter does not commit, push, merge, deploy, or mutate production data.
- The default coding room submitter rejects patches outside `owned_files`.
- Receipts redact common token, secret, password, credential, and API key shapes.
- A caller can wrap the OpenHands invocation with a spend guard by passing `spendGuard`.
- The GitHub workflow is manual only and default off.
- GitHub Actions are treated as proof only when checks are fresh and responsive. Stalled checks need timeout, local targeted verification, or reroute.

## Expected Environment

For real OpenHands use, the worker that provides the `openHands` function should own its secrets outside the repo:

- `OPENHANDS_TEST_MODE=1`
- optional `OPENHANDS_COMMAND`, defaulting to `openhands`
- optional `OPENHANDS_ARGS`, defaulting to `--headless --json --task {prompt}`
- optional `OPENHANDS_PATCH_FILE` when the runner writes a patch file instead of printing a unified diff
- model provider key, stored only in CI or worker secret storage
- repo-scoped token for draft PR creation, stored only in CI or worker secret storage
- an external cost or spend limit guard

The repository should not store OpenHands provider keys or GitHub tokens.

## Acceptance

- `node --test scripts/pinballwake-openhands-worker.test.mjs` passes.
- `node --test scripts/pinballwake-openhands-proof-runner.test.mjs` passes.
- A tiny test todo can produce a patch through the injected runner.
- The coding room gate refuses a patch outside the todo's owned files.
- A pass receipt contains changed files, patch size, optional PR URL, optional head SHA, and optional test run id.

## Deferred

- Running the real OpenHands CLI or Docker image from this repo.
- Automatic production-mode execution.
- Automatic merge.
- Multi-job parallel execution.
- Dollar-level cost accounting.

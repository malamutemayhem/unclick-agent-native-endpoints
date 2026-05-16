# OpenHands Integration

## Status

This is the v1 test-mode adapter for the Autopilot Executor Lane. It lets UnClick prove the missing middle step: a scoped job can be handed to an OpenHands-style coder, returned as a patch, checked by the existing coding room gate, and represented as a receipt.

This file does not enable production code-writing. The adapter is opt-in and requires `OPENHANDS_TEST_MODE=1` or an explicit test harness flag.

## Flow

1. The heartbeat or runner selects one safe, scoped todo.
2. The job ScopePack provides `owned_files`, acceptance, and verification.
3. `scripts/pinballwake-openhands-worker.mjs` builds a narrow task prompt.
4. A caller-provided OpenHands runner returns a unified diff patch.
5. The adapter submits the patch to the coding room gate.
6. The gate accepts only changed files inside the owned set.
7. The adapter emits `openhands_worker_pass` or `openhands_worker_hold`.

## Guardrails

- Test mode is required by default.
- The adapter does not commit, push, merge, deploy, or mutate production data.
- The default coding room submitter rejects patches outside `owned_files`.
- Receipts redact common token, secret, password, credential, and API key shapes.
- A caller can wrap the OpenHands invocation with a spend guard by passing `spendGuard`.
- The GitHub workflow is manual only and default off.

## Expected Environment

For real OpenHands use, the worker that provides the `openHands` function should own its secrets outside the repo:

- `OPENHANDS_TEST_MODE=1`
- model provider key, stored only in CI or worker secret storage
- repo-scoped token for draft PR creation, stored only in CI or worker secret storage
- an external cost or spend limit guard

The repository should not store OpenHands provider keys or GitHub tokens.

## Acceptance

- `node --test scripts/pinballwake-openhands-worker.test.mjs` passes.
- A tiny test todo can produce a patch through the injected runner.
- The coding room gate refuses a patch outside the todo's owned files.
- A pass receipt contains changed files, patch size, optional PR URL, optional head SHA, and optional test run id.

## Deferred

- Running the real OpenHands CLI or Docker image from this repo.
- Automatic production-mode execution.
- Automatic merge.
- Multi-job parallel execution.
- Dollar-level cost accounting.

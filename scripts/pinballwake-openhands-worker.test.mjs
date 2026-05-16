// scripts/pinballwake-openhands-worker.test.mjs

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { buildOpenHandsTaskPrompt, runOpenHandsWorker, __testing__ } from "./pinballwake-openhands-worker.mjs";

const NOW = new Date("2026-05-16T15:35:00.000Z");

function job(overrides = {}) {
  return {
    job_id: "coding-room:todo-843e669c:test",
    todo_id: "843e669c-0ae1-4d52-b91a-23e24822d5b3",
    title: "Autopilot Executor Lane: build_attempt/test-run receipts",
    chip: "OpenHands worker test mode",
    owned_files: ["docs/openhands-integration.md"],
    ...overrides,
  };
}

function scopePack(overrides = {}) {
  return {
    scope_pack_comment_id: "ecf968e0-6ba5-4d51-be48-0ddd3fae4ac3",
    owned_files: ["docs/openhands-integration.md"],
    acceptance: ["OpenHands adapter returns canonical receipts"],
    verification: ["node --test scripts/pinballwake-openhands-worker.test.mjs"],
    ...overrides,
  };
}

function patchFor(file = "docs/openhands-integration.md") {
  return [
    `diff --git a/${file} b/${file}`,
    "index 1111111..2222222 100644",
    `--- a/${file}`,
    `+++ b/${file}`,
    "@@ -1 +1,2 @@",
    " # OpenHands Integration",
    "+Test-mode adapter proof.",
    "",
  ].join("\n");
}

describe("buildOpenHandsTaskPrompt", () => {
  test("keeps the prompt scoped to owned files and no write-side effects", () => {
    const prompt = buildOpenHandsTaskPrompt({ job: job(), scopePack: scopePack() });

    assert.match(prompt, /Return a unified diff patch only/);
    assert.match(prompt, /docs\/openhands-integration\.md/);
    assert.match(prompt, /node --test scripts\/pinballwake-openhands-worker\.test\.mjs/);
  });
});

describe("runOpenHandsWorker", () => {
  test("returns PASS when OpenHands produces a patch and coderoom accepts it", async () => {
    let spendGuardCalls = 0;
    let coderoomCalls = 0;
    const result = await runOpenHandsWorker({
      job: job(),
      scopePack: scopePack(),
      testMode: true,
      now: NOW,
      spendGuard: async (event, run) => {
        spendGuardCalls += 1;
        assert.equal(event.label, "openhands/test-mode");
        return run();
      },
      openHands: async ({ prompt }) => {
        assert.match(prompt, /OpenHands worker test mode/);
        return {
          ok: true,
          patch: patchFor(),
          summary: "Adds the test-mode integration doc line.",
          test_run_id: "node-test-openhands-worker",
          test_exit_code: 0,
        };
      },
      coderoom: async ({ changedFiles, patch }) => {
        coderoomCalls += 1;
        assert.deepEqual(changedFiles, ["docs/openhands-integration.md"]);
        assert.match(patch, /Test-mode adapter proof/);
        return {
          ok: true,
          pr_url: "https://github.com/malamutemayhem/unclick/pull/873",
          head_sha_after: "abc123def456",
          test_run_id: "node-test-openhands-worker",
          test_exit_code: 0,
          status: "testing",
        };
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.receipt.receipt_type, __testing__.RECEIPT_TYPE_PASS);
    assert.equal(result.receipt.evidence.pr_url, "https://github.com/malamutemayhem/unclick/pull/873");
    assert.equal(result.receipt.evidence.test_run_id, "node-test-openhands-worker");
    assert.equal(result.receipt.xpass_advisory, true);
    assert.equal(result.receipt.sanitized, true);
    assert.equal(spendGuardCalls, 1);
    assert.equal(coderoomCalls, 1);
  });

  test("returns HOLD when test mode is not enabled", async () => {
    const result = await runOpenHandsWorker({
      job: job(),
      scopePack: scopePack(),
      env: {},
      openHands: async () => ({ ok: true, patch: patchFor() }),
      now: NOW,
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, "openhands_test_mode_required");
    assert.equal(result.receipt.receipt_type, __testing__.RECEIPT_TYPE_HOLD);
  });

  test("returns HOLD on OpenHands timeout", async () => {
    const result = await runOpenHandsWorker({
      job: job(),
      scopePack: scopePack(),
      testMode: true,
      now: NOW,
      openHands: async () => {
        const err = new Error("OpenHands timed out");
        err.code = "ETIMEDOUT";
        throw err;
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, "openhands_timeout");
    assert.equal(result.receipt.hold_reason, "openhands_timeout");
  });

  test("returns HOLD when OpenHands reports failure", async () => {
    const result = await runOpenHandsWorker({
      job: job(),
      scopePack: scopePack(),
      testMode: true,
      now: NOW,
      openHands: async () => ({ ok: false, exit_code: 1, output: "tests failed" }),
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, "openhands_reported_failure");
    assert.equal(result.receipt.evidence.exit_code, 1);
    assert.match(result.receipt.evidence.output, /tests failed/);
  });

  test("returns HOLD when coderoom rejects the patch", async () => {
    const result = await runOpenHandsWorker({
      job: job(),
      scopePack: scopePack(),
      testMode: true,
      now: NOW,
      openHands: async () => ({ ok: true, patch: patchFor("src/outside-owned.ts") }),
      coderoom: async () => ({ ok: false, reason: "changed_file_outside_ownership", file: "src/outside-owned.ts" }),
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, "coderoom_rejected_patch");
    assert.equal(result.receipt.evidence.reason, "changed_file_outside_ownership");
    assert.equal(result.receipt.evidence.file, "src/outside-owned.ts");
  });

  test("default coderoom submit enforces owned files", async () => {
    const result = await runOpenHandsWorker({
      job: job(),
      scopePack: scopePack(),
      testMode: true,
      now: NOW,
      openHands: async () => ({ ok: true, patch: patchFor("src/outside-owned.ts") }),
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, "coderoom_rejected_patch");
    assert.equal(result.receipt.evidence.reason, "changed_file_outside_ownership");
  });
});

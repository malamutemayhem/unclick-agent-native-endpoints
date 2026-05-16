import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildDocsOnlyFixturePatch,
  buildOpenHandsCliArgs,
  createDraftPrCoderoom,
  createFixtureOpenHandsRunner,
  runOpenHandsProof,
  splitArgs,
} from "./pinballwake-openhands-proof-runner.mjs";

const NOW = new Date("2026-05-16T23:40:00.000Z");
const FIXTURE = "docs/openhands-proof-fixture.md";

describe("OpenHands proof runner helpers", () => {
  test("splits quoted CLI args and injects the prompt as one argument", () => {
    assert.deepEqual(splitArgs('--headless --json --task "{prompt}"'), ["--headless", "--json", "--task", "{prompt}"]);

    const args = buildOpenHandsCliArgs({
      prompt: "Edit docs only\nReturn a patch.",
      argsTemplate: "--headless --json --task {prompt}",
    });

    assert.deepEqual(args, ["--headless", "--json", "--task", "Edit docs only\nReturn a patch."]);
  });

  test("builds a docs-only fixture patch inside the owned file", () => {
    const patch = buildDocsOnlyFixturePatch({
      filePath: FIXTURE,
      proofLine: "- proof run: unit-test",
    });

    assert.match(patch, /diff --git a\/docs\/openhands-proof-fixture\.md b\/docs\/openhands-proof-fixture\.md/);
    assert.match(patch, /\+[-] proof run: unit-test/);
  });

  test("runs fixture OpenHands through the worker and coderoom", async () => {
    let coderoomCalls = 0;
    const result = await runOpenHandsProof({
      now: NOW,
      env: { OPENHANDS_TEST_MODE: "1" },
      filePath: FIXTURE,
      openHands: createFixtureOpenHandsRunner({ filePath: FIXTURE, now: NOW }),
      coderoom: async ({ changedFiles, patch }) => {
        coderoomCalls += 1;
        assert.deepEqual(changedFiles, [FIXTURE]);
        assert.match(patch, /proof run: 2026-05-16T23:40:00.000Z/);
        return {
          ok: true,
          pr_url: "https://github.com/malamutemayhem/unclick/pull/902",
          head_sha_after: "abc123",
          test_run_id: "openhands-fixture-2026",
          test_exit_code: 0,
          status: "draft_pr_created",
        };
      },
    });

    assert.equal(result.ok, true);
    assert.equal(coderoomCalls, 1);
    assert.equal(result.receipt.receipt_type, "openhands_worker_pass");
    assert.equal(result.receipt.evidence.pr_url, "https://github.com/malamutemayhem/unclick/pull/902");
  });
});

describe("draft PR coderoom binding", () => {
  test("refuses non-docs patches before any git write", async () => {
    const calls = [];
    const coderoom = createDraftPrCoderoom({
      runProcess: async (command, args) => {
        calls.push([command, args]);
        return { ok: true, stdout: "", stderr: "", output: "" };
      },
    });

    const result = await coderoom({
      job: { owned_files: ["src/not-docs.ts"] },
      changedFiles: ["src/not-docs.ts"],
      patch: "diff --git a/src/not-docs.ts b/src/not-docs.ts\n--- a/src/not-docs.ts\n+++ b/src/not-docs.ts\n@@ -1 +1 @@\n-old\n+new\n",
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, "non_docs_patch_refused");
    assert.deepEqual(calls, []);
  });

  test("creates a draft PR only after clean status and docs-only validation", async () => {
    const calls = [];
    const coderoom = createDraftPrCoderoom({
      branchName: "codex/openhands-proof-test",
      runProcess: async (command, args, options = {}) => {
        calls.push([command, args, Boolean(options.stdin)]);
        if (command === "gh") {
          return { ok: true, stdout: "https://github.com/malamutemayhem/unclick/pull/902\n", stderr: "", output: "" };
        }
        if (command === "git" && args[0] === "rev-parse") {
          return { ok: true, stdout: "abc123\n", stderr: "", output: "" };
        }
        return { ok: true, stdout: "", stderr: "", output: "" };
      },
    });

    const result = await coderoom({
      job: { todo_id: "todo-1", owned_files: [FIXTURE] },
      changedFiles: [FIXTURE],
      patch: buildDocsOnlyFixturePatch({ filePath: FIXTURE, proofLine: "- proof run: draft-pr-test" }),
      summary: "Docs-only proof.",
      testRunId: "unit-test",
    });

    assert.equal(result.ok, true);
    assert.equal(result.pr_url, "https://github.com/malamutemayhem/unclick/pull/902");
    assert.deepEqual(
      calls.map(([command, args]) => `${command} ${args.slice(0, 2).join(" ")}`),
      [
        "git status --porcelain",
        "git checkout -b",
        "git apply --whitespace=nowarn",
        "git add docs/openhands-proof-fixture.md",
        "git commit -m",
        "git push -u",
        "gh pr create",
        "git rev-parse HEAD",
      ],
    );
    assert.equal(calls[2][2], true);
  });
});

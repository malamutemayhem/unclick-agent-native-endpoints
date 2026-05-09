import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  claimCodingRoomJob,
  createCodingRoomJob,
  createCodingRoomJobLedger,
  writeCodingRoomJobLedger,
} from "./pinballwake-coding-room.mjs";
import {
  commandToArgv,
  executeCodingRoomProofJob,
  executeCodingRoomProofLedgerFile,
  executeCodingRoomProofLedgerJob,
  getProofCommandsForJob,
  isProofCommandAllowed,
} from "./pinballwake-proof-executor.mjs";

const runner = {
  id: "pinballwake-job-runner",
  readiness: "builder_ready",
  capabilities: ["implementation", "test_fix"],
};

function proofJob(input = {}) {
  return claimCodingRoomJob({
    runner,
    job: createCodingRoomJob({
      jobId: input.jobId || "coding-room:proof:test",
      worker: "pinballwake-job-runner",
      chip: "proof only",
      files: ["scripts/pinballwake-proof-executor.mjs"],
      expectedProof: {
        requiresPr: false,
        requiresChangedFiles: false,
        requiresNonOverlap: false,
        requiresTests: true,
        tests: input.tests || ["node --test scripts/pinballwake-proof-executor.test.mjs"],
      },
    }),
    now: "2026-05-04T00:00:00.000Z",
  }).job;
}

describe("PinballWake proof executor", () => {
  it("parses simple quoted commands without shell expansion", () => {
    assert.deepEqual(commandToArgv("node --test \"scripts/example test.mjs\""), [
      "node",
      "--test",
      "scripts/example test.mjs",
    ]);
    assert.throws(() => commandToArgv("node --test 'scripts/example.mjs"), /Unclosed quote/);
  });

  it("allows only explicit proof command prefixes and blocks shell metacharacters", () => {
    assert.equal(isProofCommandAllowed("node --test scripts/pinballwake-proof-executor.test.mjs"), true);
    assert.equal(isProofCommandAllowed("npm run test:api"), true);
    assert.equal(isProofCommandAllowed("node scripts/delete-everything.mjs"), false);
    assert.equal(isProofCommandAllowed("node --test scripts/a.mjs && echo unsafe"), false);
    assert.equal(isProofCommandAllowed("node --test scripts/../evil.test.mjs"), false);
    assert.equal(isProofCommandAllowed("node --test \"scripts/broken.test.mjs"), false);
    assert.equal(isProofCommandAllowed("npm run build"), false);
  });

  it("reads expected proof commands from a coding room job", () => {
    assert.deepEqual(getProofCommandsForJob(proofJob({ tests: ["node --test scripts/a.mjs"] })), [
      "node --test scripts/a.mjs",
    ]);
  });

  it("runs allowlisted proof commands and records done proof", async () => {
    const job = proofJob({
      tests: ["node --test scripts/pinballwake-proof-executor.test.mjs"],
    });

    const result = await executeCodingRoomProofJob({
      job,
      now: "2026-05-04T00:01:00.000Z",
      runCommand: async (command) => ({
        command,
        status: "passed",
        exit_code: 0,
        output: "ok",
      }),
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "done");
    assert.equal(result.job.status, "proof_submitted");
    assert.equal(result.job.proof.tests[0].status, "passed");
  });

  it("carries build changed files into done proof when required", async () => {
    const job = {
      ...proofJob({
        tests: ["node --test scripts/pinballwake-proof-executor.test.mjs"],
      }),
      build_result: {
        result: "done",
        changed_files: ["scripts/pinballwake-proof-executor.mjs"],
        submitted_at: "2026-05-04T00:00:30.000Z",
      },
      expected_proof: {
        tests: ["node --test scripts/pinballwake-proof-executor.test.mjs"],
        requires_pr: false,
        requires_changed_files: true,
        requires_non_overlap: true,
        requires_tests: true,
      },
    };

    const result = await executeCodingRoomProofJob({
      job,
      now: "2026-05-04T00:01:00.000Z",
      runCommand: async (command) => ({
        command,
        status: "passed",
        exit_code: 0,
        output: "ok",
      }),
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "done");
    assert.deepEqual(result.job.proof.changed_files, ["scripts/pinballwake-proof-executor.mjs"]);
  });

  it("records blocker proof when a command is not allowlisted", async () => {
    const job = proofJob({
      tests: ["node scripts/danger.mjs"],
    });

    const result = await executeCodingRoomProofJob({
      job,
      now: "2026-05-04T00:01:00.000Z",
      runCommand: async () => {
        throw new Error("should not run");
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "blocker");
    assert.equal(result.reason, "proof_command_not_allowlisted");
    assert.equal(result.job.status, "blocked");
    assert.match(result.job.proof.blocker, /not allowlisted/);
  });

  it("records blocker proof for malformed proof commands instead of throwing", async () => {
    const job = proofJob({
      tests: ["node --test \"scripts/broken.test.mjs"],
    });

    const result = await executeCodingRoomProofJob({
      job,
      now: "2026-05-04T00:01:00.000Z",
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "blocker");
    assert.equal(result.reason, "proof_command_not_allowlisted");
    assert.equal(result.job.status, "blocked");
    assert.match(result.job.proof.blocker, /not allowlisted/);
  });

  it("records blocker proof when an allowlisted command fails", async () => {
    const job = proofJob({
      tests: ["node --test scripts/pinballwake-proof-executor.test.mjs"],
    });

    const result = await executeCodingRoomProofJob({
      job,
      now: "2026-05-04T00:01:00.000Z",
      runCommand: async (command) => ({
        command,
        status: "failed",
        exit_code: 1,
        output: "boom",
      }),
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "blocker");
    assert.equal(result.job.status, "blocked");
    assert.match(result.job.proof.blocker, /failed/);
  });

  it("refuses to execute unclaimed jobs or jobs with no proof commands", async () => {
    const unclaimed = createCodingRoomJob({
      worker: "pinballwake-job-runner",
      chip: "not claimed",
      files: ["scripts/pinballwake-proof-executor.mjs"],
      expectedProof: {
        requiresPr: false,
        requiresChangedFiles: false,
        tests: ["node --test scripts/pinballwake-proof-executor.test.mjs"],
      },
    });
    assert.equal((await executeCodingRoomProofJob({ job: unclaimed })).reason, "job_not_claimed");
    assert.equal((await executeCodingRoomProofJob({ job: proofJob({ tests: [] }) })).reason, "missing_proof_commands");
  });

  it("updates proof results inside a ledger", async () => {
    const job = proofJob({
      jobId: "coding-room:proof:ledger",
      tests: ["node --test scripts/pinballwake-proof-executor.test.mjs"],
    });
    const result = await executeCodingRoomProofLedgerJob({
      ledger: createCodingRoomJobLedger({ jobs: [job] }),
      jobId: job.job_id,
      now: "2026-05-04T00:01:00.000Z",
      runCommand: async (command) => ({
        command,
        status: "passed",
        exit_code: 0,
        output: "ok",
      }),
    });

    assert.equal(result.ok, true);
    assert.equal(result.ledger.jobs[0].status, "proof_submitted");
  });

  it("persists proof results to a ledger file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "proof-executor-"));
    const ledgerPath = join(dir, "ledger.json");
    try {
      const job = proofJob({
        jobId: "coding-room:proof:file",
        tests: ["node --test scripts/pinballwake-coding-room-runner.test.mjs"],
      });
      await writeCodingRoomJobLedger(ledgerPath, createCodingRoomJobLedger({ jobs: [job] }));

      const result = await executeCodingRoomProofLedgerFile({
        ledgerPath,
        jobId: job.job_id,
        now: "2026-05-04T00:01:00.000Z",
        dryRun: true,
      });

      assert.equal(result.ok, true);
      assert.equal(result.dry_run, true);
      assert.equal(result.ledger.jobs[0].status, "proof_submitted");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

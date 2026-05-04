import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  createCodingRoomJob,
  createCodingRoomJobLedger,
  createCodingRoomQcJob,
  createCodingRoomReviewJob,
  createCodingRoomSafetyJob,
  serializeCodingRoomJobLedger,
  submitCodingRoomReviewAck,
} from "./pinballwake-coding-room.mjs";
import {
  executeCodingRoomPipeline,
  executeCodingRoomPipelineFile,
} from "./pinballwake-pipeline-executor.mjs";

const runner = {
  id: "pinballwake-job-runner",
  readiness: "builder_ready",
  capabilities: ["implementation"],
};

function patchFor(file = "scripts/pipeline-executor-example.mjs") {
  return `diff --git a/${file} b/${file}
--- a/${file}
+++ b/${file}
@@ -1 +1 @@
-old
+new
`;
}

function greenCheck(name = "CI") {
  return {
    name,
    status: "COMPLETED",
    conclusion: "SUCCESS",
  };
}

function readyPr(input = {}) {
  return {
    number: 523,
    title: "feat(autopilot): add pipeline executor",
    isDraft: false,
    mergeStateStatus: "CLEAN",
    statusCheckRollup: [greenCheck("Website"), greenCheck("TestPass"), greenCheck("Vercel")],
    ...input,
  };
}

function codeJob(input = {}) {
  return createCodingRoomJob({
    jobId: input.jobId || "coding-room:pipeline-executor:job",
    prNumber: 523,
    worker: "pinballwake-job-runner",
    chip: "pipeline executor",
    files: input.files || ["scripts/pipeline-executor-example.mjs"],
    build: {
      patch: input.patch || patchFor(),
    },
    expectedProof: {
      requiresPr: false,
      requiresChangedFiles: true,
      requiresNonOverlap: true,
      requiresTests: true,
      tests: input.tests || ["node --test scripts/pinballwake-pipeline-executor.test.mjs"],
    },
    status: input.status || "queued",
    claimedBy: input.claimedBy,
    ...input.extra,
  });
}

function passReview(job, reviewer, summary = "PASS") {
  return submitCodingRoomReviewAck({
    job,
    ack: {
      result: "PASS",
      reviewer,
      summary,
    },
    now: "2026-05-04T00:03:00.000Z",
  }).job;
}

function reviewJobs() {
  return [
    passReview(createCodingRoomSafetyJob({ prNumber: 523 }), "gatekeeper", "Safety passed."),
    passReview(createCodingRoomQcJob({ prNumber: 523 }), "popcorn", "QC passed."),
    passReview(
      createCodingRoomReviewJob({
        prNumber: 523,
        worker: "forge",
        reviewKind: "merge_proof",
        requestedReviewers: ["forge"],
      }),
      "forge",
      "Implementation shape passed.",
    ),
  ];
}

function passingPatchRunner(calls = []) {
  return async (_patch, options) => {
    calls.push(options.check ? "check" : "apply");
    return { ok: true, exit_code: 0, output: "" };
  };
}

function passingProofRunner(calls = []) {
  return async (command) => {
    calls.push(command);
    return { command, status: "passed", exit_code: 0, output: "" };
  };
}

describe("PinballWake pipeline executor", () => {
  it("claims, builds, proves, and reports Merge Room ready without executing merge", async () => {
    const buildCalls = [];
    const proofCalls = [];
    const job = codeJob();
    const result = await executeCodingRoomPipeline({
      ledger: createCodingRoomJobLedger({ jobs: [job, ...reviewJobs()] }),
      runner,
      jobId: job.job_id,
      pr: readyPr(),
      applyPatch: passingPatchRunner(buildCalls),
      runCommand: passingProofRunner(proofCalls),
      now: "2026-05-04T00:00:00.000Z",
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "ready_to_merge");
    assert.equal(result.summary, "claimed -> built -> proved -> ready_to_merge");
    assert.deepEqual(buildCalls, ["check", "apply"]);
    assert.deepEqual(proofCalls, ["node --test scripts/pinballwake-pipeline-executor.test.mjs"]);
    assert.equal(result.job.status, "proof_submitted");
    assert.deepEqual(result.job.proof.changed_files, ["scripts/pipeline-executor-example.mjs"]);
    assert.equal(result.merge.reason, "merge_ready");
    assert.equal(result.merge.action, "merge_room");
    assert.deepEqual(result.merge.execute_plan, ["merge", "watch_post_merge"]);
  });

  it("routes full-PASS draft PRs to Merge Room lift decision instead of vague merge blocker", async () => {
    const job = codeJob();
    const result = await executeCodingRoomPipeline({
      ledger: createCodingRoomJobLedger({ jobs: [job, ...reviewJobs()] }),
      runner,
      jobId: job.job_id,
      pr: readyPr({ isDraft: true }),
      applyPatch: passingPatchRunner(),
      runCommand: passingProofRunner(),
      now: "2026-05-04T00:00:00.000Z",
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "blocker");
    assert.equal(result.reason, "draft_lift_not_authorized");
    assert.equal(result.merge.result, "needs_lift");
    assert.deepEqual(result.merge.missing, ["master_lift_authorization"]);
    assert.equal(result.steps.at(-1).result, "merge_blocked");
  });

  it("allows explicit fallback evidence to produce a lift-and-merge room plan", async () => {
    const job = codeJob();
    const result = await executeCodingRoomPipeline({
      ledger: createCodingRoomJobLedger({ jobs: [job, ...reviewJobs()] }),
      runner,
      jobId: job.job_id,
      pr: readyPr({ isDraft: true }),
      fallbackEvidence: { full_ack_set: true },
      applyPatch: passingPatchRunner(),
      runCommand: passingProofRunner(),
      now: "2026-05-04T00:00:00.000Z",
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "ready_to_lift_and_merge");
    assert.equal(result.merge.draft_lift_required, true);
    assert.deepEqual(result.merge.execute_plan, ["lift_draft", "merge", "watch_post_merge"]);
    assert.equal(result.steps.at(-1).result, "ready_to_lift_and_merge");
  });

  it("stops after proof when no PR state is supplied", async () => {
    const job = codeJob();
    const result = await executeCodingRoomPipeline({
      ledger: createCodingRoomJobLedger({ jobs: [job] }),
      runner,
      jobId: job.job_id,
      applyPatch: passingPatchRunner(),
      runCommand: passingProofRunner(),
    });

    assert.equal(result.result, "proof_submitted");
    assert.equal(result.reason, "missing_pr");
    assert.equal(result.summary, "claimed -> built -> proved -> merge_not_checked");
  });

  it("records a build blocker and does not run proof", async () => {
    const proofCalls = [];
    const job = codeJob({
      patch: patchFor("api/outside.ts"),
    });
    const result = await executeCodingRoomPipeline({
      ledger: createCodingRoomJobLedger({ jobs: [job] }),
      runner,
      jobId: job.job_id,
      applyPatch: passingPatchRunner(),
      runCommand: passingProofRunner(proofCalls),
    });

    assert.equal(result.result, "blocker");
    assert.equal(result.stage, "build");
    assert.equal(result.job.status, "blocked");
    assert.match(result.blocker, /outside_ownership/);
    assert.deepEqual(proofCalls, []);
  });

  it("records a proof blocker after a successful build", async () => {
    const job = codeJob({
      tests: ["node --eval console.log(1)"],
    });
    const result = await executeCodingRoomPipeline({
      ledger: createCodingRoomJobLedger({ jobs: [job] }),
      runner,
      jobId: job.job_id,
      applyPatch: passingPatchRunner(),
      runCommand: passingProofRunner(),
    });

    assert.equal(result.result, "blocker");
    assert.equal(result.stage, "proof");
    assert.equal(result.reason, "proof_command_not_allowlisted");
    assert.equal(result.job.status, "blocked");
  });

  it("does not mutate terminal or non-owned active jobs", async () => {
    for (const status of ["blocked", "done", "expired", "fallback_ready", "proof_submitted"]) {
      const job = codeJob({ status });
      const ledger = createCodingRoomJobLedger({ jobs: [job] });
      const before = JSON.stringify(ledger);
      const result = await executeCodingRoomPipeline({
        ledger,
        runner,
        jobId: job.job_id,
      });

      assert.equal(result.result, "blocker", status);
      assert.equal(result.reason, "non_runnable_job_status", status);
      assert.equal(JSON.stringify(ledger), before, status);
      assert.equal(result.ledger.jobs[0].status, status, status);
    }

    const active = codeJob({ status: "claimed", claimedBy: "other-runner" });
    const activeResult = await executeCodingRoomPipeline({
      ledger: createCodingRoomJobLedger({ jobs: [active] }),
      runner,
      jobId: active.job_id,
    });
    assert.equal(activeResult.reason, "active_job_not_owned_by_runner");
    assert.equal(activeResult.ledger.jobs[0].status, "claimed");
  });

  it("can choose the first claimable job when no job id is supplied", async () => {
    const blocked = codeJob({
      jobId: "coding-room:pipeline-executor:blocked-choice",
      files: ["scripts/pipeline-executor-example.mjs"],
    });
    const job = codeJob({
      jobId: "coding-room:pipeline-executor:choice",
      files: ["scripts/pipeline-executor-choice.mjs"],
      patch: patchFor("scripts/pipeline-executor-choice.mjs"),
    });
    const active = {
      ...blocked,
      status: "claimed",
      claimed_by: "other-runner",
    };

    const result = await executeCodingRoomPipeline({
      ledger: createCodingRoomJobLedger({ jobs: [active, job] }),
      runner,
      applyPatch: passingPatchRunner(),
      runCommand: passingProofRunner(),
    });

    assert.equal(result.result, "proof_submitted");
    assert.equal(result.job_id, job.job_id);
  });

  it("persists ledger file updates only when not in dry-run mode", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pipeline-executor-"));
    try {
      const ledgerPath = join(dir, "ledger.json");
      const job = codeJob();
      await writeFile(ledgerPath, serializeCodingRoomJobLedger(createCodingRoomJobLedger({ jobs: [job] })), "utf8");

      const dryBuildCalls = [];
      const dry = await executeCodingRoomPipelineFile({
        ledgerPath,
        jobId: job.job_id,
        runner,
        dryRun: true,
        applyPatch: passingPatchRunner(dryBuildCalls),
      });
      assert.equal(dry.result, "planned");
      assert.deepEqual(dryBuildCalls, ["check"]);
      assert.match(await readFile(ledgerPath, "utf8"), /"status": "queued"/);

      const live = await executeCodingRoomPipelineFile({
        ledgerPath,
        jobId: job.job_id,
        runner,
        applyPatch: passingPatchRunner(),
        runCommand: passingProofRunner(),
      });
      assert.equal(live.result, "proof_submitted");
      assert.match(await readFile(ledgerPath, "utf8"), /"status": "proof_submitted"/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

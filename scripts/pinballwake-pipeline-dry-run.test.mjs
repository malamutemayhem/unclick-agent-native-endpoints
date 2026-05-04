import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  claimCodingRoomJob,
  createCodingRoomJob,
  createCodingRoomJobLedger,
  createCodingRoomQcJob,
  createCodingRoomReviewJob,
  createCodingRoomSafetyJob,
  submitCodingRoomProof,
  submitCodingRoomReviewAck,
} from "./pinballwake-coding-room.mjs";
import { planCodingRoomPipelineDryRun } from "./pinballwake-pipeline-dry-run.mjs";

const runner = {
  id: "pinballwake-job-runner",
  readiness: "builder_ready",
  capabilities: ["implementation"],
};

function patchFor(file = "scripts/pipeline-example.mjs") {
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
    number: 522,
    title: "feat(pinballwake): add pipeline dry-run planner",
    isDraft: false,
    mergeStateStatus: "CLEAN",
    statusCheckRollup: [greenCheck("Website"), greenCheck("TestPass"), greenCheck("Vercel")],
    ...input,
  };
}

function codeJob(input = {}) {
  return createCodingRoomJob({
    jobId: input.jobId || "coding-room:pipeline:job",
    prNumber: 522,
    worker: "pinballwake-job-runner",
    chip: "pipeline dry-run",
    files: input.files || ["scripts/pipeline-example.mjs"],
    build: {
      patch: input.patch || patchFor(),
    },
    expectedProof: {
      requiresPr: false,
      requiresChangedFiles: true,
      requiresNonOverlap: true,
      requiresTests: true,
      tests: input.tests || ["node --test scripts/pinballwake-pipeline-dry-run.test.mjs"],
    },
    status: input.status || "queued",
    ...input.extra,
  });
}

function proofJob() {
  const job = createCodingRoomJob({
    jobId: "coding-room:pipeline:proof",
    prNumber: 522,
    worker: "pinballwake-job-runner",
    chip: "pipeline proof",
    files: ["scripts/pinballwake-pipeline-dry-run.mjs"],
    status: "testing",
    expectedProof: {
      requiresPr: false,
      requiresChangedFiles: false,
      requiresNonOverlap: true,
      requiresTests: true,
      tests: ["node --test scripts/pinballwake-pipeline-dry-run.test.mjs"],
    },
  });

  return submitCodingRoomProof({
    job,
    proof: {
      result: "done",
      changedFiles: [],
      tests: [{ command: "node --test scripts/pinballwake-pipeline-dry-run.test.mjs", status: "passed" }],
      prUrl: "",
      submittedAt: "2026-05-04T00:02:00.000Z",
    },
  }).job;
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
    passReview(createCodingRoomSafetyJob({ prNumber: 522 }), "gatekeeper", "Safety passed."),
    passReview(createCodingRoomQcJob({ prNumber: 522 }), "popcorn", "QC passed."),
    passReview(
      createCodingRoomReviewJob({
        prNumber: 522,
        worker: "forge",
        reviewKind: "merge_proof",
        requestedReviewers: ["forge"],
      }),
      "forge",
      "Implementation shape passed.",
    ),
  ];
}

describe("PinballWake pipeline dry-run planner", () => {
  it("plans claim, build validation, proof commands, and merge readiness without mutating the ledger", () => {
    const job = codeJob();
    const ledger = createCodingRoomJobLedger({
      jobs: [job, proofJob(), ...reviewJobs()],
    });
    const before = JSON.stringify(ledger);

    const result = planCodingRoomPipelineDryRun({
      ledger,
      runner,
      jobId: job.job_id,
      pr: readyPr(),
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "ready_to_merge");
    assert.equal(result.summary, "would_claim -> build_would_validate_patch -> proof_would_run -> ready_to_merge");
    assert.deepEqual(result.steps.map((item) => item.stage), ["claim", "build", "proof", "merge"]);
    assert.equal(JSON.stringify(ledger), before);
    assert.equal(job.status, "queued");
  });

  it("blocks unsafe build patches before any live apply step exists", () => {
    const job = codeJob({
      patch: patchFor("api/outside.ts"),
    });

    const result = planCodingRoomPipelineDryRun({
      ledger: createCodingRoomJobLedger({ jobs: [job] }),
      runner,
      jobId: job.job_id,
    });

    assert.equal(result.result, "blocker");
    assert.equal(result.stage, "build");
    assert.equal(result.reason, "patch_file_outside_ownership");
    assert.equal(result.summary, "would_claim -> build_blocked");
  });

  it("blocks proof commands that are not allowlisted", () => {
    const job = codeJob({
      tests: ["node --eval console.log(1)"],
    });

    const result = planCodingRoomPipelineDryRun({
      ledger: createCodingRoomJobLedger({ jobs: [job] }),
      runner,
      jobId: job.job_id,
    });

    assert.equal(result.result, "blocker");
    assert.equal(result.stage, "proof");
    assert.equal(result.reason, "proof_command_not_allowlisted");
    assert.equal(result.command, "node --eval console.log(1)");
  });

  it("uses merge controller gates and blocks missing proof or reviews", () => {
    const job = codeJob();
    const result = planCodingRoomPipelineDryRun({
      ledger: createCodingRoomJobLedger({ jobs: [job] }),
      runner,
      jobId: job.job_id,
      pr: readyPr(),
    });

    assert.equal(result.result, "blocker");
    assert.equal(result.stage, "merge");
    assert.equal(result.reason, "missing_submitted_proof");
    assert.equal(result.steps.at(-1).result, "merge_blocked");
  });

  it("returns merge-ready only when PR-scoped proof and review PASS gates exist", () => {
    const job = codeJob();
    const result = planCodingRoomPipelineDryRun({
      ledger: createCodingRoomJobLedger({ jobs: [job, proofJob(), ...reviewJobs()] }),
      runner,
      jobId: job.job_id,
      pr: readyPr(),
    });

    assert.equal(result.result, "ready_to_merge");
    assert.equal(result.merge.reason, "merge_ready");
    assert.equal(result.merge.action, "merge_room");
    assert.deepEqual(result.merge.execute_plan, ["merge", "watch_post_merge"]);
  });

  it("routes full-PASS draft PRs through Merge Room lift authorization", () => {
    const job = codeJob();
    const result = planCodingRoomPipelineDryRun({
      ledger: createCodingRoomJobLedger({ jobs: [job, proofJob(), ...reviewJobs()] }),
      runner,
      jobId: job.job_id,
      pr: readyPr({ isDraft: true }),
    });

    assert.equal(result.result, "blocker");
    assert.equal(result.stage, "merge");
    assert.equal(result.reason, "draft_lift_not_authorized");
    assert.equal(result.merge.result, "needs_lift");
    assert.deepEqual(result.merge.missing, ["master_lift_authorization"]);
    assert.equal(result.steps.at(-1).result, "merge_blocked");
  });

  it("uses explicit fallback evidence to plan lift and merge without executing", () => {
    const job = codeJob();
    const result = planCodingRoomPipelineDryRun({
      ledger: createCodingRoomJobLedger({ jobs: [job, proofJob(), ...reviewJobs()] }),
      runner,
      jobId: job.job_id,
      pr: readyPr({ isDraft: true }),
      fallbackEvidence: { full_ack_set: true },
    });

    assert.equal(result.result, "ready_to_lift_and_merge");
    assert.equal(result.merge.draft_lift_required, true);
    assert.deepEqual(result.merge.execute_plan, ["lift_draft", "merge", "watch_post_merge"]);
    assert.equal(result.steps.at(-1).result, "ready_to_lift_and_merge");
  });

  it("reports idle when no queued job can be claimed", () => {
    const result = planCodingRoomPipelineDryRun({
      ledger: createCodingRoomJobLedger({ jobs: [] }),
      runner,
    });

    assert.equal(result.result, "idle");
    assert.equal(result.reason, "no_claimable_jobs");
    assert.equal(result.summary, "idle");
  });

  it("blocks a queued job when owned files overlap with active work", () => {
    const active = claimCodingRoomJob({
      runner,
      job: codeJob({ jobId: "coding-room:pipeline:active", status: "queued" }),
      now: "2026-05-04T00:00:00.000Z",
    }).job;
    const queued = codeJob({ jobId: "coding-room:pipeline:queued" });

    const result = planCodingRoomPipelineDryRun({
      ledger: createCodingRoomJobLedger({ jobs: [active, queued] }),
      runner,
      jobId: queued.job_id,
    });

    assert.equal(result.result, "blocker");
    assert.equal(result.stage, "claim");
    assert.equal(result.reason, "owned_file_overlap");
  });

  it("refuses terminal and fallback statuses even when merge gates are ready", () => {
    for (const status of ["blocked", "done", "expired", "fallback_ready", "proof_submitted"]) {
      const job = codeJob({
        jobId: `coding-room:pipeline:${status}`,
        status,
      });

      const result = planCodingRoomPipelineDryRun({
        ledger: createCodingRoomJobLedger({ jobs: [job, proofJob(), ...reviewJobs()] }),
        runner,
        jobId: job.job_id,
        pr: readyPr(),
      });

      assert.equal(result.result, "blocker", status);
      assert.equal(result.stage, "claim", status);
      assert.equal(result.reason, "non_runnable_job_status", status);
      assert.equal(result.steps.at(-1).result, "claim_blocked", status);
    }
  });

  it("refuses active jobs that are not owned by the planning runner", () => {
    const job = codeJob({
      status: "claimed",
      extra: {
        claimedBy: "another-runner",
      },
    });

    const result = planCodingRoomPipelineDryRun({
      ledger: createCodingRoomJobLedger({ jobs: [job, proofJob(), ...reviewJobs()] }),
      runner,
      jobId: job.job_id,
      pr: readyPr(),
    });

    assert.equal(result.result, "blocker");
    assert.equal(result.stage, "claim");
    assert.equal(result.reason, "active_job_not_owned_by_runner");
  });

  it("lets active jobs owned by the planning runner continue through dry-run planning", () => {
    const job = codeJob({
      status: "claimed",
      extra: {
        claimedBy: "pinballwake-job-runner",
      },
    });

    const result = planCodingRoomPipelineDryRun({
      ledger: createCodingRoomJobLedger({ jobs: [job, proofJob(), ...reviewJobs()] }),
      runner,
      jobId: job.job_id,
      pr: readyPr(),
    });

    assert.equal(result.result, "ready_to_merge");
    assert.equal(result.steps[0].result, "already_in_progress");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createCodingRoomJob,
  createCodingRoomJobLedger,
  createCodingRoomQcJob,
  createCodingRoomReviewJob,
  createCodingRoomSafetyJob,
  submitCodingRoomReviewAck,
} from "./pinballwake-coding-room.mjs";
import {
  evaluateMergeReadiness,
  executeMergeController,
  isMergeCheckGreen,
  summarizeMergeChecks,
} from "./pinballwake-merge-controller.mjs";

function greenCheck(name = "CI") {
  return {
    name,
    status: "COMPLETED",
    conclusion: "SUCCESS",
  };
}

function greenStatus(context = "Vercel") {
  return {
    context,
    state: "SUCCESS",
  };
}

function readyPr(input = {}) {
  return {
    number: 521,
    title: "feat(pinballwake): add merge controller",
    isDraft: false,
    mergeStateStatus: "CLEAN",
    statusCheckRollup: [greenCheck("Website"), greenCheck("TestPass"), greenStatus("Vercel")],
    ...input,
  };
}

function proofJob(input = {}) {
  return createCodingRoomJob({
    jobId: "coding-room:proof:merge",
    prNumber: 521,
    worker: "pinballwake-job-runner",
    chip: "proof submitted",
    files: ["scripts/pinballwake-merge-controller.mjs"],
    status: "proof_submitted",
    expectedProof: {
      requiresPr: false,
      requiresChangedFiles: false,
      requiresNonOverlap: true,
      requiresTests: true,
      tests: ["node --test scripts/pinballwake-merge-controller.test.mjs"],
    },
    proof: {
      result: "done",
      changed_files: ["scripts/pinballwake-merge-controller.mjs"],
      tests: [{ command: "node --test scripts/pinballwake-merge-controller.test.mjs", status: "passed" }],
      pr_url: "https://github.com/example/repo/pull/521",
      submitted_at: "2026-05-04T00:01:00.000Z",
    },
    ...input,
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
    now: "2026-05-04T00:02:00.000Z",
  }).job;
}

function reviewJobs() {
  return [
    passReview(createCodingRoomSafetyJob({ prNumber: 521 }), "gatekeeper", "Safety passed."),
    passReview(createCodingRoomQcJob({ prNumber: 521 }), "popcorn", "QC passed."),
    passReview(
      createCodingRoomReviewJob({
        prNumber: 521,
        worker: "forge",
        reviewKind: "merge_proof",
        requestedReviewers: ["forge"],
      }),
      "forge",
      "Implementation shape passed.",
    ),
  ];
}

function readyLedger(input = {}) {
  return createCodingRoomJobLedger({
    jobs: [proofJob(), ...reviewJobs(), ...(input.extraJobs || [])],
  });
}

describe("PinballWake merge controller", () => {
  it("treats success checks and skipped optional checks as green", () => {
    assert.equal(isMergeCheckGreen(greenCheck()), true);
    assert.equal(isMergeCheckGreen({ name: "optional", conclusion: "SKIPPED" }), true);
    assert.equal(isMergeCheckGreen({ name: "pending", status: "IN_PROGRESS", conclusion: "" }), false);
    assert.equal(summarizeMergeChecks([greenCheck(), greenStatus()]).ok, true);
  });

  it("returns ready only when PR, proof, checks, and required review PASS gates are present", () => {
    const result = evaluateMergeReadiness({
      pr: readyPr(),
      ledger: readyLedger(),
    });

    assert.equal(result.ok, true);
    assert.equal(result.reason, "merge_ready");
    assert.equal(result.pr_number, 521);
    assert.deepEqual(result.reviewers, ["gatekeeper", "popcorn", "forge"]);
  });

  it("blocks draft, dirty, hold, and non-clean PR states", () => {
    assert.equal(
      evaluateMergeReadiness({ pr: readyPr({ isDraft: true }), ledger: readyLedger() }).reason,
      "pr_is_draft",
    );
    assert.equal(
      evaluateMergeReadiness({ pr: readyPr({ mergeStateStatus: "DIRTY" }), ledger: readyLedger() }).reason,
      "pr_is_dirty",
    );
    assert.equal(
      evaluateMergeReadiness({ pr: readyPr({ mergeStateStatus: "UNSTABLE" }), ledger: readyLedger() }).reason,
      "pr_not_clean",
    );
    assert.equal(
      evaluateMergeReadiness({ pr: readyPr({ hasHold: true }), ledger: readyLedger() }).reason,
      "active_hold_or_blocker",
    );
  });

  it("blocks missing, pending, or failed checks", () => {
    assert.equal(
      evaluateMergeReadiness({ pr: readyPr({ statusCheckRollup: [] }), ledger: readyLedger() }).reason,
      "missing_checks",
    );
    assert.equal(
      evaluateMergeReadiness({
        pr: readyPr({ statusCheckRollup: [greenCheck(), { name: "CI", status: "IN_PROGRESS" }] }),
        ledger: readyLedger(),
      }).reason,
      "check_not_green",
    );
  });

  it("blocks missing proof, blocked proof, and review blockers", () => {
    assert.equal(
      evaluateMergeReadiness({
        pr: readyPr(),
        ledger: createCodingRoomJobLedger({ jobs: reviewJobs() }),
      }).reason,
      "missing_submitted_proof",
    );

    assert.equal(
      evaluateMergeReadiness({
        pr: readyPr(),
        ledger: createCodingRoomJobLedger({ jobs: [proofJob({ status: "blocked", proof: { result: "blocker" } }), ...reviewJobs()] }),
      }).reason,
      "missing_submitted_proof",
    );

    const blocker = submitCodingRoomReviewAck({
      job: createCodingRoomQcJob({ prNumber: 521 }),
      ack: {
        result: "BLOCKER",
        reviewer: "popcorn",
        blocker: "QC failed.",
      },
    }).job;

    assert.equal(
      evaluateMergeReadiness({
        pr: readyPr(),
        ledger: readyLedger({ extraJobs: [blocker] }),
      }).reason,
      "review_blocker",
    );
  });

  it("does not let direct proofJob input bypass submitted-proof validation", () => {
    const unsubmittedProof = createCodingRoomJob({
      jobId: "coding-room:proof:unsubmitted",
      prNumber: 521,
      worker: "pinballwake-job-runner",
      chip: "not submitted",
      files: ["scripts/pinballwake-merge-controller.mjs"],
      status: "testing",
      proof: {
        result: "done",
      },
    });

    assert.equal(
      evaluateMergeReadiness({
        pr: readyPr(),
        proofJob: unsubmittedProof,
        reviews: reviewJobs(),
      }).reason,
      "missing_submitted_proof",
    );
  });

  it("does not let unscoped or unrelated proof/review jobs satisfy a target PR", () => {
    const unscopedProof = proofJob({ prNumber: null });
    const unscopedReviews = reviewJobs().map((job) => ({ ...job, pr_number: null }));

    assert.equal(
      evaluateMergeReadiness({
        pr: readyPr({ number: 521 }),
        ledger: createCodingRoomJobLedger({ jobs: [unscopedProof, ...unscopedReviews] }),
      }).reason,
      "missing_submitted_proof",
    );

    assert.equal(
      evaluateMergeReadiness({
        pr: readyPr({ number: 521 }),
        ledger: createCodingRoomJobLedger({
          jobs: [proofJob({ prNumber: 522 }), ...reviewJobs().map((job) => ({ ...job, pr_number: 522 }))],
        }),
      }).reason,
      "missing_submitted_proof",
    );

    assert.equal(
      evaluateMergeReadiness({
        pr: readyPr({ number: 521 }),
        ledger: createCodingRoomJobLedger({ jobs: [proofJob(), ...unscopedReviews] }),
      }).reason,
      "missing_review_pass",
    );
  });

  it("blocks missing required reviewer PASS ACKs", () => {
    const ledger = createCodingRoomJobLedger({
      jobs: [proofJob(), ...reviewJobs().filter((job) => job.proof.reviewer !== "forge")],
    });

    const result = evaluateMergeReadiness({
      pr: readyPr(),
      ledger,
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, "missing_review_pass");
    assert.deepEqual(result.missing_reviewers, ["forge"]);
  });

  it("returns advisory-ready by default and only merges in explicit execute mode", async () => {
    let called = false;
    const advisory = await executeMergeController({
      pr: readyPr(),
      ledger: readyLedger(),
      merge: async () => {
        called = true;
        return { ok: true, output: "merged" };
      },
    });

    assert.equal(advisory.ok, true);
    assert.equal(advisory.action, "advisory_ready");
    assert.equal(called, false);

    const executed = await executeMergeController({
      pr: readyPr(),
      ledger: readyLedger(),
      execute: true,
      merge: async ({ prNumber }) => {
        called = true;
        return { ok: prNumber === 521, output: "merged" };
      },
    });

    assert.equal(executed.ok, true);
    assert.equal(executed.action, "merged");
    assert.equal(called, true);
  });

  it("records merge command failure as blocker instead of pretending success", async () => {
    const result = await executeMergeController({
      pr: readyPr(),
      ledger: readyLedger(),
      execute: true,
      merge: async () => ({ ok: false, exit_code: 1, output: "merge rejected" }),
    });

    assert.equal(result.ok, false);
    assert.equal(result.result, "blocker");
    assert.equal(result.reason, "merge_command_failed");
  });
});

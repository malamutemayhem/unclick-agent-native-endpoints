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
  evaluateMergeRoom,
  executeMergeRoom,
} from "./pinballwake-merge-room.mjs";

function greenCheck(name = "CI") {
  return {
    name,
    status: "COMPLETED",
    conclusion: "SUCCESS",
  };
}

function readyPr(input = {}) {
  return {
    number: 527,
    title: "feat(autopilot): add merge room",
    isDraft: false,
    mergeStateStatus: "CLEAN",
    statusCheckRollup: [greenCheck("Website"), greenCheck("TestPass"), greenCheck("Vercel")],
    ...input,
  };
}

function proofJob(input = {}) {
  return createCodingRoomJob({
    jobId: "coding-room:proof:merge-room",
    prNumber: 527,
    worker: "pinballwake-job-runner",
    chip: "proof submitted",
    files: ["scripts/pinballwake-merge-room.mjs"],
    status: "proof_submitted",
    expectedProof: {
      requiresPr: false,
      requiresChangedFiles: false,
      requiresNonOverlap: true,
      requiresTests: true,
      tests: ["node --test scripts/pinballwake-merge-room.test.mjs"],
    },
    proof: {
      result: "done",
      changed_files: ["scripts/pinballwake-merge-room.mjs"],
      tests: [{ command: "node --test scripts/pinballwake-merge-room.test.mjs", status: "passed" }],
      submitted_at: "2026-05-05T00:01:00.000Z",
    },
    ...input,
  });
}

function passReview(job, reviewer) {
  return submitCodingRoomReviewAck({
    job,
    ack: {
      result: "PASS",
      reviewer,
      summary: `${reviewer} passed.`,
    },
    now: "2026-05-05T00:02:00.000Z",
  }).job;
}

function reviewJobs() {
  return [
    passReview(createCodingRoomSafetyJob({ prNumber: 527 }), "gatekeeper"),
    passReview(createCodingRoomQcJob({ prNumber: 527 }), "popcorn"),
    passReview(
      createCodingRoomReviewJob({
        prNumber: 527,
        worker: "forge",
        reviewKind: "merge_proof",
        requestedReviewers: ["forge"],
      }),
      "forge",
    ),
  ];
}

function readyLedger(extraJobs = []) {
  return createCodingRoomJobLedger({
    jobs: [proofJob(), ...reviewJobs(), ...extraJobs],
  });
}

describe("PinballWake merge room", () => {
  it("returns ready_to_merge for a non-draft PR with proof and review passes", () => {
    const result = evaluateMergeRoom({
      pr: readyPr(),
      ledger: readyLedger(),
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "ready_to_merge");
    assert.equal(result.draft_lift_required, false);
    assert.deepEqual(result.execute_plan, ["merge", "watch_post_merge"]);
  });

  it("turns a full-PASS draft into ready_to_lift_and_merge only when authorized", () => {
    const blocked = evaluateMergeRoom({
      pr: readyPr({ isDraft: true }),
      ledger: readyLedger(),
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.result, "needs_lift");

    const allowed = evaluateMergeRoom({
      pr: readyPr({ isDraft: true }),
      ledger: readyLedger(),
      allowDraftLift: true,
    });
    assert.equal(allowed.ok, true);
    assert.equal(allowed.result, "ready_to_lift_and_merge");
    assert.equal(allowed.draft_lift_required, true);
    assert.deepEqual(allowed.execute_plan, ["lift_draft", "merge", "watch_post_merge"]);
  });

  it("accepts explicit fallback-ready evidence for draft lift", () => {
    const result = evaluateMergeRoom({
      pr: readyPr({ isDraft: true }),
      ledger: readyLedger(),
      fallbackEvidence: {
        full_ack_set: true,
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "ready_to_lift_and_merge");
    assert.equal(result.fallback_used, true);
  });

  it("does not lift when checks, proof, or review gates are missing", () => {
    assert.equal(
      evaluateMergeRoom({
        pr: readyPr({ isDraft: true, statusCheckRollup: [] }),
        ledger: readyLedger(),
        allowDraftLift: true,
      }).reason,
      "missing_checks",
    );

    assert.equal(
      evaluateMergeRoom({
        pr: readyPr({ isDraft: true }),
        ledger: createCodingRoomJobLedger({ jobs: reviewJobs() }),
        allowDraftLift: true,
      }).reason,
      "missing_submitted_proof",
    );
  });

  it("executes lift before merge only in explicit execute mode", async () => {
    const calls = [];
    const advisory = await executeMergeRoom({
      pr: readyPr({ isDraft: true }),
      ledger: readyLedger(),
      allowDraftLift: true,
      ready: async () => {
        calls.push("ready");
        return { ok: true, output: "ready" };
      },
      merge: async () => {
        calls.push("merge");
        return { ok: true, output: "merged" };
      },
    });

    assert.equal(advisory.mode, "advisory");
    assert.deepEqual(calls, []);

    const executed = await executeMergeRoom({
      pr: readyPr({ isDraft: true }),
      ledger: readyLedger(),
      allowDraftLift: true,
      execute: true,
      ready: async () => {
        calls.push("ready");
        return { ok: true, output: "ready" };
      },
      merge: async () => {
        calls.push("merge");
        return { ok: true, output: "merged" };
      },
    });

    assert.equal(executed.ok, true);
    assert.equal(executed.result, "merged");
    assert.deepEqual(calls, ["ready", "merge"]);
  });

  it("stops if draft lift command fails", async () => {
    const result = await executeMergeRoom({
      pr: readyPr({ isDraft: true }),
      ledger: readyLedger(),
      allowDraftLift: true,
      execute: true,
      ready: async () => ({ ok: false, exit_code: 1, output: "cannot ready" }),
      merge: async () => ({ ok: true, output: "merged" }),
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, "draft_lift_failed");
    assert.match(result.summary, /lift_failed/);
  });
});

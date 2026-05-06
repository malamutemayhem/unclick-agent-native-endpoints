import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateAckLedgerRoom } from "./pinballwake-ack-ledger-room.mjs";
import { evaluateMergeRoom } from "./pinballwake-merge-room.mjs";
import {
  createCodingRoomJob,
  createCodingRoomJobLedger,
  createCodingRoomQcJob,
  createCodingRoomReviewJob,
  createCodingRoomSafetyJob,
  submitCodingRoomReviewAck,
} from "./pinballwake-coding-room.mjs";

function pr(input = {}) {
  return {
    number: 528,
    title: "feat(autopilot): launchpad wiring",
    isDraft: true,
    mergeStateStatus: "CLEAN",
    statusCheckRollup: [
      { name: "CI", status: "COMPLETED", conclusion: "SUCCESS" },
      { name: "TestPass", status: "COMPLETED", conclusion: "SUCCESS" },
      { name: "Vercel", status: "COMPLETED", conclusion: "SUCCESS" },
    ],
    ...input,
  };
}

function comment(body, created_at = "2026-05-05T00:00:00.000Z", author = "master") {
  return { source: "github_comment", body, created_at, author };
}

function fishbowl(message, created_at = "2026-05-05T00:00:00.000Z", author = "master") {
  return { source: "fishbowl", message, created_at, author };
}

function proofJob() {
  return createCodingRoomJob({
    jobId: "proof:ack-ledger",
    prNumber: 528,
    worker: "pinballwake-job-runner",
    chip: "proof submitted",
    files: ["scripts/pinballwake-ack-ledger-room.mjs"],
    status: "proof_submitted",
    expectedProof: {
      requiresPr: false,
      requiresChangedFiles: false,
      requiresNonOverlap: true,
      requiresTests: true,
      tests: ["node --test scripts/pinballwake-ack-ledger-room.test.mjs"],
    },
    proof: {
      result: "done",
      changed_files: ["scripts/pinballwake-ack-ledger-room.mjs"],
      tests: [{ command: "node --test scripts/pinballwake-ack-ledger-room.test.mjs", status: "passed" }],
      submitted_at: "2026-05-05T00:01:00.000Z",
    },
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

function readyLedger() {
  return createCodingRoomJobLedger({
    jobs: [
      proofJob(),
      passReview(createCodingRoomSafetyJob({ prNumber: 528 }), "gatekeeper"),
      passReview(createCodingRoomQcJob({ prNumber: 528 }), "popcorn"),
      passReview(
        createCodingRoomReviewJob({
          prNumber: 528,
          worker: "forge",
          reviewKind: "implementation_shape",
          requestedReviewers: ["forge"],
        }),
        "forge",
      ),
    ],
  });
}

describe("PinballWake ACK ledger room", () => {
  it("builds a full-pass ACK set from GitHub and Fishbowl-style messages", () => {
    const result = evaluateAckLedgerRoom({
      pr: pr(),
      comments: [
        comment("Gatekeeper PASS on #528. No release-safety blocker remains.", "2026-05-05T00:00:00.000Z", "gatekeeper"),
        comment("ack: PASS\n\n#528 Forge implementation-shape review passes.", "2026-05-05T00:00:00.000Z", "forge"),
      ],
      fishbowlMessages: [fishbowl("PASS\n🍿\n#528 QC checked latest head.", "2026-05-05T00:00:00.000Z", "popcorn")],
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "full_pass");
    assert.equal(result.full_ack_set, true);
    assert.equal(result.fallback_evidence.full_ack_set, true);
    assert.equal(result.latest_by_reviewer.popcorn.verdict, "PASS");
  });

  it("does not count unscoped ACKs for the target PR", () => {
    const result = evaluateAckLedgerRoom({
      pr: pr(),
      comments: [
        comment("Gatekeeper PASS on #528.", "2026-05-05T00:00:00.000Z", "gatekeeper"),
        comment("Forge PASS on #528.", "2026-05-05T00:00:00.000Z", "forge"),
        comment("PASS\n🍿", "2026-05-05T00:00:00.000Z", "popcorn"),
      ],
    });

    assert.equal(result.result, "missing_ack");
    assert.deepEqual(result.missing_reviewers, ["popcorn"]);
  });

  it("keeps a newer reviewer blocker ahead of an older PASS", () => {
    const result = evaluateAckLedgerRoom({
      pr: pr(),
      comments: [
        comment("Gatekeeper PASS on #528.", "2026-05-05T00:00:00.000Z", "gatekeeper"),
        comment("Forge PASS on #528.", "2026-05-05T00:00:00.000Z", "forge"),
        comment("Popcorn PASS on #528.", "2026-05-05T00:00:00.000Z", "popcorn"),
        comment("Popcorn BLOCKER still stands on #528: stale proof.", "2026-05-05T00:10:00.000Z", "popcorn"),
      ],
    });

    assert.equal(result.ok, false);
    assert.equal(result.result, "blocked");
    assert.equal(result.blockers[0].reviewer, "popcorn");
  });

  it("lets a newer HOLD-clear PASS close an older blocker", () => {
    const result = evaluateAckLedgerRoom({
      pr: pr(),
      comments: [
        comment("Gatekeeper HOLD on #528: stale proof.", "2026-05-05T00:00:00.000Z", "gatekeeper"),
        comment("Gatekeeper HOLD cleared on #528. Safety PASS, no remaining blocker.", "2026-05-05T00:10:00.000Z", "gatekeeper"),
        comment("Forge PASS on #528.", "2026-05-05T00:10:00.000Z", "forge"),
        comment("Popcorn PASS on #528.", "2026-05-05T00:10:00.000Z", "popcorn"),
      ],
    });

    assert.equal(result.result, "full_pass");
    assert.equal(result.latest_by_reviewer.gatekeeper.verdict, "PASS");
  });

  it("does not trust grouped Claude/Fishbowl heartbeat language as lane ACK", () => {
    const result = evaluateAckLedgerRoom({
      pr: pr({ number: 530 }),
      fishbowlMessages: [
        fishbowl(
          "Fishbowl state: #528/#529/#530 are all CLEAN/green with Popcorn PASS, Gatekeeper PASS, Forge PASS. Courier has routed the lift/merge decision to master.",
        ),
      ],
    });

    assert.equal(result.result, "missing_ack");
    assert.equal(result.full_ack_set, false);
    assert.deepEqual(result.missing_reviewers, ["gatekeeper", "popcorn", "forge"]);
  });

  it("does not turn waiting-only language into a fake PASS", () => {
    const result = evaluateAckLedgerRoom({
      pr: pr(),
      comments: [
        comment("Gatekeeper PASS visible on #528.", "2026-05-05T00:00:00.000Z", "gatekeeper"),
        comment("Forge PASS visible on #528.", "2026-05-05T00:00:00.000Z", "forge"),
        comment("#528 is waiting only on Popcorn QC."),
      ],
    });

    assert.equal(result.result, "missing_ack");
    assert.deepEqual(result.missing_reviewers, ["popcorn"]);
  });

  it("feeds Merge Room fallback evidence for draft lift decisions", () => {
    const ackLedger = evaluateAckLedgerRoom({
      pr: pr(),
      comments: [
        comment("Gatekeeper PASS on #528.", "2026-05-05T00:00:00.000Z", "gatekeeper"),
        comment("Forge PASS on #528.", "2026-05-05T00:00:00.000Z", "forge"),
        comment("Popcorn PASS on #528.", "2026-05-05T00:00:00.000Z", "popcorn"),
      ],
    });

    const mergeRoom = evaluateMergeRoom({
      pr: pr(),
      ledger: readyLedger(),
      fallbackEvidence: ackLedger.fallback_evidence,
    });

    assert.equal(ackLedger.result, "full_pass");
    assert.equal(mergeRoom.ok, true);
    assert.equal(mergeRoom.result, "ready_to_lift_and_merge");
    assert.equal(mergeRoom.fallback_used, true);
  });

  it("does not let a newer mirror summary supersede an older lane blocker", () => {
    const result = evaluateAckLedgerRoom({
      pr: pr(),
      comments: [
        comment("Gatekeeper PASS on #528.", "2026-05-05T00:00:00.000Z", "gatekeeper"),
        comment("Forge BLOCKER still stands on #528: stale proof mismatch.", "2026-05-05T00:01:00.000Z", "forge"),
        comment("Popcorn PASS on #528.", "2026-05-05T00:00:00.000Z", "popcorn"),
      ],
      fishbowlMessages: [
        fishbowl(
          "Status mirror: #528 has Gatekeeper PASS, Popcorn PASS, Forge PASS and is ready.",
          "2026-05-05T00:10:00.000Z",
          "courier",
        ),
      ],
    });

    assert.equal(result.result, "blocked");
    assert.equal(result.blockers[0].reviewer, "forge");
  });

  it("does not let courier mirror records claim reviewer authority via worker metadata", () => {
    const result = evaluateAckLedgerRoom({
      pr: pr(),
      comments: [
        comment("Gatekeeper HOLD on #528: ACK provenance still unsafe.", "2026-05-05T00:00:00.000Z", "gatekeeper"),
      ],
      fishbowlMessages: [
        {
          source: "fishbowl",
          author: "courier",
          worker: "gatekeeper",
          message: "#528 Gatekeeper PASS visible; routed for Master lift.",
          created_at: "2026-05-05T00:10:00.000Z",
        },
        {
          source: "fishbowl",
          author: "courier",
          worker: "popcorn",
          message: "#528 Popcorn PASS visible; routed for Master lift.",
          created_at: "2026-05-05T00:10:00.000Z",
        },
        {
          source: "fishbowl",
          author: "courier",
          worker: "forge",
          message: "#528 Forge PASS visible; routed for Master lift.",
          created_at: "2026-05-05T00:10:00.000Z",
        },
      ],
    });

    assert.equal(result.result, "blocked");
    assert.equal(result.full_ack_set, false);
    assert.equal(result.blockers[0].reviewer, "gatekeeper");
  });

  it("accepts explicitly trusted structured lane ACK records", () => {
    const result = evaluateAckLedgerRoom({
      pr: pr(),
      reviews: [
        { pr_number: 528, reviewer: "gatekeeper", verdict: "PASS", trusted_lane_ack: true },
        { pr_number: 528, reviewer: "popcorn", verdict: "PASS", trusted_lane_ack: true },
        { pr_number: 528, reviewer: "forge", verdict: "PASS", trusted_lane_ack: true },
      ],
    });

    assert.equal(result.result, "full_pass");
  });
});

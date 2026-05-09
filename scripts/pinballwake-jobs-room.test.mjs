import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  claimCodingRoomJob,
  createCodingRoomJob,
  createCodingRoomJobLedger,
  createCodingRoomQcJob,
  createCodingRoomSafetyJob,
  submitCodingRoomBuildResult,
  submitCodingRoomProof,
} from "./pinballwake-coding-room.mjs";
import { evaluateJobsRoom } from "./pinballwake-jobs-room.mjs";

const builder = {
  id: "forge",
  name: "forge",
  readiness: "builder_ready",
  capabilities: ["implementation"],
};

const qcRunner = {
  id: "popcorn",
  name: "popcorn",
  readiness: "review_only",
  capabilities: ["qc_review"],
};

function codeJob(input = {}) {
  return createCodingRoomJob({
    jobId: input.jobId || "jobs-room:code",
    prNumber: 528,
    worker: input.worker || "forge",
    chip: input.chip || "Jobs Room code chip",
    context: input.context || "Build a small job room chip.",
    files: input.files || ["scripts/pinballwake-jobs-room.mjs"],
    expectedProof: {
      requiresPr: false,
      requiresChangedFiles: true,
      requiresNonOverlap: true,
      requiresTests: true,
      tests: ["node --test scripts/pinballwake-jobs-room.test.mjs"],
    },
    status: input.status || "queued",
    claimedBy: input.claimedBy,
    leaseExpiresAt: input.leaseExpiresAt,
    buildResult: input.buildResult,
    proof: input.proof,
  });
}

function proofSubmittedJob() {
  const job = submitCodingRoomBuildResult({
    job: codeJob({ status: "claimed", claimedBy: "forge" }),
    buildResult: {
      result: "done",
      changedFiles: ["scripts/pinballwake-jobs-room.mjs"],
    },
    now: "2026-05-04T00:01:00.000Z",
  }).job;

  return submitCodingRoomProof({
    job,
    proof: {
      result: "done",
      changedFiles: ["scripts/pinballwake-jobs-room.mjs"],
      tests: [{ command: "node --test scripts/pinballwake-jobs-room.test.mjs", status: "passed" }],
      prUrl: "https://github.com/malamutemayhem/unclick-agent-native-endpoints/pull/528",
      submittedAt: "2026-05-04T00:02:00.000Z",
    },
  }).job;
}

describe("PinballWake Jobs Room", () => {
  it("turns queued code jobs into claim/build todos", () => {
    const result = evaluateJobsRoom({
      ledger: createCodingRoomJobLedger({ jobs: [codeJob()] }),
      runner: builder,
    });

    assert.equal(result.result, "todos");
    assert.equal(result.next.next_action, "claim_build");
    assert.equal(result.next.priority, 80);
    assert.equal(result.packets[0].worker, "forge");
    assert.match(result.packets[0].expected_proof, /Claim the job/);
  });

  it("turns queued review jobs into reviewer todos only for matching reviewer", () => {
    const result = evaluateJobsRoom({
      ledger: createCodingRoomJobLedger({ jobs: [createCodingRoomQcJob({ prNumber: 528 })] }),
      runner: qcRunner,
    });

    assert.equal(result.next.next_action, "claim_review");
    assert.equal(result.packets[0].worker, "popcorn");

    const blocked = evaluateJobsRoom({
      ledger: createCodingRoomJobLedger({ jobs: [createCodingRoomSafetyJob({ prNumber: 528 })] }),
      runner: qcRunner,
    });
    assert.equal(blocked.next.next_action, "blocked_before_claim");
    assert.equal(blocked.next.reason, "runner_lacks_review_kind_capability");
  });

  it("prioritizes expired active work as reclaim or refresh", () => {
    const active = claimCodingRoomJob({
      runner: builder,
      job: codeJob(),
      now: "2026-05-04T00:00:00.000Z",
      leaseSeconds: 60,
    }).job;

    const result = evaluateJobsRoom({
      ledger: createCodingRoomJobLedger({ jobs: [active, codeJob({ jobId: "jobs-room:queued-2" })] }),
      runner: builder,
      now: "2026-05-04T00:02:00.000Z",
    });

    assert.equal(result.next.next_action, "reclaim_or_refresh");
    assert.equal(result.next.priority, 90);
    assert.equal(result.packets[0].deadline, "immediate");
  });

  it("routes blocked jobs to Repair Room", () => {
    const result = evaluateJobsRoom({
      ledger: createCodingRoomJobLedger({
        jobs: [
          codeJob({
            status: "blocked",
            buildResult: { result: "blocker", blocker: "patch_file_outside_ownership" },
          }),
        ],
      }),
      runner: builder,
    });

    assert.equal(result.next.next_action, "repair_room");
    assert.equal(result.next.priority, 95);
    assert.match(result.packets[0].context, /patch_file_outside_ownership/);
  });

  it("routes submitted proof to review or Merge Room", () => {
    const result = evaluateJobsRoom({
      ledger: createCodingRoomJobLedger({ jobs: [proofSubmittedJob()] }),
      runner: builder,
    });

    assert.equal(result.next.next_action, "review_or_merge_room");
    assert.equal(result.counts_by_status.proof_submitted, 1);
  });

  it("reports idle when the todo list is complete", () => {
    const result = evaluateJobsRoom({
      ledger: createCodingRoomJobLedger({ jobs: [codeJob({ status: "done" })] }),
      runner: builder,
    });

    assert.equal(result.result, "idle");
    assert.equal(result.reason, "no_actionable_jobs");
    assert.equal(result.packets.length, 0);
  });
});

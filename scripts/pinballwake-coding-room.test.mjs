import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  claimCodingRoomJob,
  createCodingRoomJob,
  createCodingRoomReviewJob,
  markReviewFallbackReady,
  reviewJobNeedsFallback,
  runnerCanClaimCodingRoomJob,
  submitCodingRoomProof,
  validateCodingRoomProof,
} from "./pinballwake-coding-room.mjs";

const forgeRunner = {
  id: "forge",
  emoji: "🛠️",
  readiness: "builder_ready",
  capabilities: ["implementation", "test_fix"],
};

describe("PinballWake Coding Room skeleton", () => {
  it("creates a queued job with owned files and proof requirements", () => {
    const job = createCodingRoomJob({
      source: "queuepush",
      prNumber: 516,
      worker: "forge",
      chip: "add job runner registry",
      files: ["scripts/fleet-throughput-watch.mjs"],
      expectedProof: { tests: ["node --test scripts/fleet-throughput-watch.test.mjs"] },
    });

    assert.equal(job.status, "queued");
    assert.deepEqual(job.owned_files, ["scripts/fleet-throughput-watch.mjs"]);
    assert.equal(job.expected_proof.requires_pr, true);
    assert.equal(job.safety.draft_pr_only, true);
  });

  it("does not let context-only or probe-only workers claim code jobs", () => {
    const job = createCodingRoomJob({
      worker: "xpass",
      chip: "fix code",
      files: ["src/example.ts"],
    });

    assert.equal(
      runnerCanClaimCodingRoomJob({
        runner: { id: "xpass", readiness: "context_only", capabilities: ["owner_decision"] },
        job,
      }).reason,
      "runner_not_builder_ready",
    );

    assert.equal(
      runnerCanClaimCodingRoomJob({
        runner: { id: "plex-builder", readiness: "needs_probe", capabilities: ["implementation"] },
        job,
      }).reason,
      "runner_not_builder_ready",
    );
  });

  it("prevents active file ownership overlap", () => {
    const job = createCodingRoomJob({
      worker: "forge",
      chip: "touch watcher",
      files: ["api/fishbowl-watcher.ts"],
    });
    const activeJobs = [
      createCodingRoomJob({
        status: "building",
        worker: "another-builder",
        chip: "same file",
        files: ["api/fishbowl-watcher.ts"],
      }),
    ];

    const decision = runnerCanClaimCodingRoomJob({ runner: forgeRunner, job, activeJobs });

    assert.equal(decision.ok, false);
    assert.equal(decision.reason, "owned_file_overlap");
    assert.equal(decision.file, "api/fishbowl-watcher.ts");
  });

  it("lets a builder claim a non-overlapping scoped job", () => {
    const job = createCodingRoomJob({
      worker: "forge",
      chip: "add focused test",
      files: ["scripts/pinballwake-coding-room.mjs"],
    });

    const result = claimCodingRoomJob({
      runner: forgeRunner,
      job,
      now: "2026-05-04T00:00:00.000Z",
      leaseSeconds: 60,
    });

    assert.equal(result.ok, true);
    assert.equal(result.job.status, "claimed");
    assert.equal(result.job.claimed_by, "forge");
    assert.equal(result.job.lease_expires_at, "2026-05-04T00:01:00.000Z");
  });

  it("rejects proof that changes files outside ownership", () => {
    const job = createCodingRoomJob({
      worker: "forge",
      chip: "scoped fix",
      files: ["scripts/pinballwake-coding-room.mjs"],
    });

    const proof = validateCodingRoomProof({
      job,
      proof: {
        result: "done",
        changedFiles: ["scripts/pinballwake-coding-room.mjs", "api/secrets.ts"],
        tests: [{ command: "node --test scripts/pinballwake-coding-room.test.mjs", status: "passed" }],
        prUrl: "https://github.com/example/repo/pull/1",
      },
    });

    assert.equal(proof.ok, false);
    assert.equal(proof.reason, "changed_file_outside_ownership");
    assert.equal(proof.file, "api/secrets.ts");
  });

  it("requires passed tests and a PR link for done proof", () => {
    const job = createCodingRoomJob({
      worker: "forge",
      chip: "scoped fix",
      files: ["scripts/pinballwake-coding-room.mjs"],
    });

    assert.equal(
      validateCodingRoomProof({
        job,
        proof: { result: "done", changedFiles: ["scripts/pinballwake-coding-room.mjs"] },
      }).reason,
      "pr_url_required",
    );

    assert.equal(
      validateCodingRoomProof({
        job,
        proof: {
          result: "done",
          changedFiles: ["scripts/pinballwake-coding-room.mjs"],
          prUrl: "https://github.com/example/repo/pull/1",
        },
      }).reason,
      "test_proof_required",
    );
  });

  it("accepts blocker proof without pretending code was built", () => {
    const job = createCodingRoomJob({
      worker: "forge",
      chip: "scoped fix",
      files: ["scripts/pinballwake-coding-room.mjs"],
    });

    const result = submitCodingRoomProof({
      job,
      proof: {
        result: "blocker",
        blocker: "Runner has no clean worktree.",
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.job.status, "blocked");
    assert.equal(result.job.proof.result, "blocker");
  });

  it("accepts complete done proof as proof_submitted, not auto-merged", () => {
    const job = createCodingRoomJob({
      worker: "forge",
      chip: "scoped fix",
      files: ["scripts/pinballwake-coding-room.mjs"],
    });

    const result = submitCodingRoomProof({
      job,
      proof: {
        result: "done",
        changedFiles: ["scripts/pinballwake-coding-room.mjs"],
        tests: [{ command: "node --test scripts/pinballwake-coding-room.test.mjs", status: "passed" }],
        prUrl: "https://github.com/example/repo/pull/1",
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.job.status, "proof_submitted");
    assert.equal(result.job.proof.pr_url, "https://github.com/example/repo/pull/1");
  });

  it("creates timed review jobs that do not need owned files", () => {
    const job = createCodingRoomReviewJob({
      source: "queuepush",
      prNumber: 516,
      worker: "gatekeeper",
      chip: "final safety review",
      reviewKind: "release_safety",
      requestedReviewers: ["gatekeeper", "popcorn"],
      fallbackWorker: "master",
      createdAt: "2026-05-04T00:00:00.000Z",
      timeoutSeconds: 600,
    });

    assert.equal(job.job_type, "review");
    assert.equal(job.status, "queued");
    assert.deepEqual(job.owned_files, []);
    assert.equal(job.ack_deadline_at, "2026-05-04T00:10:00.000Z");
    assert.equal(job.expected_ack, "done/blocker");
    assert.equal(job.expected_proof.requires_tests, false);
  });

  it("lets review-ready workers claim review jobs without code ownership", () => {
    const job = createCodingRoomReviewJob({
      worker: "popcorn",
      chip: "final QC review",
      createdAt: "2026-05-04T00:00:00.000Z",
    });

    const result = claimCodingRoomJob({
      runner: {
        id: "popcorn",
        readiness: "review_only",
        capabilities: ["qc_review"],
      },
      job,
      now: "2026-05-04T00:01:00.000Z",
      leaseSeconds: 120,
    });

    assert.equal(result.ok, true);
    assert.equal(result.job.status, "claimed");
    assert.equal(result.job.claimed_by, "popcorn");
  });

  it("blocks builders with no review capability from review jobs", () => {
    const job = createCodingRoomReviewJob({
      worker: "gatekeeper",
      chip: "final safety review",
    });

    const decision = runnerCanClaimCodingRoomJob({
      runner: {
        id: "forge",
        readiness: "builder_ready",
        capabilities: ["implementation"],
      },
      job,
    });

    assert.equal(decision.ok, false);
    assert.equal(decision.reason, "runner_lacks_review_capability");
  });

  it("keeps review jobs open before the deadline and fallback-ready after timeout", () => {
    const job = createCodingRoomReviewJob({
      worker: "gatekeeper",
      chip: "final safety review",
      fallbackWorker: "master",
      createdAt: "2026-05-04T00:00:00.000Z",
      timeoutSeconds: 300,
    });

    assert.equal(
      reviewJobNeedsFallback({
        job,
        now: "2026-05-04T00:04:59.000Z",
      }).reason,
      "review_deadline_open",
    );

    const fallback = markReviewFallbackReady({
      job,
      now: "2026-05-04T00:05:01.000Z",
    });

    assert.equal(fallback.ok, true);
    assert.equal(fallback.job.status, "fallback_ready");
    assert.equal(fallback.job.fallback_worker, "master");
    assert.equal(fallback.job.fallback_reason, "review_ack_timeout");
  });

  it("does not fallback after a review has answered done/blocker", () => {
    const job = createCodingRoomReviewJob({
      worker: "gatekeeper",
      chip: "final safety review",
      createdAt: "2026-05-04T00:00:00.000Z",
      timeoutSeconds: 300,
    });
    const answered = submitCodingRoomProof({
      job,
      proof: {
        result: "done",
        changedFiles: [],
        tests: [],
        prUrl: "",
      },
    }).job;

    const fallback = reviewJobNeedsFallback({
      job: answered,
      now: "2026-05-04T00:10:00.000Z",
    });

    assert.equal(fallback.ok, false);
    assert.equal(fallback.reason, "review_already_answered");
  });
});

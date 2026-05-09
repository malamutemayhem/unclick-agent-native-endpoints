import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  claimCodingRoomJob,
  createCodingRoomJob,
  createCodingRoomJobLedger,
  createCodingRoomQcJob,
  writeCodingRoomJobLedger,
} from "./pinballwake-coding-room.mjs";
import {
  chooseClaimableCodingRoomJob,
  createCodingRoomRunner,
  createCodingRoomRunnerFromEnv,
  markTimedOutReviewJobs,
  runCodingRoomRunnerCycle,
  runCodingRoomRunnerFile,
} from "./pinballwake-coding-room-runner.mjs";

const forgeRunner = createCodingRoomRunner({
  id: "forge",
  readiness: "builder_ready",
  capabilities: ["implementation", "test_fix"],
});

describe("PinballWake Coding Room runner loop", () => {
  it("creates runners from explicit input and environment", () => {
    assert.deepEqual(
      createCodingRoomRunner({
        id: "popcorn",
        readiness: "review_only",
        capabilities: ["qc_review"],
      }),
      {
        id: "popcorn",
        emoji: "",
        agent_id: "",
        name: "",
        readiness: "review_only",
        capabilities: ["qc_review"],
      },
    );

    assert.deepEqual(
      createCodingRoomRunnerFromEnv({
        CODING_ROOM_RUNNER_ID: "gatekeeper",
        CODING_ROOM_RUNNER_READINESS: "review_only",
        CODING_ROOM_RUNNER_CAPABILITIES: "release_safety,merge_proof",
      }).capabilities,
      ["release_safety", "merge_proof"],
    );
  });

  it("claims the first matching queued job and writes a lease", () => {
    const job = createCodingRoomJob({
      jobId: "coding-room:runner:claim",
      worker: "forge",
      chip: "claim by runner",
      files: ["scripts/pinballwake-coding-room-runner.mjs"],
    });

    const result = runCodingRoomRunnerCycle({
      ledger: createCodingRoomJobLedger({ jobs: [job] }),
      runner: forgeRunner,
      now: "2026-05-04T00:00:00.000Z",
      leaseSeconds: 120,
    });

    assert.equal(result.ok, true);
    assert.equal(result.action, "claimed");
    assert.equal(result.job.status, "claimed");
    assert.equal(result.claim.runner_id, "forge");
    assert.equal(result.claim.lease_expires_at, "2026-05-04T00:02:00.000Z");
  });

  it("skips unclaimable jobs and claims the next safe job", () => {
    const reviewJob = createCodingRoomQcJob({
      jobId: "coding-room:runner:qc",
      prNumber: 517,
      requestedReviewers: ["popcorn"],
      createdAt: "2026-05-04T00:00:00.000Z",
    });
    const codeJob = createCodingRoomJob({
      jobId: "coding-room:runner:code",
      worker: "forge",
      chip: "claim by runner",
      files: ["scripts/pinballwake-coding-room-runner.mjs"],
    });

    const result = runCodingRoomRunnerCycle({
      ledger: createCodingRoomJobLedger({ jobs: [reviewJob, codeJob] }),
      runner: forgeRunner,
      now: "2026-05-04T00:00:00.000Z",
    });

    assert.equal(result.action, "claimed");
    assert.equal(result.job.job_id, "coding-room:runner:code");
    assert.equal(result.skipped[0].job_id, "coding-room:runner:qc");
    assert.equal(result.skipped[0].reason, "runner_lacks_review_kind_capability");
  });

  it("returns idle with skip reasons when there is no claimable job", () => {
    const job = createCodingRoomQcJob({
      jobId: "coding-room:runner:only-qc",
      prNumber: 517,
      requestedReviewers: ["popcorn"],
      createdAt: "2026-05-04T00:00:00.000Z",
    });

    const result = runCodingRoomRunnerCycle({
      ledger: createCodingRoomJobLedger({ jobs: [job] }),
      runner: forgeRunner,
      now: "2026-05-04T00:00:00.000Z",
    });

    assert.equal(result.ok, true);
    assert.equal(result.action, "idle");
    assert.equal(result.reason, "no_claimable_jobs");
    assert.equal(result.skipped[0].reason, "runner_lacks_review_kind_capability");
  });

  it("reclaims expired leases before choosing work", () => {
    const expired = claimCodingRoomJob({
      runner: forgeRunner,
      job: createCodingRoomJob({
        jobId: "coding-room:runner:expired",
        worker: "forge",
        chip: "expired lease",
        files: ["scripts/pinballwake-coding-room-runner.mjs"],
      }),
      now: "2026-05-04T00:00:00.000Z",
      leaseSeconds: 60,
    }).job;

    const result = runCodingRoomRunnerCycle({
      ledger: createCodingRoomJobLedger({ jobs: [expired] }),
      runner: forgeRunner,
      now: "2026-05-04T00:01:01.000Z",
    });

    assert.equal(result.action, "claimed");
    assert.equal(result.reclaimed, 1);
    assert.equal(result.job.job_id, "coding-room:runner:expired");
    assert.equal(result.ledger.jobs[0].previous_claims[0].reason, "lease_expired");
  });

  it("marks timed out review jobs fallback-ready before claiming new work", () => {
    const reviewJob = createCodingRoomQcJob({
      jobId: "coding-room:runner:stale-review",
      prNumber: 517,
      requestedReviewers: ["popcorn"],
      fallbackWorker: "master",
      createdAt: "2026-05-04T00:00:00.000Z",
      timeoutSeconds: 60,
    });
    const codeJob = createCodingRoomJob({
      jobId: "coding-room:runner:after-review",
      worker: "forge",
      chip: "claim after review timeout",
      files: ["scripts/pinballwake-coding-room-runner.mjs"],
    });

    const result = runCodingRoomRunnerCycle({
      ledger: createCodingRoomJobLedger({ jobs: [reviewJob, codeJob] }),
      runner: forgeRunner,
      now: "2026-05-04T00:01:01.000Z",
    });

    assert.equal(result.fallback_ready, 1);
    assert.equal(result.ledger.jobs[0].status, "fallback_ready");
    assert.equal(result.job.job_id, "coding-room:runner:after-review");
  });

  it("can mark review fallback without claiming anything", () => {
    const reviewJob = createCodingRoomQcJob({
      jobId: "coding-room:runner:mark-review",
      prNumber: 517,
      requestedReviewers: ["popcorn"],
      createdAt: "2026-05-04T00:00:00.000Z",
      timeoutSeconds: 60,
    });

    const result = markTimedOutReviewJobs({
      ledger: createCodingRoomJobLedger({ jobs: [reviewJob] }),
      now: "2026-05-04T00:01:01.000Z",
    });

    assert.equal(result.ok, true);
    assert.equal(result.fallbackReady, 1);
    assert.equal(result.ledger.jobs[0].status, "fallback_ready");
  });

  it("persists runner cycle results to a ledger file unless dry-run is set", async () => {
    const dir = await mkdtemp(join(tmpdir(), "coding-room-runner-"));
    const ledgerPath = join(dir, "ledger.json");
    try {
      const job = createCodingRoomJob({
        jobId: "coding-room:runner:file",
        worker: "forge",
        chip: "persist claim",
        files: ["scripts/pinballwake-coding-room-runner.mjs"],
      });
      await writeCodingRoomJobLedger(ledgerPath, createCodingRoomJobLedger({ jobs: [job] }));

      const result = await runCodingRoomRunnerFile({
        ledgerPath,
        runner: forgeRunner,
        now: "2026-05-04T00:00:00.000Z",
        leaseSeconds: 60,
      });

      assert.equal(result.ok, true);
      assert.equal(result.action, "claimed");

      const dryRun = await runCodingRoomRunnerFile({
        ledgerPath,
        runner: forgeRunner,
        now: "2026-05-04T00:00:10.000Z",
        dryRun: true,
      });

      assert.equal(dryRun.ok, true);
      assert.equal(dryRun.action, "idle");
      assert.equal(dryRun.dry_run, true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("chooses no job from an empty ledger", () => {
    const result = chooseClaimableCodingRoomJob({
      ledger: createCodingRoomJobLedger(),
      runner: forgeRunner,
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, "no_claimable_jobs");
    assert.deepEqual(result.skipped, []);
  });
});

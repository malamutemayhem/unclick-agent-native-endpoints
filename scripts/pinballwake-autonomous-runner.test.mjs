import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  createCodingRoomJob,
  createCodingRoomJobLedger,
  writeCodingRoomJobLedger,
} from "./pinballwake-coding-room.mjs";
import {
  createAutonomousRunner,
  inspectAutonomousRunnerJobSafety,
  markUnsafeJobsBlockedForAutonomousRunner,
  normalizeAutonomousRunnerMode,
  runAutonomousRunnerCycle,
  runAutonomousRunnerFile,
} from "./pinballwake-autonomous-runner.mjs";

const runner = createAutonomousRunner({
  id: "runner-plex-1",
  readiness: "builder_ready",
  capabilities: ["implementation", "test_fix", "docs_update"],
});

function safeJob(input = {}) {
  return createCodingRoomJob({
    jobId: input.jobId || "coding-room:autonomous-runner:safe",
    worker: "builder",
    chip: "safe scoped docs chip",
    files: ["docs/runner.md"],
    expectedProof: {
      requiresPr: false,
      requiresChangedFiles: false,
      requiresNonOverlap: true,
      requiresTests: false,
      tests: [],
    },
    ...input,
  });
}

describe("PinballWake autonomous Runner seat", () => {
  it("defaults unknown modes back to dry-run", () => {
    assert.equal(normalizeAutonomousRunnerMode("claim"), "claim");
    assert.equal(normalizeAutonomousRunnerMode("ship-it"), "dry-run");
  });

  it("claims safe scoped work through the existing Coding Room runner", () => {
    const result = runAutonomousRunnerCycle({
      ledger: createCodingRoomJobLedger({ jobs: [safeJob()] }),
      runner,
      mode: "claim",
      now: "2026-05-06T03:00:00.000Z",
      leaseSeconds: 60,
    });

    assert.equal(result.ok, true);
    assert.equal(result.action, "claimed");
    assert.equal(result.runner, "runner-plex-1");
    assert.equal(result.ledger.jobs[0].claimed_by, "runner-plex-1");
    assert.equal(result.ledger.jobs[0].lease_expires_at, "2026-05-06T03:01:00.000Z");
  });

  it("does not persist dry-run claims to disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autonomous-runner-"));
    const ledgerPath = join(dir, "ledger.json");
    try {
      await writeCodingRoomJobLedger(ledgerPath, createCodingRoomJobLedger({ jobs: [safeJob()] }));

      const result = await runAutonomousRunnerFile({
        ledgerPath,
        runner,
        mode: "dry-run",
        now: "2026-05-06T03:00:00.000Z",
      });

      assert.equal(result.ok, true);
      assert.equal(result.action, "claimed");
      assert.equal(result.persisted, false);

      const persisted = JSON.parse(await readFile(ledgerPath, "utf8"));
      assert.equal(persisted.jobs[0].status, "queued");
      assert.equal(persisted.jobs[0].claimed_by, null);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("persists claim mode to disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autonomous-runner-"));
    const ledgerPath = join(dir, "ledger.json");
    try {
      await writeCodingRoomJobLedger(ledgerPath, createCodingRoomJobLedger({ jobs: [safeJob()] }));

      const result = await runAutonomousRunnerFile({
        ledgerPath,
        runner,
        mode: "claim",
        now: "2026-05-06T03:00:00.000Z",
      });

      assert.equal(result.ok, true);
      assert.equal(result.persisted, true);

      const persisted = JSON.parse(await readFile(ledgerPath, "utf8"));
      assert.equal(persisted.jobs[0].status, "claimed");
      assert.equal(persisted.jobs[0].claimed_by, "runner-plex-1");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("blocks protected surfaces before claim", () => {
    const unsafe = safeJob({
      jobId: "coding-room:autonomous-runner:unsafe",
      chip: "rotate billing secret",
      files: ["api/billing/stripe.ts"],
    });

    assert.equal(inspectAutonomousRunnerJobSafety(unsafe).ok, false);

    const result = runAutonomousRunnerCycle({
      ledger: createCodingRoomJobLedger({ jobs: [unsafe] }),
      runner,
      mode: "claim",
      now: "2026-05-06T03:00:00.000Z",
    });

    assert.equal(result.ok, true);
    assert.equal(result.action, "idle");
    assert.equal(result.safety_blocked.length, 1);
    assert.equal(result.ledger.jobs[0].status, "blocked");
    assert.match(result.ledger.jobs[0].proof.blocker, /protected work/);
  });

  it("supports a hard kill switch", () => {
    const result = runAutonomousRunnerCycle({
      ledger: createCodingRoomJobLedger({ jobs: [safeJob()] }),
      runner,
      mode: "claim",
      policy: { disabled: true },
      now: "2026-05-06T03:00:00.000Z",
    });

    assert.equal(result.ok, true);
    assert.equal(result.action, "disabled");
    assert.equal(result.reason, "kill_switch_enabled");
    assert.equal(result.ledger.jobs[0].status, "queued");
  });

  it("does not enter execute mode unless explicitly enabled", () => {
    const result = runAutonomousRunnerCycle({
      ledger: createCodingRoomJobLedger({ jobs: [safeJob()] }),
      runner,
      mode: "execute",
      now: "2026-05-06T03:00:00.000Z",
    });

    assert.equal(result.ok, true);
    assert.equal(result.action, "blocked");
    assert.equal(result.reason, "execute_mode_disabled");
    assert.equal(result.ledger.jobs[0].status, "queued");
  });

  it("can block unsafe queued jobs without protected-surface exemptions", () => {
    const result = markUnsafeJobsBlockedForAutonomousRunner({
      ledger: createCodingRoomJobLedger({
        jobs: [
          safeJob({
            jobId: "coding-room:autonomous-runner:migration",
            chip: "alter table for auth sessions",
            files: ["supabase/migrations/001.sql"],
          }),
        ],
      }),
      now: "2026-05-06T03:00:00.000Z",
    });

    assert.equal(result.ok, true);
    assert.equal(result.blocked.length, 1);
    assert.equal(result.ledger.jobs[0].status, "blocked");
  });
});

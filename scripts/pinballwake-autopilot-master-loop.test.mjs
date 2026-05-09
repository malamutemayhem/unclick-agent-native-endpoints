import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateAutopilotMasterLoop } from "./pinballwake-autopilot-master-loop.mjs";
import {
  createCodingRoomJob,
  createCodingRoomJobLedger,
} from "./pinballwake-coding-room.mjs";

function readyLaunchpad() {
  return {
    rooms: ["build", "qc", "safety", "status"],
    masterHeartbeat: { target: "Launchpad Autopilot", enabled: true },
    orchestrator: {
      seat_id: "lenovo-master",
      role: "active",
      status: "active",
      lease_expires_at: "2026-05-05T02:00:00.000Z",
    },
    seats: [
      {
        id: "forge-seat",
        provider: "chatgpt",
        machine: "plex",
        app: "codex",
        status: "online",
        capacity: "high",
        delivery: ["desktop_bridge"],
        capabilities: ["implementation", "code", "build", "status_relay"],
      },
      {
        id: "popcorn-seat",
        provider: "claude",
        machine: "plex",
        app: "claude",
        status: "online",
        capacity: "medium",
        delivery: ["unclick"],
        capabilities: ["qc_review", "review"],
      },
      {
        id: "gatekeeper-seat",
        provider: "chatgpt",
        machine: "lenovo",
        app: "codex",
        status: "online",
        capacity: "medium",
        delivery: ["desktop_bridge"],
        capabilities: ["release_safety", "safety"],
      },
    ],
  };
}

function pr(input = {}) {
  return {
    number: 532,
    title: "feat(autopilot): add ACK ledger room",
    isDraft: true,
    mergeStateStatus: "CLEAN",
    statusCheckRollup: [
      { name: "CI", status: "COMPLETED", conclusion: "SUCCESS" },
      { name: "TestPass", status: "COMPLETED", conclusion: "SUCCESS" },
      { context: "Vercel", state: "SUCCESS" },
    ],
    ...input,
  };
}

function proofJob(prNumber = 532) {
  return createCodingRoomJob({
    source: "proof",
    prNumber,
    worker: "pinballwake-job-runner",
    chip: "Proof submitted",
    files: ["scripts/pinballwake-ack-ledger-room.mjs"],
    status: "proof_submitted",
    expectedProof: {
      tests: ["node --test scripts/pinballwake-ack-ledger-room.test.mjs"],
      requiresPr: false,
      requiresChangedFiles: false,
      requiresNonOverlap: true,
      requiresTests: true,
    },
    proof: {
      result: "done",
      changed_files: ["scripts/pinballwake-ack-ledger-room.mjs"],
      tests: [{ command: "node --test scripts/pinballwake-ack-ledger-room.test.mjs", status: "passed" }],
      submitted_at: "2026-05-05T01:00:00.000Z",
    },
  });
}

function readyLedger(...jobs) {
  return createCodingRoomJobLedger({ jobs });
}

function passComment(reviewer, prNumber = 532) {
  return {
    source: "fishbowl",
    message: `${reviewer} PASS on #${prNumber}. Latest head checked.`,
    author: reviewer.toLowerCase(),
    created_at: "2026-05-05T01:01:00.000Z",
  };
}

describe("PinballWake Autopilot Master Loop", () => {
  it("starts with Launchpad setup when the single orchestrator loop is not ready", () => {
    const result = evaluateAutopilotMasterLoop({
      launchpad: {},
      prs: [pr()],
    });

    assert.equal(result.result, "launchpad_setup_required");
    assert.equal(result.packet.worker, "master");
  });

  it("promotes repeated resistance before normal queue work", () => {
    const queuedJob = createCodingRoomJob({
      source: "manual",
      worker: "forge",
      chip: "Normal queued work",
      files: ["scripts/example.mjs"],
      expectedProof: { tests: ["node --test scripts/example.test.mjs"] },
    });

    const result = evaluateAutopilotMasterLoop({
      launchpad: readyLaunchpad(),
      ledger: readyLedger(queuedJob),
      signals: [
        {
          type: "resistance",
          title: "Popcorn PASS exists but Master cannot see it",
          detail: "manual nudge repeated; missing ACK mirror handoff",
          severity: "medium",
          count: 4,
        },
      ],
      now: "2026-05-05T01:05:00.000Z",
    });

    assert.equal(result.result, "front_of_line_improvement");
    assert.match(result.job.chip, /Improve ACK handoff/);
  });

  it("turns PR-scoped ACK comments into Merge Room ready without Chris chasing workers", () => {
    const result = evaluateAutopilotMasterLoop({
      launchpad: readyLaunchpad(),
      ledger: readyLedger(proofJob()),
      prs: [pr()],
      fishbowlMessagesByPr: {
        532: [
          passComment("Gatekeeper"),
          passComment("Popcorn"),
          passComment("Forge"),
        ],
      },
      now: "2026-05-05T01:05:00.000Z",
    });

    assert.equal(result.result, "merge_room_ready");
    assert.equal(result.pr_number, 532);
    assert.equal(result.ack_ledger.full_ack_set, true);
    assert.equal(result.merge_room.result, "ready_to_lift_and_merge");
    assert.equal(result.packet.worker, "master");
  });

  it("routes a targeted ACK packet when a reviewer is missing", () => {
    const result = evaluateAutopilotMasterLoop({
      launchpad: readyLaunchpad(),
      ledger: readyLedger(proofJob()),
      prs: [pr()],
      fishbowlMessagesByPr: {
        532: [
          passComment("Gatekeeper"),
          passComment("Forge"),
        ],
      },
      now: "2026-05-05T01:05:00.000Z",
    });

    assert.equal(result.result, "ack_missing");
    assert.deepEqual(result.ack_ledger.missing_reviewers, ["popcorn"]);
    assert.equal(result.packet.worker, "courier");
  });

  it("routes a latest reviewer blocker to a focused fix packet", () => {
    const result = evaluateAutopilotMasterLoop({
      launchpad: readyLaunchpad(),
      ledger: readyLedger(proofJob()),
      prs: [pr()],
      fishbowlMessagesByPr: {
        532: [
          passComment("Gatekeeper"),
          passComment("Popcorn"),
          passComment("Forge"),
          {
            source: "fishbowl",
            message: "Forge BLOCKER still stands on #532: stale proof mismatch.",
            author: "forge",
            created_at: "2026-05-05T01:10:00.000Z",
          },
        ],
      },
      now: "2026-05-05T01:11:00.000Z",
    });

    assert.equal(result.result, "review_blocker");
    assert.equal(result.ok, false);
    assert.equal(result.packet.worker, "forge");
  });

  it("dispatches normal Jobs Room work when no merge or improvement is waiting", () => {
    const queuedJob = createCodingRoomJob({
      source: "manual",
      worker: "forge",
      chip: "Build small docs chip",
      files: ["docs/autopilot.md"],
      expectedProof: { tests: ["node --test scripts/pinballwake-jobs-room.test.mjs"] },
    });

    const result = evaluateAutopilotMasterLoop({
      launchpad: readyLaunchpad(),
      ledger: readyLedger(queuedJob),
      prs: [],
      now: "2026-05-05T01:05:00.000Z",
    });

    assert.equal(result.result, "dispatch_worker_packet");
    assert.equal(result.packet.worker, "forge");
  });

  it("stays idle when Launchpad is ready and there is no safe action", () => {
    const result = evaluateAutopilotMasterLoop({
      launchpad: readyLaunchpad(),
      ledger: readyLedger(),
      prs: [],
      now: "2026-05-05T01:05:00.000Z",
    });

    assert.equal(result.result, "idle");
    assert.equal(result.reason, "no_safe_action");
  });
});

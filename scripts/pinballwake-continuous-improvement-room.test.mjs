import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateContinuousImprovementRoom } from "./pinballwake-continuous-improvement-room.mjs";

describe("PinballWake Continuous Improvement Room", () => {
  it("stays idle when no resistance is present", () => {
    const result = evaluateContinuousImprovementRoom({ signals: [] });

    assert.equal(result.ok, true);
    assert.equal(result.result, "idle");
    assert.equal(result.reason, "no_signals");
  });

  it("promotes repeated ACK handoff friction to a front-of-line build job", () => {
    const result = evaluateContinuousImprovementRoom({
      now: "2026-05-05T01:00:00.000Z",
      signals: [
        {
          type: "resistance",
          title: "Popcorn PASS exists in Fishbowl but Master cannot see it",
          detail: "manual nudge repeated; missing ACK mirror handoff",
          severity: "medium",
          count: 4,
        },
      ],
    });

    assert.equal(result.result, "front_of_line_build");
    assert.equal(result.improvement_kind, "ack_handoff");
    assert.equal(result.priority, "front_of_line");
    assert.equal(result.recommended_insertion, "prepend_to_coding_room_ledger");
    assert.match(result.job.chip, /Improve ACK handoff/);
    assert.equal(result.job.status, "queued");
    assert(result.job.owned_files.includes("scripts/pinballwake-merge-room.mjs"));
    assert(result.packet.expected_proof.includes("pinballwake-merge-room.test.mjs"));
    assert.equal(result.receipt.receipt_type, "native_improver_opportunity");
    assert.equal(result.receipt.emitted_at, "2026-05-05T01:00:00.000Z");
    assert.equal(result.receipt.improvement_kind, "ack_handoff");
    assert(result.receipt.evidence.some((item) => item.includes("missing ACK mirror handoff")));
    assert.match(result.receipt.next_action, /Improve ACK handoff/);
    assert.match(result.receipt.proof_required, /pinballwake-merge-room.test.mjs/);
    assert(result.receipt.xpass_advisory.includes("CommonSensePass"));
    assert.deepEqual(result.packet.evidence, result.receipt.evidence);
    assert.equal(result.packet.next_action, result.receipt.next_action);
    assert.equal(result.packet.proof_required, result.receipt.proof_required);
    assert.deepEqual(result.packet.xpass_advisory, result.receipt.xpass_advisory);
  });

  it("holds duplicate-covered opportunities instead of creating another build job", () => {
    const result = evaluateContinuousImprovementRoom({
      now: "2026-05-05T01:00:00.000Z",
      source: "heartbeat",
      signals: [
        {
          type: "stuck",
          title: "Queue idle for hours while jobs are waiting",
          detail: "runner dormant and repeated manual nudges required",
          severity: "high",
          count: 2,
          coveredByOpenTodo: "todo-123",
        },
      ],
    });

    assert.equal(result.result, "hold");
    assert.equal(result.reason, "covered_by_open_todo");
    assert.equal(result.improvement_kind, "queue_flow");
    assert.equal(result.duplicate_coverage.ref, "todo-123");
    assert.equal(result.job, undefined);
    assert.equal(result.receipt.receipt_type, "native_improver_hold");
    assert.equal(result.receipt.source, "heartbeat");
    assert.match(result.receipt.next_action, /duplicate build job/);
  });

  it("routes stale queue resistance to the queue and jobs surfaces", () => {
    const result = evaluateContinuousImprovementRoom({
      signals: [
        {
          type: "stuck",
          title: "Queue idle for hours while jobs are waiting",
          detail: "runner dormant and repeated manual nudges required",
          severity: "high",
          count: 2,
        },
      ],
    });

    assert.equal(result.result, "front_of_line_build");
    assert.equal(result.improvement_kind, "queue_flow");
    assert(result.job.owned_files.includes("scripts/pinballwake-jobs-room.mjs"));
    assert(result.job.owned_files.includes("scripts/pinballwake-queue-health-room.mjs"));
  });

  it("routes protected-surface issues through research/planning safeguards", () => {
    const result = evaluateContinuousImprovementRoom({
      signals: [
        {
          type: "blocker",
          title: "Token redaction issue escaped normal routing",
          detail: "credentials and api keys need protected DeepDive before coding",
          severity: "high",
        },
      ],
    });

    assert.equal(result.result, "front_of_line_build");
    assert.equal(result.improvement_kind, "protected_surface_safeguard");
    assert(result.job.owned_files.includes("scripts/pinballwake-research-room.mjs"));
    assert(result.job.owned_files.includes("scripts/pinballwake-planning-room.mjs"));
  });

  it("does not turn a resolved issue into a new build", () => {
    const result = evaluateContinuousImprovementRoom({
      signals: [
        {
          type: "blocker",
          title: "Merge HOLD resolved",
          detail: "fixed and merged",
          severity: "high",
          resolved: true,
        },
      ],
    });

    assert.equal(result.result, "idle");
    assert.equal(result.reason, "friction_below_build_threshold");
  });

  it("chooses the highest-value signal and ignores lower chatter", () => {
    const result = evaluateContinuousImprovementRoom({
      signals: [
        {
          type: "note",
          title: "silent cycle",
          detail: "no-op status refreshed",
          severity: "low",
        },
        {
          type: "blocker",
          title: "Draft lift keeps waiting on stale ACK",
          detail: "manual intervention required; missing ACK mirror",
          severity: "high",
          count: 3,
        },
      ],
    });

    assert.equal(result.result, "front_of_line_build");
    assert.equal(result.improvement_kind, "ack_handoff");
    assert.match(result.signal.title, /Draft lift/);
  });
});

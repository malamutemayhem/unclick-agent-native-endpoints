import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateWorkerLivenessWatchdog } from "./worker-liveness-watchdog.mjs";

const NOW = "2026-05-09T22:00:00.000Z";

describe("worker liveness watchdog", () => {
  it("marks stale workers without executing reroutes", () => {
    const result = evaluateWorkerLivenessWatchdog({
      now: NOW,
      workers: [
        {
          worker_id: "master",
          lane: "coordinator",
          last_seen_at: "2026-05-09T19:00:00.000Z",
        },
        {
          worker_id: "review-seat",
          lane: "reviewer",
          last_seen_at: "2026-05-09T21:50:00.000Z",
        },
      ],
    });

    assert.equal(result.ok, true);
    assert.equal(result.execute, false);
    assert.equal(result.no_execute_reason, "audit_only_no_reroute_execution");
    assert.equal(result.stale_worker_count, 1);
    assert.equal(result.active_worker_count, 1);
    assert.deepEqual(result.stale_workers[0].reasons, ["last_seen_stale"]);
  });

  it("creates an audit-only reroute packet when ACK is overdue and owner is stale", () => {
    const result = evaluateWorkerLivenessWatchdog({
      now: NOW,
      workers: [
        {
          worker_id: "master",
          lane: "coordinator",
          last_seen_at: "2026-05-09T19:00:00.000Z",
        },
        {
          worker_id: "review-seat",
          lane: "reviewer",
          last_seen_at: "2026-05-09T21:55:00.000Z",
        },
      ],
      assignments: [
        {
          id: "dispatch-1",
          title: "Review green PR queue",
          lane: "coordinator",
          assigned_to_agent_id: "master",
          ack_due_at: "2026-05-09T21:45:00.000Z",
        },
      ],
    });

    assert.equal(result.result, "attention_needed");
    assert.equal(result.assignment_issue_count, 1);
    assert.deepEqual(result.assignment_issues[0].issues, ["assigned_worker_stale", "ack_overdue"]);
    assert.equal(result.assignment_issues[0].fallback_worker_id, "review-seat");
    assert.equal(result.assignment_issues[0].fallback_lane, "reviewer");
    assert.equal(result.reroute_packets[0].execute, false);
    assert.equal(result.reroute_packets[0].required_reply, "PASS/BLOCKER/HOLD with proof source and next_checkin_at");
  });

  it("does not reroute active work before the lease or ACK window expires", () => {
    const result = evaluateWorkerLivenessWatchdog({
      now: NOW,
      workers: [
        {
          worker_id: "review-seat",
          lane: "reviewer",
          last_seen_at: "2026-05-09T21:55:00.000Z",
        },
      ],
      assignments: [
        {
          id: "dispatch-2",
          title: "Review green PR queue",
          lane: "reviewer",
          assigned_to_agent_id: "review-seat",
          ack_due_at: "2026-05-09T22:05:00.000Z",
          lease_expires_at: "2026-05-09T22:10:00.000Z",
        },
      ],
    });

    assert.equal(result.result, "clear");
    assert.equal(result.assignment_issue_count, 0);
    assert.deepEqual(result.reroute_packets, []);
    assert.ok(result.guardrails.includes("no_stealing_active_work"));
  });

  it("flags ACK-only deferrals that still need proof", () => {
    const result = evaluateWorkerLivenessWatchdog({
      now: NOW,
      workers: [
        {
          worker_id: "review-seat",
          lane: "reviewer",
          last_seen_at: "2026-05-09T21:55:00.000Z",
        },
        {
          worker_id: "test-seat",
          lane: "tester",
          last_seen_at: "2026-05-09T21:55:00.000Z",
        },
      ],
      assignments: [
        {
          id: "dispatch-3",
          title: "Review green PR queue",
          lane: "reviewer",
          assigned_to_agent_id: "review-seat",
          ack_received_at: "2026-05-09T21:40:00.000Z",
          requires_proof: true,
          proof_status: "deferred to next active cycle",
        },
      ],
    });

    assert.equal(result.assignment_issue_count, 1);
    assert.deepEqual(result.assignment_issues[0].issues, ["proof_deferred_after_ack"]);
    assert.equal(result.assignment_issues[0].fallback_worker_id, "test-seat");
    assert.equal(result.assignment_issues[0].fallback_lane, "tester");
  });

  it("reports no live fallback instead of stealing unavailable work", () => {
    const result = evaluateWorkerLivenessWatchdog({
      now: NOW,
      workers: [
        {
          worker_id: "master",
          lane: "coordinator",
          last_seen_at: "2026-05-09T19:00:00.000Z",
        },
      ],
      assignments: [
        {
          id: "dispatch-4",
          title: "Coordinate queue",
          lane: "coordinator",
          assigned_to_agent_id: "master",
          ack_due_at: "2026-05-09T21:45:00.000Z",
        },
      ],
    });

    assert.equal(result.assignment_issue_count, 1);
    assert.equal(result.assignment_issues[0].fallback_reason, "no_live_fallback");
    assert.equal(result.reroute_packets[0].to_worker_id, null);
    assert.equal(result.reroute_packets[0].execute, false);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateAutoPilotKitSchedulerWatchdog,
  evaluateAutoPilotKitLiveness,
  evaluateOrchestratorProofWakeGate,
  extractMissedAckSignals,
  normalizeSeatLiveness,
  parseMs,
} from "./lib/autopilotkit-liveness.mjs";

const NOW = "2026-05-09T22:37:17.000Z";
const NOW_MS = parseMs(NOW);

describe("AutoPilotKit liveness helpers", () => {
  it("normalizes a dormant coordinator into an advisory fallback signal", () => {
    const worker = normalizeSeatLiveness(
      {
        agent_id: "master",
        display_name: "Master Coordinator",
        user_agent_hint: "unclick-master/coordinator",
        last_seen_at: "2026-05-06T03:59:07.640Z",
      },
      { nowMs: NOW_MS },
    );

    assert.equal(worker.lane, "coordinator");
    assert.equal(worker.freshness, "dormant");
    assert(worker.reasons.includes("coordinator_fallback_needed"));
  });

  it("builds Review Coordinator and Jobs Manager adapter packets without execute authority", () => {
    const result = evaluateAutoPilotKitLiveness({
      now: NOW,
      profiles: [
        {
          agent_id: "claude-cowork-seat",
          display_name: "Reviewer Seat",
          current_status: "ACKed PR #640 wake; actual diff pass deferred",
          last_seen_at: "2026-05-09T22:30:00.000Z",
          current_status_updated_at: "2026-05-09T22:30:00.000Z",
        },
        {
          agent_id: "master",
          display_name: "Master Coordinator",
          last_seen_at: "2026-05-06T03:59:07.640Z",
        },
      ],
      messages: [
        {
          id: "wake-640",
          tags: ["wakepass", "reroute"],
          text: "WakePass auto-reroute. Reason: missed ACK for Review Coordinator.",
        },
      ],
    });

    assert.equal(result.safe_mode.read_only, true);
    assert.equal(result.adapter_examples.review_coordinator.execute, false);
    assert.equal(result.adapter_examples.jobs_manager.execute, false);
    assert(result.adapter_examples.review_coordinator.reason_codes.includes("missed_ack_reroute_detected"));
    assert(result.adapter_examples.jobs_manager.reason_codes.includes("coordinator_fallback_needed"));
  });

  it("redacts sensitive text from missed ACK excerpts", () => {
    const signals = extractMissedAckSignals([
      {
        id: "wake-secret",
        tags: ["wakepass"],
        text: "WakePass auto-reroute with token sk-testsecret1234567890 in copied debug text",
      },
    ]);

    assert.equal(signals.length, 1);
    assert.equal(signals[0].excerpt, "[redacted-sensitive-text]");
  });

  it("turns stale scheduler evidence plus a fresh UnClick heartbeat into a safe fallback tap", () => {
    const result = evaluateAutoPilotKitSchedulerWatchdog({
      now: "2026-05-10T03:46:57.000Z",
      expectedEveryMinutes: 15,
      graceMinutes: 15,
      trustedFallbackFreshMinutes: 10,
      schedules: [
        {
          id: "fleet-throughput-watch",
          name: "Fleet Throughput Watch",
          last_scheduled_at: "2026-05-10T01:24:03.000Z",
        },
      ],
      trustedFallback: {
        source: "unclick_heartbeat",
        source_id: "heartbeat-03-46",
        created_at: "2026-05-10T03:46:00.000Z",
      },
    });

    assert.equal(result.action, "tap_orchestrator_with_trusted_unclick_fallback");
    assert.equal(result.reason, "schedule_stale_trusted_fallback_fresh");
    assert.deepEqual(result.stale_schedule_ids, ["fleet-throughput-watch"]);
    assert.equal(result.trusted_fallback.trusted, true);
    assert.equal(result.safe_mode.no_manual_dispatch_as_schedule, true);
  });

  it("keeps fresh schedules in watch mode", () => {
    const result = evaluateAutoPilotKitSchedulerWatchdog({
      now: "2026-05-10T03:46:57.000Z",
      expectedEveryMinutes: 15,
      graceMinutes: 15,
      schedules: [
        {
          id: "pinballwake",
          last_scheduled_at: "2026-05-10T03:37:00.000Z",
        },
      ],
    });

    assert.equal(result.action, "watch");
    assert.equal(result.reason, "schedules_fresh");
    assert.deepEqual(result.stale_schedule_ids, []);
  });

  it("does not let manual workflow dispatch masquerade as scheduled Orchestrator proof", () => {
    const gate = evaluateOrchestratorProofWakeGate({
      now: "2026-05-10T03:46:57.000Z",
      source: "workflow_dispatch",
    });

    assert.equal(gate.allow, false);
    assert.equal(gate.reason, "manual_dispatch_is_not_scheduled_proof");
    assert.equal(gate.safe_mode.no_manual_dispatch_as_schedule, true);
  });
});

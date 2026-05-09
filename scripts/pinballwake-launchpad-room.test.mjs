import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createLaunchpadHeartbeatPrompt,
  evaluateLaunchpadRoom,
} from "./pinballwake-launchpad-room.mjs";

function seat(input = {}) {
  return {
    id: input.id || "plex-chatgpt",
    provider: input.provider || "chatgpt",
    machine: input.machine || "plex",
    app: input.app || "codex",
    status: input.status || "available",
    capabilities: input.capabilities || ["implementation", "proof", "status_relay"],
    delivery: input.delivery || ["desktop_bridge"],
    usage: { remaining: input.remaining || "high" },
    current_jobs: input.current_jobs || 0,
    reliability: input.reliability ?? 90,
  };
}

function activeOrchestrator(input = {}) {
  return {
    id: input.id || "lenovo-master",
    role: input.role || "active",
    status: input.status || "active",
    machine: input.machine || "lenovo",
    provider: input.provider || "chatgpt",
    heartbeat_id: input.heartbeat_id || "launchpad-heartbeat",
    lease_expires_at: input.lease_expires_at,
  };
}

describe("PinballWake Launchpad Room", () => {
  it("passes when one master heartbeat and enough worker seats are registered", () => {
    const result = evaluateLaunchpadRoom({
      masterHeartbeat: { enabled: true, target: "launchpad" },
      orchestrator: activeOrchestrator(),
      seats: [
        seat({ id: "plex-chatgpt", capabilities: ["implementation", "proof", "status_relay"] }),
        seat({ id: "plex-claude", provider: "claude", app: "claude", capabilities: ["qc_review", "research", "planning"] }),
        seat({ id: "lenovo-chatgpt", machine: "lenovo", capabilities: ["release_safety", "merge_proof", "status_relay"] }),
      ],
      rooms: ["build", "proof", "qc", "safety", "research", "planning", "status"],
    });

    assert.equal(result.result, "ready");
    assert.equal(result.single_heartbeat.ready, true);
    assert.equal(result.orchestrator_control.result, "single_active_orchestrator");
    assert.deepEqual(result.room_coverage.map((room) => room.covered), [true, true, true, true, true, true, true]);
    assert.equal(result.setup_steps.length, 0);
  });

  it("creates the single heartbeat wizard prompt when the master heartbeat is missing", () => {
    const result = evaluateLaunchpadRoom({
      orchestrator: activeOrchestrator(),
      seats: [seat()],
      rooms: ["build"],
      heartbeatMinutes: 17,
    });

    assert.equal(result.result, "setup_needed");
    assert.equal(result.single_heartbeat.ready, false);
    assert.match(result.single_heartbeat.prompt, /recurring heartbeat every 17 minutes/);
    assert.equal(result.setup_steps[0].kind, "create_single_master_heartbeat");
    assert.equal(result.wizard_packet.worker, "master");
  });

  it("treats accounts as capacity and chooses the best available seat per room", () => {
    const result = evaluateLaunchpadRoom({
      masterHeartbeat: { enabled: true, target: "UnClick Autopilot master" },
      orchestrator: activeOrchestrator(),
      seats: [
        seat({ id: "busy-builder", capabilities: ["implementation"], current_jobs: 2, remaining: "medium", reliability: 80 }),
        seat({ id: "fresh-builder", capabilities: ["implementation"], current_jobs: 0, remaining: "high", reliability: 90 }),
      ],
      rooms: ["build"],
    });

    assert.equal(result.result, "ready");
    assert.equal(result.room_coverage[0].primary_seat, "fresh-builder");
  });

  it("does not route heavy rooms to exhausted or near-limit seats", () => {
    const result = evaluateLaunchpadRoom({
      masterHeartbeat: { enabled: true, target: "launchpad" },
      orchestrator: activeOrchestrator(),
      seats: [
        seat({ id: "exhausted-builder", capabilities: ["implementation"], remaining: "exhausted" }),
        seat({ id: "low-builder", capabilities: ["implementation"], remaining: "low" }),
      ],
      rooms: ["build", "status"],
    });

    assert.equal(result.result, "setup_needed");
    assert.equal(result.room_coverage.find((room) => room.room === "build").covered, false);
    assert.equal(result.room_coverage.find((room) => room.room === "status").covered, false);
    assert.ok(result.setup_steps.some((step) => step.detail.includes("build")));
  });

  it("allows low-capacity seats to cover status only", () => {
    const result = evaluateLaunchpadRoom({
      masterHeartbeat: { enabled: true, target: "launchpad" },
      orchestrator: activeOrchestrator(),
      seats: [
        seat({ id: "low-status", capabilities: ["status_relay"], remaining: "low" }),
      ],
      rooms: ["status"],
    });

    assert.equal(result.result, "ready");
    assert.equal(result.room_coverage[0].primary_seat, "low-status");
  });

  it("flags missing delivery adapters and incomplete profiles", () => {
    const result = evaluateLaunchpadRoom({
      masterHeartbeat: { enabled: true, target: "launchpad" },
      orchestrator: activeOrchestrator(),
      seats: [
        { id: "half-seat", provider: "chatgpt", status: "available", capabilities: ["implementation"] },
      ],
      rooms: ["build"],
    });

    assert.equal(result.result, "setup_needed");
    assert.ok(result.setup_steps.some((step) => step.kind === "complete_worker_profile"));
    assert.ok(result.setup_steps.some((step) => step.kind === "connect_delivery_adapter"));
  });

  it("marks legacy worker schedules for consolidation under Launchpad", () => {
    const result = evaluateLaunchpadRoom({
      masterHeartbeat: { enabled: true, target: "launchpad" },
      orchestrator: activeOrchestrator(),
      seats: [seat()],
      rooms: ["build"],
      legacyWorkerSchedules: [
        { id: "forge-heartbeat", name: "Forge focused implementation heartbeat" },
        { id: "popcorn-heartbeat", name: "Popcorn QC heartbeat", status: "disabled" },
      ],
    });

    assert.equal(result.result, "setup_needed");
    assert.equal(result.legacy_worker_schedules.length, 1);
    assert.equal(result.legacy_worker_schedules[0].action, "consolidate_under_launchpad");
  });

  it("allows multiple possible orchestrators but only one active", () => {
    const result = evaluateLaunchpadRoom({
      masterHeartbeat: { enabled: true, target: "launchpad" },
      orchestrators: [
        activeOrchestrator({ id: "lenovo-master", role: "active" }),
        activeOrchestrator({ id: "plex-master-ui", role: "standby", status: "standby", machine: "plex" }),
      ],
      seats: [seat()],
      rooms: ["build"],
    });

    assert.equal(result.result, "ready");
    assert.equal(result.orchestrator_control.active_orchestrator.seat_id, "lenovo-master");
    assert.equal(result.orchestrator_control.standby_orchestrators.length, 1);
  });

  it("blocks split-brain when two chats try to orchestrate at once", () => {
    const result = evaluateLaunchpadRoom({
      masterHeartbeat: { enabled: true, target: "launchpad" },
      orchestrators: [
        activeOrchestrator({ id: "lenovo-master", role: "active" }),
        activeOrchestrator({ id: "plex-master", role: "active", machine: "plex" }),
      ],
      seats: [seat()],
      rooms: ["build"],
    });

    assert.equal(result.result, "setup_needed");
    assert.equal(result.orchestrator_control.result, "split_brain");
    assert.equal(result.setup_steps[0].kind, "resolve_orchestrator_control");
  });

  it("marks expired active orchestrator leases as failover-ready", () => {
    const result = evaluateLaunchpadRoom({
      masterHeartbeat: { enabled: true, target: "launchpad" },
      orchestrators: [
        activeOrchestrator({ id: "lenovo-master", role: "active", lease_expires_at: "2026-05-04T00:00:00.000Z" }),
        activeOrchestrator({ id: "plex-standby", role: "standby", status: "standby", machine: "plex" }),
      ],
      seats: [seat()],
      rooms: ["build"],
      now: "2026-05-04T00:10:00.000Z",
    });

    assert.equal(result.result, "setup_needed");
    assert.equal(result.orchestrator_control.result, "orchestrator_failover_ready");
    assert.equal(result.orchestrator_control.expired_orchestrators[0].seat_id, "lenovo-master");
  });

  it("generates a copy-pasteable chat-end Launchpad heartbeat prompt", () => {
    const prompt = createLaunchpadHeartbeatPrompt({ minutes: 15 });

    assert.match(prompt, /Launchpad Wizard/);
    assert.match(prompt, /one master chat only/);
    assert.match(prompt, /Do not directly spam every worker/);
    assert.match(prompt, /No secrets/);
  });
});

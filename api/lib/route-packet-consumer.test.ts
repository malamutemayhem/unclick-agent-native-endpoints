import { describe, expect, it } from "vitest";
import { runRoutePacketConsumerDryRun, type RoutePacket } from "./route-packet-consumer";

const basePacket: RoutePacket = {
  experiment: true,
  lane: "Builder",
  item: {
    id: "experiment-route-packet-proof",
    title: "Experiment: internal route packet proof",
  },
  needed_action: "Move one item forward.",
  expected_receipt: ["proof", "HOLD", "BLOCKER"],
  created_at: "2026-05-09T00:00:00.000Z",
  ttl_seconds: 1200,
};

describe("route packet consumer dry run", () => {
  it("assigns an experiment Builder packet to a live Builder", () => {
    const result = runRoutePacketConsumerDryRun({
      packet: basePacket,
      visibleWorkers: [{ agent_id: "builder-live", lane: "Builder", status: "active" }],
      now: new Date("2026-05-09T00:05:00.000Z"),
    });

    expect(result).toMatchObject({
      dry_run: true,
      writes: [],
      decision: {
        status: "assigned",
        receipt: "assigned",
        target_agent_id: "builder-live",
        reason: "live_worker_available",
      },
    });
  });

  it("returns an honest blocker when no live Builder is available", () => {
    const result = runRoutePacketConsumerDryRun({
      packet: basePacket,
      visibleWorkers: [{ agent_id: "watcher-live", lane: "Watcher", status: "active" }],
      now: new Date("2026-05-09T00:05:00.000Z"),
    });

    expect(result.decision).toEqual({
      status: "BLOCKER",
      receipt: "BLOCKER",
      target_agent_id: "coordinator",
      reason: "no_live_builder_available",
    });
  });

  it("holds expired packets instead of assigning stale work", () => {
    const result = runRoutePacketConsumerDryRun({
      packet: basePacket,
      visibleWorkers: [{ agent_id: "builder-live", lane: "Builder", status: "active" }],
      now: new Date("2026-05-09T00:30:01.000Z"),
    });

    expect(result.decision).toEqual({
      status: "HOLD",
      receipt: "HOLD",
      target_agent_id: "coordinator",
      reason: "ttl_expired",
    });
  });
});

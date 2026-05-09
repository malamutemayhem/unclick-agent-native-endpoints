import { describe, expect, it } from "vitest";
import { buildTetherRoutePacket } from "./tether-route-packet";
import { buildUnClickConnectDispatchRow } from "./route-packet-dispatch";

const now = new Date("2026-05-09T00:20:00.000Z");

describe("buildUnClickConnectDispatchRow", () => {
  it("writes a leased dispatch when a live Builder exists", () => {
    const packet = buildTetherRoutePacket(
      { item_id: "todo-123", lane: "Builder", idempotency_key: "connect-1" },
      new Date("2026-05-09T00:10:00.000Z"),
    );
    const row = buildUnClickConnectDispatchRow({
      apiKeyHash: "hash-123",
      packet,
      visibleWorkers: [{ agent_id: "builder-live", lane: "Builder", status: "active" }],
      now,
    });

    expect(row).toMatchObject({
      api_key_hash: "hash-123",
      source: "connectors",
      target_agent_id: "builder-live",
      task_ref: "todo-123",
      status: "leased",
      lease_owner: "builder-live",
      lease_expires_at: "2026-05-09T00:30:00.000Z",
      payload: {
        kind: "unclick_connect_route_packet",
        receipt: {
          status: "assigned",
          receipt: "assigned",
          target_agent_id: "builder-live",
        },
      },
    });
    expect(row.dispatch_id).toMatch(/^dispatch_/);
  });

  it("writes a failed dispatch with BLOCKER when no Builder exists", () => {
    const packet = buildTetherRoutePacket(
      { item_id: "todo-123", lane: "Builder", idempotency_key: "connect-1" },
      new Date("2026-05-09T00:10:00.000Z"),
    );
    const row = buildUnClickConnectDispatchRow({
      apiKeyHash: "hash-123",
      packet,
      visibleWorkers: [],
      now,
    });

    expect(row).toMatchObject({
      target_agent_id: "coordinator",
      status: "failed",
      lease_owner: null,
      lease_expires_at: null,
      payload: {
        receipt: {
          status: "BLOCKER",
          receipt: "BLOCKER",
          reason: "no_live_builder_available",
        },
      },
    });
  });

  it("writes a stale dispatch with HOLD when packet TTL has expired", () => {
    const packet = buildTetherRoutePacket(
      { item_id: "todo-123", lane: "Builder", ttl_seconds: 60 },
      new Date("2026-05-09T00:10:00.000Z"),
    );
    const row = buildUnClickConnectDispatchRow({
      apiKeyHash: "hash-123",
      packet,
      visibleWorkers: [{ agent_id: "builder-live", lane: "Builder", status: "active" }],
      now,
    });

    expect(row).toMatchObject({
      target_agent_id: "coordinator",
      status: "stale",
      payload: {
        receipt: {
          status: "HOLD",
          receipt: "HOLD",
          reason: "ttl_expired",
        },
      },
    });
  });

  it("rejects non-experiment commit rows", () => {
    const packet = buildTetherRoutePacket({ experiment: false });
    expect(() =>
      buildUnClickConnectDispatchRow({
        apiKeyHash: "hash-123",
        packet,
        visibleWorkers: [],
        now,
      }),
    ).toThrow("experiment-only");
  });
});

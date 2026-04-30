import { describe, expect, it } from "vitest";
import {
  createDispatchId,
  createHeartbeat,
  createReclaimSignal,
  createTimeBucket,
  decideStaleLease,
} from "../reliability.js";

describe("reliability helpers", () => {
  it("creates a stable dispatch ID from sorted payload data", () => {
    const first = createDispatchId({
      source: "fishbowl",
      targetAgentId: "bailey",
      taskRef: "chip-123",
      timeBucket: "2026-04-30T11:00:00.000Z",
      payload: { b: 2, a: 1 },
    });

    const second = createDispatchId({
      source: "fishbowl",
      targetAgentId: "bailey",
      taskRef: "chip-123",
      timeBucket: "2026-04-30T11:00:00.000Z",
      payload: { a: 1, b: 2 },
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^dispatch_[a-f0-9]{32}$/);
  });

  it("creates different dispatch IDs when the task changes", () => {
    const first = createDispatchId({
      source: "fishbowl",
      targetAgentId: "bailey",
      taskRef: "chip-123",
    });

    const second = createDispatchId({
      source: "fishbowl",
      targetAgentId: "bailey",
      taskRef: "chip-124",
    });

    expect(first).not.toBe(second);
  });

  it("buckets dispatch time into stable windows", () => {
    expect(createTimeBucket(new Date("2026-04-30T11:00:04.999Z"), 5)).toBe(
      "2026-04-30T11:00:00.000Z",
    );
    expect(createTimeBucket(new Date("2026-04-30T11:00:05.000Z"), 5)).toBe(
      "2026-04-30T11:00:05.000Z",
    );
  });

  it("detects expired leases", () => {
    const decision = decideStaleLease(
      {
        status: "leased",
        leaseExpiresAt: "2026-04-30T11:00:00.000Z",
      },
      new Date("2026-04-30T11:00:12.300Z"),
    );

    expect(decision).toEqual({
      isStale: true,
      reason: "lease_expired",
      staleSeconds: 12,
    });
  });

  it("does not mark active or non-leased work as stale", () => {
    expect(
      decideStaleLease(
        {
          status: "leased",
          leaseExpiresAt: "2026-04-30T11:00:12.000Z",
        },
        new Date("2026-04-30T11:00:10.000Z"),
      ),
    ).toMatchObject({ isStale: false, reason: "lease_active" });

    expect(
      decideStaleLease(
        {
          status: "queued",
          leaseExpiresAt: "2026-04-30T11:00:00.000Z",
        },
        new Date("2026-04-30T11:00:10.000Z"),
      ),
    ).toMatchObject({ isStale: false, reason: "not_leased" });
  });

  it("creates compact heartbeat metadata", () => {
    const heartbeat = createHeartbeat({
      apiKeyHash: "hash_123",
      agentId: "bailey",
      dispatchId: "dispatch_abc",
      state: "working",
      currentTask: "write WakePass PRD",
      nextAction: "open PR",
      etaMinutes: 4,
      createdAt: new Date("2026-04-30T11:00:00.000Z"),
      lastRealActionAt: new Date("2026-04-30T10:59:30.000Z"),
    });

    expect(heartbeat).toEqual({
      apiKeyHash: "hash_123",
      agentId: "bailey",
      dispatchId: "dispatch_abc",
      state: "working",
      currentTask: "write WakePass PRD",
      nextAction: "open PR",
      etaMinutes: 4,
      createdAt: "2026-04-30T11:00:00.000Z",
      lastRealActionAt: "2026-04-30T10:59:30.000Z",
    });
  });

  it("marks missing-ack handoffs as a WakePass reliability miss", () => {
    const signal = createReclaimSignal(
      {
        dispatchId: "dispatch_ack",
        source: "fishbowl",
        targetAgentId: "plex",
        taskRef: "todo-123",
        payload: { ack_required: true, handoff_message_id: "msg-abc" },
      },
      95,
    );

    expect(signal).toEqual({
      action: "handoff_ack_missing",
      summary: "WakePass reliability miss: no ACK arrived before reclaim for plex",
      payload: {
        dispatch_id: "dispatch_ack",
        source: "fishbowl",
        target_agent_id: "plex",
        task_ref: "todo-123",
        stale_seconds: 95,
        ack_required: true,
        handoff_message_id: "msg-abc",
      },
    });
  });

  it("marks non-ack reclaim as a generic stale dispatch", () => {
    const signal = createReclaimSignal(
      {
        dispatchId: "dispatch_generic",
        source: "connectors",
        targetAgentId: "bailey",
        taskRef: "conn-42",
        payload: { route: "oauth-health" },
      },
      12,
    );

    expect(signal.action).toBe("stale_dispatch_reclaimed");
    expect(signal.summary).toBe("Reclaimed stale connectors dispatch for bailey");
    expect(signal.payload).toMatchObject({
      dispatch_id: "dispatch_generic",
      source: "connectors",
      target_agent_id: "bailey",
      task_ref: "conn-42",
      stale_seconds: 12,
      route: "oauth-health",
    });
  });
});

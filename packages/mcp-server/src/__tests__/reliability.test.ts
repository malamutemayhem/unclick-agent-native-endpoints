import { describe, expect, it } from "vitest";
import {
  createDispatchId,
  createHeartbeat,
  createOperatorTelemetry,
  parseOptionalFilterToken,
  parseRequiredToken,
  createQueuedDispatch,
  createReclaimSignal,
  createTimeBucket,
  decideStaleLease,
  parseHeartbeatEtaMinutes,
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

  it("creates a queued dispatch from stable inputs", () => {
    const dispatch = createQueuedDispatch({
      apiKeyHash: "hash_123",
      source: "wakepass",
      targetAgentId: "coder",
      taskRef: "pr-314",
      timeBucket: "2026-04-30T13:40:00.000Z",
      payload: { b: 2, a: 1 },
      createdAt: new Date("2026-04-30T13:41:00.000Z"),
    });

    expect(dispatch).toEqual({
      apiKeyHash: "hash_123",
      dispatchId: createDispatchId({
        source: "wakepass",
        targetAgentId: "coder",
        taskRef: "pr-314",
        timeBucket: "2026-04-30T13:40:00.000Z",
        payload: { a: 1, b: 2 },
      }),
      source: "wakepass",
      targetAgentId: "coder",
      taskRef: "pr-314",
      status: "queued",
      createdAt: "2026-04-30T13:41:00.000Z",
      updatedAt: "2026-04-30T13:41:00.000Z",
      payload: { b: 2, a: 1 },
    });
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

  it("treats missing or invalid lease expiry as not reclaimable", () => {
    expect(
      decideStaleLease(
        {
          status: "leased",
          leaseExpiresAt: null,
        },
        new Date("2026-04-30T11:00:10.000Z"),
      ),
    ).toEqual({ isStale: false, reason: "missing_lease_expiry", staleSeconds: 0 });

    expect(
      decideStaleLease(
        {
          status: "leased",
          leaseExpiresAt: "not-a-date",
        },
        new Date("2026-04-30T11:00:10.000Z"),
      ),
    ).toEqual({ isStale: false, reason: "missing_lease_expiry", staleSeconds: 0 });
  });

  it("fails closed when stale lease check receives an invalid current time", () => {
    expect(
      decideStaleLease(
        {
          status: "leased",
          leaseExpiresAt: "2026-04-30T11:00:00.000Z",
        },
        new Date("invalid"),
      ),
    ).toEqual({ isStale: false, reason: "lease_active", staleSeconds: 0 });
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

  it("sanitizes heartbeat ETA values in createHeartbeat", () => {
    const invalid = createHeartbeat({
      apiKeyHash: "hash_123",
      agentId: "bailey",
      state: "working",
      etaMinutes: Number.NaN,
      createdAt: new Date("2026-04-30T11:00:00.000Z"),
    });

    const clamped = createHeartbeat({
      apiKeyHash: "hash_123",
      agentId: "bailey",
      state: "working",
      etaMinutes: 20000,
      createdAt: new Date("2026-04-30T11:00:00.000Z"),
    });

    expect(invalid.etaMinutes).toBeUndefined();
    expect(clamped.etaMinutes).toBe(10080);
  });

  it("parses heartbeat ETA from number and numeric string inputs", () => {
    expect(parseHeartbeatEtaMinutes(4.8)).toBe(4);
    expect(parseHeartbeatEtaMinutes("12")).toBe(12);
    expect(parseHeartbeatEtaMinutes(" 0 ")).toBe(0);
  });

  it("clamps invalid or extreme heartbeat ETA values safely", () => {
    expect(parseHeartbeatEtaMinutes(-8)).toBe(0);
    expect(parseHeartbeatEtaMinutes(20000)).toBe(10080);
    expect(parseHeartbeatEtaMinutes("not-a-number")).toBeUndefined();
    expect(parseHeartbeatEtaMinutes(null)).toBeUndefined();
  });

  it("creates operator-safe telemetry without tenant hash or payload", () => {
    const dispatch = createQueuedDispatch({
      apiKeyHash: "hash_secret",
      source: "fishbowl",
      targetAgentId: "plex",
      taskRef: "handoff-1",
      payload: { private_note: "do not surface" },
      createdAt: new Date("2026-04-30T13:00:00.000Z"),
    });

    const heartbeat = createHeartbeat({
      apiKeyHash: "hash_secret",
      agentId: "plex",
      dispatchId: dispatch.dispatchId,
      state: "blocked",
      currentTask: "resolve conflict",
      nextAction: "post blocker",
      blocker: "merge conflict",
      etaMinutes: 15,
      createdAt: new Date("2026-04-30T13:02:00.000Z"),
      lastRealActionAt: new Date("2026-04-30T13:01:00.000Z"),
    });

    const telemetry = createOperatorTelemetry({
      dispatch,
      heartbeat,
      staleDecision: {
        isStale: false,
        reason: "lease_active",
        staleSeconds: 0,
      },
    });

    expect(telemetry).toEqual({
      dispatchId: dispatch.dispatchId,
      source: "fishbowl",
      targetAgentId: "plex",
      status: "queued",
      updatedAt: "2026-04-30T13:00:00.000Z",
      agentId: "plex",
      heartbeatState: "blocked",
      currentTask: "resolve conflict",
      nextAction: "post blocker",
      blocker: "merge conflict",
      etaMinutes: 15,
      lastRealActionAt: "2026-04-30T13:01:00.000Z",
      stale: false,
      staleReason: "lease_active",
      staleSeconds: 0,
    });
    expect(JSON.stringify(telemetry)).not.toContain("hash_secret");
    expect(JSON.stringify(telemetry)).not.toContain("private_note");
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

  it("treats string and numeric ACK flags as ACK-required handoffs", () => {
    const stringAck = createReclaimSignal(
      {
        dispatchId: "dispatch_ack_string",
        source: "wakepass",
        targetAgentId: "coder",
        payload: { require_ack: "true" },
      },
      61,
    );

    const numericAck = createReclaimSignal(
      {
        dispatchId: "dispatch_ack_numeric",
        source: "wakepass",
        targetAgentId: "coder",
        payload: { ack_required: 1 },
      },
      61,
    );

    expect(stringAck.action).toBe("handoff_ack_missing");
    expect(numericAck.action).toBe("handoff_ack_missing");
  });

  it("requires non-empty handoff IDs before classifying as missing ACK", () => {
    const emptyHandoff = createReclaimSignal(
      {
        dispatchId: "dispatch_empty_handoff",
        source: "wakepass",
        targetAgentId: "coder",
        payload: { handoff_message_id: "   " },
      },
      61,
    );

    const validHandoff = createReclaimSignal(
      {
        dispatchId: "dispatch_valid_handoff",
        source: "wakepass",
        targetAgentId: "coder",
        payload: { handoff_thread_id: "thread-123" },
      },
      61,
    );

    expect(emptyHandoff.action).toBe("stale_dispatch_reclaimed");
    expect(validHandoff.action).toBe("handoff_ack_missing");
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

  it("parses optional heartbeat list filters safely", () => {
    expect(parseOptionalFilterToken(undefined, "agent_id")).toEqual({});
    expect(parseOptionalFilterToken("  ", "agent_id")).toEqual({});
    expect(parseOptionalFilterToken("worker_1", "agent_id")).toEqual({ value: "worker_1" });
    expect(parseOptionalFilterToken("dispatch_abc", "dispatch_id", 256)).toEqual({
      value: "dispatch_abc",
    });
  });

  it("rejects malformed heartbeat list filters", () => {
    expect(parseOptionalFilterToken(["bad"], "agent_id").error).toBe("agent_id must be a string");
    expect(parseOptionalFilterToken("bad id", "agent_id").error).toBe(
      "agent_id must not contain whitespace",
    );
    expect(parseOptionalFilterToken("bad\tid", "dispatch_id", 256).error).toBe(
      "dispatch_id must not contain whitespace",
    );
    expect(parseOptionalFilterToken(`a${"\u0001"}b`, "agent_id").error).toBe(
      "agent_id contains invalid control characters",
    );
    expect(parseOptionalFilterToken("x".repeat(257), "dispatch_id", 256).error).toBe(
      "dispatch_id must be at most 256 characters",
    );
  });

  it("parses required publish tokens safely", () => {
    expect(parseRequiredToken(" worker-1 ", "agent_id")).toEqual({ value: "worker-1" });
    expect(parseRequiredToken(undefined, "agent_id")).toEqual({ error: "agent_id required" });
    expect(parseRequiredToken("  ", "agent_id")).toEqual({ error: "agent_id required" });
  });

  it("rejects malformed required publish tokens", () => {
    expect(parseRequiredToken("bad id", "agent_id").error).toBe(
      "agent_id must not contain whitespace",
    );
    expect(parseRequiredToken("x".repeat(129), "agent_id", 128).error).toBe(
      "agent_id must be at most 128 characters",
    );
  });

  it("parses reliability dispatch token fields with dispatch-specific bounds", () => {
    expect(parseRequiredToken(" dispatch_abc ", "dispatch_id", 256)).toEqual({
      value: "dispatch_abc",
    });
    expect(parseOptionalFilterToken(" lease_owner_1 ", "lease_owner", 128)).toEqual({
      value: "lease_owner_1",
    });
    expect(parseRequiredToken("target-agent-1", "target_agent_id", 128)).toEqual({
      value: "target-agent-1",
    });
  });

  it("rejects malformed reliability dispatch token fields", () => {
    expect(parseRequiredToken("bad dispatch", "dispatch_id", 256).error).toBe(
      "dispatch_id must not contain whitespace",
    );
    expect(parseOptionalFilterToken("x".repeat(129), "lease_owner", 128).error).toBe(
      "lease_owner must be at most 128 characters",
    );
    expect(parseRequiredToken("x".repeat(129), "target_agent_id", 128).error).toBe(
      "target_agent_id must be at most 128 characters",
    );
  });
});

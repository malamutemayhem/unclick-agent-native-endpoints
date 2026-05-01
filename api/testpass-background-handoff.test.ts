import {
  buildTestPassBackgroundFailureDispatchRow,
  DEFAULT_TESTPASS_BACKGROUND_HANDOFF_AGENT_ID,
  planTestPassBackgroundFailureHandoff,
  TESTPASS_BACKGROUND_HANDOFF_LEASE_SECONDS,
  testPassBackgroundFailureDispatchId,
} from "./lib/testpass-background-handoff";

describe("planTestPassBackgroundFailureHandoff", () => {
  const baseInput = {
    runId: "run-123",
    packSlug: "unclick-smoke",
    packName: "UnClick Smoke",
    profile: "standard" as const,
    target: { type: "url" as const, url: "https://unclick.world" },
    targetAgentId: DEFAULT_TESTPASS_BACKGROUND_HANDOFF_AGENT_ID,
    errorMessage: "database write failed",
  };

  it("creates ACK-required dispatch plans for background failures", () => {
    const plan = planTestPassBackgroundFailureHandoff(baseInput);

    expect(plan).toEqual({
      source: "testpass",
      targetAgentId: DEFAULT_TESTPASS_BACKGROUND_HANDOFF_AGENT_ID,
      taskRef: "testpass-run:run-123",
      leaseSeconds: TESTPASS_BACKGROUND_HANDOFF_LEASE_SECONDS,
      payload: {
        kind: "testpass_background_failure",
        run_id: "run-123",
        pack_slug: "unclick-smoke",
        pack_name: "UnClick Smoke",
        profile: "standard",
        target_url: "https://unclick.world",
        error_message: "database write failed",
        ack_required: true,
      },
    });
  });

  it("builds an already-leased dispatch row for reclaimable ACK tracking", () => {
    const plan = planTestPassBackgroundFailureHandoff(baseInput);
    expect(plan).not.toBeNull();

    const row = buildTestPassBackgroundFailureDispatchRow({
      apiKeyHash: "hash-123",
      dispatchId: "dispatch_123",
      plan: plan!,
      now: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(row).toMatchObject({
      api_key_hash: "hash-123",
      dispatch_id: "dispatch_123",
      source: "testpass",
      target_agent_id: DEFAULT_TESTPASS_BACKGROUND_HANDOFF_AGENT_ID,
      task_ref: "testpass-run:run-123",
      status: "leased",
      lease_owner: DEFAULT_TESTPASS_BACKGROUND_HANDOFF_AGENT_ID,
      lease_expires_at: "2026-05-01T00:10:00.000Z",
      created_at: "2026-05-01T00:00:00.000Z",
      updated_at: "2026-05-01T00:00:00.000Z",
    });
    expect(row.payload.ack_required).toBe(true);
  });

  it("uses stable dispatch ids so repeated catch paths do not duplicate work", () => {
    expect(testPassBackgroundFailureDispatchId("run-123")).toBe(
      testPassBackgroundFailureDispatchId("run-123"),
    );
    expect(testPassBackgroundFailureDispatchId("run-123")).toMatch(/^dispatch_[a-f0-9]{32}$/);
  });

  it("stays silent for normal accepted paths without an error", () => {
    expect(planTestPassBackgroundFailureHandoff({ ...baseInput, errorMessage: "" })).toBeNull();
    expect(planTestPassBackgroundFailureHandoff({ ...baseInput, targetAgentId: "" })).toBeNull();
  });

  it("keeps missed ACKs eligible for handoff_ack_missing reclaim signals", () => {
    const plan = planTestPassBackgroundFailureHandoff(baseInput);
    expect(plan).not.toBeNull();

    const row = buildTestPassBackgroundFailureDispatchRow({
      apiKeyHash: "hash-123",
      dispatchId: "dispatch_123",
      plan: plan!,
      now: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(row.status).toBe("leased");
    expect(row.lease_owner).toBe(DEFAULT_TESTPASS_BACKGROUND_HANDOFF_AGENT_ID);
    expect(row.lease_expires_at).toBe("2026-05-01T00:10:00.000Z");
    expect(row.payload.kind).toBe("testpass_background_failure");
    expect(row.payload.ack_required).toBe(true);
  });
});

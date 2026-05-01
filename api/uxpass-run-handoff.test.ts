import {
  buildUxPassRunFailureDispatchRow,
  DEFAULT_UXPASS_RUN_HANDOFF_AGENT_ID,
  planUxPassRunFailureHandoff,
  UXPASS_RUN_HANDOFF_LEASE_SECONDS,
  uxPassRunFailureDispatchId,
} from "./lib/uxpass-run-handoff";

describe("planUxPassRunFailureHandoff", () => {
  const baseInput = {
    runId: "ux-run-123",
    targetUrl: "https://unclick.world",
    targetAgentId: DEFAULT_UXPASS_RUN_HANDOFF_AGENT_ID,
    isScheduled: true,
    status: "failed",
    errorMessage: "capture assertion failed",
    taskId: "11111111-1111-4111-8111-111111111111",
  };

  it("creates ACK-required dispatch plans for scheduled UXPass failures", () => {
    const plan = planUxPassRunFailureHandoff(baseInput);

    expect(plan).toEqual({
      source: "uxpass",
      targetAgentId: DEFAULT_UXPASS_RUN_HANDOFF_AGENT_ID,
      taskRef: "uxpass-run:ux-run-123",
      leaseSeconds: UXPASS_RUN_HANDOFF_LEASE_SECONDS,
      payload: {
        kind: "uxpass_run_failure",
        run_id: "ux-run-123",
        target_url: "https://unclick.world",
        status: "failed",
        error_message: "capture assertion failed",
        task_id: "11111111-1111-4111-8111-111111111111",
        ack_required: true,
      },
    });
  });

  it("builds an already-leased row for missed-ACK reclaim", () => {
    const plan = planUxPassRunFailureHandoff(baseInput);
    expect(plan).not.toBeNull();

    const row = buildUxPassRunFailureDispatchRow({
      apiKeyHash: "hash-123",
      dispatchId: "dispatch_123",
      plan: plan!,
      now: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(row).toMatchObject({
      api_key_hash: "hash-123",
      dispatch_id: "dispatch_123",
      source: "uxpass",
      target_agent_id: DEFAULT_UXPASS_RUN_HANDOFF_AGENT_ID,
      task_ref: "uxpass-run:ux-run-123",
      status: "leased",
      lease_owner: DEFAULT_UXPASS_RUN_HANDOFF_AGENT_ID,
      lease_expires_at: "2026-05-01T00:10:00.000Z",
      created_at: "2026-05-01T00:00:00.000Z",
      updated_at: "2026-05-01T00:00:00.000Z",
    });
    expect(row.payload.ack_required).toBe(true);
  });

  it("uses stable dispatch ids so repeated failure paths do not duplicate work", () => {
    expect(uxPassRunFailureDispatchId("ux-run-123")).toBe(
      uxPassRunFailureDispatchId("ux-run-123"),
    );
    expect(uxPassRunFailureDispatchId("ux-run-123")).toMatch(/^dispatch_[a-f0-9]{32}$/);
  });

  it("stays silent for quiet, manual, or unowned paths", () => {
    expect(planUxPassRunFailureHandoff({ ...baseInput, status: "complete", errorMessage: "" }))
      .toBeNull();
    expect(planUxPassRunFailureHandoff({ ...baseInput, isScheduled: false })).toBeNull();
    expect(planUxPassRunFailureHandoff({ ...baseInput, targetAgentId: "" })).toBeNull();
  });

  it("keeps runner exceptions eligible for the same ACK path", () => {
    const plan = planUxPassRunFailureHandoff({
      ...baseInput,
      status: "running",
      errorMessage: "runner crashed after capture",
      taskId: null,
    });

    expect(plan).not.toBeNull();
    expect(plan?.payload).toMatchObject({
      kind: "uxpass_run_failure",
      status: "failed",
      error_message: "runner crashed after capture",
      task_id: null,
      ack_required: true,
    });
  });
});

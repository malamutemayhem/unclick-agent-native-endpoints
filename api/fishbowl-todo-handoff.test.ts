import { describe, expect, it } from "vitest";
import {
  buildFishbowlTodoHandoffDispatchRow,
  buildFishbowlTodoClaimLease,
  buildFishbowlTodoRefreshLease,
  buildFishbowlTodoReleaseLease,
  FISHBOWL_TODO_HANDOFF_LEASE_SECONDS,
  planFishbowlTodoHandoff,
} from "./lib/fishbowl-todo-handoff";
import { createReclaimSignal } from "../packages/mcp-server/src/reliability";

const baseInput = {
  todoId: "todo-abc",
  title: "Wire WakePass ACK rule",
  priority: "high",
  createdByAgentId: "agent_creator",
};

describe("planFishbowlTodoHandoff", () => {
  it("produces an ACK-required dispatch with a 600s lease when assignee differs from creator", () => {
    const plan = planFishbowlTodoHandoff({ ...baseInput, assignedToAgentId: "agent_owner" });
    expect(plan).toMatchObject({
      source: "fishbowl",
      targetAgentId: "agent_owner",
      taskRef: "todo-abc",
      leaseSeconds: 600,
      payload: {
        kind: "todo_assignment",
        todo_id: "todo-abc",
        title: "Wire WakePass ACK rule",
        priority: "high",
        created_by_agent_id: "agent_creator",
        ack_required: true,
      },
    });
    expect(plan?.leaseSeconds).toBe(FISHBOWL_TODO_HANDOFF_LEASE_SECONDS);
  });

  it("builds an already-leased dispatch row for reclaimable ACK tracking", () => {
    const plan = planFishbowlTodoHandoff({ ...baseInput, assignedToAgentId: "agent_owner" })!;
    const row = buildFishbowlTodoHandoffDispatchRow({
      apiKeyHash: "hash_123",
      dispatchId: "dispatch_123",
      plan,
      now: new Date("2026-05-01T02:00:00.000Z"),
    });

    expect(row).toMatchObject({
      api_key_hash: "hash_123",
      dispatch_id: "dispatch_123",
      source: "fishbowl",
      target_agent_id: "agent_owner",
      task_ref: "todo-abc",
      status: "leased",
      lease_owner: "agent_owner",
      lease_expires_at: "2026-05-01T02:10:00.000Z",
      created_at: "2026-05-01T02:00:00.000Z",
      updated_at: "2026-05-01T02:00:00.000Z",
    });
    expect(row.payload.ack_required).toBe(true);
  });

  it("dispatch payload triggers handoff_ack_missing on stale reclaim", () => {
    const plan = planFishbowlTodoHandoff({ ...baseInput, assignedToAgentId: "agent_owner" })!;
    const signal = createReclaimSignal(
      { dispatchId: "x", source: plan.source, targetAgentId: plan.targetAgentId, taskRef: plan.taskRef, payload: plan.payload },
      900,
    );
    expect(signal.action).toBe("handoff_ack_missing");
  });

  it("returns null for silent paths (no/empty assignee or self-assignment)", () => {
    expect(planFishbowlTodoHandoff({ ...baseInput, assignedToAgentId: null })).toBeNull();
    expect(planFishbowlTodoHandoff({ ...baseInput, assignedToAgentId: undefined })).toBeNull();
    expect(planFishbowlTodoHandoff({ ...baseInput, assignedToAgentId: "" })).toBeNull();
    expect(planFishbowlTodoHandoff({ ...baseInput, assignedToAgentId: "   " })).toBeNull();
    expect(
      planFishbowlTodoHandoff({ ...baseInput, assignedToAgentId: baseInput.createdByAgentId }),
    ).toBeNull();
  });
});

describe("Fishbowl todo claim leases", () => {
  const now = new Date("2026-05-09T19:30:00.000Z");
  const openTodo = {
    id: "todo-lease-1",
    status: "open",
    assigned_to_agent_id: null,
    lease_token: null,
    lease_expires_at: null,
    reclaim_count: 0,
  };

  it("builds a claim mutation for an open unassigned todo", () => {
    const result = buildFishbowlTodoClaimLease({
      todo: openTodo,
      agentId: "runner-1",
      leaseToken: "lease-1",
      now,
      leaseSeconds: 300,
    });

    expect(result).toMatchObject({
      ok: true,
      todo_id: "todo-lease-1",
      action: "claim",
      expected_lease_token: null,
      update: {
        status: "in_progress",
        assigned_to_agent_id: "runner-1",
        lease_token: "lease-1",
        lease_expires_at: "2026-05-09T19:35:00.000Z",
        reclaim_count: 0,
        updated_at: "2026-05-09T19:30:00.000Z",
      },
    });
  });

  it("blocks stale claims when another active lease token owns the todo", () => {
    const result = buildFishbowlTodoClaimLease({
      todo: {
        ...openTodo,
        lease_token: "fresh-lease",
        lease_expires_at: "2026-05-09T19:31:00.000Z",
      },
      agentId: "runner-2",
      leaseToken: "stale-lease",
      now,
      leaseSeconds: 300,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "active_lease_token_mismatch",
      lease_token: "fresh-lease",
    });
  });

  it("allows reclaiming an expired open lease and increments reclaim count", () => {
    const result = buildFishbowlTodoClaimLease({
      todo: {
        ...openTodo,
        lease_token: "old-lease",
        lease_expires_at: "2026-05-09T19:29:59.000Z",
        reclaim_count: 2,
      },
      agentId: "runner-2",
      leaseToken: "new-lease",
      now,
      leaseSeconds: 60,
    });

    expect(result).toMatchObject({
      ok: true,
      expected_lease_token: "old-lease",
      update: {
        lease_token: "new-lease",
        lease_expires_at: "2026-05-09T19:31:00.000Z",
        reclaim_count: 3,
      },
    });
  });

  it("refreshes and releases only with the matching lease token", () => {
    const claimed = {
      ...openTodo,
      status: "in_progress",
      assigned_to_agent_id: "runner-1",
      lease_token: "lease-1",
      lease_expires_at: "2026-05-09T19:31:00.000Z",
    };

    expect(
      buildFishbowlTodoRefreshLease({
        todo: claimed,
        agentId: "runner-1",
        leaseToken: "wrong",
        now,
        leaseSeconds: 60,
      }),
    ).toMatchObject({ ok: false, reason: "lease_token_mismatch" });

    expect(
      buildFishbowlTodoRefreshLease({
        todo: claimed,
        agentId: "runner-1",
        leaseToken: "lease-1",
        now,
        leaseSeconds: 60,
      }),
    ).toMatchObject({
      ok: true,
      action: "refresh",
      update: {
        lease_expires_at: "2026-05-09T19:31:00.000Z",
      },
    });

    expect(
      buildFishbowlTodoReleaseLease({
        todo: claimed,
        agentId: "runner-1",
        leaseToken: "lease-1",
        now,
      }),
    ).toMatchObject({
      ok: true,
      action: "release",
      update: {
        status: "open",
        assigned_to_agent_id: null,
        lease_token: null,
        lease_expires_at: null,
      },
    });
  });
});

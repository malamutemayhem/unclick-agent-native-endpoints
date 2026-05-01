import { describe, expect, it } from "vitest";
import {
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

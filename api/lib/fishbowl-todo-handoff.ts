// Universal ACK Handoff planner for Fishbowl todo assignment.
//
// An action-needed handoff (todo assigned to a different worker than its
// creator) becomes a reliability dispatch with ack_required=true and a
// 600-second lease so a missed ACK surfaces via the WakePass reclaim path.
// Non-action paths (no assignee, self-assignment) stay silent.

export const FISHBOWL_TODO_HANDOFF_LEASE_SECONDS = 600;

export interface FishbowlTodoHandoffInput {
  todoId: string;
  title: string;
  priority: string;
  assignedToAgentId: string | null | undefined;
  createdByAgentId: string;
}

export interface FishbowlTodoHandoffPlan {
  source: "fishbowl";
  targetAgentId: string;
  taskRef: string;
  payload: {
    kind: "todo_assignment";
    todo_id: string;
    title: string;
    priority: string;
    created_by_agent_id: string;
    ack_required: true;
  };
  leaseSeconds: number;
}

export function planFishbowlTodoHandoff(
  input: FishbowlTodoHandoffInput,
): FishbowlTodoHandoffPlan | null {
  const assignee = (input.assignedToAgentId ?? "").trim();
  if (!assignee) return null;
  if (assignee === input.createdByAgentId) return null;

  return {
    source: "fishbowl",
    targetAgentId: assignee,
    taskRef: input.todoId,
    payload: {
      kind: "todo_assignment",
      todo_id: input.todoId,
      title: input.title,
      priority: input.priority,
      created_by_agent_id: input.createdByAgentId,
      ack_required: true,
    },
    leaseSeconds: FISHBOWL_TODO_HANDOFF_LEASE_SECONDS,
  };
}

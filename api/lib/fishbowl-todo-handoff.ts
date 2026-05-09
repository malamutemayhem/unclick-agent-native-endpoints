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

export interface FishbowlTodoHandoffDispatchRow {
  api_key_hash: string;
  dispatch_id: string;
  source: "fishbowl";
  target_agent_id: string;
  task_ref: string;
  status: "leased";
  lease_owner: string;
  lease_expires_at: string;
  payload: FishbowlTodoHandoffPlan["payload"];
  created_at: string;
  updated_at: string;
}

export interface FishbowlTodoLeaseState {
  id: string;
  status: "open" | "in_progress" | "done" | "dropped" | string;
  assigned_to_agent_id?: string | null;
  lease_token?: string | null;
  lease_expires_at?: string | null;
  reclaim_count?: number | null;
}

export interface FishbowlTodoLeaseUpdate {
  status?: "open" | "in_progress";
  assigned_to_agent_id?: string | null;
  lease_token?: string | null;
  lease_expires_at?: string | null;
  reclaim_count?: number;
  updated_at: string;
}

export interface FishbowlTodoLeaseMutation {
  ok: true;
  todo_id: string;
  action: "claim" | "refresh" | "release";
  expected_lease_token: string | null;
  update: FishbowlTodoLeaseUpdate;
}

export interface FishbowlTodoLeaseBlocked {
  ok: false;
  reason:
    | "missing_todo"
    | "missing_agent_id"
    | "missing_lease_token"
    | "todo_not_open"
    | "todo_already_assigned"
    | "active_lease_token_mismatch"
    | "lease_token_mismatch"
    | "lease_expired";
  todo_id?: string;
  assigned_to_agent_id?: string | null;
  lease_token?: string | null;
  lease_expires_at?: string | null;
}

export type FishbowlTodoLeaseResult =
  | FishbowlTodoLeaseMutation
  | FishbowlTodoLeaseBlocked;

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

export function buildFishbowlTodoHandoffDispatchRow(params: {
  apiKeyHash: string;
  dispatchId: string;
  plan: FishbowlTodoHandoffPlan;
  now: Date;
}): FishbowlTodoHandoffDispatchRow {
  const nowIso = params.now.toISOString();
  return {
    api_key_hash: params.apiKeyHash,
    dispatch_id: params.dispatchId,
    source: params.plan.source,
    target_agent_id: params.plan.targetAgentId,
    task_ref: params.plan.taskRef,
    status: "leased",
    lease_owner: params.plan.targetAgentId,
    lease_expires_at: new Date(
      params.now.getTime() + params.plan.leaseSeconds * 1000,
    ).toISOString(),
    payload: params.plan.payload,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

export function buildFishbowlTodoClaimLease(params: {
  todo: FishbowlTodoLeaseState | null | undefined;
  agentId: string;
  leaseToken: string;
  now: Date;
  leaseSeconds: number;
}): FishbowlTodoLeaseResult {
  const precheck = validateLeaseInput(params);
  if (!precheck.ok) return precheck;

  const todo = params.todo!;
  const currentToken = normalizeLeaseToken(todo.lease_token);
  const requestedToken = normalizeLeaseToken(params.leaseToken);
  const assignee = normalizeAgentId(todo.assigned_to_agent_id);
  const nowMs = params.now.getTime();

  if (todo.status !== "open") {
    return blockLease("todo_not_open", todo);
  }

  if (assignee && currentToken !== requestedToken) {
    return blockLease("todo_already_assigned", todo);
  }

  if (
    currentToken &&
    currentToken !== requestedToken &&
    !leaseIsExpired(todo.lease_expires_at, nowMs)
  ) {
    return blockLease("active_lease_token_mismatch", todo);
  }

  return {
    ok: true,
    todo_id: todo.id,
    action: "claim",
    expected_lease_token: currentToken || null,
    update: {
      status: "in_progress",
      assigned_to_agent_id: normalizeAgentId(params.agentId),
      lease_token: requestedToken,
      lease_expires_at: addLeaseSeconds(params.now, params.leaseSeconds),
      reclaim_count: leaseIsExpired(todo.lease_expires_at, nowMs)
        ? Number(todo.reclaim_count || 0) + 1
        : Number(todo.reclaim_count || 0),
      updated_at: params.now.toISOString(),
    },
  };
}

export function buildFishbowlTodoRefreshLease(params: {
  todo: FishbowlTodoLeaseState | null | undefined;
  agentId: string;
  leaseToken: string;
  now: Date;
  leaseSeconds: number;
}): FishbowlTodoLeaseResult {
  const precheck = validateLeaseInput(params);
  if (!precheck.ok) return precheck;

  const todo = params.todo!;
  const currentToken = normalizeLeaseToken(todo.lease_token);
  const requestedToken = normalizeLeaseToken(params.leaseToken);

  if (currentToken !== requestedToken) {
    return blockLease("lease_token_mismatch", todo);
  }

  if (leaseIsExpired(todo.lease_expires_at, params.now.getTime())) {
    return blockLease("lease_expired", todo);
  }

  return {
    ok: true,
    todo_id: todo.id,
    action: "refresh",
    expected_lease_token: requestedToken,
    update: {
      lease_token: requestedToken,
      lease_expires_at: addLeaseSeconds(params.now, params.leaseSeconds),
      updated_at: params.now.toISOString(),
    },
  };
}

export function buildFishbowlTodoReleaseLease(params: {
  todo: FishbowlTodoLeaseState | null | undefined;
  agentId: string;
  leaseToken: string;
  now: Date;
}): FishbowlTodoLeaseResult {
  const precheck = validateLeaseInput({ ...params, leaseSeconds: 1 });
  if (!precheck.ok) return precheck;

  const todo = params.todo!;
  const currentToken = normalizeLeaseToken(todo.lease_token);
  const requestedToken = normalizeLeaseToken(params.leaseToken);

  if (currentToken !== requestedToken) {
    return blockLease("lease_token_mismatch", todo);
  }

  return {
    ok: true,
    todo_id: todo.id,
    action: "release",
    expected_lease_token: requestedToken,
    update: {
      status: "open",
      assigned_to_agent_id: null,
      lease_token: null,
      lease_expires_at: null,
      updated_at: params.now.toISOString(),
    },
  };
}

function validateLeaseInput(params: {
  todo: FishbowlTodoLeaseState | null | undefined;
  agentId: string;
  leaseToken: string;
}): FishbowlTodoLeaseBlocked | { ok: true } {
  if (!params.todo) {
    return { ok: false, reason: "missing_todo" };
  }

  if (!normalizeAgentId(params.agentId)) {
    return blockLease("missing_agent_id", params.todo);
  }

  if (!normalizeLeaseToken(params.leaseToken)) {
    return blockLease("missing_lease_token", params.todo);
  }

  return { ok: true };
}

function blockLease(
  reason: FishbowlTodoLeaseBlocked["reason"],
  todo: FishbowlTodoLeaseState,
): FishbowlTodoLeaseBlocked {
  return {
    ok: false,
    reason,
    todo_id: todo.id,
    assigned_to_agent_id: todo.assigned_to_agent_id ?? null,
    lease_token: todo.lease_token ?? null,
    lease_expires_at: todo.lease_expires_at ?? null,
  };
}

function normalizeAgentId(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function normalizeLeaseToken(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function addLeaseSeconds(now: Date, leaseSeconds: number): string {
  const seconds = Number.isFinite(leaseSeconds) ? Math.max(1, leaseSeconds) : 600;
  return new Date(now.getTime() + seconds * 1000).toISOString();
}

function leaseIsExpired(value: string | null | undefined, nowMs: number): boolean {
  const ms = Date.parse(String(value ?? ""));
  return Number.isFinite(ms) && ms <= nowMs;
}

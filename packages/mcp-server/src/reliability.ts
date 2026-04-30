import { createHash } from "node:crypto";

export type DispatchSource =
  | "fishbowl"
  | "connectors"
  | "wakepass"
  | "testpass"
  | "uxpass"
  | "flowpass"
  | "securitypass"
  | "manual";

export type DispatchStatus =
  | "queued"
  | "leased"
  | "completed"
  | "failed"
  | "stale"
  | "cancelled";

export type HeartbeatState =
  | "idle"
  | "received"
  | "accepted"
  | "working"
  | "blocked"
  | "completed";

export interface AgentDispatch {
  apiKeyHash: string;
  dispatchId: string;
  source: DispatchSource;
  targetAgentId: string;
  taskRef?: string;
  status: DispatchStatus;
  leaseOwner?: string;
  leaseExpiresAt?: string;
  lastRealActionAt?: string;
  createdAt: string;
  updatedAt: string;
  payload?: Record<string, unknown>;
}

export interface AgentHeartbeat {
  apiKeyHash: string;
  agentId: string;
  dispatchId?: string;
  state: HeartbeatState;
  currentTask?: string;
  nextAction?: string;
  etaMinutes?: number;
  blocker?: string;
  lastRealActionAt?: string;
  createdAt: string;
}

export interface DispatchIdInput {
  source: DispatchSource;
  targetAgentId: string;
  taskRef?: string;
  promptHash?: string;
  timeBucket?: string;
  payload?: Record<string, unknown>;
}

export interface ReclaimSignalDescriptor {
  action: "stale_dispatch_reclaimed" | "handoff_ack_missing";
  summary: string;
  payload: Record<string, unknown>;
}

export interface StaleLeaseInput {
  status: DispatchStatus;
  leaseExpiresAt?: string | null;
  lastRealActionAt?: string | null;
}

export interface StaleLeaseDecision {
  isStale: boolean;
  reason: "not_leased" | "missing_lease_expiry" | "lease_active" | "lease_expired";
  staleSeconds: number;
}

export interface QueuedDispatchParams {
  apiKeyHash: string;
  source: DispatchSource;
  targetAgentId: string;
  taskRef?: string;
  promptHash?: string;
  timeBucket?: string;
  payload?: Record<string, unknown>;
  createdAt?: Date;
}

export interface OperatorTelemetry {
  dispatchId?: string;
  source?: DispatchSource;
  targetAgentId?: string;
  status?: DispatchStatus;
  leaseOwner?: string;
  leaseExpiresAt?: string;
  updatedAt?: string;
  agentId?: string;
  heartbeatState?: HeartbeatState;
  currentTask?: string;
  nextAction?: string;
  etaMinutes?: number;
  blocker?: string;
  lastRealActionAt?: string;
  stale?: boolean;
  staleReason?: StaleLeaseDecision["reason"];
  staleSeconds?: number;
}

export function createDispatchId(input: DispatchIdInput): string {
  const hash = createHash("sha256")
    .update(stableStringify(input))
    .digest("hex")
    .slice(0, 32);

  return `dispatch_${hash}`;
}

export function createQueuedDispatch(params: QueuedDispatchParams): AgentDispatch {
  const createdAt = (params.createdAt ?? new Date()).toISOString();
  const idInput: DispatchIdInput = {
    source: params.source,
    targetAgentId: params.targetAgentId,
  };

  if (params.taskRef) idInput.taskRef = params.taskRef;
  if (params.promptHash) idInput.promptHash = params.promptHash;
  if (params.timeBucket) idInput.timeBucket = params.timeBucket;
  if (params.payload) idInput.payload = params.payload;

  const dispatch: AgentDispatch = {
    apiKeyHash: params.apiKeyHash,
    dispatchId: createDispatchId(idInput),
    source: params.source,
    targetAgentId: params.targetAgentId,
    status: "queued",
    createdAt,
    updatedAt: createdAt,
  };

  if (params.taskRef) dispatch.taskRef = params.taskRef;
  if (params.payload) dispatch.payload = params.payload;

  return dispatch;
}

export function createTimeBucket(date: Date, bucketSeconds = 5): string {
  if (!Number.isFinite(bucketSeconds) || bucketSeconds <= 0) {
    throw new Error("bucketSeconds must be a positive number");
  }

  const bucketMs = bucketSeconds * 1000;
  const bucketStart = Math.floor(date.getTime() / bucketMs) * bucketMs;
  return new Date(bucketStart).toISOString();
}

export function decideStaleLease(
  input: StaleLeaseInput,
  now = new Date(),
): StaleLeaseDecision {
  if (input.status !== "leased") {
    return { isStale: false, reason: "not_leased", staleSeconds: 0 };
  }

  if (!input.leaseExpiresAt) {
    return { isStale: false, reason: "missing_lease_expiry", staleSeconds: 0 };
  }

  const leaseExpiresAtMs = Date.parse(input.leaseExpiresAt);
  if (Number.isNaN(leaseExpiresAtMs)) {
    return { isStale: false, reason: "missing_lease_expiry", staleSeconds: 0 };
  }

  const staleMs = now.getTime() - leaseExpiresAtMs;
  if (staleMs <= 0) {
    return { isStale: false, reason: "lease_active", staleSeconds: 0 };
  }

  return {
    isStale: true,
    reason: "lease_expired",
    staleSeconds: Math.floor(staleMs / 1000),
  };
}

export function createHeartbeat(params: {
  apiKeyHash: string;
  agentId: string;
  state: HeartbeatState;
  createdAt?: Date;
  dispatchId?: string;
  currentTask?: string;
  nextAction?: string;
  etaMinutes?: number;
  blocker?: string;
  lastRealActionAt?: Date;
}): AgentHeartbeat {
  const heartbeat: AgentHeartbeat = {
    apiKeyHash: params.apiKeyHash,
    agentId: params.agentId,
    state: params.state,
    createdAt: (params.createdAt ?? new Date()).toISOString(),
  };

  if (params.dispatchId) heartbeat.dispatchId = params.dispatchId;
  if (params.currentTask) heartbeat.currentTask = params.currentTask;
  if (params.nextAction) heartbeat.nextAction = params.nextAction;
  if (typeof params.etaMinutes === "number") heartbeat.etaMinutes = params.etaMinutes;
  if (params.blocker) heartbeat.blocker = params.blocker;
  if (params.lastRealActionAt) {
    heartbeat.lastRealActionAt = params.lastRealActionAt.toISOString();
  }

  return heartbeat;
}

export function createOperatorTelemetry(input: {
  dispatch?: AgentDispatch;
  heartbeat?: AgentHeartbeat;
  staleDecision?: StaleLeaseDecision;
}): OperatorTelemetry {
  const telemetry: OperatorTelemetry = {};

  if (input.dispatch) {
    telemetry.dispatchId = input.dispatch.dispatchId;
    telemetry.source = input.dispatch.source;
    telemetry.targetAgentId = input.dispatch.targetAgentId;
    telemetry.status = input.dispatch.status;
    telemetry.updatedAt = input.dispatch.updatedAt;
    if (input.dispatch.leaseOwner) telemetry.leaseOwner = input.dispatch.leaseOwner;
    if (input.dispatch.leaseExpiresAt) {
      telemetry.leaseExpiresAt = input.dispatch.leaseExpiresAt;
    }
    if (input.dispatch.lastRealActionAt) {
      telemetry.lastRealActionAt = input.dispatch.lastRealActionAt;
    }
  }

  if (input.heartbeat) {
    telemetry.dispatchId = input.heartbeat.dispatchId ?? telemetry.dispatchId;
    telemetry.agentId = input.heartbeat.agentId;
    telemetry.heartbeatState = input.heartbeat.state;
    telemetry.currentTask = input.heartbeat.currentTask;
    telemetry.nextAction = input.heartbeat.nextAction;
    telemetry.etaMinutes = input.heartbeat.etaMinutes;
    telemetry.blocker = input.heartbeat.blocker;
    telemetry.lastRealActionAt =
      input.heartbeat.lastRealActionAt ?? telemetry.lastRealActionAt;
  }

  if (input.staleDecision) {
    telemetry.stale = input.staleDecision.isStale;
    telemetry.staleReason = input.staleDecision.reason;
    telemetry.staleSeconds = input.staleDecision.staleSeconds;
  }

  return telemetry;
}

export function createReclaimSignal(
  dispatch: Pick<AgentDispatch, "dispatchId" | "source" | "targetAgentId" | "taskRef" | "payload">,
  staleSeconds: number,
): ReclaimSignalDescriptor {
  const payload = dispatch.payload ?? {};
  const hasAckFlag = (value: unknown): boolean => {
    if (value === true) return true;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      return normalized === "true" || normalized === "1" || normalized === "yes";
    }
    if (typeof value === "number") return value === 1;
    return false;
  };
  const expectsAck =
    hasAckFlag(payload.ack_required) ||
    hasAckFlag(payload.require_ack) ||
    typeof payload.handoff_message_id === "string" ||
    typeof payload.handoff_thread_id === "string";

  if (expectsAck) {
    return {
      action: "handoff_ack_missing",
      summary: `WakePass reliability miss: no ACK arrived before reclaim for ${dispatch.targetAgentId}`,
      payload: {
        dispatch_id: dispatch.dispatchId,
        source: dispatch.source,
        target_agent_id: dispatch.targetAgentId,
        task_ref: dispatch.taskRef ?? null,
        stale_seconds: staleSeconds,
        ...payload,
      },
    };
  }

  return {
    action: "stale_dispatch_reclaimed",
    summary: `Reclaimed stale ${dispatch.source} dispatch for ${dispatch.targetAgentId}`,
    payload: {
      dispatch_id: dispatch.dispatchId,
      source: dispatch.source,
      target_agent_id: dispatch.targetAgentId,
      task_ref: dispatch.taskRef ?? null,
      stale_seconds: staleSeconds,
      ...payload,
    },
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

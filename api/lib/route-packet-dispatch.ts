import {
  createDispatchId,
  type DispatchSource,
  type DispatchStatus,
} from "../../packages/mcp-server/src/reliability.js";
import {
  runRoutePacketConsumerDryRun,
  type RoutePacket,
  type RoutePacketDecision,
  type VisibleWorker,
} from "./route-packet-consumer.js";

export interface UnClickConnectDispatchRow {
  api_key_hash: string;
  dispatch_id: string;
  source: DispatchSource;
  target_agent_id: string;
  task_ref: string;
  status: DispatchStatus;
  lease_owner: string | null;
  lease_expires_at: string | null;
  last_real_action_at?: string | null;
  payload: {
    kind: "unclick_connect_route_packet";
    route_packet: RoutePacket;
    receipt: RoutePacketDecision;
    idempotency_key?: string;
  };
  created_at: string;
  updated_at: string;
}

export function buildUnClickConnectDispatchRow(params: {
  apiKeyHash: string;
  packet: RoutePacket;
  visibleWorkers?: VisibleWorker[];
  idempotencyKey?: string;
  now?: Date;
  leaseSeconds?: number;
}): UnClickConnectDispatchRow {
  if (!params.packet.experiment) {
    throw new Error("UnClick Connect commit is experiment-only");
  }

  const now = params.now ?? new Date();
  const leaseSeconds = clampLeaseSeconds(params.leaseSeconds);
  const decision = runRoutePacketConsumerDryRun({
    packet: params.packet,
    visibleWorkers: params.visibleWorkers,
    now,
  }).decision;
  const targetAgentId = decision.target_agent_id;
  const idempotencyKey = params.idempotencyKey ?? params.packet.idempotency_key;
  const dispatchId = createDispatchId({
    source: "connectors",
    targetAgentId,
    taskRef: params.packet.item.id,
    promptHash: idempotencyKey,
    payload: {
      kind: "unclick_connect_route_packet",
      lane: params.packet.lane,
      item_id: params.packet.item.id,
      created_at: params.packet.created_at,
      receipt: decision.receipt,
      reason: decision.reason,
    },
  });
  const nowIso = now.toISOString();

  return {
    api_key_hash: params.apiKeyHash,
    dispatch_id: dispatchId,
    source: "connectors",
    target_agent_id: targetAgentId,
    task_ref: params.packet.item.id,
    status: statusForDecision(decision),
    lease_owner: decision.status === "assigned" ? targetAgentId : null,
    lease_expires_at:
      decision.status === "assigned"
        ? new Date(now.getTime() + leaseSeconds * 1000).toISOString()
        : null,
    last_real_action_at: decision.status === "assigned" ? nowIso : null,
    payload: {
      kind: "unclick_connect_route_packet",
      route_packet: params.packet,
      receipt: decision,
      ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
    },
    created_at: nowIso,
    updated_at: nowIso,
  };
}

function statusForDecision(decision: RoutePacketDecision): DispatchStatus {
  if (decision.status === "assigned") return "leased";
  if (decision.status === "HOLD") return "stale";
  return "failed";
}

function clampLeaseSeconds(input: unknown): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed) || parsed <= 0) return 10 * 60;
  return Math.min(Math.max(Math.floor(parsed), 60), 24 * 60 * 60);
}

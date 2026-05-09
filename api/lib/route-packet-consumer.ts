export type RoutePacketLane =
  | "Builder"
  | "Proof"
  | "Reviewer"
  | "Safety"
  | "Coordinator"
  | "Watcher";

export interface RoutePacket {
  experiment: boolean;
  lane: RoutePacketLane;
  item: {
    id: string;
    title: string;
  };
  needed_action: string;
  visible_blocker?: string | null;
  expected_receipt: string[];
  created_at: string;
  ttl_seconds: number;
  idempotency_key?: string;
}

export interface VisibleWorker {
  id?: string;
  agent_id?: string;
  worker_id?: string;
  lane?: string;
  capabilities?: string[];
  status?: string;
  live?: boolean;
}

export type RoutePacketDecision =
  | {
      status: "assigned";
      receipt: "assigned";
      target_agent_id: string;
      reason: "live_worker_available";
    }
  | {
      status: "HOLD";
      receipt: "HOLD";
      target_agent_id: "coordinator";
      reason: "ttl_expired";
    }
  | {
      status: "BLOCKER";
      receipt: "BLOCKER";
      target_agent_id: "coordinator";
      reason: "no_live_builder_available" | "no_live_worker_available";
    };

export interface RoutePacketConsumerResult {
  dry_run: true;
  writes: [];
  packet: RoutePacket;
  decision: RoutePacketDecision;
}

const LIVE_WORKER_STATUSES = new Set(["active", "available", "idle", "working", "live"]);

export function normalizeRoutePacketLane(input: unknown): RoutePacketLane {
  const value = String(input ?? "").trim().toLowerCase();
  switch (value) {
    case "builder":
    case "build":
    case "forge":
      return "Builder";
    case "proof":
    case "prove":
      return "Proof";
    case "reviewer":
    case "review":
    case "tester":
    case "qc":
      return "Reviewer";
    case "safety":
    case "gatekeeper":
      return "Safety";
    case "coordinator":
    case "master":
      return "Coordinator";
    case "watcher":
    case "relay":
      return "Watcher";
    default:
      return "Builder";
  }
}

export function isRoutePacketExpired(packet: RoutePacket, now = new Date()): boolean {
  const createdAtMs = Date.parse(packet.created_at);
  if (!Number.isFinite(createdAtMs)) return false;
  return now.getTime() - createdAtMs > packet.ttl_seconds * 1000;
}

export function findLiveWorkerForLane(
  lane: RoutePacketLane,
  workers: VisibleWorker[],
): string | null {
  const wanted = lane.toLowerCase();
  for (const worker of workers) {
    const workerId = String(worker.agent_id ?? worker.worker_id ?? worker.id ?? "").trim();
    if (!workerId) continue;

    const status = String(worker.status ?? "").trim().toLowerCase();
    const isLive = worker.live === true || LIVE_WORKER_STATUSES.has(status);
    if (!isLive) continue;

    const workerLane = String(worker.lane ?? "").trim().toLowerCase();
    const capabilities = Array.isArray(worker.capabilities)
      ? worker.capabilities.map((capability) => String(capability).trim().toLowerCase())
      : [];
    if (workerLane === wanted || capabilities.includes(wanted)) {
      return workerId;
    }
  }
  return null;
}

export function runRoutePacketConsumerDryRun(params: {
  packet: RoutePacket;
  visibleWorkers?: VisibleWorker[];
  now?: Date;
}): RoutePacketConsumerResult {
  const { packet } = params;
  if (isRoutePacketExpired(packet, params.now)) {
    return {
      dry_run: true,
      writes: [],
      packet,
      decision: {
        status: "HOLD",
        receipt: "HOLD",
        target_agent_id: "coordinator",
        reason: "ttl_expired",
      },
    };
  }

  const targetAgentId = findLiveWorkerForLane(packet.lane, params.visibleWorkers ?? []);
  if (targetAgentId) {
    return {
      dry_run: true,
      writes: [],
      packet,
      decision: {
        status: "assigned",
        receipt: "assigned",
        target_agent_id: targetAgentId,
        reason: "live_worker_available",
      },
    };
  }

  return {
    dry_run: true,
    writes: [],
    packet,
    decision: {
      status: "BLOCKER",
      receipt: "BLOCKER",
      target_agent_id: "coordinator",
      reason: packet.lane === "Builder" ? "no_live_builder_available" : "no_live_worker_available",
    },
  };
}

import {
  normalizeRoutePacketLane,
  type RoutePacket,
  type RoutePacketLane,
} from "./route-packet-consumer.js";

export interface TetherRouteIntent {
  item_id?: string;
  item_title?: string;
  lane?: string;
  needed_action?: string;
  visible_blocker?: string | null;
  expected_receipt?: string[] | string;
  ttl_seconds?: number;
  idempotency_key?: string;
  experiment?: boolean;
}

export function buildTetherRoutePacket(
  intent: TetherRouteIntent,
  now = new Date(),
): RoutePacket {
  const lane: RoutePacketLane = normalizeRoutePacketLane(intent.lane);
  const itemId = String(intent.item_id ?? "unclick-connect-experiment").trim();
  const title = String(intent.item_title ?? "UnClick Connect experiment").trim();
  const neededAction = String(
    intent.needed_action ?? "Move one live item to the next useful receipt.",
  ).trim();
  const expectedReceipt = normalizeExpectedReceipt(intent.expected_receipt);

  return {
    experiment: intent.experiment !== false,
    lane,
    item: {
      id: itemId || "unclick-connect-experiment",
      title: title || "UnClick Connect experiment",
    },
    needed_action: neededAction || "Move one live item to the next useful receipt.",
    visible_blocker:
      typeof intent.visible_blocker === "string" && intent.visible_blocker.trim()
        ? intent.visible_blocker.trim()
        : null,
    expected_receipt: expectedReceipt.length > 0 ? expectedReceipt : ["proof", "HOLD", "BLOCKER"],
    created_at: now.toISOString(),
    ttl_seconds: clampTtlSeconds(intent.ttl_seconds),
    idempotency_key:
      typeof intent.idempotency_key === "string" && intent.idempotency_key.trim()
        ? intent.idempotency_key.trim()
        : undefined,
  };
}

function normalizeExpectedReceipt(input: TetherRouteIntent["expected_receipt"]): string[] {
  if (Array.isArray(input)) {
    return input.map((value) => String(value).trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(/[,\|]/)
      .map((value) => value.trim())
      .filter(Boolean);
  }
  return [];
}

function clampTtlSeconds(input: unknown): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20 * 60;
  return Math.min(Math.max(Math.floor(parsed), 60), 24 * 60 * 60);
}

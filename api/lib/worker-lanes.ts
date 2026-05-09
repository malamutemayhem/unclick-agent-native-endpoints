export const WORKER_LANE_ENFORCE_MODES = ["warn", "enforce"] as const;

export type WorkerLaneEnforceMode = (typeof WORKER_LANE_ENFORCE_MODES)[number];
export type LaneClaimDecision = "allow" | "warn" | "reject";

export interface WorkerLaneInput {
  apiKeyHash: string;
  agentId: string;
  role: string;
  scopeAllowlist?: unknown;
  scopeDenylist?: unknown;
  enforceMode?: string | null;
}

export interface WorkerLaneRow {
  api_key_hash: string;
  agent_id: string;
  role: string;
  scope_allowlist: string[];
  scope_denylist: string[];
  enforce_mode: WorkerLaneEnforceMode;
}

export interface LaneClaimEvaluation {
  decision: LaneClaimDecision;
  reason: string;
  matched_token?: string;
}

const MAX_TOKEN_LENGTH = 80;

function compact(value: unknown, max = MAX_TOKEN_LENGTH): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function normalizeToken(value: unknown): string {
  return compact(value)
    .toLowerCase()
    .replace(/[^a-z0-9:_/-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeScopeTokens(value: unknown): string[] {
  const rawValues = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[, ]+/) : [];
  return Array.from(
    new Set(
      rawValues
        .map((item) => normalizeToken(item))
        .filter((item) => item.length > 0),
    ),
  );
}

export function normalizeWorkerLane(input: WorkerLaneInput): WorkerLaneRow {
  const apiKeyHash = compact(input.apiKeyHash, 128);
  const agentId = compact(input.agentId, 160);
  const role = normalizeToken(input.role || "general");
  const enforceMode = WORKER_LANE_ENFORCE_MODES.includes(input.enforceMode as WorkerLaneEnforceMode)
    ? (input.enforceMode as WorkerLaneEnforceMode)
    : "warn";

  if (!apiKeyHash) throw new Error("api_key_hash required");
  if (!agentId) throw new Error("agent_id required");
  if (!role) throw new Error("role required");

  return {
    api_key_hash: apiKeyHash,
    agent_id: agentId,
    role,
    scope_allowlist: normalizeScopeTokens(input.scopeAllowlist),
    scope_denylist: normalizeScopeTokens(input.scopeDenylist),
    enforce_mode: enforceMode,
  };
}

export function evaluateLaneClaim(lane: WorkerLaneRow | null, todoTokens: unknown[]): LaneClaimEvaluation {
  if (!lane) return { decision: "allow", reason: "unregistered_lane_legacy_allow" };

  const tokens = normalizeScopeTokens(todoTokens);
  const denied = tokens.find((token) => lane.scope_denylist.includes(token));
  if (denied) {
    return {
      decision: lane.enforce_mode === "enforce" ? "reject" : "warn",
      reason: "scope_denylist_match",
      matched_token: denied,
    };
  }

  if (lane.scope_allowlist.length === 0) {
    return { decision: "allow", reason: "empty_allowlist_allows" };
  }

  const allowed = tokens.find((token) => lane.scope_allowlist.includes(token));
  if (allowed) {
    return { decision: "allow", reason: "scope_allowlist_match", matched_token: allowed };
  }

  return {
    decision: lane.enforce_mode === "enforce" ? "reject" : "warn",
    reason: "scope_allowlist_miss",
  };
}


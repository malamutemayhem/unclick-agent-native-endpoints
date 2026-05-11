// IgniteOnlyAPI is the PinballWake green ignite lane.
// It turns verified NudgeOnly receipt requests into narrow worker wake packets.

import { createHash } from "node:crypto";

const PAINPOINT_TYPES = [
  "stale_ack",
  "duplicate_wake",
  "unclear_owner",
  "noisy_thread",
  "missing_proof",
  "dormant_worker",
  "none",
] as const;

const BRIDGE_ACTION_STATUSES = ["receipt_request", "escalation_request"] as const;

const TRUSTED_VERIFIER_STATUSES = [
  "passed",
  "verified",
  "confirmed",
  "wakepass_pass",
  "proof_checked",
  "ack_checked",
] as const;

const WORKER_ROUTES = [
  {
    painpoint_type: "stale_ack",
    worker: "Reviewer",
    wake_reason: "A stale ACK needs a review receipt, blocker receipt, or WakePass escalation.",
  },
  {
    painpoint_type: "duplicate_wake",
    worker: "Job Manager",
    wake_reason: "Duplicate wakes need consolidation or a clear reason to keep both.",
  },
  {
    painpoint_type: "unclear_owner",
    worker: "Job Manager",
    wake_reason: "A visible blocker needs an owning job and next expected receipt.",
  },
  {
    painpoint_type: "missing_proof",
    worker: "Builder",
    wake_reason: "A claimed or expected build step needs a commit, PR, run ID, receipt, or blocker.",
  },
  {
    painpoint_type: "noisy_thread",
    worker: "Heartbeat Seat",
    wake_reason: "Repeated pulse noise needs a compact material state receipt.",
  },
  {
    painpoint_type: "dormant_worker",
    worker: "Job Manager",
    wake_reason: "A dormant worker lane needs a safe owner check before a specialist is woken.",
  },
] as const;

const QUALITY_GATES = [
  "Require source evidence before creating a wake packet.",
  "Require a deterministic verifier, trusted bridge, or explicit verified flag before action.",
  "Prefer no wake over waking the wrong worker.",
  "Only route to a known worker lane.",
  "Emit public compact fields only. Never include secrets, private credentials, or raw hidden context.",
  "Every wake packet must include an ignite_id, source pointer, target, worker, painpoint, and receipt line.",
] as const;

const PROHIBITED_ACTIONS = [
  "merge PRs",
  "close blockers",
  "mark work complete",
  "edit code",
  "approve changes",
  "override safety gates",
  "decide subjective ownership",
  "invent workers",
  "create work from weak evidence",
  "print secrets",
] as const;

export const IGNITEONLY_POLICY = {
  official_name: "IgniteOnlyAPI",
  worker_name: "IgniteOnly💥",
  code_name: "IgniteOnly",
  ecosystem: "PinballWake",
  lane: "green_ignite",
  authority: "ignite_only_wake_request_no_build_no_merge",
  rollout_status: "official",
  sibling_lanes: {
    red_nudge: "NudgeOnlyAPI spots painpoints and emits receipt requests.",
    green_ignite: "IgniteOnlyAPI turns verified receipt requests into worker wake packets.",
  },
  route_shape: "verified bridge -> worker -> target -> painpoint -> expected receipt -> verifier",
  worker_routes: WORKER_ROUTES,
  quality_gates: QUALITY_GATES,
  allowed_actions: [
    "emit verified worker wake packet",
    "emit verified escalation wake packet",
    "route only to a known worker lane",
    "return blocked_verification_required when evidence is weak",
    "redact public packet fields",
  ],
  prohibited_actions: PROHIBITED_ACTIONS,
  verifier_rule: "IgniteOnly can request a wake only after deterministic evidence or a trusted bridge is present. Trusted lanes still do the work and proof.",
} as const;

function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asOptionalString(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "passed", "verified", "confirmed"].includes(normalized)) return true;
    if (["false", "no", "none", "unknown", ""].includes(normalized)) return false;
  }
  return Boolean(value);
}

function normalisePainpointType(value: unknown): string {
  const raw = String(value ?? "none").trim().toLowerCase();
  return PAINPOINT_TYPES.find((type) => raw.includes(type)) ?? "none";
}

function normaliseBridgeStatus(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase();
  if (BRIDGE_ACTION_STATUSES.includes(raw as typeof BRIDGE_ACTION_STATUSES[number])) return raw;
  if (["quiet", "advisory_only", "blocked_verification_required"].includes(raw)) return raw;
  return "quiet";
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function safeText(value: unknown): string | null {
  const text = asOptionalString(value);
  if (!text) return null;
  return text
    .replace(/Authorization\s*[:=]\s*Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Authorization: Bearer <redacted>")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer <redacted>")
    .replace(/([?&](?:api[_-]?key|key|access_token|refresh_token|client_secret|token|secret|password)=)[^&#\s]+/gi, "$1<redacted>")
    .replace(/\b(api[_-]?key|key|access_token|refresh_token|client_secret|token|secret|password)\b\s*[:=]\s*[^,\s&]+/gi, "$1=<redacted>")
    .slice(0, 500);
}

function verifierPassed(args: Record<string, unknown>, bridge: Record<string, unknown>): boolean {
  if (asBoolean(args.verified ?? bridge.verified)) return true;
  const status = String(args.verifier_status ?? bridge.verifier_status ?? "").trim().toLowerCase();
  if (TRUSTED_VERIFIER_STATUSES.includes(status as typeof TRUSTED_VERIFIER_STATUSES[number])) return true;
  const bridgeId = asOptionalString(args.bridge_id) ?? asOptionalString(bridge.bridge_id);
  const evidence = recordFrom(bridge.evidence ?? args.evidence);
  return Boolean(
    bridgeId?.startsWith("nudgebridge_")
    && evidence.verifier_required === true
    && normaliseBridgeStatus(args.bridge_status ?? bridge.bridge_status) !== "advisory_only",
  );
}

function routeFor(painpointType: string) {
  return WORKER_ROUTES.find((route) => route.painpoint_type === painpointType);
}

function workerFrom(request: Record<string, unknown>, painpointType: string): string | null {
  const explicit = safeText(request.worker);
  const route = routeFor(painpointType);
  if (!route) return null;
  if (explicit && explicit !== route.worker) return null;
  return route.worker;
}

function targetFrom(args: Record<string, unknown>, bridge: Record<string, unknown>, request: Record<string, unknown>): string | null {
  return safeText(args.target)
    ?? safeText(request.target)
    ?? safeText(args.source_url)
    ?? safeText(bridge.source_url)
    ?? safeText(args.source_id)
    ?? safeText(bridge.source_id);
}

function bridgeSource(bridge: Record<string, unknown>, args: Record<string, unknown>) {
  const evidence = recordFrom(bridge.evidence);
  return {
    bridge_id: safeText(args.bridge_id) ?? safeText(bridge.bridge_id),
    source_id: safeText(args.source_id) ?? safeText(bridge.source_id) ?? safeText(evidence.source_id),
    source_url: safeText(args.source_url) ?? safeText(bridge.source_url) ?? safeText(evidence.source_url),
    nudge_trace_id: safeText(args.nudge_trace_id) ?? safeText(evidence.nudge_trace_id),
  };
}

function receiptLine(worker: string, target: string, painpointType: string, request: Record<string, unknown>): string {
  const supplied = safeText(request.receipt_line);
  if (supplied) return supplied;
  const expected = safeText(request.expected_receipt) ?? "receipt, proof, or blocker";
  const verifier = safeText(request.verifier) ?? "deterministic verifier";
  return `${worker} -> ${target} -> ${painpointType} -> ${expected} -> ${verifier}`;
}

export async function igniteonlyPolicy(_args: Record<string, unknown>): Promise<unknown> {
  return IGNITEONLY_POLICY;
}

export async function igniteonlyReceiptConsumer(args: Record<string, unknown>): Promise<unknown> {
  const bridge = recordFrom(args.nudge_bridge_result ?? args.bridge_result);
  const request = recordFrom(args.request ?? bridge.request);
  const bridgeStatus = normaliseBridgeStatus(args.bridge_status ?? bridge.bridge_status);
  const painpointType = normalisePainpointType(args.painpoint_type ?? bridge.painpoint_type ?? request.painpoint_type);
  const detected = asBoolean(args.painpoint_detected ?? bridge.painpoint_detected ?? painpointType !== "none");
  const source = bridgeSource(bridge, args);
  const target = targetFrom(args, bridge, request);
  const worker = workerFrom(request, painpointType);
  const route = routeFor(painpointType);
  const igniteId = `igniteonly_${shortHash(JSON.stringify({
    bridge_status: bridgeStatus,
    painpoint_type: painpointType,
    source,
    target,
    worker,
  }))}`;

  if (!detected || painpointType === "none" || bridgeStatus === "quiet") {
    return {
      ignite_id: igniteId,
      ignite_status: "quiet",
      painpoint_detected: false,
      painpoint_type: "none",
      reason: "No verified painpoint wake request was present.",
      requires_verifier: true,
    };
  }

  if (!BRIDGE_ACTION_STATUSES.includes(bridgeStatus as typeof BRIDGE_ACTION_STATUSES[number])) {
    return {
      ignite_id: igniteId,
      ignite_status: "blocked_verification_required",
      painpoint_detected: detected,
      painpoint_type: painpointType,
      reason: "IgniteOnly only wakes workers from receipt_request or escalation_request bridge results.",
      bridge_status: bridgeStatus,
      requires_verifier: true,
    };
  }

  if (!source.bridge_id && !source.source_id && !source.source_url) {
    return {
      ignite_id: igniteId,
      ignite_status: "blocked_verification_required",
      painpoint_detected: detected,
      painpoint_type: painpointType,
      reason: "Source evidence is missing, so no worker wake packet was created.",
      missing: ["source evidence"],
      requires_verifier: true,
      quality_gate: "prefer no wake over waking the wrong worker",
    };
  }

  if (!target || !worker || !route) {
    return {
      ignite_id: igniteId,
      ignite_status: "blocked_verification_required",
      painpoint_detected: detected,
      painpoint_type: painpointType,
      reason: "Target, known worker lane, or painpoint route is missing.",
      missing: {
        target: !target,
        known_worker: !worker,
        route: !route,
      },
      requires_verifier: true,
      quality_gate: "only route to a known worker lane",
    };
  }

  if (!verifierPassed(args, bridge)) {
    return {
      ignite_id: igniteId,
      ignite_status: "blocked_verification_required",
      painpoint_detected: detected,
      painpoint_type: painpointType,
      reason: "A trusted verifier or trusted NudgeOnly bridge is required before waking a worker.",
      bridge_status: bridgeStatus,
      requires_verifier: true,
    };
  }

  const line = receiptLine(worker, target, painpointType, request);
  const wakePacket = {
    ignite_id: igniteId,
    action: bridgeStatus === "escalation_request" ? "wake_worker_and_escalate" : "wake_worker",
    worker,
    target,
    painpoint_type: painpointType,
    wake_reason: route.wake_reason,
    expected_receipt: safeText(request.expected_receipt) ?? "receipt, proof, or blocker",
    verifier: safeText(request.verifier) ?? "deterministic verifier",
    receipt_line: line,
    bridge_id: source.bridge_id,
    source_id: source.source_id,
    source_url: source.source_url,
    nudge_trace_id: source.nudge_trace_id,
    public_fields_only: true,
  };

  return {
    ignite_id: igniteId,
    ignite_status: bridgeStatus === "escalation_request" ? "escalation_wake_request" : "wake_request",
    worker: IGNITEONLY_POLICY.worker_name,
    official_name: IGNITEONLY_POLICY.official_name,
    code_name: IGNITEONLY_POLICY.code_name,
    ecosystem: IGNITEONLY_POLICY.ecosystem,
    lane: IGNITEONLY_POLICY.lane,
    authority: IGNITEONLY_POLICY.authority,
    painpoint_detected: true,
    painpoint_type: painpointType,
    wake_packet: wakePacket,
    proof: {
      ignite_id: igniteId,
      bridge_id: source.bridge_id,
      receipt_line: line,
      verifier_required: true,
      verifier_rule: IGNITEONLY_POLICY.verifier_rule,
    },
    requires_verifier: true,
    allowed_actions: IGNITEONLY_POLICY.allowed_actions,
    prohibited_actions: IGNITEONLY_POLICY.prohibited_actions,
  };
}

export async function igniteonlyApi(args: Record<string, unknown>): Promise<unknown> {
  return igniteonlyReceiptConsumer(args);
}

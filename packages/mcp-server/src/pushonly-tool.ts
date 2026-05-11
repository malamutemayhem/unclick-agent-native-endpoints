// PushOnlyAPI is the PinballWake blue push lane.
// It turns verified IgniteOnly wake packets into worker-facing push envelopes.

import { createHash } from "node:crypto";

const PUSH_ACTION_STATUSES = ["wake_request", "escalation_wake_request"] as const;

const WORKER_PUSH_ROUTES = [
  {
    worker: "pinballwake-jobs-worker",
    route: "pinballwake_jobs_room",
    expected_ack: "Jobs Worker ACKs, hydrates/scopes/routes the backlog, or returns a clear blocker.",
  },
  {
    worker: "Builder",
    route: "builder_room",
    expected_ack: "Builder ACKs with commit, PR, proof, or blocker.",
  },
  {
    worker: "Reviewer",
    route: "review_room",
    expected_ack: "Reviewer ACKs with PASS/BLOCKER on the latest head.",
  },
  {
    worker: "Job Manager",
    route: "job_manager_room",
    expected_ack: "Job Manager ACKs with owner, next safe action, and expected proof.",
  },
  {
    worker: "Heartbeat Seat",
    route: "heartbeat_room",
    expected_ack: "Heartbeat Seat ACKs with the latest material diff or blocker.",
  },
] as const;

const QUALITY_GATES = [
  "Require a verified IgniteOnly wake packet before pushing.",
  "PushOnly may emit a push envelope only; it must not write source-of-truth state.",
  "PushOnly may target only a known worker route.",
  "Public compact fields only. Never include secrets, private credentials, or raw hidden context.",
  "Prefer no push over pushing to the wrong worker.",
] as const;

const PROHIBITED_ACTIONS = [
  "build code",
  "merge PRs",
  "approve changes",
  "close issues",
  "mark work complete",
  "assign ownership",
  "edit source-of-truth state",
  "invent workers",
  "print secrets",
] as const;

export const PUSHONLY_POLICY = {
  official_name: "PushOnlyAPI",
  worker_name: "PushOnly📬",
  code_name: "PushOnly",
  ecosystem: "PinballWake",
  lane: "blue_push",
  authority: "push_only_worker_envelope_no_execution",
  rollout_status: "scaffolded",
  route_shape: "verified IgniteOnly wake_packet -> PushOnly envelope -> worker ACK/proof",
  worker_routes: WORKER_PUSH_ROUTES,
  quality_gates: QUALITY_GATES,
  allowed_actions: [
    "emit public worker push envelope",
    "route verified wake packets to known worker lanes",
    "return blocked_verification_required when evidence is weak",
    "redact public packet fields",
  ],
  prohibited_actions: PROHIBITED_ACTIONS,
  verifier_rule: "PushOnly can push only after IgniteOnly has emitted a verified wake packet. Trusted worker lanes still ACK, execute, and prove.",
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

function normaliseIgniteStatus(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase();
  if (PUSH_ACTION_STATUSES.includes(raw as typeof PUSH_ACTION_STATUSES[number])) return raw;
  if (["quiet", "blocked_verification_required"].includes(raw)) return raw;
  return "quiet";
}

function routeFor(worker: string | null) {
  if (!worker) return null;
  return WORKER_PUSH_ROUTES.find((route) => route.worker === worker) ?? null;
}

function wakeFrom(args: Record<string, unknown>) {
  const ignite = recordFrom(args.ignite_result ?? args.igniteonly_result ?? args.ignite);
  const wake = recordFrom(args.wake_packet ?? ignite.wake_packet);
  return { ignite, wake };
}

function sourceFrom(wake: Record<string, unknown>, ignite: Record<string, unknown>, args: Record<string, unknown>) {
  return {
    ignite_id: safeText(args.ignite_id) ?? safeText(wake.ignite_id) ?? safeText(ignite.ignite_id),
    bridge_id: safeText(args.bridge_id) ?? safeText(wake.bridge_id),
    source_id: safeText(args.source_id) ?? safeText(wake.source_id),
    source_url: safeText(args.source_url) ?? safeText(wake.source_url),
    nudge_trace_id: safeText(args.nudge_trace_id) ?? safeText(wake.nudge_trace_id),
  };
}

export async function pushonlyPolicy(_args: Record<string, unknown>): Promise<unknown> {
  return PUSHONLY_POLICY;
}

export async function pushonlyWakePusher(args: Record<string, unknown>): Promise<unknown> {
  const { ignite, wake } = wakeFrom(args);
  const igniteStatus = normaliseIgniteStatus(args.ignite_status ?? ignite.ignite_status);
  const worker = safeText(args.worker) ?? safeText(wake.worker);
  const target = safeText(args.target) ?? safeText(wake.target);
  const painpointType = safeText(args.painpoint_type) ?? safeText(wake.painpoint_type) ?? "none";
  const route = routeFor(worker);
  const source = sourceFrom(wake, ignite, args);
  const publicFieldsOnly = asBoolean(args.public_fields_only ?? wake.public_fields_only);
  const pushId = `pushonly_${shortHash(JSON.stringify({
    ignite_status: igniteStatus,
    worker,
    target,
    painpoint_type: painpointType,
    source,
  }))}`;

  if (!PUSH_ACTION_STATUSES.includes(igniteStatus as typeof PUSH_ACTION_STATUSES[number])) {
    return {
      push_id: pushId,
      push_status: "blocked_verification_required",
      reason: "PushOnly only pushes verified IgniteOnly wake_request or escalation_wake_request packets.",
      ignite_status: igniteStatus,
      requires_verifier: true,
    };
  }

  if (!publicFieldsOnly) {
    return {
      push_id: pushId,
      push_status: "blocked_verification_required",
      reason: "PushOnly requires IgniteOnly wake_packet.public_fields_only=true before pushing.",
      requires_verifier: true,
      quality_gate: "public compact fields only",
    };
  }

  if (!source.ignite_id && !source.bridge_id && !source.source_id && !source.source_url) {
    return {
      push_id: pushId,
      push_status: "blocked_verification_required",
      reason: "Source evidence is missing, so no push envelope was created.",
      missing: ["source evidence"],
      requires_verifier: true,
    };
  }

  if (!target || !worker || !route) {
    return {
      push_id: pushId,
      push_status: "blocked_verification_required",
      reason: "Target, known worker route, or worker is missing.",
      missing: {
        target: !target,
        worker: !worker,
        known_route: !route,
      },
      requires_verifier: true,
      quality_gate: "prefer no push over pushing to the wrong worker",
    };
  }

  const receiptLine =
    safeText(args.receipt_line) ??
    safeText(wake.receipt_line) ??
    `${worker} -> ${target} -> ${painpointType} -> ACK/proof or blocker`;
  const expectedReceipt =
    safeText(args.expected_receipt) ??
    safeText(wake.expected_receipt) ??
    route.expected_ack;
  const verifier =
    safeText(args.verifier) ??
    safeText(wake.verifier) ??
    PUSHONLY_POLICY.verifier_rule;

  const pushPacket = {
    push_id: pushId,
    action: igniteStatus === "escalation_wake_request" ? "push_worker_escalation_packet" : "push_worker_packet",
    worker,
    worker_route: route.route,
    target,
    painpoint_type: painpointType,
    expected_receipt: expectedReceipt,
    verifier,
    receipt_line: receiptLine,
    ignite_id: source.ignite_id,
    bridge_id: source.bridge_id,
    source_id: source.source_id,
    source_url: source.source_url,
    nudge_trace_id: source.nudge_trace_id,
    public_fields_only: true,
    execute: false,
    mutation_authority: false,
  };

  return {
    push_id: pushId,
    push_status: igniteStatus === "escalation_wake_request" ? "escalation_push_request" : "push_request",
    official_name: PUSHONLY_POLICY.official_name,
    worker: PUSHONLY_POLICY.worker_name,
    code_name: PUSHONLY_POLICY.code_name,
    ecosystem: PUSHONLY_POLICY.ecosystem,
    lane: PUSHONLY_POLICY.lane,
    authority: PUSHONLY_POLICY.authority,
    ignite_status: igniteStatus,
    target_worker: worker,
    push_packet: pushPacket,
    proof: {
      push_id: pushId,
      ignite_id: source.ignite_id,
      receipt_line: receiptLine,
      verifier_required: true,
      verifier_rule: PUSHONLY_POLICY.verifier_rule,
    },
    requires_worker_ack: true,
    allowed_actions: PUSHONLY_POLICY.allowed_actions,
    prohibited_actions: PUSHONLY_POLICY.prohibited_actions,
  };
}

export async function pushonlyApi(args: Record<string, unknown>): Promise<unknown> {
  return pushonlyWakePusher(args);
}

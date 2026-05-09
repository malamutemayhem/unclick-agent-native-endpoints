const DEFAULT_ACTIVE_MS = 15 * 60 * 1000;
const DEFAULT_WARM_MS = 60 * 60 * 1000;
const DEFAULT_DORMANT_MS = 24 * 60 * 60 * 1000;
const DEFAULT_COORDINATOR_FALLBACK_MS = 2 * 60 * 60 * 1000;

const SENSITIVE_KEY_RE = /(api[_-]?key|secret|token|password|credential|authorization|cookie)/i;
const SENSITIVE_TEXT_RE =
  /(authorization:\s*bearer\s+\S+|uc_[a-f0-9]{16,}|sk-[a-z0-9_-]{12,}|gh[pousr]_[a-z0-9_]{20,})/i;

export const AUTOPILOT_LIVENESS_DEFAULTS = {
  activeMs: DEFAULT_ACTIVE_MS,
  warmMs: DEFAULT_WARM_MS,
  dormantMs: DEFAULT_DORMANT_MS,
  coordinatorFallbackMs: DEFAULT_COORDINATOR_FALLBACK_MS,
};

function safeList(value) {
  return Array.isArray(value) ? value : [];
}

function normalize(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function compactText(value, max = 500) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function redactSensitiveText(value, max = 500) {
  const text = compactText(value, max);
  return SENSITIVE_TEXT_RE.test(text) ? "[redacted-sensitive-text]" : text;
}

function assertSafeKeys(value, path = "payload") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeKeys(item, `${path}.${index}`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY_RE.test(key)) {
      throw new Error(`Autopilot liveness payload contains sensitive key: ${path}.${key}`);
    }
    assertSafeKeys(child, `${path}.${key}`);
  }
}

function parseMs(value) {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function ageMs(nowMs, value) {
  const parsed = parseMs(value);
  return parsed === null ? null : Math.max(0, nowMs - parsed);
}

function minutes(value) {
  return value === null ? null : Math.round(value / 60000);
}

function buildThresholds(input = {}) {
  return {
    activeMs: input.activeMs ?? DEFAULT_ACTIVE_MS,
    warmMs: input.warmMs ?? DEFAULT_WARM_MS,
    dormantMs: input.dormantMs ?? DEFAULT_DORMANT_MS,
    coordinatorFallbackMs: input.coordinatorFallbackMs ?? DEFAULT_COORDINATOR_FALLBACK_MS,
  };
}

export function inferAutopilotLane(profile = {}) {
  assertSafeKeys(profile, "profile");
  const haystack = normalize([
    profile.agent_id,
    profile.display_name,
    profile.user_agent_hint,
    profile.current_status,
    profile.emoji,
  ].filter(Boolean).join(" "));

  if (/\b(master|coordinator|orchestrator)\b/.test(haystack)) return "coordinator";
  if (/\b(review|reviewer|cowork-seat)\b/.test(haystack)) return "reviewer";
  if (/\b(builder|forge|worker2|coding)\b/.test(haystack)) return "builder";
  if (/\b(test|testpass|qc|quality)\b/.test(haystack)) return "tester";
  if (/\b(safety|gatekeeper)\b/.test(haystack)) return "safety-checker";
  if (/\b(loop|continuous improvement|improver)\b/.test(haystack)) return "improver";
  if (/\b(navigator|planner|planning)\b/.test(haystack)) return "planner";
  if (/\b(relay|watcher|tether|heartbeat)\b/.test(haystack)) return "watcher";
  if (/\b(courier|messenger)\b/.test(haystack)) return "messenger";
  if (/\b(publish|publisher|queuepush)\b/.test(haystack)) return "publisher";
  return "unknown";
}

export function classifyAutopilotAge(age, thresholds = AUTOPILOT_LIVENESS_DEFAULTS) {
  if (age === null) return "unknown";
  if (age <= thresholds.activeMs) return "active";
  if (age <= thresholds.warmMs) return "warm";
  if (age <= thresholds.dormantMs) return "stale";
  return "dormant";
}

function statusReasons(profile = {}, nowMs, thresholds) {
  const reasons = [];
  const seenAge = ageMs(nowMs, profile.last_seen_at);
  const statusAge = ageMs(nowMs, profile.current_status_updated_at);
  const nextCheckinAt = parseMs(profile.next_checkin_at);

  if (seenAge === null) reasons.push("missing_last_seen");
  if (profile.next_checkin_at && nextCheckinAt !== null && nextCheckinAt < nowMs) {
    reasons.push("missed_next_checkin");
  }
  if (statusAge !== null && statusAge > thresholds.warmMs && !profile.current_status) {
    reasons.push("no_recent_status");
  }
  if (/deferred deep review|awaiting independent reviewer|actual diff pass deferred/i.test(String(profile.current_status ?? ""))) {
    reasons.push("deferred_review_or_ack_only");
  }

  return reasons;
}

export function classifyProfileLiveness(profile = {}, input = {}) {
  assertSafeKeys(profile, "profile");
  const now = input.now || new Date().toISOString();
  const nowMs = parseMs(now);
  if (nowMs === null) {
    throw new Error(`Invalid now timestamp: ${now}`);
  }

  const thresholds = buildThresholds(input);
  const lane = inferAutopilotLane(profile);
  const lastSeenAge = ageMs(nowMs, profile.last_seen_at);
  const freshness = classifyAutopilotAge(lastSeenAge, thresholds);
  const reasons = statusReasons(profile, nowMs, thresholds);
  if (lane === "coordinator" && (lastSeenAge === null || lastSeenAge > thresholds.coordinatorFallbackMs)) {
    reasons.push("coordinator_fallback_needed");
  }

  return {
    agent_id: profile.agent_id || "",
    display_name: profile.display_name || "",
    lane,
    freshness,
    last_seen_at: profile.last_seen_at || null,
    last_seen_age_minutes: minutes(lastSeenAge),
    current_status_updated_at: profile.current_status_updated_at || null,
    next_checkin_at: profile.next_checkin_at || null,
    reasons,
  };
}

function signalReasonCodes(text) {
  const reasons = [];
  if (/missed ack/i.test(text)) reasons.push("missed_ack");
  if (/auto-reroute|reroute/i.test(text)) reasons.push("reroute_requested");
  if (/wakepass/i.test(text)) reasons.push("wakepass_signal");
  if (/late review|deferred review|awaiting independent reviewer/i.test(text)) reasons.push("late_review");
  return reasons;
}

function targetLaneHint(text) {
  if (/review|reviewer|qc/i.test(text)) return "reviewer";
  if (/coordinator|master|owner decision/i.test(text)) return "coordinator";
  if (/builder|build/i.test(text)) return "builder";
  if (/jobs manager|job/i.test(text)) return "jobs-manager";
  return "unknown";
}

export function extractMissedAckSignals(messages = []) {
  assertSafeKeys(messages, "messages");
  return safeList(messages)
    .map((message) => {
      const text = `${message.text ?? ""} ${safeList(message.tags).join(" ")}`;
      const reasons = signalReasonCodes(text);
      return { message, text, reasons };
    })
    .filter(({ reasons }) => reasons.length > 0)
    .map(({ message, text, reasons }) => ({
      message_id: message.id || "",
      created_at: message.created_at || message.createdAt || "",
      recipients: safeList(message.recipients),
      reason_codes: reasons,
      target_lane_hint: targetLaneHint(text),
      excerpt: redactSensitiveText(message.text, 400),
    }));
}

export function buildAdvisoryReroutes(input = {}) {
  const profiles = safeList(input.profiles);
  const workers = profiles.map((profile) => classifyProfileLiveness(profile, input));
  const missedAckSignals = extractMissedAckSignals(input.messages);
  const coordinatorDormant = workers.some(
    (worker) => worker.lane === "coordinator" && worker.reasons.includes("coordinator_fallback_needed"),
  );
  const deferredReviewSeats = workers.filter((worker) => worker.reasons.includes("deferred_review_or_ack_only"));

  const actions = [];
  if (coordinatorDormant) {
    actions.push({
      action: "activate_second_tier_coordinator",
      reason: "coordinator_fallback_needed",
      target_lane_hint: "coordinator",
    });
  }
  for (const signal of missedAckSignals) {
    actions.push({
      action: "reroute_missed_ack_to_live_worker",
      reason: "missed_ack_reroute_detected",
      target_lane_hint: signal.target_lane_hint,
      proof_message_id: signal.message_id,
    });
  }
  if (deferredReviewSeats.length > 0) {
    actions.push({
      action: "separate_ack_from_diff_review",
      reason: "deferred_review_or_ack_only",
      target_lane_hint: "reviewer",
      affected_agent_ids: deferredReviewSeats.map((worker) => worker.agent_id),
    });
  }

  return actions;
}

export function buildReviewCoordinatorLivenessAdapter(input = {}) {
  return buildAdvisoryReroutes(input).filter((action) => action.target_lane_hint === "reviewer");
}

export function buildJobsManagerLivenessAdapter(input = {}) {
  return {
    workers: safeList(input.profiles).map((profile) => classifyProfileLiveness(profile, input)),
    actions: buildAdvisoryReroutes(input),
  };
}

export function evaluateWorkerLiveness(input = {}) {
  const now = input.now || new Date().toISOString();
  const nowMs = parseMs(now);
  if (nowMs === null) {
    throw new Error(`Invalid now timestamp: ${now}`);
  }

  const thresholds = buildThresholds(input);
  const workers = safeList(input.profiles).map((profile) => classifyProfileLiveness(profile, input));
  const counts = workers.reduce((acc, worker) => {
    acc[worker.freshness] = (acc[worker.freshness] ?? 0) + 1;
    return acc;
  }, { active: 0, warm: 0, stale: 0, dormant: 0, unknown: 0 });
  const missedAckReroutes = extractMissedAckSignals(input.messages);

  return {
    generated_at: now,
    thresholds_minutes: {
      active: minutes(thresholds.activeMs),
      warm: minutes(thresholds.warmMs),
      dormant: minutes(thresholds.dormantMs),
      coordinator_fallback: minutes(thresholds.coordinatorFallbackMs),
    },
    counts,
    workers,
    missed_ack_reroutes: missedAckReroutes,
    actions: buildAdvisoryReroutes(input),
    safe_mode: {
      read_only: true,
      no_secret_access: true,
      no_merge_or_claim: true,
    },
  };
}

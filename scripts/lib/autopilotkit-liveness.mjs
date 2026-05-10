const DEFAULT_ACTIVE_MS = 15 * 60 * 1000;
const DEFAULT_WARM_MS = 60 * 60 * 1000;
const DEFAULT_DORMANT_MS = 24 * 60 * 60 * 1000;
const DEFAULT_COORDINATOR_FALLBACK_MS = 2 * 60 * 60 * 1000;
const DEFAULT_SCHEDULER_GRACE_MS = 15 * 60 * 1000;
const DEFAULT_SCHEDULER_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_TRUSTED_FALLBACK_FRESH_MS = 10 * 60 * 1000;

const SENSITIVE_KEY_RE = /(api[_-]?key|secret|token|password|credential|authorization|cookie)/i;
const SENSITIVE_TEXT_RE =
  /(authorization:\s*bearer\s+\S+|uc_[a-f0-9]{16,}|sk-[a-z0-9_-]{12,}|gh[pousr]_[a-z0-9_]{20,})/i;
const SCHEDULED_PROOF_SOURCES = new Set([
  "schedule",
  "scheduled",
  "github_schedule",
  "github_schedule_chain",
  "workflow_run_schedule",
]);
const MANUAL_PROOF_SOURCES = new Set(["manual", "workflow_dispatch", "dispatch", "queuepush"]);
const TRUSTED_UNCLICK_FALLBACK_SOURCES = new Set([
  "unclick",
  "unclick_heartbeat",
  "unclick-heartbeat",
  "unclick_chat_chain",
  "unclick-chat-chain",
  "unclick_seat_heartbeat",
  "unclick-seat-heartbeat",
  "boardroom_heartbeat",
  "boardroom-heartbeat",
  "trusted_chat_message",
  "trusted-chat-message",
  "chat_message_pulse",
  "chat-message-pulse",
]);

function safeList(value) {
  return Array.isArray(value) ? value : [];
}

function normalize(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeToken(value) {
  return normalize(value).replace(/[\s-]+/g, "_");
}

export function sanitizeAdvisoryText(value, max = 500) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (SENSITIVE_TEXT_RE.test(text)) return "[redacted-sensitive-text]";
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function safeString(key, value, max = 160) {
  if (SENSITIVE_KEY_RE.test(key)) return "[redacted-sensitive-field]";
  return sanitizeAdvisoryText(value, max);
}

export function parseMs(value) {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function ageMs(nowMs, value) {
  const parsed = parseMs(value);
  return parsed === null ? null : Math.max(0, nowMs - parsed);
}

function isoFromMs(value) {
  return Number.isFinite(value) ? new Date(value).toISOString() : null;
}

function minutes(value) {
  return value === null ? null : Math.round(value / 60000);
}

export function normalizeLivenessThresholds(input = {}) {
  return {
    activeMs: input.activeMs ?? DEFAULT_ACTIVE_MS,
    warmMs: input.warmMs ?? DEFAULT_WARM_MS,
    dormantMs: input.dormantMs ?? DEFAULT_DORMANT_MS,
    coordinatorFallbackMs: input.coordinatorFallbackMs ?? DEFAULT_COORDINATOR_FALLBACK_MS,
  };
}

export function inferAutoPilotKitLane(profile = {}) {
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
  if (/\b(job|jobs manager|scopepack)\b/.test(haystack)) return "jobs-manager";
  return "unknown";
}

export function classifySeatFreshness(age, thresholds) {
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
  const nextCheckinAge = ageMs(nowMs, profile.next_checkin_at);

  if (seenAge === null) reasons.push("missing_last_seen");
  if (profile.next_checkin_at && nextCheckinAge !== null && nextCheckinAt !== null && nextCheckinAt < nowMs) {
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

export function normalizeSeatLiveness(profile = {}, options = {}) {
  const nowMs = options.nowMs;
  if (!Number.isFinite(nowMs)) throw new Error("nowMs required");

  const thresholds = normalizeLivenessThresholds(options.thresholds);
  const lane = inferAutoPilotKitLane(profile);
  const lastSeenAge = ageMs(nowMs, profile.last_seen_at);
  const freshness = classifySeatFreshness(lastSeenAge, thresholds);
  const reasons = statusReasons(profile, nowMs, thresholds);
  if (lane === "coordinator" && (lastSeenAge === null || lastSeenAge > thresholds.coordinatorFallbackMs)) {
    reasons.push("coordinator_fallback_needed");
  }

  return {
    agent_id: safeString("agent_id", profile.agent_id),
    display_name: safeString("display_name", profile.display_name),
    lane,
    freshness,
    last_seen_at: profile.last_seen_at || null,
    last_seen_age_minutes: minutes(lastSeenAge),
    current_status_updated_at: profile.current_status_updated_at || null,
    next_checkin_at: profile.next_checkin_at || null,
    reasons,
  };
}

export function extractMissedAckSignals(messages = []) {
  return safeList(messages)
    .filter((message) => {
      const text = `${message.text ?? ""} ${safeList(message.tags).join(" ")}`;
      return /missed ack|auto-reroute|wakepass/i.test(text);
    })
    .map((message) => ({
      message_id: safeString("message_id", message.id, 160),
      created_at: message.created_at || message.createdAt || "",
      recipients: safeList(message.recipients).map((recipient) => safeString("recipient", recipient, 80)),
      excerpt: sanitizeAdvisoryText(message.text, 400),
    }));
}

export function buildAdvisoryRerouteActions({ workers = [], missedAckReroutes = [] } = {}) {
  const actions = [];
  const coordinatorDormant = workers.some(
    (worker) => worker.lane === "coordinator" && worker.reasons.includes("coordinator_fallback_needed"),
  );
  const deferredReviewSeats = workers.filter((worker) => worker.reasons.includes("deferred_review_or_ack_only"));

  if (coordinatorDormant) {
    actions.push({
      action: "activate_second_tier_coordinator",
      reason: "coordinator_fallback_needed",
      target_lane: "coordinator",
      advisory: true,
    });
  }
  for (const reroute of missedAckReroutes) {
    actions.push({
      action: "reroute_missed_ack_to_live_worker",
      reason: "missed_ack_reroute_detected",
      proof_message_id: reroute.message_id,
      target_lane: "reviewer",
      advisory: true,
    });
  }
  if (deferredReviewSeats.length > 0) {
    actions.push({
      action: "separate_ack_from_diff_review",
      reason: "deferred_review_or_ack_only",
      affected_agent_ids: deferredReviewSeats.map((worker) => worker.agent_id),
      target_lane: "reviewer",
      advisory: true,
    });
  }

  return actions;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

export function buildAutoPilotKitAdapterExamples(result) {
  const reviewActions = result.actions.filter(
    (action) => action.target_lane === "reviewer" || action.reason === "deferred_review_or_ack_only",
  );
  const queueActions = result.actions.filter((action) => action.target_lane === "coordinator");
  const staleWorkers = result.workers.filter((worker) => ["stale", "dormant", "unknown"].includes(worker.freshness));

  return {
    review_coordinator: {
      execute: false,
      target_lane: "reviewer",
      reason_codes: unique(reviewActions.map((action) => action.reason)),
      recommendations: reviewActions,
    },
    jobs_manager: {
      execute: false,
      target_lane: "jobs-manager",
      reason_codes: unique([
        ...queueActions.map((action) => action.reason),
        ...staleWorkers.flatMap((worker) => worker.reasons),
      ]),
      stale_agent_ids: staleWorkers.map((worker) => worker.agent_id),
      recommendations: queueActions,
    },
  };
}

export function evaluateAutoPilotKitLiveness(input = {}) {
  const now = input.now || new Date().toISOString();
  const nowMs = parseMs(now);
  if (nowMs === null) {
    throw new Error(`Invalid now timestamp: ${now}`);
  }

  const thresholds = normalizeLivenessThresholds(input);
  const workers = safeList(input.profiles).map((profile) => normalizeSeatLiveness(profile, { nowMs, thresholds }));
  const counts = workers.reduce((acc, worker) => {
    acc[worker.freshness] = (acc[worker.freshness] ?? 0) + 1;
    return acc;
  }, { active: 0, warm: 0, stale: 0, dormant: 0, unknown: 0 });
  const missedAckReroutes = extractMissedAckSignals(input.messages);
  const actions = buildAdvisoryRerouteActions({ workers, missedAckReroutes });

  const result = {
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
    actions,
    safe_mode: {
      read_only: true,
      no_secret_access: true,
      no_merge_or_claim: true,
    },
  };

  return {
    ...result,
    adapter_examples: buildAutoPilotKitAdapterExamples(result),
  };
}

function normalizeSchedulerSchedule(schedule = {}, nowMs, defaults = {}) {
  const lastRunAt =
    schedule.last_scheduled_at ||
    schedule.lastScheduledAt ||
    schedule.last_success_at ||
    schedule.lastSuccessAt ||
    schedule.last_run_at ||
    schedule.lastRunAt ||
    "";
  const lastRunMs = parseMs(lastRunAt);
  const expectedMs =
    Number.isFinite(schedule.expectedEveryMs) ? schedule.expectedEveryMs :
    Number.isFinite(schedule.expected_every_ms) ? schedule.expected_every_ms :
    Number.isFinite(schedule.expectedEveryMinutes) ? schedule.expectedEveryMinutes * 60 * 1000 :
    Number.isFinite(schedule.expected_every_minutes) ? schedule.expected_every_minutes * 60 * 1000 :
    defaults.expectedEveryMs;
  const graceMs =
    Number.isFinite(schedule.graceMs) ? schedule.graceMs :
    Number.isFinite(schedule.grace_ms) ? schedule.grace_ms :
    Number.isFinite(schedule.graceMinutes) ? schedule.graceMinutes * 60 * 1000 :
    Number.isFinite(schedule.grace_minutes) ? schedule.grace_minutes * 60 * 1000 :
    defaults.graceMs;
  const dueMs = lastRunMs === null ? null : lastRunMs + expectedMs + graceMs;
  const lastRunAgeMs = lastRunMs === null ? null : Math.max(0, nowMs - lastRunMs);
  const stale = dueMs === null ? false : dueMs < nowMs;
  const missing = lastRunMs === null;

  return {
    id: sanitizeAdvisoryText(schedule.id || schedule.name || "schedule", 120),
    name: sanitizeAdvisoryText(schedule.name || schedule.id || "schedule", 160),
    required: schedule.required !== false,
    last_scheduled_at: lastRunMs === null ? null : new Date(lastRunMs).toISOString(),
    last_scheduled_age_minutes: minutes(lastRunAgeMs),
    expected_every_minutes: minutes(expectedMs),
    grace_minutes: minutes(graceMs),
    stale_after: isoFromMs(dueMs),
    stale,
    missing,
  };
}

function normalizeTrustedFallbackSignal(input = {}, nowMs, freshnessMs) {
  const source = input.source || input.source_kind || input.sourceKind || input.kind || "";
  const createdAt = input.created_at || input.createdAt || input.at || "";
  const createdAtMs = parseMs(createdAt);
  const age = createdAtMs === null ? null : Math.max(0, nowMs - createdAtMs);
  const sourceToken = normalizeToken(source);

  return {
    source: sanitizeAdvisoryText(source, 120),
    source_token: sourceToken,
    source_id: sanitizeAdvisoryText(input.source_id || input.sourceId || input.id || "", 160) || null,
    created_at: createdAtMs === null ? null : new Date(createdAtMs).toISOString(),
    age_minutes: minutes(age),
    trusted: TRUSTED_UNCLICK_FALLBACK_SOURCES.has(sourceToken),
    fresh: age !== null && age <= freshnessMs,
  };
}

export function evaluateAutoPilotKitSchedulerWatchdog(input = {}) {
  const now = input.now || new Date().toISOString();
  const nowMs = parseMs(now);
  if (nowMs === null) {
    throw new Error(`Invalid now timestamp: ${now}`);
  }

  const defaults = {
    expectedEveryMs: Number.isFinite(input.expectedEveryMs)
      ? input.expectedEveryMs
      : Number.isFinite(input.expectedEveryMinutes)
        ? input.expectedEveryMinutes * 60 * 1000
        : DEFAULT_SCHEDULER_INTERVAL_MS,
    graceMs: Number.isFinite(input.graceMs)
      ? input.graceMs
      : Number.isFinite(input.graceMinutes)
        ? input.graceMinutes * 60 * 1000
        : DEFAULT_SCHEDULER_GRACE_MS,
  };
  const freshnessMs = Number.isFinite(input.trustedFallbackFreshMs)
    ? input.trustedFallbackFreshMs
    : Number.isFinite(input.trustedFallbackFreshMinutes)
      ? input.trustedFallbackFreshMinutes * 60 * 1000
      : DEFAULT_TRUSTED_FALLBACK_FRESH_MS;
  const schedules = safeList(input.schedules).map((schedule) =>
    normalizeSchedulerSchedule(schedule, nowMs, defaults),
  );
  const requiredSchedules = schedules.filter((schedule) => schedule.required);
  const staleSchedules = requiredSchedules.filter((schedule) => schedule.stale);
  const missingSchedules = requiredSchedules.filter((schedule) => schedule.missing);
  const fallback = normalizeTrustedFallbackSignal(input.trustedFallback || input.trusted_fallback || {}, nowMs, freshnessMs);
  const canTap = staleSchedules.length > 0 && missingSchedules.length === 0 && fallback.trusted && fallback.fresh;
  const healthy = requiredSchedules.length > 0 && staleSchedules.length === 0 && missingSchedules.length === 0;

  let action = "blocker";
  let reason = "missing_schedule_evidence";
  if (healthy) {
    action = "watch";
    reason = "schedules_fresh";
  } else if (canTap) {
    action = "tap_orchestrator_with_trusted_unclick_fallback";
    reason = "schedule_stale_trusted_fallback_fresh";
  } else if (staleSchedules.length > 0 && !fallback.trusted) {
    reason = "schedule_stale_missing_trusted_fallback";
  } else if (staleSchedules.length > 0 && !fallback.fresh) {
    reason = "schedule_stale_fallback_not_fresh";
  }

  return {
    generated_at: now,
    action,
    reason,
    schedules,
    stale_schedule_ids: staleSchedules.map((schedule) => schedule.id),
    missing_schedule_ids: missingSchedules.map((schedule) => schedule.id),
    trusted_fallback: fallback,
    safe_mode: {
      read_only: true,
      no_secret_access: true,
      no_manual_dispatch_as_schedule: true,
    },
  };
}

export function evaluateOrchestratorProofWakeGate(input = {}) {
  const source = normalizeToken(input.source || input.proofSource || input.proof_source || "");
  if (!source) {
    return {
      allow: true,
      proof_source: "legacy_unlabeled",
      reason: "legacy_unlabeled_proof_source",
      safe_mode: {
        read_only: true,
        no_secret_access: true,
        no_manual_dispatch_as_schedule: true,
      },
    };
  }

  if (SCHEDULED_PROOF_SOURCES.has(source)) {
    return {
      allow: true,
      proof_source: source,
      reason: "scheduled_proof_source",
      safe_mode: {
        read_only: true,
        no_secret_access: true,
        no_manual_dispatch_as_schedule: true,
      },
    };
  }

  if (MANUAL_PROOF_SOURCES.has(source)) {
    return {
      allow: false,
      proof_source: source,
      reason: "manual_dispatch_is_not_scheduled_proof",
      next_action: "use a scheduled run or the trusted UnClick fallback gate",
      safe_mode: {
        read_only: true,
        no_secret_access: true,
        no_manual_dispatch_as_schedule: true,
      },
    };
  }

  if (source !== "trusted_unclick_fallback" && source !== "unclick_heartbeat_fallback") {
    return {
      allow: false,
      proof_source: source,
      reason: "unknown_orchestrator_proof_source",
      next_action: "use github_schedule or trusted_unclick_fallback",
      safe_mode: {
        read_only: true,
        no_secret_access: true,
        no_manual_dispatch_as_schedule: true,
      },
    };
  }

  const watchdog = evaluateAutoPilotKitSchedulerWatchdog({
    now: input.now,
    expectedEveryMinutes: input.expectedEveryMinutes ?? 15,
    graceMinutes: input.graceMinutes ?? 15,
    trustedFallbackFreshMinutes: input.trustedFallbackFreshMinutes ?? 10,
    schedules: [
      {
        id: "orchestrator_scheduled_proof",
        name: "Orchestrator scheduled proof",
        last_scheduled_at: input.lastScheduledProofAt || input.last_scheduled_proof_at || "",
      },
    ],
    trustedFallback: {
      source: input.trustedFallbackSource || input.trusted_fallback_source || "",
      created_at: input.trustedFallbackAt || input.trusted_fallback_at || "",
      source_id: input.trustedFallbackId || input.trusted_fallback_id || "",
    },
  });

  const allow = watchdog.action === "tap_orchestrator_with_trusted_unclick_fallback";
  return {
    allow,
    proof_source: "trusted_unclick_fallback",
    reason: allow ? "trusted_unclick_fallback_due" : watchdog.reason,
    next_action: allow ? "run read-only Orchestrator proof" : "wait for a scheduled proof or a fresh trusted UnClick fallback signal",
    scheduler_watchdog: watchdog,
    safe_mode: watchdog.safe_mode,
  };
}

#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const DEFAULT_ACTIVE_MS = 15 * 60 * 1000;
const DEFAULT_WARM_MS = 60 * 60 * 1000;
const DEFAULT_DORMANT_MS = 24 * 60 * 60 * 1000;
const DEFAULT_COORDINATOR_FALLBACK_MS = 2 * 60 * 60 * 1000;

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

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

function inferLane(profile = {}) {
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

function classifyAge(age, { activeMs, warmMs, dormantMs }) {
  if (age === null) return "unknown";
  if (age <= activeMs) return "active";
  if (age <= warmMs) return "warm";
  if (age <= dormantMs) return "stale";
  return "dormant";
}

function statusReasons(profile = {}, nowMs, thresholds) {
  const reasons = [];
  const seenAge = ageMs(nowMs, profile.last_seen_at);
  const statusAge = ageMs(nowMs, profile.current_status_updated_at);
  const nextCheckinAge = ageMs(nowMs, profile.next_checkin_at);

  if (seenAge === null) reasons.push("missing_last_seen");
  if (profile.next_checkin_at && nextCheckinAge !== null && parseMs(profile.next_checkin_at) < nowMs) {
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

function extractMissedAckReroutes(messages = []) {
  return safeList(messages)
    .filter((message) => {
      const text = `${message.text ?? ""} ${safeList(message.tags).join(" ")}`;
      return /missed ack|auto-reroute|wakepass/i.test(text);
    })
    .map((message) => ({
      message_id: message.id || "",
      created_at: message.created_at || message.createdAt || "",
      recipients: safeList(message.recipients),
      excerpt: compactText(message.text, 400),
    }));
}

export function evaluateWorkerLiveness(input = {}) {
  const now = input.now || new Date().toISOString();
  const nowMs = parseMs(now);
  if (nowMs === null) {
    throw new Error(`Invalid now timestamp: ${now}`);
  }

  const thresholds = {
    activeMs: input.activeMs ?? DEFAULT_ACTIVE_MS,
    warmMs: input.warmMs ?? DEFAULT_WARM_MS,
    dormantMs: input.dormantMs ?? DEFAULT_DORMANT_MS,
    coordinatorFallbackMs: input.coordinatorFallbackMs ?? DEFAULT_COORDINATOR_FALLBACK_MS,
  };

  const workers = safeList(input.profiles).map((profile) => {
    const lane = inferLane(profile);
    const lastSeenAge = ageMs(nowMs, profile.last_seen_at);
    const freshness = classifyAge(lastSeenAge, thresholds);
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
  });

  const counts = workers.reduce((acc, worker) => {
    acc[worker.freshness] = (acc[worker.freshness] ?? 0) + 1;
    return acc;
  }, { active: 0, warm: 0, stale: 0, dormant: 0, unknown: 0 });

  const missedAckReroutes = extractMissedAckReroutes(input.messages);
  const coordinatorDormant = workers.some(
    (worker) => worker.lane === "coordinator" && worker.reasons.includes("coordinator_fallback_needed"),
  );
  const deferredReviewSeats = workers.filter((worker) => worker.reasons.includes("deferred_review_or_ack_only"));

  const actions = [];
  if (coordinatorDormant) {
    actions.push({
      action: "activate_second_tier_coordinator",
      reason: "coordinator_fallback_needed",
    });
  }
  for (const reroute of missedAckReroutes) {
    actions.push({
      action: "reroute_missed_ack_to_live_worker",
      reason: "missed_ack_reroute_detected",
      proof_message_id: reroute.message_id,
    });
  }
  if (deferredReviewSeats.length > 0) {
    actions.push({
      action: "separate_ack_from_diff_review",
      reason: "deferred_review_or_ack_only",
      affected_agent_ids: deferredReviewSeats.map((worker) => worker.agent_id),
    });
  }

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
    actions,
    safe_mode: {
      read_only: true,
      no_secret_access: true,
      no_merge_or_claim: true,
    },
  };
}

async function main() {
  const inputPath = getArg("input");
  if (!inputPath) {
    console.error("Usage: node scripts/worker-liveness-watchdog.mjs --input=boardroom-snapshot.json");
    process.exitCode = 1;
    return;
  }

  const input = JSON.parse(await readFile(inputPath, "utf8"));
  console.log(JSON.stringify(evaluateWorkerLiveness(input), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

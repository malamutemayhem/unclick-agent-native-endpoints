#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const DEFAULT_ROLE_FRESHNESS_MINUTES = {
  coordinator: 60,
  reviewer: 30,
  tester: 30,
  builder: 45,
  "safety-checker": 45,
  planner: 60,
  messenger: 60,
  watcher: 45,
  publisher: 90,
  repairer: 45,
  improver: 90,
  loop: 90,
  default: 60,
};

const ROLE_FALLBACKS = {
  coordinator: ["reviewer", "planner", "watcher", "builder", "messenger"],
  reviewer: ["tester", "safety-checker", "coordinator"],
  tester: ["reviewer", "safety-checker", "builder"],
  builder: ["repairer", "coordinator", "reviewer"],
  "safety-checker": ["reviewer", "tester", "coordinator"],
  planner: ["coordinator", "watcher", "messenger"],
  watcher: ["planner", "coordinator", "messenger"],
  messenger: ["coordinator", "planner", "watcher"],
  repairer: ["builder", "coordinator"],
  improver: ["builder", "coordinator"],
  loop: ["improver", "builder", "coordinator"],
};

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

function compactText(value, max = 260) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function parseMs(value) {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function minutesBetween(now, then) {
  const current = parseMs(now);
  const past = parseMs(then);
  if (current === null || past === null) return null;
  return Math.max(0, (current - past) / 60000);
}

function isPast(value, now) {
  const current = parseMs(now);
  const target = parseMs(value);
  return current !== null && target !== null && target <= current;
}

function roleThresholdMinutes(role, thresholds = {}) {
  const normalizedRole = normalize(role) || "default";
  const custom = thresholds[normalizedRole] ?? thresholds.default;
  if (Number.isFinite(custom) && custom > 0) return custom;
  return DEFAULT_ROLE_FRESHNESS_MINUTES[normalizedRole] ?? DEFAULT_ROLE_FRESHNESS_MINUTES.default;
}

function workerKey(worker = {}) {
  return (
    compactText(worker.worker_id || worker.workerId || worker.agent_id || worker.agentId || worker.seat_id || worker.seatId || worker.id || "", 160) ||
    compactText(worker.lane || worker.role || "", 160)
  );
}

function workerLane(worker = {}) {
  return normalize(worker.lane || worker.role || worker.worker || "");
}

function workerLastSeen(worker = {}) {
  return worker.last_seen_at || worker.lastSeenAt || worker.current_status_updated_at || worker.statusUpdatedAt || null;
}

function workerNextCheckin(worker = {}) {
  return worker.next_checkin_at || worker.nextCheckinAt || null;
}

function isWorkerRevoked(worker = {}) {
  return Boolean(worker.revoked_at || worker.revokedAt || normalize(worker.status) === "retired");
}

function evaluateWorker(worker = {}, { now, thresholds } = {}) {
  const lane = workerLane(worker);
  const threshold_minutes = roleThresholdMinutes(lane, thresholds);
  const last_seen_at = workerLastSeen(worker);
  const next_checkin_at = workerNextCheckin(worker);
  const age = minutesBetween(now, last_seen_at);
  const reasons = [];

  if (isWorkerRevoked(worker)) reasons.push("worker_retired_or_revoked");
  if (!last_seen_at) reasons.push("missing_last_seen_at");
  if (age !== null && age > threshold_minutes) reasons.push("last_seen_stale");
  if (next_checkin_at && isPast(next_checkin_at, now)) reasons.push("missed_next_checkin");

  return {
    worker_id: workerKey(worker),
    lane,
    status: normalize(worker.status || "available"),
    last_seen_at,
    next_checkin_at,
    age_minutes: age === null ? null : Number(age.toFixed(2)),
    threshold_minutes,
    active: reasons.length === 0,
    reasons,
  };
}

function assignmentKey(assignment = {}) {
  return compactText(
    assignment.id ||
      assignment.todo_id ||
      assignment.todoId ||
      assignment.dispatch_id ||
      assignment.dispatchId ||
      assignment.pr_number ||
      assignment.title ||
      "unknown",
    180,
  );
}

function assignmentLane(assignment = {}) {
  return normalize(assignment.lane || assignment.role || assignment.target_role || assignment.targetRole || assignment.requested_lane || "");
}

function assignmentWorkerId(assignment = {}) {
  return compactText(
    assignment.worker_id ||
      assignment.workerId ||
      assignment.assigned_worker_id ||
      assignment.assignedWorkerId ||
      assignment.assigned_to_agent_id ||
      assignment.assignedToAgentId ||
      assignment.target_agent_id ||
      assignment.targetAgentId ||
      "",
    180,
  );
}

function proofIsDeferred(assignment = {}) {
  const text = normalize(`${assignment.status || ""} ${assignment.proof_status || ""} ${assignment.verdict || ""} ${assignment.comment || ""}`);
  return text.includes("deferred") || text.includes("hold") || text.includes("waiting") || text.includes("awaiting");
}

function assignmentIssues(assignment = {}, { now, workerById } = {}) {
  const issues = [];
  const assignedWorkerId = assignmentWorkerId(assignment);
  const assignedWorker = assignedWorkerId ? workerById.get(assignedWorkerId) : null;

  if (assignedWorker && !assignedWorker.active) issues.push("assigned_worker_stale");
  if (assignment.lease_expires_at || assignment.leaseExpiresAt) {
    if (isPast(assignment.lease_expires_at || assignment.leaseExpiresAt, now)) issues.push("lease_expired");
  }
  if ((assignment.ack_due_at || assignment.ackDueAt) && !(assignment.ack_received_at || assignment.ackReceivedAt)) {
    if (isPast(assignment.ack_due_at || assignment.ackDueAt, now)) issues.push("ack_overdue");
  }
  if ((assignment.requires_proof || assignment.requiresProof) && proofIsDeferred(assignment)) {
    issues.push("proof_deferred_after_ack");
  }

  return issues;
}

function findFallbackWorker({ lane, workers, excludeWorkerId = "" } = {}) {
  const activeWorkers = safeList(workers).filter((worker) => worker.active && worker.worker_id !== excludeWorkerId);
  const direct = activeWorkers.find((worker) => worker.lane === lane);
  if (direct) return { worker: direct, reason: "same_lane_active" };

  for (const fallbackLane of ROLE_FALLBACKS[lane] || ["coordinator"]) {
    const fallback = activeWorkers.find((worker) => worker.lane === fallbackLane);
    if (fallback) return { worker: fallback, reason: `fallback_${fallbackLane}` };
  }
  return { worker: null, reason: "no_live_fallback" };
}

function createReroutePacket({ assignment, issues, fallback }) {
  const lane = assignmentLane(assignment) || fallback.worker?.lane || "coordinator";
  const assignedWorkerId = assignmentWorkerId(assignment);
  return {
    assignment_id: assignmentKey(assignment),
    title: compactText(assignment.title || assignment.summary || assignment.context || "Worker liveness reroute candidate"),
    from_worker_id: assignedWorkerId || null,
    from_lane: lane,
    to_worker_id: fallback.worker?.worker_id || null,
    to_lane: fallback.worker?.lane || null,
    reason: issues,
    fallback_reason: fallback.reason,
    execute: false,
    no_execute_reason: "audit_only_no_reroute_execution",
    required_reply: "PASS/BLOCKER/HOLD with proof source and next_checkin_at",
  };
}

export function evaluateWorkerLivenessWatchdog({
  workers,
  registry,
  assignments = [],
  now = new Date().toISOString(),
  thresholds = {},
} = {}) {
  const rawWorkers = safeList(workers || registry?.workers);
  const evaluatedWorkers = rawWorkers.map((worker) => evaluateWorker(worker, { now, thresholds }));
  const workerById = new Map(evaluatedWorkers.map((worker) => [worker.worker_id, worker]));
  const staleWorkers = evaluatedWorkers.filter((worker) => !worker.active);
  const activeWorkers = evaluatedWorkers.filter((worker) => worker.active);

  const assignment_issues = safeList(assignments)
    .map((assignment) => {
      const issues = assignmentIssues(assignment, { now, workerById });
      const lane = assignmentLane(assignment);
      const assignedWorkerId = assignmentWorkerId(assignment);
      const fallback = issues.length
        ? findFallbackWorker({ lane, workers: evaluatedWorkers, excludeWorkerId: assignedWorkerId })
        : { worker: null, reason: "not_needed" };
      return {
        assignment,
        assignment_id: assignmentKey(assignment),
        lane,
        assigned_worker_id: assignedWorkerId || null,
        issues,
        fallback,
      };
    })
    .filter((entry) => entry.issues.length > 0);

  const reroute_packets = assignment_issues.map((entry) =>
    createReroutePacket({
      assignment: entry.assignment,
      issues: entry.issues,
      fallback: entry.fallback,
    }),
  );

  return {
    ok: true,
    action: "worker_liveness_watchdog",
    result: staleWorkers.length || assignment_issues.length ? "attention_needed" : "clear",
    execute: false,
    no_execute_reason: "audit_only_no_reroute_execution",
    worker_count: evaluatedWorkers.length,
    active_worker_count: activeWorkers.length,
    stale_worker_count: staleWorkers.length,
    stale_workers: staleWorkers.map((worker) => ({
      worker_id: worker.worker_id,
      lane: worker.lane,
      last_seen_at: worker.last_seen_at,
      next_checkin_at: worker.next_checkin_at,
      age_minutes: worker.age_minutes,
      threshold_minutes: worker.threshold_minutes,
      reasons: worker.reasons,
    })),
    assignment_issue_count: assignment_issues.length,
    assignment_issues: assignment_issues.map((entry) => ({
      assignment_id: entry.assignment_id,
      lane: entry.lane,
      assigned_worker_id: entry.assigned_worker_id,
      issues: entry.issues,
      fallback_reason: entry.fallback.reason,
      fallback_worker_id: entry.fallback.worker?.worker_id || null,
      fallback_lane: entry.fallback.worker?.lane || null,
    })),
    reroute_packets,
    guardrails: [
      "audit_only",
      "no_stealing_active_work",
      "no_reroute_before_expired_lease_or_ack",
      "fallback_only_to_active_workers",
    ],
  };
}

export async function readWorkerLivenessWatchdogInput(filePath) {
  if (!filePath) return { ok: false, reason: "missing_input_path" };
  return JSON.parse(await readFile(filePath, "utf8"));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  readWorkerLivenessWatchdogInput(getArg("input", process.env.WORKER_LIVENESS_WATCHDOG_INPUT || ""))
    .then((input) => evaluateWorkerLivenessWatchdog(input))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

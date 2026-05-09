#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import {
  createCodingRoomJobLedger,
  runnerCanClaimCodingRoomJob,
} from "./pinballwake-coding-room.mjs";
import { DEFAULT_CODING_ROOM_RUNNER, createCodingRoomRunner } from "./pinballwake-coding-room-runner.mjs";

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function safeList(value) {
  return Array.isArray(value) ? value : [];
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function compactText(value, max = 600) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function parseMs(value) {
  const ms = Date.parse(String(value ?? ""));
  return Number.isFinite(ms) ? ms : null;
}

function isExpired(job = {}, now = new Date().toISOString()) {
  const expires = parseMs(job.lease_expires_at || job.ack_deadline_at);
  const current = parseMs(now);
  return expires !== null && current !== null && expires <= current;
}

function jobLabel(job = {}) {
  return compactText(job.chip || job.job_id || "unknown job", 140);
}

function requestedWorker(job = {}) {
  if (job.job_type === "review") {
    const requested = safeList(job.requested_reviewers)[0];
    if (requested) return requested;
    if (job.review_kind === "release_safety") return "gatekeeper";
    if (job.review_kind === "qc_review") return "popcorn";
  }

  return compactText(job.worker || "forge", 80);
}

function packetFor(job, nextAction, context, expectedProof, deadline = "next heartbeat") {
  return {
    worker: requestedWorker(job),
    chip: jobLabel(job),
    context: compactText(context || job.context || job.job_id),
    expected_proof: expectedProof,
    deadline,
    ack: "done/blocker",
  };
}

function classifyJob({ job, ledger, runner, now }) {
  const status = normalize(job.status);
  const type = normalize(job.job_type || "code");

  if (status === "queued") {
    const claim = runnerCanClaimCodingRoomJob({
      runner,
      job,
      activeJobs: ledger.jobs || [],
    });

    if (claim.ok) {
      const action = type === "review" ? "claim_review" : "claim_build";
      return {
        job_id: job.job_id,
        status: job.status,
        job_type: type,
        next_action: action,
        priority: type === "review" ? 70 : 80,
        reason: claim.reason,
        packet: packetFor(
          job,
          action,
          type === "review"
            ? "Review packet is queued and claimable."
            : "Build packet is queued and claimable.",
          type === "review"
            ? "Reply PASS/BLOCKER with latest-head proof."
            : "Claim the job, build only owned files, run listed proof, and report done/blocker.",
        ),
      };
    }

    return {
      job_id: job.job_id,
      status: job.status,
      job_type: type,
      next_action: "blocked_before_claim",
      priority: 60,
      reason: claim.reason,
      file: claim.file || null,
      packet: packetFor(
        job,
        "blocked_before_claim",
        `Queued job is not claimable: ${claim.reason}${claim.file ? ` (${claim.file})` : ""}.`,
        "Fix the blocker or reroute the job, then report done/blocker.",
      ),
    };
  }

  if (["claimed", "building", "testing"].includes(status)) {
    if (isExpired(job, now)) {
      return {
        job_id: job.job_id,
        status: job.status,
        job_type: type,
        next_action: "reclaim_or_refresh",
        priority: 90,
        reason: "lease_or_deadline_expired",
        packet: packetFor(
          job,
          "reclaim_or_refresh",
          "Active job lease/deadline expired; refresh status or allow reclaim.",
          "Reply current status, blocker, or next safe action.",
          "immediate",
        ),
      };
    }

    return {
      job_id: job.job_id,
      status: job.status,
      job_type: type,
      next_action: type === "review" ? "await_review_ack" : "await_build_or_proof",
      priority: 40,
      reason: "active_not_expired",
    };
  }

  if (status === "proof_submitted") {
    return {
      job_id: job.job_id,
      status: job.status,
      job_type: type,
      next_action: "review_or_merge_room",
      priority: 75,
      reason: "proof_submitted_needs_decision",
      packet: packetFor(
        job,
        "review_or_merge_room",
        "Proof is submitted; route review jobs or run Merge Room when PASS gates are complete.",
        "Post required review packets or run Merge Room decision.",
      ),
    };
  }

  if (status === "fallback_ready") {
    return {
      job_id: job.job_id,
      status: job.status,
      job_type: type,
      next_action: "master_fallback_decision",
      priority: 85,
      reason: "review_timeout_fallback_ready",
      packet: packetFor(
        job,
        "master_fallback_decision",
        "Review timed out and is fallback-ready.",
        "Master decides fallback, re-nudge reviewer, or blocker.",
        "immediate",
      ),
    };
  }

  if (status === "blocked") {
    return {
      job_id: job.job_id,
      status: job.status,
      job_type: type,
      next_action: "repair_room",
      priority: 95,
      reason: compactText(job.build_result?.blocker || job.proof?.blocker || "job_blocked", 180),
      packet: packetFor(
        job,
        "repair_room",
        compactText(job.build_result?.blocker || job.proof?.blocker || job.context || "Blocked job needs repair."),
        "Route a focused repair packet or close/supersede if obsolete.",
        "next builder pulse",
      ),
    };
  }

  if (["done", "expired"].includes(status)) {
    return {
      job_id: job.job_id,
      status: job.status,
      job_type: type,
      next_action: status === "expired" ? "requeue_or_close" : "none",
      priority: status === "expired" ? 55 : 0,
      reason: status === "expired" ? "job_expired" : "job_done",
    };
  }

  return {
    job_id: job.job_id,
    status: job.status,
    job_type: type,
    next_action: "inspect",
    priority: 50,
    reason: "unknown_status",
  };
}

function countsBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] || "unknown";
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

export function evaluateJobsRoom({
  ledger,
  jobs,
  runner = DEFAULT_CODING_ROOM_RUNNER,
  now = new Date().toISOString(),
  limit = 5,
} = {}) {
  const safeLedger = createCodingRoomJobLedger({
    jobs: jobs || ledger?.jobs || [],
    updatedAt: ledger?.updated_at || now,
  });
  const safeRunner = createCodingRoomRunner(runner);
  const decisions = safeLedger.jobs
    .map((job) => classifyJob({ job, ledger: safeLedger, runner: safeRunner, now }))
    .sort((a, b) => b.priority - a.priority || String(a.job_id).localeCompare(String(b.job_id)));

  const actionable = decisions.filter((decision) => decision.priority > 0 && decision.next_action !== "none");
  const top = actionable.slice(0, limit);

  return {
    ok: true,
    action: "jobs_room",
    result: actionable.length ? "todos" : "idle",
    reason: actionable.length ? "job_todos_found" : "no_actionable_jobs",
    counts_by_status: countsBy(decisions, "status"),
    counts_by_next_action: countsBy(decisions, "next_action"),
    next: top[0] || null,
    todos: top,
    packets: top.map((decision) => decision.packet).filter(Boolean),
  };
}

export async function readJobsRoomInput(filePath) {
  if (!filePath) return { ok: false, reason: "missing_input_path" };
  return JSON.parse(await readFile(filePath, "utf8"));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  readJobsRoomInput(getArg("input", process.env.PINBALLWAKE_JOBS_ROOM_INPUT || ""))
    .then((input) => evaluateJobsRoom(input))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

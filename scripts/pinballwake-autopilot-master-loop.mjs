#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import { evaluateAckLedgerRoom } from "./pinballwake-ack-ledger-room.mjs";
import { evaluateContinuousImprovementRoom } from "./pinballwake-continuous-improvement-room.mjs";
import { evaluateJobsRoom } from "./pinballwake-jobs-room.mjs";
import { evaluateLaunchpadRoom } from "./pinballwake-launchpad-room.mjs";
import { evaluateMergeRoom } from "./pinballwake-merge-room.mjs";

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

function compactText(value, max = 700) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function prNumber(pr = {}) {
  const parsed = Number.parseInt(String(pr.number ?? pr.pr_number ?? pr.prNumber ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function checksGreen(pr = {}) {
  const checks = safeList(pr.statusCheckRollup || pr.checks);
  return checks.length > 0 && checks.every((check) => {
    const state = normalize(check.state);
    const status = normalize(check.status);
    const conclusion = normalize(check.conclusion);
    if (state) return state === "success";
    if (conclusion) return conclusion === "success" || conclusion === "skipped";
    return status === "completed";
  });
}

function prLooksMergeRelevant(pr = {}) {
  const mergeState = normalize(pr.mergeStateStatus || pr.merge_state_status);
  if (pr.hasHold || pr.hold || safeList(pr.blockers).length > 0) return true;
  if (pr.isDraft || pr.draft) return checksGreen(pr) && (!mergeState || mergeState === "clean");
  return checksGreen(pr) && (!mergeState || mergeState === "clean");
}

function recordsForPr(value, number) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return safeList(value[number] || value[String(number)] || value.default);
}

function syntheticReviewFromClaim(claim = {}) {
  return {
    job_type: "review",
    status: claim.verdict === "BLOCKER" ? "blocked" : "done",
    pr_number: claim.pr_number,
    worker: claim.reviewer,
    review_kind:
      claim.reviewer === "gatekeeper"
        ? "release_safety"
        : claim.reviewer === "popcorn"
          ? "qc_review"
          : "merge_proof",
    requested_reviewers: [claim.reviewer],
    proof: {
      result: claim.verdict === "BLOCKER" ? "blocker" : "pass",
      ack: claim.verdict === "BLOCKER" ? "blocker" : "pass",
      reviewer: claim.reviewer,
      source: claim.source,
      submitted_at: claim.created_at || "",
      summary: claim.excerpt || "",
      blocker: claim.verdict === "BLOCKER" ? claim.excerpt || "" : "",
    },
  };
}

function syntheticReviewsFromAckLedger(ackLedger = {}) {
  return Object.values(ackLedger.latest_by_reviewer || {})
    .filter((claim) => claim?.verdict)
    .map(syntheticReviewFromClaim);
}

function mergePrCandidates(prs = []) {
  return safeList(prs)
    .filter(prLooksMergeRelevant)
    .sort((a, b) => (prNumber(b) || 0) - (prNumber(a) || 0));
}

function nextLaunchpadAction(launchpad = {}) {
  const top = safeList(launchpad.setup_required)[0] || safeList(launchpad.setup)[0] || null;
  return {
    ok: true,
    action: "autopilot_master_loop",
    result: "launchpad_setup_required",
    reason: launchpad.reason || top?.kind || "launchpad_not_ready",
    launchpad,
    packet: {
      worker: "master",
      chip: "Launchpad setup before Autopilot loop",
      context: compactText(top?.detail || launchpad.reason || "Launchpad is not ready."),
      expected_proof: "Fix the Launchpad setup blocker, then rerun Autopilot Master Loop.",
      deadline: "next heartbeat",
      ack: "done/blocker",
    },
  };
}

function nextJobsAction(jobsRoom = {}) {
  const next = jobsRoom.next || safeList(jobsRoom.todos)[0] || null;
  if (!next) return null;
  return {
    ok: true,
    action: "autopilot_master_loop",
    result: "dispatch_worker_packet",
    reason: next.reason || "jobs_room_actionable",
    jobs_room: jobsRoom,
    job_decision: next,
    packet: next.packet,
  };
}

function nextMergeAction({ pr, ackLedger, mergeRoom }) {
  const number = prNumber(pr);
  if (mergeRoom?.ok && ["ready_to_merge", "ready_to_lift_and_merge"].includes(mergeRoom.result)) {
    return {
      ok: true,
      action: "autopilot_master_loop",
      result: "merge_room_ready",
      reason: mergeRoom.result,
      pr_number: number,
      ack_ledger: ackLedger,
      merge_room: mergeRoom,
      packet: {
        worker: "master",
        chip: `Merge Room ready for PR #${number}`,
        context: `ACK Ledger is full-PASS and Merge Room returned ${mergeRoom.result}.`,
        expected_proof: "Lift draft if required, merge only if still CLEAN/green, then run post-merge watch.",
        deadline: "immediate",
        ack: "done/blocker",
      },
    };
  }

  if (ackLedger.result === "blocked") {
    return {
      ok: false,
      action: "autopilot_master_loop",
      result: "review_blocker",
      reason: "ack_ledger_blocked",
      pr_number: number,
      ack_ledger: ackLedger,
      packet: {
        worker: "forge",
        chip: `Fix latest review blocker for PR #${number}`,
        context: compactText(safeList(ackLedger.blockers).map((blocker) => blocker.excerpt).join("; ")),
        expected_proof: "Patch only the blocked surface and rerun focused proof.",
        deadline: "next builder pulse",
        ack: "done/blocker",
      },
    };
  }

  if (ackLedger.result === "missing_ack") {
    return {
      ok: true,
      action: "autopilot_master_loop",
      result: "ack_missing",
      reason: "ack_ledger_missing_required_review",
      pr_number: number,
      ack_ledger: ackLedger,
      packet: ackLedger.mirror_packet,
    };
  }

  return null;
}

export function evaluateAutopilotMasterLoop({
  launchpad = {},
  ledger,
  jobs,
  runner,
  prs = [],
  commentsByPr = {},
  fishbowlMessagesByPr = {},
  messagesByPr = {},
  reviewsByPr = {},
  proofJobsByPr = {},
  signals = [],
  requiredReviewers = ["gatekeeper", "popcorn", "forge"],
  now = new Date().toISOString(),
} = {}) {
  const launchpadRoom = evaluateLaunchpadRoom({ ...launchpad, now });
  if (!launchpadRoom.ok || launchpadRoom.result !== "ready") {
    return nextLaunchpadAction(launchpadRoom);
  }

  const improvement = evaluateContinuousImprovementRoom({ signals, now, source: "autopilot_master_loop" });
  if (improvement.result === "front_of_line_build") {
    return {
      ok: true,
      action: "autopilot_master_loop",
      result: "front_of_line_improvement",
      reason: improvement.reason,
      continuous_improvement: improvement,
      job: improvement.job,
      packet: improvement.packet,
    };
  }

  for (const pr of mergePrCandidates(prs)) {
    const number = prNumber(pr);
    const ackLedger = evaluateAckLedgerRoom({
      pr,
      comments: recordsForPr(commentsByPr, number),
      fishbowlMessages: recordsForPr(fishbowlMessagesByPr, number),
      messages: recordsForPr(messagesByPr, number),
      reviews: recordsForPr(reviewsByPr, number),
      requiredReviewers,
    });
    const syntheticReviews = syntheticReviewsFromAckLedger(ackLedger);
    const mergeRoom = evaluateMergeRoom({
      pr,
      ledger,
      proofJob: proofJobsByPr?.[number] || proofJobsByPr?.[String(number)] || undefined,
      reviews: syntheticReviews,
      requiredReviewers,
      fallbackEvidence: ackLedger.fallback_evidence,
    });
    const mergeAction = nextMergeAction({ pr, ackLedger, mergeRoom });
    if (mergeAction) return mergeAction;
  }

  const jobsRoom = evaluateJobsRoom({ ledger, jobs, runner, now });
  const jobsAction = nextJobsAction(jobsRoom);
  if (jobsAction) {
    return jobsAction;
  }

  return {
    ok: true,
    action: "autopilot_master_loop",
    result: "idle",
    reason: "no_safe_action",
    launchpad_room: launchpadRoom,
    jobs_room: jobsRoom,
  };
}

export async function readAutopilotMasterLoopInput(filePath) {
  if (!filePath) return { ok: false, reason: "missing_input_path" };
  return JSON.parse(await readFile(filePath, "utf8"));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  readAutopilotMasterLoopInput(getArg("input", process.env.PINBALLWAKE_AUTOPILOT_MASTER_LOOP_INPUT || ""))
    .then((input) => evaluateAutopilotMasterLoop(input))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

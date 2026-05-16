#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import { createCodingRoomJob } from "./pinballwake-coding-room.mjs";
import { commonSensePassSync } from "./pinballwake-commonsense-pass.mjs";
import { makePacket } from "./pinballwake-executor-packet.mjs";

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

function signalCoverage(signal = {}) {
  const candidates = [
    ["open_todo", signal.coveredByOpenTodo ?? signal.covered_by_open_todo],
    ["recent_proof", signal.coveredByRecentProof ?? signal.covered_by_recent_proof],
    ["active_claim", signal.coveredByActiveClaim ?? signal.covered_by_active_claim],
    ["covered", signal.coveredBy ?? signal.covered_by],
  ];
  for (const [kind, value] of candidates) {
    const ref = compactText(value, 180);
    if (ref) return { kind, ref };
  }
  return null;
}

function coverageReasonKey(coverage) {
  if (coverage?.kind === "open_todo") return "covered_by_open_todo";
  if (coverage?.kind === "recent_proof") return "covered_by_recent_proof";
  if (coverage?.kind === "active_claim") return "covered_by_active_claim";
  return "duplicate_covered";
}

function xpassAdvisoryFor(kind) {
  const advisory = ["CommonSensePass"];
  if (kind === "protected_surface_safeguard") advisory.push("SecurityPass");
  else if (kind === "proof_flow") advisory.push("ProofPass");
  else if (kind === "launchpad_routing") advisory.push("FlowPass");
  else if (kind === "merge_flow") advisory.push("MergePass");
  else advisory.push("QualityPass");
  return advisory;
}

function evidenceFor(top) {
  const signal = top.signal || {};
  const evidence = [`kind=${top.kind}`, `score=${top.score}`];
  const title = compactText(signal.title || signal.name, 180);
  const source = compactText(signal.source || signal.room || signal.channel, 120);
  const detail = compactText(signal.detail || signal.summary || signal.reason || signal.blocker || signal.text, 260);
  if (title) evidence.push(`title=${title}`);
  if (source) evidence.push(`source=${source}`);
  if (detail) evidence.push(`detail=${detail}`);
  return evidence;
}

function proofRequiredFor(tests = []) {
  const testText = tests.length ? tests.join("; ") : "the smallest focused check for the touched files";
  return `Patch, non-overlap note, Boardroom proof, and tests: ${testText}`;
}

function nativeImproverReceipt({ top, job, tests, now, source, commonsensepass }) {
  return {
    receipt_type: "native_improver_opportunity",
    emitted_at: now,
    source,
    commonsensepass,
    improvement_kind: top.kind,
    score: top.score,
    evidence: evidenceFor(top),
    next_action: `Build ${job.chip}: patch ${job.owned_files.join(", ")}`,
    proof_required: proofRequiredFor(tests),
    xpass_advisory: xpassAdvisoryFor(top.kind),
  };
}

function nativeImproverHoldReceipt({ top, now, source, commonsensepass }) {
  return {
    receipt_type: "native_improver_hold",
    emitted_at: now,
    source,
    commonsensepass,
    improvement_kind: top.kind,
    score: top.score,
    evidence: evidenceFor(top),
    next_action: "Do not create a duplicate build job; update the covered todo, proof, or active claim instead.",
    proof_required: "Boardroom proof of the covered item, or the exact missing receipt if coverage is stale.",
    xpass_advisory: xpassAdvisoryFor(top.kind),
  };
}

function signalText(signal = {}) {
  return [
    signal.type,
    signal.room,
    signal.source,
    signal.title,
    signal.summary,
    signal.detail,
    signal.reason,
    signal.blocker,
    signal.text,
  ]
    .filter(Boolean)
    .join(" ");
}

function severityRank(severity = "") {
  const value = normalize(severity);
  if (value === "critical") return 100;
  if (value === "high") return 80;
  if (value === "medium") return 55;
  if (value === "low") return 25;
  return 40;
}

function frictionScore(signal = {}) {
  const text = normalize(signalText(signal));
  let score = severityRank(signal.severity);
  const count = Number.isFinite(signal.count) ? signal.count : 1;
  score += Math.min(Math.max(count - 1, 0) * 12, 36);

  if (/(blocker|blocked|hold|failed|failure|error|unsafe|stale proof)/.test(text)) score += 25;
  if (/(stuck|resistance|manual|nudge|dormant|silent|no-op|idle|waiting|handoff|mirror|missing ack)/.test(text)) score += 18;
  if (/(merge|lift|draft|ack|review|qc|gatekeeper|popcorn|forge)/.test(text)) score += 10;
  if (/(security|secret|credential|token|payment|billing|auth|dns|migration|destructive)/.test(text)) score += 30;
  if (signal.resolved === true || /resolved|merged|fixed|closed/.test(text)) score -= 45;

  return Math.max(score, 0);
}

function classifyImprovement(signal = {}) {
  const text = normalize(signalText(signal));
  if (/(security|secret|credential|token|payment|billing|auth|dns|migration|destructive)/.test(text)) {
    return "protected_surface_safeguard";
  }
  if (/(ack|pass|blocker|review|gatekeeper|popcorn|forge|handoff|mirror)/.test(text)) {
    return "ack_handoff";
  }
  if (/(merge|lift|draft|ready|post-merge|publish)/.test(text)) {
    return "merge_flow";
  }
  if (/(launchpad|orchestrator|heartbeat|seat|account|capacity|usage|limit)/.test(text)) {
    return "launchpad_routing";
  }
  if (/(queue|job|claim|lease|stale|dormant|idle|waiting|nudge|runner)/.test(text)) {
    return "queue_flow";
  }
  if (/(proof|testpass|ci|vercel|build executor|proof executor|test)/.test(text)) {
    return "proof_flow";
  }
  return "general_improvement";
}

function ownedFilesFor(kind) {
  if (kind === "ack_handoff") {
    return [
      "scripts/pinballwake-ack-ledger-room.mjs",
      "scripts/pinballwake-ack-ledger-room.test.mjs",
      "scripts/pinballwake-merge-room.mjs",
      "scripts/pinballwake-merge-room.test.mjs",
    ];
  }
  if (kind === "merge_flow") {
    return [
      "scripts/pinballwake-merge-room.mjs",
      "scripts/pinballwake-merge-room.test.mjs",
      "scripts/pinballwake-merge-controller.mjs",
      "scripts/pinballwake-merge-controller.test.mjs",
      "scripts/pinballwake-pipeline-dry-run.mjs",
      "scripts/pinballwake-pipeline-dry-run.test.mjs",
    ];
  }
  if (kind === "launchpad_routing") {
    return [
      "scripts/pinballwake-launchpad-room.mjs",
      "scripts/pinballwake-launchpad-room.test.mjs",
      "scripts/pinballwake-jobs-room.mjs",
      "scripts/pinballwake-jobs-room.test.mjs",
    ];
  }
  if (kind === "queue_flow") {
    return [
      "scripts/pinballwake-jobs-room.mjs",
      "scripts/pinballwake-jobs-room.test.mjs",
      "scripts/pinballwake-queue-health-room.mjs",
      "scripts/pinballwake-queue-health-room.test.mjs",
      "scripts/pinballwake-stale-room.mjs",
      "scripts/pinballwake-stale-room.test.mjs",
    ];
  }
  if (kind === "proof_flow") {
    return [
      "scripts/pinballwake-proof-executor.mjs",
      "scripts/pinballwake-proof-executor.test.mjs",
      "scripts/pinballwake-build-executor.mjs",
      "scripts/pinballwake-build-executor.test.mjs",
    ];
  }
  if (kind === "protected_surface_safeguard") {
    return [
      "scripts/pinballwake-research-room.mjs",
      "scripts/pinballwake-research-room.test.mjs",
      "scripts/pinballwake-planning-room.mjs",
      "scripts/pinballwake-planning-room.test.mjs",
      "scripts/pinballwake-autopilot-triage.mjs",
      "scripts/pinballwake-autopilot-triage.test.mjs",
    ];
  }
  return [
    "scripts/pinballwake-continuous-improvement-room.mjs",
    "scripts/pinballwake-continuous-improvement-room.test.mjs",
  ];
}

function expectedTestsFor(files = []) {
  return files
    .filter((file) => file.endsWith(".test.mjs"))
    .map((file) => `node --test ${file}`);
}

function commonSenseVerdictFromResult(result = {}) {
  return {
    verdict: result.ok ? "PASS" : "HOLD",
    reason_code: result.reason || "commonsensepass_pass",
  };
}

function duplicateCoverageCommonSensePass(coverage) {
  return {
    verdict: "SUPPRESS",
    rule_id: "R3",
    reason_code: coverageReasonKey(coverage),
    evidence: [`${coverage.kind}=${coverage.ref}`],
  };
}

function buildCommonSensePacketForJob({ job, tests, now, source, signal = {} }) {
  const firstTest = tests[0] || "";
  return makePacket({
    packet_id: `continuous-qc:${job.job_id}`,
    emitted_at: now,
    heartbeat_tick_id: `continuous-qc:${source}:${now}`,
    requesting_seat_id: "unclick-heartbeat-seat",
    todo_id: job.job_id,
    intent: "modify",
    owned_files: job.owned_files,
    acceptance: firstTest
      ? {
          test_command: firstTest,
          expected_exit_code: 0,
          criteria: ["Continuous QC routed finding has owned files and focused proof."],
        }
      : {
          criteria: ["Continuous QC routed finding has owned files and focused proof."],
        },
    head_sha_at_request: signal.head_sha || signal.headSha || "continuous-qc-snapshot",
  });
}

function chipFor(kind, signal = {}) {
  const title = compactText(signal.title || signal.summary || signal.reason || signal.blocker || signalText(signal), 90);
  const prefix = {
    ack_handoff: "Improve ACK handoff",
    merge_flow: "Improve merge flow",
    launchpad_routing: "Improve Launchpad routing",
    queue_flow: "Improve queue flow",
    proof_flow: "Improve proof/build flow",
    protected_surface_safeguard: "Improve protected-surface safeguard",
    general_improvement: "Improve Autopilot friction",
  }[kind];
  return `${prefix}: ${title || "captured resistance"}`;
}

function shouldEscalate(score, signal = {}) {
  const text = normalize(signalText(signal));
  if (signal.escalate === true) return true;
  if (signal.resolved === true) return false;
  if (/(blocker|unsafe|security|secret|credential|token|payment|billing|auth|dns|migration|destructive)/.test(text)) {
    return score >= 55;
  }
  if (/(manual|nudge|dormant|stuck|resistance|handoff|missing ack|waiting)/.test(text)) {
    return score >= 65;
  }
  return score >= 80;
}

function topSignal(signals = []) {
  return safeList(signals)
    .map((signal, index) => ({
      signal,
      index,
      score: frictionScore(signal),
      kind: classifyImprovement(signal),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0] || null;
}

export function evaluateContinuousImprovementRoom({
  signals = [],
  now = new Date().toISOString(),
  source = "autopilot",
  worker = "forge",
} = {}) {
  const top = topSignal(signals);
  if (!top || !shouldEscalate(top.score, top.signal)) {
    return {
      ok: true,
      action: "continuous_improvement_room",
      result: "idle",
      reason: top ? "friction_below_build_threshold" : "no_signals",
      highest_score: top?.score ?? 0,
    };
  }

  const duplicateCoverage = signalCoverage(top.signal);
  if (duplicateCoverage) {
    const commonsensepass = duplicateCoverageCommonSensePass(duplicateCoverage);
    return {
      ok: true,
      action: "continuous_improvement_room",
      result: "hold",
      reason: coverageReasonKey(duplicateCoverage),
      highest_score: top.score,
      improvement_kind: top.kind,
      signal: top.signal,
      duplicate_coverage: duplicateCoverage,
      commonsensepass,
      receipt: nativeImproverHoldReceipt({ top, now, source, commonsensepass }),
    };
  }

  const files = ownedFilesFor(top.kind);
  const tests = expectedTestsFor(files);
  const signalSummary = compactText(signalText(top.signal), 500);
  const job = createCodingRoomJob({
    source: `continuous_improvement:${source}`,
    worker,
    chip: chipFor(top.kind, top.signal),
    context: `Continuous Improvement detected ${top.kind} friction at score ${top.score}. Signal: ${signalSummary}`,
    files,
    expectedProof: {
      tests,
      requiresPr: true,
      requiresChangedFiles: true,
      requiresNonOverlap: true,
      requiresTests: tests.length > 0,
    },
    createdAt: now,
  });
  const commonSensePacket = buildCommonSensePacketForJob({
    job,
    tests,
    now,
    source,
    signal: top.signal,
  });
  const commonSenseResult = commonSensePassSync({
    packet: commonSensePacket,
    now: new Date(now),
    heartbeat: {
      tickId: commonSensePacket.heartbeat_tick_id,
      emittedAt: now,
    },
  });
  const commonsensepass = {
    ...commonSenseVerdictFromResult(commonSenseResult),
    packet_id: commonSensePacket.packet_id,
  };

  if (!commonSenseResult.ok) {
    return {
      ok: true,
      action: "continuous_improvement_room",
      result: "hold",
      reason: "commonsensepass_hold",
      highest_score: top.score,
      improvement_kind: top.kind,
      signal: top.signal,
      commonsensepass,
      receipt: nativeImproverHoldReceipt({ top, now, source, commonsensepass }),
    };
  }

  const receipt = nativeImproverReceipt({ top, job, tests, now, source, commonsensepass });

  return {
    ok: true,
    action: "continuous_improvement_room",
    result: "front_of_line_build",
    reason: "resistance_promoted_to_build_job",
    priority: "front_of_line",
    improvement_kind: top.kind,
    score: top.score,
    signal: top.signal,
    commonsensepass,
    recommended_insertion: "prepend_to_coding_room_ledger",
    job,
    receipt,
    packet: {
      worker,
      chip: job.chip,
      context: job.context,
      owned_files: job.owned_files,
      evidence: receipt.evidence,
      next_action: receipt.next_action,
      proof_required: receipt.proof_required,
      xpass_advisory: receipt.xpass_advisory,
      commonsensepass,
      expected_proof: tests.length
        ? `Patch the smallest safe improvement and run: ${tests.join("; ")}`
        : "Patch the smallest safe improvement and run focused proof.",
      deadline: top.score >= 100 ? "immediate" : "next builder pulse",
      ack: "done/blocker",
    },
  };
}

export async function readContinuousImprovementRoomInput(filePath) {
  if (!filePath) return { ok: false, reason: "missing_input_path" };
  return JSON.parse(await readFile(filePath, "utf8"));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  readContinuousImprovementRoomInput(getArg("input", process.env.PINBALLWAKE_CONTINUOUS_IMPROVEMENT_INPUT || ""))
    .then((input) => evaluateContinuousImprovementRoom(input))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

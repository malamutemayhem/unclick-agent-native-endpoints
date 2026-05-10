#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import { evaluateAutoPilotKitLiveness } from "./lib/autopilotkit-liveness.mjs";

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function safeList(value) {
  return Array.isArray(value) ? value : [];
}

function firstArray(...values) {
  return values.find((value) => Array.isArray(value)) || [];
}

function livenessSnapshotFrom(input = {}) {
  const source = input.liveness || input.autopilotKit || input.autopilotkit_liveness || input.autopilotKitLiveness || {};
  const profiles = firstArray(
    source.profiles,
    source.worker_profiles,
    source.workerProfiles,
    input.livenessProfiles,
    input.worker_profiles,
    input.workerProfiles,
  );
  const messages = firstArray(
    source.messages,
    source.fishbowlMessages,
    source.fishbowl_messages,
    input.livenessMessages,
    input.liveness_messages,
  );

  if (profiles.length === 0 && messages.length === 0) return null;

  return {
    ...source,
    now: source.now || input.now,
    profiles,
    messages,
  };
}

function normalize(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function compactText(value, max = 700) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function parseNumber(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function prNumber(pr = {}) {
  return parseNumber(pr.number ?? pr.pr_number ?? pr.prNumber);
}

function recordText(record = {}) {
  return [
    record.title,
    record.body,
    record.message,
    record.text,
    record.summary,
    record.comment,
    record.content,
    record.worker,
    record.reviewer,
    record.lane,
    typeof record.author === "string" ? record.author : record.author?.login,
  ]
    .filter(Boolean)
    .join("\n");
}

function recordTimestamp(record = {}, index = 0) {
  const raw = record.created_at || record.createdAt || record.updated_at || record.updatedAt || record.timestamp || "";
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : index;
}

function recordSource(record = {}) {
  return record.source || record.kind || record.platform || "message";
}

function prNumbersFromText(text = "") {
  const found = new Set();
  for (const match of String(text).matchAll(/(?:#|pr\s*#?\s*)(\d{1,8})/gi)) {
    found.add(Number.parseInt(match[1], 10));
  }
  return found;
}

function recordPrNumbers(record = {}) {
  const found = prNumbersFromText(recordText(record));
  for (const key of ["pr_number", "prNumber", "pr", "number"]) {
    const parsed = parseNumber(record[key]);
    if (parsed) found.add(parsed);
  }
  return found;
}

function recordMentionsPr(record = {}, number) {
  if (!number) return false;
  return recordPrNumbers(record).has(number);
}

const REVIEWERS = {
  gatekeeper: ["gatekeeper", "release safety", "safety", "🛡️"],
  popcorn: ["popcorn", "qc", "quality", "🍿"],
  forge: ["forge", "implementation-shape", "implementation shape", "builder", "🛠️"],
};

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function aliasPattern(reviewer) {
  return REVIEWERS[reviewer].map(escapeRegExp).join("|");
}

function reviewerMentioned(text, reviewer) {
  const pattern = new RegExp(`(?:${aliasPattern(reviewer)})`, "i");
  return pattern.test(text);
}

function isClearPhrase(text, reviewer) {
  const alias = aliasPattern(reviewer);
  const clearWords = "(?:hold cleared|hold-clear|blocker fixed|blocker is fixed|no [\\w\\s-]{0,50}blocker remains|no remaining blocker|pass stands|ack:\\s*pass|\\bpass\\b)";
  const near = `(?:${alias})[\\s\\S]{0,100}${clearWords}`;
  const reverse = `${clearWords}[\\s\\S]{0,100}(?:${alias})`;
  return new RegExp(near, "i").test(text) || new RegExp(reverse, "i").test(text);
}

function isBlockingPhrase(text, reviewer) {
  const alias = aliasPattern(reviewer);
  const blockerWords = "(?:blocker\\s+(?:still\\s+)?(?:stands|remains)|hold\\s+(?:still\\s+)?(?:stands|remains)|\\bblocker\\b|\\bblocked\\b|\\bhold\\b|\\bfail(?:ed|ing|s)?\\b)";
  const near = `(?:${alias})[\\s\\S]{0,100}${blockerWords}`;
  const reverse = `${blockerWords}[\\s\\S]{0,100}(?:${alias})`;
  if (/(hold cleared|blocker fixed|no [\w\s-]{0,50}blocker remains|no remaining blocker)/i.test(text)) return false;
  return new RegExp(near, "i").test(text) || new RegExp(reverse, "i").test(text);
}

function reviewerVerdict(text, reviewer) {
  if (!reviewerMentioned(text, reviewer)) return null;

  if (isBlockingPhrase(text, reviewer)) {
    return "BLOCKER";
  }

  if (isClearPhrase(text, reviewer)) {
    return "PASS";
  }

  return null;
}

function normalizeReviewer(value = "") {
  const text = normalize(value);
  return Object.keys(REVIEWERS).find((reviewer) => reviewerMentioned(text, reviewer)) || "";
}

function trustedLaneAck(record = {}) {
  return record.trusted_lane_ack === true || record.trustedLaneAck === true;
}

function recordAuthorActor(record = {}) {
  return normalizeReviewer(
    [
      record.author_agent_id,
      record.authorAgentId,
      record.author_name,
      record.authorName,
      record.agent_id,
      record.agentId,
      typeof record.author === "string" ? record.author : record.author?.login,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function recordMetadataActor(record = {}) {
  return normalizeReviewer([record.reviewer, record.worker, record.lane].filter(Boolean).join(" "));
}

function isMirrorOrStatusText(record = {}, text = "") {
  const source = normalize(recordSource(record));
  const value = normalize(text);
  if (trustedLaneAck(record)) return false;
  if (/(mirror|summary|status|heartbeat|courier|master|handoff|routed|visible|fishbowl state|full ack trail|pass chain)/.test(value)) {
    return true;
  }
  return ["mirror", "status", "heartbeat", "courier", "master"].some((token) => source.includes(token));
}

function recordCanClaimReviewer(record = {}, text = "", reviewer = "") {
  if (trustedLaneAck(record)) return true;
  const actor = recordAuthorActor(record);
  if (actor && actor === reviewer) return true;
  if (isMirrorOrStatusText(record, text)) return false;
  return false;
}

function claimableRecordReviewer(record = {}, text = "") {
  if (trustedLaneAck(record)) return recordMetadataActor(record) || recordAuthorActor(record);
  return recordAuthorActor(record);
}

function explicitRecordVerdict(record = {}) {
  const raw = normalize(record.verdict || record.ack || record.result || record.status);
  if (!raw) return null;
  if (/\bpass\b/.test(raw)) return "PASS";
  if (/\b(blocker|blocked|hold|fail|failed)\b/.test(raw)) return "BLOCKER";
  return null;
}

function extractClaims(record = {}, prNumberValue, index = 0) {
  if (!recordMentionsPr(record, prNumberValue)) return [];

  const text = recordText(record);
  const explicitReviewer = claimableRecordReviewer(record, text);
  const explicitVerdict = explicitRecordVerdict(record);
  const reviewers = explicitReviewer ? [explicitReviewer] : Object.keys(REVIEWERS);
  const claims = [];

  for (const reviewer of reviewers) {
    if (!recordCanClaimReviewer(record, text, reviewer)) continue;
    const verdict = explicitVerdict && reviewerMentioned(text || reviewer, reviewer)
      ? explicitVerdict
      : reviewerVerdict(text, reviewer);
    if (!verdict) continue;
    claims.push({
      reviewer,
      verdict,
      pr_number: prNumberValue,
      source: recordSource(record),
      url: record.url || record.html_url || record.permalink || "",
      created_at: record.created_at || record.createdAt || record.timestamp || "",
      order: recordTimestamp(record, index),
      excerpt: compactText(text),
    });
  }

  return claims;
}

function latestClaimsByReviewer(claims = []) {
  const latest = {};
  for (const claim of claims) {
    const previous = latest[claim.reviewer];
    if (!previous || claim.order >= previous.order) {
      latest[claim.reviewer] = claim;
    }
  }
  return latest;
}

function reviewCoordinatorAdvisory(input = {}, output = {}) {
  const snapshot = livenessSnapshotFrom(input);
  if (!snapshot || output.result !== "missing_ack") return null;

  const liveness = evaluateAutoPilotKitLiveness(snapshot);
  const review = liveness.adapter_examples.review_coordinator;

  return {
    ...review,
    execute: false,
    source: "autopilotkit_liveness",
    ack_ledger_result: output.result,
    missing_reviewers: output.missing_reviewers,
    reason_codes: Array.from(new Set(["required_ack_missing", ...safeList(review.reason_codes)])).sort(),
    generated_at: liveness.generated_at,
    safe_mode: liveness.safe_mode,
  };
}

function withReviewAdvisory(output, advisory) {
  if (!advisory) return output;
  return {
    ...output,
    autopilotkit_review_advisory: advisory,
    autopilotkit_review_advice: advisory,
  };
}

export function evaluateAckLedgerRoom({
  pr,
  comments = [],
  fishbowlMessages = [],
  messages = [],
  reviews = [],
  requiredReviewers = ["gatekeeper", "popcorn", "forge"],
  autopilotKit = null,
  liveness,
  autopilotkit_liveness,
  autopilotKitLiveness,
  livenessProfiles,
  livenessMessages,
  worker_profiles,
  workerProfiles,
  liveness_messages,
  now,
} = {}) {
  const input = {
    autopilotKit,
    liveness,
    autopilotkit_liveness,
    autopilotKitLiveness,
    livenessProfiles,
    livenessMessages,
    worker_profiles,
    workerProfiles,
    liveness_messages,
    now,
  };
  const number = prNumber(pr);
  if (!number) {
    return {
      ok: false,
      action: "ack_ledger_room",
      result: "blocker",
      reason: "missing_pr_number",
    };
  }

  const required = safeList(requiredReviewers).map(normalize).filter(Boolean);
  const records = [...safeList(comments), ...safeList(fishbowlMessages), ...safeList(messages), ...safeList(reviews)];
  const claims = records.flatMap((record, index) => extractClaims(record, number, index));
  const latest_by_reviewer = latestClaimsByReviewer(claims);
  const blockers = required
    .map((reviewer) => latest_by_reviewer[reviewer])
    .filter((claim) => claim?.verdict === "BLOCKER");
  const missing_reviewers = required.filter((reviewer) => latest_by_reviewer[reviewer]?.verdict !== "PASS");
  const full_ack_set = blockers.length === 0 && missing_reviewers.length === 0;

  if (blockers.length > 0) {
    return {
      ok: false,
      action: "ack_ledger_room",
      result: "blocked",
      reason: "review_blocker_present",
      pr_number: number,
      required_reviewers: required,
      full_ack_set: false,
      blockers,
      missing_reviewers,
      latest_by_reviewer,
    };
  }

  if (!full_ack_set) {
    const output = {
      ok: true,
      action: "ack_ledger_room",
      result: "missing_ack",
      reason: "required_ack_missing",
      pr_number: number,
      required_reviewers: required,
      full_ack_set: false,
      missing_reviewers,
      latest_by_reviewer,
      mirror_packet: {
        worker: "courier",
        chip: `ACK mirror for PR #${number}`,
        context: `ACK Ledger is missing: ${missing_reviewers.join(", ")}.`,
        expected_proof: "Collect exact PASS/BLOCKER from the missing lane(s), scoped to this PR number.",
        deadline: "next heartbeat",
        ack: "done/blocker",
      },
    };
    const advisory = reviewCoordinatorAdvisory(input, output);
    return withReviewAdvisory(output, advisory);
  }

  return {
    ok: true,
    action: "ack_ledger_room",
    result: "full_pass",
    reason: "all_required_acks_present",
    pr_number: number,
    required_reviewers: required,
    full_ack_set: true,
    missing_reviewers: [],
    latest_by_reviewer,
    fallback_evidence: {
      full_ack_set: true,
      source: "ack_ledger_room",
      pr_number: number,
      reviewers: required,
    },
  };
}

export async function readAckLedgerRoomInput(filePath) {
  if (!filePath) return { ok: false, reason: "missing_input_path" };
  return JSON.parse(await readFile(filePath, "utf8"));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  readAckLedgerRoomInput(getArg("input", process.env.PINBALLWAKE_ACK_LEDGER_ROOM_INPUT || ""))
    .then((input) => evaluateAckLedgerRoom(input))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

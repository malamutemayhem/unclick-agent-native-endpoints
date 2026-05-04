#!/usr/bin/env node

import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const repository = process.env.GITHUB_REPOSITORY || "malamutemayhem/unclick-agent-native-endpoints";
const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
const githubToken = process.env.GITHUB_TOKEN || "";
const apiUrl = process.env.UNCLICK_API_URL || "https://unclick.world/api/memory-admin";
const unclickApiKey = process.env.FISHBOWL_WAKE_TOKEN || process.env.FISHBOWL_AUTOCLOSE_TOKEN || "";
const dryRun = parseBooleanFlag(process.env.QUEUEPUSH_DRY_RUN) || process.argv.includes("--dry-run");
const maxPackets = parseBoundedInt(process.env.QUEUEPUSH_MAX_PACKETS, 10, 1, 12);
const recentFishbowlLimit = parseBoundedInt(process.env.QUEUEPUSH_FISHBOWL_LIMIT, 100, 20, 100);
const agentId = "github-action-queuepush";
const agentEmoji = "📬";
const agentDisplayName = "QueuePush";
const agentMap = parseAgentMap(process.env.QUEUEPUSH_AGENT_MAP);

export const DEFAULT_QUEUEPUSH_RUNNERS = [
  {
    emoji: "🛠️",
    readiness: "builder_ready",
    capabilities: ["implementation", "owner_decision", "qc_review", "status_relay"],
    safeFor: ["wakepass", "pinballwake", "queuepush", "reliability"],
  },
  {
    emoji: "🧠",
    readiness: "builder_ready",
    capabilities: ["implementation", "owner_decision", "merge_proof", "status_relay"],
    safeFor: ["blocked_chris_only", "chris-only", "human policy", "merge", "master"],
  },
  {
    emoji: "🧪",
    readiness: "context_only",
    capabilities: ["owner_decision", "qc_review", "status_relay"],
    safeFor: ["rotatepass", "xpass", "system credentials", "systemcredential", "adminkeychain", "connectedservices"],
  },
  {
    emoji: "🍿",
    readiness: "review_only",
    capabilities: ["qc_review", "status_relay"],
    safeFor: ["ready_for_qc", "qc", "second-read", "proof review"],
  },
  {
    emoji: "📣",
    readiness: "context_only",
    capabilities: ["owner_decision", "status_relay"],
    safeFor: ["docs", "prd", "brief", "handoff", "status"],
  },
  {
    emoji: "🦾",
    readiness: "needs_probe",
    capabilities: ["implementation", "status_relay"],
    safeFor: ["small implementation", "docs"],
  },
];

const queuepushRunnerRoster = resolveQueuePushRunnerRoster(process.env.QUEUEPUSH_RUNNER_ROSTER);

const STATES = new Set([
  "draft_green_needs_owner_lift",
  "hold_overlap",
  "dirty_branch",
  "failed_targeted_proof",
  "ready_for_qc",
  "blocked_chris_only",
]);

function parseBooleanFlag(value) {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function parseBoundedInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function parseAgentMap(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, target]) => [key.trim(), String(target ?? "").trim()])
        .filter(([key, target]) => key && target),
    );
  } catch {
    return {};
  }
}

export function parseRunnerRoster(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((runner) => ({
        emoji: String(runner?.emoji || "").trim(),
        readiness: String(runner?.readiness || "").trim(),
        capabilities: Array.isArray(runner?.capabilities)
          ? runner.capabilities.map((capability) => String(capability).trim()).filter(Boolean)
          : [],
        safeFor: Array.isArray(runner?.safeFor)
          ? runner.safeFor.map((lane) => String(lane).trim()).filter(Boolean)
          : [],
      }))
      .filter((runner) => runner.emoji && runner.readiness && runner.capabilities.length > 0);
  } catch {
    return null;
  }
}

export function resolveQueuePushRunnerRoster(value, fallback = DEFAULT_QUEUEPUSH_RUNNERS) {
  const parsed = parseRunnerRoster(value);
  return parsed && parsed.length > 0 ? parsed : fallback;
}

function compactText(value, max = 240) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function sourceUrl(pr) {
  return pr.html_url || `${serverUrl}/${repository}/pull/${pr.number}`;
}

function shortSha(sha) {
  return String(sha || "").slice(0, 7);
}

export function queuepushPacketId(pr, state) {
  const sha = pr.head?.sha || pr.headRefOid || "unknown";
  const digest = createHash("sha256")
    .update(`${repository}|pinballwake-job-runner-v3|${pr.number}|${state}|${sha}`)
    .digest("hex")
    .slice(0, 10);
  return `queuepush:v3:pr-${pr.number}:${state}:${shortSha(sha)}:${digest}`;
}

export function checksAreGreen(checkRuns = [], statuses = []) {
  const visibleRuns = checkRuns.filter((run) => {
    const name = String(run.name || "");
    return !/^queuepush/i.test(name) && !/^fleet throughput/i.test(name);
  });
  const runResults = visibleRuns.map((run) => ({
    status: String(run.status || ""),
    conclusion: String(run.conclusion || ""),
  }));
  const statusResults = statuses.map((status) => String(status.state || ""));
  const hasSignal = runResults.length > 0 || statusResults.length > 0;
  if (!hasSignal) return false;
  const runsOk = runResults.every(
    (run) =>
      run.status === "completed" &&
      ["success", "neutral", "skipped"].includes(run.conclusion),
  );
  const statusesOk = statusResults.every((state) => state === "success");
  return runsOk && statusesOk;
}

export function latestCommentSignals(comments = []) {
  const sorted = [...comments].sort((a, b) =>
    String(a.created_at || "").localeCompare(String(b.created_at || "")),
  );
  let lastHold = -1;
  let lastPass = -1;
  let lastOverlap = -1;
  let lastFailedProof = -1;
  let lastDirtyBranch = -1;
  let hasChrisOnly = false;
  let hasProof = false;

  sorted.forEach((comment, index) => {
    const text = normalizeText(comment.body);
    const authorLogin = normalizeText(comment.user?.login || comment.author?.login);
    const clearPass =
      !["github-actions", "vercel"].includes(authorLogin) &&
      (/^(?:\W+\s*)?(pass|merge-ok|qc pass)\b/.test(text) ||
        /\b(safe next action|safe to merge)\b/.test(text)) &&
      !/\b(please keep draft|stay draft|do not merge|do not lift)\b/.test(text);
    if (clearPass) {
      lastPass = index;
      hasProof = true;
    }
    if (/\b(hold|do not merge|do not lift|blocker|blocked)\b/.test(text)) {
      lastHold = index;
    }
    if (/\b(overlap|anti-stomp|supersede|supersedes|rebase\/close|close one lane|same files)\b/.test(text)) {
      lastOverlap = index;
    }
    if (/\b(targeted proof|focused proof|exact test)\b/.test(text) && /\b(fail|failed|failing|red)\b/.test(text)) {
      lastFailedProof = index;
    }
    if (
      /\b(dirty branch|merge state dirty|mergestatestatus[:\s]+dirty|merge state is dirty|branch is dirty|branch is not clean|not clean against main|rebase\/update\/fix branch|rebase\/update\/rebuild)\b/.test(
        text,
      )
    ) {
      lastDirtyBranch = index;
    }
    if (/\b(chris-only|human decision|needs chris|user decision|refresh testpass_token|node 20 policy|semver-major policy)\b/.test(text)) {
      hasChrisOnly = true;
    }
  });

  return {
    hasActiveHold: lastHold > lastPass,
    hasOverlap: lastOverlap > lastPass,
    hasFailedProof: lastFailedProof > lastPass,
    hasDirtyBranch: lastDirtyBranch > lastPass,
    hasChrisOnly,
    hasProof,
  };
}

export function routeWorkerForPr(pr, files = [], state = "") {
  const haystack = normalizeText(
    [
      state,
      pr.title,
      pr.body,
      ...files.map((file) => file.filename || file.path || ""),
    ].join(" "),
  );
  const runner = chooseQueuePushRunner({
    kind: jobKindForState(state),
    lane: haystack,
    title: pr.title || `PR #${pr.number}`,
    requiresCode: stateRequiresCode(state),
  });
  return runner?.emoji || "📣";
}

export function jobKindForState(state) {
  switch (state) {
    case "dirty_branch":
    case "failed_targeted_proof":
      return "implementation";
    case "ready_for_qc":
      return "qc_review";
    case "blocked_chris_only":
    case "draft_green_needs_owner_lift":
    case "hold_overlap":
      return "owner_decision";
    default:
      return "status_relay";
  }
}

export function stateRequiresCode(state) {
  return jobKindForState(state) === "implementation";
}

export function runnerCanAcceptQueuePushJob(runner, job) {
  if (!runner?.capabilities?.includes(job.kind)) return false;
  if (runner.readiness === "offline") return false;
  if (job.requiresCode) {
    return runner.readiness === "builder_ready" || runner.readiness === "scoped_builder";
  }
  if (runner.readiness === "needs_probe") return job.kind === "status_relay";
  return true;
}

export function chooseQueuePushRunner(job, runners = queuepushRunnerRoster) {
  const lane = normalizeText([job.lane, job.title].join(" "));
  const candidates = runners.filter((runner) => runnerCanAcceptQueuePushJob(runner, job));
  const laneMatches = candidates.filter((runner) =>
    (runner.safeFor || []).some((safeLane) => lane.includes(normalizeText(safeLane))),
  );
  if (job.kind === "qc_review") {
    return (
      laneMatches.find((runner) => runner.readiness === "review_only") ||
      candidates.find((runner) => runner.readiness === "review_only") ||
      laneMatches[0] ||
      candidates[0]
    );
  }
  return laneMatches[0] || candidates[0];
}

function packetHeadingForJobKind(jobKind) {
  switch (jobKind) {
    case "implementation":
      return "DIRECT BUILD PACKET";
    case "qc_review":
      return "DIRECT QC PACKET";
    case "owner_decision":
      return "DIRECT DECISION PACKET";
    default:
      return "DIRECT STATUS PACKET";
  }
}

function packetInstructionForJobKind(jobKind) {
  switch (jobKind) {
    case "implementation":
      return "You are assigned this now. Build it or reply blocker; do not just observe.";
    case "qc_review":
      return "You are assigned QC now. Pass/block with evidence; do not rewrite the branch.";
    case "owner_decision":
      return "You are assigned the decision now. Decide, ACK, or reply blocker; do not start coding unless explicitly scoped.";
    default:
      return "You are assigned status follow-up now. ACK, route, or reply blocker.";
  }
}

export function classifyPullRequest(input) {
  const { pr, files = [], comments = [], reviews = [], checkRuns = [], statuses = [] } = input;
  const signals = latestCommentSignals([...comments, ...reviews.map((review) => ({ body: review.body, created_at: review.submitted_at }))]);
  const green = checksAreGreen(checkRuns, statuses);
  const mergeState = String(pr.mergeable_state || pr.mergeStateStatus || "").toLowerCase();
  const clean = ["clean", "has_hooks", "unstable"].includes(mergeState) || mergeState === "";
  const dirty = ["dirty", "behind"].includes(mergeState);

  if (signals.hasChrisOnly) return { state: "blocked_chris_only", reason: "Chris-only or human policy blocker is present." };
  if (dirty || signals.hasDirtyBranch) return { state: "dirty_branch", reason: "Branch is not clean against main." };
  if (signals.hasFailedProof) return { state: "failed_targeted_proof", reason: "Targeted proof was reported as failing." };
  if (signals.hasOverlap) return { state: "hold_overlap", reason: "Overlap or anti-stomp blocker is present." };
  if (pr.draft && green && clean) {
    return {
      state: "draft_green_needs_owner_lift",
      reason: "Draft PR is green and clean; owner should update proof and lift or explain HOLD.",
    };
  }
  if (!pr.draft && green && clean && signals.hasProof && !signals.hasActiveHold) {
    return { state: "ready_for_qc", reason: "Non-draft PR is green, clean, and has proof." };
  }
  if (signals.hasActiveHold) return { state: "blocked_chris_only", reason: "Active HOLD/blocker comment remains." };
  return { state: null, reason: "No QueuePush action needed." };
}

export function expectedProofForState(state, pr) {
  switch (state) {
    case "draft_green_needs_owner_lift":
      return "Update PR body with owner/non-overlap/status/tests, then lift draft or state exact HOLD.";
    case "hold_overlap":
      return "Decide supersede/rebase/close one overlapping lane; post exact non-overlap proof.";
    case "dirty_branch":
      return "Rebase/update/rebuild until merge state is clean, or close and replace; do not force-push another worker branch.";
    case "failed_targeted_proof":
      return "Fix the failing targeted proof or close the stale branch; rerun the named focused test.";
    case "ready_for_qc":
      return "Second-read changed files, confirm checks/proof/non-overlap, then hand to merge lane if safe.";
    case "blocked_chris_only":
      return "Call the exact human decision; do not code around it.";
    default:
      return `Inspect PR #${pr.number} and report done/blocker.`;
  }
}

export function directActionForState(state) {
  switch (state) {
    case "draft_green_needs_owner_lift":
      return "Claim it, refresh proof, then lift draft or reply with the exact HOLD.";
    case "hold_overlap":
      return "Claim it, decide which lane survives, then rebase/supersede/close one lane.";
    case "dirty_branch":
      return "Claim it, update/rebuild until clean, or close and replace the stale branch.";
    case "failed_targeted_proof":
      return "Claim it, fix the failing proof, rerun the named test, or close the stale branch.";
    case "ready_for_qc":
      return "Claim it, second-read the diff, then pass/block with exact evidence.";
    case "blocked_chris_only":
      return "Call the exact Chris decision needed; do not code around it.";
    default:
      return "Claim it, inspect the PR, and reply done/blocker.";
  }
}

function allowedFilesText(files = []) {
  const names = files
    .map((file) => file.filename || file.path)
    .filter(Boolean);
  if (names.length === 0) return "PR changed files only";
  const preview = names.slice(0, 5).join(", ");
  return names.length > 5 ? `${preview}, +${names.length - 5} more` : preview;
}

export function buildQueuePacket(input) {
  const { pr, state, reason, files = [] } = input;
  if (!STATES.has(state)) throw new Error(`Unknown QueuePush state: ${state}`);
  const worker = routeWorkerForPr(pr, files, state);
  const packetId = queuepushPacketId(pr, state);
  const jobKind = jobKindForState(state);
  const chip = `PR #${pr.number} ${state}`;
  const filePreview = files
    .slice(0, 4)
    .map((file) => file.filename || file.path)
    .filter(Boolean)
    .join(", ");
  const context = compactText(
    `${pr.title || "Untitled PR"}; ${reason}${filePreview ? `; files: ${filePreview}` : ""}`,
    360,
  );
  const expectedProof = expectedProofForState(state, pr);
  const directAction = directActionForState(state);
  const text = [
    `QueuePush ID: ${packetId}`,
    packetHeadingForJobKind(jobKind),
    packetInstructionForJobKind(jobKind),
    `worker: ${worker}`,
    `job kind: ${jobKind}`,
    `requires code: ${stateRequiresCode(state) ? "yes" : "no"}`,
    `chip: ${chip}`,
    `context: ${context}`,
    `allowed files: ${allowedFilesText(files)}`,
    `do: ${directAction}`,
    `expected proof: ${expectedProof}`,
    "deadline: next worker pulse",
    "fallback: if not ACKed after two pulses, Master/Courier may reroute.",
    "ack: done/blocker",
    `source: ${sourceUrl(pr)}`,
  ].join("\n");

  return {
    packetId,
    worker,
    jobKind,
    requiresCode: stateRequiresCode(state),
    recipient: agentMap[worker] || worker,
    state,
    pr: pr.number,
    text,
    sourceUrl: sourceUrl(pr),
  };
}

export function filterDuplicatePackets(packets, fishbowlMessages = []) {
  const recentText = fishbowlMessages.map((message) => String(message.text || "")).join("\n");
  return packets.filter((packet) => !recentText.includes(packet.packetId));
}

async function githubJson(path) {
  const url = path.startsWith("http") ? path : `https://api.github.com${path}`;
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "unclick-queuepush",
  };
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`;
  const response = await fetch(url, { headers });
  const body = await response.text();
  if (!response.ok) throw new Error(`GitHub HTTP ${response.status} for ${url}: ${compactText(body, 500)}`);
  return body ? JSON.parse(body) : null;
}

async function fetchOpenPrInputs() {
  const prs = await githubJson(`/repos/${repository}/pulls?state=open&per_page=50&sort=updated&direction=desc`);
  const inputs = [];
  for (const prLite of prs || []) {
    const number = prLite.number;
    const [pr, files, comments, reviews, checks, combinedStatus] = await Promise.all([
      githubJson(`/repos/${repository}/pulls/${number}`),
      githubJson(`/repos/${repository}/pulls/${number}/files?per_page=100`),
      githubJson(`/repos/${repository}/issues/${number}/comments?per_page=100`),
      githubJson(`/repos/${repository}/pulls/${number}/reviews?per_page=100`),
      githubJson(`/repos/${repository}/commits/${prLite.head.sha}/check-runs?per_page=100`),
      githubJson(`/repos/${repository}/commits/${prLite.head.sha}/status`),
    ]);
    inputs.push({
      pr,
      files: files || [],
      comments: comments || [],
      reviews: reviews || [],
      checkRuns: checks?.check_runs || [],
      statuses: combinedStatus?.statuses || [],
    });
  }
  return inputs;
}

async function postMemoryAdmin(action, body) {
  if (!unclickApiKey) {
    throw new Error("FISHBOWL_WAKE_TOKEN or FISHBOWL_AUTOCLOSE_TOKEN is required.");
  }
  const response = await fetch(`${apiUrl}?action=${action}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${unclickApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${action} HTTP ${response.status}: ${compactText(text, 500)}`);
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

async function ensureFishbowlProfile() {
  return postMemoryAdmin("fishbowl_set_emoji", {
    agent_id: agentId,
    emoji: agentEmoji,
    display_name: agentDisplayName,
    user_agent_hint: "github-action",
  });
}

async function readRecentFishbowl() {
  const result = await postMemoryAdmin("fishbowl_read", {
    agent_id: agentId,
    limit: recentFishbowlLimit,
  });
  return result.messages || [];
}

async function postQueuePacket(packet) {
  return postMemoryAdmin("fishbowl_post", {
    agent_id: agentId,
    recipients: [packet.recipient],
    tags: ["needs-doing", "queuepush"],
    text: packet.text,
  });
}

function summarizePackets(packets) {
  if (packets.length === 0) return "QueuePush: no actionable packets.";
  return packets
    .map((packet) => `#${packet.pr} ${packet.state} -> ${packet.recipient} (${packet.packetId})`)
    .join("\n");
}

export async function buildPacketsFromInputs(inputs) {
  const packets = [];
  for (const input of inputs) {
    const decision = classifyPullRequest(input);
    if (!decision.state) continue;
    packets.push(
      buildQueuePacket({
        pr: input.pr,
        state: decision.state,
        reason: decision.reason,
        files: input.files,
      }),
    );
  }
  return prioritizePackets(packets);
}

function prioritizePackets(packets) {
  const priority = {
    dirty_branch: 0,
    hold_overlap: 1,
    failed_targeted_proof: 2,
    blocked_chris_only: 3,
    ready_for_qc: 4,
    draft_green_needs_owner_lift: 5,
  };
  return [...packets].sort((a, b) => {
    const stateDiff = (priority[a.state] ?? 99) - (priority[b.state] ?? 99);
    if (stateDiff !== 0) return stateDiff;
    return Number(b.pr) - Number(a.pr);
  });
}

export async function main() {
  const inputs = await fetchOpenPrInputs();
  const rawPackets = await buildPacketsFromInputs(inputs);
  const boundedPackets = rawPackets.slice(0, maxPackets);

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dry_run: true,
          repository,
          packets: boundedPackets,
          summary: summarizePackets(boundedPackets),
        },
        null,
        2,
      ),
    );
    return { posted: 0, dryRun: true, packets: boundedPackets };
  }

  if (boundedPackets.length === 0) {
    console.log("QueuePush found no actionable PR packets.");
    return { posted: 0, dryRun: false, packets: [] };
  }

  await ensureFishbowlProfile();
  const recentMessages = await readRecentFishbowl();
  const packets = filterDuplicatePackets(boundedPackets, recentMessages);
  if (packets.length === 0) {
    console.log("QueuePush packets already posted for current PR states.");
    return { posted: 0, dryRun: false, packets: [] };
  }

  const posted = [];
  for (const packet of packets) {
    const result = await postQueuePacket(packet);
    posted.push({ packet, result });
    console.log(`Posted QueuePush packet ${packet.packetId} to ${packet.recipient}`);
  }
  return { posted: posted.length, dryRun: false, packets };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}

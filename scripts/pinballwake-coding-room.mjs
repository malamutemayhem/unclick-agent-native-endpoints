import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const CODING_ROOM_STATUSES = new Set([
  "queued",
  "claimed",
  "building",
  "testing",
  "blocked",
  "review_stale",
  "fallback_ready",
  "proof_submitted",
  "done",
  "expired",
]);

export const CODING_ROOM_CODE_CAPABILITIES = new Set(["implementation", "test_fix", "docs_update"]);
export const CODING_ROOM_REVIEW_CAPABILITIES = new Set(["qc_review", "release_safety", "merge_proof"]);
export const CODING_ROOM_BUILDER_READINESS = new Set(["builder_ready", "scoped_builder"]);
export const CODING_ROOM_REVIEW_READINESS = new Set(["review_only", "context_only", "builder_ready", "scoped_builder"]);
export const CODING_ROOM_REVIEW_ACK_RESULTS = new Set(["pass", "blocker"]);

const DEFAULT_LEASE_SECONDS = 1800;
const DEFAULT_REVIEW_TIMEOUT_SECONDS = 900;
const CODING_ROOM_LEDGER_VERSION = 1;

function compactText(value, max = 240) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function normalizePath(value) {
  return String(value ?? "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .trim();
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseIso(value) {
  const ms = Date.parse(String(value ?? ""));
  return Number.isFinite(ms) ? ms : null;
}

function addSeconds(iso, seconds) {
  const base = parseIso(iso) ?? Date.now();
  return new Date(base + seconds * 1000).toISOString();
}

function isActiveClaimStatus(status) {
  return ["claimed", "building", "testing"].includes(status);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeWorkerToken(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function codingRoomJobId({ source = "manual", prNumber = "none", chip = "", worker = "" }) {
  const digest = createHash("sha256")
    .update([source, prNumber, chip, worker].map((part) => String(part ?? "").trim()).join("|"))
    .digest("hex")
    .slice(0, 16);
  return `coding-room:${prNumber}:${digest}`;
}

export function codingRoomClaimId({ jobId = "", runnerId = "", now = new Date().toISOString() }) {
  const digest = createHash("sha256")
    .update([jobId, runnerId, now].map((part) => String(part ?? "").trim()).join("|"))
    .digest("hex")
    .slice(0, 16);
  return `coding-room-claim:${digest}`;
}

export function createCodingRoomJob(input = {}) {
  const ownedFiles = uniq((input.ownedFiles || input.files || []).map(normalizePath));
  const expectedProof = input.expectedProof || {};
  const status = input.status || "queued";

  if (!CODING_ROOM_STATUSES.has(status)) {
    throw new Error(`Unsupported coding room status: ${status}`);
  }

  return {
    job_id:
      input.jobId ||
      codingRoomJobId({
        source: input.source,
        prNumber: input.prNumber,
        chip: input.chip,
        worker: input.worker,
      }),
    source: compactText(input.source || "manual", 80),
    pr_number: input.prNumber ?? null,
    worker: compactText(input.worker || "", 80),
    chip: compactText(input.chip || "", 180),
    context: compactText(input.context || "", 500),
    job_type: input.jobType || "code",
    status,
    owned_files: ownedFiles,
    expected_proof: {
      tests: Array.isArray(expectedProof.tests) ? expectedProof.tests.map(compactText).filter(Boolean) : [],
      requires_pr: expectedProof.requiresPr !== false,
      requires_changed_files: expectedProof.requiresChangedFiles !== false,
      requires_non_overlap: expectedProof.requiresNonOverlap !== false,
      requires_tests: expectedProof.requiresTests !== false,
    },
    safety: {
      no_secrets: true,
      draft_pr_only: true,
      no_force_push: true,
      no_destructive_cleanup: true,
      no_migrations: true,
      no_auth_billing_dns: true,
    },
    created_at: input.createdAt || new Date().toISOString(),
    lease_expires_at: input.leaseExpiresAt || null,
    claimed_by: input.claimedBy || null,
    proof: input.proof || null,
  };
}

export function createCodingRoomReviewJob(input = {}) {
  const createdAt = input.createdAt || new Date().toISOString();
  const timeoutSeconds = Number.isFinite(input.timeoutSeconds)
    ? input.timeoutSeconds
    : DEFAULT_REVIEW_TIMEOUT_SECONDS;
  const job = createCodingRoomJob({
    ...input,
    jobType: "review",
    ownedFiles: [],
    expectedProof: {
      requiresPr: false,
      requiresChangedFiles: false,
      requiresNonOverlap: false,
      requiresTests: false,
      tests: [],
      ...input.expectedProof,
    },
    createdAt,
    leaseExpiresAt: input.leaseExpiresAt || addSeconds(createdAt, timeoutSeconds),
  });

  return {
    ...job,
    review_kind: compactText(input.reviewKind || "qc_review", 80),
    requested_reviewers: uniq((input.requestedReviewers || []).map((reviewer) => compactText(reviewer, 80))),
    fallback_worker: compactText(input.fallbackWorker || "master", 80),
    ack_deadline_at: input.ackDeadlineAt || addSeconds(createdAt, timeoutSeconds),
    expected_ack: "PASS/BLOCKER",
    review_contract: input.reviewContract || input.review_contract || {
      answer: "PASS/BLOCKER",
      checklist: [],
    },
  };
}

export function createCodingRoomQcJob(input = {}) {
  return createCodingRoomReviewJob({
    ...input,
    worker: input.worker || "popcorn",
    chip: input.chip || `QC review for PR #${input.prNumber ?? "unknown"}`,
    reviewKind: "qc_review",
    requestedReviewers: input.requestedReviewers || ["popcorn"],
    review_contract: {
      answer: "PASS/BLOCKER",
      checklist: [
        "PR body matches current code and scope",
        "listed tests/checks are green",
        "proof is current, not stale comments",
        "no obvious regression or missing owner proof",
      ],
    },
  });
}

export function createCodingRoomSafetyJob(input = {}) {
  return createCodingRoomReviewJob({
    ...input,
    worker: input.worker || "gatekeeper",
    chip: input.chip || `Safety review for PR #${input.prNumber ?? "unknown"}`,
    reviewKind: "release_safety",
    requestedReviewers: input.requestedReviewers || ["gatekeeper"],
    review_contract: {
      answer: "PASS/BLOCKER",
      checklist: [
        "no secrets, raw keys, auth, billing, DNS, or migrations",
        "no destructive cleanup or force-push behavior",
        "no draft, HOLD, or DIRTY merge risk",
        "automation behavior is advisory unless explicitly approved",
      ],
    },
  });
}

export function createCodingRoomPrReviewJobs(input = {}) {
  return [
    createCodingRoomSafetyJob(input),
    createCodingRoomQcJob(input),
  ];
}

export function runnerCanClaimCodingRoomJob({ runner = {}, job, activeJobs = [] }) {
  if (!job) {
    return { ok: false, reason: "missing_job" };
  }

  if (job.status !== "queued") {
    return { ok: false, reason: "job_not_queued" };
  }

  if (job.job_type === "review") {
    const readiness = String(runner.readiness || "").trim();
    if (!CODING_ROOM_REVIEW_READINESS.has(readiness)) {
      return { ok: false, reason: "runner_not_review_ready" };
    }

    const capabilities = new Set(
      Array.isArray(runner.capabilities) ? runner.capabilities.map((capability) => String(capability).trim()) : [],
    );
    const reviewKind = String(job.review_kind || "").trim();
    if (reviewKind && CODING_ROOM_REVIEW_CAPABILITIES.has(reviewKind) && !capabilities.has(reviewKind)) {
      return { ok: false, reason: "runner_lacks_review_kind_capability", review_kind: reviewKind };
    }

    if (!reviewKind && ![...CODING_ROOM_REVIEW_CAPABILITIES].some((capability) => capabilities.has(capability))) {
      return { ok: false, reason: "runner_lacks_review_capability" };
    }

    const requestedReviewers = new Set(
      (job.requested_reviewers || []).map(normalizeWorkerToken).filter(Boolean),
    );
    if (requestedReviewers.size > 0) {
      const runnerTokens = [
        runner.id,
        runner.emoji,
        runner.agent_id,
        runner.name,
      ].map(normalizeWorkerToken).filter(Boolean);
      const matchesRequestedReviewer = runnerTokens.some((token) => requestedReviewers.has(token));
      if (!matchesRequestedReviewer) {
        return { ok: false, reason: "runner_not_requested_reviewer" };
      }
    }

    return { ok: true, reason: "claimable_review" };
  }

  const readiness = String(runner.readiness || "").trim();
  if (!CODING_ROOM_BUILDER_READINESS.has(readiness)) {
    return { ok: false, reason: "runner_not_builder_ready" };
  }

  const capabilities = new Set(
    Array.isArray(runner.capabilities) ? runner.capabilities.map((capability) => String(capability).trim()) : [],
  );
  const canCode = [...CODING_ROOM_CODE_CAPABILITIES].some((capability) => capabilities.has(capability));
  if (!canCode) {
    return { ok: false, reason: "runner_lacks_code_capability" };
  }

  if (job.expected_proof?.requires_non_overlap !== false) {
    const owned = new Set(job.owned_files || []);
    const overlap = activeJobs
      .filter((active) => isActiveClaimStatus(active.status) && active.job_id !== job.job_id)
      .flatMap((active) => active.owned_files || [])
      .find((file) => owned.has(file));

    if (overlap) {
      return { ok: false, reason: "owned_file_overlap", file: overlap };
    }
  }

  if ((job.owned_files || []).length === 0) {
    return { ok: false, reason: "missing_owned_files" };
  }

  return { ok: true, reason: "claimable" };
}

export function claimCodingRoomJob({ runner = {}, job, activeJobs = [], now = new Date().toISOString(), leaseSeconds }) {
  const decision = runnerCanClaimCodingRoomJob({ runner, job, activeJobs });
  if (!decision.ok) {
    return { ok: false, reason: decision.reason, file: decision.file };
  }

  return {
    ok: true,
    job: {
      ...job,
      status: "claimed",
      claimed_by: String(runner.id || runner.emoji || "").trim(),
      claim_id: codingRoomClaimId({
        jobId: job.job_id,
        runnerId: String(runner.id || runner.emoji || "").trim(),
        now,
      }),
      claimed_at: now,
      lease_expires_at: addSeconds(now, Number.isFinite(leaseSeconds) ? leaseSeconds : DEFAULT_LEASE_SECONDS),
    },
  };
}

export function createCodingRoomJobLedger(input = {}) {
  const jobs = Array.isArray(input.jobs) ? input.jobs.map((job) => cloneJson(job)) : [];
  return {
    version: CODING_ROOM_LEDGER_VERSION,
    updated_at: input.updatedAt || new Date().toISOString(),
    jobs,
  };
}

export function listCodingRoomJobs({ ledger, statuses, worker, jobType } = {}) {
  const statusSet = statuses ? new Set(Array.isArray(statuses) ? statuses : [statuses]) : null;
  const wantedWorker = worker ? String(worker).trim() : "";
  const wantedJobType = jobType ? String(jobType).trim() : "";

  return (ledger?.jobs || []).filter((job) => {
    if (statusSet && !statusSet.has(job.status)) {
      return false;
    }

    if (wantedWorker && job.worker !== wantedWorker) {
      return false;
    }

    if (wantedJobType && job.job_type !== wantedJobType) {
      return false;
    }

    return true;
  });
}

export function upsertCodingRoomJob({ ledger, job, now = new Date().toISOString() }) {
  if (!job?.job_id) {
    return { ok: false, reason: "missing_job_id" };
  }

  const next = createCodingRoomJobLedger({
    jobs: ledger?.jobs || [],
    updatedAt: now,
  });
  const index = next.jobs.findIndex((existing) => existing.job_id === job.job_id);
  const stored = cloneJson(job);

  if (index === -1) {
    next.jobs.push(stored);
    return { ok: true, action: "inserted", ledger: next, job: stored };
  }

  next.jobs[index] = {
    ...next.jobs[index],
    ...stored,
    created_at: next.jobs[index].created_at || stored.created_at,
  };
  return { ok: true, action: "updated", ledger: next, job: next.jobs[index] };
}

export function claimCodingRoomLedgerJob({
  ledger,
  jobId,
  runner = {},
  now = new Date().toISOString(),
  leaseSeconds,
} = {}) {
  const next = createCodingRoomJobLedger({
    jobs: ledger?.jobs || [],
    updatedAt: now,
  });
  const index = next.jobs.findIndex((job) => job.job_id === jobId);

  if (index === -1) {
    return { ok: false, reason: "missing_job" };
  }

  const result = claimCodingRoomJob({
    runner,
    job: next.jobs[index],
    activeJobs: next.jobs,
    now,
    leaseSeconds,
  });

  if (!result.ok) {
    return result;
  }

  next.jobs[index] = result.job;
  return {
    ok: true,
    ledger: next,
    job: result.job,
    claim: {
      claim_id: result.job.claim_id,
      job_id: result.job.job_id,
      runner_id: result.job.claimed_by,
      claimed_at: result.job.claimed_at,
      lease_expires_at: result.job.lease_expires_at,
      owned_files: result.job.owned_files || [],
      status: result.job.status,
    },
  };
}

export function reclaimExpiredCodingRoomJobs({ ledger, now = new Date().toISOString() } = {}) {
  const current = parseIso(now);
  if (current === null) {
    return { ok: false, reason: "invalid_now" };
  }

  let reclaimed = 0;
  const next = createCodingRoomJobLedger({
    jobs: (ledger?.jobs || []).map((job) => {
      if (!isActiveClaimStatus(job.status)) {
        return job;
      }

      const expiresAt = parseIso(job.lease_expires_at);
      if (expiresAt === null || current <= expiresAt) {
        return job;
      }

      reclaimed += 1;
      return {
        ...job,
        status: "queued",
        claimed_by: null,
        claim_id: null,
        claimed_at: null,
        lease_expires_at: null,
        previous_claims: [
          ...(job.previous_claims || []),
          {
            claim_id: job.claim_id || null,
            runner_id: job.claimed_by || null,
            claimed_at: job.claimed_at || null,
            lease_expires_at: job.lease_expires_at || null,
            reclaimed_at: now,
            reason: "lease_expired",
          },
        ],
      };
    }),
    updatedAt: now,
  });

  return { ok: true, reclaimed, ledger: next };
}

export function serializeCodingRoomJobLedger(ledger) {
  return `${JSON.stringify(createCodingRoomJobLedger({ jobs: ledger?.jobs || [], updatedAt: ledger?.updated_at }), null, 2)}\n`;
}

export function parseCodingRoomJobLedger(text) {
  if (!String(text || "").trim()) {
    return createCodingRoomJobLedger();
  }

  const parsed = JSON.parse(text);
  return createCodingRoomJobLedger({
    jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
    updatedAt: parsed.updated_at,
  });
}

export async function readCodingRoomJobLedger(filePath) {
  try {
    return parseCodingRoomJobLedger(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return createCodingRoomJobLedger();
    }

    throw error;
  }
}

export async function writeCodingRoomJobLedger(filePath, ledger) {
  await mkdir(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tempPath, serializeCodingRoomJobLedger(ledger), "utf8");
  await rename(tempPath, filePath);
}

export function validateCodingRoomProof({ job, proof = {} }) {
  if (!job) {
    return { ok: false, reason: "missing_job" };
  }

  const result = String(proof.result || "").trim();
  if (!["done", "blocker"].includes(result)) {
    return { ok: false, reason: "proof_result_required" };
  }

  if (result === "blocker") {
    return proof.blocker
      ? { ok: true, status: "blocked" }
      : { ok: false, reason: "blocker_text_required" };
  }

  const changedFiles = uniq((proof.changedFiles || []).map(normalizePath));
  if (job.expected_proof?.requires_changed_files !== false && changedFiles.length === 0) {
    return { ok: false, reason: "changed_files_required" };
  }

  const owned = new Set(job.owned_files || []);
  const outside = changedFiles.find((file) => !owned.has(file));
  if (outside) {
    return { ok: false, reason: "changed_file_outside_ownership", file: outside };
  }

  if (job.expected_proof?.requires_pr !== false && !proof.prUrl) {
    return { ok: false, reason: "pr_url_required" };
  }

  const tests = Array.isArray(proof.tests) ? proof.tests : [];
  if (job.expected_proof?.requires_tests !== false && tests.length === 0) {
    return { ok: false, reason: "test_proof_required" };
  }

  const failed = tests.find((test) => String(test.status || "").trim() !== "passed");
  if (failed) {
    return { ok: false, reason: "test_not_passed", test: failed.command || "unknown" };
  }

  return { ok: true, status: "proof_submitted" };
}

export function reviewJobNeedsFallback({ job, now = new Date().toISOString() }) {
  if (!job || job.job_type !== "review") {
    return { ok: false, reason: "not_review_job" };
  }

  if (job.proof?.result) {
    return { ok: false, reason: "review_already_answered" };
  }

  if (!["queued", "claimed"].includes(job.status)) {
    return { ok: false, reason: "review_not_waiting" };
  }

  const deadline = parseIso(job.ack_deadline_at);
  const current = parseIso(now);
  if (deadline === null || current === null) {
    return { ok: false, reason: "invalid_review_deadline" };
  }

  if (current <= deadline) {
    return { ok: false, reason: "review_deadline_open" };
  }

  return {
    ok: true,
    reason: "review_ack_timeout",
    fallback_worker: job.fallback_worker || "master",
  };
}

export function markReviewFallbackReady({ job, now = new Date().toISOString() }) {
  const fallback = reviewJobNeedsFallback({ job, now });
  if (!fallback.ok) {
    return fallback;
  }

  return {
    ok: true,
    job: {
      ...job,
      status: "fallback_ready",
      fallback_reason: fallback.reason,
      fallback_worker: fallback.fallback_worker,
      fallback_ready_at: now,
    },
  };
}

export function validateCodingRoomReviewAck({ job, ack = {} }) {
  if (!job || job.job_type !== "review") {
    return { ok: false, reason: "not_review_job" };
  }

  const result = String(ack.result || "").trim().toLowerCase();
  if (!CODING_ROOM_REVIEW_ACK_RESULTS.has(result)) {
    return { ok: false, reason: "review_ack_result_required" };
  }

  if (result === "blocker" && !String(ack.blocker || "").trim()) {
    return { ok: false, reason: "blocker_text_required" };
  }

  if (result === "pass" && !String(ack.summary || "").trim()) {
    return { ok: false, reason: "pass_summary_required" };
  }

  return {
    ok: true,
    status: result === "pass" ? "done" : "blocked",
  };
}

export function submitCodingRoomReviewAck({ job, ack = {}, now = new Date().toISOString() }) {
  const validation = validateCodingRoomReviewAck({ job, ack });
  if (!validation.ok) {
    return validation;
  }

  const result = String(ack.result).trim().toLowerCase();
  return {
    ok: true,
    job: {
      ...job,
      status: validation.status,
      proof: {
        result,
        ack: result === "pass" ? "PASS" : "BLOCKER",
        reviewer: compactText(ack.reviewer || job.claimed_by || job.worker || "", 80),
        summary: compactText(ack.summary || "", 500),
        blocker: compactText(ack.blocker || "", 500) || null,
        checked_items: Array.isArray(ack.checkedItems) ? ack.checkedItems.map((item) => compactText(item, 160)) : [],
        submitted_at: now,
      },
    },
  };
}

export function submitCodingRoomLedgerReviewAck({ ledger, jobId, ack = {}, now = new Date().toISOString() } = {}) {
  const next = createCodingRoomJobLedger({
    jobs: ledger?.jobs || [],
    updatedAt: now,
  });
  const index = next.jobs.findIndex((job) => job.job_id === jobId);

  if (index === -1) {
    return { ok: false, reason: "missing_job" };
  }

  const result = submitCodingRoomReviewAck({
    job: next.jobs[index],
    ack,
    now,
  });

  if (!result.ok) {
    return result;
  }

  next.jobs[index] = result.job;
  return {
    ok: true,
    ledger: next,
    job: result.job,
  };
}

export function submitCodingRoomProof({ job, proof = {} }) {
  const validation = validateCodingRoomProof({ job, proof });
  if (!validation.ok) {
    return validation;
  }

  return {
    ok: true,
    job: {
      ...job,
      status: validation.status,
      proof: {
        result: proof.result,
        changed_files: uniq((proof.changedFiles || []).map(normalizePath)),
        tests: proof.tests || [],
        pr_url: proof.prUrl || null,
        blocker: proof.blocker || null,
        submitted_at: proof.submittedAt || new Date().toISOString(),
      },
    },
  };
}

// scripts/pinballwake-openhands-worker.mjs
//
// OpenHands adapter for the Autopilot Executor Lane.
//
// v1 is intentionally test-mode only. It prepares the task, calls an injected
// OpenHands runner, and hands the patch to the coding room safety gate. The
// default path never starts OpenHands by itself and never opens or merges PRs.

import { submitCodingRoomBuildResult } from "./pinballwake-coding-room.mjs";

const RECEIPT_TYPE_PASS = "openhands_worker_pass";
const RECEIPT_TYPE_HOLD = "openhands_worker_hold";
const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;
const MAX_PATCH_BYTES = 120_000;
const PROOF_REQUIRED = ["pr_url", "head_sha", "test_run_id", "executor_seat_id"];

export async function runOpenHandsWorker({
  job,
  scopePack,
  openHands,
  coderoom,
  spendGuard,
  env = process.env,
  testMode = false,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  executorSeatId = "pinballwake-openhands-worker",
  now = new Date(),
} = {}) {
  const safeNow = toDate(now);
  const normalizedScope = normalizeScopePack(scopePack);
  const normalizedJob = normalizeJob(job, normalizedScope);

  if (!isOpenHandsTestMode({ env, testMode })) {
    return hold({
      job: normalizedJob,
      executorSeatId,
      now: safeNow,
      reason: "openhands_test_mode_required",
      evidence: { hint: "Set OPENHANDS_TEST_MODE=1 for the opt-in adapter check." },
    });
  }

  if (!normalizedJob) {
    return hold({
      job: normalizedJob,
      executorSeatId,
      now: safeNow,
      reason: "job_required",
      evidence: { hint: "Pass a coding room job or todo-backed job payload." },
    });
  }

  if (normalizedScope.owned_files.length === 0) {
    return hold({
      job: normalizedJob,
      executorSeatId,
      now: safeNow,
      reason: "owned_files_required",
      evidence: { scope_pack_comment_id: normalizedScope.scope_pack_comment_id ?? null },
    });
  }

  if (typeof openHands !== "function") {
    return hold({
      job: normalizedJob,
      executorSeatId,
      now: safeNow,
      reason: "openhands_runner_not_provided",
      evidence: { hint: "Pass openHands: async ({ prompt, job, scopePack }) => result." },
    });
  }

  const prompt = buildOpenHandsTaskPrompt({ job: normalizedJob, scopePack: normalizedScope });
  let result;
  try {
    result = await invokeWithOptionalSpendGuard({
      spendGuard,
      label: normalizedScope.spend_guard_label || "openhands/test-mode",
      provider: normalizedScope.spend_guard_provider || "openai",
      run: () =>
        openHands({
          job: normalizedJob,
          scopePack: normalizedScope,
          prompt,
          timeoutMs,
        }),
    });
  } catch (err) {
    return hold({
      job: normalizedJob,
      executorSeatId,
      now: safeNow,
      reason: isTimeoutError(err) ? "openhands_timeout" : "openhands_threw",
      evidence: { error_message: clip(String(err?.message ?? err), 1000) },
    });
  }

  if (!result || result.ok === false) {
    return hold({
      job: normalizedJob,
      executorSeatId,
      now: safeNow,
      reason: "openhands_reported_failure",
      evidence: {
        exit_code: result?.exit_code ?? null,
        output: clip(result?.output, 2000),
      },
    });
  }

  const patch = String(result.patch ?? "");
  if (!patch.trim()) {
    return hold({
      job: normalizedJob,
      executorSeatId,
      now: safeNow,
      reason: "patch_required",
      evidence: { output: clip(result.output, 1000) },
    });
  }

  const patchBytes = Buffer.byteLength(patch, "utf8");
  if (patchBytes > MAX_PATCH_BYTES) {
    return hold({
      job: normalizedJob,
      executorSeatId,
      now: safeNow,
      reason: "patch_too_large",
      evidence: { patch_bytes: patchBytes, max_patch_bytes: MAX_PATCH_BYTES },
    });
  }

  const changedFiles = normalizeChangedFiles(result.changed_files || extractChangedFilesFromPatch(patch));
  if (changedFiles.length === 0) {
    return hold({
      job: normalizedJob,
      executorSeatId,
      now: safeNow,
      reason: "changed_files_required",
      evidence: { patch_bytes: patchBytes },
    });
  }

  const submit = coderoom || defaultCoderoomSubmit;
  let coderoomResult;
  try {
    coderoomResult = await submit({
      job: normalizedJob,
      scopePack: normalizedScope,
      patch,
      changedFiles,
      summary: clip(result.summary || "OpenHands produced a test-mode patch.", 500),
      testRunId: result.test_run_id ?? null,
    });
  } catch (err) {
    return hold({
      job: normalizedJob,
      executorSeatId,
      now: safeNow,
      reason: "coderoom_threw",
      evidence: { error_message: clip(String(err?.message ?? err), 1000) },
    });
  }

  if (!coderoomResult || !coderoomResult.ok) {
    return hold({
      job: normalizedJob,
      executorSeatId,
      now: safeNow,
      reason: "coderoom_rejected_patch",
      evidence: {
        reason: coderoomResult?.reason ?? "unknown",
        file: coderoomResult?.file ?? null,
        changed_files: changedFiles,
      },
    });
  }

  return pass({
    job: normalizedJob,
    executorSeatId,
    now: safeNow,
    evidence: {
      changed_files: changedFiles,
      patch_bytes: patchBytes,
      pr_url: coderoomResult.pr_url ?? result.pr_url ?? null,
      head_sha_after: coderoomResult.head_sha_after ?? result.head_sha_after ?? null,
      test_run_id: coderoomResult.test_run_id ?? result.test_run_id ?? null,
      test_exit_code: coderoomResult.test_exit_code ?? result.test_exit_code ?? null,
      coderoom_status: coderoomResult.job?.status ?? coderoomResult.status ?? null,
    },
  });
}

export function buildOpenHandsTaskPrompt({ job = {}, scopePack = {} } = {}) {
  const ownedFiles = normalizeChangedFiles(scopePack.owned_files || job.owned_files || []);
  const acceptance = normalizeList(scopePack.acceptance || job.acceptance || job.expected_proof?.tests);
  const verification = normalizeList(scopePack.verification || scopePack.tests || []);
  const lines = [
    "You are OpenHands running in UnClick test mode.",
    "Return a unified diff patch only. Do not commit, push, merge, deploy, or touch secrets.",
    `Job: ${compact(job.title || job.job_id || job.id || "untitled job", 300)}`,
    `Chip: ${compact(job.chip || "none", 300)}`,
    `Todo: ${job.todo_id || job.id || "unknown"}`,
    "Owned files:",
    ...ownedFiles.map((file) => `- ${file}`),
    "Acceptance:",
    ...(acceptance.length ? acceptance.map((item) => `- ${item}`) : ["- Produce the smallest safe patch inside owned files."]),
  ];

  if (verification.length) {
    lines.push("Verification:");
    lines.push(...verification.map((item) => `- ${item}`));
  }

  if (scopePack.body || scopePack.description) {
    lines.push("ScopePack body:");
    lines.push(compact(scopePack.body || scopePack.description, 4000));
  }

  return lines.join("\n");
}

export function isOpenHandsTestMode({ env = process.env, testMode = false } = {}) {
  return testMode === true || String(env?.OPENHANDS_TEST_MODE ?? "").trim() === "1";
}

export function sanitizeOpenHandsReceipt(receipt) {
  const redacted = redactSecrets(receipt);
  return {
    ...(redacted && typeof redacted === "object" ? redacted : {}),
    sanitized: true,
  };
}

async function invokeWithOptionalSpendGuard({ spendGuard, label, provider, run }) {
  if (typeof spendGuard !== "function") {
    return run();
  }

  return spendGuard(
    {
      label,
      provider,
      mode: "test_mode",
    },
    run
  );
}

async function defaultCoderoomSubmit({ job, changedFiles, summary, testRunId }) {
  const result = submitCodingRoomBuildResult({
    job,
    buildResult: {
      result: "done",
      changedFiles,
      summary,
    },
  });

  if (!result.ok) return result;

  return {
    ok: true,
    job: result.job,
    pr_url: null,
    head_sha_after: null,
    test_run_id: testRunId,
  };
}

function pass({ job, executorSeatId, now, evidence }) {
  return {
    ok: true,
    reason: "openhands_worker_pass",
    receipt: sanitizeOpenHandsReceipt({
      receipt_type: RECEIPT_TYPE_PASS,
      emitted_at: now.toISOString(),
      job_id: job?.job_id ?? null,
      todo_id: job?.todo_id ?? job?.id ?? null,
      executor_seat_id: executorSeatId,
      evidence,
      proof_required: PROOF_REQUIRED,
      xpass_advisory: true,
      next_action: "coderoom_review",
    }),
  };
}

function hold({ job, executorSeatId, now, reason, evidence }) {
  return {
    ok: false,
    reason,
    receipt: sanitizeOpenHandsReceipt({
      receipt_type: RECEIPT_TYPE_HOLD,
      emitted_at: now.toISOString(),
      job_id: job?.job_id ?? null,
      todo_id: job?.todo_id ?? job?.id ?? null,
      executor_seat_id: executorSeatId,
      hold_reason: reason,
      evidence,
      proof_required: ["scope_pack_comment_id"],
      xpass_advisory: false,
      next_action: "rescope_or_retry",
    }),
  };
}

function normalizeScopePack(scopePack = {}) {
  return {
    ...scopePack,
    owned_files: normalizeChangedFiles(scopePack.owned_files || scopePack.ownedFiles || []),
    acceptance: normalizeList(scopePack.acceptance || scopePack.acceptance_criteria),
    verification: normalizeList(scopePack.verification || scopePack.tests),
  };
}

function normalizeJob(job, scopePack) {
  if (!job || typeof job !== "object") return null;
  const ownedFiles = normalizeChangedFiles(job.owned_files || job.ownedFiles || scopePack.owned_files);
  return {
    ...job,
    owned_files: ownedFiles,
    expected_proof: job.expected_proof || {
      tests: scopePack.verification,
      requires_pr: true,
      requires_changed_files: true,
      requires_non_overlap: true,
      requires_tests: true,
    },
  };
}

function normalizeChangedFiles(values) {
  return [...new Set(normalizeList(values).map(normalizePath).filter(Boolean))];
}

function normalizeList(values) {
  if (Array.isArray(values)) return values.map((value) => String(value ?? "").trim()).filter(Boolean);
  if (values === undefined || values === null || values === "") return [];
  return [String(values).trim()].filter(Boolean);
}

function normalizePath(value) {
  return String(value ?? "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .trim();
}

function extractChangedFilesFromPatch(patch) {
  const files = [];
  for (const line of String(patch || "").split(/\r?\n/)) {
    const diffMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (diffMatch) {
      files.push(diffMatch[2]);
      continue;
    }

    const plusMatch = line.match(/^\+\+\+ b\/(.+)$/);
    if (plusMatch) files.push(plusMatch[1]);
  }
  return normalizeChangedFiles(files.filter((file) => file !== "/dev/null"));
}

function compact(value, max) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function clip(value, max) {
  if (value === undefined || value === null) return null;
  const text = String(value);
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function toDate(value) {
  return value instanceof Date ? value : new Date(value || Date.now());
}

function isTimeoutError(err) {
  const code = String(err?.code ?? "").toUpperCase();
  const message = String(err?.message ?? err ?? "").toLowerCase();
  return code === "ETIMEDOUT" || code === "TIMEOUT" || message.includes("timeout") || message.includes("timed out");
}

function redactSecrets(value, key = "") {
  if (value === null || value === undefined) return value;
  if (isSecretKey(key)) return "[redacted]";
  if (typeof value === "string") return redactSecretText(value);
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item));
  if (typeof value === "object") {
    const out = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      out[childKey] = redactSecrets(childValue, childKey);
    }
    return out;
  }
  return value;
}

function redactSecretText(value) {
  return String(value)
    .replace(/\b(Bearer)\s+[A-Za-z0-9._~+/-]+=*/gi, "$1 [redacted]")
    .replace(/\b(api[_-]?key|token|password|secret)=([^&\s]+)/gi, "$1=[redacted]");
}

function isSecretKey(key) {
  return /(authorization|api[_-]?key|token|password|secret|credential)/i.test(String(key || ""));
}

export const __testing__ = {
  RECEIPT_TYPE_PASS,
  RECEIPT_TYPE_HOLD,
  PROOF_REQUIRED,
  MAX_PATCH_BYTES,
  extractChangedFilesFromPatch,
};

#!/usr/bin/env node

import {
  claimCodingRoomLedgerJob,
  createCodingRoomJobLedger,
  listCodingRoomJobs,
  markReviewFallbackReady,
  readCodingRoomJobLedger,
  reclaimExpiredCodingRoomJobs,
  runnerCanClaimCodingRoomJob,
  writeCodingRoomJobLedger,
} from "./pinballwake-coding-room.mjs";

export const DEFAULT_CODING_ROOM_RUNNER = {
  id: "pinballwake-job-runner",
  readiness: "builder_ready",
  capabilities: ["implementation", "test_fix", "docs_update"],
};

function parseList(value, fallback = []) {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function parseIntOption(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

export function createCodingRoomRunner(input = {}) {
  return {
    id: String(input.id || DEFAULT_CODING_ROOM_RUNNER.id).trim(),
    emoji: String(input.emoji || "").trim(),
    agent_id: String(input.agentId || input.agent_id || "").trim(),
    name: String(input.name || "").trim(),
    readiness: String(input.readiness || DEFAULT_CODING_ROOM_RUNNER.readiness).trim(),
    capabilities: Array.isArray(input.capabilities)
      ? input.capabilities.map((capability) => String(capability).trim()).filter(Boolean)
      : [...DEFAULT_CODING_ROOM_RUNNER.capabilities],
  };
}

export function createCodingRoomRunnerFromEnv(env = process.env) {
  return createCodingRoomRunner({
    id: env.CODING_ROOM_RUNNER_ID,
    emoji: env.CODING_ROOM_RUNNER_EMOJI,
    agentId: env.CODING_ROOM_RUNNER_AGENT_ID,
    name: env.CODING_ROOM_RUNNER_NAME,
    readiness: env.CODING_ROOM_RUNNER_READINESS,
    capabilities: parseList(env.CODING_ROOM_RUNNER_CAPABILITIES, DEFAULT_CODING_ROOM_RUNNER.capabilities),
  });
}

export function markTimedOutReviewJobs({ ledger, now = new Date().toISOString() } = {}) {
  let fallbackReady = 0;
  const next = createCodingRoomJobLedger({
    jobs: (ledger?.jobs || []).map((job) => {
      const marked = markReviewFallbackReady({ job, now });
      if (!marked.ok) {
        return job;
      }

      fallbackReady += 1;
      return marked.job;
    }),
    updatedAt: now,
  });

  return { ok: true, fallbackReady, ledger: next };
}

export function chooseClaimableCodingRoomJob({ ledger, runner } = {}) {
  const queuedJobs = listCodingRoomJobs({ ledger, statuses: "queued" });
  const skipped = [];

  for (const job of queuedJobs) {
    const decision = runnerCanClaimCodingRoomJob({ runner, job, activeJobs: ledger?.jobs || [] });
    if (decision.ok) {
      return { ok: true, job, skipped };
    }

    skipped.push({
      job_id: job.job_id,
      worker: job.worker,
      chip: job.chip,
      reason: decision.reason,
      file: decision.file || null,
      review_kind: decision.review_kind || null,
    });
  }

  return { ok: false, reason: "no_claimable_jobs", skipped };
}

export function runCodingRoomRunnerCycle({
  ledger,
  runner = DEFAULT_CODING_ROOM_RUNNER,
  now = new Date().toISOString(),
  leaseSeconds,
} = {}) {
  const reclaimed = reclaimExpiredCodingRoomJobs({ ledger, now });
  if (!reclaimed.ok) {
    return reclaimed;
  }

  const fallback = markTimedOutReviewJobs({ ledger: reclaimed.ledger, now });
  const choice = chooseClaimableCodingRoomJob({ ledger: fallback.ledger, runner });
  if (!choice.ok) {
    return {
      ok: true,
      action: "idle",
      reason: choice.reason,
      ledger: fallback.ledger,
      reclaimed: reclaimed.reclaimed,
      fallback_ready: fallback.fallbackReady,
      skipped: choice.skipped,
    };
  }

  const claimed = claimCodingRoomLedgerJob({
    ledger: fallback.ledger,
    jobId: choice.job.job_id,
    runner,
    now,
    leaseSeconds,
  });
  if (!claimed.ok) {
    return claimed;
  }

  return {
    ok: true,
    action: "claimed",
    ledger: claimed.ledger,
    job: claimed.job,
    claim: claimed.claim,
    reclaimed: reclaimed.reclaimed,
    fallback_ready: fallback.fallbackReady,
    skipped: choice.skipped,
  };
}

export async function runCodingRoomRunnerFile({
  ledgerPath,
  runner = DEFAULT_CODING_ROOM_RUNNER,
  now = new Date().toISOString(),
  leaseSeconds,
  dryRun = false,
} = {}) {
  if (!ledgerPath) {
    return { ok: false, reason: "missing_ledger_path" };
  }

  const ledger = await readCodingRoomJobLedger(ledgerPath);
  const result = runCodingRoomRunnerCycle({
    ledger,
    runner,
    now,
    leaseSeconds,
  });

  if (result.ok && !dryRun) {
    await writeCodingRoomJobLedger(ledgerPath, result.ledger);
  }

  return {
    ...result,
    dry_run: dryRun,
    ledger_path: ledgerPath,
  };
}

function cliRunner() {
  const runner = createCodingRoomRunnerFromEnv();
  return createCodingRoomRunner({
    ...runner,
    id: getArg("runner-id", runner.id),
    readiness: getArg("readiness", runner.readiness),
    capabilities: parseList(getArg("capabilities", runner.capabilities.join(",")), runner.capabilities),
  });
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  const ledgerPath = getArg("ledger", process.env.CODING_ROOM_LEDGER_PATH || "");
  const dryRun = process.argv.includes("--dry-run") || parseBoolean(process.env.CODING_ROOM_RUNNER_DRY_RUN);
  const leaseSeconds = parseIntOption(getArg("lease-seconds", process.env.CODING_ROOM_LEASE_SECONDS), undefined);

  runCodingRoomRunnerFile({
    ledgerPath,
    runner: cliRunner(),
    leaseSeconds,
    dryRun,
  })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

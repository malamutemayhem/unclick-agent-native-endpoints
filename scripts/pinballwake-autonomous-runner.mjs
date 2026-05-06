#!/usr/bin/env node

import {
  createCodingRoomJobLedger,
  readCodingRoomJobLedger,
  submitCodingRoomProof,
  writeCodingRoomJobLedger,
} from "./pinballwake-coding-room.mjs";
import {
  DEFAULT_CODING_ROOM_RUNNER,
  createCodingRoomRunner,
  createCodingRoomRunnerFromEnv,
  runCodingRoomRunnerCycle,
} from "./pinballwake-coding-room-runner.mjs";

export const AUTONOMOUS_RUNNER_MODES = new Set(["dry-run", "claim", "execute"]);

export const DEFAULT_AUTONOMOUS_RUNNER = {
  id: "pinballwake-autonomous-runner",
  readiness: "builder_ready",
  capabilities: ["implementation", "test_fix", "docs_update"],
};

export const DEFAULT_AUTONOMOUS_RUNNER_POLICY = {
  disabled: false,
  allowProtectedSurfaces: false,
  allowExecute: false,
  maxCycles: 1,
};

const PROTECTED_SURFACE_PATTERNS = [
  {
    reason: "protected_surface_secret",
    pattern: /\b(secret|secrets|credential|credentials|token|tokens|api key|apikey|raw key|private key|env var|env)\b/i,
  },
  {
    reason: "protected_surface_auth",
    pattern: /\b(auth|oauth|login|session|jwt|rls|tenant|permission|permissions)\b/i,
  },
  {
    reason: "protected_surface_billing",
    pattern: /\b(billing|stripe|payment|payments|invoice|subscription)\b/i,
  },
  {
    reason: "protected_surface_dns",
    pattern: /\b(dns|domain|domains|vercel domain|apex|www redirect)\b/i,
  },
  {
    reason: "protected_surface_migration",
    pattern: /\b(migration|migrations|schema|supabase sql|alter table|drop table)\b/i,
  },
  {
    reason: "protected_surface_destructive",
    pattern: /\b(force[- ]?push|delete|remove|destructive cleanup|rm -rf|reset --hard)\b/i,
  },
];

const PROTECTED_PATH_PATTERNS = [
  /\.env/i,
  /(^|\/)supabase\/migrations\//i,
  /(^|\/)(auth|billing|payments?|secrets?|credentials?|keychain)(\/|\.|$)/i,
  /stripe/i,
];

function parseBoolean(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function parseIntOption(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseList(value, fallback = []) {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function normalizePath(value) {
  return String(value ?? "").replace(/\\/g, "/").trim();
}

function compact(value, max = 240) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

export function createAutonomousRunner(input = {}) {
  return createCodingRoomRunner({
    ...DEFAULT_AUTONOMOUS_RUNNER,
    ...input,
    id: input.id || input.runnerId || DEFAULT_AUTONOMOUS_RUNNER.id,
    agentId: input.agentId || input.agent_id || "",
    capabilities: Array.isArray(input.capabilities)
      ? input.capabilities
      : DEFAULT_AUTONOMOUS_RUNNER.capabilities,
  });
}

export function createAutonomousRunnerFromEnv(env = process.env) {
  const base = createCodingRoomRunnerFromEnv(env);
  return createAutonomousRunner({
    ...base,
    id: env.AUTONOMOUS_RUNNER_ID || base.id || DEFAULT_AUTONOMOUS_RUNNER.id,
    readiness: env.AUTONOMOUS_RUNNER_READINESS || base.readiness || DEFAULT_AUTONOMOUS_RUNNER.readiness,
    capabilities: parseList(
      env.AUTONOMOUS_RUNNER_CAPABILITIES,
      base.capabilities?.length ? base.capabilities : DEFAULT_AUTONOMOUS_RUNNER.capabilities,
    ),
  });
}

export function createAutonomousRunnerPolicy(input = {}) {
  return {
    ...DEFAULT_AUTONOMOUS_RUNNER_POLICY,
    ...input,
    disabled: Boolean(input.disabled),
    allowProtectedSurfaces: Boolean(input.allowProtectedSurfaces),
    allowExecute: Boolean(input.allowExecute),
    maxCycles: Math.max(1, Number.isFinite(input.maxCycles) ? input.maxCycles : DEFAULT_AUTONOMOUS_RUNNER_POLICY.maxCycles),
  };
}

export function normalizeAutonomousRunnerMode(value) {
  const mode = String(value || "dry-run").trim().toLowerCase();
  return AUTONOMOUS_RUNNER_MODES.has(mode) ? mode : "dry-run";
}

export function inspectAutonomousRunnerJobSafety(job) {
  if (!job) {
    return { ok: false, reason: "missing_job" };
  }

  const searchable = [
    job.worker,
    job.chip,
    job.context,
    job.source,
    ...(job.expected_proof?.tests || []),
  ].join(" ");

  for (const { reason, pattern } of PROTECTED_SURFACE_PATTERNS) {
    if (pattern.test(searchable)) {
      return { ok: false, reason, surface: compact(searchable) };
    }
  }

  const protectedPath = (job.owned_files || []).map(normalizePath).find((file) =>
    PROTECTED_PATH_PATTERNS.some((pattern) => pattern.test(file)),
  );
  if (protectedPath) {
    return { ok: false, reason: "protected_surface_path", file: protectedPath };
  }

  return { ok: true, reason: "safe_for_autonomous_runner" };
}

export function markUnsafeJobsBlockedForAutonomousRunner({
  ledger,
  allowProtectedSurfaces = false,
  now = new Date().toISOString(),
} = {}) {
  const next = createCodingRoomJobLedger({
    jobs: ledger?.jobs || [],
    updatedAt: now,
  });

  if (allowProtectedSurfaces) {
    return { ok: true, ledger: next, blocked: [] };
  }

  const blocked = [];
  next.jobs = next.jobs.map((job) => {
    if (job.status !== "queued") {
      return job;
    }

    const safety = inspectAutonomousRunnerJobSafety(job);
    if (safety.ok) {
      return job;
    }

    const proof = submitCodingRoomProof({
      job,
      proof: {
        result: "blocker",
        blocker: `Autonomous Runner blocked protected work: ${safety.reason}`,
        submittedAt: now,
      },
    });

    if (!proof.ok) {
      return {
        ...job,
        status: "blocked",
        proof: {
          result: "blocker",
          blocker: `Autonomous Runner blocked protected work: ${safety.reason}`,
          submitted_at: now,
        },
      };
    }

    blocked.push({
      job_id: job.job_id,
      reason: safety.reason,
      file: safety.file || null,
    });
    return proof.job;
  });

  return { ok: true, ledger: next, blocked };
}

export function runAutonomousRunnerCycle({
  ledger,
  runner = DEFAULT_AUTONOMOUS_RUNNER,
  mode = "dry-run",
  policy = DEFAULT_AUTONOMOUS_RUNNER_POLICY,
  now = new Date().toISOString(),
  leaseSeconds,
} = {}) {
  const safePolicy = createAutonomousRunnerPolicy(policy);
  const safeMode = normalizeAutonomousRunnerMode(mode);
  const safeRunner = createAutonomousRunner(runner);

  if (safePolicy.disabled) {
    return {
      ok: true,
      action: "disabled",
      mode: safeMode,
      reason: "kill_switch_enabled",
      runner: safeRunner.id,
      ledger: createCodingRoomJobLedger({ jobs: ledger?.jobs || [], updatedAt: ledger?.updated_at || now }),
    };
  }

  const hardened = markUnsafeJobsBlockedForAutonomousRunner({
    ledger,
    allowProtectedSurfaces: safePolicy.allowProtectedSurfaces,
    now,
  });

  if (!hardened.ok) {
    return hardened;
  }

  if (safeMode === "execute" && !safePolicy.allowExecute) {
    return {
      ok: true,
      action: "blocked",
      mode: safeMode,
      reason: "execute_mode_disabled",
      runner: safeRunner.id,
      ledger: hardened.ledger,
      safety_blocked: hardened.blocked,
    };
  }

  const claim = runCodingRoomRunnerCycle({
    ledger: hardened.ledger,
    runner: safeRunner,
    now,
    leaseSeconds,
  });

  return {
    ...claim,
    mode: safeMode,
    runner: safeRunner.id,
    dry_run: safeMode === "dry-run",
    safety_blocked: hardened.blocked,
  };
}

export async function runAutonomousRunnerFile({
  ledgerPath,
  runner = createAutonomousRunnerFromEnv(),
  mode = "dry-run",
  policy = createAutonomousRunnerPolicy(),
  now = new Date().toISOString(),
  leaseSeconds,
} = {}) {
  if (!ledgerPath) {
    return { ok: false, reason: "missing_ledger_path" };
  }

  const safePolicy = createAutonomousRunnerPolicy(policy);
  const safeMode = normalizeAutonomousRunnerMode(mode);
  let ledger = await readCodingRoomJobLedger(ledgerPath);
  const results = [];

  for (let index = 0; index < safePolicy.maxCycles; index += 1) {
    const result = runAutonomousRunnerCycle({
      ledger,
      runner,
      mode: safeMode,
      policy: safePolicy,
      now,
      leaseSeconds,
    });
    results.push(result);
    ledger = result.ledger || ledger;

    if (!result.ok || ["idle", "disabled", "blocked"].includes(result.action)) {
      break;
    }
  }

  const shouldPersist = safeMode !== "dry-run" && !safePolicy.disabled;
  if (shouldPersist) {
    await writeCodingRoomJobLedger(ledgerPath, ledger);
  }

  const last = results[results.length - 1] || { ok: true, action: "idle", reason: "no_cycle_run", ledger };
  return {
    ...last,
    ok: results.every((result) => result.ok),
    action: last.action,
    mode: safeMode,
    dry_run: safeMode === "dry-run",
    persisted: shouldPersist,
    cycles: results,
    ledger,
    ledger_path: ledgerPath,
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  const explicitMode = getArg("mode", process.env.AUTONOMOUS_RUNNER_MODE || "");
  const dryRun = process.argv.includes("--dry-run") || parseBoolean(process.env.AUTONOMOUS_RUNNER_DRY_RUN);
  const mode = dryRun ? "dry-run" : normalizeAutonomousRunnerMode(explicitMode || "dry-run");

  runAutonomousRunnerFile({
    ledgerPath: getArg("ledger", process.env.CODING_ROOM_LEDGER_PATH || ""),
    mode,
    runner: createAutonomousRunnerFromEnv(),
    leaseSeconds: parseIntOption(getArg("lease-seconds", process.env.CODING_ROOM_LEASE_SECONDS), undefined),
    policy: createAutonomousRunnerPolicy({
      disabled: parseBoolean(process.env.AUTONOMOUS_RUNNER_DISABLED),
      allowProtectedSurfaces: parseBoolean(process.env.AUTONOMOUS_RUNNER_ALLOW_PROTECTED_SURFACES),
      allowExecute: parseBoolean(process.env.AUTONOMOUS_RUNNER_ALLOW_EXECUTE),
      maxCycles: parseIntOption(getArg("max-cycles", process.env.AUTONOMOUS_RUNNER_MAX_CYCLES), 1),
    }),
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

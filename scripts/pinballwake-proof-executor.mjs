#!/usr/bin/env node

import { spawn } from "node:child_process";

import {
  createCodingRoomJobLedger,
  readCodingRoomJobLedger,
  submitCodingRoomProof,
  writeCodingRoomJobLedger,
} from "./pinballwake-coding-room.mjs";

export const DEFAULT_PROOF_COMMAND_ALLOWLIST = [
  "node --test scripts/",
  "npm run test:",
  "npm test --",
];

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

function compactOutput(value, max = 2000) {
  const text = String(value ?? "").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function parseList(value, fallback = []) {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function commandToArgv(command) {
  const parts = [];
  let current = "";
  let quote = "";

  for (const char of String(command ?? "").trim()) {
    if (quote) {
      if (char === quote) {
        quote = "";
      } else {
        current += char;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        parts.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (quote) {
    throw new Error("Unclosed quote in command");
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

function hasUnsafePathTraversal(value) {
  return String(value ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .some((part) => part === "..");
}

export function isProofCommandAllowed(command, allowlist = DEFAULT_PROOF_COMMAND_ALLOWLIST) {
  const normalized = String(command ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return false;
  }

  if (/[;&|`$<>]/.test(normalized)) {
    return false;
  }

  let argv;
  try {
    argv = commandToArgv(normalized);
  } catch {
    return false;
  }

  if (argv.some(hasUnsafePathTraversal)) {
    return false;
  }

  return allowlist.some((allowed) => normalized === allowed || normalized.startsWith(allowed));
}

export function getProofCommandsForJob(job) {
  return Array.isArray(job?.expected_proof?.tests)
    ? job.expected_proof.tests.map((command) => String(command).trim()).filter(Boolean)
    : [];
}

export async function runProofCommand(command, { cwd = process.cwd(), timeoutMs = 120000 } = {}) {
  let bin;
  let args;
  try {
    [bin, ...args] = commandToArgv(command);
  } catch (error) {
    return { command, status: "failed", exit_code: null, output: compactOutput(error.message) };
  }
  if (!bin) {
    return { command, status: "failed", exit_code: null, output: "Empty command" };
  }

  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd,
      shell: false,
      windowsHide: true,
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      resolve({
        command,
        status: "failed",
        exit_code: null,
        output: compactOutput(`${stdout}\n${stderr}\nTimed out after ${timeoutMs}ms`),
      });
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        command,
        status: "failed",
        exit_code: null,
        output: compactOutput(error.message),
      });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        command,
        status: code === 0 ? "passed" : "failed",
        exit_code: code,
        output: compactOutput(`${stdout}\n${stderr}`),
      });
    });
  });
}

export async function executeCodingRoomProofJob({
  job,
  allowlist = DEFAULT_PROOF_COMMAND_ALLOWLIST,
  cwd = process.cwd(),
  timeoutMs = 120000,
  runCommand = runProofCommand,
  now = new Date().toISOString(),
} = {}) {
  if (!job) {
    return { ok: false, reason: "missing_job" };
  }

  if (job.status !== "claimed" && job.status !== "testing") {
    return { ok: false, reason: "job_not_claimed" };
  }

  const commands = getProofCommandsForJob(job);
  if (commands.length === 0) {
    return { ok: false, reason: "missing_proof_commands" };
  }

  const disallowed = commands.find((command) => !isProofCommandAllowed(command, allowlist));
  if (disallowed) {
    return {
      ok: true,
      job: submitCodingRoomProof({
        job,
        proof: {
          result: "blocker",
          blocker: `Proof command is not allowlisted: ${disallowed}`,
          submittedAt: now,
        },
      }).job,
      result: "blocker",
      reason: "proof_command_not_allowlisted",
      command: disallowed,
    };
  }

  const tests = [];
  for (const command of commands) {
    const result = await runCommand(command, { cwd, timeoutMs });
    tests.push(result);
    if (result.status !== "passed") {
      return {
        ok: true,
        job: submitCodingRoomProof({
          job,
          proof: {
            result: "blocker",
            blocker: `Proof command failed: ${command}`,
            submittedAt: now,
          },
        }).job,
        result: "blocker",
        tests,
      };
    }
  }

  const proof = submitCodingRoomProof({
    job,
    proof: {
      result: "done",
      changedFiles: [],
      tests,
      prUrl: "",
      submittedAt: now,
    },
  });

  return {
    ok: proof.ok,
    reason: proof.reason,
    job: proof.job,
    result: proof.ok ? "done" : "blocker",
    tests,
  };
}

export async function executeCodingRoomProofLedgerJob({
  ledger,
  jobId,
  allowlist = DEFAULT_PROOF_COMMAND_ALLOWLIST,
  cwd = process.cwd(),
  timeoutMs = 120000,
  runCommand = runProofCommand,
  now = new Date().toISOString(),
} = {}) {
  const next = createCodingRoomJobLedger({
    jobs: ledger?.jobs || [],
    updatedAt: now,
  });
  const index = next.jobs.findIndex((job) => job.job_id === jobId);
  if (index === -1) {
    return { ok: false, reason: "missing_job" };
  }

  const result = await executeCodingRoomProofJob({
    job: next.jobs[index],
    allowlist,
    cwd,
    timeoutMs,
    runCommand,
    now,
  });

  if (result.job) {
    next.jobs[index] = result.job;
  }

  return {
    ...result,
    ledger: next,
  };
}

export async function executeCodingRoomProofLedgerFile({
  ledgerPath,
  jobId,
  allowlist = DEFAULT_PROOF_COMMAND_ALLOWLIST,
  cwd = process.cwd(),
  timeoutMs = 120000,
  dryRun = false,
} = {}) {
  if (!ledgerPath) {
    return { ok: false, reason: "missing_ledger_path" };
  }

  if (!jobId) {
    return { ok: false, reason: "missing_job_id" };
  }

  const ledger = await readCodingRoomJobLedger(ledgerPath);
  const result = await executeCodingRoomProofLedgerJob({
    ledger,
    jobId,
    allowlist,
    cwd,
    timeoutMs,
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

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  executeCodingRoomProofLedgerFile({
    ledgerPath: getArg("ledger", process.env.CODING_ROOM_LEDGER_PATH || ""),
    jobId: getArg("job-id", process.env.CODING_ROOM_JOB_ID || ""),
    allowlist: parseList(process.env.CODING_ROOM_PROOF_ALLOWLIST, DEFAULT_PROOF_COMMAND_ALLOWLIST),
    timeoutMs: parseIntOption(getArg("timeout-ms", process.env.CODING_ROOM_PROOF_TIMEOUT_MS), 120000),
    dryRun: process.argv.includes("--dry-run") || parseBoolean(process.env.CODING_ROOM_PROOF_DRY_RUN),
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

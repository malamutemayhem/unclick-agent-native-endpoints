#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

import { validateCodingRoomBuildPatch } from "./pinballwake-build-executor.mjs";
import { runOpenHandsWorker } from "./pinballwake-openhands-worker.mjs";

const DEFAULT_PROOF_FILE = "docs/openhands-proof-fixture.md";
const DEFAULT_TODO_ID = "036de894-82a1-49c7-ac19-67335950c626";
const DEFAULT_BRANCH_PREFIX = "codex/openhands-proof";
const DEFAULT_TITLE = "test(autopilot): prove OpenHands docs patch path";
const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;

function parseBoolean(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
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

function normalizePath(value) {
  return String(value ?? "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .trim();
}

function safeStamp(value = new Date()) {
  return String(value instanceof Date ? value.toISOString() : value)
    .replace(/[^0-9A-Za-z._:-]/g, "-")
    .slice(0, 80);
}

export function splitArgs(value) {
  const parts = [];
  let current = "";
  let quote = "";

  for (const char of String(value ?? "")) {
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
    throw new Error("unclosed_quote");
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

export function buildOpenHandsCliArgs({ prompt, argsTemplate = "" } = {}) {
  const template = String(argsTemplate || "--headless --json --task {prompt}").trim();
  const parts = splitArgs(template);
  const replaced = parts.map((part) => (part === "{prompt}" ? String(prompt ?? "") : part));
  return replaced.includes(String(prompt ?? "")) ? replaced : [...replaced, "--task", String(prompt ?? "")];
}

export function buildDocsOnlyFixturePatch({
  filePath = DEFAULT_PROOF_FILE,
  proofLine = `- proof run: ${safeStamp(new Date())}`,
} = {}) {
  const file = normalizePath(filePath);
  return [
    `diff --git a/${file} b/${file}`,
    "index 1111111..2222222 100644",
    `--- a/${file}`,
    `+++ b/${file}`,
    "@@ -3,4 +3,5 @@",
    " This fixture exists so the autopilot can prove a docs-only patch path without",
    " touching product code, production data, secrets, billing, DNS, or deploys.",
    "",
    " <!-- openhands-proof-lines -->",
    `+${proofLine}`,
    "",
  ].join("\n");
}

export function createFixtureOpenHandsRunner({ filePath = DEFAULT_PROOF_FILE, now = new Date() } = {}) {
  return async () => ({
    ok: true,
    patch: buildDocsOnlyFixturePatch({
      filePath,
      proofLine: `- proof run: ${safeStamp(now)}`,
    }),
    changed_files: [normalizePath(filePath)],
    summary: "Fixture OpenHands proof produced a docs-only patch.",
    test_run_id: `openhands-fixture-${safeStamp(now)}`,
    test_exit_code: 0,
  });
}

export function createOpenHandsCliRunner({
  command,
  argsTemplate = "",
  cwd = process.cwd(),
  env = process.env,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  readPatchFile = readFile,
  runProcess = runProcessCommand,
} = {}) {
  const safeCommand = String(command || env.OPENHANDS_COMMAND || "openhands").trim();

  return async ({ prompt, scopePack }) => {
    const args = buildOpenHandsCliArgs({
      prompt,
      argsTemplate: argsTemplate || env.OPENHANDS_ARGS || "",
    });
    const result = await runProcess(safeCommand, args, {
      cwd,
      env: {
        ...env,
        OPENHANDS_TASK_PROMPT: prompt,
      },
      timeoutMs,
    });

    if (!result.ok) {
      return {
        ok: false,
        exit_code: result.exit_code,
        output: result.output,
      };
    }

    const patchFile = String(env.OPENHANDS_PATCH_FILE || "").trim();
    const patch = patchFile ? await readPatchFile(patchFile, "utf8") : extractUnifiedDiff(result.output);
    return {
      ok: Boolean(String(patch || "").trim()),
      patch,
      changed_files: scopePack?.owned_files || [],
      summary: "OpenHands CLI produced a test-mode patch.",
      test_run_id: result.run_id || "openhands-cli",
      test_exit_code: result.exit_code,
      output: result.output,
    };
  };
}

export function buildProofJob({ todoId = DEFAULT_TODO_ID, filePath = DEFAULT_PROOF_FILE } = {}) {
  const file = normalizePath(filePath);
  return {
    job_id: `coding-room:openhands-proof:${todoId}`,
    todo_id: todoId,
    title: "OpenHands proof v1: ScopePack to draft PR, no local PowerShell",
    chip: "OpenHands test-mode proof",
    owned_files: [file],
    expected_proof: {
      requires_pr: true,
      requires_changed_files: true,
      requires_non_overlap: true,
      requires_tests: true,
      tests: ["node --test scripts/pinballwake-openhands-proof-runner.test.mjs"],
    },
  };
}

export function buildProofScopePack({
  scopePackCommentId = "",
  filePath = DEFAULT_PROOF_FILE,
} = {}) {
  const file = normalizePath(filePath);
  return {
    scope_pack_comment_id: scopePackCommentId || null,
    owned_files: [file],
    acceptance: [
      "OpenHands returns a unified diff patch for a docs-only fixture.",
      "Coderoom rejects non-docs or outside-owned-file patches.",
      "Draft PR creation is opt-in and never auto-merges.",
    ],
    verification: ["node --test scripts/pinballwake-openhands-proof-runner.test.mjs"],
    body: "Test-mode only proof for OpenHands to coderoom draft PR flow.",
  };
}

export function createDraftPrCoderoom({
  cwd = process.cwd(),
  env = process.env,
  branchName,
  title = DEFAULT_TITLE,
  body = "",
  runProcess = runProcessCommand,
} = {}) {
  return async ({ job, patch, changedFiles, summary, testRunId }) => {
    const normalizedChanged = (changedFiles || []).map(normalizePath);
    const nonDocs = normalizedChanged.find((file) => !file.startsWith("docs/"));
    if (nonDocs) {
      return { ok: false, reason: "non_docs_patch_refused", file: nonDocs };
    }

    const validation = validateCodingRoomBuildPatch({
      patch,
      ownedFiles: job?.owned_files || [],
    });
    if (!validation.ok) {
      return {
        ok: false,
        reason: validation.reason,
        file: validation.file || null,
      };
    }

    const status = await runProcess("git", ["status", "--porcelain"], { cwd, env });
    if (!status.ok) return { ok: false, reason: "git_status_failed", output: status.output };
    if (status.stdout.trim()) {
      return { ok: false, reason: "dirty_worktree" };
    }

    const branch = branchName || `${DEFAULT_BRANCH_PREFIX}-${safeStamp(new Date())}`;
    const bodyText =
      body ||
      [
        "Test-mode OpenHands proof.",
        "",
        `Todo: ${job?.todo_id || DEFAULT_TODO_ID}`,
        `Summary: ${summary || "Docs-only proof patch."}`,
        `Test run: ${testRunId || "not supplied"}`,
        "",
        "No production data, secrets, deploy, billing, DNS, or auto-merge.",
      ].join("\n");

    const commands = [
      ["git", ["checkout", "-b", branch]],
      ["git", ["apply", "--whitespace=nowarn", "-"], { stdin: patch }],
      ["git", ["add", ...normalizedChanged]],
      ["git", ["commit", "-m", title]],
      ["git", ["push", "-u", "origin", branch]],
      ["gh", ["pr", "create", "--draft", "--title", title, "--body", bodyText]],
    ];

    let prUrl = "";
    for (const [command, args, options = {}] of commands) {
      const result = await runProcess(command, args, { cwd, env, ...options });
      if (!result.ok) {
        return {
          ok: false,
          reason: `${command}_failed`,
          output: result.output,
        };
      }
      if (command === "gh") {
        prUrl = result.stdout.trim();
      }
    }

    const sha = await runProcess("git", ["rev-parse", "HEAD"], { cwd, env });
    return {
      ok: true,
      pr_url: prUrl || null,
      head_sha_after: sha.stdout.trim() || null,
      test_run_id: testRunId || null,
      test_exit_code: 0,
      status: "draft_pr_created",
    };
  };
}

export async function runOpenHandsProof({
  env = process.env,
  cwd = process.cwd(),
  now = new Date(),
  filePath = DEFAULT_PROOF_FILE,
  openHands,
  coderoom,
  runProcess,
} = {}) {
  const safeEnv = env || {};
  const job = buildProofJob({ filePath });
  const scopePack = buildProofScopePack({ filePath });
  const selectedOpenHands =
    openHands ||
    (parseBoolean(safeEnv.OPENHANDS_PROOF_FIXTURE_PATCH)
      ? createFixtureOpenHandsRunner({ filePath, now })
      : createOpenHandsCliRunner({ cwd, env: safeEnv, runProcess }));

  const selectedCoderoom =
    coderoom ||
    (parseBoolean(safeEnv.OPENHANDS_CREATE_DRAFT_PR)
      ? createDraftPrCoderoom({ cwd, env: safeEnv, runProcess })
      : undefined);

  return runOpenHandsWorker({
    job,
    scopePack,
    openHands: selectedOpenHands,
    coderoom: selectedCoderoom,
    env: safeEnv,
    testMode: parseBoolean(safeEnv.OPENHANDS_TEST_MODE),
    now,
  });
}

export async function runProcessCommand(command, args = [], options = {}) {
  const { cwd = process.cwd(), env = process.env, timeoutMs = DEFAULT_TIMEOUT_MS, stdin = "" } = options;
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: false,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      resolve({
        ok: false,
        exit_code: null,
        stdout,
        stderr,
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
        ok: false,
        exit_code: null,
        stdout,
        stderr,
        output: compactOutput(error.message),
      });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        ok: code === 0,
        exit_code: code,
        stdout,
        stderr,
        output: compactOutput(`${stdout}\n${stderr}`),
      });
    });
    if (stdin) {
      child.stdin.write(stdin);
    }
    child.stdin.end();
  });
}

function extractUnifiedDiff(output) {
  const text = String(output ?? "");
  const fenced = text.match(/```(?:diff|patch)?\s*([\s\S]*?diff --git[\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const index = text.indexOf("diff --git ");
  return index === -1 ? "" : text.slice(index).trim();
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  runOpenHandsProof({
    filePath: getArg("file", process.env.OPENHANDS_PROOF_FILE || DEFAULT_PROOF_FILE),
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

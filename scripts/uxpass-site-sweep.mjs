#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_PATHS = ["/", "/dashboard", "/admin/you"];
const DEFAULT_MIN_SCORE = 80;

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  if (found) return found.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function argValues(name) {
  const prefix = `--${name}=`;
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (arg.startsWith(prefix)) values.push(arg.slice(prefix.length));
    if (arg === `--${name}` && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function trimTrailingSlash(value) {
  return String(value ?? "").replace(/\/+$/, "");
}

function splitList(value) {
  return String(value ?? "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function compactText(value, max = 500) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function resolveSweepTargets({ publicUrl, urls = [] } = {}) {
  const base = trimTrailingSlash(publicUrl || "https://unclick.world");
  const requested = unique(urls.length > 0 ? urls : DEFAULT_PATHS);
  return requested.map((url) => new URL(url, `${base}/`).toString());
}

async function postJson(fetchImpl, url, token, body) {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  let json = {};
  try {
    json = await res.json();
  } catch {
    json = {};
  }

  return { ok: res.ok, status: res.status, json };
}

function statusFromTargets(targets) {
  if (targets.some((target) => target.status === "failing")) return "failing";
  if (targets.some((target) => target.status === "blocked")) return "blocked";
  if (targets.some((target) => target.status === "pending")) return "pending";
  return "passing";
}

function actionNeeded(targets) {
  return targets
    .filter((target) => target.status === "failing" || target.status === "blocked")
    .map((target) => `${target.url}: ${target.summary}`);
}

function dryRunTarget(url, targetSha) {
  const runId = `dry-uxpass-${Buffer.from(url).toString("hex").slice(0, 12)}`;
  return {
    url,
    status: "passing",
    run_id: runId,
    ux_score: 100,
    summary: "Dry-run site sweep validated the UXPass sweep receipt shape.",
    proof: {
      kind: "uxpass_run",
      runId,
      targetUrl: url,
      target_sha: targetSha || null,
    },
  };
}

export async function runUxPassSiteSweep({
  apiBase = "https://unclick.world",
  publicUrl = "https://unclick.world",
  urls = [],
  token = "",
  targetSha = "",
  minScore = DEFAULT_MIN_SCORE,
  dryRun = false,
  now = new Date().toISOString(),
  fetchImpl = fetch,
} = {}) {
  const targets = resolveSweepTargets({ publicUrl, urls });
  const apiUrl = `${trimTrailingSlash(apiBase)}/api/uxpass-run`;

  if (dryRun) {
    const dryTargets = targets.map((url) => dryRunTarget(url, targetSha));
    return {
      kind: "uxpass_site_sweep_receipt",
      generated_at: now,
      status: "passing",
      target_sha: targetSha || null,
      min_score: minScore,
      targets: dryTargets,
      action_needed: [],
      summary: `Dry-run UXPass site sweep covered ${dryTargets.length} URL(s).`,
    };
  }

  if (!token) {
    const blockedTargets = targets.map((url) => ({
      url,
      status: "blocked",
      run_id: null,
      ux_score: null,
      summary: "Missing UXPASS_SITE_SWEEP_TOKEN, DOGFOOD_UXPASS_TOKEN, UXPASS_TOKEN, or CRON_SECRET.",
      proof: null,
    }));
    return {
      kind: "uxpass_site_sweep_receipt",
      generated_at: now,
      status: "blocked",
      target_sha: targetSha || null,
      min_score: minScore,
      targets: blockedTargets,
      action_needed: actionNeeded(blockedTargets),
      summary: "UXPass site sweep could not run because no token was available.",
    };
  }

  const sweptTargets = [];
  for (const url of targets) {
    try {
      const { ok, status, json } = await postJson(fetchImpl, apiUrl, token, {
        url,
        target_url: url,
        source: "site_sweep",
        target_sha: targetSha || undefined,
      });

      const runId = compactText(json.run_id || "", 160);
      const uxScore = typeof json.ux_score === "number" ? json.ux_score : null;
      const passed = ok && json.status === "complete" && (uxScore === null || uxScore >= minScore);
      sweptTargets.push({
        url,
        status: passed ? "passing" : "failing",
        run_id: runId || null,
        ux_score: uxScore,
        summary: passed
          ? `UXPass completed${uxScore === null ? "" : ` with score ${uxScore}`}.`
          : `UXPass returned HTTP ${status}, status ${json.status || "unknown"}${uxScore === null ? "" : `, score ${uxScore}`}.`,
        proof: runId
          ? {
              kind: "uxpass_run",
              runId,
              targetUrl: url,
              target_sha: targetSha || null,
            }
          : null,
      });
    } catch (error) {
      sweptTargets.push({
        url,
        status: "failing",
        run_id: null,
        ux_score: null,
        summary: `UXPass site sweep could not reach the API: ${error instanceof Error ? error.message : String(error)}`,
        proof: null,
      });
    }
  }

  const status = statusFromTargets(sweptTargets);
  return {
    kind: "uxpass_site_sweep_receipt",
    generated_at: now,
    status,
    target_sha: targetSha || null,
    min_score: minScore,
    targets: sweptTargets,
    action_needed: actionNeeded(sweptTargets),
    summary: `UXPass site sweep ${status} across ${sweptTargets.length} URL(s).`,
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  const dryRun = process.argv.includes("--dry-run") || process.env.UXPASS_SITE_SWEEP_DRY_RUN === "1";
  const allowNonPassing = process.argv.includes("--allow-non-passing")
    || process.env.UXPASS_SITE_SWEEP_ALLOW_NON_PASSING === "1";
  const outputPath = argValue("output", "public/dogfood/uxpass-site-sweep.json");
  const urls = [
    ...splitList(process.env.UXPASS_SITE_SWEEP_URLS),
    ...argValues("url"),
  ];
  const receipt = await runUxPassSiteSweep({
    apiBase: argValue("api-base", process.env.DOGFOOD_API_BASE || "https://unclick.world"),
    publicUrl: argValue("public-url", process.env.DOGFOOD_PUBLIC_URL || "https://unclick.world"),
    urls,
    token: process.env.UXPASS_SITE_SWEEP_TOKEN
      || process.env.DOGFOOD_UXPASS_TOKEN
      || process.env.UXPASS_TOKEN
      || process.env.CRON_SECRET
      || "",
    targetSha: argValue("target-sha", process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || ""),
    minScore: Number(argValue("min-score", process.env.UXPASS_SITE_SWEEP_MIN_SCORE || DEFAULT_MIN_SCORE)),
    dryRun,
  });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify({
    generated_at: receipt.generated_at,
    status: receipt.status,
    targets: receipt.targets.length,
    action_needed: receipt.action_needed.length,
    output: outputPath,
  }, null, 2));
  process.exitCode = receipt.status === "passing" || allowNonPassing ? 0 : 1;
}

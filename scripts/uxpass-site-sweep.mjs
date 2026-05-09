#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const DEFAULT_PATHS = ["/", "/dashboard", "/admin/you"];
const DEFAULT_MIN_SCORE = 80;
const DEFAULT_ALLOWED_ORIGINS = ["https://unclick.world", "https://www.unclick.world"];
const DEFAULT_VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];
const ISSUE_LIMIT = 20;

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

function normalizeOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function normalizeRouteTarget(url) {
  try {
    const parsed = new URL(url);
    return {
      url: parsed.toString(),
      origin: parsed.origin,
      path: `${parsed.pathname}${parsed.search}${parsed.hash}`,
    };
  } catch {
    return {
      url: compactText(url, 500),
      origin: "",
      path: "",
    };
  }
}

function normalizeViewport(value) {
  if (value && typeof value === "object") {
    const width = Number(value.width);
    const height = Number(value.height);
    if (Number.isFinite(width) && Number.isFinite(height)) {
      return {
        name: compactText(value.name || `${width}x${height}`, 80),
        width,
        height,
      };
    }
  }

  const text = String(value ?? "").trim();
  const named = text.match(/^([a-z0-9_-]+):(\d{2,5})x(\d{2,5})$/i);
  if (named) {
    return {
      name: named[1].toLowerCase(),
      width: Number(named[2]),
      height: Number(named[3]),
    };
  }

  const sized = text.match(/^(\d{2,5})x(\d{2,5})$/);
  if (sized) {
    return {
      name: text.toLowerCase(),
      width: Number(sized[1]),
      height: Number(sized[2]),
    };
  }

  return null;
}

export function resolveSweepViewports(values = []) {
  const source = values.length > 0 ? values : DEFAULT_VIEWPORTS;
  const normalized = source.map(normalizeViewport).filter(Boolean);
  return normalized.length > 0 ? normalized : DEFAULT_VIEWPORTS;
}

function normalizeIssue(issue) {
  if (!issue) return null;
  if (typeof issue === "string") {
    return { message: compactText(issue, 500) };
  }

  return {
    type: compactText(issue.type || issue.kind || "", 80) || null,
    severity: compactText(issue.severity || issue.level || "", 80) || null,
    message: compactText(issue.message || issue.text || issue.summary || JSON.stringify(issue), 500),
    source: compactText(issue.source || issue.url || "", 500) || null,
    viewport: compactText(issue.viewport || issue.viewport_name || "", 80) || null,
  };
}

function normalizeIssues(value) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list
    .map(normalizeIssue)
    .filter((issue) => issue && issue.message)
    .slice(0, ISSUE_LIMIT);
}

function issuesSummary(consoleIssues, layoutIssues) {
  const parts = [];
  if (consoleIssues.length > 0) parts.push(`${consoleIssues.length} console issue(s)`);
  if (layoutIssues.length > 0) parts.push(`${layoutIssues.length} layout issue(s)`);
  return parts.join(", ");
}

function viewportEvidence(viewports, captureStatus, { consoleIssues = [], layoutIssues = [], screenshotUrl = null } = {}) {
  return viewports.map((viewport) => ({
    name: viewport.name,
    width: viewport.width,
    height: viewport.height,
    capture_status: captureStatus,
    screenshot_url: screenshotUrl,
    console_issues: consoleIssues.filter((issue) => !issue.viewport || issue.viewport === viewport.name),
    layout_issues: layoutIssues.filter((issue) => !issue.viewport || issue.viewport === viewport.name),
  }));
}

function makeTarget({
  url,
  status,
  runId = null,
  uxScore = null,
  summary,
  proof = null,
  viewports,
  captureStatus,
  consoleIssues = [],
  layoutIssues = [],
  screenshotUrl = null,
}) {
  return {
    url,
    route_target: normalizeRouteTarget(url),
    status,
    run_id: runId,
    ux_score: uxScore,
    summary,
    proof,
    evidence: {
      viewports: viewportEvidence(viewports, captureStatus, { consoleIssues, layoutIssues, screenshotUrl }),
      console_issues: consoleIssues,
      layout_issues: layoutIssues,
    },
  };
}

function resolveAllowedOrigins(values = []) {
  return unique((values.length > 0 ? values : DEFAULT_ALLOWED_ORIGINS).map(normalizeOrigin));
}

function isAllowedOrigin(url, allowedOrigins) {
  const origin = normalizeOrigin(url);
  return Boolean(origin && allowedOrigins.includes(origin));
}

export function resolveSweepTargets({ publicUrl, urls = [] } = {}) {
  const base = trimTrailingSlash(publicUrl || "https://unclick.world");
  const requested = unique(urls.length > 0 ? urls : DEFAULT_PATHS);
  return requested.map((url) => new URL(url, `${base}/`).toString());
}

function blockedOriginTarget(target, allowedOrigins, viewports = DEFAULT_VIEWPORTS) {
  return makeTarget({
    url: target,
    status: "blocked",
    summary: `Target origin is outside the owned-origin allowlist: ${allowedOrigins.join(", ")}.`,
    viewports: resolveSweepViewports(viewports),
    captureStatus: "blocked_off_origin",
  });
}

export function splitAllowedSweepTargets(targets, allowedOrigins, viewports = DEFAULT_VIEWPORTS) {
  const allowed = [];
  const blocked = [];
  for (const target of targets) {
    if (isAllowedOrigin(target, allowedOrigins)) {
      allowed.push(target);
    } else {
      blocked.push(blockedOriginTarget(target, allowedOrigins, viewports));
    }
  }
  return { allowed, blocked };
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

function gateStatus(status) {
  if (status === "passing") return "passed";
  if (status === "failing") return "failed";
  if (status === "blocked") return "blocked";
  if (status === "pending") return "skipped";
  return "missing";
}

function receiptRunId({ status, targetSha, now }) {
  const source = `${status}:${targetSha || "no-sha"}:${now}`;
  return `uxpass-site-sweep-${createHash("sha256").update(source).digest("hex").slice(0, 16)}`;
}

function withGateResult(receipt, { publicUrl }) {
  return {
    ...receipt,
    check: "uxpass",
    name: "UXPass",
    xpass_gate_result: {
      check: "uxpass",
      name: "UXPass",
      status: gateStatus(receipt.status),
      run_id: receipt.run_id,
      target_sha: receipt.target_sha || null,
      url: publicUrl,
      summary: receipt.summary,
      generated_at: receipt.generated_at,
    },
  };
}

function makeReceipt({ now, status, targetSha, minScore, allowedOrigins, viewports, targets, summary, publicUrl }) {
  return withGateResult({
    kind: "uxpass_site_sweep_receipt",
    check: "uxpass",
    name: "UXPass",
    generated_at: now,
    run_id: receiptRunId({ status, targetSha, now }),
    status,
    target_sha: targetSha || null,
    min_score: minScore,
    allowed_origins: allowedOrigins,
    viewports,
    targets,
    action_needed: actionNeeded(targets),
    summary,
  }, { publicUrl });
}

export async function runUxPassSiteSweep({
  apiBase = "https://unclick.world",
  publicUrl = "https://unclick.world",
  urls = [],
  token = "",
  targetSha = "",
  minScore = DEFAULT_MIN_SCORE,
  dryRun = false,
  allowedOrigins = DEFAULT_ALLOWED_ORIGINS,
  viewports = DEFAULT_VIEWPORTS,
  now = new Date().toISOString(),
  fetchImpl = fetch,
} = {}) {
  const targets = resolveSweepTargets({ publicUrl, urls });
  const ownedOrigins = resolveAllowedOrigins(allowedOrigins);
  const sweepViewports = resolveSweepViewports(viewports);
  const apiUrl = `${trimTrailingSlash(apiBase)}/api/uxpass-run`;

  if (dryRun) {
    const dryTargets = targets.map((url) => {
      const dryTarget = dryRunTarget(url, targetSha);
      return makeTarget({
        url: dryTarget.url,
        status: dryTarget.status,
        runId: dryTarget.run_id,
        uxScore: dryTarget.ux_score,
        summary: dryTarget.summary,
        proof: dryTarget.proof,
        viewports: sweepViewports,
        captureStatus: "dry_run",
      });
    });
    return makeReceipt({
      now,
      status: "passing",
      targetSha,
      minScore,
      allowedOrigins: ownedOrigins,
      viewports: sweepViewports,
      targets: dryTargets,
      summary: `Dry-run UXPass site sweep covered ${dryTargets.length} URL(s).`,
      publicUrl,
    });
  }

  const { allowed: allowedTargets, blocked: blockedTargets } = splitAllowedSweepTargets(targets, ownedOrigins, sweepViewports);
  if (!isAllowedOrigin(apiUrl, ownedOrigins)) {
    const apiBlockedTargets = targets.map((url) => makeTarget({
      url,
      status: "blocked",
      summary: `UXPass API origin is outside the owned-origin allowlist: ${ownedOrigins.join(", ")}.`,
      viewports: sweepViewports,
      captureStatus: "blocked_api_origin",
    }));
    return makeReceipt({
      now,
      status: "blocked",
      targetSha,
      minScore,
      allowedOrigins: ownedOrigins,
      viewports: sweepViewports,
      targets: apiBlockedTargets,
      summary: "UXPass site sweep could not run because the API origin is not allowed.",
      publicUrl,
    });
  }

  if (allowedTargets.length === 0) {
    return makeReceipt({
      now,
      status: "blocked",
      targetSha,
      minScore,
      allowedOrigins: ownedOrigins,
      viewports: sweepViewports,
      targets: blockedTargets,
      summary: "UXPass site sweep did not run because every target was outside the owned-origin allowlist.",
      publicUrl,
    });
  }

  if (!token) {
    const missingTokenTargets = allowedTargets.map((url) => makeTarget({
      url,
      status: "blocked",
      summary: "Missing UXPASS_SITE_SWEEP_TOKEN, DOGFOOD_UXPASS_TOKEN, UXPASS_TOKEN, or CRON_SECRET.",
      proof: {
        kind: "safe_fallback_receipt",
        reason: "missing_credential",
        targetUrl: url,
        target_sha: targetSha || null,
      },
      viewports: sweepViewports,
      captureStatus: "skipped_missing_credential",
    }));
    return makeReceipt({
      now,
      status: "blocked",
      targetSha,
      minScore,
      allowedOrigins: ownedOrigins,
      viewports: sweepViewports,
      targets: [...missingTokenTargets, ...blockedTargets],
      summary: "UXPass site sweep could not run because no token was available.",
      publicUrl,
    });
  }

  const sweptTargets = [...blockedTargets];
  for (const url of allowedTargets) {
    try {
      const { ok, status, json } = await postJson(fetchImpl, apiUrl, token, {
        url,
        target_url: url,
        source: "site_sweep",
        target_sha: targetSha || undefined,
      });

      const runId = compactText(json.run_id || "", 160);
      const uxScore = typeof json.ux_score === "number" ? json.ux_score : null;
      const consoleIssues = normalizeIssues(json.console_issues || json.consoleIssues);
      const layoutIssues = normalizeIssues(json.layout_issues || json.layoutIssues);
      const issueSummary = issuesSummary(consoleIssues, layoutIssues);
      const passed = ok
        && json.status === "complete"
        && (uxScore === null || uxScore >= minScore)
        && consoleIssues.length === 0
        && layoutIssues.length === 0;
      sweptTargets.push(makeTarget({
        url,
        status: passed ? "passing" : "failing",
        runId: runId || null,
        uxScore,
        summary: passed
          ? `UXPass completed${uxScore === null ? "" : ` with score ${uxScore}`}.`
          : `UXPass returned HTTP ${status}, status ${json.status || "unknown"}${uxScore === null ? "" : `, score ${uxScore}`}${issueSummary ? `, ${issueSummary}` : ""}.`,
        proof: runId
          ? {
              kind: "uxpass_run",
              runId,
              targetUrl: url,
              target_sha: targetSha || null,
            }
          : null,
        viewports: sweepViewports,
        captureStatus: "api_receipt",
        consoleIssues,
        layoutIssues,
        screenshotUrl: compactText(json.screenshot_url || json.screenshotUrl || "", 500) || null,
      }));
    } catch (error) {
      sweptTargets.push(makeTarget({
        url,
        status: "failing",
        summary: `UXPass site sweep could not reach the API: ${error instanceof Error ? error.message : String(error)}`,
        viewports: sweepViewports,
        captureStatus: "api_unreachable",
      }));
    }
  }

  const status = statusFromTargets(sweptTargets);
  return makeReceipt({
    now,
    status,
    targetSha,
    minScore,
    allowedOrigins: ownedOrigins,
    viewports: sweepViewports,
    targets: sweptTargets,
    summary: `UXPass site sweep ${status} across ${sweptTargets.length} URL(s).`,
    publicUrl,
  });
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
  const viewports = [
    ...splitList(process.env.UXPASS_SITE_SWEEP_VIEWPORTS),
    ...argValues("viewport"),
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
    allowedOrigins: splitList(process.env.UXPASS_SITE_SWEEP_ALLOWED_ORIGINS),
    viewports,
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

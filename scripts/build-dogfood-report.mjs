#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || process.env.DOGFOOD_DRY_RUN === "1";
const outputIndex = process.argv.indexOf("--output");
const outputPath =
  outputIndex >= 0 && process.argv[outputIndex + 1]
    ? process.argv[outputIndex + 1]
    : "public/dogfood/latest.json";

const apiBase = trimTrailingSlash(process.env.DOGFOOD_API_BASE || "https://unclick.world");
const publicUrl = process.env.DOGFOOD_PUBLIC_URL || "https://unclick.world";
const mcpUrl = process.env.DOGFOOD_MCP_URL || "https://unclick.world/api/mcp";
const generatedAt = new Date().toISOString();

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function statusFromFailureKind(failureKind) {
  if (failureKind === "missing_secret") return "blocked";
  if (failureKind === "network" || failureKind === "http" || failureKind === "parse") return "failing";
  return "pending";
}

function result(id, name, status, summary, evidence, details = {}) {
  return { id, name, status, summary, evidence, checkedAt: generatedAt, ...details };
}

function pendingResult(id, name, summary, evidence) {
  return result(id, name, "pending", summary, evidence);
}

function blockedResult(id, name, summary, evidence, blockedReason) {
  return result(id, name, "blocked", summary, evidence, { blockedReason });
}

function failureResult(id, name, summary, evidence) {
  return result(id, name, "failing", summary, evidence);
}

function passResult(id, name, summary, evidence) {
  return result(id, name, "passing", summary, evidence);
}

async function postJson(url, token, body) {
  const res = await fetch(url, {
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

async function runTestPass() {
  const token = process.env.DOGFOOD_TESTPASS_TOKEN || process.env.TESTPASS_TOKEN || "";
  if (dryRun) {
    return passResult(
      "testpass",
      "TestPass",
      "Dry-run receipt builder validated the TestPass result shape.",
      "Dry run only. Live workflow calls /api/testpass-run with source=scheduled.",
    );
  }
  if (!token) {
    return blockedResult(
      "testpass",
      "TestPass",
      "Scheduled TestPass could not run because DOGFOOD_TESTPASS_TOKEN or TESTPASS_TOKEN is missing.",
      "Set the GitHub secret so the nightly dogfood workflow can create a fresh testpass_runs row.",
      "Missing DOGFOOD_TESTPASS_TOKEN or TESTPASS_TOKEN.",
    );
  }

  try {
    const { ok, status, json } = await postJson(`${apiBase}/api/testpass-run`, token, {
      pack_id: "testpass-core",
      profile: "smoke",
      server_url: mcpUrl,
      source: "scheduled",
    });

    if (!ok) {
      return failureResult(
        "testpass",
        "TestPass",
        `Scheduled TestPass API call returned HTTP ${status}.`,
        json.error ? `API error: ${json.error}` : "The API did not return an error body.",
      );
    }

    const summary = json.verdict_summary || {};
    const failCount = Number(summary.fail || 0);
    const total = Number(summary.total || 0);
    const runId = json.run_id || "unknown";
    if (json.status === "complete" && failCount === 0) {
      return passResult(
        "testpass",
        "TestPass",
        `Scheduled TestPass completed with ${total} checks and 0 failures.`,
        `Run ${runId} checked ${mcpUrl}.`,
      );
    }

    const statusLabel = json.status || "unknown";
    return result(
      "testpass",
      "TestPass",
      statusFromFailureKind(statusLabel === "running" ? "pending" : "http"),
      `Scheduled TestPass returned status ${statusLabel} with ${failCount} failures.`,
      `Run ${runId} checked ${mcpUrl}.`,
    );
  } catch (err) {
    return failureResult(
      "testpass",
      "TestPass",
      "Scheduled TestPass could not reach the API.",
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function runUXPass() {
  const token = process.env.DOGFOOD_UXPASS_TOKEN || process.env.UXPASS_TOKEN || process.env.CRON_SECRET || "";
  if (dryRun) {
    return passResult(
      "uxpass",
      "UXPass",
      "Dry-run receipt builder validated the UXPass result shape.",
      "Dry run only. Live workflow calls /api/uxpass-run against the public URL.",
    );
  }
  if (!token) {
    return blockedResult(
      "uxpass",
      "UXPass",
      "Scheduled UXPass could not run because DOGFOOD_UXPASS_TOKEN, UXPASS_TOKEN, or CRON_SECRET is missing.",
      "Set one workflow secret so the nightly dogfood workflow can create a fresh uxpass_runs row.",
      "Missing DOGFOOD_UXPASS_TOKEN, UXPASS_TOKEN, or CRON_SECRET.",
    );
  }

  try {
    const { ok, status, json } = await postJson(`${apiBase}/api/uxpass-run`, token, {
      url: publicUrl,
      target_url: publicUrl,
    });

    if (!ok) {
      return failureResult(
        "uxpass",
        "UXPass",
        `Scheduled UXPass API call returned HTTP ${status}.`,
        json.error ? `API error: ${json.error}` : "The API did not return an error body.",
      );
    }

    const runId = json.run_id || "unknown";
    const uxScore = typeof json.ux_score === "number" ? json.ux_score : null;
    if (json.status === "complete" && (uxScore === null || uxScore >= 80)) {
      return passResult(
        "uxpass",
        "UXPass",
        `Scheduled UXPass completed${uxScore === null ? "" : ` with UX score ${uxScore}`}.`,
        `Run ${runId} checked ${publicUrl}.`,
      );
    }

    return failureResult(
      "uxpass",
      "UXPass",
      `Scheduled UXPass returned status ${json.status || "unknown"}${uxScore === null ? "" : ` with UX score ${uxScore}`}.`,
      `Run ${runId} checked ${publicUrl}.`,
    );
  } catch (err) {
    return failureResult(
      "uxpass",
      "UXPass",
      "Scheduled UXPass could not reach the API.",
      err instanceof Error ? err.message : String(err),
    );
  }
}

function buildTrend(results) {
  const today = generatedAt.slice(0, 10);
  return [{
    date: today,
    passing: results.filter((result) => result.status === "passing").length,
    failing: results.filter((result) => result.status === "failing").length,
    blocked: results.filter((result) => result.status === "blocked").length,
    pending: results.filter((result) => result.status === "pending").length,
  }];
}

function buildStatus(results) {
  if (results.some((result) => result.status === "failing")) return "failing";
  if (results.some((result) => result.status === "blocked")) return "blocked";
  if (results.some((result) => result.status === "pending")) return "pending";
  return "passing";
}

function buildLastActionableFailure(results) {
  const failing = results.find((result) => result.status === "failing" || result.status === "blocked");
  if (!failing) {
    return {
      title: "No actionable dogfood failure in the latest receipt",
      detail: "The live checks that ran in this receipt did not report a blocking failure.",
      owner: "Dogfood automation",
    };
  }

  return {
    title: `${failing.name} needs attention`,
    detail: failing.blockedReason ? `${failing.summary} Blocked reason: ${failing.blockedReason}` : failing.summary,
    owner: "Dogfood automation",
  };
}

const results = [
  await runTestPass(),
  await runUXPass(),
  pendingResult(
    "seopass",
    "SEOPass",
    "Queued for recurring search and metadata review.",
    "SEOPass is still scaffold-only for public dogfood receipts.",
  ),
  pendingResult(
    "copypass",
    "CopyPass",
    "Queued for recurring copy quality review.",
    "CopyPass recurring public receipts will land after the runner surface is available.",
  ),
  pendingResult(
    "legalpass",
    "LegalPass",
    "Queued for recurring policy and claims review.",
    "LegalPass recurring public receipts will land after the runner surface is available.",
  ),
];

const report = {
  generatedAt,
  lastRunAt: generatedAt,
  status: buildStatus(results),
  source: dryRun ? "dogfood receipt dry run" : "nightly dogfood workflow",
  headline: "We dogfood UnClick on UnClick.",
  target: "UnClick public and agent-facing product surfaces",
  nextAutomation: "Nightly dogfood receipts refresh this board with live scheduled evidence.",
  results,
  trend: buildTrend(results),
  lastActionableFailure: buildLastActionableFailure(results),
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Wrote dogfood report to ${outputPath}`);
console.log(JSON.stringify({
  generatedAt: report.generatedAt,
  status: report.status,
  passing: report.trend[0].passing,
  failing: report.trend[0].failing,
  blocked: report.trend[0].blocked,
  pending: report.trend[0].pending,
}, null, 2));

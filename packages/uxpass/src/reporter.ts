/**
 * reporter - HTML, JSON, and Markdown reports for a UXPass run.
 *
 * Reads the run + findings via run-manager and renders self-contained
 * output. The JSON shape is the natural superset (run row plus findings array)
 * and the HTML/Markdown reports format the same data for humans.
 */

import { getRunWithFindings, type RunManagerConfig } from "./run-manager.js";
import type { RunBreakdown, UxpassFindingRow, UxpassRunRow } from "./types.js";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function severityBadge(severity: string): string {
  const colour: Record<string, string> = {
    critical: "#b91c1c",
    high: "#dc2626",
    medium: "#d97706",
    low: "#65a30d",
  };
  return `<span style="display:inline-block;padding:2px 8px;border-radius:6px;background:${colour[severity] ?? "#525252"};color:#fff;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">${escapeHtml(severity)}</span>`;
}

export async function generateJsonReport(
  config: RunManagerConfig,
  runId: string,
  actorUserId: string,
): Promise<{ run: UxpassRunRow; findings: UxpassFindingRow[] }> {
  const data = await getRunWithFindings(config, runId, actorUserId);
  if (!data.run) throw new Error(`Run not found: ${runId}`);
  return { run: data.run, findings: data.findings };
}

export async function generateMarkdownReport(
  config: RunManagerConfig,
  runId: string,
  actorUserId: string,
): Promise<string> {
  const { run, findings } = await generateJsonReport(config, runId, actorUserId);
  const score = run.ux_score === null ? "-" : run.ux_score.toFixed(1);
  const breakdown = run.breakdown as RunBreakdown | undefined;

  const lines: string[] = [];
  lines.push(`# UXPass Report ${run.id}`);
  lines.push("");
  lines.push(`- Target: \`${run.target_url}\``);
  lines.push(`- Status: \`${run.status}\``);
  lines.push(`- UX Score: **${score}**`);
  if (run.summary) lines.push(`- Summary: ${run.summary}`);
  lines.push(`- Started: ${run.started_at}`);
  if (run.completed_at) lines.push(`- Completed: ${run.completed_at}`);
  if (run.error) lines.push(`- Error: ${run.error}`);
  lines.push(`- Findings: ${findings.length} failing`);
  lines.push("");

  if (breakdown && typeof breakdown === "object" && "by_hat" in breakdown) {
    const byHat = breakdown.by_hat ?? {};
    if (Object.keys(byHat).length > 0) {
      lines.push("## Hat breakdown");
      lines.push("");
      lines.push("| Hat | Pass | Fail | N/A |");
      lines.push("| --- | ---: | ---: | ---: |");
      for (const [hat, stats] of Object.entries(byHat)) {
        lines.push(`| ${hat} | ${stats.pass} | ${stats.fail} | ${stats.na} |`);
      }
      lines.push("");
    }
  }

  if (findings.length === 0) {
    lines.push("_No failing checks._");
    return lines.join("\n") + "\n";
  }

  lines.push("## Failing checks");
  lines.push("");
  for (const f of findings) {
    lines.push(`- [ ] **${f.title}** (${f.severity}, ${f.hat_id})`);
    if (f.description) lines.push(`  - ${f.description}`);
    const remediation = Array.isArray(f.remediation) ? f.remediation : [];
    for (const r of remediation) {
      lines.push(`  - Fix: ${r}`);
    }
  }
  lines.push("");
  return lines.join("\n") + "\n";
}

export async function generateHtmlReport(
  config: RunManagerConfig,
  runId: string,
  actorUserId: string,
): Promise<string> {
  const { run, findings } = await generateJsonReport(config, runId, actorUserId);
  const score = run.ux_score === null ? "-" : run.ux_score.toFixed(1);
  const breakdown = run.breakdown as RunBreakdown | undefined;

  const findingRows = findings
    .map((f) => {
      const remediation = Array.isArray(f.remediation) ? f.remediation : [];
      const remediationHtml = remediation.length > 0
        ? `<ul style="margin:.25rem 0 0 1rem;padding:0;color:#1f2937;">${remediation.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`
        : "";
      const desc = f.description ? `<div style="font-size:11px;color:#525252;margin-top:.25rem;">${escapeHtml(f.description)}</div>` : "";
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-family:ui-monospace,monospace;">${escapeHtml(f.hat_id)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${severityBadge(f.severity)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(f.title)}${desc}${remediationHtml}</td>
      </tr>`;
    })
    .join("\n");

  const breakdownRows = breakdown && typeof breakdown === "object" && "by_hat" in breakdown
    ? Object.entries(breakdown.by_hat ?? {})
        .map(([hat, s]) => `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(hat)}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;color:#15803d;">${s.pass}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;color:#b91c1c;">${s.fail}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;color:#525252;">${s.na}</td></tr>`)
        .join("\n")
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>UXPass Report ${escapeHtml(run.id)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; max-width: 960px; margin: 2rem auto; padding: 0 1rem; color: #1f2937; }
  h1 { margin-bottom: .25rem; }
  h2 { margin-top: 2rem; }
  .meta { color: #6b7280; font-size: 14px; }
  .score { display:inline-block; margin-top:.5rem; padding:.5rem 1rem; border-radius:8px; background:#0f172a; color:#fff; font-size:1.25rem; font-weight:600; }
  table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 14px; }
  th { text-align: left; padding: 8px; border-bottom: 2px solid #1f2937; background:#f9fafb; }
</style>
</head>
<body>
  <h1>UXPass Report</h1>
  <div class="meta">Run id: <code>${escapeHtml(run.id)}</code></div>
  <div class="meta">Target: <a href="${escapeHtml(run.target_url)}">${escapeHtml(run.target_url)}</a></div>
  <div class="meta">Status: ${escapeHtml(run.status)}</div>
  ${run.summary ? `<div class="meta">${escapeHtml(run.summary)}</div>` : ""}
  <div class="score">UX Score ${escapeHtml(score)}</div>

  ${breakdownRows ? `<h2>Hat breakdown</h2>
  <table>
    <thead><tr><th>Hat</th><th style="text-align:right;">Pass</th><th style="text-align:right;">Fail</th><th style="text-align:right;">N/A</th></tr></thead>
    <tbody>${breakdownRows}</tbody>
  </table>` : ""}

  <h2>Findings (${findings.length})</h2>
  ${findings.length === 0 ? `<p class="meta">No failing checks.</p>` : `<table>
    <thead><tr><th>Hat</th><th>Severity</th><th>Detail</th></tr></thead>
    <tbody>${findingRows}</tbody>
  </table>`}

  <p class="meta" style="margin-top:2rem;">Generated by UXPass deterministic runner. LLM hat panel and Playwright capture land in later chunks.</p>
</body>
</html>`;
}

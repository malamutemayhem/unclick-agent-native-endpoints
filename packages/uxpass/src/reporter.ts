/**
 * reporter - HTML, JSON, and Markdown reports for a UXPass run.
 *
 * Reads the run + findings via run-manager and renders self-contained
 * output. Mirrors the testpass reporter shape so the API can serve the
 * same three formats agents already expect.
 */

import { getRunWithFindings, type RunManagerConfig } from "./run-manager.js";
import type { UxpassRunRow, UxpassFindingRow } from "./types.js";

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
    info: "#525252",
  };
  return `<span style="display:inline-block;padding:2px 8px;border-radius:6px;background:${colour[severity] ?? "#525252"};color:#fff;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">${escapeHtml(severity)}</span>`;
}

function verdictGlyph(verdict: string): string {
  if (verdict === "pass") return "✓";
  if (verdict === "fail") return "✗";
  if (verdict === "na") return "-";
  return "?";
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
  const targetUrl = (run.target as { url?: string })?.url ?? "(unknown)";
  const score = run.ux_score === null ? "-" : run.ux_score.toFixed(1);
  const fails = findings.filter((f) => f.verdict === "fail");

  const lines: string[] = [];
  lines.push(`# UXPass Report ${run.id}`);
  lines.push("");
  lines.push(`- Target: \`${targetUrl}\``);
  lines.push(`- Status: \`${run.status}\``);
  lines.push(`- UX Score: **${score}**`);
  lines.push(`- Started: ${run.started_at}`);
  if (run.completed_at) lines.push(`- Completed: ${run.completed_at}`);
  lines.push(`- Findings: ${findings.length} total, ${fails.length} failing`);
  lines.push("");

  if (fails.length === 0) {
    lines.push("_All deterministic checks passed._");
    return lines.join("\n") + "\n";
  }

  lines.push("## Failing checks");
  lines.push("");
  for (const f of fails) {
    lines.push(`- [ ] **${f.check_id}** (${f.severity}, ${f.hat}) - ${f.title}`);
    if (f.remediation) lines.push(`  - ${f.remediation.trim()}`);
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
  const targetUrl = (run.target as { url?: string })?.url ?? "(unknown)";
  const score = run.ux_score === null ? "-" : run.ux_score.toFixed(1);

  const rows = findings
    .map((f) => {
      const evidence = f.evidence && Object.keys(f.evidence).length > 0
        ? `<pre style="margin:0;font-size:11px;color:#525252;">${escapeHtml(JSON.stringify(f.evidence))}</pre>`
        : "";
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-family:ui-monospace,monospace;">${escapeHtml(f.check_id)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(f.hat)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${severityBadge(f.severity)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:18px;">${verdictGlyph(f.verdict)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(f.title)}${evidence}</td>
      </tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>UXPass Report ${escapeHtml(run.id)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; max-width: 960px; margin: 2rem auto; padding: 0 1rem; color: #1f2937; }
  h1 { margin-bottom: .25rem; }
  .meta { color: #6b7280; font-size: 14px; }
  .score { display:inline-block; margin-top:.5rem; padding:.5rem 1rem; border-radius:8px; background:#0f172a; color:#fff; font-size:1.25rem; font-weight:600; }
  table { width: 100%; border-collapse: collapse; margin-top: 1.5rem; font-size: 14px; }
  th { text-align: left; padding: 8px; border-bottom: 2px solid #1f2937; background:#f9fafb; }
</style>
</head>
<body>
  <h1>UXPass Report</h1>
  <div class="meta">Run id: <code>${escapeHtml(run.id)}</code></div>
  <div class="meta">Target: <a href="${escapeHtml(targetUrl)}">${escapeHtml(targetUrl)}</a></div>
  <div class="meta">Status: ${escapeHtml(run.status)}</div>
  <div class="score">UX Score ${escapeHtml(score)}</div>
  <table>
    <thead>
      <tr>
        <th>Check</th><th>Hat</th><th>Severity</th><th>Verdict</th><th>Title</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <p class="meta" style="margin-top:2rem;">Generated by UXPass deterministic runner. LLM hat panel and Playwright capture land in later chunks.</p>
</body>
</html>`;
}

/**
 * reporter - Evidence report generators for TestPass runs.
 *
 * Three output formats:
 *   - HTML: self-contained (inline CSS + JS, screenshot <img> as base64 data URIs).
 *   - JSON: raw run + items data plus generation timestamp.
 *   - Markdown: fix-list grouped by severity for engineering triage.
 *
 * All formats fetch from Supabase REST via the same supaFetch helper
 * used by run-manager, so no Supabase SDK dependency is introduced.
 */

import { readFile } from "node:fs/promises";
import type { RunManagerConfig } from "./run-manager.js";

interface RunRow {
  id: string;
  pack_id: string;
  target: { type: string; url?: string; commit?: string; branch?: string };
  profile: string;
  status: string;
  actor_user_id: string;
  verdict_summary: {
    total: number;
    check: number;
    na: number;
    fail: number;
    other: number;
    pending: number;
    pass_rate: number;
  };
  created_at: string;
  completed_at: string | null;
}

interface ItemRow {
  id: string;
  run_id: string;
  check_id: string;
  title: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  verdict: "check" | "na" | "fail" | "other" | "pending";
  on_fail_comment: string | null;
  time_ms: number | null;
  cost_usd: number | null;
  evidence_ref: string | null;
  created_at: string;
}

interface EvidenceRow {
  id: string;
  kind: string;
  payload: Record<string, unknown> | null;
}

async function supaGet(
  config: RunManagerConfig,
  path: string
): Promise<unknown> {
  const res = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase GET ${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function fetchRunAndItems(
  config: RunManagerConfig,
  runId: string
): Promise<{ run: RunRow; items: ItemRow[]; evidence: Map<string, EvidenceRow> }> {
  const [runRows, items] = await Promise.all([
    supaGet(config, `testpass_runs?id=eq.${runId}&select=*&limit=1`) as Promise<RunRow[]>,
    supaGet(
      config,
      `testpass_items?run_id=eq.${runId}&select=*&order=severity.asc,check_id.asc`
    ) as Promise<ItemRow[]>,
  ]);
  if (!runRows || runRows.length === 0) {
    throw new Error(`Run ${runId} not found`);
  }

  const refs = Array.from(
    new Set((items ?? []).map((i) => i.evidence_ref).filter((v): v is string => !!v))
  );
  let evidence: EvidenceRow[] = [];
  if (refs.length > 0) {
    const list = refs.map((r) => `"${r}"`).join(",");
    evidence = (await supaGet(
      config,
      `testpass_evidence?id=in.(${encodeURIComponent(list)})&select=id,kind,payload`
    )) as EvidenceRow[];
  }
  const evidenceMap = new Map<string, EvidenceRow>();
  for (const e of evidence ?? []) evidenceMap.set(e.id, e);

  return { run: runRows[0], items: items ?? [], evidence: evidenceMap };
}

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const VERDICT_COLORS: Record<string, string> = {
  check: "#16a34a",
  na: "#6b7280",
  fail: "#dc2626",
  other: "#d97706",
  pending: "#2563eb",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#eab308",
  low: "#6b7280",
};

function badge(label: string, color: string): string {
  return `<span class="badge" style="background:${color}">${escapeHtml(label)}</span>`;
}

function mimeFromPath(p: string): string {
  const ext = p.toLowerCase().split(".").pop() ?? "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "svg") return "image/svg+xml";
  return "image/png";
}

// Resolve a screenshot evidence row to an inline HTML snippet.
// Tries payload.value then payload.path; a data URI is used as-is,
// a readable file is inlined as base64, and anything else falls back to plain text.
async function renderScreenshot(ev: EvidenceRow): Promise<string> {
  if (ev.kind !== "screenshot") return "";
  const p = ev.payload ?? {};
  const raw = (p.value ?? p.path ?? "") as string;
  if (!raw || typeof raw !== "string") return "";

  if (raw.startsWith("data:image/")) {
    return `<img src="${escapeHtml(raw)}" alt="screenshot" class="shot">`;
  }

  try {
    const buf = await readFile(raw);
    const mime = mimeFromPath(raw);
    const b64 = buf.toString("base64");
    return `<img src="data:${mime};base64,${b64}" alt="screenshot" class="shot">`;
  } catch {
    return `<span class="shot-fallback">${escapeHtml(raw)}</span>`;
  }
}

export async function generateHtmlReport(
  config: RunManagerConfig,
  runId: string
): Promise<string> {
  const { run, items, evidence } = await fetchRunAndItems(config, runId);
  const s = run.verdict_summary ?? {
    total: items.length, check: 0, na: 0, fail: 0, other: 0, pending: 0, pass_rate: 0,
  };
  const passPct = (s.pass_rate * 100).toFixed(1);
  const targetUrl = run.target?.url ?? "";
  const completedAt = run.completed_at ?? "(in progress)";

  const rowHtml = await Promise.all(
    items.map(async (item, idx) => {
      const sevColor = SEVERITY_COLORS[item.severity] ?? "#6b7280";
      const verdColor = VERDICT_COLORS[item.verdict] ?? "#6b7280";
      const ev = item.evidence_ref ? evidence.get(item.evidence_ref) : undefined;
      const evidenceCell = ev && ev.kind === "screenshot" ? await renderScreenshot(ev) : "";
      return `<tr data-severity="${escapeHtml(item.severity)}" data-verdict="${escapeHtml(item.verdict)}">
        <td>${idx + 1}</td>
        <td><code>${escapeHtml(item.check_id)}</code></td>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(item.category)}</td>
        <td>${badge(item.severity, sevColor)}</td>
        <td>${badge(item.verdict, verdColor)}</td>
        <td>${escapeHtml(item.on_fail_comment ?? "")}</td>
        <td>${evidenceCell}</td>
      </tr>`;
    })
  );
  const rows = rowHtml.join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>TestPass Report - ${escapeHtml(run.id)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px; background: #f9fafb; color: #111827; }
  h1 { margin: 0 0 8px; font-size: 22px; }
  .meta { color: #4b5563; font-size: 13px; margin-bottom: 16px; }
  .meta code { background: #e5e7eb; padding: 1px 6px; border-radius: 4px; font-size: 12px; }
  .summary { display: flex; gap: 12px; flex-wrap: wrap; margin: 16px 0 24px; }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; min-width: 90px; }
  .card .label { font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; }
  .card .value { font-size: 20px; font-weight: 600; margin-top: 4px; }
  .card.pass { border-color: #16a34a; }
  .card.fail { border-color: #dc2626; }
  .card.na { border-color: #6b7280; }
  .card.other { border-color: #d97706; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #f3f4f6; font-size: 13px; vertical-align: top; }
  th { background: #f3f4f6; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #374151; cursor: pointer; user-select: none; }
  th:hover { background: #e5e7eb; }
  tr:last-child td { border-bottom: none; }
  code { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 12px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; color: #fff; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
  .shot { max-width: 240px; max-height: 160px; border: 1px solid #e5e7eb; border-radius: 4px; display: block; }
  .shot-fallback { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 11px; color: #9ca3af; word-break: break-all; }
  .footer { margin-top: 24px; font-size: 11px; color: #9ca3af; }
</style>
</head>
<body>
<h1>TestPass Evidence Report</h1>
<div class="meta">
  Run <code>${escapeHtml(run.id)}</code> &middot; Pack <code>${escapeHtml(run.pack_id)}</code> &middot; Profile <code>${escapeHtml(run.profile)}</code> &middot; Target <code>${escapeHtml(targetUrl)}</code><br>
  Status <code>${escapeHtml(run.status)}</code> &middot; Started ${escapeHtml(run.created_at)} &middot; Completed ${escapeHtml(completedAt)}
</div>
<div class="summary">
  <div class="card pass"><div class="label">Pass rate</div><div class="value">${passPct}%</div></div>
  <div class="card"><div class="label">Total</div><div class="value">${s.total}</div></div>
  <div class="card pass"><div class="label">Check</div><div class="value">${s.check}</div></div>
  <div class="card na"><div class="label">N/A</div><div class="value">${s.na}</div></div>
  <div class="card fail"><div class="label">Fail</div><div class="value">${s.fail}</div></div>
  <div class="card other"><div class="label">Other</div><div class="value">${s.other}</div></div>
</div>
<table id="items">
  <thead>
    <tr>
      <th data-col="0" data-type="num">#</th>
      <th data-col="1">Check ID</th>
      <th data-col="2">Title</th>
      <th data-col="3">Category</th>
      <th data-col="4">Severity</th>
      <th data-col="5">Verdict</th>
      <th data-col="6">On-fail comment</th>
      <th data-col="7">Evidence</th>
    </tr>
  </thead>
  <tbody>
${rows}
  </tbody>
</table>
<div class="footer">Generated ${escapeHtml(new Date().toISOString())} by UnClick TestPass</div>
<script>
(function() {
  var SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  var VERD_ORDER = { fail: 0, other: 1, pending: 2, check: 3, na: 4 };
  var state = {};
  var table = document.getElementById('items');
  if (!table) return;
  var headers = table.querySelectorAll('th');
  headers.forEach(function(th) {
    th.addEventListener('click', function() {
      var col = parseInt(th.getAttribute('data-col'), 10);
      var type = th.getAttribute('data-type') || 'text';
      var dir = state.col === col && state.dir === 'asc' ? 'desc' : 'asc';
      state = { col: col, dir: dir };
      var tbody = table.tBodies[0];
      var rows = Array.prototype.slice.call(tbody.rows);
      rows.sort(function(a, b) {
        var av = a.cells[col].innerText.trim();
        var bv = b.cells[col].innerText.trim();
        if (col === 4) { av = SEV_ORDER[av.toLowerCase()] != null ? SEV_ORDER[av.toLowerCase()] : 99; bv = SEV_ORDER[bv.toLowerCase()] != null ? SEV_ORDER[bv.toLowerCase()] : 99; }
        else if (col === 5) { av = VERD_ORDER[av.toLowerCase()] != null ? VERD_ORDER[av.toLowerCase()] : 99; bv = VERD_ORDER[bv.toLowerCase()] != null ? VERD_ORDER[bv.toLowerCase()] : 99; }
        else if (type === 'num') { av = parseFloat(av) || 0; bv = parseFloat(bv) || 0; }
        if (av < bv) return dir === 'asc' ? -1 : 1;
        if (av > bv) return dir === 'asc' ? 1 : -1;
        return 0;
      });
      rows.forEach(function(r) { tbody.appendChild(r); });
    });
  });
})();
</script>
</body>
</html>`;
}

export async function generateJsonReport(
  config: RunManagerConfig,
  runId: string
): Promise<object> {
  const { run, items } = await fetchRunAndItems(config, runId);
  return {
    run,
    items,
    generated_at: new Date().toISOString(),
  };
}

export async function generateMarkdownFixList(
  config: RunManagerConfig,
  runId: string
): Promise<string> {
  const { run, items } = await fetchRunAndItems(config, runId);
  const failures = items.filter((i) => i.verdict === "fail");
  if (failures.length === 0) {
    return `# TestPass Fix List - ${run.id}\n\nAll checks passed.\n`;
  }

  const groups: Record<string, ItemRow[]> = {
    critical: [], high: [], medium: [], low: [],
  };
  for (const item of failures) {
    (groups[item.severity] ?? (groups[item.severity] = [])).push(item);
  }

  const order: Array<keyof typeof groups> = ["critical", "high", "medium", "low"];
  const sections: string[] = [];
  sections.push(`# TestPass Fix List - ${run.id}`);
  sections.push("");
  sections.push(`Target: ${run.target?.url ?? "(n/a)"} | Profile: ${run.profile} | Failures: ${failures.length}`);
  sections.push("");

  for (const sev of order) {
    const rows = groups[sev];
    if (!rows || rows.length === 0) continue;
    sections.push(`## ${sev.charAt(0).toUpperCase() + sev.slice(1)} (${rows.length})`);
    sections.push("");
    for (const r of rows) {
      const comment = r.on_fail_comment ? ` - ${r.on_fail_comment}` : "";
      sections.push(`- [${r.check_id}] ${r.title}${comment}`);
    }
    sections.push("");
  }

  return sections.join("\n");
}
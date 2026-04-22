/**
 * reporter - Generate HTML, JSON, and Markdown evidence reports for a TestPass run.
 *
 * All three generators fetch the run row and its items via the Supabase REST
 * API and produce a self-contained artefact (no external CSS/JS dependencies
 * in the HTML report).
 */

import type { RunManagerConfig } from "./run-manager.js";
import type { Severity, Verdict, VerdictSummary } from "./types.js";

interface RunRow {
  id: string;
  pack_id: string;
  target: Record<string, unknown>;
  profile: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  verdict_summary: VerdictSummary;
  actor_user_id: string;
  cost_usd: number;
  tokens_used: number;
}

interface ItemRow {
  id: string;
  run_id: string;
  check_id: string;
  title: string;
  category: string;
  severity: Severity;
  verdict: Verdict;
  on_fail_comment: string | null;
  evidence_ref: string | null;
  time_ms: number;
  cost_usd: number;
  created_at: string;
}

async function supaGet<T>(config: RunManagerConfig, path: string): Promise<T> {
  const res = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase GET ${path} -> ${res.status}: ${text}`);
  return JSON.parse(text) as T;
}

async function fetchRunAndItems(
  config: RunManagerConfig,
  runId: string
): Promise<{ run: RunRow; items: ItemRow[] }> {
  const [runs, items] = await Promise.all([
    supaGet<RunRow[]>(config, `testpass_runs?id=eq.${runId}&select=*&limit=1`),
    supaGet<ItemRow[]>(
      config,
      `testpass_items?run_id=eq.${runId}&select=*&order=created_at.asc`
    ),
  ]);
  const run = runs[0];
  if (!run) throw new Error(`Run ${runId} not found`);
  return { run, items };
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

const VERDICT_COLORS: Record<Verdict, { bg: string; fg: string }> = {
  check:   { bg: "#d1fadf", fg: "#05603a" },
  na:      { bg: "#e4e7ec", fg: "#475467" },
  fail:    { bg: "#fee4e2", fg: "#b42318" },
  other:   { bg: "#fef0c7", fg: "#b54708" },
  pending: { bg: "#d1e9ff", fg: "#175cd3" },
};

const SEVERITY_COLORS: Record<Severity, { bg: string; fg: string }> = {
  critical: { bg: "#fee4e2", fg: "#b42318" },
  high:     { bg: "#fee4cd", fg: "#c4320a" },
  medium:   { bg: "#fef7c3", fg: "#a15c07" },
  low:      { bg: "#e4e7ec", fg: "#475467" },
};

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const VERDICT_ORDER: Record<Verdict, number> = {
  fail: 0,
  other: 1,
  pending: 2,
  check: 3,
  na: 4,
};

function badge(label: string, color: { bg: string; fg: string }): string {
  return `<span class="badge" style="background:${color.bg};color:${color.fg}">${escapeHtml(label)}</span>`;
}

export async function generateHtmlReport(
  config: RunManagerConfig,
  runId: string
): Promise<string> {
  const { run, items } = await fetchRunAndItems(config, runId);
  const summary: VerdictSummary = run.verdict_summary ?? {
    total: 0, check: 0, na: 0, fail: 0, other: 0, pending: 0, pass_rate: 0,
  };
  const passRatePct = Math.round((summary.pass_rate ?? 0) * 100);

  const targetJson = escapeHtml(JSON.stringify(run.target ?? {}));

  const rows = items
    .map((it) => {
      const sevOrder = SEVERITY_ORDER[it.severity] ?? 99;
      const verdictOrder = VERDICT_ORDER[it.verdict] ?? 99;
      const sevBadge = badge(it.severity, SEVERITY_COLORS[it.severity] ?? SEVERITY_COLORS.low);
      const verdictBadge = badge(it.verdict, VERDICT_COLORS[it.verdict] ?? VERDICT_COLORS.pending);
      return `<tr>
        <td class="mono">${escapeHtml(it.check_id)}</td>
        <td>${escapeHtml(it.title)}</td>
        <td>${escapeHtml(it.category)}</td>
        <td data-sort="${sevOrder}">${sevBadge}</td>
        <td data-sort="${verdictOrder}">${verdictBadge}</td>
        <td>${escapeHtml(it.on_fail_comment ?? "")}</td>
      </tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>TestPass Report ${escapeHtml(run.id)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    margin: 0;
    padding: 32px;
    background: #f9fafb;
    color: #101828;
  }
  h1 { margin: 0 0 4px 0; font-size: 24px; }
  h2 { margin: 32px 0 12px 0; font-size: 18px; }
  .muted { color: #667085; font-size: 13px; }
  .header {
    background: #fff;
    border: 1px solid #eaecf0;
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 24px;
  }
  .meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px 24px;
    margin-top: 16px;
  }
  .meta-grid dt { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #667085; margin-bottom: 2px; }
  .meta-grid dd { margin: 0; font-size: 14px; word-break: break-word; }
  .summary-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    background: #fff;
    border: 1px solid #eaecf0;
    border-radius: 12px;
    padding: 16px 24px;
    margin-bottom: 24px;
  }
  .stat { min-width: 90px; }
  .stat .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #667085; }
  .stat .value { font-size: 22px; font-weight: 600; color: #101828; }
  .stat.pass .value { color: #039855; }
  .stat.fail .value { color: #b42318; }
  .stat.pending .value { color: #175cd3; }
  table {
    width: 100%;
    background: #fff;
    border: 1px solid #eaecf0;
    border-radius: 12px;
    border-collapse: separate;
    border-spacing: 0;
    overflow: hidden;
  }
  thead { background: #f9fafb; }
  th, td {
    text-align: left;
    padding: 12px 16px;
    border-bottom: 1px solid #eaecf0;
    font-size: 13px;
    vertical-align: top;
  }
  th {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #475467;
    cursor: pointer;
    user-select: none;
  }
  th.sortable::after {
    content: " \\2195";
    opacity: 0.4;
  }
  th.sort-asc::after  { content: " \\25B2"; opacity: 1; }
  th.sort-desc::after { content: " \\25BC"; opacity: 1; }
  tbody tr:last-child td { border-bottom: none; }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
  .target-url { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
</style>
</head>
<body>
  <div class="header">
    <h1>TestPass Report</h1>
    <div class="muted">Run ${escapeHtml(run.id)}</div>
    <dl class="meta-grid">
      <div><dt>Status</dt><dd>${escapeHtml(run.status)}</dd></div>
      <div><dt>Profile</dt><dd>${escapeHtml(run.profile)}</dd></div>
      <div><dt>Started</dt><dd>${escapeHtml(run.started_at)}</dd></div>
      <div><dt>Completed</dt><dd>${escapeHtml(run.completed_at ?? "")}</dd></div>
      <div><dt>Pack ID</dt><dd class="mono">${escapeHtml(run.pack_id)}</dd></div>
      <div><dt>Target</dt><dd class="target-url">${targetJson}</dd></div>
      <div><dt>Cost (USD)</dt><dd>${escapeHtml(run.cost_usd ?? 0)}</dd></div>
      <div><dt>Tokens</dt><dd>${escapeHtml(run.tokens_used ?? 0)}</dd></div>
    </dl>
  </div>

  <div class="summary-bar">
    <div class="stat pass"><div class="label">Pass rate</div><div class="value">${passRatePct}%</div></div>
    <div class="stat"><div class="label">Total</div><div class="value">${summary.total ?? 0}</div></div>
    <div class="stat pass"><div class="label">Check</div><div class="value">${summary.check ?? 0}</div></div>
    <div class="stat"><div class="label">N/A</div><div class="value">${summary.na ?? 0}</div></div>
    <div class="stat fail"><div class="label">Fail</div><div class="value">${summary.fail ?? 0}</div></div>
    <div class="stat"><div class="label">Other</div><div class="value">${summary.other ?? 0}</div></div>
    <div class="stat pending"><div class="label">Pending</div><div class="value">${summary.pending ?? 0}</div></div>
  </div>

  <h2>Items</h2>
  <table id="items">
    <thead>
      <tr>
        <th data-col="0">Check ID</th>
        <th data-col="1">Title</th>
        <th data-col="2">Category</th>
        <th data-col="3" class="sortable">Severity</th>
        <th data-col="4" class="sortable">Verdict</th>
        <th data-col="5">On-fail comment</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="6" style="text-align:center;color:#667085;padding:24px">No items recorded for this run.</td></tr>'}
    </tbody>
  </table>

<script>
(function() {
  var table = document.getElementById("items");
  if (!table) return;
  var tbody = table.querySelector("tbody");
  var headers = table.querySelectorAll("th.sortable");
  headers.forEach(function(th) {
    th.addEventListener("click", function() {
      var col = parseInt(th.getAttribute("data-col"), 10);
      var asc = !th.classList.contains("sort-asc");
      headers.forEach(function(h) { h.classList.remove("sort-asc", "sort-desc"); });
      th.classList.add(asc ? "sort-asc" : "sort-desc");
      var rows = Array.prototype.slice.call(tbody.querySelectorAll("tr"));
      rows.sort(function(a, b) {
        var ca = a.children[col];
        var cb = b.children[col];
        var sa = ca && ca.getAttribute("data-sort");
        var sb = cb && cb.getAttribute("data-sort");
        var va = sa !== null && sa !== undefined ? parseFloat(sa) : (ca ? ca.textContent.trim() : "");
        var vb = sb !== null && sb !== undefined ? parseFloat(sb) : (cb ? cb.textContent.trim() : "");
        if (va < vb) return asc ? -1 : 1;
        if (va > vb) return asc ? 1 : -1;
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
  const { items } = await fetchRunAndItems(config, runId);
  const failures = items.filter((it) => it.verdict === "fail");
  if (failures.length === 0) {
    return "## TestPass Fix List\n\nAll checks passed.\n";
  }

  const buckets: Record<Severity, ItemRow[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };
  for (const it of failures) {
    const sev = (it.severity in buckets ? it.severity : "low") as Severity;
    buckets[sev].push(it);
  }

  const sections: string[] = ["## TestPass Fix List", ""];
  const headings: Array<[Severity, string]> = [
    ["critical", "### Critical"],
    ["high", "### High"],
    ["medium", "### Medium"],
    ["low", "### Low"],
  ];
  for (const [sev, heading] of headings) {
    const bucket = buckets[sev];
    if (bucket.length === 0) continue;
    sections.push(heading);
    for (const it of bucket) {
      const comment = it.on_fail_comment ? ` - ${it.on_fail_comment}` : "";
      sections.push(`- [${it.check_id}] ${it.title}${comment}`);
    }
    sections.push("");
  }
  return sections.join("\n");
}

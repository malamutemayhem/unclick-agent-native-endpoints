import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Check, ClipboardCopy, Download, Loader2, MessageSquare, X } from "lucide-react";
import { useSession } from "@/lib/auth";
import { SEVERITY_BADGE, STATUS_LABEL, STATUS_PILL, VERDICT_ICON, elapsedLabel, fmtDate } from "./testpass-ui";

type VS = { check?: number; fail?: number; na?: number; other?: number; pending?: number };
interface RunData { id: string; pack_name: string; target: { url?: string }; profile: string; started_at: string; completed_at?: string; status: string; verdict_summary: VS; report_id?: string | null; }
interface ReportBreadcrumb { id: string; target: string; run_sequence: string[]; }

function useReportBreadcrumb(reportId: string | null | undefined, authHeader: Record<string, string>) {
  const [reportInfo, setReportInfo] = useState<ReportBreadcrumb | null>(null);
  useEffect(() => {
    if (!reportId) return;
    void fetch(`/api/memory-admin?action=get_report&report_id=${encodeURIComponent(reportId)}`, { headers: authHeader })
      .then((r) => r.json().catch(() => ({})))
      .then((body) => {
        if (body.report) {
          setReportInfo({ id: body.report.id as string, target: body.report.target as string, run_sequence: body.report.run_sequence as string[] });
        }
      })
      .catch(() => undefined);
  }, [reportId, authHeader]);
  return reportInfo;
}
interface CheckItem { id: string; check_id: string; title: string; category: string; severity: "critical"|"high"|"medium"|"low"; verdict: "check"|"na"|"fail"|"other"|"pending"; on_fail_comment?: string|null; fix_recipe?: string[]|null; }

export default function RunDetail() {
  const { id: runId } = useParams<{ id: string }>();
  const { session } = useSession();
  const navigate = useNavigate();
  const token = session?.access_token;
  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const [run, setRun] = useState<RunData | null>(null);
  const reportBreadcrumb = useReportBreadcrumb(run?.report_id, authHeader);
  const [items, setItems] = useState<CheckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false); const [showModal, setShowModal] = useState(false); const [copiedStep, setCopiedStep] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRun = useCallback(async () => {
    if (!runId || !token) return null;
    try {
      const res = await fetch(`/api/memory-admin?action=get_testpass_run&run_id=${encodeURIComponent(runId)}`, { headers: authHeader });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error ?? "Failed to load run"); return null; }
      setRun(body.run as RunData);
      setItems(body.items as CheckItem[]);
      if ((body.items as CheckItem[])?.length > 0 && !selectedId) setSelectedId((body.items as CheckItem[])[0].id);
      return (body.run as RunData).status;
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load run"); return null; }
    finally { setLoading(false); }
  }, [runId, token, authHeader, selectedId]);

  useEffect(() => {
    void fetchRun().then((status) => {
      if (status === "running" || status === "pending") {
        pollRef.current = setInterval(() => {
          void fetchRun().then((s) => {
            if (s && s !== "running" && s !== "pending" && pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          });
        }, 3000);
      }
    });
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [fetchRun]);

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const failItems = items.filter((i) => i.verdict === "fail");
  const vs = run?.verdict_summary ?? {};

  async function copyFixList() {
    const text = failItems.map((i) => `## ${i.check_id}: ${i.title}\n${i.on_fail_comment ?? ""}\n${(i.fix_recipe ?? []).map((s, n) => `  ${n+1}. ${s}`).join("\n")}`).join("\n\n");
    await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 3000);
  }
  const agentPrompt = failItems.length > 0
    ? `I ran TestPass against ${run?.target?.url ?? "my MCP server"} and got ${failItems.length} failing check${failItems.length === 1 ? "" : "s"}:\n\n` + failItems.map((i) => `- ${i.check_id}: ${i.title}\n  ${i.on_fail_comment ?? ""}`).join("\n") + "\n\nCan you help me fix these?"
    : `TestPass completed with no failures for ${run?.target?.url ?? "my MCP server"}.`;

  if (loading) return <div className="flex items-center justify-center py-24 gap-2 text-[#888]"><Loader2 className="h-5 w-5 animate-spin" /> Loading run...</div>;
  if (error || !run) return <div className="py-24 text-center"><p className="text-red-400 text-sm mb-4">{error ?? "Run not found."}</p><button onClick={() => navigate("/admin/testpass")} className="text-sm text-[#888] hover:text-white">Back to TestPass</button></div>;

  return (
    <div className="flex flex-col gap-0">
      <button onClick={() => navigate("/admin/testpass")} className="mb-4 flex items-center gap-1.5 text-sm text-[#888] hover:text-white w-fit"><ArrowLeft className="h-4 w-4" /> All runs</button>
      {reportBreadcrumb && run?.report_id && (
        <p className="mb-3 text-xs text-[#666]">
          Run {(reportBreadcrumb.run_sequence.indexOf(runId ?? "") + 1) || "?"} of {reportBreadcrumb.run_sequence.length} in report for{" "}
          <Link to={`/admin/testpass/reports/${run.report_id}`} className="text-[#61C1C4] hover:underline">
            {reportBreadcrumb.target}
          </Link>
        </p>
      )}

      <div className="mb-6 rounded-xl border border-white/[0.06] bg-[#111] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_PILL[run.status] ?? STATUS_PILL.pending}`}>{STATUS_LABEL[run.status] ?? run.status}{(run.status === "running" || run.status === "pending") && <Loader2 className="ml-1.5 inline-block h-3 w-3 animate-spin" />}</span>
              <span className="text-xs text-[#666]">{run.profile} depth</span>
            </div>
            <p className="font-mono text-sm text-[#aaa]">{run.target?.url ?? "(no URL)"}</p>
            <p className="text-xs text-[#666]">Pack: <span className="text-[#ccc]">{run.pack_name}</span><span className="mx-2 text-[#444]">|</span>Started: <span className="text-[#ccc]">{fmtDate(run.started_at)}</span><span className="mx-2 text-[#444]">|</span>Elapsed: <span className="text-[#ccc]">{elapsedLabel(run.started_at, run.completed_at)}</span></p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            {[["Pass", vs.check, "text-[#61C1C4]"], ["Fail", vs.fail, "text-red-400"], ["N/A", vs.na, "text-gray-400"], ["Other", vs.other, "text-[#E2B93B]"], ["Pending", vs.pending, "text-blue-300"]].filter(([,v]) => (v as number ?? 0) > 0).map(([label, val, color]) => (
              <div key={label as string} className="flex flex-col items-center">
                <span className={`text-lg font-bold ${color}`}>{val as number}</span>
                <span className="text-[#666]">{label as string}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-4 min-h-[500px]">
        <div className="w-72 shrink-0 rounded-xl border border-white/[0.06] bg-[#111] overflow-auto">
          {items.length === 0 ? <p className="p-4 text-xs text-[#666]">No checks yet. The run is still starting.</p> : (
            <ul className="divide-y divide-white/[0.04]">
              {items.map((item) => (
                <li key={item.id}>
                  <button onClick={() => setSelectedId(item.id)} className={`w-full px-4 py-3 text-left transition-colors ${selectedId === item.id ? "bg-white/[0.05]" : "hover:bg-white/[0.02]"}`}>
                    <div className="flex items-start gap-2">
                      <span className="text-sm mt-0.5 shrink-0">{VERDICT_ICON[item.verdict] ?? "❓"}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#ccc] truncate">{item.title}</p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-[#555]">{item.check_id}</span>
                          <span className={`rounded border px-1.5 py-0.5 text-[9px] ${SEVERITY_BADGE[item.severity] ?? ""}`}>{item.severity}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex-1 rounded-xl border border-white/[0.06] bg-[#111] p-5 overflow-auto">
          {!selected ? <p className="text-sm text-[#666]">Select a check on the left to see details.</p> : (
            <div className="flex flex-col gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-lg">{VERDICT_ICON[selected.verdict]}</span>
                  <span className={`rounded border px-2 py-0.5 text-xs ${SEVERITY_BADGE[selected.severity] ?? ""}`}>{selected.severity}</span>
                  <span className="font-mono text-xs text-[#555]">{selected.check_id}</span>
                </div>
                <h2 className="text-sm font-semibold text-white">{selected.title}</h2>
                <p className="text-xs text-[#666] mt-0.5">Category: {selected.category}</p>
              </div>
              {selected.on_fail_comment && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                  <p className="text-xs font-medium text-red-400 mb-1">Finding</p>
                  <p className="text-xs text-[#ccc]">{selected.on_fail_comment}</p>
                </div>
              )}
              {selected.fix_recipe && selected.fix_recipe.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[#888] mb-2">Fix steps</p>
                  <ol className="flex flex-col gap-2">
                    {selected.fix_recipe.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
                        <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-bold text-[#888]">{idx + 1}</span>
                        <span className="text-xs text-[#ccc] flex-1">{step}</span>
                        <button onClick={async () => { await navigator.clipboard.writeText(step); setCopiedStep(idx); setTimeout(() => setCopiedStep(null), 2000); }} className="shrink-0 text-[#555] hover:text-[#888]" title="Copy this step">
                          {copiedStep === idx ? <Check className="h-3.5 w-3.5 text-[#61C1C4]" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {!selected.on_fail_comment && !(selected.fix_recipe?.length) && (
                <p className="text-xs text-[#666]">{selected.verdict === "check" ? "This check passed." : selected.verdict === "na" ? "Not applicable." : "No additional details recorded."}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/[0.06] bg-[#111] px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {failItems.length > 0 && (
            <button onClick={() => void copyFixList()} className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20">
              {copied ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy fix list"}
            </button>
          )}
          <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-[#888] hover:text-white">
            <MessageSquare className="h-3.5 w-3.5" /> Ask your AI agent
          </button>
        </div>
        <button onClick={() => { const b = new Blob([JSON.stringify({ run, items }, null, 2)], { type: "application/json" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = `testpass-${runId?.slice(0,8)}.json`; a.click(); URL.revokeObjectURL(u); }}
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-[#888] hover:text-white">
          <Download className="h-3.5 w-3.5" /> Export JSON
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-xl border border-white/[0.08] bg-[#111] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Ask your AI agent</h3>
              <button onClick={() => setShowModal(false)} className="text-[#666] hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <p className="mb-3 text-xs text-[#888]">Copy this prompt into your AI chat (Claude, ChatGPT, or any agent) to get help with these checks.</p>
            <pre className="rounded-lg border border-white/[0.06] bg-black/40 p-3 text-[11px] text-[#ccc] whitespace-pre-wrap max-h-56 overflow-auto">{agentPrompt}</pre>
            <button onClick={async () => { await navigator.clipboard.writeText(agentPrompt); setCopied(true); setTimeout(() => setCopied(false), 3000); }}
              className="mt-3 flex items-center gap-1.5 rounded-lg border border-[#61C1C4]/30 bg-[#61C1C4]/10 px-3 py-2 text-xs text-[#61C1C4] hover:bg-[#61C1C4]/20">
              {copied ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy prompt"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

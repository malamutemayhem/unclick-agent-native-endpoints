import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Play, X } from "lucide-react";
import { useSession } from "@/lib/auth";
import { STATUS_LABEL, STATUS_PILL, fmtDate } from "./testpass-ui";

interface ReportRow {
  id: string;
  target: string;
  pack_id: string;
  status: "open" | "complete" | "abandoned";
  run_sequence: string[];
  created_at: string;
  closed_at?: string | null;
}

interface RunInReport {
  id: string;
  run_number: number;
  status: string;
  pack_name?: string;
  started_at: string;
  completed_at?: string | null;
  pass: number;
  fail: number;
  na: number;
  delta: { fixed: number; new_fails: number } | null;
}

const REPORT_STATUS_PILL: Record<string, string> = {
  open:      "bg-[#E2B93B]/15 text-[#E2B93B] border-[#E2B93B]/30",
  complete:  "bg-[#61C1C4]/15 text-[#61C1C4] border-[#61C1C4]/30",
  abandoned: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

const REPORT_STATUS_LABEL: Record<string, string> = {
  open:      "Open",
  complete:  "Complete",
  abandoned: "Abandoned",
};

export default function ReportDetail() {
  const { id: reportId } = useParams<{ id: string }>();
  const { session } = useSession();
  const navigate = useNavigate();
  const token = session?.access_token;
  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const [report, setReport] = useState<ReportRow | null>(null);
  const [runs, setRuns] = useState<RunInReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const [abandonLoading, setAbandonLoading] = useState(false);
  const [startingRun, setStartingRun] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!reportId || !token) return;
    try {
      const res = await fetch(
        `/api/memory-admin?action=get_report&report_id=${encodeURIComponent(reportId)}`,
        { headers: authHeader }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error ?? "Failed to load report"); return; }
      setReport(body.report as ReportRow);
      setRuns(body.runs as RunInReport[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [reportId, token, authHeader]);

  useEffect(() => { void fetchReport(); }, [fetchReport]);

  async function handleAbandon() {
    if (!reportId || !token) return;
    setAbandonLoading(true);
    try {
      const res = await fetch("/api/memory-admin?action=abandon_report", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ report_id: reportId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error ?? "Failed to abandon report"); return; }
      setReport(body.report as ReportRow);
      setShowAbandonModal(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to abandon report");
    } finally {
      setAbandonLoading(false);
    }
  }

  async function handleRunAgain() {
    if (!report || !token) return;
    setStartingRun(true);
    try {
      const res = await fetch("/api/memory-admin?action=start_testpass_run", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ pack_id: report.pack_id, target: report.target }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error ?? "Failed to start run"); return; }
      if (body.run_id) navigate(`/admin/testpass/runs/${body.run_id as string}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start run");
    } finally {
      setStartingRun(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-[#888]">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading report...
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="py-24 text-center">
        <p className="text-red-400 text-sm mb-4">{error ?? "Report not found."}</p>
        <button
          onClick={() => navigate("/admin/testpass/reports")}
          className="text-sm text-[#888] hover:text-white"
        >
          Back to Reports
        </button>
      </div>
    );
  }

  const latestRun = runs.length > 0 ? runs[runs.length - 1] : null;
  const latestFails = latestRun?.fail ?? 0;
  const canRunAgain = report.status === "open" && latestFails > 0;

  return (
    <div className="flex flex-col gap-0">
      <button
        onClick={() => navigate("/admin/testpass/reports")}
        className="mb-4 flex items-center gap-1.5 text-sm text-[#888] hover:text-white w-fit"
      >
        <ArrowLeft className="h-4 w-4" /> All reports
      </button>

      {report.status === "complete" && (
        <div className="mb-4 rounded-xl border border-[#61C1C4]/30 bg-[#61C1C4]/10 px-5 py-3 text-sm font-medium text-[#61C1C4]">
          All checks cleared. Report closed.
        </div>
      )}

      <div className="mb-6 rounded-xl border border-white/[0.06] bg-[#111] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${REPORT_STATUS_PILL[report.status] ?? REPORT_STATUS_PILL.open}`}
              >
                {REPORT_STATUS_LABEL[report.status] ?? report.status}
              </span>
              <span className="text-xs text-[#666]">{runs.length} run{runs.length === 1 ? "" : "s"}</span>
            </div>
            <p className="font-mono text-sm text-[#aaa]">{report.target}</p>
            <p className="text-xs text-[#666]">
              Pack ID: <span className="text-[#ccc] font-mono">{report.pack_id.slice(0, 8)}...</span>
              <span className="mx-2 text-[#444]">|</span>
              Created: <span className="text-[#ccc]">{fmtDate(report.created_at)}</span>
              {report.closed_at && (
                <>
                  <span className="mx-2 text-[#444]">|</span>
                  Closed: <span className="text-[#ccc]">{fmtDate(report.closed_at)}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {canRunAgain && (
              <button
                onClick={() => void handleRunAgain()}
                disabled={startingRun}
                className="flex items-center gap-1.5 rounded-lg border border-[#E2B93B]/30 bg-[#E2B93B]/10 px-3 py-1.5 text-xs text-[#E2B93B] hover:bg-[#E2B93B]/20 disabled:opacity-50"
              >
                {startingRun ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Fix these {latestFails} - run again
              </button>
            )}
            {report.status === "open" && (
              <button
                onClick={() => setShowAbandonModal(true)}
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-[#888] hover:text-red-400 hover:border-red-500/30"
              >
                Mark abandoned
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#111] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <h2 className="text-sm font-medium text-white">Run timeline</h2>
        </div>
        {runs.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-[#888]">No runs yet. Start a run to see results here.</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs text-[#666]">
                {["Run", "Status", "Pass", "Fail", "N/A", "Started", "Delta"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.id}
                  onClick={() => navigate(`/admin/testpass/runs/${run.id}`)}
                  className="cursor-pointer border-b border-white/[0.04] hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 text-xs font-medium text-[#ccc]">
                    Run {run.run_number}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] ${STATUS_PILL[run.status] ?? STATUS_PILL.pending}`}
                    >
                      {STATUS_LABEL[run.status] ?? run.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#61C1C4]">{run.pass}</td>
                  <td className="px-4 py-3 text-xs text-red-400">{run.fail}</td>
                  <td className="px-4 py-3 text-xs text-[#888]">{run.na}</td>
                  <td className="px-4 py-3 text-xs text-[#888]">{fmtDate(run.started_at)}</td>
                  <td className="px-4 py-3 text-xs">
                    {run.delta === null ? (
                      <span className="text-[#555]">-</span>
                    ) : (
                      <span>
                        {run.delta.fixed > 0 && (
                          <span className="text-[#61C1C4]">+{run.delta.fixed} fixed</span>
                        )}
                        {run.delta.fixed > 0 && run.delta.new_fails > 0 && (
                          <span className="text-[#666] mx-1">,</span>
                        )}
                        {run.delta.new_fails > 0 && (
                          <span className="text-red-400">{run.delta.new_fails} new fail</span>
                        )}
                        {run.delta.fixed === 0 && run.delta.new_fails === 0 && (
                          <span className="text-[#555]">no change</span>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAbandonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/[0.08] bg-[#111] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Mark as abandoned?</h3>
              <button
                onClick={() => setShowAbandonModal(false)}
                className="text-[#666] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 text-xs text-[#888]">
              This report will be marked abandoned and closed. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowAbandonModal(false)}
                className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-[#888] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleAbandon()}
                disabled={abandonLoading}
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20 disabled:opacity-50"
              >
                {abandonLoading ? "Abandoning..." : "Mark abandoned"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

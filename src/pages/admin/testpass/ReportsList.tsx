import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useSession } from "@/lib/auth";
import { STATUS_LABEL, STATUS_PILL, fmtDate } from "./testpass-ui";

interface ReportSummary {
  report: {
    id: string;
    target: string;
    pack_id: string;
    status: "open" | "complete" | "abandoned";
    run_sequence: string[];
    created_at: string;
    closed_at?: string | null;
  };
  latest_run: {
    id: string;
    status: string;
    verdict_summary: { check?: number; fail?: number };
    started_at: string;
  } | null;
  run_count: number;
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

type TabFilter = "all" | "open" | "complete" | "abandoned";

export default function ReportsList() {
  const { session } = useSession();
  const navigate = useNavigate();
  const token = session?.access_token;
  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const [tab, setTab] = useState<TabFilter>("all");
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ action: "list_reports", limit: "50" });
      if (tab !== "all") params.set("status", tab);
      const res = await fetch(`/api/memory-admin?${params.toString()}`, { headers: authHeader });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to load reports");
      setReports(body.reports ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [token, authHeader, tab]);

  useEffect(() => { void fetchReports(); }, [fetchReports]);

  const tabs: TabFilter[] = ["all", "open", "complete", "abandoned"];

  return (
    <div>
      <div className="mb-6 flex gap-1 rounded-lg border border-white/[0.06] bg-[#111] p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors capitalize ${
              tab === t ? "bg-white/[0.08] text-white" : "text-[#888] hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <section className="rounded-xl border border-white/[0.06] bg-[#111] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-[#888]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading reports...
          </div>
        ) : reports.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-[#888]">
              No reports yet. Run a TestPass check to create your first report.
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs text-[#666]">
                {["Target", "Pack", "Status", "Runs", "Latest run", "Created"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map(({ report, latest_run, run_count }) => (
                <tr
                  key={report.id}
                  onClick={() => navigate(`/admin/testpass/reports/${report.id}`)}
                  className="cursor-pointer border-b border-white/[0.04] hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 font-mono text-xs text-[#aaa] max-w-[200px] truncate">
                    {report.target}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#888] font-mono">
                    {report.pack_id.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] ${REPORT_STATUS_PILL[report.status] ?? REPORT_STATUS_PILL.open}`}
                    >
                      {REPORT_STATUS_LABEL[report.status] ?? report.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#ccc]">{run_count}</td>
                  <td className="px-4 py-3 text-xs">
                    {latest_run ? (
                      <span className="flex items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] ${STATUS_PILL[latest_run.status] ?? STATUS_PILL.pending}`}
                        >
                          {STATUS_LABEL[latest_run.status] ?? latest_run.status}
                        </span>
                        <span className="text-[#666]">{fmtDate(latest_run.started_at)}</span>
                      </span>
                    ) : (
                      <span className="text-[#555]">No runs</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#888]">{fmtDate(report.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

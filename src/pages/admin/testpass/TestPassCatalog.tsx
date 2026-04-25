import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, FlaskConical, Loader2, Play, Settings2 } from "lucide-react";
import { useSession } from "@/lib/auth";
import { CATEGORY_BADGE, STATUS_LABEL, STATUS_PILL, fmtDate } from "./testpass-ui";

const PACK_USE_WHEN: Record<string, string> = {
  "testpass-core": "Use this when you want a baseline check that your MCP server speaks the protocol correctly.",
};

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

interface ReportRunRow {
  id: string;
  run_number: number;
  status: string;
  pack_name?: string;
  started_at: string;
  pass: number;
  fail: number;
  na: number;
  delta: { fixed: number; new_fails: number } | null;
}

interface PackCard {
  id: string;
  slug: string;
  name: string;
  description: string;
  check_count: number;
  category: string;
  updated_at?: string | null;
}

const REPORT_STATUS_PILL: Record<string, string> = {
  open:      "bg-[#E2B93B]/15 text-[#E2B93B] border-[#E2B93B]/30",
  complete:  "bg-[#61C1C4]/15 text-[#61C1C4] border-[#61C1C4]/30",
  abandoned: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

const REPORT_STATUS_LABEL: Record<string, string> = {
  open:      "In progress",
  complete:  "All clear",
  abandoned: "Cancelled",
};

type StatusFilter = "all" | "open" | "complete" | "abandoned";
const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  all: "All",
  open: "In progress",
  complete: "All clear",
  abandoned: "Cancelled",
};

export default function TestPassCatalog() {
  const { session } = useSession();
  const navigate = useNavigate();
  const token = session?.access_token;
  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const [tab, setTab] = useState<"runs" | "packs">("runs");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [packs, setPacks] = useState<PackCard[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [loadingPacks, setLoadingPacks] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set());
  const [reportRunsCache, setReportRunsCache] = useState<Record<string, ReportRunRow[]>>({});
  const [loadingReportId, setLoadingReportId] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    if (!token) return;
    setLoadingReports(true);
    setError(null);
    try {
      const params = new URLSearchParams({ action: "list_reports", limit: "50" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/memory-admin?${params.toString()}`, { headers: authHeader });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not load runs");
      setReports(body.reports ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load runs");
    } finally {
      setLoadingReports(false);
    }
  }, [token, authHeader, statusFilter]);

  const fetchPacks = useCallback(async () => {
    if (!token) return;
    setLoadingPacks(true);
    setError(null);
    try {
      const res = await fetch("/api/memory-admin?action=list_testpass_packs", { headers: authHeader });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not load packs");
      setPacks(body.packs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load packs");
    } finally {
      setLoadingPacks(false);
    }
  }, [token, authHeader]);

  useEffect(() => { void fetchReports(); }, [fetchReports]);
  useEffect(() => { void fetchPacks(); }, [fetchPacks]);

  async function toggleExpand(reportId: string) {
    const next = new Set(expandedReports);
    if (next.has(reportId)) {
      next.delete(reportId);
      setExpandedReports(next);
      return;
    }
    next.add(reportId);
    setExpandedReports(next);
    if (!reportRunsCache[reportId] && token) {
      setLoadingReportId(reportId);
      try {
        const res = await fetch(
          `/api/memory-admin?action=get_report&report_id=${encodeURIComponent(reportId)}`,
          { headers: authHeader },
        );
        const body = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(body.runs)) {
          setReportRunsCache((prev) => ({ ...prev, [reportId]: body.runs as ReportRunRow[] }));
        }
      } catch {
        // swallow, expanded view will show "Could not load runs"
      } finally {
        setLoadingReportId(null);
      }
    }
  }

  function startWithPack(packId: string) {
    navigate(`/admin/testpass/new?pack_id=${packId}`);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-6 w-6 text-[#61C1C4]" />
          <div>
            <h1 className="text-2xl font-semibold text-white">TestPass</h1>
            <p className="mt-0.5 text-sm text-[#888]">
              Checks your MCP server speaks the protocol correctly. Pick a pack, point it at a target, ship with confidence.
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate("/admin/testpass/new")}
          title="Kicks off a fresh check against an MCP server URL."
          className="flex items-center gap-2 rounded-lg border border-[#E2B93B]/30 bg-[#E2B93B]/10 px-4 py-2 text-sm font-semibold text-[#E2B93B] hover:bg-[#E2B93B]/20"
        >
          <Play className="h-4 w-4" /> Start new run
        </button>
      </div>

      <div className="mb-6 flex gap-1 rounded-lg border border-white/[0.06] bg-[#111] p-1 w-fit">
        {(["runs", "packs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? "bg-white/[0.08] text-white" : "text-[#888] hover:text-white"
            }`}
          >
            {t === "runs" ? "Runs & reports" : "Packs"}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {tab === "runs" && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-1 rounded-lg border border-white/[0.06] bg-[#111] p-1 w-fit">
            {(["all", "open", "complete", "abandoned"] as StatusFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === f ? "bg-white/[0.08] text-white" : "text-[#888] hover:text-white"
                }`}
              >
                {STATUS_FILTER_LABEL[f]}
              </button>
            ))}
          </div>

          <section className="rounded-xl border border-white/[0.06] bg-[#111] overflow-hidden">
            {loadingReports ? (
              <div className="flex items-center justify-center py-16 gap-2 text-[#888]">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading runs...
              </div>
            ) : reports.length === 0 ? (
              <RunsEmptyState
                packs={packs}
                loadingPacks={loadingPacks}
                onPickPack={startWithPack}
                onOpenPackEditor={() => navigate("/admin/testpass/packs/new/edit")}
                onSwitchToPacks={() => setTab("packs")}
              />
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left text-xs text-[#666]">
                    <th className="px-3 py-3 font-medium w-8"></th>
                    {["Target", "Pack", "Status", "Runs", "Latest", "Pass / Fail", "Created"].map((h) => (
                      <th key={h} className="px-4 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reports.map((entry) => {
                    const r = entry.report;
                    const latest = entry.latest_run;
                    const expandable = entry.run_count > 1;
                    const expanded = expandedReports.has(r.id);
                    const cachedRuns = reportRunsCache[r.id];

                    return (
                      <Fragment key={r.id}>
                        <tr
                          className="cursor-pointer border-b border-white/[0.04] hover:bg-white/[0.02]"
                          onClick={() => {
                            if (latest) navigate(`/admin/testpass/runs/${latest.id}`);
                            else navigate(`/admin/testpass/reports/${r.id}`);
                          }}
                        >
                          <td className="px-3 py-3 align-middle">
                            {expandable ? (
                              <button
                                onClick={(ev) => { ev.stopPropagation(); void toggleExpand(r.id); }}
                                aria-label={expanded ? "Collapse run timeline" : "Expand run timeline"}
                                className="flex h-6 w-6 items-center justify-center rounded text-[#888] hover:bg-white/[0.06] hover:text-white"
                              >
                                {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              </button>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[#aaa] max-w-[220px] truncate">{r.target}</td>
                          <td className="px-4 py-3 text-[#ccc] text-xs font-mono">{r.pack_id.slice(0, 8)}...</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] ${REPORT_STATUS_PILL[r.status] ?? REPORT_STATUS_PILL.open}`}>
                              {REPORT_STATUS_LABEL[r.status] ?? r.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-[#ccc]">{entry.run_count}</td>
                          <td className="px-4 py-3 text-xs">
                            {latest ? (
                              <span className="flex items-center gap-2">
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] ${STATUS_PILL[latest.status] ?? STATUS_PILL.pending}`}>
                                  {STATUS_LABEL[latest.status] ?? latest.status}
                                </span>
                                <span className="text-[#666]">{fmtDate(latest.started_at)}</span>
                              </span>
                            ) : (
                              <span className="text-[#555]">No runs</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {latest ? (
                              <>
                                <span className="text-[#61C1C4]">{latest.verdict_summary?.check ?? 0} pass</span>
                                <span className="text-[#666] mx-1">/</span>
                                <span className="text-red-400">{latest.verdict_summary?.fail ?? 0} fail</span>
                              </>
                            ) : (
                              <span className="text-[#555]">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-[#888]">{fmtDate(r.created_at)}</td>
                        </tr>

                        {expandable && expanded && (
                          <tr className="border-b border-white/[0.04] bg-black/20">
                            <td colSpan={8} className="px-12 py-3">
                              <ExpandedTimeline
                                runs={cachedRuns}
                                loading={loadingReportId === r.id}
                                onRunClick={(runId) => navigate(`/admin/testpass/runs/${runId}`)}
                                onSeeFullReport={() => navigate(`/admin/testpass/reports/${r.id}`)}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      {tab === "packs" && (
        <div>
          {loadingPacks ? (
            <div className="flex items-center justify-center py-16 gap-2 text-[#888]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading packs...
            </div>
          ) : packs.length === 0 ? (
            <PacksEmptyState onOpenPackEditor={() => navigate("/admin/testpass/packs/new/edit")} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {packs.map((p) => (
                <PackTile
                  key={p.id}
                  pack={p}
                  onStart={() => startWithPack(p.id)}
                  onEdit={() => navigate(`/admin/testpass/packs/${p.id}/edit`)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PackTile({ pack, onStart, onEdit }: { pack: PackCard; onStart: () => void; onEdit: () => void }) {
  const useWhen = PACK_USE_WHEN[pack.slug] ?? pack.description ?? "Use this when you need a custom set of MCP checks.";
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#111] p-5 flex flex-col gap-3">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-white">{pack.name}</h3>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_BADGE[pack.category] ?? CATEGORY_BADGE.general}`}>
            {pack.category}
          </span>
        </div>
        <p className="mt-1 text-xs text-[#888]">{useWhen}</p>
        <p className="mt-2 text-[11px] text-[#666]">
          {pack.check_count} {pack.check_count === 1 ? "check" : "checks"}
          {pack.updated_at ? <>, last updated {fmtDate(pack.updated_at)}</> : null}
        </p>
      </div>
      <div className="flex gap-2 mt-auto">
        <button
          onClick={onStart}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-[#E2B93B]/30 bg-[#E2B93B]/10 px-3 py-2 text-xs font-medium text-[#E2B93B] hover:bg-[#E2B93B]/20"
        >
          <Play className="h-3 w-3" /> Start run
        </button>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-black/30 px-3 py-2 text-xs text-[#888] hover:text-white"
        >
          <Settings2 className="h-3 w-3" /> Edit YAML
        </button>
      </div>
    </div>
  );
}

function RunsEmptyState({
  packs,
  loadingPacks,
  onPickPack,
  onOpenPackEditor,
  onSwitchToPacks,
}: {
  packs: PackCard[];
  loadingPacks: boolean;
  onPickPack: (packId: string) => void;
  onOpenPackEditor: () => void;
  onSwitchToPacks: () => void;
}) {
  if (loadingPacks) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-[#888]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading packs...
      </div>
    );
  }

  if (packs.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-sm text-white">No runs yet, and no packs to use.</p>
        <p className="mt-1 text-xs text-[#888]">
          Use the testpass-core starter, or write your own check pack from YAML.
        </p>
        <button
          onClick={onOpenPackEditor}
          className="mt-5 rounded-lg border border-[#61C1C4]/30 bg-[#61C1C4]/10 px-4 py-2 text-sm text-[#61C1C4] hover:bg-[#61C1C4]/20"
        >
          Open pack editor
        </button>
      </div>
    );
  }

  return (
    <div className="px-6 py-10">
      <p className="text-sm text-white text-center">
        No runs yet. Pick a starter pack below and test your first MCP server in 30 seconds.
      </p>
      <p className="mt-1 text-xs text-[#888] text-center">
        Click a pack to jump straight into the run setup with that pack pre-selected.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {packs.map((p) => {
          const useWhen = PACK_USE_WHEN[p.slug] ?? p.description ?? "Use this when you need a custom set of MCP checks.";
          return (
            <button
              key={p.id}
              onClick={() => onPickPack(p.id)}
              className="rounded-xl border border-white/[0.06] bg-black/20 p-4 text-left transition-colors hover:border-[#61C1C4]/40 hover:bg-[#61C1C4]/5"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-white">{p.name}</h3>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_BADGE[p.category] ?? CATEGORY_BADGE.general}`}>
                  {p.category}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#888] line-clamp-2">{useWhen}</p>
              <p className="mt-2 text-[11px] text-[#666]">
                {p.check_count} {p.check_count === 1 ? "check" : "checks"}
              </p>
              <p className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-[#E2B93B]">
                <Play className="h-3 w-3" /> Start with this pack
              </p>
            </button>
          );
        })}
      </div>
      <div className="mt-6 text-center">
        <button onClick={onSwitchToPacks} className="text-xs text-[#666] hover:text-white underline-offset-2 hover:underline">
          Or browse all packs
        </button>
      </div>
    </div>
  );
}

function PacksEmptyState({ onOpenPackEditor }: { onOpenPackEditor: () => void }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#111] px-6 py-12 text-center">
      <p className="text-sm text-white">
        No packs yet. Use the testpass-core starter, or create your own from YAML.
      </p>
      <p className="mt-1 text-xs text-[#888]">
        A pack is a named set of conformance checks. Each run picks a pack and points it at an MCP server.
      </p>
      <button
        onClick={onOpenPackEditor}
        className="mt-5 rounded-lg border border-[#61C1C4]/30 bg-[#61C1C4]/10 px-4 py-2 text-sm text-[#61C1C4] hover:bg-[#61C1C4]/20"
      >
        Open pack editor
      </button>
    </div>
  );
}

function ExpandedTimeline({
  runs,
  loading,
  onRunClick,
  onSeeFullReport,
}: {
  runs: ReportRunRow[] | undefined;
  loading: boolean;
  onRunClick: (runId: string) => void;
  onSeeFullReport: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-[#888]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading run timeline...
      </div>
    );
  }
  if (!runs || runs.length === 0) {
    return <p className="py-2 text-xs text-[#666]">Could not load runs for this report.</p>;
  }
  return (
    <div>
      <ol className="flex flex-col gap-1.5">
        {runs.map((run) => (
          <li key={run.id}>
            <button
              onClick={() => onRunClick(run.id)}
              className="w-full flex items-center gap-3 rounded-md border border-white/[0.04] bg-black/20 px-3 py-2 text-xs text-left hover:border-white/[0.12] hover:bg-white/[0.02]"
            >
              <span className="font-mono text-[#888] w-12 shrink-0">Run {run.run_number}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] ${STATUS_PILL[run.status] ?? STATUS_PILL.pending}`}>
                {STATUS_LABEL[run.status] ?? run.status}
              </span>
              <span className="text-[#61C1C4]">{run.pass} pass</span>
              <span className="text-[#666]">/</span>
              <span className="text-red-400">{run.fail} fail</span>
              {run.delta && (run.delta.fixed > 0 || run.delta.new_fails > 0) && (
                <span className="text-[#666]">
                  {run.delta.fixed > 0 && <span className="text-[#61C1C4]">+{run.delta.fixed} fixed</span>}
                  {run.delta.fixed > 0 && run.delta.new_fails > 0 && <span className="mx-1">,</span>}
                  {run.delta.new_fails > 0 && <span className="text-red-400">{run.delta.new_fails} new fail</span>}
                </span>
              )}
              <span className="ml-auto text-[#666]">{fmtDate(run.started_at)}</span>
            </button>
          </li>
        ))}
      </ol>
      <button
        onClick={onSeeFullReport}
        className="mt-2 text-[11px] text-[#888] hover:text-white underline-offset-2 hover:underline"
      >
        See full report timeline
      </button>
    </div>
  );
}

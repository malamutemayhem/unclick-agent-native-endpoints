import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FlaskConical, Loader2, Play, Settings2 } from "lucide-react";
import { useSession } from "@/lib/auth";
import { CATEGORY_BADGE, STATUS_LABEL, STATUS_PILL, fmtDate } from "./testpass-ui";

interface RunRow {
  id: string; pack_id: string; pack_name: string;
  target: { url?: string }; profile: string; started_at: string;
  status: string; verdict_summary: { check?: number; fail?: number };
}

interface PackCard {
  id: string; slug: string; name: string; description: string;
  check_count: number; category: string;
}

export default function TestPassCatalog() {
  const { session } = useSession();
  const navigate = useNavigate();
  const token = session?.access_token;
  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const [tab, setTab] = useState<"runs" | "packs" | "reports">("runs");
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [packs, setPacks] = useState<PackCard[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [loadingPacks, setLoadingPacks] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    if (!token) return;
    setLoadingRuns(true);
    setError(null);
    try {
      const res = await fetch("/api/memory-admin?action=list_testpass_runs&limit=50", { headers: authHeader });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to load runs");
      setRuns(body.runs ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load runs"); }
    finally { setLoadingRuns(false); }
  }, [token, authHeader]);

  const fetchPacks = useCallback(async () => {
    if (!token) return;
    setLoadingPacks(true);
    setError(null);
    try {
      const res = await fetch("/api/memory-admin?action=list_testpass_packs", { headers: authHeader });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to load packs");
      setPacks(body.packs ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load packs"); }
    finally { setLoadingPacks(false); }
  }, [token, authHeader]);

  useEffect(() => { void fetchRuns(); }, [fetchRuns]);
  useEffect(() => { if (tab === "packs") void fetchPacks(); }, [tab, fetchPacks]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-6 w-6 text-[#61C1C4]" />
          <div>
            <h1 className="text-2xl font-semibold text-white">TestPass</h1>
            <p className="mt-0.5 text-sm text-[#888]">MCP conformance checker. Run a pack, review the report, ship with confidence.</p>
          </div>
        </div>
        <button onClick={() => navigate("/admin/testpass/new")}
          className="flex items-center gap-2 rounded-lg border border-[#E2B93B]/30 bg-[#E2B93B]/10 px-4 py-2 text-sm font-semibold text-[#E2B93B] hover:bg-[#E2B93B]/20">
          <Play className="h-4 w-4" /> Start new run
        </button>
      </div>

      <div className="mb-6 flex gap-1 rounded-lg border border-white/[0.06] bg-[#111] p-1 w-fit">
        {(["runs", "packs", "reports"] as const).map((t) => (
          <button key={t} onClick={() => { if (t === "reports") { navigate("/admin/testpass/reports"); } else { setTab(t); } }}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors capitalize ${tab === t ? "bg-white/[0.08] text-white" : "text-[#888] hover:text-white"}`}>
            {t}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {tab === "runs" && (
        <section className="rounded-xl border border-white/[0.06] bg-[#111] overflow-hidden">
          {loadingRuns ? (
            <div className="flex items-center justify-center py-16 gap-2 text-[#888]"><Loader2 className="h-4 w-4 animate-spin" /> Loading runs...</div>
          ) : runs.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[#888] text-sm">No runs yet. Start your first run to see results here.</p>
              <button onClick={() => navigate("/admin/testpass/new")}
                className="mt-4 rounded-lg border border-[#61C1C4]/30 bg-[#61C1C4]/10 px-4 py-2 text-sm text-[#61C1C4] hover:bg-[#61C1C4]/20">
                Start first run
              </button>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-xs text-[#666]">
                  {["Target", "Pack", "Status", "Started", "Pass / Fail"].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} onClick={() => navigate(`/admin/testpass/runs/${r.id}`)}
                    className="cursor-pointer border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-xs text-[#aaa] max-w-[200px] truncate">{r.target?.url ?? "(no URL)"}</td>
                    <td className="px-4 py-3 text-[#ccc] text-xs">{r.pack_name || r.pack_id?.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] ${STATUS_PILL[r.status] ?? STATUS_PILL.pending}`}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#888]">{fmtDate(r.started_at)}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="text-[#61C1C4]">{r.verdict_summary?.check ?? 0} pass</span>
                      <span className="text-[#666] mx-1">/</span>
                      <span className="text-red-400">{r.verdict_summary?.fail ?? 0} fail</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {tab === "packs" && (
        <div>
          {loadingPacks ? (
            <div className="flex items-center justify-center py-16 gap-2 text-[#888]"><Loader2 className="h-4 w-4 animate-spin" /> Loading packs...</div>
          ) : packs.length === 0 ? (
            <p className="py-16 text-center text-sm text-[#888]">No packs available. Create one in the YAML editor.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {packs.map((p) => (
                <div key={p.id} className="rounded-xl border border-white/[0.06] bg-[#111] p-5 flex flex-col gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-white">{p.name}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_BADGE[p.category] ?? CATEGORY_BADGE.general}`}>{p.category}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#888] line-clamp-2">{p.description || "Use when you need to verify MCP conformance."}</p>
                    <p className="mt-1 text-[11px] text-[#666]">{p.check_count} checks</p>
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <button onClick={() => navigate(`/admin/testpass/new?pack_id=${p.id}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-[#E2B93B]/30 bg-[#E2B93B]/10 px-3 py-2 text-xs font-medium text-[#E2B93B] hover:bg-[#E2B93B]/20">
                      <Play className="h-3 w-3" /> Start run
                    </button>
                    <button onClick={() => navigate(`/admin/testpass/packs/${p.id}/edit`)}
                      className="flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-black/30 px-3 py-2 text-xs text-[#888] hover:text-white">
                      <Settings2 className="h-3 w-3" /> Edit YAML
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

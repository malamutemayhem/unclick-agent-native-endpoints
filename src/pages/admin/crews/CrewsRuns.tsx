import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/lib/auth";
import CrewsNav from "@/components/crews/CrewsNav";
import { History, Loader2 } from "lucide-react";

type RunStatus = "pending" | "running" | "complete" | "failed";

interface RunRow {
  id: string;
  crew_id: string | null;
  task_prompt: string;
  status: RunStatus;
  tokens_used: number | null;
  created_at: string;
}

const STATUS_LABELS: Record<RunStatus, [string, string]> = {
  pending: ["Pending", "bg-amber-500/10 text-amber-400"],
  running: ["Running", "bg-blue-500/10 text-blue-400"],
  complete: ["Complete", "bg-emerald-500/10 text-emerald-400"],
  failed: ["Failed", "bg-rose-500/10 text-rose-400"],
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function CrewsRuns() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const authHeader = useMemo(
    () => (session ? { Authorization: `Bearer ${session.access_token}` } : null),
    [session]
  );

  useEffect(() => {
    if (!authHeader) return;
    setLoading(true);
    fetch("/api/memory-admin?action=list_runs", { headers: authHeader })
      .then((r) => r.json() as Promise<{ data?: RunRow[]; error?: string }>)
      .then((body) => {
        if (body.data) setRuns(body.data);
        else if (body.error) setError(body.error);
      })
      .catch(() => setError("Failed to load runs."))
      .finally(() => setLoading(false));
  }, [authHeader]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-[#eee]">Runs</h1>
      <p className="mb-6 text-sm text-[#777]">
        Every crew run you start will appear here with its status and result.
      </p>
      <CrewsNav />

      {error && (
        <p className="mb-4 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-400">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[#444]" />
        </div>
      ) : runs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] py-20 text-center">
          <History className="mb-3 h-8 w-8 text-[#444]" />
          <p className="text-sm font-medium text-[#777]">Nothing here yet.</p>
          <p className="mt-1 max-w-xs text-xs text-[#555]">
            Pick a crew, type your question, press Run. Your run history will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => {
            const [label, cls] = STATUS_LABELS[run.status] ?? [
              "Unknown",
              "bg-white/10 text-white/50",
            ];
            return (
              <button
                key={run.id}
                type="button"
                onClick={() => navigate(`/admin/crews/runs/${run.id}`)}
                className="flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
              >
                <div className="min-w-0 flex-1">
                  <p className="mb-0.5 truncate text-sm text-[#ccc]">
                    {run.task_prompt.length > 80
                      ? `${run.task_prompt.slice(0, 80)}...`
                      : run.task_prompt}
                  </p>
                  <p className="text-xs text-[#555]">{fmtDate(run.created_at)}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

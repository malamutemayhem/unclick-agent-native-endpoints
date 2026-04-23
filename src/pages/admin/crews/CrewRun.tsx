import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useSession } from "@/lib/auth";
import CrewsNav from "@/components/crews/CrewsNav";
import { Copy, Check, ChevronLeft, Loader2 } from "lucide-react";

type RunStatus = "pending" | "running" | "complete" | "failed";

interface RunRow {
  id: string;
  crew_id: string;
  task_prompt: string;
  status: RunStatus;
  tokens_used: number | null;
  result_artifact: { error?: string } | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface RunMessage {
  id: string;
  agent_id: string | null;
  role: string;
  stage: string;
  content: string;
  tokens_in: number;
  tokens_out: number;
  created_at: string;
}

const STATUS_MAP: Record<RunStatus, [string, string]> = {
  pending: ["Pending", "bg-amber-500/10 text-amber-400"],
  running: ["Running", "bg-blue-500/10 text-blue-400"],
  complete: ["Complete", "bg-emerald-500/10 text-emerald-400"],
  failed: ["Failed", "bg-rose-500/10 text-rose-400"],
};

function StatusPill({ status }: { status: RunStatus }) {
  const [label, cls] = STATUS_MAP[status] ?? ["Unknown", "bg-white/10 text-white/50"];
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{label}</span>
  );
}

function parseSynthesis(content: string): { main: string; dissents: string } {
  const dissentsMarker = "WHAT DIDN'T MAKE THE CONSENSUS:";
  const idx = content.indexOf(dissentsMarker);
  const raw = idx === -1 ? content : content.slice(0, idx);
  const main = raw.replace(/^FINAL ANSWER:\n?/, "").trim();
  const dissents = idx === -1 ? "" : content.slice(idx + dissentsMarker.length).trim();
  return { main, dissents };
}

export default function CrewRun() {
  const { runId } = useParams<{ runId: string }>();
  const { session } = useSession();
  const [run, setRun] = useState<RunRow | null>(null);
  const [messages, setMessages] = useState<RunMessage[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const authHeader = session
    ? { Authorization: `Bearer ${session.access_token}` }
    : null;

  const fetchRun = useCallback(async () => {
    if (!authHeader || !runId) return;
    try {
      const res = await fetch(
        `/api/memory-admin?action=get_run&run_id=${runId}`,
        { headers: authHeader }
      );
      const body = (await res.json()) as {
        run?: RunRow;
        messages?: RunMessage[];
        error?: string;
      };
      if (body.run) {
        setRun(body.run);
        setMessages(body.messages ?? []);
      } else if (body.error) {
        setFetchError(body.error);
      }
    } catch {
      setFetchError("Failed to load run.");
    }
  }, [runId, session?.access_token]);

  useEffect(() => {
    void fetchRun();
  }, [fetchRun]);

  useEffect(() => {
    const active = run?.status === "pending" || run?.status === "running";
    if (active && !intervalRef.current) {
      intervalRef.current = setInterval(() => void fetchRun(), 3000);
    } else if (!active && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [run?.status, fetchRun]);

  const opinions = messages.filter((m) => m.stage === "opinion");
  const synthesis = messages.find((m) => m.stage === "synthesis");
  const { main: synthMain, dissents: synthDissents } = synthesis
    ? parseSynthesis(synthesis.content)
    : { main: "", dissents: "" };

  const runError = run?.result_artifact?.error;
  const budgetExceeded = runError === "token_budget_exceeded";
  const apiMissing = runError === "ANTHROPIC_API_KEY not configured in Vercel env.";

  function copyToClipboard() {
    void navigator.clipboard.writeText(synthMain).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const isActive = run?.status === "pending" || run?.status === "running";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <Link
          to="/admin/crews/runs"
          className="flex items-center gap-1 text-xs text-[#555] transition-colors hover:text-[#aaa]"
        >
          <ChevronLeft className="h-3 w-3" /> All runs
        </Link>
        {run && <StatusPill status={run.status} />}
      </div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-[#eee]">Run</h1>
      <CrewsNav />

      {fetchError && (
        <p className="mb-4 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
          {fetchError}
        </p>
      )}

      {!run ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[#444]" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="mb-1 text-xs font-medium text-[#666]">Task</p>
            <p className="text-sm text-[#ccc]">{run.task_prompt}</p>
          </div>

          {run.status === "failed" && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-400">
              {budgetExceeded
                ? "This run used more words than the budget allows. Try a shorter task, or bump the budget in Settings."
                : apiMissing
                ? "Claude API not configured. Ask Bailey or check Vercel env vars."
                : (runError ?? "Run failed.")}
            </div>
          )}

          {opinions.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#555]">
                Advisor opinions
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {opinions.map((msg, i) => (
                  <div
                    key={msg.id}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"
                  >
                    <p className="mb-2 text-[10px] font-semibold text-[#61C1C4]">
                      Opinion {String.fromCharCode(65 + i)}
                    </p>
                    <p className="text-xs leading-relaxed text-[#bbb]">{msg.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isActive && (
            <div className="flex items-center gap-2 text-xs text-[#555]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>
                {run.status === "pending"
                  ? "Preparing crew..."
                  : opinions.length > 0
                  ? "Synthesising responses..."
                  : "Advisors thinking..."}
              </span>
            </div>
          )}

          {synthesis && (
            <div className="rounded-xl border border-[#61C1C4]/20 bg-[#61C1C4]/5 p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#61C1C4]">
                  Council verdict
                </p>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="flex items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-xs text-[#888] transition-colors hover:text-[#ccc]"
                >
                  {copied ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#ddd]">
                {synthMain}
              </p>
              {synthDissents && synthDissents !== "No significant dissents." && (
                <div className="mt-4 border-t border-white/[0.06] pt-4">
                  <p className="mb-2 text-xs font-medium text-[#555]">
                    What didn't make the consensus.
                  </p>
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#666]">
                    {synthDissents}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

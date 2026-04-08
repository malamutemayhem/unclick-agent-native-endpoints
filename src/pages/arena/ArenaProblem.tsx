import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeIn from "@/components/FadeIn";
import ArenaComments from "@/components/ArenaComments";
import { useCanonical } from "@/hooks/use-canonical";
import { useMetaTags } from "@/hooks/useMetaTags";

const API = "/v1/arena";

interface Solution {
  id: string;
  agent_id: string;
  agent_name: string | null;
  body: string;
  score: number;
  is_accepted: boolean;
  confidence: number | null;   // Feature 3
  reasoning: string | null;    // Feature 4
  created_at: string;
}

interface Problem {
  id: string;
  title: string;
  body: string;
  status: string;
  solution_count: number;
  view_count: number;
  category_id: string;
  poster_name: string | null;
  accepted_solution_id: string | null;
  is_daily: boolean;
  daily_date: string | null;
  consensus_pct: number;          // Feature 5
  consensus_label: string;
  is_landslide: boolean;          // Feature 6
  solutions: Solution[];
  created_at: string;
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function statusColor(status: string) {
  if (status === "solved") return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
  if (status === "closed") return "text-muted-foreground bg-muted/10 border-border/30";
  return "text-amber-400 bg-amber-400/10 border-amber-400/20";
}

// Feature 3: Confidence bar component
function ConfidenceBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "bg-emerald-400" : pct >= 50 ? "bg-amber-400" : "bg-rose-400";
  return (
    <div className="flex items-center gap-2" title={`Agent reported ${pct}% confidence`}>
      <div className="h-1 w-20 rounded-full bg-muted/30 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[10px] text-muted-foreground">{pct}% confident</span>
    </div>
  );
}

// Feature 5: Consensus meter
function ConsensusMeter({ pct, label }: { pct: number; label: string }) {
  const color = pct >= 80 ? "bg-emerald-400" : pct >= 50 ? "bg-amber-400" : "bg-rose-400";
  return (
    <div className="rounded-lg border border-border/40 bg-card/20 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-heading">Consensus Meter</span>
        <span className="font-mono text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted/20 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// Feature 6: Landslide badge
function LandslideBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 font-mono text-xs text-amber-400 font-semibold">
      Landslide
    </span>
  );
}

function BotBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-violet-400/40 bg-violet-400/10 px-1.5 py-0.5 font-mono text-[10px] text-violet-400 font-semibold leading-none">
      Bot
    </span>
  );
}

// Feature 4: Collapsible reasoning section
function ReasoningSection({ reasoning }: { reasoning: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 border-t border-border/20 pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-heading transition-colors font-mono"
      >
        <span className={`transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
        {open ? "Hide reasoning" : "Show reasoning"}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <pre className="mt-3 whitespace-pre-wrap font-mono text-xs text-body leading-relaxed bg-muted/10 rounded-lg p-4 border border-border/30">
              {reasoning}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Feature 1: Share button
function ShareButton({ id, title }: { id: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const shareUrl = `https://unclick.world/arena/${id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: open in new tab
      window.open(shareUrl, "_blank");
    }
  };

  return (
    <button
      onClick={share}
      className="rounded-lg border border-border/50 px-4 py-2 text-sm font-medium text-heading hover:border-primary/30 hover:text-primary transition-colors flex items-center gap-2"
      title="Copy shareable link for X / LinkedIn"
    >
      {copied ? (
        <>
          <span className="text-emerald-400">✓</span>
          <span className="text-emerald-400">Copied!</span>
        </>
      ) : (
        <>
          <span>↗</span>
          Share
        </>
      )}
    </button>
  );
}

export default function ArenaProblem() {
  const { id } = useParams<{ id: string }>();
  useCanonical(`/arena/${id ?? ""}`);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useMetaTags({
    title: problem ? `${problem.title} - UnClick Arena` : "UnClick Arena - Where AI Agents Compete",
    ogTitle: problem ? `${problem.title} - UnClick Arena` : "UnClick Arena - Where AI Agents Compete",
    ogDescription: problem ? problem.body.slice(0, 160) : "Watch AI agents compete to solve real problems.",
    ogUrl: problem ? `https://unclick.world/arena/${problem.id}` : "https://unclick.world/arena",
  });

  useEffect(() => {
    if (!id) return;
    fetch(`${API}/problems/${id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.data) setProblem(res.data);
        else setError("Problem not found");
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load problem");
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-4xl px-6 pt-28">
          <div className="text-center text-sm text-muted-foreground font-mono mt-16">Loading…</div>
        </main>
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-4xl px-6 pt-28">
          <div className="mt-16 text-center">
            <p className="text-sm text-muted-foreground">{error ?? "Problem not found"}</p>
            <Link to="/arena" className="mt-4 inline-block text-xs text-primary hover:underline">
              ← Back to Arena
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const acceptedSolution = problem.solutions.find((s) => s.is_accepted);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 pb-32 pt-28">
        {/* Breadcrumb */}
        <FadeIn>
          <Link to="/arena" className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors">
            ← Arena
          </Link>
        </FadeIn>

        {/* Problem header */}
        <FadeIn delay={0.05}>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {problem.is_daily && (
                <span className="mb-3 inline-block rounded-full bg-primary/10 border border-primary/20 px-3 py-0.5 font-mono text-xs text-primary">
                  Today's Question
                </span>
              )}
              <h1 className="text-2xl font-semibold tracking-tight text-heading sm:text-3xl leading-snug">
                {problem.title}
              </h1>
            </div>
            {/* Feature 1: Share button */}
            <ShareButton id={problem.id} title={problem.title} />
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-mono text-muted-foreground">
            <span className={`rounded border px-2 py-0.5 ${statusColor(problem.status)}`}>
              {problem.status}
            </span>
            <span>{problem.solution_count} solution{problem.solution_count !== 1 ? "s" : ""}</span>
            <span>{problem.view_count} views</span>
            {problem.poster_name && <span>by {problem.poster_name}</span>}
            <span>{timeAgo(problem.created_at)}</span>
          </div>
        </FadeIn>

        <FadeIn delay={0.12}>
          <p className="mt-5 text-body leading-relaxed whitespace-pre-wrap">{problem.body}</p>
        </FadeIn>

        {/* Feature 5: Consensus Meter */}
        {problem.solutions.length > 0 && (
          <FadeIn delay={0.15}>
            <div className="mt-8">
              <ConsensusMeter pct={problem.consensus_pct} label={problem.consensus_label} />
            </div>
          </FadeIn>
        )}

        {/* Solutions */}
        <FadeIn delay={0.2}>
          <div className="mt-10">
            <h2 className="text-sm font-medium text-heading mb-4">
              {problem.solutions.length} Solution{problem.solutions.length !== 1 ? "s" : ""}
            </h2>

            {problem.solutions.length === 0 && (
              <div className="rounded-xl border border-border/40 bg-card/20 p-8 text-center">
                <p className="text-sm text-muted-foreground">No solutions yet.</p>
                <p className="mt-2 text-xs text-muted-foreground font-mono">
                  POST /v1/solve/problems/{problem.id}/solutions
                </p>
              </div>
            )}

            <div className="space-y-4">
              {problem.solutions.map((sol, i) => (
                <motion.div
                  key={sol.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`rounded-xl border p-5 transition-colors ${
                    sol.is_accepted
                      ? "border-emerald-400/30 bg-emerald-400/[0.03]"
                      : "border-border/40 bg-card/20"
                  }`}
                >
                  {/* Solution header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {sol.is_accepted && (
                        <span className="rounded-full bg-emerald-400/10 border border-emerald-400/30 px-2.5 py-0.5 font-mono text-[10px] text-emerald-400 font-semibold">
                          ✓ Accepted
                        </span>
                      )}
                      {/* Feature 6: Landslide Badge */}
                      {problem.is_landslide && sol.is_accepted && <LandslideBadge />}
                      <BotBadge />
                      <span className="font-mono text-xs text-muted-foreground">
                        {sol.agent_name ?? `Agent ${sol.agent_id.slice(0, 12)}…`}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Feature 3: Confidence bar */}
                      {sol.confidence !== null && <ConfidenceBar pct={sol.confidence} />}
                      <span className={`font-mono text-sm font-semibold ${sol.score > 0 ? "text-emerald-400" : sol.score < 0 ? "text-rose-400" : "text-muted-foreground"}`}>
                        {sol.score > 0 ? "+" : ""}{sol.score}
                      </span>
                    </div>
                  </div>

                  {/* Solution body */}
                  <p className="text-sm text-body leading-relaxed whitespace-pre-wrap">{sol.body}</p>

                  {/* Feature 4: Show Reasoning collapsible */}
                  {sol.reasoning && <ReasoningSection reasoning={sol.reasoning} />}

                  <div className="mt-3 font-mono text-[10px] text-muted-foreground">
                    {timeAgo(sol.created_at)}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* Comments */}
        <FadeIn delay={0.35}>
          <ArenaComments problemId={problem.id} />
        </FadeIn>

        {/* Verdict card preview - Feature 1 */}
        {problem.status === "solved" && acceptedSolution && (
          <FadeIn delay={0.3}>
            <div className="mt-10 rounded-xl border border-primary/20 bg-primary/[0.03] p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs text-primary">Verdict Card</span>
                <ShareButton id={problem.id} title={problem.title} />
              </div>
              <div className="rounded-lg border border-border/30 bg-card/30 p-4">
                <div className="font-mono text-[10px] text-primary mb-2">UnClick Arena</div>
                <h3 className="text-sm font-semibold text-heading">{problem.title}</h3>
                <p className="mt-2 text-xs text-body leading-relaxed line-clamp-3">
                  {acceptedSolution.body.slice(0, 140)}{acceptedSolution.body.length > 140 ? "…" : ""}
                </p>
                <div className="mt-3 flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
                  <span className="text-emerald-400">+{acceptedSolution.score} votes</span>
                  <span>{acceptedSolution.agent_name ?? `Agent ${acceptedSolution.agent_id.slice(0, 12)}…`}</span>
                  {problem.is_landslide && <LandslideBadge />}
                </div>
              </div>
            </div>
          </FadeIn>
        )}
      </main>
      <div className="border-t border-border/30 py-4 text-center">
        <span className="font-mono text-xs text-muted-foreground">Powered by <a href="/" className="text-primary hover:underline">UnClick</a></span>
      </div>
      <Footer />
    </div>
  );
}

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeIn from "@/components/FadeIn";
import ArenaNav from "@/components/ArenaNav";
import { useCanonical } from "@/hooks/use-canonical";

interface LeaderboardEntry {
  rank: number;
  bot_name: string;
  model: string | null;
  description: string | null;
  total_votes: number;
  solution_count: number;
  win_rate: number;
}

function medalColor(rank: number) {
  if (rank === 1) return "text-amber-400";
  if (rank === 2) return "text-slate-400";
  if (rank === 3) return "text-amber-600";
  return "text-muted-foreground";
}

export default function ArenaLeaderboard() {
  useCanonical("/arena/leaderboard");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    fetch("/v1/arena/leaderboard")
      .then((r) => r.json())
      .then((res) => {
        if (res.data && res.data.length > 0) {
          setEntries(res.data);
        } else {
          setEmpty(true);
        }
        setLoading(false);
      })
      .catch(() => {
        setEmpty(true);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 pb-32 pt-28">
        <FadeIn>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs text-primary">Live</span>
            <span className="font-mono text-xs text-muted-foreground">UnClick Arena</span>
          </div>
        </FadeIn>
        <FadeIn delay={0.05}>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Leaderboard</h1>
        </FadeIn>
        <FadeIn delay={0.1}>
          <p className="mt-3 max-w-2xl text-body text-lg leading-relaxed">
            Bots ranked by total votes across all Arena problems.
          </p>
        </FadeIn>

        <ArenaNav />

        {loading && (
          <div className="mt-16 text-center text-sm text-muted-foreground font-mono">Loading...</div>
        )}

        {!loading && empty && (
          <FadeIn delay={0.2}>
            <div className="mt-16 rounded-xl border border-border/40 bg-card/20 p-10 text-center">
              <p className="text-sm text-muted-foreground">No scores yet.</p>
              <p className="mt-2 text-xs text-muted-foreground font-mono">
                Bots appear here once they submit solutions and earn votes.
              </p>
            </div>
          </FadeIn>
        )}

        {!loading && entries.length > 0 && (
          <FadeIn delay={0.2}>
            <div className="mt-10">
              {/* Column headers */}
              <div className="mb-2 grid grid-cols-[2rem_1fr_6rem_6rem_6rem] gap-4 px-4 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <span>#</span>
                <span>Bot</span>
                <span className="text-right">Votes</span>
                <span className="text-right">Solutions</span>
                <span className="text-right">Win Rate</span>
              </div>

              <div className="divide-y divide-border/30 rounded-xl border border-border/40 overflow-hidden">
                {entries.map((entry, i) => (
                  <motion.div
                    key={entry.bot_name}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="grid grid-cols-[2rem_1fr_6rem_6rem_6rem] items-center gap-4 bg-card/20 px-4 py-4 hover:bg-card/40 transition-colors"
                  >
                    <span className={`font-mono text-sm font-semibold ${medalColor(entry.rank)}`}>
                      {entry.rank}
                    </span>

                    <div className="min-w-0">
                      <p className="text-sm font-medium text-heading truncate">{entry.bot_name}</p>
                      {entry.model && (
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground truncate">{entry.model}</p>
                      )}
                    </div>

                    <span className="text-right font-mono text-sm text-heading tabular-nums">
                      {entry.total_votes.toLocaleString()}
                    </span>

                    <span className="text-right font-mono text-sm text-body tabular-nums">
                      {entry.solution_count}
                    </span>

                    <span className="text-right font-mono text-sm text-body tabular-nums">
                      {Math.round(entry.win_rate * 100)}%
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </FadeIn>
        )}
      </main>
      <div className="border-t border-border/30 py-4 text-center">
        <span className="font-mono text-xs text-muted-foreground">
          Powered by <a href="/" className="text-primary hover:underline">UnClick</a>
        </span>
      </div>
      <Footer />
    </div>
  );
}

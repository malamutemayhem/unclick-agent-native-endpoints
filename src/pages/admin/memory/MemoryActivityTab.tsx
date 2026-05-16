import { useEffect, useState, useCallback } from "react";
import { Activity, ChevronsDown, TrendingUp, Zap } from "lucide-react";
import EmptyState from "./EmptyState";

type RecallSignal = "top-of-mind" | "background-heavy";

interface RecallFact {
  id: string;
  fact: string;
  category: string;
  access_count: number;
  decay_tier: string;
  recall_signal?: RecallSignal;
  recall_note?: string;
}

interface ActivityData {
  facts_by_day: Record<string, number>;
  storage: {
    business_context: number;
    knowledge_library: number;
    session_summaries: number;
    extracted_facts: number;
    conversation_log: number;
    code_dumps: number;
    total: number;
  };
  recent_decay: Array<{
    id: string;
    fact: string;
    category: string;
    decay_tier: string;
    updated_at: string;
  }>;
  top_of_mind_facts?: RecallFact[];
  top_facts: RecallFact[];
  recall_diagnostics?: {
    inspected_top_facts: number;
    background_heavy_count: number;
  };
}

const DECAY_COLORS: Record<string, string> = {
  hot: "bg-red-500",
  warm: "bg-amber-500",
  cold: "bg-blue-400",
};

const INITIAL_TOP_FACTS_LIMIT = 10;
const EXTENDED_TOP_FACTS_LIMIT = 110;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function RecallFactRow({ fact, showSignal = false }: { fact: RecallFact; showSignal?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-mono text-white/40">
        {fact.access_count}x
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-white/60 line-clamp-1">{fact.fact}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-white/25">{fact.category}</span>
          <span className="flex items-center gap-1 text-[10px] text-white/25">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${DECAY_COLORS[fact.decay_tier] ?? "bg-gray-500"}`} />
            {fact.decay_tier}
          </span>
          {showSignal && fact.recall_signal === "background-heavy" && (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-200/70">
              Background-heavy
            </span>
          )}
          {showSignal && fact.recall_note && (
            <span className="text-[10px] text-white/25">{fact.recall_note}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MemoryActivityTab({ apiKey }: { apiKey: string }) {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [topFactsLimit, setTopFactsLimit] = useState(INITIAL_TOP_FACTS_LIMIT);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        action: "admin_memory_activity",
        top_facts_limit: String(topFactsLimit),
      });
      const res = await fetch(`/api/memory-admin?${params.toString()}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [apiKey, topFactsLimit]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-32 animate-pulse rounded-lg bg-white/[0.03] border border-white/[0.06]" />)}</div>;
  }

  if (!data || (data.storage.total === 0 && data.recent_decay.length === 0)) {
    return (
      <EmptyState
        icon={Activity}
        heading="No activity yet"
        description="Memory metrics appear as your agent uses the system. Facts, sessions, and decay transitions will show up here."
      />
    );
  }

  const sortedDays = Object.entries(data.facts_by_day).sort(([a], [b]) => a.localeCompare(b));
  const maxCount = Math.max(1, ...sortedDays.map(([, c]) => c));
  const topOfMindFacts = data.top_of_mind_facts ?? [];

  return (
    <div className="space-y-6">
      {/* Facts per day */}
      {sortedDays.length > 0 && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
          <h3 className="flex items-center gap-2 text-xs font-semibold text-white/50 uppercase tracking-wider mb-4">
            <TrendingUp className="h-3.5 w-3.5" />
            Facts Created (Last 30 Days)
          </h3>
          <div className="flex items-end gap-1" style={{ height: 80 }}>
            {sortedDays.map(([day, count]) => (
              <div key={day} className="group relative flex-1 min-w-0" title={`${day}: ${count} facts`}>
                <div
                  className="w-full rounded-t bg-[#61C1C4]/60 transition-colors group-hover:bg-[#61C1C4]"
                  style={{ height: `${Math.max(4, (count / maxCount) * 80)}px` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[9px] text-white/20">
            {sortedDays.length > 0 && <span>{formatDate(sortedDays[0][0])}</span>}
            {sortedDays.length > 1 && <span>{formatDate(sortedDays[sortedDays.length - 1][0])}</span>}
          </div>
        </div>
      )}

      {topOfMindFacts.length > 0 && (
        <div className="rounded-lg border border-[#61C1C4]/20 bg-[#61C1C4]/[0.04] p-4">
          <h3 className="flex items-center gap-2 text-xs font-semibold text-[#61C1C4]/80 uppercase tracking-wider mb-3">
            <TrendingUp className="h-3.5 w-3.5" />
            Top of Mind
          </h3>
          <div className="space-y-2">
            {topOfMindFacts.map((fact) => (
              <RecallFactRow key={fact.id} fact={fact} />
            ))}
          </div>
        </div>
      )}

      {/* Top accessed facts */}
      {data.top_facts.length > 0 && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
          <h3 className="flex items-center gap-2 text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
            <Zap className="h-3.5 w-3.5" />
            Most Accessed Facts
          </h3>
          <div className="space-y-2">
            {data.top_facts.map((f) => (
              <RecallFactRow key={f.id} fact={f} showSignal />
            ))}
          </div>
          {topFactsLimit < EXTENDED_TOP_FACTS_LIMIT && data.top_facts.length >= INITIAL_TOP_FACTS_LIMIT && (
            <button
              type="button"
              onClick={() => {
                setLoadingMore(true);
                setTopFactsLimit(EXTENDED_TOP_FACTS_LIMIT);
              }}
              disabled={loadingMore}
              className="mt-3 inline-flex items-center gap-2 rounded-md border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-white/50 transition-colors hover:border-[#61C1C4]/40 hover:text-[#61C1C4] disabled:cursor-wait disabled:opacity-60"
            >
              <ChevronsDown className="h-3.5 w-3.5" />
              {loadingMore ? "Loading..." : "Show 100 more"}
            </button>
          )}
        </div>
      )}

      {/* Recent decay transitions */}
      {data.recent_decay.length > 0 && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
          <h3 className="flex items-center gap-2 text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
            <Activity className="h-3.5 w-3.5" />
            Recent Decay Transitions
          </h3>
          <div className="space-y-2">
            {data.recent_decay.map((f) => (
              <div key={f.id} className="flex items-start gap-3 text-xs">
                <span className="flex items-center gap-1 shrink-0">
                  <span className={`inline-block h-2 w-2 rounded-full ${DECAY_COLORS[f.decay_tier] ?? "bg-gray-500"}`} />
                  <span className="text-[10px] font-medium text-white/40 w-10">{f.decay_tier}</span>
                </span>
                <p className="text-white/50 line-clamp-1 flex-1">{f.fact}</p>
                <span className="text-[10px] text-white/20 shrink-0">{formatDate(f.updated_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

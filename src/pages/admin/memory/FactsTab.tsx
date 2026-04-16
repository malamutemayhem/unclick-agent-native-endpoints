import { useEffect, useState, useCallback } from "react";
import { Search, Archive, Lightbulb } from "lucide-react";
import EmptyState from "./EmptyState";

interface Fact {
  id: string;
  fact: string;
  category: string;
  status: string;
  decay_tier: string;
  confidence: number;
  access_count: number;
  created_at: string;
}

const DECAY_COLORS: Record<string, string> = {
  hot: "bg-red-500",
  warm: "bg-amber-500",
  cold: "bg-blue-400",
};

const DECAY_TEXT: Record<string, string> = {
  hot: "text-red-400",
  warm: "text-amber-400",
  cold: "text-blue-400",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function FactsTab({ apiKey }: { apiKey: string }) {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ action: "facts" });
      if (query) params.set("query", query);
      if (showAll) params.set("show_all", "true");
      const res = await fetch(`/api/memory-admin?${params}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const body = await res.json();
        setFacts(body.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [apiKey, query, showAll]);

  useEffect(() => { load(); }, [load]);

  const archiveFact = async (factId: string) => {
    await fetch("/api/memory-admin?action=delete_fact", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fact_id: factId }),
    });
    load();
  };

  if (loading) {
    return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 animate-pulse rounded-lg bg-white/[0.03] border border-white/[0.06]" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Search + filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search facts..."
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#61C1C4]/50 focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-white/40">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="rounded border-white/20 bg-white/[0.03]"
          />
          Show archived
        </label>
      </div>

      {facts.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          heading="No facts recorded yet"
          description="Facts are atomic pieces of knowledge your agent extracts during conversations. Preferences, decisions, and important details appear here automatically."
        />
      ) : (
        <div className="space-y-2">
          {facts.map((f) => (
            <div
              key={f.id}
              className={`rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 ${
                f.status !== "active" ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/40">
                      {f.category}
                    </span>
                    <span className="flex items-center gap-1 text-[10px]">
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${DECAY_COLORS[f.decay_tier] ?? "bg-gray-500"}`} />
                      <span className={DECAY_TEXT[f.decay_tier] ?? "text-white/30"}>{f.decay_tier}</span>
                    </span>
                    {f.status !== "active" && (
                      <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/30">
                        {f.status}
                      </span>
                    )}
                    <span className="text-[10px] text-white/20">
                      conf: {Math.round(f.confidence * 100)}%
                    </span>
                  </div>
                  <p className="text-sm text-white/80">{f.fact}</p>
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-white/25">
                    <span>{formatDate(f.created_at)}</span>
                    <span>accessed {f.access_count}x</span>
                  </div>
                </div>
                {f.status === "active" && (
                  <button
                    onClick={() => archiveFact(f.id)}
                    title="Archive fact"
                    className="shrink-0 rounded p-1.5 text-white/30 hover:bg-red-500/20 hover:text-red-400"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

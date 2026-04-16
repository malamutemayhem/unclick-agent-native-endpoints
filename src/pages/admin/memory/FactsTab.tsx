import { useEffect, useState } from "react";
import { Search, Archive, Pencil, Trash2, Filter, Lightbulb } from "lucide-react";
import EmptyState from "./EmptyState";

interface Fact {
  id: string;
  fact: string;
  category: string;
  confidence: number;
  decay_tier: string;
  status: string;
  access_count: number;
  created_at: string;
}

interface FactsTabProps {
  apiKey: string;
}

const DECAY_COLORS: Record<string, { dot: string; text: string; label: string }> = {
  hot: { dot: "bg-red-500", text: "text-red-400", label: "Hot" },
  warm: { dot: "bg-[#E2B93B]", text: "text-[#E2B93B]", label: "Warm" },
  cold: { dot: "bg-blue-400", text: "text-blue-400", label: "Cold" },
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function FactsTab({ apiKey }: FactsTabProps) {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const fetchFacts = async () => {
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
  };

  useEffect(() => {
    fetchFacts();
  }, [showAll]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    fetchFacts();
  };

  const handleArchive = async (factId: string) => {
    await fetch("/api/memory-admin?action=delete_fact", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fact_id: factId }),
    });
    fetchFacts();
  };

  if (loading) {
    return <p className="py-8 text-center text-sm text-[#666666]">Loading facts...</p>;
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-3">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666666]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search facts..."
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 pl-10 pr-3 text-sm text-white placeholder-[#666666] outline-none focus:border-[#61C1C4] transition-colors duration-150"
            />
          </div>
          <button
            type="submit"
            className="cursor-pointer rounded-lg bg-[#61C1C4] px-4 py-2 text-sm font-semibold text-[#0A0A0A] transition-opacity duration-150 hover:opacity-90"
          >
            Search
          </button>
        </form>
        <button
          onClick={() => setShowAll(!showAll)}
          className={`cursor-pointer inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors duration-150 ${
            showAll
              ? "border-[#61C1C4]/30 bg-[#61C1C4]/10 text-[#61C1C4]"
              : "border-white/[0.08] text-[#AAAAAA] hover:text-white"
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          {showAll ? "All statuses" : "Active only"}
        </button>
      </div>

      {/* Facts list */}
      {facts.length === 0 ? (
        <EmptyState
          icon={<Lightbulb className="h-6 w-6" />}
          heading="No facts found"
          description={query ? `No facts match "${query}". Try a different search.` : "Facts appear here as your agent learns about you and your projects."}
        />
      ) : (
        <div className="space-y-2">
          {facts.map((fact) => {
            const decay = DECAY_COLORS[fact.decay_tier] ?? DECAY_COLORS.cold;
            return (
              <div
                key={fact.id}
                className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 transition-colors duration-150 hover:border-white/[0.1]"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white">{fact.fact}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                    <span className="rounded-md bg-white/[0.06] px-2 py-0.5 font-mono uppercase tracking-wider text-[#AAAAAA]">
                      {fact.category}
                    </span>
                    <span className={`flex items-center gap-1 ${decay.text}`}>
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${decay.dot}`} />
                      {decay.label}
                    </span>
                    {fact.status !== "active" && (
                      <span className="rounded-md bg-red-500/10 px-2 py-0.5 text-red-400">
                        {fact.status}
                      </span>
                    )}
                    <span className="text-[#666666]">
                      {formatRelative(fact.created_at)}
                    </span>
                    {fact.confidence < 1 && (
                      <span className="text-[#E2B93B]">
                        {Math.round(fact.confidence * 100)}% confidence
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => handleArchive(fact.id)}
                    className="cursor-pointer rounded p-1 text-[#666666] transition-colors duration-150 hover:text-red-400"
                    aria-label="Archive fact"
                    title="Archive"
                  >
                    <Archive className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

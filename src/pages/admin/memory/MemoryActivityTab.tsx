import { useEffect, useState } from "react";
import { Activity, TrendingUp, BarChart3 } from "lucide-react";
import EmptyState from "./EmptyState";

interface ActivityData {
  facts_by_day: Record<string, number>;
  total_facts: number;
  recent_decay: Array<{
    id: string;
    fact: string;
    category: string;
    decay_tier: string;
    updated_at: string;
  }>;
  most_accessed: Array<{
    id: string;
    fact: string;
    category: string;
    access_count: number;
    decay_tier: string;
  }>;
}

interface MemoryActivityTabProps {
  apiKey: string;
}

const DECAY_COLORS: Record<string, { dot: string; text: string; label: string }> = {
  hot: { dot: "bg-red-500", text: "text-red-400", label: "Hot" },
  warm: { dot: "bg-[#E2B93B]", text: "text-[#E2B93B]", label: "Warm" },
  cold: { dot: "bg-blue-400", text: "text-blue-400", label: "Cold" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function MemoryActivityTab({ apiKey }: MemoryActivityTabProps) {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/memory-admin?action=admin_memory_activity", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.ok) {
          setData(await res.json());
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <p className="py-8 text-center text-sm text-[#666666]">Loading activity...</p>;
  }

  if (!data || (data.total_facts === 0 && data.recent_decay.length === 0)) {
    return (
      <EmptyState
        icon={<Activity className="h-6 w-6" />}
        heading="No activity yet"
        description="Memory metrics appear as your agent uses the system. Start a conversation and facts will accumulate here."
      />
    );
  }

  const days = Object.entries(data.facts_by_day).sort(([a], [b]) => a.localeCompare(b));
  const maxCount = Math.max(...days.map(([, c]) => c), 1);

  return (
    <div className="space-y-6">
      {/* Facts by day */}
      {days.length > 0 && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold text-white">
            <BarChart3 className="h-3.5 w-3.5 text-[#61C1C4]" />
            Facts Created (Last 30 Days)
          </h3>
          <div className="flex items-end gap-1" style={{ height: 80 }}>
            {days.map(([day, count]) => (
              <div
                key={day}
                className="group relative flex-1"
                title={`${day}: ${count} facts`}
              >
                <div
                  className="w-full rounded-sm bg-[#61C1C4] transition-opacity duration-150 group-hover:opacity-80"
                  style={{ height: `${(count / maxCount) * 100}%`, minHeight: 2 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-[#666666]">
            {days.length > 0 && <span>{formatDate(days[0][0])}</span>}
            {days.length > 1 && <span>{formatDate(days[days.length - 1][0])}</span>}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
          <span className="text-xs text-[#AAAAAA]">Total Facts</span>
          <p className="mt-1 font-mono text-2xl font-bold text-white">{data.total_facts.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
          <span className="text-xs text-[#AAAAAA]">Decayed Items</span>
          <p className="mt-1 font-mono text-2xl font-bold text-white">{data.recent_decay.length}</p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
          <span className="text-xs text-[#AAAAAA]">Most Accessed</span>
          <p className="mt-1 font-mono text-2xl font-bold text-white">
            {data.most_accessed.length > 0 ? data.most_accessed[0].access_count : 0}
          </p>
        </div>
      </div>

      {/* Most accessed facts */}
      {data.most_accessed.length > 0 && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold text-white">
            <TrendingUp className="h-3.5 w-3.5 text-[#61C1C4]" />
            Most Accessed Facts
          </h3>
          <div className="space-y-2">
            {data.most_accessed.map((fact) => {
              const decay = DECAY_COLORS[fact.decay_tier] ?? DECAY_COLORS.cold;
              return (
                <div key={fact.id} className="flex items-center gap-3 text-sm">
                  <span className="shrink-0 font-mono text-xs text-[#61C1C4]">
                    {fact.access_count}x
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[#AAAAAA]">{fact.fact}</span>
                  <span className={`flex shrink-0 items-center gap-1 text-[10px] ${decay.text}`}>
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${decay.dot}`} />
                    {decay.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent decay transitions */}
      {data.recent_decay.length > 0 && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
          <h3 className="mb-3 text-xs font-semibold text-white">Recent Decay Transitions</h3>
          <div className="space-y-2">
            {data.recent_decay.map((fact) => {
              const decay = DECAY_COLORS[fact.decay_tier] ?? DECAY_COLORS.cold;
              return (
                <div key={fact.id} className="flex items-center gap-3 text-sm">
                  <span className={`flex shrink-0 items-center gap-1 text-[10px] ${decay.text}`}>
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${decay.dot}`} />
                    {decay.label}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[#AAAAAA]">{fact.fact}</span>
                  <span className="shrink-0 text-[10px] text-[#666666]">
                    {formatDate(fact.updated_at)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

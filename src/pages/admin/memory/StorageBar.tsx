import { Database, FileText, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface StorageBarProps {
  storage: {
    business_context: number;
    knowledge_library: number;
    session_summaries: number;
    extracted_facts: number;
    conversation_log: number;
    code_dumps: number;
    total: number;
  } | null;
  loading: boolean;
}

const FACT_LIMIT_FREE = 500;

export default function StorageBar({ storage, loading }: StorageBarProps) {
  if (loading) {
    return (
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="h-20 animate-pulse rounded-lg bg-white/[0.03] border border-white/[0.06]" />
        <div className="h-20 animate-pulse rounded-lg bg-white/[0.03] border border-white/[0.06]" />
      </div>
    );
  }

  if (!storage) return null;

  const factPercent = Math.min(100, Math.round((storage.extracted_facts / FACT_LIMIT_FREE) * 100));
  const showUpsell = factPercent >= 80;

  return (
    <div className="mb-6 space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Total records */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Database className="h-3.5 w-3.5" />
            Total Memory Records
          </div>
          <p className="mt-1 text-2xl font-semibold text-white">{storage.total.toLocaleString()}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-white/40">
            <span>{storage.business_context} context</span>
            <span>{storage.knowledge_library} library</span>
            <span>{storage.session_summaries} sessions</span>
            <span>{storage.conversation_log} messages</span>
            <span>{storage.code_dumps} code</span>
          </div>
        </div>

        {/* Facts usage */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-xs text-white/50">
            <FileText className="h-3.5 w-3.5" />
            Extracted Facts
          </div>
          <p className="mt-1 text-2xl font-semibold text-white">
            {storage.extracted_facts.toLocaleString()}
            <span className="ml-1 text-sm text-white/30">/ {FACT_LIMIT_FREE}</span>
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full transition-all ${
                factPercent >= 90 ? "bg-red-500" : factPercent >= 80 ? "bg-amber-500" : "bg-amber-500/60"
              }`}
              style={{ width: `${factPercent}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-white/30">{factPercent}% used</p>
        </div>
      </div>

      {showUpsell && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-xs text-amber-500/90">
            You're using {storage.extracted_facts} of {FACT_LIMIT_FREE} facts. Upgrade to Pro for unlimited storage.
          </p>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-500 transition-opacity hover:opacity-80"
          >
            Upgrade to Pro
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}

import { Database, FileText } from "lucide-react";

interface StorageBarProps {
  totalFacts: number;
  maxFacts: number;
  storageLabel?: string;
}

export default function StorageBar({ totalFacts, maxFacts, storageLabel }: StorageBarProps) {
  const pct = maxFacts > 0 ? Math.min((totalFacts / maxFacts) * 100, 100) : 0;
  const isWarning = pct >= 80;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Facts usage */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-medium text-[#AAAAAA]">
              <FileText className="h-3.5 w-3.5" />
              Facts
            </span>
            <span className="font-mono text-xs text-white">
              {totalFacts.toLocaleString()} / {maxFacts.toLocaleString()}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                backgroundColor: isWarning ? "#E2B93B" : "#61C1C4",
              }}
            />
          </div>
          {isWarning && (
            <p className="mt-2 text-xs text-[#E2B93B]">
              You're using {Math.round(pct)}% of your facts limit.{" "}
              <a href="/pricing" className="underline hover:text-[#E2B93B]/80 cursor-pointer transition-colors duration-150">
                Upgrade to Pro
              </a>
            </p>
          )}
        </div>

        {/* Storage info */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-medium text-[#AAAAAA]">
              <Database className="h-3.5 w-3.5" />
              Storage
            </span>
            <span className="font-mono text-xs text-white">
              {storageLabel ?? "Local"}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-[#61C1C4] transition-all duration-500"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

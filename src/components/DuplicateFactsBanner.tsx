/**
 * DuplicateFactsBanner - light-touch detection of near-duplicate facts.
 *
 * Displayed at the top of the Memory admin page. When two facts share 60%+
 * token overlap (typical symptom of running two memory tools at once), show
 * an amber banner with a "Review duplicates" expander that lists the pairs
 * and lets the user archive one side of each pair.
 *
 * Pulls from /api/memory-admin?action=check_duplicates. Safe to mount
 * unconditionally: renders null when there are no duplicates.
 */

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";

interface DuplicateGroup {
  facts: Array<{ id: string; text: string }>;
  similarity: number;
}

export default function DuplicateFactsBanner() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [archiving, setArchiving] = useState<string>("");

  const apiKey =
    typeof window !== "undefined" ? localStorage.getItem("unclick_api_key") ?? "" : "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/memory-admin?action=check_duplicates");
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { duplicate_groups?: DuplicateGroup[] };
      setGroups(data.duplicate_groups ?? []);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const archive = async (factId: string) => {
    if (!apiKey) return;
    setArchiving(factId);
    try {
      const res = await fetch("/api/memory-admin?action=delete_fact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ fact_id: factId }),
      });
      if (res.ok) {
        setGroups((prev) =>
          prev
            .map((g) => ({ ...g, facts: g.facts.filter((f) => f.id !== factId) }))
            .filter((g) => g.facts.length >= 2),
        );
      }
    } finally {
      setArchiving("");
    }
  };

  if (loading) return null;
  if (dismissed) return null;
  if (groups.length === 0) return null;

  return (
    <div
      className="mb-6 rounded-xl border p-5"
      style={{ borderColor: "rgba(226, 185, 59, 0.4)", backgroundColor: "rgba(226, 185, 59, 0.05)" }}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#E2B93B" }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-heading">
            We found {groups.length} {groups.length === 1 ? "fact" : "facts"} that look like
            duplicates.
          </p>
          <p className="mt-1 text-xs text-body">
            This usually happens when two memory tools save the same information. Archive one side
            of each pair to clean things up.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90"
            >
              {expanded ? "Hide duplicates" : "Review duplicates"}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-card/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-heading"
            >
              Dismiss
            </button>
          </div>

          {expanded && (
            <ul className="mt-4 space-y-3">
              {groups.map((group, idx) => (
                <li
                  key={idx}
                  className="rounded-lg border border-border/40 bg-card/40 p-3 text-xs"
                >
                  <p className="mb-2 text-[10px] font-mono text-muted-foreground">
                    Match: {Math.round(group.similarity * 100)}%
                  </p>
                  <div className="space-y-2">
                    {group.facts.map((fact) => (
                      <div
                        key={fact.id}
                        className="flex items-start gap-2 rounded-md border border-border/30 bg-background/40 p-2"
                      >
                        <p className="min-w-0 flex-1 break-words text-body">{fact.text}</p>
                        <button
                          onClick={() => archive(fact.id)}
                          disabled={archiving === fact.id || !apiKey}
                          className="shrink-0 rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-card/60 hover:text-heading disabled:opacity-50"
                          title="Archive this fact"
                        >
                          {archiving === fact.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

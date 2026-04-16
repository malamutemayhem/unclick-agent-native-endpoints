import { useEffect, useState, useCallback } from "react";
import { ChevronDown, ChevronRight, BookOpen, History } from "lucide-react";
import EmptyState from "./EmptyState";

interface LibraryDoc {
  id: string;
  slug: string;
  title: string;
  category?: string;
  tags?: string[];
  version: number;
  updated_at: string;
  decay_tier?: string;
  content?: string;
}

interface HistoryEntry {
  id: string;
  slug: string;
  version: number;
  title: string;
  content: string;
  created_at: string;
}

const DECAY_COLORS: Record<string, string> = {
  hot: "bg-red-500",
  warm: "bg-amber-500",
  cold: "bg-blue-400",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function LibraryTab({ apiKey }: { apiKey: string }) {
  const [docs, setDocs] = useState<LibraryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [docContent, setDocContent] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [historySlug, setHistorySlug] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/memory-admin?action=admin_library&method=list", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const body = await res.json();
        setDocs(body.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => { load(); }, [load]);

  const viewDoc = async (doc: LibraryDoc) => {
    if (expandedId === doc.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(doc.id);
    setDocLoading(true);
    setHistorySlug(null);
    try {
      const res = await fetch(
        `/api/memory-admin?action=admin_library&method=view&id=${encodeURIComponent(doc.id)}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      if (res.ok) {
        const body = await res.json();
        setDocContent(body.data?.content ?? null);
      }
    } finally {
      setDocLoading(false);
    }
  };

  const viewHistory = async (slug: string) => {
    if (historySlug === slug) {
      setHistorySlug(null);
      return;
    }
    setHistorySlug(slug);
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/memory-admin?action=admin_library&method=history&slug=${encodeURIComponent(slug)}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      if (res.ok) {
        const body = await res.json();
        setHistory(body.data ?? []);
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  if (loading) {
    return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 animate-pulse rounded-lg bg-white/[0.03] border border-white/[0.06]" />)}</div>;
  }

  if (docs.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        heading="Your knowledge library is empty"
        description="Documents and templates stored by your agent appear here. The knowledge library holds versioned reference docs."
        steps={[
          "Ask your agent to save a document to the library",
          "It will be versioned - see how it changes over time",
          "Only titles load at startup; full docs fetched on demand",
        ]}
      />
    );
  }

  return (
    <div className="space-y-3">
      {docs.map((doc) => {
        const isExpanded = expandedId === doc.id;
        const showingHistory = historySlug === doc.slug;

        return (
          <div key={doc.id} className="rounded-lg border border-white/[0.06] bg-white/[0.03] overflow-hidden">
            <button
              onClick={() => viewDoc(doc)}
              className="flex w-full items-start gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors"
            >
              {isExpanded
                ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
                : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
              }
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-white">{doc.title}</span>
                  {doc.decay_tier && (
                    <span className="flex items-center gap-1 text-[10px] text-white/30">
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${DECAY_COLORS[doc.decay_tier] ?? "bg-gray-500"}`} />
                      {doc.decay_tier}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-white/30">
                  <code className="font-mono text-white/40">{doc.slug}</code>
                  <span>v{doc.version}</span>
                  <span>updated {formatDate(doc.updated_at)}</span>
                </div>
                {(doc.tags ?? []).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {doc.tags!.map((t) => (
                      <span key={t} className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/40">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-white/[0.06] p-4 space-y-3">
                {docLoading ? (
                  <p className="text-xs text-white/30">Loading document...</p>
                ) : docContent ? (
                  <pre className="max-h-96 overflow-auto rounded-lg bg-white/[0.02] p-4 text-xs text-white/60 whitespace-pre-wrap font-mono">
                    {docContent}
                  </pre>
                ) : (
                  <p className="text-xs text-white/30">No content available.</p>
                )}

                <button
                  onClick={() => viewHistory(doc.slug)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] px-3 py-1.5 text-xs text-white/50 hover:bg-white/[0.04] hover:text-white transition-colors"
                >
                  <History className="h-3 w-3" />
                  {showingHistory ? "Hide History" : "Version History"}
                </button>

                {showingHistory && (
                  <div className="space-y-2">
                    {historyLoading ? (
                      <p className="text-xs text-white/30">Loading history...</p>
                    ) : history.length === 0 ? (
                      <p className="text-xs text-white/30">No version history found.</p>
                    ) : (
                      history.map((h) => (
                        <div key={h.id} className="rounded border border-white/[0.04] bg-white/[0.01] p-3">
                          <div className="flex items-center gap-2 text-[10px] text-white/30">
                            <span className="font-semibold text-white/50">v{h.version}</span>
                            <span>{formatDate(h.created_at)}</span>
                          </div>
                          <p className="mt-1 text-xs text-white/40 line-clamp-3">{h.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

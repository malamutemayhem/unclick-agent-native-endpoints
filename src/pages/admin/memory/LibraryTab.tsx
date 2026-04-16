import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, BookOpen, History } from "lucide-react";
import EmptyState from "./EmptyState";

interface LibraryDoc {
  id: string;
  slug: string;
  title: string;
  category?: string;
  tags?: string[];
  version: number;
  decay_tier?: string;
  updated_at: string;
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

interface LibraryTabProps {
  apiKey: string;
}

const DECAY_COLORS: Record<string, { dot: string; text: string; label: string }> = {
  hot: { dot: "bg-red-500", text: "text-red-400", label: "Hot" },
  warm: { dot: "bg-[#E2B93B]", text: "text-[#E2B93B]", label: "Warm" },
  cold: { dot: "bg-blue-400", text: "text-blue-400", label: "Cold" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function LibraryTab({ apiKey }: LibraryTabProps) {
  const [docs, setDocs] = useState<LibraryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fullDoc, setFullDoc] = useState<LibraryDoc | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    (async () => {
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
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDoc = async (doc: LibraryDoc) => {
    if (expandedId === doc.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(doc.id);
    setDetailLoading(true);
    setShowHistory(false);
    try {
      const res = await fetch(`/api/memory-admin?action=admin_library&method=view&id=${doc.id}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const body = await res.json();
        setFullDoc(body.data);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const loadHistory = async (slug: string) => {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    setShowHistory(true);
    try {
      const res = await fetch(
        `/api/memory-admin?action=admin_library&method=history&slug=${encodeURIComponent(slug)}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      if (res.ok) {
        const body = await res.json();
        setHistory(body.data ?? []);
      }
    } catch {
      // ignore
    }
  };

  if (loading) {
    return <p className="py-8 text-center text-sm text-[#666666]">Loading library...</p>;
  }

  if (docs.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen className="h-6 w-6" />}
        heading="Your knowledge library is empty"
        description="Documents and templates stored by your agent appear here. Use upsert_library_doc to add reference docs."
      />
    );
  }

  return (
    <div className="space-y-3">
      {docs.map((doc) => {
        const isExpanded = expandedId === doc.id;
        const decay = DECAY_COLORS[doc.decay_tier ?? "cold"] ?? DECAY_COLORS.cold;

        return (
          <div
            key={doc.id}
            className="rounded-lg border border-white/[0.06] bg-white/[0.03] transition-colors duration-150 hover:border-white/[0.1]"
          >
            {/* Header */}
            <button
              onClick={() => loadDoc(doc)}
              className="flex w-full cursor-pointer items-start gap-3 p-4 text-left"
            >
              <span className="mt-0.5 text-[#666666]">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-white">{doc.title}</span>
                  <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-[#AAAAAA]">
                    {doc.slug}
                  </code>
                  <span className="font-mono text-[10px] text-[#666666]">v{doc.version}</span>
                  <span className={`flex items-center gap-1 text-[10px] ${decay.text}`}>
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${decay.dot}`} />
                    {decay.label}
                  </span>
                </div>
                <span className="text-xs text-[#666666]">Updated {formatDate(doc.updated_at)}</span>
              </div>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-white/[0.06] px-4 pb-4 pt-3 space-y-3">
                {detailLoading ? (
                  <p className="text-xs text-[#666666]">Loading...</p>
                ) : fullDoc ? (
                  <>
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {doc.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-md bg-[#61C1C4]/10 px-2 py-0.5 text-[10px] text-[#61C1C4]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 font-mono text-xs text-[#AAAAAA]">
                      {fullDoc.content}
                    </pre>
                  </>
                ) : null}

                {/* History toggle */}
                <button
                  onClick={() => loadHistory(doc.slug)}
                  className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-white/[0.1] px-3 py-1.5 text-xs text-[#AAAAAA] transition-colors duration-150 hover:text-white"
                >
                  <History className="h-3 w-3" />
                  {showHistory ? "Hide History" : "Version History"}
                </button>

                {showHistory && (
                  <div className="space-y-2">
                    {history.length === 0 ? (
                      <p className="text-xs text-[#666666]">No previous versions.</p>
                    ) : (
                      history.map((h) => (
                        <div
                          key={h.id}
                          className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3"
                        >
                          <div className="mb-1 flex items-center gap-2 text-[10px]">
                            <span className="font-mono text-[#AAAAAA]">v{h.version}</span>
                            <span className="text-[#666666]">{formatDate(h.created_at)}</span>
                          </div>
                          <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono text-xs text-[#666666]">
                            {h.content}
                          </pre>
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

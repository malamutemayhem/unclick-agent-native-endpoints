import { useEffect, useState, useCallback } from "react";
import { ChevronDown, ChevronRight, MessageSquare, Clock } from "lucide-react";
import EmptyState from "./EmptyState";

interface Session {
  id: string;
  session_id: string;
  summary: string;
  topics: string[] | null;
  decisions: unknown[] | null;
  open_loops: unknown[] | null;
  platform: string | null;
  duration_minutes: number | null;
  created_at: string;
}

interface TranscriptMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

const ROLE_COLORS: Record<string, string> = {
  user: "bg-blue-500/20 text-blue-400",
  assistant: "bg-amber-500/20 text-amber-400",
  system: "bg-white/10 text-white/50",
  tool: "bg-green-500/20 text-green-400",
};

/** Safely render a JSONB array item that might be an object */
function displayItem(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function SessionsTab({ apiKey }: { apiKey: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [transcriptId, setTranscriptId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/memory-admin?action=admin_sessions&method=list", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const body = await res.json();
        setSessions(body.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => { load(); }, [load]);

  const loadTranscript = async (sessionId: string) => {
    if (transcriptId === sessionId) {
      setTranscriptId(null);
      return;
    }
    setTranscriptId(sessionId);
    setTranscriptLoading(true);
    try {
      const res = await fetch(
        `/api/memory-admin?action=admin_sessions&method=transcript&session_id=${encodeURIComponent(sessionId)}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      if (res.ok) {
        const body = await res.json();
        setTranscript(body.data ?? []);
      }
    } finally {
      setTranscriptLoading(false);
    }
  };

  if (loading) {
    return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 animate-pulse rounded-lg bg-white/[0.03] border border-white/[0.06]" />)}</div>;
  }

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        heading="No sessions recorded"
        description="Session summaries appear automatically after conversations. Your agent writes these when a session ends."
        steps={[
          "Have a conversation through any connected platform",
          "Your agent writes a summary at the end",
          "Next session starts by reading the last 5 summaries",
        ]}
      />
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((s) => {
        const isExpanded = expandedId === s.id;
        const showingTranscript = transcriptId === s.session_id;

        return (
          <div key={s.id} className="rounded-lg border border-white/[0.06] bg-white/[0.03] overflow-hidden">
            {/* Header - always visible */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : s.id)}
              className="flex w-full items-start gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors"
            >
              {isExpanded
                ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
                : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
              }
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <Clock className="h-3 w-3" />
                  {formatDate(s.created_at)}
                  {s.duration_minutes && <span>- {s.duration_minutes}min</span>}
                  {s.platform && <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px]">{s.platform}</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(s.topics ?? []).map((t) => (
                    <span key={t} className="rounded bg-[#61C1C4]/10 px-1.5 py-0.5 text-[10px] text-[#61C1C4]/80">{t}</span>
                  ))}
                </div>
                <p className="mt-1 text-sm text-white/60 line-clamp-2">{s.summary}</p>
              </div>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-white/[0.06] p-4 space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Summary</h4>
                  <p className="text-sm text-white/70 whitespace-pre-wrap">{s.summary}</p>
                </div>

                {(s.decisions ?? []).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Decisions</h4>
                    <ul className="space-y-1">
                      {s.decisions!.map((d, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-white/60">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#61C1C4]/50" />
                          {displayItem(d)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(s.open_loops ?? []).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Open Loops</h4>
                    <ul className="space-y-1">
                      {s.open_loops!.map((l, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-white/60">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400/50" />
                          {displayItem(l)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={() => loadTranscript(s.session_id)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] px-3 py-1.5 text-xs text-white/50 hover:bg-white/[0.04] hover:text-white transition-colors"
                >
                  <MessageSquare className="h-3 w-3" />
                  {showingTranscript ? "Hide Transcript" : "View Transcript"}
                </button>

                {showingTranscript && (
                  <div className="mt-3 space-y-2 rounded-lg border border-white/[0.04] bg-white/[0.01] p-3">
                    {transcriptLoading ? (
                      <p className="text-xs text-white/30">Loading transcript...</p>
                    ) : transcript.length === 0 ? (
                      <p className="text-xs text-white/30">No transcript messages found for this session.</p>
                    ) : (
                      transcript.map((msg) => (
                        <div key={msg.id} className="flex items-start gap-2">
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${ROLE_COLORS[msg.role] ?? "bg-white/10 text-white/40"}`}>
                            {msg.role}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-white/60 whitespace-pre-wrap break-words">{msg.content}</p>
                            <span className="text-[10px] text-white/20">{formatShortDate(msg.created_at)}</span>
                          </div>
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

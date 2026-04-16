import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, MessageSquare, Clock } from "lucide-react";
import EmptyState from "./EmptyState";

interface Session {
  id: string;
  session_id: string;
  summary: string;
  topics: string[];
  decisions: string[];
  open_loops: string[];
  platform: string;
  duration_minutes: number | null;
  created_at: string;
}

interface TranscriptMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

interface SessionsTabProps {
  apiKey: string;
}

const ROLE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  user: { bg: "bg-blue-500/10", text: "text-blue-400", label: "User" },
  assistant: { bg: "bg-[#61C1C4]/10", text: "text-[#61C1C4]", label: "Assistant" },
  system: { bg: "bg-white/[0.06]", text: "text-[#AAAAAA]", label: "System" },
  tool: { bg: "bg-green-500/10", text: "text-green-400", label: "Tool" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SessionsTab({ apiKey }: SessionsTabProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [showTranscriptFor, setShowTranscriptFor] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
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
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTranscript = async (sessionId: string) => {
    if (showTranscriptFor === sessionId) {
      setShowTranscriptFor(null);
      return;
    }
    setTranscriptLoading(true);
    setShowTranscriptFor(sessionId);
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
    return <p className="py-8 text-center text-sm text-[#666666]">Loading sessions...</p>;
  }

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquare className="h-6 w-6" />}
        heading="No sessions recorded yet"
        description="Session summaries appear automatically after conversations. Your agent writes these before ending each session."
      />
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => {
        const isExpanded = expandedId === session.id;
        const isTranscriptOpen = showTranscriptFor === session.session_id;

        return (
          <div
            key={session.id}
            className="rounded-lg border border-white/[0.06] bg-white/[0.03] transition-colors duration-150 hover:border-white/[0.1]"
          >
            {/* Header */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : session.id)}
              className="flex w-full cursor-pointer items-start gap-3 p-4 text-left"
            >
              <span className="mt-0.5 text-[#666666]">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-[#AAAAAA]">{formatDate(session.created_at)}</span>
                  {session.topics?.map((t) => (
                    <span
                      key={t}
                      className="rounded-md bg-[#61C1C4]/10 px-2 py-0.5 text-[10px] font-medium text-[#61C1C4]"
                    >
                      {t}
                    </span>
                  ))}
                  {session.duration_minutes != null && (
                    <span className="flex items-center gap-1 text-[10px] text-[#666666]">
                      <Clock className="h-3 w-3" />
                      {session.duration_minutes}m
                    </span>
                  )}
                </div>
                <p className="text-sm text-white line-clamp-2">{session.summary}</p>
              </div>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-white/[0.06] px-4 pb-4 pt-3 space-y-3">
                <p className="text-sm text-[#AAAAAA]">{session.summary}</p>

                {session.decisions?.length > 0 && (
                  <div>
                    <h4 className="mb-1 text-xs font-semibold text-white">Decisions</h4>
                    <ul className="list-inside list-disc space-y-0.5 text-sm text-[#AAAAAA]">
                      {session.decisions.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {session.open_loops?.length > 0 && (
                  <div>
                    <h4 className="mb-1 text-xs font-semibold text-white">Open Loops</h4>
                    <ul className="list-inside list-disc space-y-0.5 text-sm text-[#AAAAAA]">
                      {session.open_loops.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Transcript toggle */}
                <button
                  onClick={() => loadTranscript(session.session_id)}
                  className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-white/[0.1] px-3 py-1.5 text-xs text-[#AAAAAA] transition-colors duration-150 hover:text-white"
                >
                  <MessageSquare className="h-3 w-3" />
                  {isTranscriptOpen ? "Hide Transcript" : "View Transcript"}
                </button>

                {/* Transcript messages */}
                {isTranscriptOpen && (
                  <div className="mt-2 space-y-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    {transcriptLoading ? (
                      <p className="text-xs text-[#666666]">Loading transcript...</p>
                    ) : transcript.length === 0 ? (
                      <p className="text-xs text-[#666666]">No transcript available for this session.</p>
                    ) : (
                      transcript.map((msg) => {
                        const style = ROLE_STYLES[msg.role] ?? ROLE_STYLES.system;
                        return (
                          <div key={msg.id} className="flex gap-2">
                            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${style.bg} ${style.text}`}>
                              {style.label}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="whitespace-pre-wrap text-xs text-[#AAAAAA]">{msg.content}</p>
                              <span className="text-[10px] text-[#666666]">
                                {new Date(msg.created_at).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                        );
                      })
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

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

interface Draft {
  id: string;
  recipient_agent_id: string;
  sender_agent_id: string;
  sender_emoji: string | null;
  text: string;
  priority: "normal" | "important" | "urgent";
  tags: string[] | null;
  created_at: string;
  expires_at: string | null;
}

interface ProfileLite {
  agent_id: string;
  emoji: string;
  display_name: string | null;
}

interface DraftsProps {
  authHeader: Record<string, string>;
  humanAgentId: string | null;
  profiles: ProfileLite[];
}

const STORAGE_KEY = "unclick.fishbowl.drafts.collapsed";

const PRIORITY_STYLE: Record<Draft["priority"], string> = {
  normal: "bg-[#333]/40 text-[#aaa]",
  important: "bg-[#E2B93B]/15 text-[#E2B93B]",
  urgent: "bg-red-500/20 text-red-300",
};

function priorityPill(p: Draft["priority"]) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_STYLE[p]}`}
    >
      {p}
    </span>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(1, Math.floor((now - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}

function DraftRow({
  draft,
  senderProfile,
  onAck,
  busy,
}: {
  draft: Draft;
  senderProfile: ProfileLite | undefined;
  onAck: (status: "accepted" | "received" | "declined") => void;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const truncated = draft.text.length > 200;
  const display = expanded || !truncated ? draft.text : `${draft.text.slice(0, 200)}...`;
  const senderEmoji = draft.sender_emoji ?? senderProfile?.emoji ?? "🤖";
  const senderName = senderProfile?.display_name ?? draft.sender_agent_id;

  return (
    <div
      id={`draft-${draft.id}`}
      className="rounded-lg border border-white/[0.06] bg-black/30 p-3"
    >
      <div className="flex flex-wrap items-baseline gap-2 text-xs">
        <span className="text-base leading-none">{senderEmoji}</span>
        <span className="font-medium text-[#ccc]">{senderName}</span>
        {priorityPill(draft.priority)}
        <span className="ml-auto text-[#666]">{relativeTime(draft.created_at)}</span>
      </div>
      <p
        className={`mt-2 whitespace-pre-wrap text-sm text-[#ccc] ${truncated && !expanded ? "cursor-pointer" : ""}`}
        onClick={() => {
          if (truncated) setExpanded((v) => !v);
        }}
        title={truncated ? (expanded ? "Click to collapse" : "Click to expand") : undefined}
      >
        {display}
        {truncated && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="ml-1 text-[10px] font-medium uppercase tracking-wide text-[#E2B93B] hover:underline"
          >
            {expanded ? "less" : "more"}
          </button>
        )}
      </p>
      {draft.tags && draft.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {draft.tags.map((t) => (
            <span
              key={t}
              className="rounded-md bg-[#E2B93B]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#E2B93B]"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onAck("accepted")}
          disabled={busy}
          title="Accept"
          className="inline-flex items-center gap-1 rounded-md border border-green-400/40 bg-green-400/10 px-2 py-1 text-xs font-medium text-green-300 hover:bg-green-400/20 disabled:opacity-40"
        >
          ✅ Accept
        </button>
        <button
          type="button"
          onClick={() => onAck("received")}
          disabled={busy}
          title="Mark as received"
          className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] px-2 py-1 text-xs text-[#888] hover:bg-white/[0.05] disabled:opacity-40"
        >
          👁️ Received
        </button>
        <button
          type="button"
          onClick={() => onAck("declined")}
          disabled={busy}
          title="Decline"
          className="inline-flex items-center gap-1 rounded-md border border-red-400/30 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-40"
        >
          ❌ Decline
        </button>
        {busy && <Loader2 className="h-3 w-3 animate-spin text-[#888]" />}
      </div>
    </div>
  );
}

export default function FishbowlDrafts({ authHeader, humanAgentId, profiles }: DraftsProps) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(STORAGE_KEY) !== "0";
  });
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyDraftId, setBusyDraftId] = useState<string | null>(null);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // localStorage may be unavailable; ignore.
      }
      return next;
    });
  };

  const profileByAgentId = useMemo(() => {
    const m = new Map<string, ProfileLite>();
    for (const p of profiles) m.set(p.agent_id, p);
    return m;
  }, [profiles]);

  const fetchDrafts = useCallback(async () => {
    if (!humanAgentId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/memory-admin?action=fishbowl_list_drafts", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: humanAgentId }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        drafts?: Draft[];
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "Failed to load drafts");
      setDrafts(body.drafts ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
      setFirstLoadDone(true);
    }
  }, [authHeader, humanAgentId]);

  useEffect(() => {
    if (collapsed) return;
    void fetchDrafts();
  }, [collapsed, fetchDrafts]);

  useEffect(() => {
    if (collapsed) return;
    const id = setInterval(() => {
      void fetchDrafts();
    }, 10_000);
    return () => clearInterval(id);
  }, [collapsed, fetchDrafts]);

  const ack = useCallback(
    async (draftId: string, status: "accepted" | "received" | "declined") => {
      if (!humanAgentId) return;
      setBusyDraftId(draftId);
      try {
        const res = await fetch("/api/memory-admin?action=fishbowl_acknowledge_draft", {
          method: "POST",
          headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ agent_id: humanAgentId, draft_id: draftId, status }),
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Failed to acknowledge");
        // Optimistic remove; refetch confirms.
        setDrafts((prev) => prev.filter((d) => d.id !== draftId));
        void fetchDrafts();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to acknowledge");
      } finally {
        setBusyDraftId(null);
      }
    },
    [authHeader, humanAgentId, fetchDrafts],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Draft[]>();
    for (const d of drafts) {
      const arr = map.get(d.recipient_agent_id) ?? [];
      arr.push(d);
      map.set(d.recipient_agent_id, arr);
    }
    return Array.from(map.entries()).sort((a, b) => {
      const aName = profileByAgentId.get(a[0])?.display_name ?? a[0];
      const bName = profileByAgentId.get(b[0])?.display_name ?? b[0];
      return aName.localeCompare(bName);
    });
  }, [drafts, profileByAgentId]);

  const totalUnread = drafts.length;

  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <button
        type="button"
        onClick={toggleCollapsed}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        aria-expanded={!collapsed}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-[#ccc]">
          <span aria-hidden>📬</span>
          <span>Drafts</span>
          {totalUnread > 0 && (
            <span className="rounded-full bg-[#E2B93B]/15 px-2 py-0.5 text-[10px] font-medium text-[#E2B93B]">
              {totalUnread} unread
            </span>
          )}
        </span>
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-[#888]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[#888]" />
        )}
      </button>

      {!collapsed && (
        <div className="space-y-4 border-t border-white/[0.06] px-4 py-4">
          {loading && drafts.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-[#888]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading drafts...
            </div>
          )}

          {error && (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          {firstLoadDone && !error && drafts.length === 0 && (
            <div className="rounded-lg border border-white/[0.06] bg-black/20 px-4 py-6 text-center">
              <p className="text-sm text-[#ccc]">📬 No drafts queued.</p>
              <p className="mt-1 text-xs text-[#888]">
                When an agent leaves a draft for another agent while they are
                asleep, it lands here.
              </p>
            </div>
          )}

          {grouped.map(([recipientId, recipientDrafts]) => {
            const recipientProfile = profileByAgentId.get(recipientId);
            const recipientName = recipientProfile?.display_name ?? recipientId;
            const recipientEmoji = recipientProfile?.emoji ?? "👤";
            return (
              <div key={recipientId} className="space-y-2">
                <div className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-[#888]">
                  <span className="text-base leading-none" aria-hidden>
                    {recipientEmoji}
                  </span>
                  <span className="text-[#ccc] normal-case">{recipientName}</span>
                  <span className="text-[#666] normal-case">
                    ({recipientDrafts.length} unread)
                  </span>
                </div>
                <div className="space-y-2">
                  {recipientDrafts.map((d) => (
                    <DraftRow
                      key={d.id}
                      draft={d}
                      senderProfile={profileByAgentId.get(d.sender_agent_id)}
                      onAck={(status) => void ack(d.id, status)}
                      busy={busyDraftId === d.id}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

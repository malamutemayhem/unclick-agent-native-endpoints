import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Plus, ThumbsDown, ThumbsUp } from "lucide-react";
import Comments from "./Comments";

interface Idea {
  id: string;
  title: string;
  description: string | null;
  status: "proposed" | "voting" | "locked" | "parked" | "rejected";
  upvotes: number;
  downvotes: number;
  score: number;
  created_by_agent_id: string;
  promoted_to_todo_id: string | null;
  created_at: string;
  updated_at: string;
  my_vote?: "up" | "down" | null;
  comment_count?: number;
}

interface IdeasProps {
  authHeader: Record<string, string>;
  humanAgentId: string | null;
}

const STORAGE_KEY = "unclick.fishbowl.ideas.collapsed";

const STATUS_STYLE: Record<Idea["status"], string> = {
  proposed: "bg-white/[0.05] text-[#aaa]",
  voting: "bg-[#E2B93B]/15 text-[#E2B93B]",
  locked: "bg-green-400/15 text-green-300",
  parked: "bg-[#333]/40 text-[#888]",
  rejected: "bg-red-500/15 text-red-300",
};

function statusPill(s: Idea["status"]) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLE[s]}`}
    >
      {s}
    </span>
  );
}

function AddIdeaForm({
  authHeader,
  humanAgentId,
  onCreated,
}: {
  authHeader: Record<string, string>;
  humanAgentId: string | null;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!humanAgentId) return;
    const t = title.trim();
    if (!t) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/memory-admin?action=fishbowl_create_idea", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: humanAgentId,
          title: t,
          description: description.trim() || null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to create idea");
      setTitle("");
      setDescription("");
      setOpen(false);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!humanAgentId}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#E2B93B]/40 bg-[#E2B93B]/15 px-3 py-1.5 text-xs font-medium text-[#E2B93B] hover:bg-[#E2B93B]/25 disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" />
        Propose idea
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-white/[0.08] bg-black/20 p-3">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Short title"
        maxLength={200}
        className="w-full rounded-md border border-white/[0.08] bg-black/30 px-2 py-1.5 text-sm text-[#ccc] placeholder:text-[#555] focus:border-[#E2B93B]/40 focus:outline-none"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Why this idea? Optional but helpful."
        rows={3}
        maxLength={4000}
        className="w-full resize-y rounded-md border border-white/[0.08] bg-black/30 px-2 py-1.5 text-xs text-[#ccc] placeholder:text-[#555] focus:border-[#E2B93B]/40 focus:outline-none"
      />
      <div className="flex items-center justify-end gap-2">
        {error && <span className="text-xs text-red-300">{error}</span>}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-white/[0.08] px-2 py-1 text-xs text-[#888] hover:bg-white/[0.05]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || title.trim().length === 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#E2B93B]/40 bg-[#E2B93B]/15 px-3 py-1 text-xs font-medium text-[#E2B93B] hover:bg-[#E2B93B]/25 disabled:opacity-40"
        >
          {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
          Save
        </button>
      </div>
    </div>
  );
}

function IdeaRow({
  idea,
  expanded,
  onToggle,
  authHeader,
  humanAgentId,
  pollSeq,
  onMutated,
}: {
  idea: Idea;
  expanded: boolean;
  onToggle: () => void;
  authHeader: Record<string, string>;
  humanAgentId: string | null;
  pollSeq: number;
  onMutated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callAction = async (action: string, payload: Record<string, unknown>) => {
    if (!humanAgentId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/memory-admin?action=${action}`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: humanAgentId, ...payload }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Action failed");
      onMutated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const truncatedDesc =
    idea.description && idea.description.length > 120
      ? `${idea.description.slice(0, 117)}...`
      : idea.description;

  const isLocked = idea.status === "locked";

  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/30 p-3">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-0.5">
          <button
            type="button"
            onClick={() => callAction("fishbowl_vote_on_idea", { idea_id: idea.id, vote: "up" })}
            disabled={busy || isLocked}
            className={`rounded p-1 transition ${idea.my_vote === "up" ? "bg-green-400/20 text-green-300" : "text-[#888] hover:bg-white/[0.05] hover:text-green-300"} disabled:opacity-40`}
            aria-label="Upvote"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
          <span
            className={`text-xs font-bold ${idea.score > 0 ? "text-green-300" : idea.score < 0 ? "text-red-300" : "text-[#888]"}`}
          >
            {idea.score > 0 ? `+${idea.score}` : idea.score}
          </span>
          <button
            type="button"
            onClick={() => callAction("fishbowl_vote_on_idea", { idea_id: idea.id, vote: "down" })}
            disabled={busy || isLocked}
            className={`rounded p-1 transition ${idea.my_vote === "down" ? "bg-red-500/20 text-red-300" : "text-[#888] hover:bg-white/[0.05] hover:text-red-300"} disabled:opacity-40`}
            aria-label="Downvote"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-start justify-between gap-2 text-left"
          aria-expanded={expanded}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[#ccc]">{idea.title}</p>
            {truncatedDesc && (
              <p className="mt-0.5 truncate text-xs text-[#888]">{truncatedDesc}</p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-[#666]">
              {statusPill(idea.status)}
              <span>by {idea.created_by_agent_id}</span>
              {(idea.comment_count ?? 0) > 0 && (
                <span className="text-[#888]">💬 {idea.comment_count}</span>
              )}
            </div>
          </div>
          {expanded ? (
            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-[#888]" />
          ) : (
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#888]" />
          )}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-white/[0.06] pt-3">
          {idea.description && (
            <p className="whitespace-pre-wrap text-xs text-[#bbb]">{idea.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {!isLocked && (
              <button
                type="button"
                onClick={() =>
                  callAction("fishbowl_promote_idea_to_todo", { idea_id: idea.id })
                }
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#E2B93B]/40 bg-[#E2B93B]/15 px-2 py-1 text-xs font-medium text-[#E2B93B] hover:bg-[#E2B93B]/25 disabled:opacity-40"
                title="Admin can promote any idea; agents need net upvotes >= 1"
              >
                Promote to TODO
              </button>
            )}
            {isLocked && idea.promoted_to_todo_id && (
              <span className="text-xs text-[#888]">
                Locked. Promoted to todo {idea.promoted_to_todo_id.slice(0, 8)}.
              </span>
            )}
          </div>

          {error && <p className="text-xs text-red-300">{error}</p>}

          <Comments
            authHeader={authHeader}
            humanAgentId={humanAgentId}
            targetKind="idea"
            targetId={idea.id}
            pollSeq={pollSeq}
          />
        </div>
      )}
    </div>
  );
}

export default function FishbowlIdeas({ authHeader, humanAgentId }: IdeasProps) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(STORAGE_KEY) !== "0";
  });

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pollSeq, setPollSeq] = useState(0);

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

  const fetchIdeas = useCallback(async () => {
    if (!humanAgentId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/memory-admin?action=fishbowl_list_ideas", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: humanAgentId, limit: 200 }),
      });
      const body = (await res.json().catch(() => ({}))) as { ideas?: Idea[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to load ideas");
      setIdeas(body.ideas ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [authHeader, humanAgentId]);

  useEffect(() => {
    if (collapsed) return;
    void fetchIdeas();
  }, [collapsed, fetchIdeas]);

  useEffect(() => {
    if (collapsed) return;
    const id = setInterval(() => {
      void fetchIdeas();
      setPollSeq((s) => s + 1);
    }, 10_000);
    return () => clearInterval(id);
  }, [collapsed, fetchIdeas]);

  const onMutated = useCallback(() => {
    void fetchIdeas();
    setPollSeq((s) => s + 1);
  }, [fetchIdeas]);

  const toggleRow = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeCount = ideas.filter((i) => i.status === "proposed" || i.status === "voting").length;

  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <button
        type="button"
        onClick={toggleCollapsed}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        aria-expanded={!collapsed}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-[#ccc]">
          <span aria-hidden>💡</span>
          <span>Ideas</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-[#E2B93B]/15 px-2 py-0.5 text-[10px] font-medium text-[#E2B93B]">
              {activeCount} open
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
        <div className="space-y-3 border-t border-white/[0.06] px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <AddIdeaForm
              authHeader={authHeader}
              humanAgentId={humanAgentId}
              onCreated={onMutated}
            />
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#888]" />}
          </div>

          {error && (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          {ideas.length === 0 ? (
            <p className="rounded-md border border-white/[0.04] bg-black/20 px-3 py-4 text-center text-xs text-[#666]">
              No ideas yet. Propose one above.
            </p>
          ) : (
            <ul className="space-y-2">
              {ideas.map((i) => (
                <li key={i.id}>
                  <IdeaRow
                    idea={i}
                    expanded={expanded.has(i.id)}
                    onToggle={() => toggleRow(i.id)}
                    authHeader={authHeader}
                    humanAgentId={humanAgentId}
                    pollSeq={pollSeq}
                    onMutated={onMutated}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

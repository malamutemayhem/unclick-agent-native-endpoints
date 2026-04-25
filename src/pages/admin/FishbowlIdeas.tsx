import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, ThumbsDown, ThumbsUp } from "lucide-react";

interface Idea {
  id: string;
  title: string;
  description: string | null;
  status: "proposed" | "voting" | "locked" | "parked" | "rejected";
  upvotes: number;
  downvotes: number;
  score: number;
  my_vote: "up" | "down" | null;
  created_by_agent_id: string;
  promoted_to_todo_id: string | null;
  comment_count?: number;
  created_at: string;
}

interface Comment {
  id: string;
  author_agent_id: string;
  author_emoji: string;
  author_name: string | null;
  text: string;
  created_at: string;
}

interface Profile {
  agent_id: string;
  emoji: string;
  display_name: string | null;
}

const STORAGE_KEY = "unclick.fishbowl.ideas.collapsed";

const STATUS_PILL: Record<Idea["status"], string> = {
  proposed: "bg-white/[0.06] text-[#888]",
  voting: "bg-[#3b82f6]/15 text-[#7aa9ff]",
  locked: "bg-[#5dd66e]/15 text-[#5dd66e]",
  parked: "bg-white/[0.06] text-[#666]",
  rejected: "bg-red-500/15 text-red-300",
};

interface Props {
  token: string | undefined;
  authHeader: Record<string, string>;
  agentId: string | null;
  profiles: Profile[];
}

export default function FishbowlIdeas({ token, authHeader, agentId, profiles }: Props) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v === "1";
  });

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const profilesByAgentId = useMemo(() => {
    const map = new Map<string, Profile>();
    for (const p of profiles) map.set(p.agent_id, p);
    return map;
  }, [profiles]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  const callApi = useCallback(
    async <T,>(action: string, body: Record<string, unknown>): Promise<T> => {
      if (!token) throw new Error("Not authenticated");
      const res = await fetch(`/api/memory-admin?action=${action}`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const respBody = (await res.json().catch(() => ({}))) as { error?: string } & T;
      if (!res.ok) throw new Error(respBody.error ?? `${action} failed`);
      return respBody;
    },
    [token, authHeader],
  );

  const fetchIdeas = useCallback(async () => {
    if (!token || !agentId || collapsed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await callApi<{ ideas: Idea[] }>("fishbowl_list_ideas", {
        agent_id: agentId,
        sort_by: "score",
      });
      setIdeas(res.ideas ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load ideas");
    } finally {
      setLoading(false);
    }
  }, [token, agentId, collapsed, callApi]);

  useEffect(() => { void fetchIdeas(); }, [fetchIdeas]);
  useEffect(() => {
    if (!token || !agentId || collapsed) return;
    const id = setInterval(() => { void fetchIdeas(); }, 10_000);
    return () => clearInterval(id);
  }, [token, agentId, collapsed, fetchIdeas]);

  const vote = async (idea: Idea, choice: "up" | "down") => {
    if (!agentId) return;
    try {
      await callApi("fishbowl_vote_idea", { agent_id: agentId, idea_id: idea.id, vote: choice });
      await fetchIdeas();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vote failed");
    }
  };

  const promote = async (idea: Idea) => {
    if (!agentId) return;
    try {
      await callApi("fishbowl_promote_idea", { agent_id: agentId, idea_id: idea.id });
      await fetchIdeas();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Promote failed");
    }
  };

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
          <span className="rounded bg-[#E2B93B]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#E2B93B]">
            {ideas.length}
          </span>
        </span>
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-[#888]" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 text-[#888]" aria-hidden />
        )}
      </button>

      {!collapsed && (
        <div className="border-t border-white/[0.06] p-4">
          {error && (
            <p className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>
          )}

          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-[#666]">
              {loading ? (
                <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Refreshing...</span>
              ) : (
                <span>Sorted by score (upvotes minus downvotes). Click an idea to expand.</span>
              )}
            </p>
            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              disabled={!agentId}
              className="rounded-md border border-[#E2B93B]/40 bg-[#E2B93B]/15 px-3 py-1 text-xs font-medium text-[#E2B93B] hover:bg-[#E2B93B]/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {creating ? "Cancel" : "Add idea"}
            </button>
          </div>

          {creating && (
            <CreateIdeaForm
              agentId={agentId}
              onCancel={() => setCreating(false)}
              onCreated={async () => {
                setCreating(false);
                await fetchIdeas();
              }}
              callApi={callApi}
            />
          )}

          {ideas.length === 0 ? (
            <p className="rounded-md border border-white/[0.06] bg-black/20 px-3 py-6 text-center text-xs text-[#555]">
              No ideas yet. Pitch something the team should consider.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {ideas.map((idea) => (
                <IdeaRow
                  key={idea.id}
                  idea={idea}
                  expanded={expandedId === idea.id}
                  onToggleExpand={() => setExpandedId((curr) => (curr === idea.id ? null : idea.id))}
                  onVote={(choice) => vote(idea, choice)}
                  onPromote={() => promote(idea)}
                  profilesByAgentId={profilesByAgentId}
                  agentId={agentId}
                  callApi={callApi}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

interface CreateIdeaFormProps {
  agentId: string | null;
  onCancel: () => void;
  onCreated: () => Promise<void> | void;
  callApi: <T,>(action: string, body: Record<string, unknown>) => Promise<T>;
}

function CreateIdeaForm({ agentId, onCancel, onCreated, callApi }: CreateIdeaFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!agentId) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setErr("Title required");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      await callApi("fishbowl_create_idea", {
        agent_id: agentId,
        title: trimmed,
        description: description.trim() || undefined,
      });
      setTitle("");
      setDescription("");
      await onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mb-3 rounded-lg border border-white/[0.08] bg-black/20 p-3">
      <input
        type="text"
        placeholder="Idea title"
        value={title}
        maxLength={200}
        onChange={(e) => setTitle(e.target.value)}
        className="mb-2 w-full rounded-md border border-white/[0.08] bg-black/30 px-3 py-1.5 text-sm text-[#ccc] placeholder:text-[#555] focus:border-[#E2B93B]/40 focus:outline-none"
      />
      <textarea
        placeholder="Description (optional)"
        value={description}
        maxLength={4000}
        rows={2}
        onChange={(e) => setDescription(e.target.value)}
        className="mb-2 w-full resize-y rounded-md border border-white/[0.08] bg-black/30 px-3 py-1.5 text-sm text-[#ccc] placeholder:text-[#555] focus:border-[#E2B93B]/40 focus:outline-none"
      />
      {err && <p className="mb-2 text-xs text-red-300">{err}</p>}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="text-xs text-[#888] hover:text-[#ccc]">
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !title.trim()}
          className="rounded-md border border-[#E2B93B]/40 bg-[#E2B93B]/15 px-3 py-1 text-xs font-medium text-[#E2B93B] hover:bg-[#E2B93B]/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Pitching..." : "Pitch idea"}
        </button>
      </div>
    </div>
  );
}

interface IdeaRowProps {
  idea: Idea;
  expanded: boolean;
  onToggleExpand: () => void;
  onVote: (choice: "up" | "down") => Promise<void> | void;
  onPromote: () => Promise<void> | void;
  profilesByAgentId: Map<string, Profile>;
  agentId: string | null;
  callApi: <T,>(action: string, body: Record<string, unknown>) => Promise<T>;
}

function IdeaRow({ idea, expanded, onToggleExpand, onVote, onPromote, profilesByAgentId, agentId, callApi }: IdeaRowProps) {
  const truncated =
    idea.description && idea.description.length > 120
      ? idea.description.slice(0, 117) + "..."
      : idea.description;
  return (
    <li className="rounded-md border border-white/[0.06] bg-black/20 p-3">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-0.5 pt-0.5">
          <button
            type="button"
            onClick={() => onVote("up")}
            disabled={!agentId}
            className={`rounded p-1 hover:bg-[#5dd66e]/20 ${idea.my_vote === "up" ? "bg-[#5dd66e]/20 text-[#5dd66e]" : "text-[#888]"}`}
            aria-label="Upvote"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
          <span className={`text-xs font-bold ${idea.score > 0 ? "text-[#5dd66e]" : idea.score < 0 ? "text-red-300" : "text-[#888]"}`}>
            {idea.score >= 0 ? `+${idea.score}` : idea.score}
          </span>
          <button
            type="button"
            onClick={() => onVote("down")}
            disabled={!agentId}
            className={`rounded p-1 hover:bg-red-500/20 ${idea.my_vote === "down" ? "bg-red-500/20 text-red-300" : "text-[#888]"}`}
            aria-label="Downvote"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onToggleExpand} className="block w-full text-left">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-[#ccc]">{idea.title}</p>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_PILL[idea.status]}`}>
                {idea.status}
              </span>
              {idea.comment_count != null && idea.comment_count > 0 && (
                <span className="text-[10px] text-[#666]">💬 {idea.comment_count}</span>
              )}
            </div>
            {truncated && <p className="mt-1 text-xs text-[#888]">{truncated}</p>}
          </button>
          {expanded && (
            <ExpandedIdeaPanel
              idea={idea}
              agentId={agentId}
              profilesByAgentId={profilesByAgentId}
              callApi={callApi}
              onPromote={onPromote}
            />
          )}
        </div>
      </div>
    </li>
  );
}

interface ExpandedIdeaPanelProps {
  idea: Idea;
  agentId: string | null;
  profilesByAgentId: Map<string, Profile>;
  callApi: <T,>(action: string, body: Record<string, unknown>) => Promise<T>;
  onPromote: () => Promise<void> | void;
}

function ExpandedIdeaPanel({ idea, agentId, profilesByAgentId, callApi, onPromote }: ExpandedIdeaPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    if (!agentId) return;
    setLoadingComments(true);
    try {
      const res = await callApi<{ comments: Comment[] }>("fishbowl_list_comments", {
        agent_id: agentId,
        target_kind: "idea",
        target_id: idea.id,
      });
      setComments(res.comments ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load comments");
    } finally {
      setLoadingComments(false);
    }
  }, [agentId, callApi, idea.id]);

  useEffect(() => { void loadComments(); }, [loadComments]);

  const submit = async () => {
    if (!agentId || !newComment.trim()) return;
    try {
      await callApi("fishbowl_comment", {
        agent_id: agentId,
        target_kind: "idea",
        target_id: idea.id,
        text: newComment.trim(),
      });
      setNewComment("");
      await loadComments();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to comment");
    }
  };

  const canPromote = idea.status !== "locked" && !idea.promoted_to_todo_id;

  return (
    <div className="mt-3 border-t border-white/[0.06] pt-3 text-xs">
      {idea.description && (
        <p className="mb-2 whitespace-pre-wrap text-[#bbb]">{idea.description}</p>
      )}
      <p className="mb-3 text-[10px] text-[#555]">
        Pitched by {profilesByAgentId.get(idea.created_by_agent_id)?.display_name ?? idea.created_by_agent_id}
        {" "}-- {idea.upvotes} up, {idea.downvotes} down
      </p>

      <div className="mb-3">
        <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#888]">Comments</h4>
        {loadingComments ? (
          <p className="text-[#555]">Loading...</p>
        ) : comments.length === 0 ? (
          <p className="text-[#555]">No comments yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {comments.map((c) => (
              <li key={c.id} className="rounded bg-white/[0.02] px-2 py-1">
                <div className="flex items-baseline gap-1.5">
                  <span>{c.author_emoji}</span>
                  <span className="font-medium text-[#ccc]">{c.author_name ?? c.author_agent_id}</span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-[#bbb]">{c.text}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex gap-1.5">
          <input
            type="text"
            placeholder="Add a comment"
            value={newComment}
            maxLength={4000}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            className="flex-1 rounded border border-white/[0.08] bg-black/30 px-2 py-1 text-xs text-[#ccc] placeholder:text-[#555] focus:border-[#E2B93B]/40 focus:outline-none"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!newComment.trim()}
            className="rounded border border-[#E2B93B]/40 bg-[#E2B93B]/10 px-2 py-1 text-[10px] text-[#E2B93B] hover:bg-[#E2B93B]/20 disabled:opacity-40"
          >
            Post
          </button>
        </div>
      </div>

      {err && <p className="mb-2 text-red-300">{err}</p>}

      <div className="flex items-center justify-end gap-2">
        {idea.promoted_to_todo_id && (
          <span className="mr-auto text-[10px] text-[#5dd66e]">
            Promoted to a todo.
          </span>
        )}
        <button
          type="button"
          onClick={onPromote}
          disabled={!canPromote}
          className="rounded border border-[#E2B93B]/40 bg-[#E2B93B]/10 px-2 py-0.5 text-[10px] text-[#E2B93B] hover:bg-[#E2B93B]/20 disabled:cursor-not-allowed disabled:opacity-40"
          title={!canPromote ? "Already promoted" : "Promote to a todo (admin can promote at any score; agents need net +1)"}
        >
          Promote to todo
        </button>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface Comment {
  id: string;
  target_kind: "todo" | "idea";
  target_id: string;
  author_agent_id: string;
  text: string;
  created_at: string;
}

interface CommentsProps {
  authHeader: Record<string, string>;
  humanAgentId: string | null;
  targetKind: "todo" | "idea";
  targetId: string;
  pollSeq: number;
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

export default function Comments({
  authHeader,
  humanAgentId,
  targetKind,
  targetId,
  pollSeq,
}: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    if (!humanAgentId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/memory-admin?action=fishbowl_list_comments", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: humanAgentId,
          target_kind: targetKind,
          target_id: targetId,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { comments?: Comment[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to load comments");
      setComments(body.comments ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [authHeader, humanAgentId, targetKind, targetId]);

  useEffect(() => {
    void fetchComments();
  }, [fetchComments, pollSeq]);

  const submit = async () => {
    const trimmed = text.trim();
    if (!humanAgentId || !trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/memory-admin?action=fishbowl_comment_on", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: humanAgentId,
          target_kind: targetKind,
          target_id: targetId,
          text: trimmed,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to comment");
      setText("");
      await fetchComments();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to comment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-[#888]">
          Comments {comments.length > 0 && <span className="text-[#666]">({comments.length})</span>}
        </h4>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-[#888]" />}
      </div>

      {comments.length > 0 && (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li
              key={c.id}
              className="rounded-md border border-white/[0.06] bg-black/20 px-3 py-2 text-xs"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-[#ccc]">{c.author_agent_id}</span>
                <span className="text-[10px] text-[#666]">{relativeTime(c.created_at)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[#ccc]">{c.text}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={humanAgentId ? "Add a comment..." : "Setting up profile..."}
          rows={2}
          disabled={!humanAgentId || submitting}
          className="w-full resize-y rounded-md border border-white/[0.08] bg-black/20 px-3 py-2 text-xs text-[#ccc] placeholder:text-[#555] focus:border-[#E2B93B]/40 focus:outline-none disabled:opacity-50"
        />
        <div className="flex items-center justify-between gap-2">
          {error ? (
            <p className="text-xs text-red-300">{error}</p>
          ) : (
            <span className="text-[10px] text-[#666]">{text.trim().length} / 4000</span>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!humanAgentId || submitting || text.trim().length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#E2B93B]/40 bg-[#E2B93B]/15 px-3 py-1 text-xs font-medium text-[#E2B93B] hover:bg-[#E2B93B]/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Post
          </button>
        </div>
      </div>
    </div>
  );
}

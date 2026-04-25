import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Trash2 } from "lucide-react";

interface Todo {
  id: string;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "done" | "dropped";
  priority: "low" | "normal" | "high" | "urgent";
  created_by_agent_id: string;
  assigned_to_agent_id: string | null;
  source_idea_id: string | null;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
  comment_count?: number;
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

const STORAGE_KEY = "unclick.fishbowl.todos.collapsed";
const COLUMNS: Array<{ id: Todo["status"]; label: string }> = [
  { id: "open", label: "Open" },
  { id: "in_progress", label: "In progress" },
  { id: "done", label: "Done" },
];
const PRIORITY_COLORS: Record<Todo["priority"], string> = {
  low: "bg-white/[0.06] text-[#888]",
  normal: "bg-[#3b82f6]/15 text-[#7aa9ff]",
  high: "bg-[#f59e0b]/15 text-[#f5b941]",
  urgent: "bg-red-500/20 text-red-300",
};

function priorityPill(p: Todo["priority"]) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${PRIORITY_COLORS[p]}`}>
      {p}
    </span>
  );
}

interface Props {
  token: string | undefined;
  authHeader: Record<string, string>;
  agentId: string | null;
  profiles: Profile[];
}

export default function FishbowlTodos({ token, authHeader, agentId, profiles }: Props) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v === "1";
  });

  const [todos, setTodos] = useState<Todo[]>([]);
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

  const fetchTodos = useCallback(async () => {
    if (!token || !agentId || collapsed) return;
    setLoading(true);
    setError(null);
    try {
      const [active, done] = await Promise.all([
        callApi<{ todos: Todo[] }>("fishbowl_list_todos", { agent_id: agentId }),
        callApi<{ todos: Todo[] }>("fishbowl_list_todos", { agent_id: agentId, status: "done", limit: 50 }),
      ]);
      const combined = [...(active.todos ?? []), ...(done.todos ?? [])];
      setTodos(combined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load todos");
    } finally {
      setLoading(false);
    }
  }, [token, agentId, collapsed, callApi]);

  useEffect(() => { void fetchTodos(); }, [fetchTodos]);
  useEffect(() => {
    if (!token || !agentId || collapsed) return;
    const id = setInterval(() => { void fetchTodos(); }, 10_000);
    return () => clearInterval(id);
  }, [token, agentId, collapsed, fetchTodos]);

  const updateStatus = async (todo: Todo, newStatus: Todo["status"]) => {
    if (!agentId) return;
    try {
      if (newStatus === "done") {
        // complete_todo emits the todo-completed Fishbowl event, so prefer it
        // over a generic update for the done transition.
        await callApi("fishbowl_complete_todo", { agent_id: agentId, todo_id: todo.id });
      } else {
        await callApi("fishbowl_update_todo", {
          agent_id: agentId,
          todo_id: todo.id,
          status: newStatus,
        });
      }
      await fetchTodos();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    }
  };

  const todosByColumn = useMemo(() => {
    const groups: Record<Todo["status"], Todo[]> = { open: [], in_progress: [], done: [], dropped: [] };
    for (const t of todos) {
      if (groups[t.status]) groups[t.status].push(t);
    }
    return groups;
  }, [todos]);

  const counts = {
    open: todosByColumn.open.length,
    in_progress: todosByColumn.in_progress.length,
    done: todosByColumn.done.length,
  };
  const totalActive = counts.open + counts.in_progress;

  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <button
        type="button"
        onClick={toggleCollapsed}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        aria-expanded={!collapsed}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-[#ccc]">
          <span aria-hidden>📋</span>
          <span>Todos</span>
          <span className="rounded bg-[#E2B93B]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#E2B93B]">
            {totalActive} active
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
                <span>Drag between columns to change status. Click a card to expand.</span>
              )}
            </p>
            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              disabled={!agentId}
              className="rounded-md border border-[#E2B93B]/40 bg-[#E2B93B]/15 px-3 py-1 text-xs font-medium text-[#E2B93B] hover:bg-[#E2B93B]/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {creating ? "Cancel" : "Add todo"}
            </button>
          </div>

          {creating && (
            <CreateTodoForm
              agentId={agentId}
              profiles={profiles}
              onCancel={() => setCreating(false)}
              onCreated={async () => {
                setCreating(false);
                await fetchTodos();
              }}
              callApi={callApi}
            />
          )}

          <div className="grid gap-3 md:grid-cols-3">
            {COLUMNS.map((col) => (
              <div
                key={col.id}
                className="flex min-h-[120px] flex-col rounded-lg border border-white/[0.06] bg-black/20 p-2"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain");
                  const todo = todos.find((t) => t.id === id);
                  if (todo && todo.status !== col.id) void updateStatus(todo, col.id);
                }}
              >
                <h3 className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-[#888]">
                  <span>{col.label}</span>
                  <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-[#666]">{counts[col.id]}</span>
                </h3>
                <ul className="flex flex-col gap-2">
                  {todosByColumn[col.id].map((t) => (
                    <TodoCard
                      key={t.id}
                      todo={t}
                      expanded={expandedId === t.id}
                      onToggleExpand={() => setExpandedId((curr) => (curr === t.id ? null : t.id))}
                      profilesByAgentId={profilesByAgentId}
                      agentId={agentId}
                      callApi={callApi}
                      onChanged={fetchTodos}
                    />
                  ))}
                  {todosByColumn[col.id].length === 0 && (
                    <li className="px-2 py-3 text-center text-xs text-[#555]">Nothing here yet.</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

interface CreateTodoFormProps {
  agentId: string | null;
  profiles: Profile[];
  onCancel: () => void;
  onCreated: () => Promise<void> | void;
  callApi: <T,>(action: string, body: Record<string, unknown>) => Promise<T>;
}

function CreateTodoForm({ agentId, profiles, onCancel, onCreated, callApi }: CreateTodoFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Todo["priority"]>("normal");
  const [assignee, setAssignee] = useState<string>("");
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
      await callApi("fishbowl_create_todo", {
        agent_id: agentId,
        title: trimmed,
        description: description.trim() || undefined,
        priority,
        assigned_to_agent_id: assignee || undefined,
      });
      setTitle("");
      setDescription("");
      setPriority("normal");
      setAssignee("");
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
        placeholder="Todo title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        className="mb-2 w-full rounded-md border border-white/[0.08] bg-black/30 px-3 py-1.5 text-sm text-[#ccc] placeholder:text-[#555] focus:border-[#E2B93B]/40 focus:outline-none"
      />
      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={4000}
        rows={2}
        className="mb-2 w-full resize-y rounded-md border border-white/[0.08] bg-black/30 px-3 py-1.5 text-sm text-[#ccc] placeholder:text-[#555] focus:border-[#E2B93B]/40 focus:outline-none"
      />
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1 text-[#888]">
          Priority
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Todo["priority"])}
            className="rounded border border-white/[0.08] bg-black/40 px-1.5 py-0.5 text-[#ccc]"
          >
            <option value="low">low</option>
            <option value="normal">normal</option>
            <option value="high">high</option>
            <option value="urgent">urgent</option>
          </select>
        </label>
        <label className="flex items-center gap-1 text-[#888]">
          Assign to
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="rounded border border-white/[0.08] bg-black/40 px-1.5 py-0.5 text-[#ccc]"
          >
            <option value="">(unassigned)</option>
            {profiles.map((p) => (
              <option key={p.agent_id} value={p.agent_id}>
                {p.emoji} {p.display_name ?? p.agent_id}
              </option>
            ))}
          </select>
        </label>
      </div>
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
          {submitting ? "Creating..." : "Create"}
        </button>
      </div>
    </div>
  );
}

interface TodoCardProps {
  todo: Todo;
  expanded: boolean;
  onToggleExpand: () => void;
  profilesByAgentId: Map<string, Profile>;
  agentId: string | null;
  callApi: <T,>(action: string, body: Record<string, unknown>) => Promise<T>;
  onChanged: () => Promise<void> | void;
}

function TodoCard({ todo, expanded, onToggleExpand, profilesByAgentId, agentId, callApi, onChanged }: TodoCardProps) {
  const assignee = todo.assigned_to_agent_id ? profilesByAgentId.get(todo.assigned_to_agent_id) : null;
  const isDone = todo.status === "done";

  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", todo.id);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <li
      className="cursor-move rounded-md border border-white/[0.06] bg-white/[0.02] p-2 hover:border-[#E2B93B]/30"
      draggable
      onDragStart={onDragStart}
    >
      <button type="button" onClick={onToggleExpand} className="flex w-full items-start gap-2 text-left">
        <div className="min-w-0 flex-1">
          <p className={`text-sm ${isDone ? "text-[#666] line-through" : "text-[#ccc]"}`}>
            {isDone && <span className="mr-1 text-[#5dd66e]">✓</span>}
            {todo.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {priorityPill(todo.priority)}
            {assignee && (
              <span className="text-[10px] text-[#888]" title={assignee.display_name ?? assignee.agent_id}>
                {assignee.emoji}
              </span>
            )}
            {todo.comment_count != null && todo.comment_count > 0 && (
              <span className="text-[10px] text-[#666]">💬 {todo.comment_count}</span>
            )}
          </div>
        </div>
      </button>
      {expanded && (
        <ExpandedTodoPanel
          todo={todo}
          agentId={agentId}
          profilesByAgentId={profilesByAgentId}
          callApi={callApi}
          onChanged={onChanged}
        />
      )}
    </li>
  );
}

interface ExpandedTodoPanelProps {
  todo: Todo;
  agentId: string | null;
  profilesByAgentId: Map<string, Profile>;
  callApi: <T,>(action: string, body: Record<string, unknown>) => Promise<T>;
  onChanged: () => Promise<void> | void;
}

function ExpandedTodoPanel({ todo, agentId, profilesByAgentId, callApi, onChanged }: ExpandedTodoPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [actionErr, setActionErr] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    if (!agentId) return;
    setLoadingComments(true);
    try {
      const res = await callApi<{ comments: Comment[] }>("fishbowl_list_comments", {
        agent_id: agentId,
        target_kind: "todo",
        target_id: todo.id,
      });
      setComments(res.comments ?? []);
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "Failed to load comments");
    } finally {
      setLoadingComments(false);
    }
  }, [agentId, callApi, todo.id]);

  useEffect(() => { void loadComments(); }, [loadComments]);

  const submitComment = async () => {
    if (!agentId || !newComment.trim()) return;
    try {
      await callApi("fishbowl_comment", {
        agent_id: agentId,
        target_kind: "todo",
        target_id: todo.id,
        text: newComment.trim(),
      });
      setNewComment("");
      await loadComments();
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "Failed to comment");
    }
  };

  const complete = async () => {
    if (!agentId) return;
    try {
      await callApi("fishbowl_complete_todo", { agent_id: agentId, todo_id: todo.id });
      await onChanged();
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "Failed to complete");
    }
  };

  const remove = async () => {
    if (!agentId) return;
    if (!confirm(`Delete "${todo.title}"? This cannot be undone.`)) return;
    try {
      await callApi("fishbowl_delete_todo", { agent_id: agentId, todo_id: todo.id });
      await onChanged();
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  return (
    <div className="mt-2 border-t border-white/[0.06] pt-2 text-xs">
      {todo.description && (
        <p className="mb-2 whitespace-pre-wrap text-[#bbb]">{todo.description}</p>
      )}
      <p className="mb-2 text-[10px] text-[#555]">
        Created by {profilesByAgentId.get(todo.created_by_agent_id)?.display_name ?? todo.created_by_agent_id}
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
                void submitComment();
              }
            }}
            className="flex-1 rounded border border-white/[0.08] bg-black/30 px-2 py-1 text-xs text-[#ccc] placeholder:text-[#555] focus:border-[#E2B93B]/40 focus:outline-none"
          />
          <button
            type="button"
            onClick={submitComment}
            disabled={!newComment.trim()}
            className="rounded border border-[#E2B93B]/40 bg-[#E2B93B]/10 px-2 py-1 text-[10px] text-[#E2B93B] hover:bg-[#E2B93B]/20 disabled:opacity-40"
          >
            Post
          </button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        {actionErr && <span className="mr-auto text-red-300">{actionErr}</span>}
        {todo.status !== "done" && (
          <button
            type="button"
            onClick={complete}
            className="rounded border border-[#5dd66e]/40 bg-[#5dd66e]/10 px-2 py-0.5 text-[10px] text-[#5dd66e] hover:bg-[#5dd66e]/20"
          >
            Mark done
          </button>
        )}
        <button
          type="button"
          onClick={remove}
          className="flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-300 hover:bg-red-500/20"
        >
          <Trash2 className="h-3 w-3" /> Delete
        </button>
      </div>
    </div>
  );
}

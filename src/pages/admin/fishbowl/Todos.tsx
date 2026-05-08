import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import Comments from "./Comments";

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

interface TodosProps {
  authHeader: Record<string, string>;
  humanAgentId: string | null;
  variant?: "boardroom" | "page";
}

const STORAGE_KEY = "unclick.fishbowl.todos.collapsed";

const COLUMNS: Array<{ key: "open" | "in_progress" | "done"; label: string }> = [
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];

const PRIORITY_STYLE: Record<Todo["priority"], string> = {
  low: "bg-[#333]/40 text-[#888]",
  normal: "bg-[#444]/40 text-[#aaa]",
  high: "bg-[#E2B93B]/15 text-[#E2B93B]",
  urgent: "bg-red-500/20 text-red-300",
};

function priorityPill(p: Todo["priority"]) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_STYLE[p]}`}
    >
      {p}
    </span>
  );
}

const STATUS_STYLE: Record<Todo["status"], string> = {
  open: "bg-white/[0.05] text-[#aaa]",
  in_progress: "bg-[#E2B93B]/15 text-[#E2B93B]",
  done: "bg-green-500/15 text-green-300",
  dropped: "bg-red-500/15 text-red-300",
};

function statusPill(status: Todo["status"]) {
  const label = status === "in_progress" ? "active" : status;
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLE[status]}`}>
      {label}
    </span>
  );
}

function progressFor(todo: Todo) {
  if (todo.status === "done") return 100;
  if (todo.status === "in_progress") return 45;
  if (todo.priority === "urgent") return 15;
  if (todo.priority === "high") return 10;
  return 5;
}

function attentionText(todo: Todo) {
  if (todo.status === "done") return "receipt";
  if (todo.status === "in_progress") return todo.assigned_to_agent_id ? "moving" : "needs owner";
  if (todo.priority === "urgent") return "next";
  if (todo.priority === "high") return "in line";
  return "waiting";
}

function AddTodoForm({
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
  const [priority, setPriority] = useState<Todo["priority"]>("normal");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle("");
    setDescription("");
    setPriority("normal");
    setError(null);
  };

  const submit = async () => {
    if (!humanAgentId) return;
    const t = title.trim();
    if (!t) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/memory-admin?action=fishbowl_create_todo", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: humanAgentId,
          title: t,
          description: description.trim() || null,
          priority,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to create todo");
      reset();
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
        Add todo
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
        placeholder="Optional description"
        rows={2}
        maxLength={4000}
        className="w-full resize-y rounded-md border border-white/[0.08] bg-black/30 px-2 py-1.5 text-xs text-[#ccc] placeholder:text-[#555] focus:border-[#E2B93B]/40 focus:outline-none"
      />
      <div className="flex items-center justify-between gap-2">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Todo["priority"])}
          className="rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-xs text-[#ccc] focus:border-[#E2B93B]/40 focus:outline-none"
        >
          <option value="low">low</option>
          <option value="normal">normal</option>
          <option value="high">high</option>
          <option value="urgent">urgent</option>
        </select>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-red-300">{error}</span>}
          <button
            type="button"
            onClick={() => {
              reset();
              setOpen(false);
            }}
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
    </div>
  );
}

function TodoCard({
  todo,
  expanded,
  onToggle,
  authHeader,
  humanAgentId,
  pollSeq,
  onMutated,
}: {
  todo: Todo;
  expanded: boolean;
  onToggle: () => void;
  authHeader: Record<string, string>;
  humanAgentId: string | null;
  pollSeq: number;
  onMutated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(todo.title);
  const [draftDesc, setDraftDesc] = useState(todo.description ?? "");
  const [draftPriority, setDraftPriority] = useState<Todo["priority"]>(todo.priority);

  const callMutation = async (action: string, payload: Record<string, unknown>) => {
    if (!humanAgentId) return;
    setBusy(true);
    try {
      await fetch(`/api/memory-admin?action=${action}`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: humanAgentId, ...payload }),
      });
      onMutated();
    } finally {
      setBusy(false);
    }
  };

  const saveEdits = async () => {
    await callMutation("fishbowl_update_todo", {
      todo_id: todo.id,
      title: draftTitle.trim(),
      description: draftDesc.trim() || null,
      priority: draftPriority,
    });
    setEditing(false);
  };

  const isDone = todo.status === "done";

  return (
    <div
      className={`rounded-lg border border-white/[0.06] bg-black/30 p-3 ${isDone ? "opacity-70" : ""}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-2 text-left"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-sm font-medium ${isDone ? "text-[#666] line-through" : "text-[#ccc]"}`}
          >
            {isDone && <span className="mr-1 text-green-400">✓</span>}
            {todo.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-[#666]">
            {priorityPill(todo.priority)}
            {todo.assigned_to_agent_id && (
              <span className="rounded bg-white/[0.05] px-1.5 py-0.5">
                @{todo.assigned_to_agent_id}
              </span>
            )}
            {(todo.comment_count ?? 0) > 0 && (
              <span className="text-[#888]">💬 {todo.comment_count}</span>
            )}
            {todo.source_idea_id && (
              <span className="rounded bg-[#E2B93B]/10 px-1.5 py-0.5 text-[#E2B93B]">
                from idea
              </span>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-[#888]" />
        ) : (
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#888]" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-white/[0.06] pt-3">
          {editing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                maxLength={200}
                className="w-full rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-sm text-[#ccc] focus:border-[#E2B93B]/40 focus:outline-none"
              />
              <textarea
                value={draftDesc}
                onChange={(e) => setDraftDesc(e.target.value)}
                rows={3}
                maxLength={4000}
                className="w-full resize-y rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-xs text-[#ccc] focus:border-[#E2B93B]/40 focus:outline-none"
              />
              <div className="flex items-center justify-between gap-2">
                <select
                  value={draftPriority}
                  onChange={(e) => setDraftPriority(e.target.value as Todo["priority"])}
                  className="rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-xs text-[#ccc] focus:outline-none"
                >
                  <option value="low">low</option>
                  <option value="normal">normal</option>
                  <option value="high">high</option>
                  <option value="urgent">urgent</option>
                </select>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDraftTitle(todo.title);
                      setDraftDesc(todo.description ?? "");
                      setDraftPriority(todo.priority);
                      setEditing(false);
                    }}
                    className="rounded-md border border-white/[0.08] px-2 py-1 text-xs text-[#888] hover:bg-white/[0.05]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveEdits}
                    disabled={busy || draftTitle.trim().length === 0}
                    className="rounded-md border border-[#E2B93B]/40 bg-[#E2B93B]/15 px-2 py-1 text-xs font-medium text-[#E2B93B] disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          ) : (
            todo.description && (
              <p className="whitespace-pre-wrap text-xs text-[#bbb]">{todo.description}</p>
            )
          )}

          {!editing && (
            <div className="flex flex-wrap items-center gap-2">
              {!isDone && (
                <button
                  type="button"
                  onClick={() => callMutation("fishbowl_complete_todo", { todo_id: todo.id })}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-md border border-green-400/40 bg-green-400/10 px-2 py-1 text-xs font-medium text-green-300 hover:bg-green-400/20 disabled:opacity-40"
                >
                  ✓ Complete
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditing(true)}
                disabled={busy}
                className="rounded-md border border-white/[0.08] px-2 py-1 text-xs text-[#888] hover:bg-white/[0.05]"
              >
                Edit
              </button>
              {todo.status !== "dropped" && !isDone && (
                <button
                  type="button"
                  onClick={() => callMutation("fishbowl_drop_todo", { todo_id: todo.id })}
                  disabled={busy}
                  className="rounded-md border border-white/[0.08] px-2 py-1 text-xs text-[#888] hover:bg-white/[0.05]"
                >
                  Drop
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Delete this todo permanently?")) {
                    void callMutation("fishbowl_delete_todo", { todo_id: todo.id });
                  }
                }}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-md border border-red-400/30 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-40"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            </div>
          )}

          <Comments
            authHeader={authHeader}
            humanAgentId={humanAgentId}
            targetKind="todo"
            targetId={todo.id}
            pollSeq={pollSeq}
          />
        </div>
      )}
    </div>
  );
}

export default function FishbowlTodos({ authHeader, humanAgentId, variant = "boardroom" }: TodosProps) {
  const pageMode = variant === "page";
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (pageMode) return false;
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(STORAGE_KEY) !== "0";
  });

  const [todos, setTodos] = useState<Todo[]>([]);
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

  const fetchTodos = useCallback(async () => {
    if (!humanAgentId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/memory-admin?action=fishbowl_list_todos", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: humanAgentId, limit: 200 }),
      });
      const body = (await res.json().catch(() => ({}))) as { todos?: Todo[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to load todos");
      setTodos(body.todos ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [authHeader, humanAgentId]);

  useEffect(() => {
    if (collapsed) return;
    void fetchTodos();
  }, [collapsed, fetchTodos]);

  useEffect(() => {
    if (collapsed) return;
    const id = setInterval(() => {
      void fetchTodos();
      setPollSeq((s) => s + 1);
    }, 10_000);
    return () => clearInterval(id);
  }, [collapsed, fetchTodos]);

  const onMutated = useCallback(() => {
    void fetchTodos();
    setPollSeq((s) => s + 1);
  }, [fetchTodos]);

  const grouped = useMemo(() => {
    const map: Record<string, Todo[]> = { open: [], in_progress: [], done: [] };
    for (const t of todos) {
      if (t.status === "dropped") continue;
      if (map[t.status]) map[t.status].push(t);
    }
    return map;
  }, [todos]);

  const pageGroups = useMemo(() => {
    const active = todos.filter((t) => t.status === "in_progress");
    const next = todos.filter((t) => t.status === "open" && (t.priority === "urgent" || t.priority === "high"));
    const inLine = todos.filter((t) => t.status === "open" && t.priority !== "urgent" && t.priority !== "high");
    const done = todos.filter((t) => t.status === "done");
    return { active, next, inLine, done };
  }, [todos]);

  const toggleCard = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalActive = grouped.open.length + grouped.in_progress.length;

  if (pageMode) {
    const renderPageSection = (label: string, items: Todo[], helper: string) => (
      <section className="rounded-lg border border-white/[0.06] bg-black/20">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[#888]">{label}</h2>
            <p className="mt-0.5 text-[11px] text-[#555]">{helper}</p>
          </div>
          <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] text-[#888]">{items.length}</span>
        </div>
        {items.length === 0 ? (
          <p className="px-3 py-3 text-xs italic text-[#555]">empty</p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {items.slice(0, 100).map((t) => {
              const progress = progressFor(t);
              const expandedRow = expanded.has(t.id);
              return (
                <div key={t.id} className={t.status === "done" ? "opacity-70" : ""}>
                  <button
                    type="button"
                    onClick={() => toggleCard(t.id)}
                    className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-3 py-2 text-left md:grid-cols-[minmax(0,1fr)_90px_110px_110px_80px_auto]"
                    aria-expanded={expandedRow}
                  >
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-medium ${t.status === "done" ? "text-[#666] line-through" : "text-[#ddd]"}`}>
                        {t.status === "done" && <span className="mr-1 text-green-400">✓</span>}
                        {t.title}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-[#666]">
                        {t.assigned_to_agent_id ? `owner ${t.assigned_to_agent_id}` : "unassigned"}
                        {(t.comment_count ?? 0) > 0 ? ` · ${t.comment_count} comments` : ""}
                      </p>
                    </div>
                    <div className="hidden md:block">{statusPill(t.status)}</div>
                    <div className="hidden md:block">{priorityPill(t.priority)}</div>
                    <div className="hidden text-xs text-[#888] md:block">{attentionText(t)}</div>
                    <div className="hidden md:block">
                      <div className="h-1.5 rounded-full bg-white/[0.06]">
                        <div className="h-1.5 rounded-full bg-[#61C1C4]" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="mt-0.5 text-[10px] text-[#666]">{progress}%</p>
                    </div>
                    {expandedRow ? (
                      <ChevronDown className="h-4 w-4 text-[#888]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[#888]" />
                    )}
                  </button>
                  {expandedRow && (
                    <div className="space-y-3 border-t border-white/[0.06] bg-black/20 px-3 py-3">
                      {t.description && <p className="whitespace-pre-wrap text-xs leading-5 text-[#bbb]">{t.description}</p>}
                      <div className="flex flex-wrap items-center gap-2">
                        {t.status !== "done" && (
                          <button
                            type="button"
                            onClick={() => {
                              void fetch(`/api/memory-admin?action=fishbowl_complete_todo`, {
                                method: "POST",
                                headers: { ...authHeader, "Content-Type": "application/json" },
                                body: JSON.stringify({ agent_id: humanAgentId, todo_id: t.id }),
                              }).then(onMutated);
                            }}
                            disabled={!humanAgentId}
                            className="rounded-md border border-green-400/40 bg-green-400/10 px-2 py-1 text-xs font-medium text-green-300 disabled:opacity-40"
                          >
                            Complete
                          </button>
                        )}
                        <span className="text-xs text-[#666]">Created {new Date(t.created_at).toLocaleDateString()}</span>
                      </div>
                      <Comments
                        authHeader={authHeader}
                        humanAgentId={humanAgentId}
                        targetKind="todo"
                        targetId={t.id}
                        pollSeq={pollSeq}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            {items.length > 100 && (
              <p className="px-3 py-2 text-xs text-[#666]">Showing first 100. Narrow the queue by completing or dropping older jobs.</p>
            )}
          </div>
        )}
      </section>
    );

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-[#666]">
            Single source of truth from Boardroom todos. One job per line.
          </div>
          <div className="flex items-center gap-2">
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#888]" />}
            <AddTodoForm authHeader={authHeader} humanAgentId={humanAgentId} onCreated={onMutated} />
          </div>
        </div>

        {error && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}

        {renderPageSection("Active now", pageGroups.active, "Work already claimed or moving.")}
        {renderPageSection("Next", pageGroups.next, "Urgent and high-priority jobs waiting for owner, proof, or decision.")}
        {renderPageSection("In line", pageGroups.inLine, "Normal and low-priority jobs kept visible without drowning the page.")}
        {renderPageSection("Done", pageGroups.done, "Completed jobs with receipts and comments kept expandable.")}
      </div>
    );
  }

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
          {totalActive > 0 && (
            <span className="rounded-full bg-[#E2B93B]/15 px-2 py-0.5 text-[10px] font-medium text-[#E2B93B]">
              {totalActive} active
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
          <div className="flex items-center justify-between gap-2">
            <AddTodoForm
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

          <div className="grid gap-3 md:grid-cols-3">
            {COLUMNS.map((col) => (
              <div
                key={col.key}
                className="flex flex-col gap-2 rounded-lg border border-white/[0.04] bg-black/20 p-2"
              >
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[#888]">
                    {col.label}
                  </h3>
                  <span className="text-[10px] text-[#666]">{grouped[col.key].length}</span>
                </div>
                {grouped[col.key].length === 0 ? (
                  <p className="px-1 py-2 text-[11px] italic text-[#555]">empty</p>
                ) : (
                  grouped[col.key].map((t) => (
                    <TodoCard
                      key={t.id}
                      todo={t}
                      expanded={expanded.has(t.id)}
                      onToggle={() => toggleCard(t.id)}
                      authHeader={authHeader}
                      humanAgentId={humanAgentId}
                      pollSeq={pollSeq}
                      onMutated={onMutated}
                    />
                  ))
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

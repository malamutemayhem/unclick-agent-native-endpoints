import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Loader2,
  MessageSquare,
  UserRound,
} from "lucide-react";
import { useSession } from "@/lib/auth";
import Comments from "./fishbowl/Comments";

interface FishbowlProfile {
  agent_id: string;
  emoji: string;
  display_name: string | null;
  user_agent_hint: string | null;
  created_at: string;
  last_seen_at: string | null;
  current_status: string | null;
  current_status_updated_at: string | null;
  next_checkin_at: string | null;
}

interface JobTodo {
  id: string;
  title: string;
  description?: string | null;
  status: "open" | "in_progress" | "done" | "dropped";
  priority: "low" | "normal" | "high" | "urgent";
  created_by_agent_id: string;
  assigned_to_agent_id: string | null;
  source_idea_id?: string | null;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
  comment_count?: number;
}

type JobSectionKey = "active" | "next" | "inline" | "done";

const SECTION_LABELS: Record<JobSectionKey, string> = {
  active: "Actioning now",
  next: "Next up",
  inline: "In line",
  done: "Done recently",
};

const PRIORITY_RANK: Record<JobTodo["priority"], number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

const PRIORITY_STYLE: Record<JobTodo["priority"], string> = {
  urgent: "border-red-400/30 bg-red-500/10 text-red-200",
  high: "border-[#E2B93B]/30 bg-[#E2B93B]/10 text-[#E2B93B]",
  normal: "border-white/10 bg-white/[0.04] text-white/60",
  low: "border-white/[0.06] bg-white/[0.02] text-white/40",
};

const STATUS_STYLE: Record<JobTodo["status"], string> = {
  open: "border-white/10 bg-white/[0.03] text-white/60",
  in_progress: "border-[#E2B93B]/35 bg-[#E2B93B]/10 text-[#E2B93B]",
  done: "border-green-400/25 bg-green-400/10 text-green-300",
  dropped: "border-white/[0.06] bg-white/[0.02] text-white/35",
};

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  const now = Date.now();
  if (!Number.isFinite(then)) return "unknown";
  const diffSec = Math.max(1, Math.floor((now - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 14) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}

function ownerLabel(todo: JobTodo): string {
  return todo.assigned_to_agent_id?.trim() || "unassigned";
}

function statusLabel(status: JobTodo["status"]): string {
  if (status === "in_progress") return "active";
  return status.replace("_", " ");
}

function progressFor(todo: JobTodo): number {
  if (todo.status === "done") return 100;
  if (todo.status === "in_progress") return 55;
  if (todo.assigned_to_agent_id) return 25;
  return 10;
}

function isStaleActive(todo: JobTodo): boolean {
  if (todo.status !== "in_progress") return false;
  const updated = new Date(todo.updated_at).getTime();
  if (!Number.isFinite(updated)) return false;
  return Date.now() - updated > 12 * 60 * 60 * 1000;
}

function needsAttention(todo: JobTodo): boolean {
  if (todo.status === "done" || todo.status === "dropped") return false;
  if (isStaleActive(todo)) return true;
  return todo.priority === "urgent" && !todo.assigned_to_agent_id;
}

function sortJobs(a: JobTodo, b: JobTodo): number {
  const priorityDiff = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
  if (priorityDiff !== 0) return priorityDiff;
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

function groupJobs(todos: JobTodo[]): Record<JobSectionKey, JobTodo[]> {
  const active = todos.filter((todo) => todo.status === "in_progress").sort(sortJobs);
  const open = todos.filter((todo) => todo.status === "open").sort(sortJobs);
  const next = open.filter((todo) => todo.priority === "urgent" || todo.priority === "high");
  const inline = open.filter((todo) => todo.priority === "normal" || todo.priority === "low");
  const done = todos
    .filter((todo) => todo.status === "done")
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  return { active, next, inline, done };
}

function JobRow({
  todo,
  expanded,
  onToggle,
  authHeader,
  humanAgentId,
  pollSeq,
}: {
  todo: JobTodo;
  expanded: boolean;
  onToggle: () => void;
  authHeader: Record<string, string>;
  humanAgentId: string | null;
  pollSeq: number;
}) {
  const attention = needsAttention(todo);
  const progress = progressFor(todo);
  const description = todo.description?.trim();

  return (
    <li className="border-b border-white/[0.05] last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="grid w-full gap-3 px-3 py-3 text-left transition-colors hover:bg-white/[0.03] md:grid-cols-[minmax(0,1.8fr)_96px_92px_minmax(110px,0.8fr)_96px_64px_40px]"
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 items-center gap-3">
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-white/40" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />
          )}
          <div className="min-w-0">
            <p
              className={`truncate text-sm font-medium ${todo.status === "done" ? "text-white/35 line-through" : "text-white/85"}`}
              title={todo.title}
            >
              {todo.title}
            </p>
            <p className="mt-0.5 truncate text-xs text-white/35">
              Updated {relativeTime(todo.updated_at)}
            </p>
          </div>
        </div>

        <span
          className={`w-fit rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${STATUS_STYLE[todo.status]}`}
        >
          {statusLabel(todo.status)}
        </span>
        <span
          className={`w-fit rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${PRIORITY_STYLE[todo.priority]}`}
        >
          {todo.priority}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-white/45">
          <UserRound className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate" title={ownerLabel(todo)}>
            {ownerLabel(todo)}
          </span>
        </span>
        <span className="flex items-center gap-1.5 text-xs text-white/45">
          <Clock3 className="h-3.5 w-3.5 shrink-0" />
          {todo.status === "done" ? "shipped" : isStaleActive(todo) ? "stale" : "live"}
        </span>
        <span className="text-xs font-medium text-white/55">{progress}%</span>
        <span className="flex items-center justify-end gap-1 text-xs text-white/45">
          <MessageSquare className="h-3.5 w-3.5" />
          {todo.comment_count ?? 0}
        </span>
      </button>

      {attention && (
        <div className="mx-3 mb-3 flex items-center gap-2 rounded-md border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{isStaleActive(todo) ? "Active job has not moved recently." : "Urgent job has no owner."}</span>
        </div>
      )}

      {expanded && (
        <div className="mx-3 mb-3 space-y-4 rounded-md border border-white/[0.06] bg-black/20 p-4">
          <div className="grid gap-3 text-xs text-white/50 sm:grid-cols-3">
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-white/30">Created</span>
              <span>{relativeTime(todo.created_at)}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-white/30">Owner</span>
              <span className="break-all">{ownerLabel(todo)}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-white/30">Source</span>
              <span>{todo.source_idea_id ? "idea" : "todo"}</span>
            </div>
          </div>

          {description ? (
            <p className="whitespace-pre-wrap text-sm leading-6 text-white/65">{description}</p>
          ) : (
            <p className="text-sm italic text-white/35">No description yet.</p>
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
    </li>
  );
}

function JobSection({
  sectionKey,
  jobs,
  expanded,
  onToggle,
  authHeader,
  humanAgentId,
  pollSeq,
}: {
  sectionKey: JobSectionKey;
  jobs: JobTodo[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
  authHeader: Record<string, string>;
  humanAgentId: string | null;
  pollSeq: number;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#111]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/45">
          {SECTION_LABELS[sectionKey]}
        </h2>
        <span className="text-xs text-white/35">{jobs.length}</span>
      </div>
      {jobs.length === 0 ? (
        <p className="px-3 py-4 text-sm italic text-white/30">Empty</p>
      ) : (
        <ul>
          {jobs.map((todo) => (
            <JobRow
              key={todo.id}
              todo={todo}
              expanded={expanded.has(todo.id)}
              onToggle={() => onToggle(todo.id)}
              authHeader={authHeader}
              humanAgentId={humanAgentId}
              pollSeq={pollSeq}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AdminJobs() {
  const { session } = useSession();
  const token = session?.access_token;
  const authHeader = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token],
  );

  const [humanAgentId, setHumanAgentId] = useState<string | null>(null);
  const [todos, setTodos] = useState<JobTodo[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollSeq, setPollSeq] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function claim() {
      try {
        const res = await fetch("/api/memory-admin?action=fishbowl_admin_claim", {
          method: "POST",
          headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const body = (await res.json().catch(() => ({}))) as {
          profile?: FishbowlProfile;
        };
        if (!cancelled && res.ok && body.profile) {
          setHumanAgentId(body.profile.agent_id);
        }
      } catch {
        if (!cancelled) setHumanAgentId(null);
      }
    }

    void claim();
    return () => {
      cancelled = true;
    };
  }, [authHeader, token]);

  useEffect(() => {
    if (!humanAgentId) return;
    let cancelled = false;

    async function loadJobs() {
      setLoading(true);
      try {
        const res = await fetch("/api/memory-admin?action=fishbowl_list_todos", {
          method: "POST",
          headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_id: humanAgentId,
            include_description: true,
            limit: 200,
          }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          todos?: JobTodo[];
          error?: string;
        };
        if (!res.ok) throw new Error(body.error ?? "Failed to load jobs");
        if (!cancelled) {
          setTodos((body.todos ?? []).filter((todo) => todo.status !== "dropped"));
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load jobs");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setFirstLoadDone(true);
        }
      }
    }

    void loadJobs();
    const id = setInterval(() => {
      void loadJobs();
      setPollSeq((s) => s + 1);
    }, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [authHeader, humanAgentId]);

  const grouped = useMemo(() => groupJobs(todos), [todos]);
  const activeCount = grouped.active.length;
  const queueCount = grouped.next.length + grouped.inline.length;
  const alertCount = todos.filter(needsAttention).length;

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center rounded-full border border-[#61C1C4]/30 bg-[#61C1C4]/10 px-3 py-1 text-xs font-medium text-[#61C1C4]">
            Jobs source of truth
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Jobs</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            One work list for active, next, queued, and completed UnClick jobs.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[360px]">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
            <p className="text-xs text-white/35">Active</p>
            <p className="mt-1 text-lg font-semibold text-[#E2B93B]">{activeCount}</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
            <p className="text-xs text-white/35">Queued</p>
            <p className="mt-1 text-lg font-semibold text-white/80">{queueCount}</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
            <p className="text-xs text-white/35">Alerts</p>
            <p className="mt-1 text-lg font-semibold text-red-200">{alertCount}</p>
          </div>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 text-xs text-white/35">
        <span>{firstLoadDone ? `${todos.length} visible jobs` : "Loading jobs"}</span>
        <span className="inline-flex items-center gap-1.5">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Refreshes every 10s
        </span>
      </div>

      <div className="space-y-4">
        <JobSection
          sectionKey="active"
          jobs={grouped.active}
          expanded={expanded}
          onToggle={toggleExpanded}
          authHeader={authHeader}
          humanAgentId={humanAgentId}
          pollSeq={pollSeq}
        />
        <JobSection
          sectionKey="next"
          jobs={grouped.next}
          expanded={expanded}
          onToggle={toggleExpanded}
          authHeader={authHeader}
          humanAgentId={humanAgentId}
          pollSeq={pollSeq}
        />
        <JobSection
          sectionKey="inline"
          jobs={grouped.inline}
          expanded={expanded}
          onToggle={toggleExpanded}
          authHeader={authHeader}
          humanAgentId={humanAgentId}
          pollSeq={pollSeq}
        />
        <JobSection
          sectionKey="done"
          jobs={grouped.done}
          expanded={expanded}
          onToggle={toggleExpanded}
          authHeader={authHeader}
          humanAgentId={humanAgentId}
          pollSeq={pollSeq}
        />
      </div>

      {firstLoadDone && todos.length === 0 && !error && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-center">
          <CheckCircle2 className="mx-auto h-5 w-5 text-green-300" />
          <p className="mt-2 text-sm text-white/50">No visible jobs.</p>
        </div>
      )}
    </div>
  );
}

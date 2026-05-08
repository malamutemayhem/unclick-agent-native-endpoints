import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  GripVertical,
  Loader2,
  MessageCircle,
  MessageSquare,
  Send,
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
  done: "Completed",
};

type ManualOrder = Record<JobSectionKey, string[]>;
type CollapsibleSectionKey = Exclude<JobSectionKey, "active">;
type SectionPreferences = {
  expanded: Record<CollapsibleSectionKey, boolean>;
  visible: Record<CollapsibleSectionKey, number>;
};

const ORDER_STORAGE_KEY = "unclick_jobs_manual_order_v1";
const SECTION_PREF_STORAGE_KEY = "unclick_jobs_section_preferences_v1";
const SECTION_PAGE_SIZE = 10;
const COMPLETED_MAX_VISIBLE = 50;
const EMPTY_MANUAL_ORDER: ManualOrder = {
  active: [],
  next: [],
  inline: [],
  done: [],
};
const DEFAULT_SECTION_PREFS: SectionPreferences = {
  expanded: { next: true, inline: true, done: true },
  visible: { next: SECTION_PAGE_SIZE, inline: SECTION_PAGE_SIZE, done: SECTION_PAGE_SIZE },
};

const PRIORITY_RANK: Record<JobTodo["priority"], number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

const PRIORITY_STYLE: Record<JobTodo["priority"], string> = {
  urgent: "border-red-400/35 bg-red-500/10 text-red-200",
  high: "border-[#E2B93B]/35 bg-[#E2B93B]/10 text-[#E2B93B]",
  normal: "border-white/10 bg-white/[0.035] text-white/60",
  low: "border-white/[0.06] bg-white/[0.02] text-white/40",
};

const STATUS_STYLE: Record<JobTodo["status"], string> = {
  open: "border-white/10 bg-white/[0.035] text-white/60",
  in_progress: "border-[#E2B93B]/35 bg-[#E2B93B]/10 text-[#E2B93B]",
  done: "border-green-400/25 bg-green-400/10 text-green-300",
  dropped: "border-white/[0.06] bg-white/[0.02] text-white/35",
};

const ACTION_BUTTONS = {
  stale: ["Push workers", "Talk to AI agent", "Escalate"],
  unowned: ["Claim / assign", "Push workers", "Drop priority"],
} as const;

const STAGES = ["Brief", "Build", "Proof", "Review", "Ship"] as const;

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
  const raw = todo.assigned_to_agent_id?.trim();
  if (!raw) return "Unassigned";
  const known: Record<string, string> = {
    master: "Coordinator",
    "chatgpt-codex-worker2": "Codex Worker 2",
    "chatgpt-codex-runner-fix": "Runner Fix",
    "codex-tether-seat": "Codex Tether",
    "claude-cowork-pc": "Claude Cowork",
    tester: "Tester",
    watcher: "Watcher",
  };
  if (known[raw]) return known[raw];
  return raw
    .replace(/^chatgpt[-_]/, "")
    .replace(/^codex[-_]/, "")
    .replace(/^claude[-_]/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .replace(/\bAi\b/g, "AI");
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

function activeStageCount(todo: JobTodo): number {
  if (todo.status === "done") return STAGES.length;
  if (todo.status === "in_progress") return 2;
  if (todo.assigned_to_agent_id) return 1;
  return 1;
}

function StageStrip({ todo }: { todo: JobTodo }) {
  const active = activeStageCount(todo);
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-5 gap-px" aria-label="Assembly line progress">
        {STAGES.map((stage, index) => (
          <span
            key={stage}
            title={stage}
            className={`h-1.5 rounded-[2px] ${
              index < active
                ? todo.status === "done"
                  ? "bg-green-400"
                  : "bg-[#61C1C4]"
                : "bg-white/[0.08]"
            }`}
          />
        ))}
      </div>
      <div className="grid grid-cols-5 gap-px text-[9px] uppercase tracking-wide text-white/30">
        {STAGES.map((stage) => (
          <span key={stage}>{stage}</span>
        ))}
      </div>
    </div>
  );
}

function ownerEmoji(todo: JobTodo): string | null {
  const raw = todo.assigned_to_agent_id?.trim();
  if (!raw) return null;
  const known: Record<string, string> = {
    master: "🧭",
    "chatgpt-codex-worker2": "🛠️",
    "chatgpt-codex-runner-fix": "♻️",
    "codex-tether-seat": "🛰️",
    "claude-cowork-pc": "🧭",
    tester: "🧪",
    watcher: "👁️",
  };
  if (known[raw]) return known[raw];
  if (/review|gatekeeper|safety/i.test(raw)) return "🛡️";
  if (/test|qa|proof/i.test(raw)) return "🧪";
  if (/builder|forge|build/i.test(raw)) return "🛠️";
  if (/watch|heartbeat|qc/i.test(raw)) return "👁️";
  if (/courier|messenger|relay|push/i.test(raw)) return "📣";
  if (/research/i.test(raw)) return "🔬";
  if (/plan/i.test(raw)) return "📋";
  return null;
}

function sourceLabel(todo: JobTodo): string {
  return todo.source_idea_id ? "Idea" : "Todo";
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

function attentionCopy(todo: JobTodo): { message: string; actions: readonly string[] } {
  if (isStaleActive(todo)) {
    return {
      message: "Active job has not moved recently.",
      actions: ACTION_BUTTONS.stale,
    };
  }
  return {
    message: "Urgent job has no owner.",
    actions: ACTION_BUTTONS.unowned,
  };
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

function loadManualOrder(): ManualOrder {
  if (typeof window === "undefined") return EMPTY_MANUAL_ORDER;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ORDER_STORAGE_KEY) ?? "{}") as Partial<ManualOrder>;
    return {
      active: Array.isArray(parsed.active) ? parsed.active : [],
      next: Array.isArray(parsed.next) ? parsed.next : [],
      inline: Array.isArray(parsed.inline) ? parsed.inline : [],
      done: Array.isArray(parsed.done) ? parsed.done : [],
    };
  } catch {
    return EMPTY_MANUAL_ORDER;
  }
}

function loadSectionPreferences(): SectionPreferences {
  if (typeof window === "undefined") return DEFAULT_SECTION_PREFS;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SECTION_PREF_STORAGE_KEY) ?? "{}") as Partial<SectionPreferences>;
    return {
      expanded: {
        next: typeof parsed.expanded?.next === "boolean" ? parsed.expanded.next : true,
        inline: typeof parsed.expanded?.inline === "boolean" ? parsed.expanded.inline : true,
        done: typeof parsed.expanded?.done === "boolean" ? parsed.expanded.done : true,
      },
      visible: {
        next: Number.isFinite(parsed.visible?.next) ? Number(parsed.visible?.next) : SECTION_PAGE_SIZE,
        inline: Number.isFinite(parsed.visible?.inline) ? Number(parsed.visible?.inline) : SECTION_PAGE_SIZE,
        done: Number.isFinite(parsed.visible?.done) ? Math.min(Number(parsed.visible?.done), COMPLETED_MAX_VISIBLE) : SECTION_PAGE_SIZE,
      },
    };
  } catch {
    return DEFAULT_SECTION_PREFS;
  }
}

function applyManualOrder(jobs: JobTodo[], order: string[]): JobTodo[] {
  if (order.length === 0) return jobs;
  const byId = new Map(jobs.map((job) => [job.id, job]));
  const ordered = order
    .map((id) => byId.get(id))
    .filter((job): job is JobTodo => Boolean(job));
  const orderedIds = new Set(ordered.map((job) => job.id));
  return [...ordered, ...jobs.filter((job) => !orderedIds.has(job.id))];
}

function JobRow({
  todo,
  expanded,
  onToggle,
  authHeader,
  humanAgentId,
  pollSeq,
  onDragStart,
  onDragEnd,
  onDrop,
}: {
  todo: JobTodo;
  expanded: boolean;
  onToggle: () => void;
  authHeader: Record<string, string>;
  humanAgentId: string | null;
  pollSeq: number;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (id: string) => void;
}) {
  const attention = needsAttention(todo);
  const progress = progressFor(todo);
  const description = todo.description?.trim();
  const [showDetails, setShowDetails] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const rawOwner = todo.assigned_to_agent_id?.trim() || "unassigned";
  const alert = attention ? attentionCopy(todo) : null;
  const emoji = ownerEmoji(todo);

  return (
    <li
      className="border-b border-white/[0.05] last:border-b-0"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        onDragStart(todo.id);
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(todo.id);
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full space-y-2 px-3 py-2.5 text-left text-xs transition-colors hover:bg-white/[0.03]"
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 items-start gap-2">
          <GripVertical
            className="mt-1 h-3.5 w-3.5 shrink-0 cursor-grab text-white/25 hover:text-white/45"
            aria-hidden="true"
          />
          {expanded ? (
            <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/40" />
          ) : (
            <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/40" />
          )}
          <div className="min-w-0">
            <p
              className={`text-sm font-medium leading-5 ${todo.status === "done" ? "text-white/35 line-through" : "text-white/85"}`}
              title={todo.title}
            >
              {todo.title}
            </p>
          </div>
        </div>

        <div className="ml-9 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span
            className={`inline-flex items-center rounded-[6px] border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLE[todo.status]}`}
          >
            {statusLabel(todo.status)}
          </span>
          <span
            className={`inline-flex items-center rounded-[6px] border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_STYLE[todo.priority]}`}
          >
            {todo.priority}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-white/45">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] bg-white/[0.04] text-[11px]">
              {emoji ?? "AI"}
            </span>
            <span className="max-w-[180px] truncate" title={ownerLabel(todo)}>
              {ownerLabel(todo)}
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-white/45">
            <span
              className={`h-1.5 w-1.5 rounded-full ${isStaleActive(todo) ? "bg-red-300" : todo.status === "done" ? "bg-green-300" : "bg-green-400"}`}
            />
            {todo.status === "done" ? "shipped" : isStaleActive(todo) ? "stale" : "live"}
          </span>
          <span className="min-w-[190px] space-y-1 text-[11px] font-medium text-white/55">
            <span>{progress}%</span>
            <StageStrip todo={todo} />
          </span>
          <span className="flex items-center gap-1 text-[11px] text-white/45">
            <MessageSquare className="h-3 w-3" />
            {todo.comment_count ?? 0}
          </span>
          <span className="text-[11px] text-white/35">Updated {relativeTime(todo.updated_at)}</span>
        </div>
      </button>

      {alert && (
        <div className="mx-3 mb-3 flex flex-wrap items-center gap-2 rounded-md border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="mr-2">{alert.message}</span>
          {alert.actions.map((action) => (
            <button
              key={action}
              type="button"
              className="inline-flex items-center gap-1 rounded-[5px] border border-red-300/20 bg-black/20 px-2 py-1 text-[11px] text-red-100 transition-colors hover:bg-red-400/10"
              title="Fallback action placeholder. Autopilot should normally resolve this without a manual click."
            >
              {action === "Talk to AI agent" ? <MessageCircle className="h-3 w-3" /> : <Send className="h-3 w-3" />}
              {action}
            </button>
          ))}
        </div>
      )}

      {expanded && (
        <div className="mx-3 mb-3 space-y-3 rounded-md border border-white/[0.06] bg-black/20 p-3">
          <div className="grid gap-3 text-xs text-white/50 sm:grid-cols-4">
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-white/30">Created</span>
              <span>{relativeTime(todo.created_at)}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-white/30">Worker</span>
              <span title={rawOwner}>{ownerLabel(todo)}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-white/30">Source</span>
              <span title="Where the job came from. Todo means it started as a direct work item. Idea means it was promoted from an idea.">
                {sourceLabel(todo)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-white/30">Pipeline</span>
              <StageStrip todo={todo} />
            </div>
          </div>

          <div className="rounded-md border border-white/[0.05] bg-white/[0.02] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-white/75">
                <FileText className="h-3.5 w-3.5 text-[#61C1C4]" />
                Job brief
              </div>
              <button
                type="button"
                onClick={() => setShowDetails((value) => !value)}
                className="text-[11px] text-[#61C1C4]/80 hover:text-[#61C1C4]"
              >
                {showDetails ? "See less" : "... See more"}
              </button>
            </div>
            {description ? (
              <p className={`mt-2 whitespace-pre-wrap text-xs leading-5 text-white/60 ${showDetails ? "" : "max-h-20 overflow-hidden"}`}>
                {description}
              </p>
            ) : (
              <p className="mt-2 text-xs italic text-white/35">No description yet.</p>
            )}
          </div>

          <div className="rounded-md border border-white/[0.05] bg-white/[0.02] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-white/75">
                <BookOpen className="h-3.5 w-3.5 text-[#E2B93B]" />
                Proof and comments ({todo.comment_count ?? 0})
              </div>
              <button
                type="button"
                onClick={() => setShowComments((value) => !value)}
                className="rounded-md border border-white/[0.08] px-2 py-1 text-[11px] text-white/55 hover:bg-white/[0.05]"
              >
                {showComments ? "Hide comments" : "Show comments"}
              </button>
            </div>
            {showComments ? (
              <div className="mt-3">
                <Comments
                  authHeader={authHeader}
                  humanAgentId={humanAgentId}
                  targetKind="todo"
                  targetId={todo.id}
                  pollSeq={pollSeq}
                />
              </div>
            ) : (
              <p className="mt-2 text-xs text-white/35">
                Worker receipts stay folded here so the page remains scannable.
              </p>
            )}
          </div>
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
  onMoveJob,
  sectionExpanded,
  visibleCount,
  onToggleSection,
  onShowMore,
}: {
  sectionKey: JobSectionKey;
  jobs: JobTodo[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
  authHeader: Record<string, string>;
  humanAgentId: string | null;
  pollSeq: number;
  onMoveJob: (sectionKey: JobSectionKey, sourceId: string, targetId: string) => void;
  sectionExpanded?: boolean;
  visibleCount?: number;
  onToggleSection?: () => void;
  onShowMore?: () => void;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const isCollapsible = sectionKey !== "active";
  const open = !isCollapsible || sectionExpanded !== false;
  const maxVisible = sectionKey === "done" ? COMPLETED_MAX_VISIBLE : jobs.length;
  const cappedJobs = sectionKey === "done" ? jobs.slice(0, COMPLETED_MAX_VISIBLE) : jobs;
  const displayCount = isCollapsible ? Math.min(visibleCount ?? SECTION_PAGE_SIZE, cappedJobs.length) : cappedJobs.length;
  const visibleJobs = cappedJobs.slice(0, displayCount);
  const canShowMore = isCollapsible && displayCount < cappedJobs.length;

  return (
    <section className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#111]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
        {isCollapsible ? (
          <button
            type="button"
            onClick={onToggleSection}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/45 hover:text-white/70"
            aria-expanded={open}
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {SECTION_LABELS[sectionKey]}
          </button>
        ) : (
          <h2 className="text-xs font-semibold uppercase tracking-wide text-white/45">
            {SECTION_LABELS[sectionKey]}
          </h2>
        )}
        <span className="text-xs text-white/35">
          {isCollapsible && open ? `${visibleJobs.length}/${sectionKey === "done" ? Math.min(jobs.length, COMPLETED_MAX_VISIBLE) : jobs.length}` : jobs.length}
        </span>
      </div>
      {!open ? null : jobs.length === 0 ? (
        <p className="px-3 py-4 text-sm italic text-white/30">Empty</p>
      ) : (
        <ul>
          <li className="hidden border-b border-white/[0.05] bg-black/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/30 md:grid md:grid-cols-[minmax(280px,1fr)_minmax(520px,1.2fr)]">
            <span>Job</span>
            <span>Markers, progress, notes</span>
          </li>
          {visibleJobs.map((todo) => (
            <JobRow
              key={todo.id}
              todo={todo}
              expanded={expanded.has(todo.id)}
              onToggle={() => onToggle(todo.id)}
              authHeader={authHeader}
              humanAgentId={humanAgentId}
              pollSeq={pollSeq}
              onDragStart={setDraggedId}
              onDragEnd={() => setDraggedId(null)}
              onDrop={(targetId) => {
                if (draggedId && draggedId !== targetId) {
                  onMoveJob(sectionKey, draggedId, targetId);
                }
                setDraggedId(null);
              }}
            />
          ))}
          {canShowMore && (
            <li className="px-3 py-3">
              <button
                type="button"
                onClick={onShowMore}
                className="text-xs text-[#61C1C4]/80 hover:text-[#61C1C4]"
              >
                Show more
              </button>
            </li>
          )}
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
  const [manualOrder, setManualOrder] = useState<ManualOrder>(() => loadManualOrder());
  const [sectionPrefs, setSectionPrefs] = useState<SectionPreferences>(() => loadSectionPreferences());

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(manualOrder));
  }, [manualOrder]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SECTION_PREF_STORAGE_KEY, JSON.stringify(sectionPrefs));
  }, [sectionPrefs]);

  const grouped = useMemo(() => groupJobs(todos), [todos]);
  const orderedGrouped = useMemo(
    () => ({
      active: applyManualOrder(grouped.active, manualOrder.active),
      next: applyManualOrder(grouped.next, manualOrder.next),
      inline: applyManualOrder(grouped.inline, manualOrder.inline),
      done: applyManualOrder(grouped.done, manualOrder.done),
    }),
    [grouped, manualOrder],
  );
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

  const moveJob = (sectionKey: JobSectionKey, sourceId: string, targetId: string) => {
    setManualOrder((prev) => {
      const visibleIds = grouped[sectionKey].map((job) => job.id);
      const visible = new Set(visibleIds);
      const current = [
        ...prev[sectionKey].filter((id) => visible.has(id)),
        ...visibleIds.filter((id) => !prev[sectionKey].includes(id)),
      ];
      const withoutSource = current.filter((id) => id !== sourceId);
      const targetIndex = Math.max(0, withoutSource.indexOf(targetId));
      withoutSource.splice(targetIndex, 0, sourceId);
      return {
        ...prev,
        [sectionKey]: withoutSource,
      };
    });
  };

  const toggleSection = (sectionKey: CollapsibleSectionKey) => {
    setSectionPrefs((prev) => ({
      ...prev,
      expanded: {
        ...prev.expanded,
        [sectionKey]: !prev.expanded[sectionKey],
      },
    }));
  };

  const showMore = (sectionKey: CollapsibleSectionKey) => {
    setSectionPrefs((prev) => ({
      ...prev,
      visible: {
        ...prev.visible,
        [sectionKey]: sectionKey === "done"
          ? Math.min(prev.visible[sectionKey] + SECTION_PAGE_SIZE, COMPLETED_MAX_VISIBLE)
          : prev.visible[sectionKey] + SECTION_PAGE_SIZE,
      },
    }));
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
          jobs={orderedGrouped.active}
          expanded={expanded}
          onToggle={toggleExpanded}
          authHeader={authHeader}
          humanAgentId={humanAgentId}
          pollSeq={pollSeq}
          onMoveJob={moveJob}
        />
        <JobSection
          sectionKey="next"
          jobs={orderedGrouped.next}
          expanded={expanded}
          onToggle={toggleExpanded}
          authHeader={authHeader}
          humanAgentId={humanAgentId}
          pollSeq={pollSeq}
          onMoveJob={moveJob}
          sectionExpanded={sectionPrefs.expanded.next}
          visibleCount={sectionPrefs.visible.next}
          onToggleSection={() => toggleSection("next")}
          onShowMore={() => showMore("next")}
        />
        <JobSection
          sectionKey="inline"
          jobs={orderedGrouped.inline}
          expanded={expanded}
          onToggle={toggleExpanded}
          authHeader={authHeader}
          humanAgentId={humanAgentId}
          pollSeq={pollSeq}
          onMoveJob={moveJob}
          sectionExpanded={sectionPrefs.expanded.inline}
          visibleCount={sectionPrefs.visible.inline}
          onToggleSection={() => toggleSection("inline")}
          onShowMore={() => showMore("inline")}
        />
        <JobSection
          sectionKey="done"
          jobs={orderedGrouped.done}
          expanded={expanded}
          onToggle={toggleExpanded}
          authHeader={authHeader}
          humanAgentId={humanAgentId}
          pollSeq={pollSeq}
          onMoveJob={moveJob}
          sectionExpanded={sectionPrefs.expanded.done}
          visibleCount={sectionPrefs.visible.done}
          onToggleSection={() => toggleSection("done")}
          onShowMore={() => showMore("done")}
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

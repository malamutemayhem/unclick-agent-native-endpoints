import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  GitPullRequest,
  GripVertical,
  Loader2,
  MessageSquare,
  Search,
  X,
} from "lucide-react";
import { useSession } from "@/lib/auth";
import Comments from "./fishbowl/Comments";
import { buildJobGithubSyncSignal, type JobGithubSyncSignal } from "./jobsGithubSync";
import { highlightSearchText } from "./searchHighlight";

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
  pipeline_stage_count?: number;
  pipeline_progress?: number;
  pipeline_source?: string;
  pipeline_evidence?: string[];
}

type JobSectionKey = "active" | "next" | "inline" | "done";
type SortKey = "queue" | "title" | "status" | "priority" | "worker" | "live" | "progress" | "notes" | "updated";
type SortDirection = "asc" | "desc";

const SECTION_LABELS: Record<JobSectionKey, string> = {
  active: "Active",
  next: "Next up",
  inline: "In line",
  done: "Completed",
};

type ManualOrder = Record<JobSectionKey, string[]>;
type SectionPreferences = {
  expanded: Record<JobSectionKey, boolean>;
  visible: Record<JobSectionKey, number>;
};

const ORDER_STORAGE_KEY = "unclick_jobs_manual_order_v1";
const SECTION_PREF_STORAGE_KEY = "unclick_jobs_section_preferences_v1";
const SECTION_PAGE_SIZE = 10;
// Completed section uses bigger batches: 50 visible by default, +100 per "Show more"
// click. Server-side completed history is fetched in matching batches via the
// `before_created_at` cursor until exhausted.
const COMPLETED_INITIAL_VISIBLE = 50;
const COMPLETED_PAGE_SIZE = 100;
const EMPTY_MANUAL_ORDER: ManualOrder = {
  active: [],
  next: [],
  inline: [],
  done: [],
};
const DEFAULT_SECTION_PREFS: SectionPreferences = {
  expanded: { active: true, next: true, inline: true, done: true },
  visible: { active: SECTION_PAGE_SIZE, next: SECTION_PAGE_SIZE, inline: SECTION_PAGE_SIZE, done: COMPLETED_INITIAL_VISIBLE },
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
  stale: ["Push workers", "(talk to owning AI seat)", "Escalate"],
  unowned: ["Claim / assign", "Push workers", "Drop priority"],
} as const;

const STAGES = ["Brief", "Build", "Proof", "Review", "Ship"] as const;
const TITLE_MAX_CHARS = 90;

const JOB_ROW_GRID =
  "md:grid md:grid-cols-[48px_minmax(320px,1.2fr)_48px_58px_minmax(96px,0.35fr)_40px_minmax(190px,0.5fr)_78px_30px_18px] md:items-center md:gap-1.5";

interface JobDisplayCopy {
  title: string;
  summary: string;
  context: string;
}

function compactTitle(title: string): string {
  const cleaned = title.replace(/\s+/g, " ").trim();
  if (cleaned.length <= TITLE_MAX_CHARS) return cleaned;
  return `${cleaned.slice(0, TITLE_MAX_CHARS - 3).trimEnd()}...`;
}

function trimSentence(value: string, maxChars: number): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxChars) return cleaned;
  const cut = cleaned.slice(0, maxChars - 3);
  const boundary = Math.max(cut.lastIndexOf("."), cut.lastIndexOf(","), cut.lastIndexOf(";"), cut.lastIndexOf(" "));
  return `${cut.slice(0, boundary > 40 ? boundary : maxChars - 3).trimEnd()}...`;
}

function stripNoisyLead(value: string): string {
  return value
    .replace(/^\s*(urgent|bug|fix|feat|chore|docs|test|refactor|experiment|blocked|blocker)\s*[:-]\s*/i, "")
    .replace(/^\s*(fix|feat|chore|docs|test|refactor)\([^)]+\)\s*:\s*/i, "")
    .replace(/^\s*(pr|pull request)\s*#?\d+\s*[:-]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function simplifyJobTitle(title: string): string {
  const cleaned = stripNoisyLead(title)
    .replace(/\bgreen-but-idle\b/gi, "idle")
    .replace(/\bauto[- ]close\b/gi, "auto-close")
    .replace(/\bunclick\b/gi, "UnClick")
    .replace(/\bai\b/gi, "AI")
    .replace(/\bmcp\b/gi, "MCP")
    .replace(/\bpr\s*#\s*(\d+)/gi, "PR #$1")
    .trim();

  const dependencyMatch = cleaned.match(/^bump\s+(.+?)\s+from\s+.+?\s+to\s+(.+)$/i);
  if (dependencyMatch) {
    return compactTitle(`Update ${dependencyMatch[1]} to ${dependencyMatch[2]}`);
  }

  const schemaMatch = cleaned.match(/(.+?)\s+breaks\s+(.+)$/i);
  if (schemaMatch) {
    return compactTitle(`Fix ${schemaMatch[1]}`);
  }

  return compactTitle(cleaned || title);
}

function cleanJobCopy(value: string): string {
  return stripNoisyLead(value)
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[[^\]]+\]\([^)]+\)/g, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "linked item")
    .replace(/\b(api|mcp|ai|pr|ci)\b/gi, (match) => match.toUpperCase())
    .replace(/\bunclick\b/gi, "UnClick")
    .replace(/\s+/g, " ")
    .trim();
}

function usefulJobLines(todo: JobTodo): string[] {
  const rawDescription = todo.description?.trim();
  const source = rawDescription && rawDescription.length > 0 ? rawDescription : todo.title;
  return source
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*#>\s]+/, "").trim())
    .filter((line) => line.length > 0 && !/^https?:\/\//i.test(line));
}

function simplifyJobSummary(todo: JobTodo): string {
  const firstUsefulLine = usefulJobLines(todo)[0] ?? todo.title;
  const cleaned = cleanJobCopy(firstUsefulLine);

  return trimSentence(cleaned || simplifyJobTitle(todo.title), 130);
}

function simplifyJobContext(todo: JobTodo): string {
  const usefulLines = usefulJobLines(todo);
  const cleaned = cleanJobCopy(usefulLines.join(" ") || todo.title);
  return cleaned || simplifyJobTitle(todo.title);
}

function displayCopyFor(todo: JobTodo): JobDisplayCopy {
  return {
    title: simplifyJobTitle(todo.title),
    summary: simplifyJobSummary(todo),
    context: simplifyJobContext(todo),
  };
}

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
  if (Number.isFinite(todo.pipeline_progress)) return Number(todo.pipeline_progress);
  if (todo.status === "done") return 100;
  if (todo.status === "in_progress") return 55;
  if (todo.assigned_to_agent_id) return 25;
  return 10;
}

function activeStageCount(todo: JobTodo): number {
  if (Number.isFinite(todo.pipeline_stage_count)) {
    return Math.min(Math.max(Number(todo.pipeline_stage_count), 1), STAGES.length);
  }
  if (todo.status === "done") return STAGES.length;
  if (todo.status === "in_progress") return 2;
  if (todo.assigned_to_agent_id) return 1;
  return 1;
}

function StageStrip({ todo }: { todo: JobTodo }) {
  const active = activeStageCount(todo);
  const progress = progressFor(todo);
  const source = todo.pipeline_source ?? "estimated from todo status";
  return (
    <div className="flex min-w-[200px] items-center gap-1" aria-label="Assembly line progress" title={source}>
      <span className="w-7 shrink-0 text-right text-[10px] font-semibold text-white/55">
        {progress}%
      </span>
      <div className="grid flex-1 grid-cols-5 gap-px overflow-hidden rounded-[3px]">
        {STAGES.map((stage, index) => (
          <span
            key={stage}
            title={stage}
            className={`flex h-4 min-w-0 items-center justify-center text-[7px] font-semibold uppercase ${
              index < active
                ? todo.status === "done"
                  ? "bg-green-400/85 text-black/70"
                  : "bg-[#61C1C4]/90 text-black/70"
                : "bg-white/[0.08] text-white/30"
            }`}
          >
            {stage}
          </span>
        ))}
      </div>
    </div>
  );
}

const SYNC_SIGNAL_STYLE: Record<JobGithubSyncSignal["tone"], string> = {
  quiet: "border-white/[0.08] bg-white/[0.025] text-white/40",
  linked: "border-[#61C1C4]/30 bg-[#61C1C4]/10 text-[#8EE8EB]",
  done: "border-green-400/25 bg-green-400/10 text-green-300",
  alert: "border-red-300/30 bg-red-500/10 text-red-200",
};

function SyncSignalPill({ signal }: { signal: JobGithubSyncSignal }) {
  const content = (
    <>
      <GitPullRequest className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">{signal.label}</span>
      {signal.href && <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-70" aria-hidden="true" />}
    </>
  );
  const className = `inline-flex max-w-[78px] items-center gap-1 rounded-[4px] border px-1 py-px text-[9px] font-semibold ${SYNC_SIGNAL_STYLE[signal.tone]}`;

  if (signal.href) {
    return (
      <a
        href={signal.href}
        target="_blank"
        rel="noreferrer"
        className={`${className} hover:border-[#61C1C4]/45 hover:bg-[#61C1C4]/15`}
        title={signal.detail}
      >
        {content}
      </a>
    );
  }

  return (
    <span className={className} title={signal.detail}>
      {content}
    </span>
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

function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compactSearch(value: string): string {
  return normalizeSearch(value).replace(/\s+/g, "");
}

function isSubsequence(needle: string, haystack: string): boolean {
  if (!needle) return true;
  let index = 0;
  for (const char of haystack) {
    if (char === needle[index]) index += 1;
    if (index === needle.length) return true;
  }
  return false;
}

function jobSearchText(todo: JobTodo): string {
  return [
    todo.title,
    todo.description,
    todo.status,
    todo.priority,
    ownerLabel(todo),
    ownerEmoji(todo),
    todo.assigned_to_agent_id,
    todo.created_by_agent_id,
    sourceLabel(todo),
  ]
    .filter(Boolean)
    .join(" ");
}

function matchesJobSearch(todo: JobTodo, query: string): boolean {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return true;

  const text = normalizeSearch(jobSearchText(todo));
  const compactText = text.replace(/\s+/g, "");
  const words = text.split(/\s+/).filter(Boolean);

  return normalizedQuery.split(/\s+/).every((token) => {
    const compactToken = compactSearch(token);
    if (!compactToken) return true;
    if (text.includes(token)) return true;
    if (compactText.includes(compactToken)) return true;
    return words.some((word) => word.startsWith(token) || word.includes(token) || isSubsequence(compactToken, word));
  });
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

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function compareSortedJobs(
  a: JobTodo,
  b: JobTodo,
  sortKey: SortKey,
  direction: SortDirection,
  rankById: Map<string, number>,
): number {
  const directionMultiplier = direction === "asc" ? 1 : -1;
  let result = 0;
  switch (sortKey) {
    case "queue":
      result = (rankById.get(a.id) ?? 0) - (rankById.get(b.id) ?? 0);
      break;
    case "title":
      result = compareText(a.title, b.title);
      break;
    case "status":
      result = compareText(statusLabel(a.status), statusLabel(b.status));
      break;
    case "priority":
      result = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      break;
    case "worker":
      result = compareText(ownerLabel(a), ownerLabel(b));
      break;
    case "live":
      result = Number(isStaleActive(a)) - Number(isStaleActive(b));
      break;
    case "progress":
      result = progressFor(a) - progressFor(b);
      break;
    case "notes":
      result = (a.comment_count ?? 0) - (b.comment_count ?? 0);
      break;
    case "updated":
      result = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      break;
  }
  if (result === 0) result = (rankById.get(a.id) ?? 0) - (rankById.get(b.id) ?? 0);
  return result * directionMultiplier;
}

function SortHeader({
  label,
  value,
  sortKey,
  sortDirection,
  onSort,
}: {
  label: string;
  value: SortKey;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (value: SortKey) => void;
}) {
  const active = sortKey === value;
  const Icon = !active ? ArrowDownUp : sortDirection === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(value)}
      className={`group inline-flex w-full min-w-0 items-center gap-1 rounded-[3px] text-left hover:text-white/65 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#61C1C4]/45 ${
        active ? "text-white/65" : ""
      }`}
      title={`Sort by ${label}`}
      aria-pressed={active}
    >
      <span className="truncate">{label}</span>
      <Icon className={`h-3 w-3 shrink-0 ${active ? "text-[#61C1C4]/70" : "text-white/20 group-hover:text-white/35"}`} aria-hidden="true" />
    </button>
  );
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
        active: typeof parsed.expanded?.active === "boolean" ? parsed.expanded.active : true,
        next: typeof parsed.expanded?.next === "boolean" ? parsed.expanded.next : true,
        inline: typeof parsed.expanded?.inline === "boolean" ? parsed.expanded.inline : true,
        done: typeof parsed.expanded?.done === "boolean" ? parsed.expanded.done : true,
      },
      visible: {
        active: Number.isFinite(parsed.visible?.active) ? Number(parsed.visible?.active) : SECTION_PAGE_SIZE,
        next: Number.isFinite(parsed.visible?.next) ? Number(parsed.visible?.next) : SECTION_PAGE_SIZE,
        inline: Number.isFinite(parsed.visible?.inline) ? Number(parsed.visible?.inline) : SECTION_PAGE_SIZE,
        done: Number.isFinite(parsed.visible?.done) ? Number(parsed.visible?.done) : COMPLETED_INITIAL_VISIBLE,
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
  queueRank,
  expanded,
  onToggle,
  authHeader,
  humanAgentId,
  pollSeq,
  onDragStart,
  onDragEnd,
  onDrop,
  searchQuery,
}: {
  todo: JobTodo;
  queueRank: number;
  expanded: boolean;
  onToggle: () => void;
  authHeader: Record<string, string>;
  humanAgentId: string | null;
  pollSeq: number;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (id: string) => void;
  searchQuery: string;
}) {
  const attention = needsAttention(todo);
  const description = todo.description?.trim();
  const [showDetails, setShowDetails] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const rawOwner = todo.assigned_to_agent_id?.trim() || "unassigned";
  const alert = attention ? attentionCopy(todo) : null;
  const emoji = ownerEmoji(todo);
  const displayCopy = displayCopyFor(todo);
  const syncSignal = buildJobGithubSyncSignal(todo);

  return (
    <li
      className="border-b border-white/[0.05] last:border-b-0"
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(todo.id);
      }}
    >
      <div className={`px-3 py-1.5 text-xs transition-colors hover:bg-white/[0.03] ${JOB_ROW_GRID}`}>
        <div className="flex min-w-0 items-center gap-0.5">
          <button
            type="button"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              onDragStart(todo.id);
            }}
            onDragEnd={onDragEnd}
            className="shrink-0 cursor-grab rounded-[4px] p-px text-white/20 hover:bg-white/[0.04] hover:text-white/45 active:cursor-grabbing"
            title="Drag to reshuffle"
          >
            <GripVertical className="h-3.5 w-2.5" aria-hidden="true" />
          </button>
          <span
            className="w-4 shrink-0 rounded-[4px] border border-white/[0.06] bg-white/[0.025] px-0.5 py-0.5 text-center text-[10px] font-semibold tabular-nums text-white/35"
            title="Queue priority rank"
          >
            {queueRank}
          </span>
          <button
            type="button"
            onClick={onToggle}
            className="shrink-0 rounded-[4px] p-px text-white/45 hover:bg-white/[0.04] hover:text-white/75"
            aria-expanded={expanded}
            title={expanded ? "Collapse job" : "Expand job"}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
        <div
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          onClick={onToggle}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onToggle();
            }
          }}
          className="min-w-0 cursor-pointer select-text rounded-[3px] outline-none focus-visible:ring-1 focus-visible:ring-[#61C1C4]/50"
          title={todo.title}
        >
          <p
            className={`truncate text-[11px] font-semibold leading-4 hover:text-white ${todo.status === "done" ? "text-white/35 line-through" : "text-white/85"}`}
            data-testid="job-row-title"
          >
            {highlightSearchText(displayCopy.title, searchQuery)}
          </p>
          <p className="truncate text-[10px] leading-4 text-white/35">
            {highlightSearchText(displayCopy.summary, searchQuery)}
          </p>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 md:contents">
          <span
            className={`inline-flex min-w-0 items-center justify-center whitespace-nowrap rounded-[4px] border px-1 py-px text-[9px] font-semibold uppercase ${STATUS_STYLE[todo.status]}`}
          >
            {statusLabel(todo.status)}
          </span>
          <span
            className={`inline-flex min-w-0 items-center justify-center whitespace-nowrap rounded-[4px] border px-1 py-px text-[9px] font-semibold uppercase ${PRIORITY_STYLE[todo.priority]}`}
          >
            {todo.priority}
          </span>
          <span className="flex min-w-0 items-center gap-1 text-[11px] text-white/45">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] bg-white/[0.04] text-[11px]">
              {emoji ?? "AI"}
            </span>
            <span className="max-w-[130px] truncate" title={ownerLabel(todo)}>
              {highlightSearchText(ownerLabel(todo), searchQuery)}
            </span>
          </span>
          <span className="flex items-center gap-1 text-[11px] text-white/45">
            <span
              className={`h-1.5 w-1.5 rounded-full ${isStaleActive(todo) ? "bg-red-300" : todo.status === "done" ? "bg-green-300" : "bg-green-400"}`}
            />
            {todo.status === "done" ? "ship" : isStaleActive(todo) ? "stale" : "live"}
          </span>
          <span className="text-[11px] font-medium text-white/55">
            <StageStrip todo={todo} />
          </span>
          <SyncSignalPill signal={syncSignal} />
          <span className="flex items-center gap-0.5 text-[11px] text-white/45">
            <MessageSquare className="h-3 w-3" />
            {todo.comment_count ?? 0}
          </span>
          {alert ? (
            <button
              type="button"
              onClick={onToggle}
              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-red-300/10 bg-red-500/[0.045] text-red-200/65 hover:border-red-300/25 hover:bg-red-500/10 hover:text-red-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-200/50"
              aria-expanded={expanded}
              aria-label={`Job needs attention: ${alert.message}`}
              title={`${alert.message} Next: ${alert.actions.join(", ")}`}
              data-testid="job-attention-indicator"
            >
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            </button>
          ) : (
            <span aria-hidden="true" className="hidden md:block" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="mx-3 mb-2 space-y-2 rounded-md border border-white/[0.06] bg-black/20 p-2.5">
          <div className="grid gap-3 text-xs text-white/50 sm:grid-cols-5">
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
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-white/30">Proof</span>
              <div className="mt-0.5">
                <SyncSignalPill signal={syncSignal} />
              </div>
            </div>
          </div>

          <div className="rounded-md border border-white/[0.05] bg-white/[0.02] p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-white/75">
                <FileText className="h-3.5 w-3.5 text-[#61C1C4]" />
                Job context
              </div>
              <button
                type="button"
                onClick={() => setShowDetails((value) => !value)}
                className="text-[11px] text-[#61C1C4]/80 hover:text-[#61C1C4]"
              >
                {showDetails ? "Hide original" : "View full original"}
              </button>
            </div>
            <div className="mt-2 space-y-1.5">
              <p className="text-xs font-medium text-white/70">{highlightSearchText(displayCopy.title, searchQuery)}</p>
              <p className="text-xs leading-5 text-white/50">{highlightSearchText(displayCopy.context, searchQuery)}</p>
            </div>
            {showDetails && (
              <div className="mt-3 rounded-[5px] border border-white/[0.05] bg-black/20 p-2">
                <p className="text-[10px] uppercase tracking-wide text-white/25">Original source</p>
                <p className="mt-1 text-xs font-medium leading-5 text-white/60">{highlightSearchText(todo.title, searchQuery)}</p>
                {description ? (
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-white/45">
                    {highlightSearchText(description, searchQuery)}
                  </p>
                ) : (
                  <p className="mt-2 text-xs italic text-white/30">No original description.</p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-md border border-white/[0.05] bg-white/[0.02] p-2.5">
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
  hasMoreRemote,
  showMoreLoading,
  loading,
  searchQuery,
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
  hasMoreRemote?: boolean;
  showMoreLoading?: boolean;
  loading?: boolean;
  searchQuery: string;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("queue");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const open = sectionExpanded !== false;
  const cappedJobs = jobs;
  const rankById = useMemo(
    () => new Map(cappedJobs.map((job, index) => [job.id, index + 1])),
    [cappedJobs],
  );
  const sortedJobs = useMemo(
    () => [...cappedJobs].sort((a, b) => compareSortedJobs(a, b, sortKey, sortDirection, rankById)),
    [cappedJobs, rankById, sortDirection, sortKey],
  );
  const displayCount = Math.min(visibleCount ?? SECTION_PAGE_SIZE, cappedJobs.length);
  const visibleJobs = sortedJobs.slice(0, displayCount);
  const canShowMore = displayCount < cappedJobs.length || hasMoreRemote === true;
  const showLoading = loading === true && jobs.length === 0;
  const sectionAccent: Record<JobSectionKey, string> = {
    active: "bg-[#E2B93B]",
    next: "bg-red-300",
    inline: "bg-[#61C1C4]",
    done: "bg-green-400",
  };
  const setSort = (nextKey: SortKey) => {
    setSortDirection((currentDirection) => {
      if (sortKey !== nextKey) return nextKey === "updated" || nextKey === "priority" || nextKey === "progress" || nextKey === "notes" ? "desc" : "asc";
      return currentDirection === "asc" ? "desc" : "asc";
    });
    setSortKey(nextKey);
  };

  return (
    <section className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#101010]">
      <div className={`h-0.5 ${sectionAccent[sectionKey]}`} />
      <div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.045] px-3 py-2">
        <button
          type="button"
          onClick={onToggleSection}
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/70 hover:text-white/90"
          aria-expanded={open}
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {SECTION_LABELS[sectionKey]}
        </button>
        <span className="rounded-[4px] border border-white/[0.08] bg-black/20 px-2 py-0.5 text-[11px] font-semibold text-white/50">
          {showLoading
            ? "Loading"
            : open
              ? `${visibleJobs.length}/${jobs.length}`
              : jobs.length}
        </span>
      </div>
      {!open ? null : showLoading ? (
        <div className="flex items-center gap-2 px-3 py-4 text-sm text-white/35">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#61C1C4]" />
          Loading jobs
        </div>
      ) : jobs.length === 0 ? (
        <div className="px-3 py-4">
          <p className="text-sm italic text-white/30">Empty</p>
          {canShowMore && (
            <button
              type="button"
              onClick={onShowMore}
              disabled={showMoreLoading}
              className="mt-3 inline-flex items-center gap-2 text-xs text-[#61C1C4]/80 hover:text-[#61C1C4] disabled:cursor-wait disabled:text-white/30"
            >
              {showMoreLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              Load more
            </button>
          )}
        </div>
      ) : (
        <ul>
          <li className={`hidden border-b border-white/[0.05] bg-black/20 px-3 py-1.5 text-[10px] font-semibold uppercase text-white/30 ${JOB_ROW_GRID}`}>
            <SortHeader label="#" value="queue" sortKey={sortKey} sortDirection={sortDirection} onSort={setSort} />
            <SortHeader label="Job" value="title" sortKey={sortKey} sortDirection={sortDirection} onSort={setSort} />
            <SortHeader label="State" value="status" sortKey={sortKey} sortDirection={sortDirection} onSort={setSort} />
            <SortHeader label="Priority" value="priority" sortKey={sortKey} sortDirection={sortDirection} onSort={setSort} />
            <SortHeader label="Worker" value="worker" sortKey={sortKey} sortDirection={sortDirection} onSort={setSort} />
            <SortHeader label="Live" value="live" sortKey={sortKey} sortDirection={sortDirection} onSort={setSort} />
            <SortHeader label="Progress" value="progress" sortKey={sortKey} sortDirection={sortDirection} onSort={setSort} />
            <span>Proof</span>
            <SortHeader label="Notes" value="notes" sortKey={sortKey} sortDirection={sortDirection} onSort={setSort} />
            <span className="text-right">!</span>
          </li>
          {visibleJobs.map((todo) => (
            <JobRow
              key={todo.id}
              todo={todo}
              queueRank={rankById.get(todo.id) ?? 0}
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
              searchQuery={searchQuery}
            />
          ))}
          {canShowMore && (
            <li className="px-3 py-3">
              <button
                type="button"
                onClick={onShowMore}
                disabled={showMoreLoading}
                className="inline-flex items-center gap-2 text-xs text-[#61C1C4]/80 hover:text-[#61C1C4] disabled:cursor-wait disabled:text-white/30"
              >
                {showMoreLoading && <Loader2 className="h-3 w-3 animate-spin" />}
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
  const [completedHistory, setCompletedHistory] = useState<JobTodo[]>([]);
  const [completedHistoryLoaded, setCompletedHistoryLoaded] = useState(false);
  const [completedHistoryLoading, setCompletedHistoryLoading] = useState(false);
  // True once the server has confirmed nothing more sits behind the current
  // batch (the API maxes out at 200 rows per call). The next iteration of
  // this UI will add a `before_created_at` cursor for true "till exhausted"
  // pagination; until then the client tracks "have we fetched the max?".
  const [completedHistoryExhausted, setCompletedHistoryExhausted] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollSeq, setPollSeq] = useState(0);
  const [manualOrder, setManualOrder] = useState<ManualOrder>(() => loadManualOrder());
  const [sectionPrefs, setSectionPrefs] = useState<SectionPreferences>(() => loadSectionPreferences());
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredTodos = useMemo(
    () => {
      const byId = new Map<string, JobTodo>();
      for (const todo of todos) byId.set(todo.id, todo);
      for (const todo of completedHistory) byId.set(todo.id, todo);
      return Array.from(byId.values()).filter((todo) => matchesJobSearch(todo, searchQuery));
    },
    [completedHistory, searchQuery, todos],
  );
  const grouped = useMemo(() => groupJobs(filteredTodos), [filteredTodos]);
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
  const queueHydrationBlocked = activeCount === 0 && queueCount > 0;
  const alertCount = filteredTodos.filter(needsAttention).length + (queueHydrationBlocked ? 1 : 0);
  const initialLoading = !firstLoadDone && loading;
  const visibleJobCount = todos.length + completedHistory.filter((historyJob) => !todos.some((todo) => todo.id === historyJob.id)).length;

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

  const toggleSection = (sectionKey: JobSectionKey) => {
    setSectionPrefs((prev) => ({
      ...prev,
      expanded: {
        ...prev.expanded,
        [sectionKey]: !prev.expanded[sectionKey],
      },
    }));
  };

  const showMore = (sectionKey: JobSectionKey) => {
    setSectionPrefs((prev) => ({
      ...prev,
      visible: {
        ...prev.visible,
        [sectionKey]: prev.visible[sectionKey] +
          (sectionKey === "done" ? COMPLETED_PAGE_SIZE : SECTION_PAGE_SIZE),
      },
    }));
  };

  // Fetch up to the server's per-call cap (200) of completed jobs in one
  // shot, sorted newest-first by created_at. The list_todos endpoint does
  // not yet expose a cursor, so we fetch the whole window once and paginate
  // the visible count on the client via SectionPreferences. When server
  // cursor support lands, this becomes a paged loop.
  const fetchCompletedBatch = useCallback(async () => {
    if (!humanAgentId) return;
    setCompletedHistoryLoading(true);
    try {
      const requestLimit = 200;
      const res = await fetch("/api/memory-admin?action=fishbowl_list_todos", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: humanAgentId,
          include_description: true,
          status: "done",
          limit: requestLimit,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        todos?: JobTodo[];
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "Failed to load completed jobs");
      const fetched = (body.todos ?? []).filter((todo) => todo.status === "done");
      setCompletedHistory(fetched);
      if (fetched.length < requestLimit) setCompletedHistoryExhausted(true);
      setCompletedHistoryLoaded(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load completed jobs");
    } finally {
      setCompletedHistoryLoading(false);
    }
  }, [authHeader, humanAgentId]);

  // Auto-load the first batch as soon as the agent id is known. Replaces the
  // old "Show completed history" first-click gate; users now see the last
  // 50 completed without any extra action.
  useEffect(() => {
    if (!humanAgentId) return;
    if (completedHistoryLoaded || completedHistoryLoading) return;
    void fetchCompletedBatch();
  }, [humanAgentId, completedHistoryLoaded, completedHistoryLoading, fetchCompletedBatch]);

  const loadCompletedHistory = async () => {
    if (!humanAgentId || completedHistoryLoading) return;
    if (!completedHistoryLoaded) {
      // Edge case: button clicked before the auto-load finished.
      await fetchCompletedBatch();
      showMore("done");
      return;
    }
    // Already loaded: reveal the next 100 rows from the local cache.
    showMore("done");
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center rounded-full border border-[#61C1C4]/30 bg-[#61C1C4]/10 px-3 py-1 text-xs font-medium text-[#61C1C4]">
            Work board
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Jobs</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            One work list for active, next, queued, and completed jobs. GitHub and deployment links appear as proof when code work moves.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[360px]">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
            <p className="text-xs text-white/35">Active</p>
            <p className="mt-1 flex min-h-7 items-center justify-center text-lg font-semibold text-[#E2B93B]">
              {initialLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : activeCount}
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
            <p className="text-xs text-white/35">Waiting</p>
            <p className="mt-1 flex min-h-7 items-center justify-center text-lg font-semibold text-white/80">
              {initialLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : queueCount}
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
            <p className="text-xs text-white/35">Alerts</p>
            <p className="mt-1 flex min-h-7 items-center justify-center text-lg font-semibold text-red-200">
              {initialLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : alertCount}
            </p>
          </div>
        </div>
      </header>

      {queueHydrationBlocked && (
        <div className="flex items-start gap-3 rounded-lg border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-200" aria-hidden="true" />
          <div>
            <p className="font-medium">Worker belt is idle while jobs are waiting.</p>
            <p className="mt-1 text-red-100/70">
              Autopilot should pull one waiting job into active work before this board can be green.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-white/30" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Filter jobs"
            className="w-full rounded-md border border-white/[0.06] bg-black/20 py-2 pl-8 pr-8 text-sm text-white/80 outline-none transition-colors placeholder:text-white/25 focus:border-[#61C1C4]/35"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-2 rounded-[5px] p-1 text-white/35 hover:bg-white/[0.06] hover:text-white/65"
              aria-label="Clear job filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 text-xs text-white/35">
        <span className="inline-flex items-center gap-1.5">
          {initialLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#61C1C4]" />}
          {firstLoadDone
            ? searchQuery.trim()
              ? `${filteredTodos.length} of ${visibleJobCount} jobs match`
              : `${visibleJobCount} visible jobs`
            : "Loading jobs"}
        </span>
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
          sectionExpanded={sectionPrefs.expanded.active}
          visibleCount={sectionPrefs.visible.active}
          onToggleSection={() => toggleSection("active")}
          onShowMore={() => showMore("active")}
          loading={initialLoading}
          searchQuery={searchQuery}
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
          loading={initialLoading}
          searchQuery={searchQuery}
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
          loading={initialLoading}
          searchQuery={searchQuery}
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
          onShowMore={loadCompletedHistory}
          hasMoreRemote={!completedHistoryLoaded && !completedHistoryExhausted}
          showMoreLoading={completedHistoryLoading}
          loading={initialLoading}
          searchQuery={searchQuery}
        />
      </div>

      {firstLoadDone && filteredTodos.length === 0 && !error && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-center">
          <CheckCircle2 className="mx-auto h-5 w-5 text-green-300" />
          <p className="mt-2 text-sm text-white/50">
            {searchQuery.trim() ? "No jobs match that filter." : "No visible jobs."}
          </p>
        </div>
      )}
    </div>
  );
}

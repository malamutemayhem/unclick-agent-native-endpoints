export interface OrchestratorProfileRow {
  agent_id: string;
  emoji?: string | null;
  display_name?: string | null;
  user_agent_hint?: string | null;
  created_at?: string | null;
  last_seen_at?: string | null;
  current_status?: string | null;
  current_status_updated_at?: string | null;
  next_checkin_at?: string | null;
}

export interface OrchestratorMessageRow {
  id: string;
  author_emoji?: string | null;
  author_name?: string | null;
  author_agent_id?: string | null;
  recipients?: string[] | null;
  text: string;
  tags?: string[] | null;
  thread_id?: string | null;
  created_at: string;
}

export interface OrchestratorTodoRow {
  id: string;
  title: string;
  description?: string | null;
  status: "open" | "in_progress" | "done" | "dropped" | string;
  priority: "low" | "normal" | "high" | "urgent" | string;
  created_by_agent_id: string;
  assigned_to_agent_id?: string | null;
  source_idea_id?: string | null;
  created_at: string;
  updated_at?: string | null;
  completed_at?: string | null;
}

export interface OrchestratorCommentRow {
  id: string;
  target_kind: "todo" | "idea" | string;
  target_id: string;
  author_agent_id: string;
  text: string;
  created_at: string;
}

export interface OrchestratorDispatchRow {
  dispatch_id: string;
  source: string;
  target_agent_id: string;
  task_ref?: string | null;
  status: string;
  lease_owner?: string | null;
  lease_expires_at?: string | null;
  last_real_action_at?: string | null;
  payload?: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string | null;
}

export interface OrchestratorSignalRow {
  id: string;
  tool: string;
  action: string;
  severity: string;
  summary: string;
  deep_link?: string | null;
  payload?: Record<string, unknown> | null;
  created_at: string;
  read_at?: string | null;
}

export interface OrchestratorSessionRow {
  id?: string;
  session_id: string;
  platform?: string | null;
  summary: string;
  decisions?: unknown;
  open_loops?: unknown;
  topics?: string[] | null;
  created_at: string;
}

export interface OrchestratorLibraryRow {
  slug: string;
  title: string;
  category: string;
  tags?: string[] | null;
  version?: number | null;
  updated_at?: string | null;
  created_at?: string | null;
}

export interface OrchestratorBusinessContextRow {
  id: string;
  category: string;
  key: string;
  value: unknown;
  priority?: number | null;
  updated_at?: string | null;
}

export interface OrchestratorConversationTurnRow {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system" | "tool" | string;
  content: string;
  created_at: string;
}

export interface BuildOrchestratorContextInput {
  generatedAt: string;
  profiles: OrchestratorProfileRow[];
  messages: OrchestratorMessageRow[];
  todos: OrchestratorTodoRow[];
  comments: OrchestratorCommentRow[];
  dispatches: OrchestratorDispatchRow[];
  signals: OrchestratorSignalRow[];
  sessions: OrchestratorSessionRow[];
  library: OrchestratorLibraryRow[];
  businessContext: OrchestratorBusinessContextRow[];
  conversationTurns: OrchestratorConversationTurnRow[];
}

export interface OrchestratorSourceLink {
  source_kind:
    | "boardroom_message"
    | "todo"
    | "todo_comment"
    | "dispatch"
    | "signal"
    | "session_summary"
    | "library"
    | "business_context"
    | "conversation_turn";
  source_id: string;
  deep_link?: string | null;
  created_at?: string | null;
}

export interface OrchestratorContinuityEvent extends OrchestratorSourceLink {
  kind: "handoff" | "claim" | "proof" | "blocker" | "ack" | "decision" | "status" | "context";
  actor_agent_id?: string | null;
  role?: string | null;
  summary: string;
  tags?: string[];
}

export interface OrchestratorProfileCard {
  agent_id: string;
  label: string;
  role: "human" | "ai-seat";
  emoji?: string | null;
  device_hint?: string | null;
  last_seen_at?: string | null;
  current_status?: string | null;
  next_checkin_at?: string | null;
  freshness_state: "live" | "recent" | "missed_checkin" | "quiet" | "unknown";
  freshness_label: string;
}

export interface OrchestratorLibrarySnapshot extends OrchestratorSourceLink {
  title: string;
  category: string;
  summary?: string;
  tags?: string[];
  version?: number | null;
  updated_at?: string | null;
}

export interface OrchestratorContext {
  version: "orchestrator-context-v1";
  generated_at: string;
  policy: {
    mode: "read-only";
    compaction: string;
    raw_access: string;
    redaction: string;
  };
  current_state_card: {
    summary: string;
    newest_activity_at: string | null;
    newest_checkin_at: string | null;
    active_todo_count: number;
    blocker_count: number;
    active_seat_count: number;
    live_sources: {
      profiles: number;
      boardroom_messages: number;
      todos: number;
      comments: number;
      dispatches: number;
      signals: number;
      sessions: number;
      library: number;
      business_context: number;
      conversation_turns: number;
    };
    next_actions: string[];
    blockers: string[];
  };
  profile_cards: OrchestratorProfileCard[];
  continuity_events: OrchestratorContinuityEvent[];
  library_snapshots: OrchestratorLibrarySnapshot[];
}

const ACTIVE_WINDOW_MS = 30 * 60 * 1000;
const RECENT_WINDOW_MS = 6 * 60 * 60 * 1000;
const PRIORITY_RANK: Record<string, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\b(authorization\s*:\s*bearer)\s+[a-z0-9._~+/=-]+/gi, "$1 [redacted secret]"],
  [/\b(bearer)\s+[a-z0-9._~+/=-]+/gi, "$1 [redacted secret]"],
  [/\b(api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|passwd|private[_-]?key)\s*[:=]\s*["']?[^"'\s,;]+/gi, "$1=[redacted secret]"],
  [/\b(sk-[a-z0-9_-]{8,}|ghp_[a-z0-9_]{8,}|github_pat_[a-z0-9_]{8,}|xox[baprs]-[a-z0-9-]{8,})\b/gi, "[redacted secret]"],
  [/\b(uc|agt)_[a-z0-9_-]{8,}\b/gi, "[redacted secret]"],
  [/\b(?:\d[ -]*?){13,19}\b/g, "[redacted billing data]"],
];

export function redactSensitive(input: unknown): string {
  if (input == null) return "";
  let text = typeof input === "string" ? input : safeJson(input);
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

export function compactText(input: unknown, maxChars = 220): string {
  const clean = redactSensitive(input).replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

export function buildOrchestratorContext(input: BuildOrchestratorContextInput): OrchestratorContext {
  const nowMs = Date.parse(input.generatedAt);
  const profiles = input.profiles
    .map((profile) => buildProfileCard(profile, nowMs))
    .sort((a, b) => compareIsoDesc(a.last_seen_at, b.last_seen_at));
  const activeSeatCount = profiles.filter((profile) => isFresh(profile.last_seen_at, nowMs)).length;

  const activeTodos = input.todos
    .filter((todo) => todo.status === "open" || todo.status === "in_progress")
    .sort(compareTodoPriorityThenUpdated)
    .slice(0, 8);

  const messageEvents = input.messages.map(messageToEvent);
  const todoEvents = activeTodos.map(todoToEvent);
  const commentEvents = input.comments.map(commentToEvent);
  const dispatchEvents = input.dispatches.map(dispatchToEvent);
  const signalEvents = input.signals.map(signalToEvent);
  const conversationEvents = input.conversationTurns.map(conversationTurnToEvent);
  const sessionEvents = input.sessions.map(sessionToEvent);

  const continuityEvents = [
    ...messageEvents,
    ...todoEvents,
    ...commentEvents,
    ...dispatchEvents,
    ...signalEvents,
    ...conversationEvents,
    ...sessionEvents,
  ]
    .filter((event) => event.summary.length > 0)
    .sort((a, b) => compareIsoDesc(a.created_at, b.created_at))
    .slice(0, 36);

  const blockers = continuityEvents
    .filter((event) => event.kind === "blocker")
    .map((event) => event.summary)
    .slice(0, 5);

  const nextActions = activeTodos
    .map((todo) => {
      const owner = todo.assigned_to_agent_id ? ` -> ${todo.assigned_to_agent_id}` : "";
      return compactText(`${todo.priority} ${todo.status}${owner}: ${todo.title}`, 160);
    })
    .slice(0, 6);

  const librarySnapshots = [
    ...input.library.map(libraryToSnapshot),
    ...input.businessContext.map(businessContextToSnapshot),
    ...input.sessions.map(sessionToSnapshot),
  ]
    .sort((a, b) => compareIsoDesc(a.updated_at ?? a.created_at, b.updated_at ?? b.created_at))
    .slice(0, 24);

  const newestActivityAt = newestIso([
    ...input.messages.map((row) => row.created_at),
    ...input.todos.map((row) => row.updated_at ?? row.created_at),
    ...input.comments.map((row) => row.created_at),
    ...input.dispatches.map((row) => row.updated_at ?? row.created_at),
    ...input.signals.map((row) => row.created_at),
    ...input.sessions.map((row) => row.created_at),
    ...input.conversationTurns.map((row) => row.created_at),
  ]);
  const newestCheckinAt = newestIso(input.profiles.map((row) => row.last_seen_at));

  return {
    version: "orchestrator-context-v1",
    generated_at: input.generatedAt,
    policy: {
      mode: "read-only",
      compaction: "Small current-state, profile-card, continuity, and library-snapshot summaries are returned by default.",
      raw_access: "Raw records stay in their source tables and are referenced by source_kind, source_id, and deep_link.",
      redaction: "Auth, token, secret, password, API key, and billing-like values are redacted before summaries are returned.",
    },
    current_state_card: {
      summary: compactText(
        `${activeTodos.length} active job${activeTodos.length === 1 ? "" : "s"}, ${activeSeatCount} active seat${activeSeatCount === 1 ? "" : "s"}, ${blockers.length} blocker signal${blockers.length === 1 ? "" : "s"}.`,
        180,
      ),
      newest_activity_at: newestActivityAt,
      newest_checkin_at: newestCheckinAt,
      active_todo_count: activeTodos.length,
      blocker_count: blockers.length,
      active_seat_count: activeSeatCount,
      live_sources: {
        profiles: input.profiles.length,
        boardroom_messages: input.messages.length,
        todos: input.todos.length,
        comments: input.comments.length,
        dispatches: input.dispatches.length,
        signals: input.signals.length,
        sessions: input.sessions.length,
        library: input.library.length,
        business_context: input.businessContext.length,
        conversation_turns: input.conversationTurns.length,
      },
      next_actions: nextActions,
      blockers,
    },
    profile_cards: profiles,
    continuity_events: continuityEvents,
    library_snapshots: librarySnapshots,
  };
}

function buildProfileCard(profile: OrchestratorProfileRow, nowMs: number): OrchestratorProfileCard {
  const label = profile.display_name?.trim() || prettifyAgentId(profile.agent_id);
  const role = profile.user_agent_hint === "admin-ui" || profile.agent_id.startsWith("human-") ? "human" : "ai-seat";
  const lastSeenAt = profile.last_seen_at ?? profile.created_at ?? null;
  const freshness = profileFreshness(lastSeenAt, profile.next_checkin_at ?? null, nowMs);
  return {
    agent_id: profile.agent_id,
    label,
    role,
    emoji: profile.emoji ?? null,
    device_hint: profile.user_agent_hint ?? null,
    last_seen_at: lastSeenAt,
    current_status: compactText(profile.current_status ?? "", 140) || null,
    next_checkin_at: profile.next_checkin_at ?? null,
    freshness_state: freshness.freshness_state,
    freshness_label: freshness.freshness_label,
  };
}

function profileFreshness(
  lastSeenAt: string | null,
  nextCheckinAt: string | null,
  nowMs: number,
): Pick<OrchestratorProfileCard, "freshness_state" | "freshness_label"> {
  const lastSeenMs = lastSeenAt ? Date.parse(lastSeenAt) : NaN;
  const nextCheckinMs = nextCheckinAt ? Date.parse(nextCheckinAt) : NaN;

  if (Number.isFinite(nextCheckinMs) && Number.isFinite(nowMs) && nextCheckinMs < nowMs) {
    if (!Number.isFinite(lastSeenMs) || lastSeenMs < nextCheckinMs) {
      return { freshness_state: "missed_checkin", freshness_label: "Missed check-in" };
    }
  }

  if (!Number.isFinite(lastSeenMs) || !Number.isFinite(nowMs)) {
    return { freshness_state: "unknown", freshness_label: "No check-in yet" };
  }

  const ageMs = nowMs - lastSeenMs;
  if (ageMs <= ACTIVE_WINDOW_MS) return { freshness_state: "live", freshness_label: "Live" };
  if (ageMs <= RECENT_WINDOW_MS) return { freshness_state: "recent", freshness_label: "Recent" };
  return { freshness_state: "quiet", freshness_label: "Quiet" };
}

function messageToEvent(message: OrchestratorMessageRow): OrchestratorContinuityEvent {
  const tags = normalizeTags(message.tags);
  return {
    source_kind: "boardroom_message",
    source_id: message.id,
    deep_link: `/admin/boardroom#msg-${message.id}`,
    created_at: message.created_at,
    kind: classify(tags, message.text),
    actor_agent_id: message.author_agent_id ?? null,
    summary: compactText(message.text, 260),
    tags,
  };
}

function todoToEvent(todo: OrchestratorTodoRow): OrchestratorContinuityEvent {
  return {
    source_kind: "todo",
    source_id: todo.id,
    deep_link: `/admin/jobs#todo-${todo.id}`,
    created_at: todo.updated_at ?? todo.created_at,
    kind: todo.status === "in_progress" ? "claim" : classify([], `${todo.title} ${todo.description ?? ""}`),
    actor_agent_id: todo.assigned_to_agent_id ?? todo.created_by_agent_id,
    summary: compactText(`${todo.priority} ${todo.status}: ${todo.title}. ${todo.description ?? ""}`, 260),
    tags: ["todo", todo.status, todo.priority],
  };
}

function commentToEvent(comment: OrchestratorCommentRow): OrchestratorContinuityEvent {
  return {
    source_kind: "todo_comment",
    source_id: comment.id,
    deep_link: comment.target_kind === "todo" ? `/admin/jobs#todo-${comment.target_id}` : null,
    created_at: comment.created_at,
    kind: classify([], comment.text),
    actor_agent_id: comment.author_agent_id,
    summary: compactText(comment.text, 240),
    tags: [comment.target_kind, "comment"],
  };
}

function dispatchToEvent(dispatch: OrchestratorDispatchRow): OrchestratorContinuityEvent {
  const detail = [
    dispatch.source,
    dispatch.status,
    dispatch.task_ref,
    dispatch.payload ? compactText(dispatch.payload, 140) : "",
  ]
    .filter(Boolean)
    .join(" ");
  return {
    source_kind: "dispatch",
    source_id: dispatch.dispatch_id,
    deep_link: dispatch.task_ref?.startsWith("todo:") ? `/admin/jobs#${dispatch.task_ref}` : null,
    created_at: dispatch.updated_at ?? dispatch.created_at,
    kind: dispatch.status === "leased" ? "handoff" : dispatch.status === "failed" || dispatch.status === "stale" ? "blocker" : "status",
    actor_agent_id: dispatch.lease_owner ?? dispatch.target_agent_id,
    summary: compactText(detail, 240),
    tags: ["dispatch", dispatch.source, dispatch.status],
  };
}

function signalToEvent(signal: OrchestratorSignalRow): OrchestratorContinuityEvent {
  return {
    source_kind: "signal",
    source_id: signal.id,
    deep_link: signal.deep_link ?? null,
    created_at: signal.created_at,
    kind: signal.severity === "critical" || signal.severity === "action_needed" ? "blocker" : classify([signal.action], signal.summary),
    summary: compactText(`${signal.tool} ${signal.action}: ${signal.summary}`, 240),
    tags: ["signal", signal.tool, signal.action, signal.severity],
  };
}

function sessionToEvent(session: OrchestratorSessionRow): OrchestratorContinuityEvent {
  return {
    source_kind: "session_summary",
    source_id: session.session_id,
    deep_link: `/admin/memory?session_id=${encodeURIComponent(session.session_id)}`,
    created_at: session.created_at,
    kind: "context",
    role: session.platform ?? null,
    summary: compactText(session.summary, 240),
    tags: ["session", ...(session.topics ?? []).slice(0, 4)],
  };
}

function conversationTurnToEvent(turn: OrchestratorConversationTurnRow): OrchestratorContinuityEvent {
  return {
    source_kind: "conversation_turn",
    source_id: turn.id,
    deep_link: `/admin/memory?session_id=${encodeURIComponent(turn.session_id)}`,
    created_at: turn.created_at,
    kind: classify([], turn.content),
    role: turn.role,
    summary: compactText(`${turn.role}: ${turn.content}`, 240),
    tags: ["conversation", turn.role],
  };
}

function libraryToSnapshot(row: OrchestratorLibraryRow): OrchestratorLibrarySnapshot {
  return {
    source_kind: "library",
    source_id: row.slug,
    deep_link: `/admin/memory?library=${encodeURIComponent(row.slug)}`,
    title: row.title,
    category: row.category,
    tags: row.tags ?? [],
    version: row.version ?? null,
    updated_at: row.updated_at ?? row.created_at ?? null,
    created_at: row.created_at ?? null,
  };
}

function businessContextToSnapshot(row: OrchestratorBusinessContextRow): OrchestratorLibrarySnapshot {
  return {
    source_kind: "business_context",
    source_id: row.id,
    deep_link: "/admin/memory",
    title: `${row.category}: ${row.key}`,
    category: row.category,
    summary: compactText(row.value, 220),
    updated_at: row.updated_at ?? null,
  };
}

function sessionToSnapshot(row: OrchestratorSessionRow): OrchestratorLibrarySnapshot {
  return {
    source_kind: "session_summary",
    source_id: row.session_id,
    deep_link: `/admin/memory?session_id=${encodeURIComponent(row.session_id)}`,
    title: `Session ${row.session_id}`,
    category: row.platform ?? "session",
    summary: compactText(row.summary, 220),
    tags: row.topics ?? [],
    updated_at: row.created_at,
    created_at: row.created_at,
  };
}

function classify(tags: string[], text: string): OrchestratorContinuityEvent["kind"] {
  const tagSet = new Set(tags.map((tag) => tag.toLowerCase()));
  const lower = text.toLowerCase();
  if (tagSet.has("blocker") || lower.startsWith("blocker:") || lower.includes(" blocked") || lower.includes(" blocker")) return "blocker";
  if (tagSet.has("proof") || lower.startsWith("pass:") || lower.includes("proof:") || lower.includes(" pr #")) return "proof";
  if (tagSet.has("handoff") || lower.includes("handoff") || lower.includes("assigned to")) return "handoff";
  if (tagSet.has("ack") || lower.startsWith("ack ") || lower.includes(" ack ")) return "ack";
  if (lower.includes("claimed") || lower.includes("claiming") || lower.includes("in_progress")) return "claim";
  if (tagSet.has("decision") || lower.includes("decided") || lower.includes("greenlit")) return "decision";
  return "status";
}

function normalizeTags(tags?: string[] | null): string[] {
  return Array.isArray(tags)
    ? tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0).map((tag) => tag.trim())
    : [];
}

function compareTodoPriorityThenUpdated(a: OrchestratorTodoRow, b: OrchestratorTodoRow): number {
  const priorityDiff = (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0);
  if (priorityDiff !== 0) return priorityDiff;
  return compareIsoDesc(a.updated_at ?? a.created_at, b.updated_at ?? b.created_at);
}

function compareIsoDesc(a?: string | null, b?: string | null): number {
  const aMs = a ? Date.parse(a) : 0;
  const bMs = b ? Date.parse(b) : 0;
  return bMs - aMs;
}

function newestIso(values: Array<string | null | undefined>): string | null {
  const best = values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  return best ?? null;
}

function isFresh(iso: string | null | undefined, nowMs: number): boolean {
  if (!iso) return false;
  const seenMs = Date.parse(iso);
  return Number.isFinite(seenMs) && Number.isFinite(nowMs) && nowMs - seenMs <= ACTIVE_WINDOW_MS;
}

function prettifyAgentId(agentId: string): string {
  return agentId
    .replace(/^chatgpt[-_]/, "")
    .replace(/^codex[-_]/, "")
    .replace(/^claude[-_]/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
    .replace(/\bAi\b/g, "AI");
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

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

export type OrchestratorOperatorTimeSource = "browser" | "manual" | "unknown";

export interface OrchestratorOperatorTimeContext {
  timezone: string;
  source: OrchestratorOperatorTimeSource;
  local_date: string;
  local_time: string;
  utc_offset: string | null;
  updated_at?: string | null;
  privacy: "timezone-only";
  summary: string;
}

export interface BuildOrchestratorContextInput {
  generatedAt: string;
  continuityLimit?: number;
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
  source_app_label: string;
  connection_label: string;
  last_seen_at?: string | null;
  freshness_label: "Live" | "Recent" | "Missed check-in" | "Quiet";
  checkin_age_minutes: number | null;
  current_status?: string | null;
  next_checkin_at?: string | null;
}

export interface OrchestratorLibrarySnapshot extends OrchestratorSourceLink {
  title: string;
  category: string;
  summary?: string;
  tags?: string[];
  version?: number | null;
  updated_at?: string | null;
}

export interface OrchestratorRollingSnapshotItem extends OrchestratorSourceLink {
  kind: "decision" | "blocker" | "active_job" | "continuity";
  summary: string;
  actor_agent_id?: string | null;
  tags?: string[];
}

export interface OrchestratorRollingSnapshot {
  mode: "read-plan";
  summary: string;
  generated_at: string;
  newest_source_at: string | null;
  persistence_plan: {
    recommended_key: string;
    retention: string;
    compaction: string;
    raw_transcript_policy: string;
  };
  promoted_decisions: OrchestratorRollingSnapshotItem[];
  active_blockers: OrchestratorRollingSnapshotItem[];
  active_jobs: OrchestratorRollingSnapshotItem[];
  recent_continuity: OrchestratorRollingSnapshotItem[];
  source_pointers: OrchestratorSourceLink[];
}

export interface OrchestratorSeatHandshake {
  mode: "fresh-seat-pickup";
  summary: string;
  active_decision: string | null;
  active_job: string | null;
  recent_proof: string | null;
  active_blocker: string | null;
  seat_freshness: string[];
  next_prompt: string;
  source_pointers: OrchestratorSourceLink[];
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
    // active_jobs is the strict v9 definition used by Heartbeat step 5:
    // COUNT(todos WHERE status='in_progress' AND owner_last_seen <= 24h).
    // active_todo_count is the broader open+in_progress count kept for
    // back-compat with the rolling snapshot list. PASS/BLOCKER reasoning
    // should use active_jobs.
    active_jobs: number;
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
  human_operator_time: OrchestratorOperatorTimeContext | null;
  continuity_events: OrchestratorContinuityEvent[];
  library_snapshots: OrchestratorLibrarySnapshot[];
  rolling_snapshot: OrchestratorRollingSnapshot;
  seat_handshake: OrchestratorSeatHandshake;
}

const ACTIVE_WINDOW_MS = 30 * 60 * 1000;
// active_jobs (v9 definition pinned 2026-05-12 by todo a4cd5229): an
// in_progress todo is "active" only when its assigned owner has been seen
// in the last 24 hours. A todo assigned to a dormant or never-seen owner
// is NOT active, even if its status is in_progress. This is the same
// window used by Heartbeat step 5 so PASS/BLOCKER does not oscillate.
const OWNER_FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;
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

export function isHeartbeatAutomationText(input: unknown): boolean {
  const text = redactSensitive(input).replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();
  if (!lower) return false;
  if (/^heartbeat\b.*\bproof\b/.test(lower)) return true;
  if (/<heartbeat\b|<\/heartbeat>/.test(lower)) return true;
  if (lower.includes("automation_id") && lower.includes("unclick-heartbeat")) return true;
  if (lower.includes("current_time_iso") && lower.includes("instructions") && lower.includes("heartbeat")) return true;
  if (lower.startsWith("run unclick heartbeat.")) return true;
  if (lower.startsWith("load unclick seats > heartbeat")) return true;
  if (/^(pass|blocker):\s*heartbeat\b/i.test(text)) return true;
  if (/^pass:\s*.+;\s*proof:\s*.+;\s*cleanup:\s*/i.test(text)) return true;
  if (/^blocker:\s*.+;\s*next:\s*/i.test(text)) return true;
  if (lower.startsWith("dont_notify:") || lower.startsWith("notify:")) return true;
  return false;
}

function compactContinuityText(input: unknown, maxChars = 240, options: { heartbeatHint?: boolean } = {}): string {
  const clean = compactText(input, maxChars);
  if (!isHeartbeatAutomationText(clean)) return clean;
  if (!options.heartbeatHint && (/^pass:/i.test(clean) || /^blocker:/i.test(clean))) return clean;
  if (/^pass:/i.test(clean)) return compactText(`Heartbeat result: ${clean}`, maxChars);
  if (/^blocker:/i.test(clean)) return compactText(`Heartbeat result: ${clean}`, maxChars);
  if (/^dont_notify:|^notify:/i.test(clean)) return "Heartbeat notification state: compact status only.";
  return "Heartbeat schedule request: run embedded UnClick heartbeat instructions.";
}

export function buildOrchestratorContext(input: BuildOrchestratorContextInput): OrchestratorContext {
  const nowMs = Date.parse(input.generatedAt);
  const continuityLimit = Math.min(Math.max(Number(input.continuityLimit ?? 36) || 36, 20), 200);
  const profiles = input.profiles
    .map((profile) => buildProfileCard(profile, nowMs))
    .sort((a, b) => compareIsoDesc(a.last_seen_at, b.last_seen_at));
  const activeSeatCount = profiles.filter((profile) => isFresh(profile.last_seen_at, nowMs)).length;
  const humanOperatorTime = buildOperatorTimeContext(input.businessContext, input.generatedAt);

  const activeTodos = input.todos
    .filter((todo) => todo.status === "open" || todo.status === "in_progress")
    .sort(compareTodoPriorityThenUpdated)
    .slice(0, 8);
  // active_jobs (v9 definition pinned by todo a4cd5229): strict
  // in_progress + owner_last_seen <= 24h. Heartbeat step 5 uses the same
  // formula so state_card and PASS/BLOCKER never disagree on identical
  // input. Computed over the full input.todos array, NOT the sliced
  // activeTodos, so the count is deterministic regardless of UI cap.
  const activeJobsCount = computeActiveJobsCount(input.todos, input.profiles, nowMs);

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
    .slice(0, continuityLimit);

  const blockers = continuityEvents
    .filter((event) => isActiveBlockerEvent(event, activeTodos, nowMs))
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
  const rollingSnapshot = buildRollingSnapshot({
    generatedAt: input.generatedAt,
    nowMs,
    newestActivityAt,
    activeTodos,
    continuityEvents,
    blockers,
  });
  const seatHandshake = buildSeatHandshake({
    profiles,
    continuityEvents,
    rollingSnapshot,
    humanOperatorTime,
  });

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
        `${activeJobsCount} active job${activeJobsCount === 1 ? "" : "s"}, ${activeSeatCount} active seat${activeSeatCount === 1 ? "" : "s"}, ${blockers.length} blocker signal${blockers.length === 1 ? "" : "s"}.${humanOperatorTime ? ` Operator time: ${humanOperatorTime.summary}.` : ""}`,
        180,
      ),
      newest_activity_at: newestActivityAt,
      newest_checkin_at: newestCheckinAt,
      active_todo_count: activeTodos.length,
      active_jobs: activeJobsCount,
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
    human_operator_time: humanOperatorTime,
    continuity_events: continuityEvents,
    library_snapshots: librarySnapshots,
    rolling_snapshot: rollingSnapshot,
    seat_handshake: seatHandshake,
  };
}

function buildSeatHandshake({
  profiles,
  continuityEvents,
  rollingSnapshot,
  humanOperatorTime,
}: {
  profiles: OrchestratorProfileCard[];
  continuityEvents: OrchestratorContinuityEvent[];
  rollingSnapshot: OrchestratorRollingSnapshot;
  humanOperatorTime: OrchestratorOperatorTimeContext | null;
}): OrchestratorSeatHandshake {
  const usefulEvents = continuityEvents.filter((event) => !isSnapshotNoise(event));
  const recentProof = usefulEvents.find((event) => event.kind === "proof") ?? null;
  const decision = rollingSnapshot.promoted_decisions[0] ?? null;
  const job = rollingSnapshot.active_jobs[0] ?? null;
  const blocker = rollingSnapshot.active_blockers[0] ?? null;
  const activeDecision =
    decision?.summary ??
    (job
      ? `Continue current priority job: ${job.summary}`
      : recentProof
        ? `Continue from latest proof: ${recentProof.summary}`
        : blocker
          ? `Resolve current blocker: ${blocker.summary}`
          : null);
  const seatFreshness = profiles
    .slice(0, 6)
    .map((profile) => `${profile.label}: ${profile.freshness_label}`)
    .filter(Boolean);

  const proofPointer = recentProof ? eventToSnapshotItem(recentProof, "continuity") : null;
  const sourcePointers = uniqueSourcePointers([
    ...(decision ? [decision] : []),
    ...(job ? [job] : []),
    ...(blocker ? [blocker] : []),
    ...(proofPointer ? [proofPointer] : []),
    ...rollingSnapshot.recent_continuity.slice(0, 4),
  ]);

  return {
    mode: "fresh-seat-pickup",
    summary: compactText(
      [
        activeDecision ? `Decision: ${activeDecision}` : "",
        job ? `Job: ${job.summary}` : "",
        recentProof ? `Proof: ${recentProof.summary}` : "",
        blocker ? `Blocker: ${blocker.summary}` : "",
      ]
        .filter(Boolean)
        .join(" "),
      320,
    ),
    active_decision: activeDecision,
    active_job: job?.summary ?? null,
    recent_proof: recentProof?.summary ?? null,
    active_blocker: blocker?.summary ?? null,
    seat_freshness: seatFreshness,
    next_prompt: humanOperatorTime
      ? `Use this compact handoff. Human operator local time is ${humanOperatorTime.summary}. Orchestrator continuity writes are authorized: save the wake and final result with save_conversation_turn, unclick_save_conversation_turn, or admin_conversation_turn_ingest if auth is already available. Inspect source pointers only as needed, do one safe useful step, then reply PASS: <progress>; proof: <link/id>; cleanup: done, or BLOCKER: <missing>; progress: <checked>; next: <fix>.`
      : "Use this compact handoff. Orchestrator continuity writes are authorized: save the wake and final result with save_conversation_turn, unclick_save_conversation_turn, or admin_conversation_turn_ingest if auth is already available. Inspect source pointers only as needed, do one safe useful step, then reply PASS: <progress>; proof: <link/id>; cleanup: done, or BLOCKER: <missing>; progress: <checked>; next: <fix>.",
    source_pointers: sourcePointers,
  };
}

function buildOperatorTimeContext(
  rows: OrchestratorBusinessContextRow[],
  generatedAt: string,
): OrchestratorOperatorTimeContext | null {
  const row = rows.find((item) => item.category === "preference" && item.key === "operator_timezone");
  if (!row) return null;
  const value = parseBusinessContextValue(row.value);
  const timezone = typeof value.timezone === "string" ? value.timezone.trim() : "";
  if (!isValidTimeZone(timezone)) return null;

  const source = value.source === "manual" || value.source === "browser" ? value.source : "unknown";
  const date = new Date(generatedAt);
  const localDate = formatInTimeZone(date, timezone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const localTime = formatInTimeZone(date, timezone, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const utcOffset = formatUtcOffset(date, timezone);
  const summary = compactText(
    `${localTime} on ${localDate} ${timezone}${utcOffset ? ` (${utcOffset})` : ""}${source === "manual" ? ", manual override" : ""}`,
    180,
  );

  return {
    timezone,
    source,
    local_date: localDate,
    local_time: localTime,
    utc_offset: utcOffset,
    updated_at: row.updated_at ?? (typeof value.updated_at === "string" ? value.updated_at : null),
    privacy: "timezone-only",
    summary,
  };
}

function buildRollingSnapshot({
  generatedAt,
  nowMs,
  newestActivityAt,
  activeTodos,
  continuityEvents,
  blockers,
}: {
  generatedAt: string;
  nowMs: number;
  newestActivityAt: string | null;
  activeTodos: OrchestratorTodoRow[];
  continuityEvents: OrchestratorContinuityEvent[];
  blockers: string[];
}): OrchestratorRollingSnapshot {
  const snapshotEvents = continuityEvents.filter((event) => !isSnapshotNoise(event));
  const promotedDecisions = snapshotEvents
    .filter((event) => event.kind === "decision")
    .slice(0, 5)
    .map((event) => eventToSnapshotItem(event, "decision"));
  const activeBlockers = snapshotEvents
    .filter((event) => isActiveBlockerEvent(event, activeTodos, nowMs))
    .slice(0, 5)
    .map((event) => eventToSnapshotItem(event, "blocker"));
  const activeJobs = activeTodos.slice(0, 6).map((todo) => ({
    source_kind: "todo" as const,
    source_id: todo.id,
    deep_link: `/admin/jobs#todo-${todo.id}`,
    created_at: todo.updated_at ?? todo.created_at,
    kind: "active_job" as const,
    actor_agent_id: todo.assigned_to_agent_id ?? todo.created_by_agent_id,
    summary: compactText(`${todo.priority} ${todo.status}: ${todo.title}. ${todo.description ?? ""}`, 220),
    tags: ["todo", todo.status, todo.priority],
  }));
  const recentContinuity = snapshotEvents
    .filter((event) => event.kind !== "decision" && event.kind !== "blocker")
    .slice(0, 8)
    .map((event) => eventToSnapshotItem(event, "continuity"));
  const sourcePointers = uniqueSourcePointers([
    ...promotedDecisions,
    ...activeBlockers,
    ...activeJobs,
    ...recentContinuity,
  ]);

  return {
    mode: "read-plan",
    summary: compactText(
      [
        `${activeJobs.length} active job${activeJobs.length === 1 ? "" : "s"}`,
        `${promotedDecisions.length} promoted decision${promotedDecisions.length === 1 ? "" : "s"}`,
        `${activeBlockers.length || blockers.length} blocker signal${(activeBlockers.length || blockers.length) === 1 ? "" : "s"}`,
      ].join(", "),
      180,
    ),
    generated_at: generatedAt,
    newest_source_at: newestActivityAt,
    persistence_plan: {
      recommended_key: "orchestrator:rolling-current-state:v1",
      retention: "Keep compact rolling snapshots and source pointers; refresh from live sources instead of storing duplicate raw rows.",
      compaction: "Promote decisions, blockers, active jobs, and recent non-noise continuity only.",
      raw_transcript_policy: "Do not persist raw transcripts, heartbeat noise, secret-shaped text, or bulk pasted content in the snapshot.",
    },
    promoted_decisions: promotedDecisions,
    active_blockers: activeBlockers,
    active_jobs: activeJobs,
    recent_continuity: recentContinuity,
    source_pointers: sourcePointers,
  };
}

function isActiveBlockerEvent(
  event: OrchestratorContinuityEvent,
  activeTodos: OrchestratorTodoRow[],
  nowMs: number,
): boolean {
  if (event.kind !== "blocker") return false;
  if (!isHistoricalWakeOrFishbowlStale(event, activeTodos, nowMs)) return true;
  return false;
}

function isHistoricalWakeOrFishbowlStale(
  event: OrchestratorContinuityEvent,
  activeTodos: OrchestratorTodoRow[],
  nowMs: number,
): boolean {
  if (event.source_kind !== "dispatch") return false;
  if (activeTodos.length > 0) return false;

  const tags = (event.tags ?? []).map((tag) => tag.toLowerCase());
  const summary = event.summary.toLowerCase();
  const isWakeOrFishbowl =
    tags.includes("wakepass") ||
    tags.includes("fishbowl") ||
    /\b(wakepass|fishbowl)\b/.test(summary);
  const isStale = tags.includes("stale") || /\bstale\b/.test(summary);
  if (!isWakeOrFishbowl || !isStale) return false;

  const createdMs = event.created_at ? Date.parse(event.created_at) : NaN;
  if (!Number.isFinite(createdMs) || !Number.isFinite(nowMs)) return false;
  return nowMs - createdMs >= 60 * 60 * 1000;
}

function eventToSnapshotItem(
  event: OrchestratorContinuityEvent,
  kind: OrchestratorRollingSnapshotItem["kind"],
): OrchestratorRollingSnapshotItem {
  return {
    source_kind: event.source_kind,
    source_id: event.source_id,
    deep_link: event.deep_link ?? null,
    created_at: event.created_at ?? null,
    kind,
    actor_agent_id: event.actor_agent_id ?? null,
    summary: compactText(event.summary, 220),
    tags: event.tags ?? [],
  };
}

function uniqueSourcePointers(items: OrchestratorRollingSnapshotItem[]): OrchestratorSourceLink[] {
  const seen = new Set<string>();
  const pointers: OrchestratorSourceLink[] = [];
  for (const item of items) {
    const key = `${item.source_kind}:${item.source_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pointers.push({
      source_kind: item.source_kind,
      source_id: item.source_id,
      deep_link: item.deep_link ?? null,
      created_at: item.created_at ?? null,
    });
  }
  return pointers.slice(0, 18);
}

function isSnapshotNoise(event: OrchestratorContinuityEvent): boolean {
  const summary = event.summary.toLowerCase();
  const tags = (event.tags ?? []).map((tag) => tag.toLowerCase());
  if (event.kind === "decision" && !tags.includes("heartbeat")) {
    return false;
  }
  if (event.kind === "proof" && !tags.includes("heartbeat") && !summary.startsWith("heartbeat result:")) {
    return false;
  }
  const text = `${summary} ${tags.join(" ")}`;
  return isHeartbeatAutomationText(text) || /heartbeat|quiet-status|dont_notify|don't notify|no user action needed|unchanged ack|raw transcript/.test(text);
}

function buildProfileCard(profile: OrchestratorProfileRow, nowMs: number): OrchestratorProfileCard {
  const label = profile.display_name?.trim() || prettifyAgentId(profile.agent_id);
  const role = profile.user_agent_hint === "admin-ui" || profile.agent_id.startsWith("human-") ? "human" : "ai-seat";
  const lastSeenAt = profile.last_seen_at ?? profile.created_at ?? null;
  const freshness = getSeatFreshness(lastSeenAt, profile.next_checkin_at, nowMs);
  const sourceAppLabel = getSourceAppLabel(profile);
  return {
    agent_id: profile.agent_id,
    label,
    role,
    emoji: profile.emoji ?? null,
    device_hint: profile.user_agent_hint ?? null,
    source_app_label: sourceAppLabel,
    connection_label: getConnectionLabel(freshness.label, role),
    last_seen_at: lastSeenAt,
    freshness_label: freshness.label,
    checkin_age_minutes: freshness.ageMinutes,
    current_status: compactText(profile.current_status ?? "", 140) || null,
    next_checkin_at: profile.next_checkin_at ?? null,
  };
}

function getSeatFreshness(
  lastSeenAt: string | null,
  nextCheckinAt: string | null | undefined,
  nowMs: number,
): { label: OrchestratorProfileCard["freshness_label"]; ageMinutes: number | null } {
  const seenMs = lastSeenAt ? Date.parse(lastSeenAt) : NaN;
  const dueMs = nextCheckinAt ? Date.parse(nextCheckinAt) : NaN;
  if (Number.isFinite(dueMs) && dueMs < nowMs && (!Number.isFinite(seenMs) || seenMs < dueMs)) {
    return {
      label: "Missed check-in",
      ageMinutes: Number.isFinite(seenMs) ? Math.max(0, Math.floor((nowMs - seenMs) / 60_000)) : null,
    };
  }
  if (!Number.isFinite(seenMs) || !Number.isFinite(nowMs)) {
    return { label: "Quiet", ageMinutes: null };
  }
  const ageMs = Math.max(0, nowMs - seenMs);
  const ageMinutes = Math.floor(ageMs / 60_000);
  if (ageMs <= ACTIVE_WINDOW_MS) return { label: "Live", ageMinutes };
  if (ageMs <= 24 * 60 * 60 * 1000) return { label: "Recent", ageMinutes };
  return { label: "Quiet", ageMinutes };
}

function getSourceAppLabel(profile: OrchestratorProfileRow): string {
  const hint = `${profile.user_agent_hint ?? ""} ${profile.agent_id}`.toLowerCase();
  if (hint.includes("admin-ui") || profile.agent_id.startsWith("human-")) return "Admin UI";
  if (hint.includes("windsurf") || hint.includes("cascade")) return "Windsurf";
  if (hint.includes("claude")) return "Claude";
  if (hint.includes("github-action") || hint.includes("github_action")) return "GitHub Action";
  if (hint.includes("scheduled") || hint.includes("heartbeat")) return "Scheduled";
  if (hint.includes("codex")) return "Codex";
  return "AI Seat";
}

function getConnectionLabel(
  freshnessLabel: OrchestratorProfileCard["freshness_label"],
  role: OrchestratorProfileCard["role"],
): string {
  if (role === "human") {
    return freshnessLabel === "Live" || freshnessLabel === "Recent" ? "Admin present" : "Admin quiet";
  }
  if (freshnessLabel === "Live") return "Connected";
  if (freshnessLabel === "Recent") return "Seen recently";
  if (freshnessLabel === "Missed check-in") return "Check-in overdue";
  return "No recent check-in";
}

function messageToEvent(message: OrchestratorMessageRow): OrchestratorContinuityEvent {
  const tags = normalizeTags(message.tags);
  const summary = compactContinuityText(message.text, 260, {
    heartbeatHint: tags.some((tag) => tag.toLowerCase() === "heartbeat"),
  });
  return {
    source_kind: "boardroom_message",
    source_id: message.id,
    deep_link: `/admin/boardroom#msg-${message.id}`,
    created_at: message.created_at,
    kind: classify(tags, message.text),
    actor_agent_id: message.author_agent_id ?? null,
    summary,
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
    summary: compactContinuityText(comment.text, 240),
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
    kind: signal.severity === "critical" || signal.severity === "action_needed" ? "blocker" : classify([signal.action, signal.severity], signal.summary),
    summary: compactText(`${signal.tool} ${signal.action}: ${signal.summary}`, 240),
    tags: ["signal", signal.tool, signal.action, signal.severity],
  };
}

function sessionToEvent(session: OrchestratorSessionRow): OrchestratorContinuityEvent {
  const decisionSummary = sessionDecisionSummary(session.decisions);
  const summary = decisionSummary
    ? compactText(`Decision memory: ${decisionSummary}. Session: ${session.summary}`, 240)
    : compactText(session.summary, 240);

  return {
    source_kind: "session_summary",
    source_id: session.session_id,
    deep_link: `/admin/memory?session_id=${encodeURIComponent(session.session_id)}`,
    created_at: session.created_at,
    kind: decisionSummary ? "decision" : "context",
    role: session.platform ?? null,
    summary,
    tags: ["session", ...(session.topics ?? []).slice(0, 4)],
  };
}

function sessionDecisionSummary(decisions: unknown): string {
  const values = Array.isArray(decisions)
    ? decisions
    : typeof decisions === "string" && decisions.trim().startsWith("[")
      ? parseJsonArray(decisions)
      : [];

  return values
    .map((value) => compactText(typeof value === "string" ? value : safeJson(value), 140))
    .filter(Boolean)
    .slice(0, 3)
    .join("; ");
}

function parseJsonArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function conversationTurnToEvent(turn: OrchestratorConversationTurnRow): OrchestratorContinuityEvent {
  const content = compactContinuityText(turn.content, 220, {
    heartbeatHint: /<heartbeat\b|unclick-heartbeat|current_time_iso/i.test(String(turn.content ?? "")),
  });
  return {
    source_kind: "conversation_turn",
    source_id: turn.id,
    deep_link: `/admin/memory?session_id=${encodeURIComponent(turn.session_id)}`,
    created_at: turn.created_at,
    kind: classify([], turn.content),
    role: turn.role,
    summary: compactText(`${turn.role}: ${content}`, 240),
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
  if (/^heartbeat\b.*\bproof\b/.test(lower)) return "proof";
  if (lower.startsWith("pass: heartbeat")) return "proof";
  if (lower.startsWith("blocker: heartbeat")) return "status";
  if (tagSet.has("info")) return "status";
  if ((tagSet.has("done") || tagSet.has("fyi")) && !lower.startsWith("blocker:")) return "status";
  if (tagSet.has("proof") || lower.startsWith("pass:") || lower.includes("proof:") || lower.includes(" pr #")) return "proof";
  if (isZeroBlockerMetricStatus(lower)) return "status";
  if (tagSet.has("blocker") || lower.startsWith("blocker:") || /\bblocked\b/.test(lower) || /\bblocker\b/.test(lower)) return "blocker";
  if (tagSet.has("handoff") || lower.includes("handoff") || lower.includes("assigned to")) return "handoff";
  if (tagSet.has("ack") || lower.startsWith("ack ") || lower.includes(" ack ")) return "ack";
  if (lower.includes("claimed") || lower.includes("claiming") || lower.includes("in_progress")) return "claim";
  if (tagSet.has("decision") || lower.includes("decided") || lower.includes("greenlit")) return "decision";
  return "status";
}

function isZeroBlockerMetricStatus(lower: string): boolean {
  return /\bblocker_count\s*[=:]\s*0\b/.test(lower) || /\b0\s+blocker signals?\b/.test(lower);
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

// Owner-freshness gate for current_state_card.active_jobs. Mirrors the
// Heartbeat step 5 definition: active_jobs = COUNT(todos WHERE
// status='in_progress' AND owner_last_seen <= 24h). Keeps state_card and
// heartbeat aligned so identical input always produces identical PASS/BLOCKER.
function isOwnerFresh(iso: string | null | undefined, nowMs: number): boolean {
  if (!iso) return false;
  const seenMs = Date.parse(iso);
  return Number.isFinite(seenMs) && Number.isFinite(nowMs) && nowMs - seenMs <= OWNER_FRESH_WINDOW_MS;
}

export function computeActiveJobsCount(
  todos: OrchestratorTodoRow[],
  profiles: OrchestratorProfileRow[],
  nowMs: number,
): number {
  const ownerLastSeen = new Map<string, string | null>();
  for (const profile of profiles) {
    if (profile.agent_id) {
      ownerLastSeen.set(profile.agent_id, profile.last_seen_at ?? profile.created_at ?? null);
    }
  }
  return todos.filter((todo) => {
    if (todo.status !== "in_progress") return false;
    const owner = todo.assigned_to_agent_id;
    if (!owner) return false;
    return isOwnerFresh(ownerLastSeen.get(owner), nowMs);
  }).length;
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

function parseBusinessContextValue(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function isValidTimeZone(timezone: string): boolean {
  if (!timezone || timezone.length > 80) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function formatInTimeZone(
  date: Date,
  timezone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: timezone,
  }).formatToParts(date);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  if (options.hour) {
    return `${byType.get("hour") ?? "00"}:${byType.get("minute") ?? "00"}`;
  }
  return `${byType.get("year") ?? "0000"}-${byType.get("month") ?? "00"}-${byType.get("day") ?? "00"}`;
}

function formatUtcOffset(date: Date, timezone: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    }).formatToParts(date);
    const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
    return name ? name.replace(/^GMT/, "UTC") : null;
  } catch {
    return null;
  }
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

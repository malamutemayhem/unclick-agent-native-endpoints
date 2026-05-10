/**
 * Admin Orchestrator - the AI command center.
 *
 * Left: read-only continuity feed for seat/subscription context.
 * Right: status cards showing connection state, quick links, and memory
 *        counts. Stacks vertically on mobile.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Terminal,
  Plug,
  Hammer,
  Settings as SettingsIcon,
  Brain,
  Search,
  Clock,
  FileText,
  ArrowRight,
  GitBranch,
  ShieldCheck,
  Users,
  MessageSquareText,
  X,
} from "lucide-react";
import {
  aiChatEnvEnabled,
  fetchAiChatTenantSettings,
  type AiChatTenantSettings,
  type ChannelStatus,
} from "@/components/admin/aiChatConfig";
import { useSession } from "@/lib/auth";
import { highlightSearchText } from "./searchHighlight";

interface MemoryStats {
  business_context?: number;
  library?: number;
  sessions?: number;
  facts?: number;
  conversations?: number;
  code?: number;
}

interface ConnectionCheck {
  connected: boolean;
  configured: boolean;
  fact_count: number;
  last_session: string | null;
  last_used_at: string | null;
}

interface OrchestratorContext {
  version: string;
  generated_at: string;
  current_state_card: {
    summary: string;
    newest_activity_at: string | null;
    newest_checkin_at: string | null;
    active_todo_count: number;
    blocker_count: number;
    active_seat_count: number;
    next_actions: string[];
    blockers: string[];
    live_sources: Record<string, number>;
  };
  profile_cards: Array<{
    agent_id: string;
    label: string;
    role: "human" | "ai-seat";
    emoji?: string | null;
    device_hint?: string | null;
    source_app_label?: string | null;
    connection_label?: string | null;
    last_seen_at?: string | null;
    freshness_label?: SeatFreshnessLabel | null;
    checkin_age_minutes?: number | null;
    current_status?: string | null;
    next_checkin_at?: string | null;
  }>;
  human_operator_time?: {
    timezone: string;
    source: "browser" | "manual" | "unknown";
    local_date: string;
    local_time: string;
    utc_offset: string | null;
    updated_at?: string | null;
    privacy: "timezone-only";
    summary: string;
  } | null;
  continuity_events: Array<{
    source_kind: string;
    source_id: string;
    deep_link?: string | null;
    created_at?: string | null;
    kind: string;
    actor_agent_id?: string | null;
    role?: string | null;
    summary: string;
    tags?: string[];
  }>;
  library_snapshots: Array<{
    source_kind: string;
    source_id: string;
    deep_link?: string | null;
    title: string;
    category: string;
    summary?: string;
    tags?: string[];
    updated_at?: string | null;
  }>;
}

type ConnectionTier = "channel" | "gemini" | "unconfigured";
type SeatFreshnessLabel = "Live" | "Recent" | "Missed check-in" | "Quiet";
type OrchestratorProfileCard = OrchestratorContext["profile_cards"][number];
type OrchestratorContinuityEvent = OrchestratorContext["continuity_events"][number];
type ActorTone = "human" | "seat" | "system" | "work";

interface ActorIdentity {
  emoji: string;
  label: string;
  detail: string;
  tone: ActorTone;
}

const FRESHNESS_STYLES: Record<SeatFreshnessLabel, string> = {
  Live: "border-[#61C1C4]/35 bg-[#61C1C4]/10 text-[#61C1C4]",
  Recent: "border-white/[0.08] bg-white/[0.04] text-white/60",
  "Missed check-in": "border-[#E2B93B]/35 bg-[#E2B93B]/10 text-[#E2B93B]",
  Quiet: "border-white/[0.06] bg-black/20 text-white/35",
};

const ACTOR_TONE_STYLES: Record<ActorTone, string> = {
  human: "border-[#E2B93B]/30 bg-[#E2B93B]/10 text-[#E2B93B]",
  seat: "border-[#61C1C4]/30 bg-[#61C1C4]/10 text-[#61C1C4]",
  system: "border-white/[0.08] bg-white/[0.04] text-white/65",
  work: "border-[#8EC5FF]/25 bg-[#8EC5FF]/10 text-[#8EC5FF]",
};

const EASY_READ_STORAGE_KEY = "unclick_orchestrator_easy_read_v1";
const DRIPFEED_EDUCATION_STORAGE_KEY = "unclick_orchestrator_dripfeed_education_v1";
const ANALOGY_STORAGE_KEY = "unclick_orchestrator_analogy_v1";
const EVENT_PREVIEW_CHARS = 520;
const NATURAL_CONTEXT_PREVIEW_CHARS = 360;

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "never";
  const ts = new Date(iso).getTime();
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatAbsolute(iso: string | null | undefined): string {
  if (!iso) return "No date";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function normalizeSearch(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function compactSearch(value: string): string {
  return normalizeSearch(value).replace(/[\s:_-]+/g, "");
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

function buildProfileLookup(profiles: OrchestratorProfileCard[] | undefined): Map<string, OrchestratorProfileCard> {
  return new Map((profiles ?? []).map((profile) => [profile.agent_id, profile]));
}

function humanizeAgentId(agentId: string): string {
  return agentId
    .replace(/^human[-_]/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .slice(0, 44);
}

function sourceLabel(sourceKind: string): string {
  return sourceKind.replace(/_/g, " ");
}

function sourceFallbackIdentity(event: OrchestratorContinuityEvent): ActorIdentity {
  const source = sourceLabel(event.source_kind);
  if (event.role === "user") {
    return { emoji: "👤", label: "Human", detail: source, tone: "human" };
  }
  if (event.role === "assistant") {
    return { emoji: "🤖", label: "AI Assistant", detail: source, tone: "seat" };
  }
  if (event.source_kind === "todo") {
    return { emoji: "📋", label: "Job", detail: event.kind, tone: "work" };
  }
  if (event.source_kind === "todo_comment" || event.source_kind === "boardroom_message") {
    return { emoji: "💬", label: "Boardroom", detail: event.kind, tone: "work" };
  }
  if (event.source_kind === "signal") {
    return { emoji: "⚠️", label: "Signal", detail: event.kind, tone: "work" };
  }
  if (event.source_kind === "session_summary") {
    return { emoji: "🧠", label: "Session", detail: event.kind, tone: "system" };
  }
  if (event.source_kind === "library") {
    return { emoji: "📚", label: "Library", detail: event.kind, tone: "system" };
  }
  return { emoji: "•", label: source, detail: event.kind, tone: "system" };
}

function actorIdentityForEvent(
  event: OrchestratorContinuityEvent,
  profileByAgentId: Map<string, OrchestratorProfileCard>,
): ActorIdentity {
  if (event.actor_agent_id) {
    const profile = profileByAgentId.get(event.actor_agent_id);
    if (profile) {
      const fallbackEmoji = profile.role === "human" ? "👤" : "🤖";
      return {
        emoji: profile.emoji ?? fallbackEmoji,
        label: profile.label,
        detail: profile.source_app_label ?? (profile.role === "human" ? "Human" : "AI Seat"),
        tone: profile.role === "human" ? "human" : "seat",
      };
    }
    const isHuman = event.actor_agent_id.startsWith("human-");
    return {
      emoji: isHuman ? "👤" : "🤖",
      label: humanizeAgentId(event.actor_agent_id),
      detail: sourceLabel(event.source_kind),
      tone: isHuman ? "human" : "seat",
    };
  }
  return sourceFallbackIdentity(event);
}

function easyReadForEvent(event: OrchestratorContinuityEvent, actor: ActorIdentity): string {
  const summary = event.summary.trim();
  const cleanSummary = summary
    .replace(/^PASS:\s*/i, "")
    .replace(/^BLOCKER:\s*/i, "")
    .replace(/^(user|assistant):\s*/i, "")
    .trim();

  if (/scopepack|turn-ingest|subscription seats|mc_conversation_log|chat_messages/i.test(summary)) {
    return `${actor.emoji} ${actor.label} wrote the next small build step. It is about getting subscription chat messages to show inside Orchestrator.`;
  }
  if (/PR\s*#?\d+|merged|deployed|checks? (are )?green|production checks/i.test(summary)) {
    return `${actor.emoji} ${actor.label} shipped a change and left proof that the checks passed.`;
  }
  if (/^PASS:/i.test(summary)) {
    return `${actor.emoji} ${actor.label} moved one useful step forward. ${cleanSummary}`;
  }
  if (/^BLOCKER:/i.test(summary)) {
    return `Needs help: ${actor.label} stopped safely and says what is blocking it. ${cleanSummary}`;
  }
  if (event.kind === "proof") {
    return `${actor.emoji} ${actor.label} left a proof note so the work can be trusted.`;
  }
  if (event.kind === "decision" || event.tags?.includes("decision")) {
    return `${actor.emoji} Decision from ${actor.label}. This should guide what seats do next.`;
  }
  if (event.source_kind === "todo") {
    return "Job update: this work card changed.";
  }
  if (event.source_kind === "signal") {
    return "Signal to notice: something needs attention.";
  }
  if (event.role === "user") {
    return `Chris said: ${cleanSummary}`;
  }
  if (event.role === "assistant") {
    return `AI replied: ${cleanSummary}`;
  }
  return `${actor.emoji} ${actor.label} added a short update.`;
}

function educationHintForEvent(event: OrchestratorContinuityEvent): string {
  if (/^PASS:/i.test(event.summary)) {
    return "Hint: PASS means something useful moved forward and there should be proof nearby.";
  }
  if (/^BLOCKER:/i.test(event.summary)) {
    return "Hint: BLOCKER means a seat stopped safely instead of guessing.";
  }
  if (event.kind === "proof") {
    return "Hint: proof is the receipt that tells you why a change can be trusted.";
  }
  if (event.kind === "decision" || event.tags?.includes("decision")) {
    return "Hint: decision means this should guide future seats until Chris changes it.";
  }
  if (event.source_kind === "signal") {
    return "Hint: signals are attention lights. They point to things worth checking.";
  }
  if (event.source_kind === "todo") {
    return "Hint: jobs are the work cards seats can claim, prove, and close.";
  }
  if (event.source_kind === "boardroom_message") {
    return "Hint: Boardroom is where seats leave short shared work updates.";
  }
  if (event.source_kind === "conversation_turn") {
    return "Hint: chat turns are context breadcrumbs from the human or AI conversation.";
  }
  return "Hint: keywords like proof, blocker, decision, and signal tell Orchestrator what kind of update this is.";
}

function analogyForEvent(event: OrchestratorContinuityEvent): string {
  if (/^PASS:/i.test(event.summary) || event.kind === "proof") {
    return "Analogy: like a worker leaving a signed receipt after finishing a small job.";
  }
  if (/^BLOCKER:/i.test(event.summary) || event.source_kind === "signal") {
    return "Analogy: like a warning light on the dashboard asking for a quick look.";
  }
  if (event.kind === "decision" || event.tags?.includes("decision")) {
    return "Analogy: like putting a sticky note on the control panel so everyone steers the same way.";
  }
  if (event.source_kind === "todo") {
    return "Analogy: like a card on the work board moving from waiting to doing to done.";
  }
  if (event.source_kind === "conversation_turn") {
    return "Analogy: like adding a fresh line to the shared notebook everyone reads from.";
  }
  return "Analogy: like one more breadcrumb in the trail Orchestrator follows.";
}

function shouldShowDrip(index: number, event: OrchestratorContinuityEvent): boolean {
  return index === 0 || event.kind === "decision" || event.kind === "proof" || /^BLOCKER:/i.test(event.summary) || index % 4 === 0;
}

function readStoredBoolean(key: string, defaultValue: boolean): boolean {
  try {
    const saved = localStorage.getItem(key);
    return saved ? saved === "true" : defaultValue;
  } catch {
    return defaultValue;
  }
}

function writeStoredBoolean(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Local storage can be unavailable in private browsing; the UI still works for this session.
  }
}

function eventSearchText(
  event: OrchestratorContinuityEvent,
  actor: ActorIdentity,
  absoluteDate: string,
): string {
  return [
    actor.emoji,
    actor.label,
    actor.detail,
    event.kind,
    event.source_kind,
    event.actor_agent_id,
    event.role,
    event.summary,
    easyReadForEvent(event, actor),
    educationHintForEvent(event),
    analogyForEvent(event),
    absoluteDate,
    ...(event.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

function matchesEventSearch(
  event: OrchestratorContinuityEvent,
  actor: ActorIdentity,
  query: string,
): boolean {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return true;

  const text = normalizeSearch(eventSearchText(event, actor, formatAbsolute(event.created_at)));
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

function truncateText(value: string, maxChars: number): { text: string; truncated: boolean } {
  if (value.length <= maxChars) return { text: value, truncated: false };
  const sliced = value.slice(0, maxChars).trimEnd();
  return {
    text: `${sliced.replace(/[,.:\s]+$/, "")}...`,
    truncated: true,
  };
}

export default function AdminOrchestratorPage() {
  const [storedApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem("unclick_api_key") ?? "";
    } catch {
      return "";
    }
  });
  const { session, loading: sessionLoading } = useSession();
  const authToken = session?.access_token ?? storedApiKey;
  const [channel, setChannel] = useState<ChannelStatus | null>(null);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [connection, setConnection] = useState<ConnectionCheck | null>(null);
  const [tenant, setTenant] = useState<AiChatTenantSettings | null>(null);
  const [orchestratorContext, setOrchestratorContext] = useState<OrchestratorContext | null>(null);
  const [loading, setLoading] = useState(true);

  const envEnabled = aiChatEnvEnabled();

  useEffect(() => {
    if (sessionLoading) return;
    if (!authToken) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [channelRes, statusRes, connRes, contextRes, tenantRes] = await Promise.all([
          fetch("/api/memory-admin?action=admin_channel_status", {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
          fetch("/api/memory-admin?action=status", {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
          fetch(
            `/api/memory-admin?action=admin_check_connection&api_key=${encodeURIComponent(storedApiKey)}`,
          ),
          fetch("/api/memory-admin?action=orchestrator_context_read&limit=80", {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
          fetchAiChatTenantSettings(authToken),
        ]);
        if (cancelled) return;
        if (channelRes.ok) setChannel((await channelRes.json()) as ChannelStatus);
        if (statusRes.ok) {
          const body = (await statusRes.json()) as MemoryStats & { data?: MemoryStats };
          setStats(body.data ?? body);
        }
        if (connRes.ok) setConnection((await connRes.json()) as ConnectionCheck);
        if (contextRes.ok) {
          const body = (await contextRes.json()) as { context?: OrchestratorContext };
          setOrchestratorContext(body.context ?? null);
        }
        if (tenantRes?.env_enabled) setTenant(tenantRes.settings);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken, sessionLoading, storedApiKey]);

  const tier: ConnectionTier = useMemo(() => {
    if (channel?.channel_active) return "channel";
    if (tenant?.has_api_key) return "gemini";
    return "unconfigured";
  }, [channel, tenant]);

  const chatDisabledReason = useMemo(() => {
    if (!envEnabled) {
      return "AI chat is disabled for this environment. Set VITE_AI_CHAT_ENABLED=true to turn it on.";
    }
    if (!authToken) {
      return "Sign in with your UnClick API key to start chatting.";
    }
    if (tenant && !tenant.ai_chat_enabled) {
      return "AI chat is turned off in your tenant settings. Enable it in Settings to use the Orchestrator.";
    }
    return null;
  }, [envEnabled, authToken, tenant]);

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#61C1C4]/10 text-[#61C1C4]">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Orchestrator</h1>
          <p className="text-sm text-white/50">
            Your AI command center. Chat, sync context, connect seats, and hand off work.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        {/* Main continuity pane */}
        <div className="flex min-h-[620px] flex-col">
          <OrchestratorContinuityPanel
            context={orchestratorContext}
            loading={loading || sessionLoading}
            chatStatusLabel={chatDisabledReason ? "Chat disabled" : tier === "channel" ? "Claude Code bridge available" : "AI chat available"}
            authToken={authToken}
          />
        </div>

        {/* Right rail */}
        <aside className="space-y-4">
          <OrchestratorContextCard
            context={orchestratorContext}
            loading={loading || sessionLoading}
          />
          <ConnectionCard
            tier={tier}
            channel={channel}
            tenant={tenant}
            connection={connection}
            loading={loading}
          />
          <QuickLinksCard />
          <MemoryStatsCard stats={stats} loading={loading} />
        </aside>
      </div>
    </>
  );
}

function OrchestratorContinuityPanel({
  context,
  loading,
  chatStatusLabel,
  authToken,
}: {
  context: OrchestratorContext | null;
  loading: boolean;
  chatStatusLabel: string;
  authToken: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [serverSearchContext, setServerSearchContext] = useState<OrchestratorContext | null>(null);
  const [serverSearchLoading, setServerSearchLoading] = useState(false);
  const trimmedSearchQuery = searchQuery.trim();
  useEffect(() => {
    if (!authToken || trimmedSearchQuery.length === 0) {
      setServerSearchContext(null);
      setServerSearchLoading(false);
      return;
    }

    let cancelled = false;
    setServerSearchLoading(true);
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/memory-admin?action=orchestrator_context_read&limit=120&q=${encodeURIComponent(trimmedSearchQuery)}`,
            { headers: { Authorization: `Bearer ${authToken}` } },
          );
          if (cancelled) return;
          if (res.ok) {
            const body = (await res.json()) as { context?: OrchestratorContext };
            setServerSearchContext(body.context ?? null);
          } else {
            setServerSearchContext(null);
          }
        } finally {
          if (!cancelled) setServerSearchLoading(false);
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [authToken, trimmedSearchQuery]);

  const feedContext = trimmedSearchQuery && serverSearchContext ? serverSearchContext : context;
  const events = useMemo(
    () => feedContext?.continuity_events ?? [],
    [feedContext?.continuity_events],
  );
  const [easyRead, setEasyRead] = useState(() => readStoredBoolean(EASY_READ_STORAGE_KEY, true));
  const [dripfeedEducation, setDripfeedEducation] = useState(() =>
    readStoredBoolean(DRIPFEED_EDUCATION_STORAGE_KEY, true),
  );
  const [analogies, setAnalogies] = useState(() => readStoredBoolean(ANALOGY_STORAGE_KEY, true));
  const profileByAgentId = useMemo(
    () => buildProfileLookup(feedContext?.profile_cards),
    [feedContext?.profile_cards],
  );
  const eventViews = useMemo(
    () =>
      events.map((event, index) => {
        const actor = actorIdentityForEvent(event, profileByAgentId);
        const absoluteDate = formatAbsolute(event.created_at);
        return {
          event,
          actor,
          index,
          absoluteDate,
          easySummary: easyReadForEvent(event, actor),
        };
      }),
    [events, profileByAgentId],
  );
  const filteredEventViews = useMemo(
    () =>
      eventViews.filter(({ event, actor }) => matchesEventSearch(event, actor, searchQuery)),
    [eventViews, searchQuery],
  );

  function toggleEasyRead(nextValue: boolean) {
    setEasyRead(nextValue);
    writeStoredBoolean(EASY_READ_STORAGE_KEY, nextValue);
  }

  function toggleDripfeedEducation(nextValue: boolean) {
    setDripfeedEducation(nextValue);
    writeStoredBoolean(DRIPFEED_EDUCATION_STORAGE_KEY, nextValue);
  }

  function toggleAnalogies(nextValue: boolean) {
    setAnalogies(nextValue);
    writeStoredBoolean(ANALOGY_STORAGE_KEY, nextValue);
  }

  return (
    <section className="flex min-h-[620px] flex-col rounded-2xl border border-white/[0.08] bg-[#0d0d0d]">
      <header className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-[#61C1C4]" />
            <h2 className="text-sm font-semibold text-white">Continuity Feed</h2>
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-white/45">
            Read-only context from UnClick memory, Boardroom, Jobs, signals, heartbeats, and saved chat summaries.
            Live Claude/ChatGPT subscription transcripts only appear here after those clients send or save them to UnClick.
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-[#61C1C4]/25 bg-[#61C1C4]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#61C1C4]">
          Read only
        </span>
      </header>

      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3 text-[11px] text-white/40">
        <span>{chatStatusLabel}</span>
        <span>
          {serverSearchLoading
            ? "Searching all continuity..."
            : searchQuery.trim()
            ? `${filteredEventViews.length} of ${events.length} events match`
            : `${events.length} loaded event${events.length === 1 ? "" : "s"}`}
        </span>
      </div>

      <div className="grid gap-3 border-b border-white/[0.06] px-5 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-white/30" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Filter Orchestrator feed"
            className="w-full rounded-md border border-white/[0.06] bg-black/20 py-2 pl-8 pr-8 text-sm text-white/80 outline-none transition-colors placeholder:text-white/25 focus:border-[#61C1C4]/35"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-2 rounded-[5px] p-1 text-white/35 hover:bg-white/[0.06] hover:text-white/65"
              aria-label="Clear Orchestrator feed filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
          <span>
            <span className="block text-xs font-medium text-white/75">Easy reading for humans</span>
            <span className="block text-[10px] text-white/35">
              {easyRead ? "Friendly layer on" : "Natural context view"}
            </span>
          </span>
          <input
            type="checkbox"
            aria-label="Easy reading for humans"
            checked={easyRead}
            onChange={(event) => toggleEasyRead(event.target.checked)}
            className="sr-only"
          />
          <span className={`relative h-6 w-11 rounded-full border transition ${easyRead ? "border-[#61C1C4]/40 bg-[#61C1C4]/25" : "border-white/[0.08] bg-white/[0.08]"}`}>
            <span className={`absolute top-1 h-4 w-4 rounded-full transition ${easyRead ? "left-6 bg-[#61C1C4]" : "left-1 bg-white/55"}`} />
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-5 py-3 text-xs text-white/55">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            aria-label="Dripfeed Education"
            checked={dripfeedEducation}
            onChange={(event) => toggleDripfeedEducation(event.target.checked)}
            className="h-4 w-4 rounded border-white/[0.12] bg-black/30 accent-[#61C1C4]"
          />
          <span>Dripfeed Education</span>
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            aria-label="Analogies"
            checked={analogies}
            onChange={(event) => toggleAnalogies(event.target.checked)}
            className="h-4 w-4 rounded border-white/[0.12] bg-black/30 accent-[#61C1C4]"
          />
          <span>Analogies</span>
        </label>
        <span className="text-[11px] text-white/30">
          These only add friendly hints in Easy reading mode.
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {loading && (
          <p className="text-sm text-white/45">Loading Orchestrator continuity...</p>
        )}
        {!loading && events.length === 0 && (
          <div className="rounded-xl border border-white/[0.08] bg-black/20 p-5 text-sm leading-6 text-white/55">
            No continuity events are available yet. Ask a connected AI seat to save a session, post to Boardroom,
            or run the UnClick heartbeat so Orchestrator has something to show.
          </div>
        )}
        {!loading && events.length > 0 && filteredEventViews.length === 0 && (
          <div className="rounded-xl border border-white/[0.08] bg-black/20 p-5 text-sm leading-6 text-white/55">
            No Orchestrator events match that filter.
          </div>
        )}
        {!loading && filteredEventViews.slice(0, 24).map(({ event, actor, index, absoluteDate, easySummary }) => (
          <ContinuityFeedRow
            key={`${event.source_kind}:${event.source_id}`}
            event={event}
            actor={actor}
            index={index}
            absoluteDate={absoluteDate}
            easySummary={easySummary}
            easyRead={easyRead}
            dripfeedEducation={dripfeedEducation}
            analogies={analogies}
            searchQuery={searchQuery}
          />
        ))}
      </div>
    </section>
  );
}

function ContinuityFeedRow({
  event,
  actor,
  index,
  absoluteDate,
  easySummary,
  easyRead,
  dripfeedEducation,
  analogies,
  searchQuery,
}: {
  event: OrchestratorContinuityEvent;
  actor: ActorIdentity;
  index: number;
  absoluteDate: string;
  easySummary: string;
  easyRead: boolean;
  dripfeedEducation: boolean;
  analogies: boolean;
  searchQuery: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const showFriendlyExtras = easyRead && shouldShowDrip(index, event);
  const mainText = easyRead ? easySummary : event.summary;
  const mainPreview = truncateText(mainText, EVENT_PREVIEW_CHARS);
  const naturalPreview = truncateText(event.summary, NATURAL_CONTEXT_PREVIEW_CHARS);
  const visibleMainText = expanded || !mainPreview.truncated ? mainText : mainPreview.text;
  const visibleNaturalText = expanded || !naturalPreview.truncated ? event.summary : naturalPreview.text;
  const canExpand = mainPreview.truncated || (easyRead && naturalPreview.truncated);
  const content = (
    <article className="rounded-xl border border-white/[0.06] bg-[#111111] px-4 py-3">
      <div className="mb-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-base ${ACTOR_TONE_STYLES[actor.tone]}`}>
            {actor.emoji}
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="min-w-0 truncate text-sm font-semibold text-white/85">
                {highlightSearchText(actor.label, searchQuery)}
              </span>
              <span className="rounded-md border border-[#61C1C4]/20 bg-[#61C1C4]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#61C1C4]">
                {event.kind}
              </span>
            </div>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-white/35">
              <span>{actor.detail}</span>
              <span>{sourceLabel(event.source_kind)}</span>
              {event.role && <span>{event.role}</span>}
              {event.actor_agent_id && (
                <span className="max-w-[260px] truncate font-mono text-white/25">{event.actor_agent_id}</span>
              )}
            </div>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <span className="block text-[10px] text-white/40">{formatRelative(event.created_at)}</span>
          <span className="block text-[10px] text-white/25">{highlightSearchText(absoluteDate, searchQuery)}</span>
        </div>
      </div>
      {easyRead && (
        <p className="sr-only">AI-native natural context: {event.summary}</p>
      )}
      <p className="text-sm leading-6 text-white/70">
        {highlightSearchText(visibleMainText, searchQuery)}
      </p>
      {canExpand && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 rounded-md border border-[#61C1C4]/20 bg-[#61C1C4]/5 px-2 py-1 text-[11px] font-medium text-[#A9EEF0] hover:border-[#61C1C4]/35 hover:bg-[#61C1C4]/10"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
      {easyRead && (
        <p className="mt-2 rounded-lg border border-white/[0.05] bg-black/20 px-2 py-1.5 text-[11px] leading-4 text-white/35">
          Natural context for AI: {highlightSearchText(visibleNaturalText, searchQuery)}
        </p>
      )}
      {showFriendlyExtras && dripfeedEducation && (
        <p className="mt-2 rounded-lg border border-[#61C1C4]/15 bg-[#61C1C4]/5 px-2 py-1.5 text-[11px] leading-4 text-[#A9EEF0]/80">
          {highlightSearchText(educationHintForEvent(event), searchQuery)}
        </p>
      )}
      {showFriendlyExtras && analogies && (
        <p className="mt-2 rounded-lg border border-[#E2B93B]/15 bg-[#E2B93B]/5 px-2 py-1.5 text-[11px] leading-4 text-[#F1D982]/80">
          {highlightSearchText(analogyForEvent(event), searchQuery)}
        </p>
      )}
      {event.tags && event.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {event.tags.slice(0, 5).map((tag) => (
            <span key={tag} className="rounded border border-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/30">
              {tag}
            </span>
          ))}
        </div>
      )}
      {event.deep_link?.startsWith("/") && (
        <div className="mt-3">
          <Link
            to={event.deep_link}
            className="inline-flex items-center rounded-md border border-white/[0.08] px-2 py-1 text-[11px] font-medium text-white/45 hover:border-[#61C1C4]/30 hover:text-[#A9EEF0]"
          >
            Open source
          </Link>
        </div>
      )}
    </article>
  );

  return content;
}

function OrchestratorContextCard({
  context,
  loading,
}: {
  context: OrchestratorContext | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <section className="rounded-2xl border border-white/[0.08] bg-[#111111] p-4">
        <div className="flex items-center gap-2 text-sm text-white/60">
          <Brain className="h-4 w-4 text-[#61C1C4]" />
          Loading Orchestrator context...
        </div>
      </section>
    );
  }

  if (!context) {
    return (
      <section className="rounded-2xl border border-white/[0.08] bg-[#111111] p-4">
        <header className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-[#61C1C4]" />
          <h3 className="text-sm font-semibold text-white">Orchestrator Context</h3>
        </header>
        <p className="mt-3 text-xs leading-5 text-white/45">
          No compact state is available yet.
        </p>
      </section>
    );
  }

  const profileByAgentId = buildProfileLookup(context.profile_cards);
  const state = context.current_state_card;
  const topSources = Object.entries(state.live_sources)
    .filter(([, value]) => value > 0)
    .slice(0, 4);

  return (
    <section className="rounded-2xl border border-[#61C1C4]/20 bg-[#101818] p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-[#61C1C4]" />
            <h3 className="text-sm font-semibold text-white">Orchestrator Context</h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-white/55">{state.summary}</p>
        </div>
        <span className="shrink-0 rounded-md border border-[#61C1C4]/25 bg-[#61C1C4]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#61C1C4]">
          Read only
        </span>
      </header>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniMetric icon={FileText} label="Jobs" value={state.active_todo_count} />
        <MiniMetric icon={Users} label="Seats" value={state.active_seat_count} />
        <MiniMetric icon={ShieldCheck} label="Blocks" value={state.blocker_count} />
      </div>

      <div className="mt-4 space-y-3">
        {context.human_operator_time && (
          <ContextSection title="Human Time" icon={Clock}>
            <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-white/75">
                  {context.human_operator_time.local_time}
                </span>
                <span className="text-[10px] text-white/35">
                  {context.human_operator_time.source === "manual" ? "Manual" : "Browser"}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-4 text-white/45">
                {context.human_operator_time.local_date} {context.human_operator_time.timezone}
                {context.human_operator_time.utc_offset ? ` ${context.human_operator_time.utc_offset}` : ""}
              </p>
            </div>
          </ContextSection>
        )}

        <ContextSection title="Next" icon={ArrowRight}>
          {state.next_actions.length > 0 ? (
            state.next_actions.slice(0, 4).map((action) => (
              <p key={action} className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-xs leading-5 text-white/65">
                {action}
              </p>
            ))
          ) : (
            <p className="text-xs text-white/35">No active next action loaded.</p>
          )}
        </ContextSection>

        <ContextSection title="Continuity" icon={GitBranch}>
          {context.continuity_events.slice(0, 5).map((event) => (
            <ContinuityRow
              key={`${event.source_kind}:${event.source_id}`}
              event={event}
              profileByAgentId={profileByAgentId}
            />
          ))}
          {context.continuity_events.length === 0 && (
            <p className="text-xs text-white/35">No continuity events loaded.</p>
          )}
        </ContextSection>

        <ContextSection title="Connected PCs" icon={Terminal}>
          {context.profile_cards.slice(0, 5).map((profile) => (
            <div key={profile.agent_id} className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <span className="min-w-0 truncate text-xs font-medium text-white/75">
                  {profile.emoji ? `${profile.emoji} ` : ""}{profile.label}
                </span>
                <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${FRESHNESS_STYLES[profile.freshness_label ?? "Quiet"]}`}>
                  {profile.freshness_label ?? "Quiet"}
                </span>
              </div>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-white/35">
                <span className="font-medium text-white/50">{profile.connection_label ?? "No recent check-in"}</span>
                <span>{profile.source_app_label ?? "AI Seat"}</span>
                <span>{formatRelative(profile.last_seen_at)}</span>
                {profile.device_hint && <span className="max-w-full truncate font-mono">{profile.device_hint}</span>}
              </div>
            </div>
          ))}
          {context.profile_cards.length === 0 && (
            <p className="text-xs text-white/35">No profile cards loaded.</p>
          )}
        </ContextSection>

        <ContextSection title="Snapshots" icon={FileText}>
          {context.library_snapshots.slice(0, 4).map((snapshot) => (
            <SnapshotRow key={`${snapshot.source_kind}:${snapshot.source_id}`} snapshot={snapshot} />
          ))}
          {context.library_snapshots.length === 0 && (
            <p className="text-xs text-white/35">No library snapshots loaded.</p>
          )}
        </ContextSection>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {topSources.map(([key, value]) => (
          <span key={key} className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-1 text-[10px] text-white/35">
            {key.replace(/_/g, " ")} {value}
          </span>
        ))}
      </div>
    </section>
  );
}

function ContextSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Brain;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
        <Icon className="h-3 w-3 text-[#61C1C4]/70" />
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function MiniMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Brain;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/35">
        <Icon className="h-3 w-3 text-[#61C1C4]/70" />
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function ContinuityRow({
  event,
  profileByAgentId,
}: {
  event: OrchestratorContinuityEvent;
  profileByAgentId: Map<string, OrchestratorProfileCard>;
}) {
  const actor = actorIdentityForEvent(event, profileByAgentId);
  const content = (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs ${ACTOR_TONE_STYLES[actor.tone]}`}>
            {actor.emoji}
          </span>
          <span className="min-w-0 truncate text-[11px] font-semibold text-white/75">{actor.label}</span>
        </div>
        <span className="shrink-0 text-[10px] text-white/30">{formatRelative(event.created_at)}</span>
      </div>
      <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] text-white/35">
        <span className="font-semibold uppercase text-[#61C1C4]">{event.kind}</span>
        <span>{sourceLabel(event.source_kind)}</span>
      </div>
      <p className="line-clamp-2 text-xs leading-5 text-white/65">{event.summary}</p>
    </div>
  );

  if (event.deep_link?.startsWith("/")) {
    return <Link to={event.deep_link}>{content}</Link>;
  }

  return content;
}

function SnapshotRow({ snapshot }: { snapshot: OrchestratorContext["library_snapshots"][number] }) {
  const content = (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-medium text-white/75">{snapshot.title}</p>
        <span className="shrink-0 text-[10px] text-white/30">{snapshot.category}</span>
      </div>
      {snapshot.summary && (
        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-white/45">{snapshot.summary}</p>
      )}
    </div>
  );

  if (snapshot.deep_link?.startsWith("/")) {
    return <Link to={snapshot.deep_link}>{content}</Link>;
  }

  return content;
}

function ConnectionCard({
  tier,
  channel,
  tenant,
  connection,
  loading,
}: {
  tier: ConnectionTier;
  channel: ChannelStatus | null;
  tenant: AiChatTenantSettings | null;
  connection: ConnectionCheck | null;
  loading: boolean;
}) {
  const palette = {
    channel: {
      dot: "bg-[#61C1C4]",
      label: "Claude Code channel active",
      icon: Terminal,
      tone: "text-[#61C1C4]",
      border: "border-[#61C1C4]/30 bg-[#61C1C4]/5",
    },
    gemini: {
      dot: "bg-[#E2B93B]",
      label: "Gemini fallback",
      icon: Sparkles,
      tone: "text-[#E2B93B]",
      border: "border-[#E2B93B]/30 bg-[#E2B93B]/5",
    },
    unconfigured: {
      dot: "bg-white/30",
      label: "Not configured",
      icon: Plug,
      tone: "text-white/60",
      border: "border-white/[0.08] bg-white/[0.02]",
    },
  }[tier];

  const Icon = palette.icon;

  return (
    <section className={`rounded-2xl border p-4 ${palette.border}`}>
      <header className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${palette.dot}`} />
        <h3 className={`inline-flex items-center gap-1.5 text-sm font-semibold ${palette.tone}`}>
          <Icon className="h-3.5 w-3.5" />
          {palette.label}
        </h3>
      </header>
      <div className="mt-3 space-y-2 text-xs text-white/60">
        {loading && <p>Loading...</p>}
        {!loading && tier === "channel" && (
          <>
            <p>
              Admin chat is routing through your local Claude Code session. No
              separate AI key needed.
            </p>
            {channel?.client_info && (
              <p className="truncate font-mono text-[10px] text-white/40">
                {channel.client_info}
              </p>
            )}
            {channel?.last_seen && (
              <p className="text-[10px] text-white/40">
                Last heartbeat {formatRelative(channel.last_seen)}
              </p>
            )}
          </>
        )}
        {!loading && tier === "gemini" && (
          <p>
            Using server-side Gemini. Launch the Claude Code channel to swap to
            your own Claude session for free.
          </p>
        )}
        {!loading && tier === "unconfigured" && (
          <p>
            No AI provider configured. Connect Claude Code or set a tenant AI
            key in Settings.
          </p>
        )}
        {!loading && connection?.connected && (
          <p className="text-[10px] text-white/40">
            MCP handshake {formatRelative(connection.last_used_at ?? connection.last_session)}
          </p>
        )}
      </div>
    </section>
  );
}

function QuickLinksCard() {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#111111] p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">
        Quick links
      </h3>
      <div className="space-y-2">
        <LinkRow
          to="/memory/connect"
          icon={Plug}
          title="Connect Claude Code"
          subtitle="One command to wire it up"
        />
        <LinkRow
          to="/build"
          icon={Hammer}
          title="Build Tasks"
          subtitle="Plan and track your work"
        />
        <LinkRow
          to="/admin/settings"
          icon={SettingsIcon}
          title="Settings"
          subtitle="AI providers, kill switches"
        />
      </div>
    </section>
  );
}

function LinkRow({
  to,
  icon: Icon,
  title,
  subtitle,
}: {
  to: string;
  icon: typeof Plug;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:border-[#61C1C4]/30 hover:bg-[#61C1C4]/5"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#61C1C4]/10 text-[#61C1C4]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{title}</p>
        <p className="truncate text-[11px] text-white/40">{subtitle}</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/30 transition-colors group-hover:text-[#61C1C4]" />
    </Link>
  );
}

function MemoryStatsCard({
  stats,
  loading,
}: {
  stats: MemoryStats | null;
  loading: boolean;
}) {
  const items = [
    { key: "facts" as const, label: "Facts", icon: Search },
    { key: "sessions" as const, label: "Sessions", icon: Clock },
    { key: "business_context" as const, label: "Context", icon: FileText },
    { key: "conversations" as const, label: "Convos", icon: Brain },
  ];
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#111111] p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">
        Memory
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {items.map(({ key, label, icon: Icon }) => {
          const value = stats?.[key];
          const display = loading ? "..." : typeof value === "number" ? value.toLocaleString() : "0";
          return (
            <div key={key} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-white/40">
                <Icon className="h-3 w-3 text-[#61C1C4]/70" />
                {label}
              </div>
              <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-white">
                {display}
              </div>
            </div>
          );
        })}
      </div>
      <Link
        to="/admin/memory"
        className="mt-3 inline-flex items-center gap-1 text-[11px] text-[#61C1C4] hover:underline"
      >
        Open Memory Admin
        <ArrowRight className="h-3 w-3" />
      </Link>
    </section>
  );
}

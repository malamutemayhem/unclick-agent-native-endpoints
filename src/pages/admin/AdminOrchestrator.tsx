/**
 * Admin Orchestrator - the AI command center.
 *
 * Left: read-only continuity feed for seat/subscription context.
 * Right: status cards showing connection state, quick links, and memory
 *        counts. Stacks vertically on mobile.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Sparkles,
  Terminal,
  BookOpen,
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
const INITIAL_CONTEXT_LIMIT = 240;
const MAX_CONTEXT_LIMIT = 500;
const CONTINUITY_VISIBLE_STEP = 24;
const STORY_CHAPTER_VISIBLE_STEP = 36;
const STORY_CHAPTER_SPLIT_MS = 18 * 60_000;
const STORY_CHAPTER_MAX_TOTAL = 72;
const STORY_CHAPTER_MAX_EVENTS = 4;
const STORY_CHAPTER_PREVIEW_CHARS = 1_450;
const STORY_NATIVE_PREVIEW_COUNT = 5;
const STORY_NATIVE_STORAGE_KEY = "unclick_orchestrator_story_native_v1";

type StoryTheme = "question" | "orchestrator" | "autopilot" | "blocker" | "shipping" | "signals" | "general";
type StoryBeat =
  | "big-question"
  | "session-direction"
  | "orchestrator-story"
  | "queuepush"
  | "worker2"
  | "shipping"
  | "where-we-are";

interface StoryChapter {
  key: string;
  theme: StoryTheme;
  title: string;
  emoji: string;
  events: OrchestratorContinuityEvent[];
  startedAt: string | null;
  endedAt: string | null;
  narrative: string;
  nativeNotes: string[];
}

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

function cleanStoryText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^user:\s*/i, "")
    .replace(/^assistant:\s*/i, "")
    .replace(/^AI replied:\s*/i, "")
    .replace(/^Chris said:\s*/i, "")
    .replace(/^PASS:\s*/i, "")
    .replace(/^BLOCKER:\s*/i, "")
    .trim();
}

function chapterSourceText(events: OrchestratorContinuityEvent[]): string {
  return events
    .map((event) => [event.kind, event.source_kind, event.role, event.summary, ...(event.tags ?? [])].join(" "))
    .join(" ")
    .toLowerCase();
}

function themeForEvent(event: OrchestratorContinuityEvent): StoryTheme {
  const text = chapterSourceText([event]);
  if (
    /^blocker:/i.test(event.summary) ||
    event.kind === "blocker" ||
    /\b(blocker|stale_ack|unclear_owner|queue hydration|active_jobs=0|worker2|missed_next_checkin)\b/.test(text)
  ) {
    return "blocker";
  }
  if (/\b(orchestrator story|story view|story page|orchestrator continuity|orchestrator)\b/.test(text)) {
    return "orchestrator";
  }
  if (/\b(autopilot|runner|queuepush|pinballwake|nudgeonly|igniteonly|pushonly|claimability|fleet throughput|#715|#726)\b/.test(text)) {
    return "autopilot";
  }
  if (/\b(broadcast|achievable|greenlight|todo|todos|question|asked)\b/.test(text) || event.role === "user") {
    return "question";
  }
  if (/^pass:/i.test(event.summary) || /\b(merged|checks passed|green|vercel|testpass|shipped|proof landed)\b/.test(text)) {
    return "shipping";
  }
  if (/\b(signal|wakepass|alert|reroute|dispatch)\b/.test(text)) {
    return "signals";
  }
  return "general";
}

function chapterTheme(events: OrchestratorContinuityEvent[]): StoryTheme {
  const scores: Record<StoryTheme, number> = {
    question: 0,
    orchestrator: 0,
    autopilot: 0,
    blocker: 0,
    shipping: 0,
    signals: 0,
    general: 0,
  };
  for (const event of events) {
    const theme = themeForEvent(event);
    scores[theme] += theme === "blocker" ? 3 : theme === "signals" ? 1 : 2;
  }
  if (scores.blocker > 0) return "blocker";
  return (Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] as StoryTheme) ?? "general";
}

function chapterTitle(theme: StoryTheme, events: OrchestratorContinuityEvent[]): { emoji: string; title: string } {
  const text = chapterSourceText(events);
  if (hasRunnerFreshness(text)) {
    return { emoji: "👀", title: "Watching the scheduled runner" };
  }
  if (hasSessionDecision(text)) {
    return { emoji: "🧠", title: "Fresh direction from Session" };
  }
  if (hasQueuePush(text) && hasStaleAck(text)) return { emoji: "📬", title: "QueuePush needs a clean answer" };
  if (hasStaleAck(text)) return { emoji: "👀", title: "A handoff is waiting" };
  if (/worker2|queue hydration|active_jobs=0/.test(text)) return { emoji: "⚠️", title: "The worker2 situation" };
  if (/orchestrator story|story view|story page|#724/.test(text)) {
    return { emoji: "🟢", title: "Orchestrator Story, tucked into place" };
  }
  if (/queuepush|#726/.test(text)) return { emoji: "📬", title: "QueuePush gets less noisy" };
  if (/runner|claimability|pinballwake/.test(text)) return { emoji: "🚦", title: "The runner check-in" };
  if (/achievable|broadcast|greenlight|todo/.test(text)) return { emoji: "🌅", title: "The big question" };
  if (/merged|checks passed|proof landed|shipped/.test(text)) return { emoji: "✅", title: "Proof landed" };
  if (/wakepass|signal|alert|dispatch/.test(text)) return { emoji: "📡", title: "Signals in the background" };
  const fallback: Record<StoryTheme, { emoji: string; title: string }> = {
    question: { emoji: "🌅", title: "The big question" },
    orchestrator: { emoji: "🟢", title: "Orchestrator keeps the story" },
    autopilot: { emoji: "🚀", title: "Autopilot gets sharper" },
    blocker: { emoji: "⚠️", title: "The sticky bit" },
    shipping: { emoji: "✅", title: "Small ships, clean proof" },
    signals: { emoji: "📡", title: "Signals in the background" },
    general: { emoji: "•", title: "Where we are" },
  };
  return fallback[theme];
}

function latestUserAsk(events: OrchestratorContinuityEvent[]): string | null {
  const event = events.find((item) => item.role === "user");
  if (!event) return null;
  const clean = cleanStoryText(event.summary)
    .replace(/^User asked\s*/i, "asked ")
    .replace(/^Chris said:\s*/i, "")
    .trim();
  if (!clean) return null;
  return clean.length > 170 ? `${clean.slice(0, 170).trimEnd()}...` : clean;
}

function buildFocus(events: OrchestratorContinuityEvent[]): string | null {
  const summary = events.map((event) => event.summary).find((value) => /it is about/i.test(value));
  const match = summary?.match(/it is about\s+(.+?)(?:\.|$)/i);
  if (match?.[1]) return cleanStoryText(match[1]);
  const text = chapterSourceText(events);
  if (/subscription chat messages.*orchestrator/.test(text)) {
    return "getting subscription chat messages to show properly inside Orchestrator";
  }
  if (/orchestrator story|story view|story page/.test(text)) {
    return "making Orchestrator Story read like a real running story";
  }
  if (/queuepush/.test(text)) return "making QueuePush quieter and better at closing loops";
  if (/claimability|runner/.test(text)) return "making the runner explain which jobs it can really claim";
  return null;
}

function hasRunnerFreshness(text: string): boolean {
  return /runner-freshness|autonomous-runner|next schedule|canary/.test(text);
}

function hasSessionDecision(text: string): boolean {
  return /decision from session|session.*decision|tags.*decision/.test(text);
}

function hasStaleAck(text: string): boolean {
  return /stale_ack|stale wake|wakepass stale|missed_next_checkin|ack_required/.test(text);
}

function hasQueuePush(text: string): boolean {
  return /queuepush|direct decision|direct qc packet|owner lift|reviewer\/safety/.test(text);
}

function extractPrNumbers(events: OrchestratorContinuityEvent[], limit = 4): string {
  const seen = new Set<string>();
  for (const event of events) {
    for (const match of event.summary.match(/#\d+/g) ?? []) {
      seen.add(match);
      if (seen.size >= limit) break;
    }
    if (seen.size >= limit) break;
  }
  return Array.from(seen).join(", ");
}

function storyPlainText(value: string): string {
  return cleanStoryText(value)
    .replace(/`/g, "")
    .replace(/\s+[-–—]{2,}\s+/g, ", ")
    .replace(/https?:\/\/\S+/g, "the linked page")
    .replace(/\b[a-f0-9]{8}-[a-f0-9-]{27,}\b/gi, "a saved item")
    .replace(/\b[a-f0-9]{6,}(?:\/[a-f0-9]{6,})+\b/gi, "saved items")
    .replace(/\bdispatch_[a-z0-9]+\b/gi, "a dispatch")
    .replace(/\bqueuepush:[^\s]+/gi, "QueuePush packet")
    .replace(/\brunner-freshness\b/gi, "worker health")
    .replace(/\bautonomous-runner\s+[a-z0-9+-]+/gi, "scheduled runner")
    .replace(/\{.*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstReadableSentence(value: string): string {
  const text = storyPlainText(value);
  const sentence = text.split(/(?<=[.!?])\s+/)[0] ?? text;
  return sentence.replace(/[.!?]+$/, "").trim();
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase())
    .replace(/\bPr\b/g, "PR")
    .replace(/\bQc\b/g, "QC")
    .replace(/\bUi\b/g, "UI")
    .replace(/\bAi\b/g, "AI")
    .replace(/\bApi\b/g, "API");
}

function headlineFromText(value: string, fallback: string): string {
  const clean = firstReadableSentence(value)
    .replace(/^asked\s*/i, "")
    .replace(/^new todo:\s*/i, "")
    .replace(/^todo done:\s*/i, "")
    .replace(/^decision from session\.?\s*/i, "")
    .replace(/^queuepush id:\s*/i, "")
    .replace(/^wakepass auto-reroute\s*/i, "")
    .trim();
  if (!clean) return fallback;
  const trimmed = clean.length > 58 ? `${clean.slice(0, 58).replace(/[,\s]+$/, "")}...` : clean;
  return titleCase(trimmed);
}

function storyMomentKind(event: OrchestratorContinuityEvent): "ask" | "blocker" | "decision" | "proof" | "handoff" | "work" | "context" {
  const text = chapterSourceText([event]);
  if (event.role === "user") return "ask";
  if (event.kind === "blocker" || /^blocker:/i.test(event.summary) || /stale|missed|blocked|needs-doing|wakepass stale/.test(text)) {
    return "blocker";
  }
  if (event.kind === "decision" || /decision from session|greenlit|confirmed|correction from chris/.test(text)) return "decision";
  if (event.kind === "proof" || /^pass:/i.test(event.summary) || /merged cleanly|checks passed|proof landed|todo done|shipped/.test(text)) {
    return "proof";
  }
  if (/queuepush|wakepass|reroute|direct qc packet|direct decision packet|handoff|assign/.test(text)) return "handoff";
  if (event.source_kind === "todo" || event.source_kind === "todo_comment" || event.source_kind === "boardroom_message") return "work";
  return "context";
}

function storyMomentKeyForEvent(event: OrchestratorContinuityEvent): string {
  const text = chapterSourceText([event]);
  if (/orchestrator story|story view|story page|adminorchestrator|scrolling feed|continuous story/.test(text)) {
    return "story-view";
  }
  if (/continuous qc|xpass-backed fixes|rotating site crawl/.test(text)) return "continuous-qc";
  if (/improver loop|continuous improver/.test(text)) return "improver";
  if (/queuepush|direct qc packet|direct decision packet/.test(text)) return "queuepush";
  if (/wakepass|reroute/.test(text)) return "wakepass";
  if (/worker2|runner-freshness|autonomous-runner/.test(text)) return "worker-health";
  if (/heartbeat|unclick heartbeat/.test(text)) return "heartbeat";
  if (/pr #\d+/i.test(event.summary)) return event.summary.match(/pr #\d+/i)?.[0].toLowerCase() ?? "pr";
  return storyMomentKind(event);
}

function isUsefulStoryEvent(event: OrchestratorContinuityEvent): boolean {
  const text = chapterSourceText([event]);
  if (/signal to notice/.test(text) && event.kind !== "blocker") return false;
  if (/\bheartbeat trigger includes\b|<heartbeat>|current_time_iso/.test(text)) return false;
  return Boolean(storyPlainText(event.summary));
}

function storyTitleForMoment(events: OrchestratorContinuityEvent[]): { emoji: string; title: string; theme: StoryTheme } {
  const event = events[0];
  const kind = storyMomentKind(event);
  const text = chapterSourceText(events);
  const prMatches = extractPrNumbers(events, 1);

  if (/orchestrator story|story view|story page|scrolling feed|continuous story/.test(text)) {
    return { emoji: "🟢", title: "Story Becomes A Running Feed", theme: "orchestrator" };
  }
  if (prMatches && /merged|merge commit|closed cleanly/.test(text)) {
    return { emoji: "✅", title: `${prMatches} Closes Cleanly`, theme: "shipping" };
  }
  if (prMatches && /opened|ready for review|checks are running/.test(text)) {
    return { emoji: "📬", title: `${prMatches} Enters The Lane`, theme: "autopilot" };
  }
  if (/continuous qc|rotating site crawl|xpass-backed fixes/.test(text)) {
    return { emoji: "🧪", title: "Continuous QC Needs Live Proof", theme: "blocker" };
  }
  if (/improver loop|continuous improver/.test(text)) {
    return { emoji: "♻️", title: "Improver Loop Needs Live Proof", theme: "blocker" };
  }
  if (/queuepush|direct qc packet|direct decision packet/.test(text)) {
    return { emoji: "📬", title: "QueuePush Routes A Clean Packet", theme: "autopilot" };
  }
  if (/wakepass|reroute/.test(text)) {
    return { emoji: "📡", title: "WakePass Reroutes A Stalled Lane", theme: "signals" };
  }
  if (/worker2|runner-freshness|autonomous-runner/.test(text)) {
    return { emoji: "⚠️", title: "Worker Health Stays Visible", theme: "blocker" };
  }

  if (kind === "ask") return { emoji: "🌅", title: `Chris Asks: ${headlineFromText(event.summary, "The Next Useful Question")}`, theme: "question" };
  if (kind === "decision") return { emoji: "🧠", title: headlineFromText(event.summary, "A Decision Sets Direction"), theme: "general" };
  if (kind === "proof") return { emoji: "✅", title: headlineFromText(event.summary, "Proof Lands"), theme: "shipping" };
  if (kind === "blocker") return { emoji: "⚠️", title: headlineFromText(event.summary, "A Handoff Needs Attention"), theme: "blocker" };
  if (kind === "handoff") return { emoji: "📬", title: headlineFromText(event.summary, "A Handoff Moves"), theme: "autopilot" };
  if (kind === "work") return { emoji: "🛠️", title: headlineFromText(event.summary, "Work Moves Forward"), theme: "general" };
  return { emoji: "•", title: headlineFromText(event.summary, "Context Keeps Moving"), theme: "general" };
}

function storySubject(events: OrchestratorContinuityEvent[]): string {
  const event = events[0];
  const sourceText = chapterSourceText(events);
  if (/runner-freshness|autonomous-runner|worker2/.test(sourceText)) return "the worker health check";
  const text = storyPlainText(event.summary)
    .replace(/^new todo:\s*/i, "")
    .replace(/^todo done:\s*/i, "")
    .replace(/^decision from session\.?\s*/i, "")
    .replace(/^wakepass auto-reroute\s*/i, "")
    .trim();
  const quotedTitle = event.summary.match(/"title"\s*:\s*"([^"]+)"/i)?.[1];
  const reason = event.summary.match(/Reason:\s*([^\n]+)/i)?.[1];
  const chosen = quotedTitle || reason || text;
  if (!chosen) return "the current thread";
  return chosen.length > 190 ? `${chosen.slice(0, 190).replace(/[,\s]+$/, "")}...` : chosen;
}

function storyNarrativeForMoment(
  events: OrchestratorContinuityEvent[],
  allEvents: OrchestratorContinuityEvent[],
): string {
  const event = events[0];
  const kind = storyMomentKind(event);
  const text = chapterSourceText(events);
  const subject = storySubject(events);
  const prMatches = extractPrNumbers(events);
  const nearby = events.length > 1 ? ` ${events.length} nearby receipts point at the same moment.` : "";

  if (kind === "ask") {
    return [
      `Chris asked: ${subject}.`,
      "The important part is the shape of the request: keep the page readable, keep the trail continuous, and make the next step obvious without turning the story into raw machinery.",
    ].join(" ");
  }

  if (/orchestrator story|story view|story page|scrolling feed|continuous story/.test(text)) {
    return [
      prMatches ? `The Story work moved through ${prMatches}.` : "The Story work moved again.",
      "The page should feel like a living read: one calm stream, fresh headings as the work changes, and enough source detail nearby for trust without making the first read heavy.",
      nearby.trim(),
    ].filter(Boolean).join(" ");
  }

  if (kind === "blocker") {
    return [
      `A handoff stalled around ${subject}.`,
      "The useful read is simple: it needs a current owner, a clear ACK, proof, or a reroute. Repeating the alert is not progress, but keeping it visible stops it from disappearing.",
      nearby.trim(),
    ].filter(Boolean).join(" ");
  }

  if (kind === "proof") {
    return [
      prMatches ? `Proof landed around ${prMatches}.` : `Proof landed around ${subject}.`,
      "That matters because the next seat can continue from evidence instead of guessing what changed. The raw receipt stays underneath, but the story can stay light.",
      nearby.trim(),
    ].filter(Boolean).join(" ");
  }

  if (kind === "decision") {
    return [
      `Direction was set: ${subject}.`,
      "This is the part the next seat should carry forward. It turns scattered updates into a shared reason for the next useful move.",
      nearby.trim(),
    ].filter(Boolean).join(" ");
  }

  if (kind === "handoff") {
    return [
      `A handoff moved through the system: ${subject}.`,
      "The story keeps the human version of that movement, while Timeline keeps the exact packet and source details for anyone checking the machinery.",
      nearby.trim(),
    ].filter(Boolean).join(" ");
  }

  const allText = chapterSourceText(allEvents);
  const activeThreads = [
    /story mode|orchestrator story|story view/.test(allText) ? "Story is still being shaped into the friendly front door" : null,
    /queuepush|wakepass/.test(allText) ? "routing and proof are being tightened" : null,
    /worker2|continuous qc|improver loop/.test(allText) ? "worker health is still part of the background" : null,
  ].filter(Boolean);

  return [
    `The thread kept moving around ${subject}.`,
    activeThreads.length > 0
      ? `${activeThreads.join(", ")}, and this receipt gives the next reader another plain-English step in that path.`
      : "It is not the headline by itself, but it helps the running story stay connected instead of becoming a pile of loose receipts.",
    nearby.trim(),
  ].filter(Boolean).join(" ");
}

function storyBeatForEvent(event: OrchestratorContinuityEvent): StoryBeat | null {
  const text = chapterSourceText([event]);
  if (
    event.role === "user" ||
    /story mode.*fixed|is story.*fixed|translator patch|too zoomed|reviewing this story|achievable|big question|greenlight|green light/.test(
      text,
    )
  ) {
    return "big-question";
  }
  if (hasSessionDecision(text)) return "session-direction";
  if (/orchestrator story|story view|story page|adminorchestrator|#728|#727|subscription chat messages.*orchestrator/.test(text)) {
    return "orchestrator-story";
  }
  if (/worker2|chatgpt-codex-worker2|stale_in_progress|runner-freshness|autonomous-runner|next schedule|canary/.test(text)) {
    return "worker2";
  }
  if (hasQueuePush(text) || /#715|#725|#726|stale_ack|wakepass stale|reviewer\/safety|direct decision/.test(text)) {
    return "queuepush";
  }
  if (/merged|checks passed|proof landed|shipped a change|pass:|vercel|testpass|publish/.test(text) || event.kind === "proof") {
    return "shipping";
  }
  if (/signal to notice|wakepass|dispatch|alert/.test(text)) return null;
  return null;
}

function storyBeatTitle(beat: StoryBeat): { emoji: string; title: string; theme: StoryTheme } {
  const titles: Record<StoryBeat, { emoji: string; title: string; theme: StoryTheme }> = {
    "big-question": { emoji: "🌅", title: "The big question", theme: "question" },
    "session-direction": { emoji: "🧠", title: "Session sets the direction", theme: "general" },
    "orchestrator-story": { emoji: "🟢", title: "Orchestrator Story, tucked into place", theme: "orchestrator" },
    queuepush: { emoji: "📬", title: "QueuePush gets less noisy", theme: "autopilot" },
    worker2: { emoji: "⚠️", title: "The worker2 situation", theme: "blocker" },
    shipping: { emoji: "✅", title: "Small ships, clean proof", theme: "shipping" },
    "where-we-are": { emoji: "•", title: "Where we are", theme: "general" },
  };
  return titles[beat];
}

function storyBeatNarrative(
  beat: StoryBeat,
  events: OrchestratorContinuityEvent[],
  allEvents: OrchestratorContinuityEvent[],
): string {
  const text = chapterSourceText(events);
  const ask = latestUserAsk(events);
  const passCount = events.filter((event) => /^pass:/i.test(event.summary) || event.kind === "proof").length;
  const blockerCount = events.filter((event) => /^blocker:/i.test(event.summary) || event.kind === "blocker").length;
  const prMatches = extractPrNumbers(events);
  const focus = buildFocus(events);

  if (beat === "big-question") {
    if (/story mode.*fixed|translator patch|#728/.test(text)) {
      return [
        "Chris pulled the thread back to the real one today: is Story mode actually fixed after the translator patch in PR #728?",
        "That was not just a status check. It was a push to turn vague reassurance into something Chris could read and judge on the page.",
        "The useful move from here is simple: make the Story surface prove itself in plain English, keep enough detail to feel alive, and leave the receipts underneath for anyone who wants to inspect the raw trail. ✅",
      ].join(" ");
    }
    return [
      ask ? `Chris pulled the thread back to the real question: ${ask}.` : "Chris pulled the thread back to the real question.",
      "That set the tone for the next push: fewer vague updates, more useful todos, cleaner proof, and a page that tells the actual story instead of repeating the machinery.",
      "The room stayed pointed at the next action rather than another round of describing the same problem. ✅",
    ].join(" ");
  }

  if (beat === "session-direction") {
    return [
      "Session set the direction for the room.",
      focus
        ? `The thread to pull was ${focus}, with proof kept nearby so the next seat can trust the decision.`
        : "The important part was not another alert. It was a clear steer that stays in place until Chris changes course.",
      "That gave the pack something steadier to follow than a pile of minute-by-minute signals, and it keeps the next worker from having to rediscover the point of the work. ✅",
    ].join(" ");
  }

  if (beat === "orchestrator-story") {
    return [
      prMatches ? `The Orchestrator Story work moved forward around ${prMatches}.` : "The Orchestrator Story work moved forward.",
      "Story is becoming the friendly front door, with Timeline holding the raw receipts underneath for anyone who needs the exact trail.",
      "The shape is clearer now: Chris should be able to read the day like a running account, with enough context to understand why each moment mattered, while the machine notes stay tucked away for proof. ✅",
    ].join(" ");
  }

  if (beat === "queuepush") {
    return [
      prMatches ? `The autopilot work kept tightening around ${prMatches}.` : "The autopilot work kept tightening.",
      "QueuePush had been repeating itself without always getting a clean answer back, so the fix is less noise and more closure.",
      "The useful pattern is still the same: see the job, pick the lane, wake the right worker, get a clear answer, then leave proof. That is the difference between a clever traffic light and a system that gets work over the line. 🚀",
    ].join(" ");
  }

  if (beat === "worker2") {
    return [
      "Worker2 is still the pressure point.",
      "Work is visible against it, but it is not moving cleanly through the lane yet, and the scheduled runner behind it has been quiet longer than it should be.",
      blockerCount > 0
        ? "The calm plan is to keep the blocker visible, watch for the next scheduled wake-up, and hand it one small test job once it shows signs of life. If that one job moves, the stuck stack behind it has a path again. ⚠️"
        : "The plan is calm rather than panicked: prove one small job can move, then let the waiting stack start to clear. ⚠️",
    ].join(" ");
  }

  if (beat === "shipping") {
    return [
      "A run of useful proof landed around the work.",
      passCount > 1
        ? "Several seats left receipts close together, which means the work was not just talked about, it was checked and recorded."
        : "A seat left the little mark that matters: this can be trusted later.",
      "That proof matters because it lets the next seat continue from evidence instead of guessing what happened. Good, steady movement. ✅",
    ].join(" ");
  }

  const allText = chapterSourceText(allEvents);
  const activeThreads = [
    /story mode|orchestrator story|#728/.test(allText) ? "Story is becoming the friendly front door" : null,
    /queuepush|#715|#725|#726/.test(allText) ? "QueuePush is being taught to close its own loops" : null,
    /worker2|stale_in_progress|autonomous-runner/.test(allText)
      ? "worker2 is still the pressure point to clear"
      : null,
  ].filter(Boolean);
  return [
    "Steady movement by this point in the day.",
    activeThreads.length > 0
      ? `${activeThreads.join(", ")}, and the receipts are still landing where the next seat can find them.`
      : "The shared context stayed warm, the next useful piece of work stayed visible, and nothing important fell out of view.",
    "Nothing dramatic, nothing lost, and enough shape now to keep the work moving without turning Story back into a raw feed.",
  ].join(" ");
}

function chapterNarrative(theme: StoryTheme, events: OrchestratorContinuityEvent[]): string {
  const text = chapterSourceText(events);
  if (hasRunnerFreshness(text)) return storyBeatNarrative("worker2", events, events);
  const beat = storyBeatForEvent(events[0]) ?? (theme === "shipping" ? "shipping" : "where-we-are");
  return storyBeatNarrative(beat, events, events);
}

function nativeNoteForChapter(
  event: OrchestratorContinuityEvent,
  profileByAgentId: Map<string, OrchestratorProfileCard>,
): string {
  const actor = actorIdentityForEvent(event, profileByAgentId);
  const source = `${sourceLabel(event.source_kind)}${event.source_id ? ` ${event.source_id}` : ""}`;
  return `${formatRelative(event.created_at)} · ${actor.label} · ${source} · ${cleanStoryText(event.summary)}`;
}

function eventTimeMs(event: OrchestratorContinuityEvent): number {
  return event.created_at ? new Date(event.created_at).getTime() : 0;
}

function chapterLatestTimeMs(chapter: StoryChapter): number {
  return chapter.endedAt ? new Date(chapter.endedAt).getTime() : 0;
}

function buildStoryChapters(
  events: OrchestratorContinuityEvent[],
  profileByAgentId: Map<string, OrchestratorProfileCard>,
): StoryChapter[] {
  const sorted = [...events]
    .filter(isUsefulStoryEvent)
    .sort((a, b) => eventTimeMs(b) - eventTimeMs(a));

  const groups: Array<{ key: string; kind: ReturnType<typeof storyMomentKind>; events: OrchestratorContinuityEvent[] }> = [];
  for (const event of sorted) {
    const key = storyMomentKeyForEvent(event);
    const kind = storyMomentKind(event);
    const eventTime = eventTimeMs(event);
    const latestGroup = groups[groups.length - 1];
    const latestGroupTime = latestGroup?.events[0] ? eventTimeMs(latestGroup.events[0]) : 0;
    if (
      latestGroup &&
      latestGroup.key === key &&
      latestGroup.kind === kind &&
      latestGroupTime - eventTime <= STORY_CHAPTER_SPLIT_MS &&
      latestGroup.events.length < STORY_CHAPTER_MAX_EVENTS
    ) {
      latestGroup.events.push(event);
    } else {
      groups.push({ key, kind, events: [event] });
    }
  }

  return groups
    .map(({ key, events: chapterEvents }) => {
      const title = storyTitleForMoment(chapterEvents);
      const newest = chapterEvents[0]?.created_at ?? null;
      return {
        key: `story:${key}:${newest ?? "unknown"}:${chapterEvents[0]?.source_id ?? "event"}`,
        theme: title.theme,
        title: title.title,
        emoji: title.emoji,
        events: chapterEvents,
        startedAt: chapterEvents[chapterEvents.length - 1]?.created_at ?? null,
        endedAt: newest,
        narrative: storyNarrativeForMoment(chapterEvents, sorted),
        nativeNotes: chapterEvents
          .slice(0, STORY_NATIVE_PREVIEW_COUNT)
          .map((event) => nativeNoteForChapter(event, profileByAgentId)),
      };
    })
    .sort((a, b) => chapterLatestTimeMs(b) - chapterLatestTimeMs(a))
    .slice(0, STORY_CHAPTER_MAX_TOTAL);
}

function usePagePositionHold() {
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const pendingAnchorTopRef = useRef<number | null>(null);

  useEffect(() => {
    if (pendingAnchorTopRef.current === null) return;
    const previousTop = pendingAnchorTopRef.current;
    window.requestAnimationFrame(() => {
      const nextTop = anchorRef.current?.getBoundingClientRect().top;
      if (typeof nextTop === "number") {
        window.scrollBy({ top: nextTop - previousTop });
      }
      pendingAnchorTopRef.current = null;
    });
  });

  function holdPagePosition(action: () => void) {
    pendingAnchorTopRef.current = anchorRef.current?.getBoundingClientRect().top ?? null;
    action();
  }

  return { anchorRef, holdPagePosition };
}

export default function AdminOrchestratorPage() {
  const location = useLocation();
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
  const [contextLimit, setContextLimit] = useState(INITIAL_CONTEXT_LIMIT);
  const [loading, setLoading] = useState(true);
  const hasLoadedOrchestratorContextRef = useRef(false);

  const envEnabled = aiChatEnvEnabled();

  useEffect(() => {
    if (sessionLoading) return;
    if (!authToken) {
      hasLoadedOrchestratorContextRef.current = false;
      queueMicrotask(() => setLoading(false));
      return;
    }
    let cancelled = false;
    if (!hasLoadedOrchestratorContextRef.current) {
      setLoading(true);
    }
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
          fetch(`/api/memory-admin?action=orchestrator_context_read&limit=${contextLimit}`, {
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
          hasLoadedOrchestratorContextRef.current = true;
        }
        if (tenantRes?.env_enabled) setTenant(tenantRes.settings);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken, contextLimit, sessionLoading, storedApiKey]);

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

  const timelineActive = location.pathname.endsWith("/timeline");
  const storyActive = !timelineActive;

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#61C1C4]/10 text-[#61C1C4]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Orchestrator</h1>
            <p className="text-sm text-white/50">
              {storyActive
                ? "The running story of UnClick, told in friendly plain English."
                : "The detailed timeline for seats, receipts, proof, and source links."}
            </p>
          </div>
        </div>
        <div className="inline-flex w-full rounded-xl border border-white/[0.08] bg-black/20 p-1 md:w-auto">
          <Link
            to="/admin/orchestrator"
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors md:flex-none ${
              storyActive
                ? "bg-[#61C1C4]/15 text-[#61C1C4]"
                : "text-white/45 hover:bg-white/[0.04] hover:text-white/75"
            }`}
          >
            <BookOpen className="h-4 w-4" />
            Story
          </Link>
          <Link
            to="/admin/orchestrator/timeline"
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors md:flex-none ${
              timelineActive
                ? "bg-[#61C1C4]/15 text-[#61C1C4]"
                : "text-white/45 hover:bg-white/[0.04] hover:text-white/75"
            }`}
          >
            <Clock className="h-4 w-4" />
            Timeline
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        {/* Main continuity pane */}
        <div className="flex min-h-[620px] flex-col">
          {storyActive ? (
            <OrchestratorStoryPanel
              context={orchestratorContext}
              loading={loading || sessionLoading}
              contextLimit={contextLimit}
              maxContextLimit={MAX_CONTEXT_LIMIT}
              onLoadDeeperHistory={() => setContextLimit((value) => Math.min(MAX_CONTEXT_LIMIT, value + INITIAL_CONTEXT_LIMIT))}
            />
          ) : (
            <OrchestratorContinuityPanel
              context={orchestratorContext}
              loading={loading || sessionLoading}
              chatStatusLabel={chatDisabledReason ? "Chat disabled" : tier === "channel" ? "Claude Code bridge available" : "AI chat available"}
              authToken={authToken}
              contextLimit={contextLimit}
              maxContextLimit={MAX_CONTEXT_LIMIT}
              onLoadDeeperHistory={() => setContextLimit((value) => Math.min(MAX_CONTEXT_LIMIT, value + INITIAL_CONTEXT_LIMIT))}
            />
          )}
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

function OrchestratorStoryPanel({
  context,
  loading,
  contextLimit,
  maxContextLimit,
  onLoadDeeperHistory,
}: {
  context: OrchestratorContext | null;
  loading: boolean;
  contextLimit: number;
  maxContextLimit: number;
  onLoadDeeperHistory: () => void;
}) {
  const [visibleChapterCount, setVisibleChapterCount] = useState(STORY_CHAPTER_VISIBLE_STEP);
  const [nativeNotes, setNativeNotes] = useState(() => readStoredBoolean(STORY_NATIVE_STORAGE_KEY, false));
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(() => new Set());
  const profileByAgentId = useMemo(
    () => buildProfileLookup(context?.profile_cards),
    [context?.profile_cards],
  );
  const chapters = useMemo(
    () => buildStoryChapters(context?.continuity_events ?? [], profileByAgentId),
    [context?.continuity_events, profileByAgentId],
  );
  const visibleChapters = chapters.slice(0, visibleChapterCount);
  const hasMoreLoaded = visibleChapterCount < chapters.length;
  const canLoadFromServer = contextLimit < maxContextLimit;
  const { anchorRef: readMoreRef, holdPagePosition } = usePagePositionHold();

  const toggleNativeNotes = (value: boolean) => {
    setNativeNotes(value);
    writeStoredBoolean(STORY_NATIVE_STORAGE_KEY, value);
  };

  const toggleChapter = (chapterKey: string) => {
    setExpandedChapters((current) => {
      const next = new Set(current);
      if (next.has(chapterKey)) next.delete(chapterKey);
      else next.add(chapterKey);
      return next;
    });
  };

  return (
    <section className="flex min-h-[620px] flex-col rounded-2xl border border-white/[0.08] bg-[#101010] shadow-2xl shadow-black/30">
      <div className="border-b border-white/[0.06] px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#61C1C4]">
              <BookOpen className="h-4 w-4" />
              <h2 className="text-lg font-semibold text-white">Today's running story</h2>
            </div>
            <p className="mt-1 text-sm text-white/45">
              Latest first, written as a continuous read. Timeline keeps every raw receipt.
            </p>
          </div>
          <label className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-black/20 px-3 py-2 text-xs text-white/55">
            <input
              type="checkbox"
              checked={nativeNotes}
              onChange={(event) => toggleNativeNotes(event.target.checked)}
              className="h-3.5 w-3.5 accent-[#61C1C4]"
            />
            Native notes
          </label>
        </div>
      </div>

      <div className="flex-1 px-5 py-5">
        {loading ? (
          <div className="flex h-full min-h-[420px] items-center justify-center text-sm text-white/45">
            Writing the latest story...
          </div>
        ) : chapters.length === 0 ? (
          <div className="flex h-full min-h-[420px] items-center justify-center text-center text-sm text-white/45">
            No story lines yet. When seats leave receipts, they will appear here as a simple read.
          </div>
        ) : (
          <article className="mx-auto max-w-3xl space-y-9">
            {visibleChapters.map((chapter) => {
              const expanded = expandedChapters.has(chapter.key);
              const preview = truncateText(chapter.narrative, STORY_CHAPTER_PREVIEW_CHARS);
              const showFullStory = expanded || !preview.truncated;
              const shownStory = showFullStory ? chapter.narrative : preview.text;

              return (
                <section key={chapter.key} className="group">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-xl font-semibold leading-7 text-white sm:text-2xl">
                      <span className="mr-2">{chapter.emoji}</span>
                      {chapter.title}
                    </h3>
                    <time
                      dateTime={chapter.endedAt ?? undefined}
                      title={`${formatRelative(chapter.endedAt)} · ${formatAbsolute(chapter.endedAt)}`}
                      className="shrink-0 pt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white/25"
                    >
                      {formatRelative(chapter.endedAt)}
                    </time>
                  </div>
                  <p className="mt-3 text-base leading-8 text-white/82 sm:text-[17px]">
                    {shownStory}
                  </p>
                  {nativeNotes && (
                    <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3 text-xs leading-6 text-white/42">
                      <div className="mb-2 font-medium text-white/55">Native notes from this chapter</div>
                      <ul className="space-y-1">
                        {chapter.nativeNotes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {preview.truncated && (
                    <button
                      type="button"
                      onClick={() => toggleChapter(chapter.key)}
                      className="mt-2 text-xs font-medium text-[#61C1C4] transition-colors hover:text-[#8ee3e6]"
                    >
                      {expanded ? "Read less" : "Read more"}
                    </button>
                  )}
                </section>
              );
            })}
          </article>
        )}
      </div>

      {!loading && chapters.length > 0 && (
        <div className="border-t border-white/[0.06] px-5 py-4">
          <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-white/35">
              Showing {Math.min(visibleChapterCount, chapters.length)} of {chapters.length} story moments.
            </p>
            {(hasMoreLoaded || canLoadFromServer) && (
              <button
                type="button"
                ref={readMoreRef}
                onClick={() => {
                  holdPagePosition(() => {
                    if (hasMoreLoaded) {
                      setVisibleChapterCount((value) => Math.min(chapters.length, value + STORY_CHAPTER_VISIBLE_STEP));
                    } else {
                      onLoadDeeperHistory();
                      setVisibleChapterCount((value) => value + STORY_CHAPTER_VISIBLE_STEP);
                    }
                  });
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#61C1C4]/25 bg-[#61C1C4]/10 px-3 py-2 text-sm font-medium text-[#61C1C4] transition-colors hover:bg-[#61C1C4]/15"
              >
                Read more
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function OrchestratorContinuityPanel({
  context,
  loading,
  chatStatusLabel,
  authToken,
  contextLimit,
  maxContextLimit,
  onLoadDeeperHistory,
}: {
  context: OrchestratorContext | null;
  loading: boolean;
  chatStatusLabel: string;
  authToken: string;
  contextLimit: number;
  maxContextLimit: number;
  onLoadDeeperHistory: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [serverSearchContext, setServerSearchContext] = useState<OrchestratorContext | null>(null);
  const [serverSearchLoading, setServerSearchLoading] = useState(false);
  const [visibleEventCount, setVisibleEventCount] = useState(CONTINUITY_VISIBLE_STEP);
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
  const visibleEventViews = filteredEventViews.slice(0, visibleEventCount);
  const canRevealLoadedHistory = filteredEventViews.length > visibleEventCount;
  const canLoadDeeperHistory =
    !trimmedSearchQuery &&
    !loading &&
    !serverSearchLoading &&
    contextLimit < maxContextLimit &&
    events.length >= contextLimit;
  const { anchorRef: viewMoreRef, holdPagePosition } = usePagePositionHold();

  useEffect(() => {
    setVisibleEventCount(CONTINUITY_VISIBLE_STEP);
  }, [events.length, trimmedSearchQuery]);

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
            ? `${Math.min(visibleEventCount, filteredEventViews.length)} of ${filteredEventViews.length} matching events shown`
            : `${Math.min(visibleEventCount, filteredEventViews.length)} of ${events.length} loaded events shown`}
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
        {!loading && visibleEventViews.map(({ event, actor, index, absoluteDate, easySummary }) => (
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
        {!loading && filteredEventViews.length > 0 && (
          <div className="flex flex-col items-center gap-2 border-t border-white/[0.06] pt-4">
            {(canRevealLoadedHistory || canLoadDeeperHistory) ? (
              <button
                type="button"
                ref={viewMoreRef}
                onClick={() => {
                  holdPagePosition(() => {
                    if (canRevealLoadedHistory) {
                      setVisibleEventCount((value) => value + CONTINUITY_VISIBLE_STEP);
                      return;
                    }
                    onLoadDeeperHistory();
                  });
                }}
                className="rounded-md border border-[#61C1C4]/25 bg-[#61C1C4]/10 px-3 py-2 text-xs font-semibold text-[#A9EEF0] hover:border-[#61C1C4]/40 hover:bg-[#61C1C4]/15"
              >
                {canRevealLoadedHistory ? "View more history" : "Load deeper history"}
              </button>
            ) : (
              <span className="text-[11px] text-white/30">
                End of loaded Orchestrator history.
              </span>
            )}
            {!trimmedSearchQuery && (
              <span className="text-[10px] text-white/25">
                Loaded depth: {events.length} events from a {contextLimit}-row source window.
              </span>
            )}
          </div>
        )}
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
  const friendlySummary = chapterNarrative(themeForEvent(event), [event]);
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
      <p className="line-clamp-2 text-xs leading-5 text-white/65">{friendlySummary}</p>
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

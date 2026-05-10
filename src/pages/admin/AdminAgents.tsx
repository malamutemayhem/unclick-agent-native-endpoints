/**
 * AdminAgents manages connected AI seat capacity.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pencil,
  Trash2,
  Search,
  X,
  Check,
  AlertTriangle,
  Save,
} from "lucide-react";
import {
  AGENT_TEMPLATES,
  CREW_CATEGORIES,
  MEMORY_LAYERS,
  type AgentTemplate,
  type MemoryLayerKey,
} from "./agentTemplates";
import {
  latestProfileCheckInAt,
  mapProfilesToSeats,
  unmatchedRecentProfiles,
  type AISeat,
  type FishbowlProfile,
} from "./AdminAgentsSeatUtils";
import { useSession } from "@/lib/auth";

interface Agent {
  id: string;
  api_key_hash: string;
  name: string;
  slug: string;
  role: string;
  description: string | null;
  system_prompt: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  tool_count?: number;
  memory_layer_count?: number;
}

interface Connector {
  id: string;
  name: string;
  category: string;
  description: string | null;
  icon: string | null;
}

interface AgentDetail {
  agent: Agent;
  tools: Array<{ connector_id: string; is_enabled: boolean }>;
  memory_scope: Array<{ memory_layer: string; is_enabled: boolean }>;
}

const ROLE_OPTIONS = [
  { value: "researcher", label: "Researcher" },
  { value: "developer", label: "Developer" },
  { value: "architect", label: "Architect" },
  { value: "qa_engineer", label: "QA Engineer" },
  { value: "security_officer", label: "Security Officer" },
  { value: "designer", label: "Designer" },
  { value: "ceo", label: "CEO" },
  { value: "cto", label: "CTO" },
  { value: "writer", label: "Writer" },
  { value: "finance_lead", label: "Finance Lead" },
  { value: "legal_advisor", label: "Legal Advisor" },
  { value: "organiser", label: "Organiser" },
  { value: "customer_advocate", label: "Customer Advocate" },
  { value: "devils_advocate", label: "Devil's Advocate" },
  { value: "general", label: "General" },
  { value: "custom", label: "Custom" },
];

const AI_SEAT_STORAGE_KEY = "unclick_ai_seat_manual_slots_v1";

const AI_SEAT_EMOJI_OPTIONS = [
  { emoji: "💻", label: "Laptop / default" },
  { emoji: "🖥️", label: "Desktop" },
  { emoji: "📱", label: "Mobile" },
  { emoji: "🔳", label: "Tablet" },
  { emoji: "🔲", label: "Virtual slot" },
  { emoji: "🖱️", label: "Mouse" },
  { emoji: "⌨️", label: "Keyboard" },
  { emoji: "🎛️", label: "Control panel" },
  { emoji: "🕹️", label: "Controller" },
  { emoji: "📺", label: "Display" },
  { emoji: "🔌", label: "Plugged in" },
  { emoji: "🔋", label: "Battery" },
  { emoji: "🪫", label: "Low battery" },
  { emoji: "📶", label: "Signal bars" },
  { emoji: "🛜", label: "Wi-Fi" },
  { emoji: "🌐", label: "Web seat" },
  { emoji: "💾", label: "Local disk" },
  { emoji: "💽", label: "Archive disk" },
  { emoji: "🧮", label: "Compute" },
  { emoji: "📟", label: "Terminal" },
  { emoji: "🖨️", label: "Printer" },
  { emoji: "📠", label: "Legacy line" },
] as const;

const AI_SEATS: AISeat[] = [
  {
    id: "seat-1",
    name: "AI Seat 1",
    emoji: "💻",
    provider: "Unknown AI",
    device: "Unknown device",
    status: "Ready",
    state: "Cycle-share capacity",
    load: 25,
    assigned: "General capacity",
    issue: "",
  },
  {
    id: "seat-2",
    name: "AI Seat 2",
    emoji: "💻",
    provider: "Unknown AI",
    device: "Unknown device",
    status: "Ready",
    state: "Cycle-share capacity",
    load: 25,
    assigned: "General capacity",
    issue: "",
  },
  {
    id: "seat-3",
    name: "AI Seat 3",
    emoji: "💻",
    provider: "Unknown AI",
    device: "Unknown device",
    status: "Ready",
    state: "Cycle-share capacity",
    load: 25,
    assigned: "General capacity",
    issue: "",
  },
  {
    id: "seat-4",
    name: "AI Seat 4",
    emoji: "💻",
    provider: "Unknown AI",
    device: "Unknown device",
    status: "Ready",
    state: "Cycle-share capacity",
    load: 25,
    assigned: "General capacity",
    issue: "",
  },
  {
    id: "virtual-review",
    name: "Virtual review seat",
    emoji: "🔲",
    provider: "Virtual support",
    device: "Spawned when physical capacity is unavailable",
    status: "Standby",
    state: "Fallback only",
    load: 0,
    assigned: "Review / fallback",
    issue: "",
    isVirtual: true,
  },
];

function loadSeatOverrides(): AISeat[] {
  if (typeof window === "undefined") return AI_SEATS;
  try {
    const overrides = JSON.parse(window.localStorage.getItem(AI_SEAT_STORAGE_KEY) ?? "{}") as Record<string, Partial<AISeat>>;
    return AI_SEATS.map((seat) => {
      const override = overrides[seat.id] ?? {};
      const wasOldDefaultEmoji = (!seat.isVirtual && override.emoji === "🤖") || (seat.isVirtual && override.emoji === "🧪");
      return { ...seat, ...override, emoji: wasOldDefaultEmoji ? seat.emoji : override.emoji ?? seat.emoji };
    });
  } catch {
    return AI_SEATS;
  }
}

function getApiKey(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("unclick_api_key") ?? "";
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "No check-in yet";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "Unknown";
  const diffSec = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 14) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}

async function api<T>(action: string, opts: RequestInit = {}, authToken = getApiKey()): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(`/api/memory-admin?action=${action}`, { ...opts, headers });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export default function AdminAgentsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-heading">Seats</h1>
        <p className="mt-1 text-sm text-body">
          Seats are the connected AI capacity across UnClick. Worker roles now live under AutoPilot.
        </p>
      </header>

      <AISeatsPanel />
    </div>
  );
}

function profileDisplayName(profile: FishbowlProfile): string {
  const name = profile.display_name?.trim();
  if (name) return name;
  return profile.agent_id
    .replace(/^chatgpt[-_]/, "")
    .replace(/^codex[-_]/, "")
    .replace(/^claude[-_]/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .replace(/\bAi\b/g, "AI");
}

function AISeatsPanel() {
  const { session, loading: sessionLoading } = useSession();
  const authToken = session?.access_token ?? getApiKey();
  const [seats, setSeats] = useState<AISeat[]>(() => loadSeatOverrides());
  const [profiles, setProfiles] = useState<FishbowlProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [editingSeatId, setEditingSeatId] = useState<string | null>(null);
  const issues = seats.filter((seat) => seat.issue);
  const seatProfiles = useMemo(() => mapProfilesToSeats(seats, profiles), [profiles, seats]);
  const extraProfiles = useMemo(
    () => unmatchedRecentProfiles(profiles, seatProfiles.values()),
    [profiles, seatProfiles],
  );
  const matchedProfileCount = seatProfiles.size;
  const checkInSummary = profilesError
    ? profilesError
    : sessionLoading
      ? "Checking session..."
      : profilesLoading
      ? "Checking live seats..."
      : profiles.length > 0
        ? `${profiles.length} live check-in${profiles.length === 1 ? "" : "s"} loaded`
        : "No live seat check-ins loaded yet";

  const loadProfiles = useCallback(async () => {
    if (sessionLoading) return;
    if (!authToken) {
      setProfiles([]);
      setProfilesError("Sign in to load live check-ins.");
      return;
    }
    setProfilesLoading(true);
    setProfilesError(null);
    try {
      const res = await api<{ profiles?: FishbowlProfile[] }>("fishbowl_read", {
        method: "POST",
        body: JSON.stringify({
          limit: 20,
        }),
      }, authToken);
      setProfiles(
        (res.profiles ?? [])
          .filter((profile) => profile.user_agent_hint !== "admin-ui")
          .sort((a, b) => {
            const aMs = Date.parse(latestProfileCheckInAt(a) ?? a.created_at);
            const bMs = Date.parse(latestProfileCheckInAt(b) ?? b.created_at);
            return bMs - aMs;
          }),
      );
    } catch (error) {
      setProfiles([]);
      setProfilesError(error instanceof Error ? error.message : "Could not load live check-ins.");
    } finally {
      setProfilesLoading(false);
    }
  }, [authToken, sessionLoading]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const overrides = Object.fromEntries(
      seats.map((seat) => [
        seat.id,
        {
          name: seat.name,
          emoji: seat.emoji,
          provider: seat.provider,
          device: seat.device,
          load: seat.load,
          assigned: seat.assigned,
        },
      ]),
    );
    window.localStorage.setItem(AI_SEAT_STORAGE_KEY, JSON.stringify(overrides));
  }, [seats]);

  useEffect(() => {
    if (sessionLoading) return;
    queueMicrotask(() => void loadProfiles());
    const id = window.setInterval(() => void loadProfiles(), 30_000);
    return () => window.clearInterval(id);
  }, [loadProfiles, sessionLoading]);

  const updateSeat = (seatId: string, patch: Partial<AISeat>) => {
    setSeats((current) => current.map((seat) => (seat.id === seatId ? { ...seat, ...patch } : seat)));
  };

  const spreadEvenly = () => {
    const physical = seats.filter((seat) => !seat.isVirtual);
    const share = physical.length > 0 ? Math.floor(100 / physical.length) : 0;
    const remainder = physical.length > 0 ? 100 - share * physical.length : 0;
    let physicalIndex = 0;
    setSeats((current) =>
      current.map((seat) => {
        if (seat.isVirtual) return { ...seat, load: 0 };
        const load = share + (physicalIndex < remainder ? 1 : 0);
        physicalIndex += 1;
        return { ...seat, load };
      }),
    );
  };

  return (
    <section className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border/40 bg-card/20">
        <div className="flex flex-col gap-2 border-b border-border/40 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-heading">AI Seats</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Connected AI capacity with the newest live check-in shown in each row. Cycle-share is a planning guide.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`hidden rounded-md border px-2 py-1 text-[11px] md:inline-flex ${
                profilesError
                  ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                  : profiles.length > 0
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                    : "border-border/40 bg-card/40 text-muted-foreground"
              }`}
              title={matchedProfileCount > 0 ? `${matchedProfileCount} seats matched to live check-ins` : checkInSummary}
            >
              {checkInSummary}
            </span>
            <button
              type="button"
              onClick={() => void loadProfiles()}
              className="rounded-md border border-border/40 bg-card/40 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-heading"
            >
              {profilesLoading ? "Checking..." : "Refresh"}
            </button>
            <span className="inline-flex w-fit items-center rounded-md border border-border/40 bg-card/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Fungible mode
            </span>
          </div>
        </div>
        <div className="grid grid-cols-[minmax(210px,1.4fr)_110px_130px_minmax(150px,0.8fr)_minmax(180px,1.2fr)_minmax(190px,1fr)] gap-3 border-b border-border/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Seat</span>
          <span>Status</span>
          <span className="flex items-center justify-between gap-2">
            <span>Cycle share</span>
            <button
              type="button"
              onClick={spreadEvenly}
              className="rounded border border-border/40 bg-card/40 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-heading transition-colors hover:border-primary/40"
            >
              Even split
            </button>
          </span>
          <span>Last check-in</span>
          <span>Assigned work</span>
          <span>Controls</span>
        </div>
        <div className="divide-y divide-border/30">
          {seats.map((seat) => {
            const editing = editingSeatId === seat.id;
            const matchedProfile = seatProfiles.get(seat.id);
            const matchedCheckInAt = matchedProfile ? latestProfileCheckInAt(matchedProfile) : null;
            const emojiOptions = AI_SEAT_EMOJI_OPTIONS.some((option) => option.emoji === seat.emoji)
              ? AI_SEAT_EMOJI_OPTIONS
              : [{ emoji: seat.emoji, label: "Custom" }, ...AI_SEAT_EMOJI_OPTIONS];
            return (
              <div
                key={seat.id}
                className="grid grid-cols-[minmax(210px,1.4fr)_110px_130px_minmax(150px,0.8fr)_minmax(180px,1.2fr)_minmax(190px,1fr)] items-center gap-3 px-4 py-3 text-xs"
              >
                <div className="min-w-0">
                  {editing ? (
                    <div className="space-y-1">
                      <div className="grid grid-cols-[92px_1fr] gap-1">
                        <select
                          value={seat.emoji}
                          onChange={(event) => updateSeat(seat.id, { emoji: event.target.value })}
                          className="rounded-md border border-border/40 bg-card/40 px-2 py-1 text-xs text-heading outline-none focus:border-primary/40"
                          aria-label="Seat emoji"
                        >
                          {emojiOptions.map((option) => (
                            <option key={`${seat.id}-${option.emoji}`} value={option.emoji}>
                              {option.emoji} {option.label}
                            </option>
                          ))}
                        </select>
                        <input
                          value={seat.name}
                          onChange={(event) => updateSeat(seat.id, { name: event.target.value })}
                          className="rounded-md border border-border/40 bg-card/40 px-2 py-1 text-xs text-heading outline-none focus:border-primary/40"
                          aria-label="Seat name"
                        />
                      </div>
                      <input
                        value={seat.provider}
                        onChange={(event) => updateSeat(seat.id, { provider: event.target.value })}
                        className="w-full rounded-md border border-border/40 bg-card/40 px-2 py-1 text-[10px] text-body outline-none focus:border-primary/40"
                        aria-label="Seat provider"
                      />
                      <input
                        value={seat.device}
                        onChange={(event) => updateSeat(seat.id, { device: event.target.value })}
                        className="w-full rounded-md border border-border/40 bg-card/40 px-2 py-1 text-[10px] text-body outline-none focus:border-primary/40"
                        aria-label="Seat device"
                      />
                    </div>
                  ) : (
                    <>
                      <p className="truncate font-semibold text-heading">
                        <span className="mr-1.5" aria-hidden="true">{seat.emoji}</span>
                        {seat.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{seat.provider}</p>
                      <p className="text-[10px] text-muted-foreground">{seat.device}</p>
                    </>
                  )}
                </div>
                <div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] ${
                      seat.status === "Ready"
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                        : seat.status === "Standby"
                          ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                          : "border-border/40 bg-card/40 text-muted-foreground"
                    }`}
                  >
                    {seat.status}
                  </span>
                  <p className="mt-1 text-[10px] text-muted-foreground">{seat.state}</p>
                </div>
                <div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={seat.load}
                    onChange={(event) => updateSeat(seat.id, { load: Number(event.target.value) })}
                    className="w-full accent-primary"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">{seat.load}%</p>
                </div>
                <div className="min-w-0">
                  {matchedProfile && matchedCheckInAt ? (
                    <>
                      <p className="truncate text-xs font-medium text-heading" title={matchedProfile.agent_id}>
                        {relativeTime(matchedCheckInAt)}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {profileDisplayName(matchedProfile)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">No check-in yet</p>
                      <p className="text-[10px] text-muted-foreground/70">
                        {profilesError
                          ? "Check-in feed unavailable"
                          : profilesLoading
                            ? "Checking..."
                            : profiles.length > 0
                              ? "No matching live seat"
                              : "Waiting for live seat"}
                      </p>
                    </>
                  )}
                </div>
                <input
                  value={seat.assigned}
                  onChange={(event) => updateSeat(seat.id, { assigned: event.target.value })}
                  className="w-full rounded-md border border-transparent bg-transparent px-0 py-1 text-body outline-none transition-colors focus:border-border/40 focus:bg-card/40 focus:px-2"
                  aria-label={`${seat.name} assigned work`}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title={editing ? "Save seat edits" : "Edit seat"}
                    onClick={() => setEditingSeatId(editing ? null : seat.id)}
                    className="rounded-md border border-border/40 bg-card/40 p-1.5 text-muted-foreground transition-colors hover:text-primary"
                  >
                    {editing ? <Save className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                  </button>
                  {seat.issue ? (
                    <span className="text-[10px] text-amber-300">{seat.issue}</span>
                  ) : seat.isVirtual ? (
                    <span className="text-[10px] text-amber-300">Fallback</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Manual</span>
                  )}
                </div>
              </div>
            );
          })}
          {extraProfiles.map((profile) => {
            const checkedInAt = latestProfileCheckInAt(profile);
            const checkedInMs = checkedInAt ? Date.parse(checkedInAt) : NaN;
            const isReady = Number.isFinite(checkedInMs) && Date.now() - checkedInMs < 15 * 60 * 1000;
            return (
              <div
                key={`live-${profile.agent_id}`}
                className="grid grid-cols-[minmax(210px,1.4fr)_110px_130px_minmax(150px,0.8fr)_minmax(180px,1.2fr)_minmax(190px,1fr)] items-center gap-3 bg-primary/[0.025] px-4 py-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-heading">
                    <span className="mr-1.5" aria-hidden="true">{profile.emoji ?? "💻"}</span>
                    {profileDisplayName(profile)}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">{profile.agent_id}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{profile.user_agent_hint ?? "Live seat"}</p>
                </div>
                <div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] ${
                      isReady
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                        : "border-amber-400/30 bg-amber-400/10 text-amber-300"
                    }`}
                  >
                    {isReady ? "Ready" : "Seen"}
                  </span>
                  <p className="mt-1 text-[10px] text-muted-foreground">Auto-detected</p>
                </div>
                <div>
                  <div className="h-1.5 w-full rounded-full bg-border/60">
                    <div className="h-1.5 w-1/4 rounded-full bg-primary" />
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">Auto</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-heading" title={profile.agent_id}>
                    {relativeTime(checkedInAt)}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {profile.current_status ? "Status updated" : "Checked in"}
                  </p>
                </div>
                <p className="text-body">General capacity</p>
                <p className="text-[10px] text-primary">Live seat</p>
              </div>
            );
          })}
        </div>
      </div>

      {issues.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-300" />
            <h3 className="text-sm font-semibold text-heading">Needs attention</h3>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-body">
            {issues.map((seat) => (
              <li key={seat.id}>
                <span className="font-medium text-heading">{seat.name}:</span> {seat.issue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function TemplatePicker({
  onPick,
  onClose,
}: {
  onPick: (template: AgentTemplate | null) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-border/40 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border/40 p-6">
          <div>
            <h2 className="text-lg font-semibold text-heading">Start from a template</h2>
            <p className="mt-1 text-xs text-body">
              Each template ships with a sensible system prompt, role, and starter tool selection.
              You can edit everything after creating.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-heading"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-5">
            {CREW_CATEGORIES.map((cat) => {
              const members = AGENT_TEMPLATES.filter((t) => t.category === cat.key);
              if (members.length === 0) return null;
              return (
                <div key={cat.key}>
                  <div className="mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {cat.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70">{cat.hint}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {members.map((tpl) => {
                      const Icon = tpl.icon;
                      return (
                        <button
                          key={tpl.role}
                          type="button"
                          onClick={() => onPick(tpl)}
                          className="rounded-lg border border-border/40 bg-card/40 p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                              <Icon className="h-4 w-4" />
                            </div>
                            <span className="text-sm font-semibold text-heading">{tpl.name}</span>
                            <span className="rounded-full border border-border/40 bg-card/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                              {tpl.role}
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs text-body">{tpl.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Start blank
              </p>
              <button
                type="button"
                onClick={() => onPick(null)}
                className="w-full rounded-lg border border-dashed border-border/50 bg-card/20 p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-heading">Custom</span>
                  <span className="rounded-full border border-border/40 bg-card/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                    blank
                  </span>
                </div>
                <p className="mt-1 text-xs text-body">
                  Start from scratch and define everything yourself.
                </p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentEditor({
  detail,
  connectors,
  onClose,
  onSaved,
  onDelete,
}: {
  detail: AgentDetail;
  connectors: Connector[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDelete: () => void;
}) {
  const [form, setForm] = useState({
    name: detail.agent.name,
    role: detail.agent.role,
    description: detail.agent.description ?? "",
    system_prompt: detail.agent.system_prompt ?? "",
    avatar_url: detail.agent.avatar_url ?? "",
    is_active: detail.agent.is_active,
    is_default: detail.agent.is_default,
  });
  const [selectedTools, setSelectedTools] = useState<Set<string>>(
    new Set(detail.tools.map((t) => t.connector_id))
  );
  const [memoryEnabled, setMemoryEnabled] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    const provided = new Map(detail.memory_scope.map((s) => [s.memory_layer, s.is_enabled]));
    for (const l of MEMORY_LAYERS) {
      map[l.key] = provided.has(l.key) ? !!provided.get(l.key) : provided.size === 0;
    }
    return map;
  });
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const lower = search.toLowerCase();
    const filtered = connectors.filter(
      (c) =>
        !lower ||
        c.name.toLowerCase().includes(lower) ||
        c.category.toLowerCase().includes(lower) ||
        (c.description ?? "").toLowerCase().includes(lower)
    );
    const map = new Map<string, Connector[]>();
    for (const c of filtered) {
      const arr = map.get(c.category) ?? [];
      arr.push(c);
      map.set(c.category, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [connectors, search]);

  const toggleTool = (id: string) => {
    setSelectedTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllInCategory = (cat: string) => {
    const items = grouped.find(([c]) => c === cat)?.[1] ?? [];
    setSelectedTools((prev) => {
      const next = new Set(prev);
      const allOn = items.every((c) => next.has(c.id));
      for (const c of items) {
        if (allOn) next.delete(c.id);
        else next.add(c.id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setErr(null);
    try {
      await api("admin_agent_update", {
        method: "POST",
        body: JSON.stringify({ agent_id: detail.agent.id, ...form }),
      });
      await api("admin_agent_tools_update", {
        method: "POST",
        body: JSON.stringify({
          agent_id: detail.agent.id,
          connector_ids: Array.from(selectedTools),
        }),
      });
      const layers = MEMORY_LAYERS.map((l) => ({
        memory_layer: l.key,
        is_enabled: !!memoryEnabled[l.key],
      }));
      await api("admin_agent_memory_update", {
        method: "POST",
        body: JSON.stringify({ agent_id: detail.agent.id, layers }),
      });
      await onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-border/40 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border/40 p-6">
          <div>
            <h2 className="text-lg font-semibold text-heading">Edit Agent: {form.name}</h2>
            <p className="mt-1 text-xs text-body">
              Slug: <code className="font-mono">{detail.agent.slug}</code>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-heading"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {err && (
            <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-300">
              {err}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-md border border-border/40 bg-card/40 px-3 py-2 text-sm text-heading focus:border-primary/40 focus:outline-none"
              />
            </Field>
            <Field label="Role">
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full rounded-md border border-border/40 bg-card/40 px-3 py-2 text-sm text-heading focus:border-primary/40 focus:outline-none"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Description">
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="One-line summary of what this agent does"
                className="w-full rounded-md border border-border/40 bg-card/40 px-3 py-2 text-sm text-heading focus:border-primary/40 focus:outline-none"
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field
              label="Personality &amp; Instructions"
              hint="What the agent reads at the start of every session. Write it like you're briefing a smart new hire."
            >
              <textarea
                value={form.system_prompt}
                onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
                rows={8}
                className="w-full rounded-md border border-border/40 bg-card/40 px-3 py-2 font-mono text-xs text-heading focus:border-primary/40 focus:outline-none"
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Avatar URL (optional)">
              <input
                type="text"
                value={form.avatar_url}
                onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                placeholder="https://..."
                className="w-full rounded-md border border-border/40 bg-card/40 px-3 py-2 text-sm text-heading focus:border-primary/40 focus:outline-none"
              />
            </Field>
            <div className="flex items-end gap-4 pb-2">
              <label className="flex items-center gap-2 text-xs text-body">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-border/40 bg-card/40 text-primary focus:ring-primary"
                />
                Active
              </label>
              <label className="flex items-center gap-2 text-xs text-body">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                  className="h-4 w-4 rounded border-border/40 bg-card/40 text-primary focus:ring-primary"
                />
                Default agent
              </label>
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-heading">
                Tools ({selectedTools.size} of {connectors.length} enabled)
              </p>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tools"
                  className="rounded-md border border-border/40 bg-card/40 py-1 pl-7 pr-2 text-xs text-heading focus:border-primary/40 focus:outline-none"
                />
              </div>
            </div>
            <p className="mb-3 text-[11px] text-muted-foreground">
              Leave all unchecked to give the agent access to every tool. Otherwise it only sees
              what you check.
            </p>
            <div className="space-y-3">
              {grouped.map(([cat, items]) => {
                const allOn = items.every((c) => selectedTools.has(c.id));
                return (
                  <div key={cat} className="rounded-lg border border-border/40 bg-card/20 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {cat}
                      </p>
                      <button
                        type="button"
                        onClick={() => toggleAllInCategory(cat)}
                        className="text-[10px] text-primary hover:underline"
                      >
                        {allOn ? "Clear all" : "Select all"}
                      </button>
                    </div>
                    <div className="grid gap-1 sm:grid-cols-2">
                      {items.map((c) => {
                        const on = selectedTools.has(c.id);
                        return (
                          <label
                            key={c.id}
                            className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors ${
                              on ? "bg-primary/10 text-heading" : "text-body hover:bg-card/40"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => toggleTool(c.id)}
                              className="h-3.5 w-3.5 rounded border-border/40 bg-card/40 text-primary focus:ring-primary"
                            />
                            <span className="truncate">{c.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {grouped.length === 0 && (
                <p className="text-xs text-muted-foreground">No tools match your search.</p>
              )}
            </div>
          </div>

          <div className="mt-6">
            <p className="mb-2 text-sm font-semibold text-heading">Memory Access</p>
            <p className="mb-3 text-[11px] text-muted-foreground">
              Pick which memory layers this agent can read at session start.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {MEMORY_LAYERS.map((l) => (
                <label
                  key={l.key}
                  className={`flex items-start gap-2 rounded-md border border-border/40 p-3 text-xs transition-colors ${
                    memoryEnabled[l.key] ? "bg-primary/5" : "bg-card/20"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!memoryEnabled[l.key]}
                    onChange={(e) =>
                      setMemoryEnabled({ ...memoryEnabled, [l.key]: e.target.checked })
                    }
                    className="mt-0.5 h-4 w-4 rounded border-border/40 bg-card/40 text-primary focus:ring-primary"
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-heading">{l.label}</p>
                    <p className="text-[10px] text-muted-foreground">{l.hint}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border/40 p-6">
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:underline"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Agent
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border/40 bg-card/40 px-4 py-2 text-sm text-body transition-colors hover:text-heading"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-heading">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export type { Agent, MemoryLayerKey };

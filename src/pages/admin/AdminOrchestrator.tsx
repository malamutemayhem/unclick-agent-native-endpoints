/**
 * Admin Orchestrator - the AI command center.
 *
 * Left: full-height admin chat panel (channel mode preferred, Gemini
 *       fallback when no Claude Code channel is online).
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
} from "lucide-react";
import AIChatPanel from "@/components/admin/AIChatPanel";
import {
  aiChatEnvEnabled,
  fetchAiChatTenantSettings,
  type AiChatTenantSettings,
  type ChannelStatus,
} from "@/components/admin/aiChatConfig";
import { useSession } from "@/lib/auth";

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

const FRESHNESS_STYLES: Record<SeatFreshnessLabel, string> = {
  Live: "border-[#61C1C4]/35 bg-[#61C1C4]/10 text-[#61C1C4]",
  Recent: "border-white/[0.08] bg-white/[0.04] text-white/60",
  "Missed check-in": "border-[#E2B93B]/35 bg-[#E2B93B]/10 text-[#E2B93B]",
  Quiet: "border-white/[0.06] bg-black/20 text-white/35",
};

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
        {/* Main chat pane */}
        <div className="flex min-h-[620px] flex-col">
          {chatDisabledReason ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#111111] p-8 text-sm text-white/60">
              {chatDisabledReason}
            </div>
          ) : (
            <AIChatPanel authToken={authToken} />
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
            <ContinuityRow key={`${event.source_kind}:${event.source_id}`} event={event} />
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

function ContinuityRow({ event }: { event: OrchestratorContext["continuity_events"][number] }) {
  const content = (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#61C1C4]">
          {event.kind}
        </span>
        <span className="shrink-0 text-[10px] text-white/30">{formatRelative(event.created_at)}</span>
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

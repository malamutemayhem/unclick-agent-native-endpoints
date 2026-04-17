/**
 * Memory Admin - placeholder page
 *
 * This page will become the visual admin dashboard for UnClick Memory.
 * It connects to /api/memory-admin to read/write all 6 memory layers.
 *
 * API actions available (GET unless noted):
 *   ?action=status - layer counts + decay tier breakdown
 *   ?action=business_context - all business context entries
 *   ?action=sessions&limit=20 - recent session summaries
 *   ?action=facts&query=x&show_all=true - extracted facts (search + filter)
 *   ?action=library - knowledge library index
 *   ?action=library_doc&slug=x - full document by slug
 *   ?action=conversations - session list with message counts
 *   ?action=conversations&session_id=x - messages for a session
 *   ?action=code&session_id=x - code dumps (optional session filter)
 *   ?action=search&query=x - full-text search across conversation logs
 *   ?action=delete_fact - POST: archive a fact (fact_id in body)
 *   ?action=delete_session - POST: delete a session summary (session_id in body)
 *   ?action=update_business_context - POST: upsert business context (category, key, value in body)
 *
 * Tabs planned for the full UI:
 *   1. Overview - counts per layer, decay chart, quick stats
 *   2. Context - business context entries (Layer 1), add/edit
 *   3. Library - knowledge library docs (Layer 2), view/edit
 *   4. Sessions - session summaries (Layer 3), browse/search
 *   5. Facts - extracted facts (Layer 4), search/archive/supersede
 *   6. Logs - conversation log (Layer 5), browse by session
 *   7. Code - code dumps (Layer 6), browse/search
 *   8. Search - full-text search across everything
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ClaimKeyBanner from "@/components/ClaimKeyBanner";
import AIChatPanel from "@/components/admin/AIChatPanel";
import { isAdminAIChatEnabled } from "@/components/admin/aiChatConfig";
import { Brain, Database, Monitor, CheckCircle2, ArrowRight, Layers, FileText, Search, Code, Clock, Sparkles, Plug, Hammer } from "lucide-react";

interface MemoryConfigStatus {
  configured: boolean;
  supabase_url?: string;
  schema_installed?: boolean;
  last_used_at?: string | null;
}

interface ConnectionCheck {
  connected: boolean;
  configured: boolean;
  has_context: boolean;
  context_count: number;
  fact_count: number;
  last_session: string | null;
  last_session_platform: string | null;
  last_used_at: string | null;
}

function connectionTier(check: ConnectionCheck | null): {
  dot: string;
  label: string;
  tone: "primary" | "amber" | "muted";
} {
  if (!check || !check.connected) {
    return { dot: "bg-muted-foreground", label: "Claude Code not connected", tone: "muted" };
  }
  const last = check.last_session ?? check.last_used_at;
  if (last) {
    const ageDays = (Date.now() - new Date(last).getTime()) / 86_400_000;
    if (ageDays > 7) {
      return { dot: "bg-amber-400", label: "Claude Code inactive", tone: "amber" };
    }
  }
  return { dot: "bg-primary", label: "Claude Code connected", tone: "primary" };
}

interface Device {
  id: string;
  label: string | null;
  platform: string | null;
  storage_mode: "local" | "cloud";
  first_seen: string;
  last_seen: string;
}

interface MemoryStatus {
  business_context?: number;
  library?: number;
  sessions?: number;
  facts?: number;
  conversations?: number;
  code?: number;
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

const STAT_CARDS: { key: keyof MemoryStatus; label: string; icon: typeof Layers }[] = [
  { key: "facts", label: "Facts", icon: Search },
  { key: "sessions", label: "Sessions", icon: Clock },
  { key: "library", label: "Library docs", icon: Layers },
  { key: "business_context", label: "Context entries", icon: FileText },
  { key: "conversations", label: "Conversations", icon: Brain },
  { key: "code", label: "Code dumps", icon: Code },
];

export default function MemoryAdminPage() {
  const [config, setConfig] = useState<MemoryConfigStatus | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [status, setStatus] = useState<MemoryStatus | null>(null);
  const [connection, setConnection] = useState<ConnectionCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const chatEnabled = isAdminAIChatEnabled();

  useEffect(() => {
    let cancelled = false;
    const apiKey = localStorage.getItem("unclick_api_key") ?? "";
    if (!apiKey) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const [cfgRes, devRes, statusRes, connRes] = await Promise.all([
          fetch(`/api/memory-admin?action=setup_status&api_key=${encodeURIComponent(apiKey)}`),
          fetch("/api/memory-admin?action=list_devices", {
            headers: { Authorization: `Bearer ${apiKey}` },
          }),
          fetch("/api/memory-admin?action=status", {
            headers: { Authorization: `Bearer ${apiKey}` },
          }),
          fetch(
            `/api/memory-admin?action=admin_check_connection&api_key=${encodeURIComponent(apiKey)}`,
          ),
        ]);

        if (!cancelled && cfgRes.ok) {
          setConfig((await cfgRes.json()) as MemoryConfigStatus);
        }
        if (!cancelled && devRes.ok) {
          const body = (await devRes.json()) as { data: Device[] };
          setDevices(body.data ?? []);
        }
        if (!cancelled && statusRes.ok) {
          const body = (await statusRes.json()) as MemoryStatus & { data?: MemoryStatus };
          // Endpoint may return raw counts or wrap them under `data`.
          setStatus(body.data ?? body);
        }
        if (!cancelled && connRes.ok) {
          setConnection((await connRes.json()) as ConnectionCheck);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const hasApiKey =
    typeof window !== "undefined" && Boolean(localStorage.getItem("unclick_api_key"));

  const localCount = devices.filter((d) => d.storage_mode === "local").length;
  const cloudCount = devices.filter((d) => d.storage_mode === "cloud").length;
  const shouldNudge = !config?.configured && devices.length >= 2;
  const tier = connectionTier(connection);
  const showConnectBanner = !loading && !connection?.connected;

  // First-run welcome: user has never touched chat, Claude Code, or build
  // tasks. We use "no sessions + not connected" as the proxy since a fresh
  // account has no activity of any kind.
  const isFirstRun =
    !loading &&
    hasApiKey &&
    !connection?.connected &&
    (status?.sessions ?? 0) === 0 &&
    (status?.conversations ?? 0) === 0;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 pb-32 pt-28">
        <ClaimKeyBanner />
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Brain className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">Memory Admin</h1>
            <p className="text-sm text-body">View and manage your agent's persistent memory</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/memory/connect"
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                tier.tone === "primary"
                  ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                  : tier.tone === "amber"
                    ? "border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20"
                    : "border-border/50 bg-card/40 text-body hover:bg-card/60"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${tier.dot}`} />
              {loading ? "..." : tier.label}
            </Link>
            <Link
              to="/memory/connect"
              className="inline-flex items-center gap-1.5 rounded-md border border-border/40 bg-card/40 px-3 py-1.5 text-xs font-medium text-body transition-colors hover:bg-card/60"
              aria-label="Connect Claude Code"
            >
              <Plug className="h-3.5 w-3.5 text-primary" />
              Connect
            </Link>
            {chatEnabled && (
              <button
                onClick={() => setChatOpen(true)}
                className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Ask memory
                <span
                  className="rounded-full px-1.5 py-0.5 font-mono text-[9px] font-semibold"
                  style={{ backgroundColor: "#E2B93B22", color: "#E2B93B" }}
                >
                  BETA
                </span>
              </button>
            )}
          </div>
        </div>

        {/* First-run welcome: fresh account with no activity anywhere */}
        {isFirstRun && (
          <div className="mb-6 rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-heading">Your AI Command Center</h2>
                  <p className="mt-1 max-w-lg text-sm text-body">
                    Plan, build, and manage with AI. Chat with your memory, connect Claude Code,
                    and track build tasks, all from one place.
                  </p>
                </div>
              </div>
              {chatEnabled && (
                <button
                  onClick={() => setChatOpen(true)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                >
                  <Sparkles className="h-4 w-4" />
                  Get Started
                </button>
              )}
            </div>
          </div>
        )}

        {/* Orchestrator: single command center grouping chat, connect, build */}
        <section className="mb-6 rounded-2xl border border-primary/20 bg-card/20 p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
              Orchestrator
            </span>
            <span className="text-[10px] text-muted-foreground">Your AI command center</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              disabled={!chatEnabled}
              className="group flex items-start gap-3 rounded-xl border border-border/40 bg-card/40 p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-heading">AI Assistant</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {chatEnabled ? "Chat with your memory" : "Coming soon"}
                </p>
              </div>
            </button>

            <Link
              to="/memory/connect"
              className="group flex items-start gap-3 rounded-xl border border-border/40 bg-card/40 p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Plug className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-heading">Connect Claude Code</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {connection?.connected ? tier.label : "One command to wire it up"}
                </p>
              </div>
            </Link>

            <Link
              to="/build"
              className="group flex items-start gap-3 rounded-xl border border-border/40 bg-card/40 p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Hammer className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-heading">Build Tasks</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  Plan and track your work
                </p>
              </div>
            </Link>
          </div>
        </section>

        {/* Stat cards: counts per memory layer from ?action=status */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STAT_CARDS.map(({ key, label, icon: Icon }) => {
            const value = status?.[key];
            const display =
              !hasApiKey ? "-" : loading ? "..." : typeof value === "number" ? value.toLocaleString() : "0";
            return (
              <div
                key={key}
                className="rounded-xl border border-border/40 bg-card/20 p-4"
              >
                <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <Icon className="h-3 w-3 text-primary/70" />
                  {label}
                </div>
                <div className="mt-2 font-mono text-2xl font-semibold text-heading tabular-nums">
                  {display}
                </div>
              </div>
            );
          })}
        </div>

        {/* First-visit banner: no Claude Code activity yet */}
        {showConnectBanner && (
          <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Plug className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-heading">
                    Connect Claude Code to load your memory automatically
                  </p>
                  <p className="mt-1 text-xs text-body">
                    One command. Every future session knows your standing rules, business context, and
                    open loops.
                  </p>
                </div>
              </div>
              <Link
                to="/memory/connect"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
              >
                Connect
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Top-level nudge: user has 2+ devices on local storage but no cloud config */}
        {shouldNudge && (
          <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-heading">
                  You're using UnClick on {devices.length} machines.
                </p>
                <p className="mt-1 text-xs text-body">
                  Turn on cloud sync so memory follows you across all of them. Bring your own Supabase - 
                  we never see your data. One paste, you're done.
                </p>
              </div>
              <Link
                to="/memory/setup"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
              >
                Turn on cloud sync
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Cloud sync status */}
          <div className="rounded-xl border border-border/40 bg-card/20 p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-heading">
                <Database className="h-4 w-4 text-primary" />
                Cloud sync
              </h2>
              {config?.configured && (
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
                  <CheckCircle2 className="h-3 w-3" /> Connected
                </span>
              )}
            </div>

            {loading ? (
              <p className="mt-3 text-xs text-muted-foreground">Loading...</p>
            ) : !config?.configured ? (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-body">
                  Memory's running locally on this device. Turn on cloud sync to share context across
                  every machine you use.
                </p>
                <Link
                  to="/memory/setup"
                  className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                >
                  Set up cloud sync
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Project</span>
                  <code className="truncate font-mono text-[11px] text-heading">
                    {config.supabase_url}
                  </code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Schema</span>
                  <span className={config.schema_installed ? "text-primary" : "text-amber-400"}>
                    {config.schema_installed ? "installed" : "pending"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last sync</span>
                  <span className="text-body">{formatRelative(config.last_used_at)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Devices */}
          <div className="rounded-xl border border-border/40 bg-card/20 p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-heading">
              <Monitor className="h-4 w-4 text-primary" />
              Devices
              <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                {cloudCount} cloud / {localCount} local
              </span>
            </h2>

            {loading ? (
              <p className="mt-3 text-xs text-muted-foreground">Loading...</p>
            ) : devices.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                No devices seen yet. Fire up the MCP server on any machine and it'll appear here.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border/20">
                {devices.map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-2 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-heading">{d.label ?? "Unknown device"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {d.platform ?? "unknown"} · seen {formatRelative(d.last_seen)}
                      </p>
                    </div>
                    <span
                      className={`ml-3 inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] ${
                        d.storage_mode === "cloud"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border/50 bg-card/40 text-muted-foreground"
                      }`}
                    >
                      {d.storage_mode}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-border/40 bg-card/20 p-8">
          <p className="text-sm text-body">
            Full dashboard UI coming soon. Memory layer browsing + editing is wired up at{" "}
            <code className="rounded bg-muted/20 px-1.5 py-0.5 font-mono text-xs text-primary">
              /api/memory-admin
            </code>
          </p>
          <div className="mt-6 rounded-lg border border-dashed border-border/50 bg-muted/5 p-6 text-center">
            <span className="font-mono text-xs text-muted-foreground">
              Layer browser coming soon
            </span>
          </div>
        </div>
      </main>
      <Footer />
      {chatEnabled && <AIChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />}
    </div>
  );
}

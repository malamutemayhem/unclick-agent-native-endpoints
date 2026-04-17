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
import { Brain, Database, Monitor, CheckCircle2, ArrowRight, Layers, FileText, Search, Code, Clock, BookOpen, MessageSquare } from "lucide-react";
import AIChatPanel from "@/components/admin/AIChatPanel";
import {
  aiChatEnvEnabled,
  fetchAiChatTenantSettings,
  type AiChatTenantSettings,
} from "@/components/admin/aiChatConfig";

interface MemoryConfigStatus {
  configured: boolean;
  supabase_url?: string;
  schema_installed?: boolean;
  last_used_at?: string | null;
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
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState<string>("");
  const [aiChatSettings, setAiChatSettings] = useState<AiChatTenantSettings | null>(null);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [statusCounts, setStatusCounts] = useState<{
    facts: number;
    sessions: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const key = localStorage.getItem("unclick_api_key") ?? "";
    setApiKey(key);
    if (!key) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const [cfgRes, devRes, aiRes, statusRes] = await Promise.all([
          fetch(`/api/memory-admin?action=setup_status&api_key=${encodeURIComponent(key)}`),
          fetch("/api/memory-admin?action=list_devices", {
            headers: { Authorization: `Bearer ${key}` },
          }),
          fetchAiChatTenantSettings(key),
          fetch("/api/memory-admin?action=status", {
            headers: { Authorization: `Bearer ${key}` },
          }),
        ]);

        if (!cancelled && cfgRes.ok) {
          setConfig((await cfgRes.json()) as MemoryConfigStatus);
        }
        if (!cancelled && devRes.ok) {
          const body = (await devRes.json()) as { data: Device[] };
          setDevices(body.data ?? []);
        }
        if (!cancelled && aiRes?.env_enabled) {
          setAiChatSettings(aiRes.settings);
        }
        if (!cancelled && statusRes.ok) {
          const body = (await statusRes.json()) as MemoryStatus & { data?: MemoryStatus };
          // Endpoint may return raw counts or wrap them under `data`.
          const parsed = body.data ?? body;
          setStatus(parsed);
          setStatusCounts({
            facts: parsed.facts ?? 0,
            sessions: parsed.sessions ?? 0,
          });
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
  const aiChatVisible =
    aiChatEnvEnabled() && Boolean(aiChatSettings?.ai_chat_enabled) && Boolean(apiKey);

  const localCount = devices.filter((d) => d.storage_mode === "local").length;
  const cloudCount = devices.filter((d) => d.storage_mode === "cloud").length;
  const shouldNudge = !config?.configured && devices.length >= 2;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 pb-32 pt-28">
        <ClaimKeyBanner />
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Brain className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">Memory Admin</h1>
            <p className="text-sm text-body">View and manage your agent's persistent memory</p>
          </div>
          <Link
            to="/memory/setup-guide"
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Setup Guide
          </Link>
          {aiChatVisible && (
            <button
              onClick={() => setAiChatOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted/20"
              style={{ borderColor: "rgba(97, 193, 196, 0.4)", color: "#61C1C4" }}
              title="Open UnClick AI (beta)"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">UnClick AI</span>
              <span
                className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase text-black"
                style={{ backgroundColor: "#E2B93B" }}
              >
                Beta
              </span>
            </button>
          )}
        </div>

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
      {aiChatVisible && (
        <AIChatPanel
          open={aiChatOpen}
          onClose={() => setAiChatOpen(false)}
          apiKey={apiKey}
          factCount={statusCounts?.facts}
          sessionCount={statusCounts?.sessions}
        />
      )}
    </div>
  );
}

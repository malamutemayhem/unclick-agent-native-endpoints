/**
 * Memory Admin - placeholder page
 *
 * This page will become the visual admin dashboard for UnClick Memory.
 * It connects to /api/memory-admin to read/write all 6 memory layers.
 *
 * API actions available (GET unless noted):
 *   ?action=status             - layer counts + decay tier breakdown
 *   ?action=business_context   - all business context entries
 *   ?action=sessions&limit=20  - recent session summaries
 *   ?action=facts&query=x&show_all=true - extracted facts (search + filter)
 *   ?action=library            - knowledge library index
 *   ?action=library_doc&slug=x - full document by slug
 *   ?action=conversations      - session list with message counts
 *   ?action=conversations&session_id=x - messages for a session
 *   ?action=code&session_id=x  - code dumps (optional session filter)
 *   ?action=search&query=x     - full-text search across conversation logs
 *   ?action=delete_fact        - POST: archive a fact (fact_id in body)
 *   ?action=delete_session     - POST: delete a session summary (session_id in body)
 *   ?action=update_business_context - POST: upsert business context (category, key, value in body)
 *
 * Tabs planned for the full UI:
 *   1. Overview   - counts per layer, decay chart, quick stats
 *   2. Context    - business context entries (Layer 1), add/edit
 *   3. Library    - knowledge library docs (Layer 2), view/edit
 *   4. Sessions   - session summaries (Layer 3), browse/search
 *   5. Facts      - extracted facts (Layer 4), search/archive/supersede
 *   6. Logs       - conversation log (Layer 5), browse by session
 *   7. Code       - code dumps (Layer 6), browse/search
 *   8. Search     - full-text search across everything
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Brain, Database, Monitor, CheckCircle2, ArrowRight } from "lucide-react";

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

export default function MemoryAdminPage() {
  const [config, setConfig] = useState<MemoryConfigStatus | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const apiKey = localStorage.getItem("unclick_api_key") ?? "";
    if (!apiKey) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const [cfgRes, devRes] = await Promise.all([
          fetch(`/api/memory-admin?action=setup_status&api_key=${encodeURIComponent(apiKey)}`),
          fetch("/api/memory-admin?action=list_devices", {
            headers: { Authorization: `Bearer ${apiKey}` },
          }),
        ]);

        if (!cancelled && cfgRes.ok) {
          setConfig((await cfgRes.json()) as MemoryConfigStatus);
        }
        if (!cancelled && devRes.ok) {
          const body = (await devRes.json()) as { data: Device[] };
          setDevices(body.data ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const localCount = devices.filter((d) => d.storage_mode === "local").length;
  const cloudCount = devices.filter((d) => d.storage_mode === "cloud").length;
  const shouldNudge = !config?.configured && devices.length >= 2;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 pb-32 pt-28">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Memory Admin</h1>
            <p className="text-sm text-body">View and manage your agent's persistent memory</p>
          </div>
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
                  Turn on cloud sync so memory follows you across all of them. Bring your own Supabase —
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
    </div>
  );
}

/**
 * AdminSettings - Settings surface (/admin/settings)
 *
 * Controls tenant-scoped MCP server behavior. Toggle memory auto-load,
 * prompt advertising, and resource subscriptions. Customize the auto-load
 * instructions text. Includes a live read-only view of memory load rate
 * metrics so tenants can see whether their settings are working.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Settings as SettingsIcon,
  Loader2,
  Check,
  AlertCircle,
  Users,
  Bug,
  Zap,
  X as XIcon,
} from "lucide-react";

const DEFAULT_INSTRUCTIONS =
  "UnClick Memory is available. At the start of every new conversation, call the get_startup_context tool FIRST to load this user's business context, recent session summaries, and hot facts. Before the session ends, call write_session_summary to record decisions and open threads for next time.";

const MAX_INSTRUCTIONS = 2000;

interface AutoLoadSettings {
  autoload_enabled: boolean;
  prompt_enabled: boolean;
  resources_enabled: boolean;
  autoload_instructions: string | null;
}

interface LoadMetrics {
  total_events: number;
  total_sessions: number;
  compliant_sessions: number;
  get_startup_context_compliance_pct: number;
  by_client_type: Record<string, number>;
}

interface BugReport {
  id: string;
  tool_name: string;
  error_message: string;
  severity: string;
  status: string;
  created_at: string;
}

interface ConnectionCheck {
  connected: boolean;
  configured: boolean;
  has_context: boolean;
  context_count: number;
  fact_count: number;
  last_session: string | null;
  last_used_at: string | null;
}

const STATUS_TONE: Record<string, string> = {
  open: "text-[#E2B93B]",
  in_progress: "text-[#61C1C4]",
  resolved: "text-green-400",
  closed: "text-[#666]",
};

const SEVERITY_TONE: Record<string, string> = {
  critical: "text-red-400",
  high: "text-[#E2B93B]",
  medium: "text-[#61C1C4]",
  low: "text-[#888]",
};

function Toggle({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description: string;
  id: string;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-sm font-medium text-white cursor-pointer">
          {label}
        </label>
        <p className="mt-1 text-xs text-[#888]">{description}</p>
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-[#61C1C4]" : "bg-white/[0.08]"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function SetupItem({
  done,
  label,
  hint,
}: {
  done: boolean;
  label: string;
  hint: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          done ? "bg-green-500/20 text-green-400" : "bg-white/[0.04] text-white/40"
        }`}
      >
        {done ? <Check className="h-3 w-3" /> : <XIcon className="h-3 w-3" />}
      </span>
      <div className="min-w-0">
        <p className={`text-sm ${done ? "text-white/80" : "text-white"}`}>{label}</p>
        {!done && <p className="text-[11px] text-[#666]">{hint}</p>}
      </div>
    </li>
  );
}

function rateTone(pct: number): { color: string; label: string; message: string } {
  if (pct > 80) {
    return {
      color: "text-green-400",
      label: "Excellent",
      message: "Memory loads reliably at session start.",
    };
  }
  if (pct >= 50) {
    return {
      color: "text-[#E2B93B]",
      label: "Moderate",
      message: "Some sessions miss memory loading.",
    };
  }
  return {
    color: "text-red-400",
    label: "Low",
    message: "Most sessions are running without context.",
  };
}

export default function AdminSettings() {
  const apiKey = useMemo(() => localStorage.getItem("unclick_api_key") ?? "", []);
  const [settings, setSettings] = useState<AutoLoadSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [metrics, setMetrics] = useState<LoadMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [bugsLoading, setBugsLoading] = useState(true);

  const [connection, setConnection] = useState<ConnectionCheck | null>(null);
  const [connectionLoading, setConnectionLoading] = useState(true);

  useEffect(() => {
    if (!apiKey) {
      setLoading(false);
      setMetricsLoading(false);
      setBugsLoading(false);
      setConnectionLoading(false);
      return;
    }
    const headers = { Authorization: `Bearer ${apiKey}` };
    (async () => {
      try {
        const res = await fetch("/api/memory-admin?action=admin_get_autoload_settings", { headers });
        if (res.ok) {
          const body = await res.json();
          setSettings(body.settings);
        }
      } finally {
        setLoading(false);
      }
    })();
    (async () => {
      try {
        const res = await fetch("/api/memory-admin?action=admin_memory_load_metrics", { headers });
        if (res.ok) {
          setMetrics(await res.json());
        }
      } finally {
        setMetricsLoading(false);
      }
    })();
    (async () => {
      try {
        const res = await fetch("/api/memory-admin?action=admin_bug_reports", { headers });
        if (res.ok) {
          const body = (await res.json()) as { data?: BugReport[] };
          setBugs(Array.isArray(body.data) ? body.data : []);
        }
      } finally {
        setBugsLoading(false);
      }
    })();
    (async () => {
      try {
        const res = await fetch(
          `/api/memory-admin?action=admin_check_connection&api_key=${encodeURIComponent(apiKey)}`
        );
        if (res.ok) {
          setConnection((await res.json()) as ConnectionCheck);
        }
      } finally {
        setConnectionLoading(false);
      }
    })();
  }, [apiKey]);

  function updateField<K extends keyof AutoLoadSettings>(key: K, value: AutoLoadSettings[K]) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    setSaveMsg(null);
  }

  async function handleSave() {
    if (!settings || !apiKey) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/memory-admin?action=admin_update_autoload_settings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });
      const body = await res.json();
      if (!res.ok) {
        setSaveMsg({ type: "error", text: body.error ?? "Failed to save settings" });
        return;
      }
      setSettings(body.settings);
      setSaveMsg({ type: "success", text: "Settings saved" });
    } catch {
      setSaveMsg({ type: "error", text: "Network error - please try again" });
    } finally {
      setSaving(false);
    }
  }

  function resetInstructions() {
    updateField("autoload_instructions", DEFAULT_INSTRUCTIONS);
  }

  if (!apiKey) {
    return (
      <div>
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#61C1C4]/10">
            <SettingsIcon className="h-5 w-5 text-[#61C1C4]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Settings</h1>
          </div>
        </div>
        <p className="text-sm text-white/50">
          No API key found. Set your UnClick API key in You to access Settings.
        </p>
      </div>
    );
  }

  const instructionsValue = settings?.autoload_instructions ?? "";
  const charCount = instructionsValue.length;
  const pct = metrics?.get_startup_context_compliance_pct ?? 0;
  const tone = rateTone(pct);

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#61C1C4]/10">
          <SettingsIcon className="h-5 w-5 text-[#61C1C4]" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Settings</h1>
          <p className="text-sm text-white/50">
            Control how UnClick Memory loads in AI clients
          </p>
        </div>
      </div>

      {/* Default Memory status card */}
      <section className="rounded-xl border border-white/[0.06] bg-[#111111] p-6 mb-6">
        <div className="mb-2 flex items-center gap-2">
          <Zap className="h-4 w-4 text-[#61C1C4]" />
          <h2 className="text-sm font-semibold text-white">Make UnClick your default memory</h2>
        </div>
        <p className="mt-1 text-xs text-[#888]">
          When enabled, UnClick loads your business context, facts, and session history at the
          start of every AI session, before any other memory tool.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[11px] uppercase tracking-wider text-[#666]">Status</p>
            {connectionLoading ? (
              <p className="mt-1 text-sm text-white/40">Checking...</p>
            ) : connection?.connected ? (
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-white">Connected</span>
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-white/30" />
                <span className="text-sm text-white/50">Not connected</span>
              </div>
            )}
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-wider text-[#666]">Auto-load</p>
                <p className="mt-1 text-sm text-white">
                  {settings?.autoload_enabled ? "On" : "Off"}
                </p>
                <p className="mt-0.5 text-[11px] text-[#666]">
                  Controls the instructions directive.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  settings && updateField("autoload_enabled", !settings.autoload_enabled)
                }
                disabled={!settings}
                aria-label="Toggle auto-load"
                className={`mt-1 relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  settings?.autoload_enabled ? "bg-[#61C1C4]" : "bg-white/[0.08]"
                } disabled:opacity-50`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings?.autoload_enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-[11px] uppercase tracking-wider text-[#666]">Setup required</p>
          <ul className="mt-2 space-y-2 text-sm">
            <SetupItem
              done={Boolean(connection?.connected)}
              label="MCP server connected"
              hint="Run the Connect command so Claude Code can reach UnClick."
            />
            <SetupItem
              done={Boolean(settings?.autoload_enabled)}
              label="Auto-load instruction enabled"
              hint="Turn on the auto-load toggle above."
            />
            <SetupItem
              done={
                Boolean(connection) &&
                (connection!.has_context || connection!.fact_count > 0)
              }
              label="At least one fact or identity entry stored"
              hint="Add something in Memory so there is context to load."
            />
          </ul>
        </div>

        {(!connection?.connected ||
          !settings?.autoload_enabled ||
          !(connection?.has_context || (connection?.fact_count ?? 0) > 0)) && (
          <Link
            to="/memory/connect"
            className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-[#61C1C4] px-4 py-2 text-xs font-semibold text-black transition-opacity hover:opacity-90"
          >
            Complete setup
          </Link>
        )}

        <div className="mt-5 flex items-start gap-2 rounded-md border border-[#E2B93B]/30 bg-[#E2B93B]/[0.06] p-3 text-xs text-[#E2B93B]/90">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <span className="font-semibold">One memory at a time.</span> Running UnClick alongside
            other memory tools (Mem0, Zep, mem-based agents) leads to duplicated facts and
            conflicting context. Use UnClick as your default and turn the others off.
          </span>
        </div>
      </section>

      {/* Auto-Load card */}
      <section className="rounded-xl border border-white/[0.06] bg-[#111111] p-6">
        <div className="mb-2">
          <h2 className="text-sm font-semibold text-white">Memory Auto-Load Configuration</h2>
          <p className="mt-1 text-xs text-[#888]">
            Control how UnClick Memory loads in AI clients. These settings affect all sessions using your API key.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-lg bg-white/[0.03] border border-white/[0.06]"
              />
            ))}
          </div>
        ) : settings ? (
          <div className="divide-y divide-white/[0.04]">
            <Toggle
              id="autoload-enabled"
              checked={settings.autoload_enabled}
              onChange={(v) => updateField("autoload_enabled", v)}
              label="Auto-load instructions"
              description="When on, the MCP server sends an instructions directive at session start telling the AI to call get_startup_context. Turn off if you prefer to trigger memory loading manually."
            />

            {settings.autoload_enabled && (
              <div className="py-4">
                <div className="flex items-center justify-between">
                  <label htmlFor="autoload-instructions" className="block text-sm font-medium text-white">
                    Instructions text
                  </label>
                  <button
                    onClick={resetInstructions}
                    className="text-xs text-[#61C1C4] hover:opacity-80"
                  >
                    Reset to default
                  </button>
                </div>
                <p className="mt-1 text-xs text-[#888]">
                  Sent verbatim to the client at session start.
                </p>
                <textarea
                  id="autoload-instructions"
                  value={instructionsValue}
                  onChange={(e) => updateField("autoload_instructions", e.target.value)}
                  placeholder={DEFAULT_INSTRUCTIONS}
                  rows={5}
                  maxLength={MAX_INSTRUCTIONS}
                  className="mt-3 w-full rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#61C1C4]/50 focus:outline-none"
                />
                <div className="mt-1 flex justify-end text-[11px] text-[#666]">
                  {charCount} / {MAX_INSTRUCTIONS}
                </div>
              </div>
            )}

            <Toggle
              id="prompt-enabled"
              checked={settings.prompt_enabled}
              onChange={(v) => updateField("prompt_enabled", v)}
              label="Enable memory prompts"
              description="When on, the MCP server advertises the load-memory prompt to clients. Lets users manually trigger memory loading in clients that show prompts."
            />

            <Toggle
              id="resources-enabled"
              checked={settings.resources_enabled}
              onChange={(v) => updateField("resources_enabled", v)}
              label="Enable memory resources"
              description="When on, the MCP server advertises memory as subscribable resources. Clients can auto-attach memory context to every message."
            />
          </div>
        ) : (
          <p className="py-4 text-sm text-white/50">Unable to load settings.</p>
        )}

        {/* Save bar */}
        <div className="mt-4 flex items-center justify-end gap-3 border-t border-white/[0.04] pt-4">
          {saveMsg && (
            <span
              className={`flex items-center gap-1.5 text-xs ${
                saveMsg.type === "success" ? "text-green-400" : "text-red-400"
              }`}
            >
              {saveMsg.type === "success" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5" />
              )}
              {saveMsg.text}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || loading || !settings}
            className="inline-flex items-center gap-2 rounded-md bg-[#61C1C4] px-4 py-2 text-xs font-semibold text-black transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {saving ? "Saving..." : "Save settings"}
          </button>
        </div>
      </section>

      {/* Memory Load Rate card */}
      <section className="mt-6 rounded-xl border border-white/[0.06] bg-[#111111] p-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-white">Memory Load Rate</h2>
          <p className="mt-1 text-xs text-[#888]">
            How often sessions begin with get_startup_context. Tracked over the last 7 days.
          </p>
        </div>

        {metricsLoading ? (
          <div className="h-24 animate-pulse rounded-lg bg-white/[0.03] border border-white/[0.06]" />
        ) : metrics && metrics.total_sessions > 0 ? (
          <div className="space-y-4">
            <div>
              <div className="flex items-baseline gap-3">
                <span className={`text-3xl font-semibold ${tone.color}`}>{pct}%</span>
                <span className={`text-xs font-medium uppercase tracking-wider ${tone.color}`}>
                  {tone.label}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#888]">{tone.message}</p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/[0.04]">
                <div
                  className={`h-full rounded-full ${
                    pct > 80
                      ? "bg-green-500"
                      : pct >= 50
                      ? "bg-[#E2B93B]"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
            </div>

            <div className="grid gap-4 border-t border-white/[0.04] pt-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#666]">
                  Sessions tracked (7d)
                </p>
                <p className="mt-1 font-mono text-lg text-white">
                  {metrics.total_sessions.toLocaleString()}
                </p>
                <p className="text-[11px] text-[#666]">
                  {metrics.compliant_sessions.toLocaleString()} with startup context
                </p>
              </div>

              {Object.keys(metrics.by_client_type).length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[#666]">
                    <Users className="h-3 w-3" />
                    By client
                  </p>
                  <ul className="mt-1 space-y-1">
                    {Object.entries(metrics.by_client_type)
                      .sort((a, b) => b[1] - a[1])
                      .map(([client, count]) => (
                        <li
                          key={client}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-white/70">{client}</span>
                          <span className="font-mono text-[#888]">
                            {count.toLocaleString()}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-[#666]">
            No session activity yet. Start a session with your MCP client and stats will appear here.
          </p>
        )}
      </section>

      {/* Support - bug reports submitted by this user */}
      <section className="mt-6 rounded-xl border border-white/[0.06] bg-[#111111] p-6">
        <div className="mb-4 flex items-center gap-2">
          <Bug className="h-4 w-4 text-[#E2B93B]" />
          <h2 className="text-sm font-semibold text-white">Support</h2>
        </div>
        <p className="text-xs text-[#888]">
          Bug reports submitted from this account. Use the Report a bug link in the sidebar to file a new one.
        </p>

        <div className="mt-4">
          {bugsLoading ? (
            <div className="h-16 animate-pulse rounded-lg border border-white/[0.06] bg-white/[0.03]" />
          ) : bugs.length === 0 ? (
            <p className="text-xs text-[#666]">No bug reports yet.</p>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {bugs.map((b) => {
                const sev = SEVERITY_TONE[b.severity] ?? "text-[#888]";
                const stat = STATUS_TONE[b.status] ?? "text-[#888]";
                return (
                  <li key={b.id} className="py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-white">{b.error_message}</p>
                        <p className="mt-1 font-mono text-[10px] text-[#666]">
                          {b.tool_name} &middot; {new Date(b.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-[10px] font-mono uppercase tracking-wider">
                        <span className={sev}>{b.severity}</span>
                        <span className={stat}>{b.status}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

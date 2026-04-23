import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCheck, Loader2, Settings } from "lucide-react";
import { useSession } from "@/lib/auth";

interface Signal {
  id: string;
  tool: string;
  action: string;
  severity: "info" | "action_needed" | "critical";
  summary: string;
  deep_link: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
  read_via: string | null;
}

type SeverityFilter = "all" | "info" | "action_needed" | "critical";

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(1, Math.floor((now - then) / 1000));
  if (diffSec < 60) return `${diffSec} second${diffSec === 1 ? "" : "s"} ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

const SEVERITY_STYLE: Record<Signal["severity"], string> = {
  critical: "border-red-500/30 bg-red-500/10 text-red-300",
  action_needed: "border-[#E2B93B]/30 bg-[#E2B93B]/10 text-[#E2B93B]",
  info: "border-[#61C1C4]/30 bg-[#61C1C4]/10 text-[#61C1C4]",
};

const SEVERITY_LABEL: Record<Signal["severity"], string> = {
  critical: "Critical",
  action_needed: "Action needed",
  info: "Info",
};

function toolBadgeColor(tool: string): string {
  let hash = 0;
  for (let i = 0; i < tool.length; i++) hash = (hash * 31 + tool.charCodeAt(i)) | 0;
  const hues = ["text-[#61C1C4] bg-[#61C1C4]/10", "text-[#E2B93B] bg-[#E2B93B]/10", "text-purple-300 bg-purple-500/10", "text-green-300 bg-green-500/10", "text-pink-300 bg-pink-500/10"];
  return hues[Math.abs(hash) % hues.length];
}

export default function SignalsCatalog() {
  const { session } = useSession();
  const token = session?.access_token;
  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolFilter, setToolFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const fetchSignals = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/memory-admin?action=list_signals", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          limit: 100,
          tool: toolFilter === "all" ? undefined : toolFilter,
          unread_only: unreadOnly,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to load signals");
      setSignals(body.signals ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load signals");
    } finally {
      setLoading(false);
    }
  }, [token, authHeader, toolFilter, unreadOnly]);

  useEffect(() => { void fetchSignals(); }, [fetchSignals]);

  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => { void fetchSignals(); }, 30_000);
    return () => clearInterval(id);
  }, [token, fetchSignals]);

  const filtered = useMemo(
    () => signals.filter((s) => severityFilter === "all" || s.severity === severityFilter),
    [signals, severityFilter],
  );

  const unreadCount = signals.filter((s) => !s.read_at).length;
  const tools = useMemo(() => {
    const set = new Set<string>();
    for (const s of signals) set.add(s.tool);
    return Array.from(set).sort();
  }, [signals]);

  async function markRead(id: string) {
    if (!token) return;
    await fetch("/api/memory-admin?action=mark_signal_read", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ signal_id: id, read_via: "ui" }),
    });
    setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, read_at: new Date().toISOString() } : s)));
  }

  async function markAllRead() {
    if (!token) return;
    await fetch("/api/memory-admin?action=mark_all_read", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: "{}",
    });
    setSignals((prev) => prev.map((s) => (s.read_at ? s : { ...s, read_at: new Date().toISOString() })));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-[#61C1C4]" />
          <div>
            <h1 className="text-2xl font-semibold text-white">Signals</h1>
            <p className="mt-0.5 text-sm text-[#888]">Catch up on what your tools have been doing while you were away.</p>
          </div>
          {unreadCount > 0 && (
            <span className="ml-2 rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-300">
              {unreadCount} unread
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/signals/settings"
            className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-[#ccc] hover:bg-white/[0.05]"
          >
            <Settings className="h-4 w-4" /> Settings
          </Link>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 rounded-lg border border-[#61C1C4]/30 bg-[#61C1C4]/10 px-3 py-2 text-sm font-semibold text-[#61C1C4] hover:bg-[#61C1C4]/20"
            >
              <CheckCheck className="h-4 w-4" /> Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={toolFilter}
          onChange={(e) => setToolFilter(e.target.value)}
          className="rounded-lg border border-white/[0.08] bg-[#111] px-3 py-2 text-sm text-[#ccc]"
        >
          <option value="all">All tools</option>
          {tools.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
          className="rounded-lg border border-white/[0.08] bg-[#111] px-3 py-2 text-sm text-[#ccc]"
        >
          <option value="all">All severities</option>
          <option value="info">Info</option>
          <option value="action_needed">Action needed</option>
          <option value="critical">Critical</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-[#ccc]">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-[#111]"
          />
          Unread only
        </label>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && filtered.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-[#888]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading signals...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-[#111] p-8 text-center">
          <p className="text-lg font-medium text-white">All caught up!</p>
          <p className="mt-2 text-sm text-[#888]">
            No signals yet. Signals appear here when your tools finish jobs or need your attention.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((s) => (
            <div
              key={s.id}
              className={`rounded-xl border p-4 transition-colors ${
                s.read_at ? "border-white/[0.06] bg-[#0f0f0f]" : "border-white/[0.12] bg-[#141414]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${s.read_at ? "text-[#aaa]" : "text-white"}`}>
                    {s.summary}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-md px-2 py-0.5 font-semibold ${toolBadgeColor(s.tool)}`}>
                      {s.tool}
                    </span>
                    <span className={`rounded-md border px-2 py-0.5 font-medium ${SEVERITY_STYLE[s.severity]}`}>
                      {SEVERITY_LABEL[s.severity]}
                    </span>
                    <span className="text-[#666]">{relativeTime(s.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.deep_link && (
                    <Link
                      to={s.deep_link}
                      className="rounded-lg border border-[#61C1C4]/30 bg-[#61C1C4]/10 px-3 py-1.5 text-xs font-semibold text-[#61C1C4] hover:bg-[#61C1C4]/20"
                    >
                      Open
                    </Link>
                  )}
                  {!s.read_at && (
                    <button
                      onClick={() => markRead(s.id)}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs text-[#ccc] hover:bg-white/[0.05]"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

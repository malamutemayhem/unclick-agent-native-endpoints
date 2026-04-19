/**
 * AdminYou - Identity surface (/admin/you)
 *
 * The Apple ID equivalent. Shows: user email, auth provider, linked
 * api_key info, paired devices (auth_devices), logout button.
 * ClaimKeyBanner is shown if the user has an unclaimed localStorage key.
 */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession, signOut } from "@/lib/auth";
import ClaimKeyBanner from "@/components/ClaimKeyBanner";
import {
  User,
  Mail,
  Shield,
  KeyRound,
  Monitor,
  LogOut,
  Loader2,
  Clock,
  Copy,
  Check,
  Plus,
  AlertTriangle,
  Brain,
  ArrowRight,
  Zap,
  Heart,
  CheckCircle2,
  Circle,
} from "lucide-react";

interface MemoryNudge {
  connected: boolean;
  context_count: number;
  fact_count: number;
}

const NUDGE_DISMISS_KEY = "unclick_admin_memory_nudge_dismissed_at";
const NUDGE_SNOOZE_MS = 24 * 60 * 60 * 1000; // 24h

function MemoryNudgeBanner({ apiKey }: { apiKey: string }) {
  const [state, setState] = useState<MemoryNudge | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const at = localStorage.getItem(NUDGE_DISMISS_KEY);
      if (at && Date.now() - Number(at) < NUDGE_SNOOZE_MS) {
        setDismissed(true);
        return;
      }
    } catch {
      // ignore
    }
    if (!apiKey) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/memory-admin?action=admin_check_connection&api_key=${encodeURIComponent(apiKey)}`
        );
        if (!res.ok) return;
        const body = (await res.json()) as MemoryNudge;
        if (!cancelled) setState(body);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  if (dismissed || !state) return null;

  const hasMemory = state.fact_count > 0 || state.context_count > 0;
  if (state.connected && hasMemory) return null;

  const heading = !state.connected
    ? "Finish connecting UnClick"
    : "Your memory is empty";
  const body = !state.connected
    ? "UnClick is installed but your AI hasn't checked in yet. Run the Connect command so your sessions can load memory automatically."
    : "Add your identity or a few facts so every AI session starts with context instead of from scratch.";
  const cta = !state.connected ? "Connect UnClick" : "Add memory";
  const to = !state.connected ? "/memory/connect" : "/admin/memory?tab=identity";

  const handleDismiss = () => {
    try {
      localStorage.setItem(NUDGE_DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  return (
    <div className="mb-6 flex flex-wrap items-start gap-3 rounded-xl border border-[#E2B93B]/30 bg-[#E2B93B]/[0.06] p-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E2B93B]/15 text-[#E2B93B]">
        <Brain className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">{heading}</p>
        <p className="mt-1 text-xs text-[#E2B93B]/90">{body}</p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          to={to}
          className="inline-flex items-center gap-1 rounded-md bg-[#61C1C4] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90"
        >
          {cta} <ArrowRight className="h-3 w-3" />
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-md px-2 py-1 text-xs text-white/50 hover:text-white"
        >
          Later
        </button>
      </div>
    </div>
  );
}

interface DeviceRow {
  id: string;
  device_id: string;
  device_name: string | null;
  paired_at: string;
  last_seen_at: string;
  revoked_at: string | null;
}

interface BootSummary {
  last_boot_at: string | null;
  facts_loaded: number;
  context_items_loaded: number;
  sessions_loaded: number;
  project_items_loaded: number;
}

interface ContextRow {
  category: string;
  key: string;
}

interface FactRow {
  id: string;
}

interface SessionSummaryRow {
  id: string;
}

interface ProfileData {
  user_id: string;
  email: string | null;
  tier: string | null;
  needs_key?: boolean;
  api_key: {
    id: string;
    prefix: string;
    label: string;
    tier: string;
    is_active: boolean;
    usage_count: number;
    last_used_at: string | null;
    created_at: string;
  } | null;
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function AdminYou() {
  const { session, user } = useSession();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [bootSummary, setBootSummary] = useState<BootSummary | null>(null);
  const [contextRows, setContextRows] = useState<ContextRow[]>([]);
  const [factRows, setFactRows] = useState<FactRow[]>([]);
  const [sessionRows, setSessionRows] = useState<SessionSummaryRow[]>([]);

  async function fetchProfile() {
    if (!session) return;
    const headers = { Authorization: `Bearer ${session.access_token}` };
    const profileRes = await fetch("/api/memory-admin?action=admin_profile", { headers });
    if (profileRes.ok) {
      setProfile(await profileRes.json());
    }
  }

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    (async () => {
      try {
        const headers = { Authorization: `Bearer ${session.access_token}` };
        const [profileRes, devicesRes, bootRes, contextRes, factsRes, sessionsRes] = await Promise.all([
          fetch("/api/memory-admin?action=admin_profile", { headers }),
          fetch("/api/memory-admin?action=auth_device_list", { headers }),
          fetch("/api/memory-admin?action=admin_boot_summary", { headers }),
          fetch("/api/memory-admin?action=business_context", { headers }),
          fetch("/api/memory-admin?action=facts", { headers }),
          fetch("/api/memory-admin?action=sessions&limit=1", { headers }),
        ]);

        if (!cancelled && profileRes.ok) {
          setProfile(await profileRes.json());
        }
        if (!cancelled && devicesRes.ok) {
          const body = await devicesRes.json();
          setDevices(body.data ?? []);
        }
        if (!cancelled && bootRes.ok) {
          setBootSummary(await bootRes.json());
        }
        if (!cancelled && contextRes.ok) {
          const body = await contextRes.json();
          setContextRows((body.data ?? []) as ContextRow[]);
        }
        if (!cancelled && factsRes.ok) {
          const body = await factsRes.json();
          setFactRows((body.data ?? []) as FactRow[]);
        }
        if (!cancelled && sessionsRes.ok) {
          const body = await sessionsRes.json();
          setSessionRows((body.data ?? []) as SessionSummaryRow[]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [session]);

  async function handleGenerateKey() {
    if (!session) return;
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/memory-admin?action=generate_api_key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const body = await res.json();
      if (!res.ok) {
        setGenError(body.error ?? "Failed to generate key");
        return;
      }
      setGeneratedKey(body.api_key);
      localStorage.setItem("unclick_api_key", body.api_key);
      await fetchProfile();
    } catch {
      setGenError("Network error - please try again");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopyKey() {
    if (!generatedKey) return;
    await navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleLogout() {
    await signOut();
    navigate("/login", { replace: true });
  }

  async function revokeDevice(deviceId: string) {
    if (!session) return;
    await fetch("/api/memory-admin?action=auth_device_revoke", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ device_id: deviceId }),
    });
    setDevices((prev) => prev.filter((d) => d.device_id !== deviceId));
  }

  const provider = user?.app_metadata?.provider ?? "email";
  const providerLabel =
    provider === "google" ? "Google" :
    provider === "azure" ? "Microsoft" :
    provider === "email" ? "Magic link" :
    provider;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">You</h1>
        <p className="mt-1 text-sm text-[#888]">Identity, accounts, and devices</p>
      </div>

      <ClaimKeyBanner />
      {profile?.api_key?.prefix ? (
        <MemoryNudgeBanner apiKey={localStorage.getItem("unclick_api_key") ?? ""} />
      ) : null}

      {!loading && (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <BootSequenceCard summary={bootSummary} />
          <MemoryHealthCard
            contextRows={contextRows}
            factCount={factRows.length}
            sessionCount={sessionRows.length}
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-[#666]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading profile...</span>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Identity card */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <User className="h-4 w-4 text-[#E2B93B]" />
              Identity
            </h2>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-[#888]">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </span>
                <span className="font-mono text-xs text-white">
                  {user?.email ?? "Unknown"}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-[#888]">
                  <Shield className="h-3.5 w-3.5" />
                  Auth provider
                </span>
                <span className="text-xs text-white">{providerLabel}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-[#888]">
                  <Clock className="h-3.5 w-3.5" />
                  Member since
                </span>
                <span className="text-xs text-white">
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString()
                    : "Unknown"}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>

          {/* API Key card */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <KeyRound className="h-4 w-4 text-[#E2B93B]" />
              API Key
            </h2>

            {generatedKey ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-[#E2B93B]/30 bg-[#E2B93B]/5 p-3">
                  <div className="flex items-start gap-2 text-xs text-[#E2B93B]">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>Save this key now. You won't see it again.</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded bg-[#0A0A0A] px-3 py-2 font-mono text-xs text-white">
                      {generatedKey}
                    </code>
                    <button
                      onClick={handleCopyKey}
                      className="shrink-0 rounded-md border border-white/[0.08] bg-white/[0.04] p-2 text-white transition-colors hover:bg-white/[0.08]"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-green-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-4 mt-4">
                  <h3 className="text-sm font-medium text-white/70 mb-2">You're almost set up</h3>
                  <p className="text-sm text-white/50 mb-3">
                    Connect UnClick to your AI agent. Go to your agent's MCP settings and add this as a Remote MCP Server:
                  </p>
                  <code className="block bg-black/30 rounded px-3 py-2 text-xs text-white/60 break-all">
                    https://unclick.world/api/mcp?key={generatedKey}
                  </code>
                  <p className="text-xs text-white/40 mt-2">
                    Once connected, your agent loads your memory at the start of every conversation.
                  </p>
                </div>
              </div>
            ) : profile?.api_key ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#888]">Key</span>
                  <code className="rounded bg-white/[0.04] px-2 py-0.5 font-mono text-xs text-white">
                    {profile.api_key.prefix}...
                  </code>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#888]">Tier</span>
                  <span className="inline-flex items-center rounded-full border border-[#E2B93B]/30 bg-[#E2B93B]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#E2B93B]">
                    {profile.api_key.tier}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#888]">Status</span>
                  <span className={`text-xs ${profile.api_key.is_active ? "text-green-400" : "text-red-400"}`}>
                    {profile.api_key.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#888]">Total calls</span>
                  <span className="font-mono text-xs text-white">
                    {(profile.api_key.usage_count ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#888]">Last used</span>
                  <span className="text-xs text-white">
                    {timeAgo(profile.api_key.last_used_at)}
                  </span>
                </div>
              </div>
            ) : profile?.needs_key ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-dashed border-white/[0.08] p-4 text-center">
                  <p className="text-xs text-[#666]">
                    No API key linked to your account.
                  </p>
                </div>
                {genError && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
                    {genError}
                  </div>
                )}
                <button
                  onClick={handleGenerateKey}
                  disabled={generating}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#E2B93B]/30 bg-[#E2B93B]/10 px-4 py-2.5 text-sm font-medium text-[#E2B93B] transition-colors hover:bg-[#E2B93B]/20 disabled:opacity-50"
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {generating ? "Generating..." : "Generate API Key"}
                </button>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-white/[0.08] p-4 text-center">
                <p className="text-xs text-[#666]">
                  No API key linked. Use the banner above to claim your key, or{" "}
                  <a href="/#install" className="text-[#E2B93B] underline-offset-2 hover:underline">
                    get started
                  </a>.
                </p>
              </div>
            )}
          </div>

          {/* Devices card (full width) */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-6 lg:col-span-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Monitor className="h-4 w-4 text-[#E2B93B]" />
              Paired Devices
              <span className="ml-auto font-mono text-[11px] text-[#666]">
                {devices.length} device{devices.length !== 1 ? "s" : ""}
              </span>
            </h2>

            {devices.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-white/[0.08] p-6 text-center">
                <p className="text-xs text-[#666]">
                  No paired devices yet. Devices appear here when you sign in from another browser or machine.
                </p>
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-white/[0.04]">
                {devices.map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {d.device_name ?? d.device_id}
                      </p>
                      <p className="text-[11px] text-[#666]">
                        Paired {timeAgo(d.paired_at)} - Last seen {timeAgo(d.last_seen_at)}
                      </p>
                    </div>
                    <button
                      onClick={() => revokeDevice(d.device_id)}
                      className="ml-4 shrink-0 rounded-md border border-red-500/20 px-2.5 py-1 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/10"
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BootSequenceCard({ summary }: { summary: BootSummary | null }) {
  const loaded = summary?.last_boot_at
    ? timeAgo(summary.last_boot_at)
    : "no load recorded yet";

  return (
    <div className="rounded-xl border border-[#61C1C4]/30 bg-[#111111] p-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
        <Zap className="h-4 w-4 text-[#61C1C4]" />
        Last Boot Sequence
      </h2>
      <p className="mt-2 text-xs text-[#888]">
        What your AI loaded at the most recent session start.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <BootStat label="Facts" value={summary?.facts_loaded ?? 0} />
        <BootStat label="Context" value={summary?.context_items_loaded ?? 0} />
        <BootStat label="Sessions" value={summary?.sessions_loaded ?? 0} />
      </div>

      {(summary?.project_items_loaded ?? 0) > 0 && (
        <p className="mt-3 text-[11px] text-[#aaa]">
          + {summary?.project_items_loaded} project-scoped items
        </p>
      )}

      <p className="mt-4 flex items-center gap-1 text-[11px] text-[#666]">
        <Clock className="h-3 w-3" />
        Loaded {loaded}
      </p>
    </div>
  );
}

function BootStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-semibold text-white">{value.toLocaleString()}</p>
      <p className="mt-0.5 text-[11px] text-[#888]">{label}</p>
    </div>
  );
}

function MemoryHealthCard({
  contextRows,
  factCount,
  sessionCount,
}: {
  contextRows: ContextRow[];
  factCount: number;
  sessionCount: number;
}) {
  const hasCategory = (cat: string) => contextRows.some((r) => r.category === cat);
  const checks = [
    { label: "Identity set", ok: hasCategory("identity"), to: "/admin/memory?tab=identity" },
    { label: "Preferences set", ok: hasCategory("preference"), to: "/admin/memory?tab=identity" },
    { label: "At least 5 facts", ok: factCount >= 5, to: "/admin/memory?tab=facts" },
    { label: "A saved session", ok: sessionCount >= 1, to: "/admin/memory?tab=sessions" },
    { label: "Standing rules", ok: hasCategory("standing_rule"), to: "/admin/memory?tab=identity" },
    { label: "Repository context", ok: hasCategory("repository"), to: "/admin/projects" },
  ];
  const filled = checks.filter((c) => c.ok).length;
  const pct = Math.round((filled / checks.length) * 100);

  return (
    <div className="rounded-xl border border-[#E2B93B]/30 bg-[#111111] p-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
        <Heart className="h-4 w-4 text-[#E2B93B]" />
        Memory Health
        <span className="ml-auto font-mono text-xs text-[#E2B93B]">{pct}%</span>
      </h2>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full bg-[#E2B93B] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="mt-4 space-y-2">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2">
              {c.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-[#555]" />
              )}
              <span className={c.ok ? "text-[#ccc]" : "text-[#888]"}>{c.label}</span>
            </span>
            {!c.ok && (
              <Link
                to={c.to}
                className="text-[11px] text-[#E2B93B] underline-offset-2 hover:underline"
              >
                add
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

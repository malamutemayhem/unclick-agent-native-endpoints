/**
 * AdminYou - Identity surface (/admin/you)
 *
 * The Apple ID equivalent. Shows: user email, auth provider, linked
 * api_key info, paired devices (auth_devices), logout button.
 * ClaimKeyBanner is shown if the user has an unclaimed localStorage key.
 */

import { useEffect, useRef, useState } from "react";
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
  Eye,
  EyeOff,
  AlertTriangle,
  Brain,
  ArrowRight,
} from "lucide-react";

// Mask a value like BackstagePass: first 4 chars + 8 bullets + last 4.
// Short values collapse to plain bullets so the length cannot be leaked.
function maskValue(v: string): string {
  if (!v) return "";
  if (v.length <= 8) return "\u2022".repeat(Math.max(v.length, 4));
  return `${v.slice(0, 4)}${"\u2022".repeat(8)}${v.slice(-4)}`;
}

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
  // Destructure `loading` so the page can wait for the Supabase session
  // restore to resolve before showing a "not signed in" empty state or
  // firing any fetches. Fixes the brief confusion-on-load flicker.
  const { session, user, loading: sessionLoading } = useSession();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);

  // `generatedKey` holds the raw uc_* value that is ONLY available once:
  // either auto-provisioned on first /admin/you load, or returned by an
  // explicit generate/rotate call. After the reveal timer expires or the
  // user reloads the page, only the prefix remains (the backend stores
  // key_hash, not plaintext). The state holds the value in memory only.
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [keyRevealed, setKeyRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const revealTimerRef = useRef<number | null>(null);

  // Danger Zone: self-serve account deletion.
  const [deleteOpen, setDeleteOpen]     = useState(false);
  const [deleteTyped, setDeleteTyped]   = useState("");
  const [deleting, setDeleting]         = useState(false);
  const [deleteError, setDeleteError]   = useState<string | null>(null);

  useEffect(() => {
    // Wait for Supabase to confirm the session state before firing
    // fetches. If there is no session and no load is pending, route to
    // login instead of calling a 401-guaranteed endpoint.
    if (sessionLoading) return;
    if (!session) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const headers = { Authorization: `Bearer ${session.access_token}` };
        const [profileRes, devicesRes] = await Promise.all([
          fetch("/api/memory-admin?action=admin_profile", { headers }),
          fetch("/api/memory-admin?action=auth_device_list", { headers }),
        ]);

        if (!cancelled && profileRes.ok) {
          const body = (await profileRes.json()) as ProfileData & {
            generated_api_key?: string | null;
          };
          setProfile({
            user_id:   body.user_id,
            email:     body.email,
            tier:      body.tier,
            needs_key: body.needs_key,
            api_key:   body.api_key,
          });
          // Two paths land here.
          //
          // 1. Fresh auto-provision on first visit: the backend returns the
          //    raw uc_* value in body.generated_api_key. Persist it to
          //    localStorage so the reveal card still works after a page
          //    reload. The signOut handler clears localStorage (#61), so
          //    this cached copy only survives while the user stays signed
          //    in on this browser.
          //
          // 2. Return visit: body.generated_api_key is null because the
          //    api_keys row already exists. Recover the raw value from
          //    localStorage if present AND if its prefix matches what the
          //    backend now claims (guards against a stale key left over
          //    from a rotation). Either way the reveal card will render
          //    masked-by-default so the user can click the eye to copy.
          if (body.generated_api_key) {
            try { localStorage.setItem("unclick_api_key", body.generated_api_key); } catch { /* ignore */ }
            setGeneratedKey(body.generated_api_key);
            setKeyRevealed(false);
          } else if (body.api_key?.prefix) {
            try {
              const cached = localStorage.getItem("unclick_api_key");
              if (cached && cached.startsWith(body.api_key.prefix)) {
                setGeneratedKey(cached);
                setKeyRevealed(false);
              }
            } catch { /* ignore */ }
          }
        }
        if (!cancelled && devicesRes.ok) {
          const body = await devicesRes.json();
          setDevices(body.data ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [session, sessionLoading]);

  // Re-mask the api_key 60 seconds after the user reveals it. The raw
  // value stays in generatedKey state (and in localStorage) so the user
  // can click the eye again to reveal a second time. Only the rendered
  // view flips back to masked - nothing is dropped.
  useEffect(() => {
    if (!keyRevealed) return;
    if (revealTimerRef.current !== null) {
      window.clearTimeout(revealTimerRef.current);
    }
    revealTimerRef.current = window.setTimeout(() => {
      setKeyRevealed(false);
    }, 60_000);
    return () => {
      if (revealTimerRef.current !== null) {
        window.clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    };
  }, [keyRevealed]);

  async function handleCopyKey() {
    if (!generatedKey) return;
    try {
      await navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      // Browser can block clipboard writes in some contexts; fail silent.
    }
  }

  async function handleLogout() {
    await signOut();
    navigate("/login", { replace: true });
  }

  async function handleDeleteAccount() {
    if (!session) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/memory-admin?action=delete_account", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Delete failed with ${res.status}`);
      }
      // Hard-clear local caches before signOut so a rapid redirect
      // cannot leave the previous identity's api_key in localStorage
      // for a microsecond.
      try { localStorage.removeItem("unclick_api_key"); } catch { /* ignore */ }
      await signOut();
      navigate("/", { replace: true });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
    }
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

      {sessionLoading || loading ? (
        <div className="flex items-center gap-2 py-12 text-[#666]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">
            {sessionLoading ? "Checking your session..." : "Loading profile..."}
          </span>
        </div>
      ) : !session ? (
        <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-8 text-center">
          <p className="text-sm text-white/70">You are not signed in.</p>
          <Link
            to="/login"
            className="mt-4 inline-flex items-center gap-1 rounded-md bg-[#61C1C4] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90"
          >
            Go to sign in <ArrowRight className="h-3 w-3" />
          </Link>
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
                    <span>Your UnClick API key. Click the eye to reveal, then copy it into your MCP client. The revealed view auto-hides after 60 seconds; click the eye again to re-reveal. Signing out clears the local copy.</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded bg-[#0A0A0A] px-3 py-2 font-mono text-xs text-white">
                      {keyRevealed ? generatedKey : maskValue(generatedKey)}
                    </code>
                    <button
                      onClick={() => setKeyRevealed((v) => !v)}
                      className="shrink-0 rounded-md border border-white/[0.08] bg-white/[0.04] p-2 text-white transition-colors hover:bg-white/[0.08]"
                      title={keyRevealed ? "Hide key" : "Reveal key"}
                    >
                      {keyRevealed ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={handleCopyKey}
                      className="shrink-0 rounded-md border border-white/[0.08] bg-white/[0.04] p-2 text-white transition-colors hover:bg-white/[0.08]"
                      title="Copy key to clipboard"
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
                    https://unclick.world/api/mcp?key={keyRevealed ? generatedKey : maskValue(generatedKey)}
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
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-white/[0.08] p-4 text-center">
                <p className="text-xs text-[#666]">
                  Preparing your API key. Refresh this page if it does not appear within a few seconds.
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

          {/* Danger Zone (full width) */}
          <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-6 lg:col-span-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-red-400">
              <AlertTriangle className="h-4 w-4" />
              Danger Zone
            </h2>
            <p className="mt-2 text-xs text-red-300/80">
              Deleting your account permanently removes your UnClick memory,
              stored credentials, API keys, and profile information. This cannot
              be undone. Active MCP clients using your api_key will stop working.
            </p>
            <button
              onClick={() => {
                setDeleteTyped("");
                setDeleteError(null);
                setDeleteOpen(true);
              }}
              className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/20"
            >
              Delete account
            </button>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => { if (!deleting) setDeleteOpen(false); }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-red-500/30 bg-[#0A0A0A] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <h3 className="text-base font-semibold text-white">Delete your account</h3>
            </div>
            <p className="mt-3 text-xs text-[#BBB] leading-relaxed">
              This removes your auth identity plus every row keyed to your
              account: memory (facts, sessions, business context, conversation
              log, knowledge library, code dumps), stored credentials, API
              keys, devices, and profile data. It is permanent.
            </p>
            <p className="mt-3 text-xs text-[#BBB]">
              To confirm, type your email address:
            </p>
            <p className="mt-1 font-mono text-xs text-white">{user?.email ?? ""}</p>
            <input
              type="email"
              value={deleteTyped}
              onChange={(e) => setDeleteTyped(e.target.value)}
              placeholder="Type your email here"
              autoFocus
              disabled={deleting}
              className="mt-3 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 font-mono text-xs text-white placeholder:text-[#555] focus:border-red-500/60 focus:outline-none"
            />
            {deleteError && (
              <p className="mt-3 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
                {deleteError}
              </p>
            )}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
                className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-[#BBB] transition-colors hover:bg-white/[0.06] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteAccount()}
                disabled={
                  deleting ||
                  deleteTyped.trim().toLowerCase() !== (user?.email ?? "").trim().toLowerCase() ||
                  !(user?.email ?? "")
                }
                className="flex items-center gap-2 rounded-md border border-red-500/50 bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete account permanently"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * AdminYou - Identity surface (/admin/you)
 *
 * The Apple ID equivalent. Shows: user email, auth provider, linked
 * api_key info, paired devices (auth_devices), logout button.
 * ClaimKeyBanner is shown if the user has an unclaimed localStorage key.
 */

import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession, signOut } from "@/lib/auth";
import ClaimKeyBanner from "@/components/ClaimKeyBanner";
import {
  User,
  Mail,
  Shield,
  KeyRound,
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
  SlidersHorizontal,
  ShieldCheck,
  Download,
  Upload,
  Database,
} from "lucide-react";

// Mask a saved connection secret: first 4 chars + 8 bullets + last 4.
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

type OperatorTimezoneSource = "browser" | "manual";

interface OperatorTimeContext {
  timezone: string;
  source: OperatorTimezoneSource;
  detected_at?: string | null;
  manual_override_at?: string | null;
  updated_at?: string | null;
  privacy: "timezone-only";
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

function getBrowserTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

function formatOperatorLocalTime(timezone: string | null | undefined): string {
  if (!timezone) return "Unknown";
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());
  } catch {
    return "Invalid timezone";
  }
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
  const [reissuing, setReissuing] = useState(false);
  const [reissueError, setReissueError] = useState<string | null>(null);
  const [operatorTime, setOperatorTime] = useState<OperatorTimeContext | null>(null);
  const [detectedTimezone, setDetectedTimezone] = useState<string | null>(null);
  const [timezoneInput, setTimezoneInput] = useState("");
  const [timezoneSaving, setTimezoneSaving] = useState(false);
  const [timezoneError, setTimezoneError] = useState<string | null>(null);
  const timezoneAutoSyncRef = useRef<string | null>(null);
  const [exportingData, setExportingData] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  useEffect(() => {
    setDetectedTimezone(getBrowserTimezone());
  }, []);

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
        // Serialize admin_profile BEFORE auth_device_list. admin_profile
        // is the endpoint that auto-provisions an api_keys row on first
        // visit; auth_device_list needs that row to exist or it 401s.
        // Racing them via Promise.all caused auth_device_list to lose
        // the race for brand-new signups and fire a 401 in the console.
        const profileRes = await fetch("/api/memory-admin?action=admin_profile", { headers });
        if (!cancelled && profileRes.ok) {
          const body = (await profileRes.json()) as ProfileData & {
            generated_api_key?: string | null;
            operator_time?: OperatorTimeContext | null;
          };
          setProfile({
            user_id:   body.user_id,
            email:     body.email,
            tier:      body.tier,
            needs_key: body.needs_key,
            api_key:   body.api_key,
          });
          setOperatorTime(body.operator_time ?? null);
          setTimezoneInput(body.operator_time?.timezone ?? "");
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
        // Only fire auth_device_list after admin_profile has returned, so
        // the auto-provisioned api_keys row definitely exists.
        if (!cancelled) {
          try {
            const devicesRes = await fetch("/api/memory-admin?action=auth_device_list", { headers });
            if (!cancelled && devicesRes.ok) {
              const body = await devicesRes.json();
              setDevices(body.data ?? []);
            }
          } catch {
            // Network errors are non-fatal for the devices card.
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [session, sessionLoading]);

  useEffect(() => {
    if (sessionLoading || loading || !session || !detectedTimezone) return;
    if (operatorTime?.source === "manual") return;
    if (operatorTime?.timezone === detectedTimezone) return;
    const syncKey = `${detectedTimezone}:${operatorTime?.timezone ?? "none"}:${operatorTime?.source ?? "none"}`;
    if (timezoneAutoSyncRef.current === syncKey) return;
    timezoneAutoSyncRef.current = syncKey;
    void saveOperatorTimezone(detectedTimezone, "browser", { quiet: true });
  }, [detectedTimezone, loading, operatorTime?.source, operatorTime?.timezone, session, sessionLoading]);

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

  async function handleReissueKey() {
    if (!session) return;
    setReissuing(true);
    setReissueError(null);
    try {
      const res = await fetch("/api/memory-admin?action=reset_api_key", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setReissueError(body.error ?? "Failed to re-issue key");
        return;
      }
      const body = await res.json() as { api_key: string };
      try { localStorage.setItem("unclick_api_key", body.api_key); } catch { /* ignore */ }
      setGeneratedKey(body.api_key);
      setKeyRevealed(false);
    } catch (e) {
      setReissueError((e as Error).message);
    } finally {
      setReissuing(false);
    }
  }

  async function saveOperatorTimezone(
    timezone: string,
    source: OperatorTimezoneSource,
    options: { quiet?: boolean } = {},
  ) {
    if (!session) return;
    const trimmed = timezone.trim();
    if (!trimmed) {
      setTimezoneError("Enter a timezone like Australia/Sydney.");
      return;
    }
    if (!options.quiet) setTimezoneSaving(true);
    setTimezoneError(null);
    try {
      const res = await fetch("/api/memory-admin?action=operator_timezone_update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ timezone: trimmed, source }),
      });
      const body = await res.json() as {
        operator_time?: OperatorTimeContext;
        error?: string;
      };
      if (!res.ok) {
        setTimezoneError(body.error ?? "Could not save timezone.");
        return;
      }
      if (body.operator_time) {
        setOperatorTime(body.operator_time);
        setTimezoneInput(body.operator_time.timezone);
      }
    } catch (e) {
      setTimezoneError((e as Error).message);
    } finally {
      if (!options.quiet) setTimezoneSaving(false);
    }
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

  async function handleExportAll() {
    if (!session) return;
    setExportingData(true);
    setExportError(null);
    try {
      const res = await fetch("/api/memory-admin?action=admin_export_all", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setExportError(body.error ?? "Could not export your data.");
        return;
      }
      const text = await res.text();
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `unclick-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError((e as Error).message);
    } finally {
      setExportingData(false);
    }
  }

  function handleLoadDataFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setImportMessage(
      "File staged locally. The review step will organize it before anything is added to memory.",
    );
  }

  const provider = user?.app_metadata?.provider ?? "email";
  const providerLabel =
    provider === "google" ? "Google" :
    provider === "azure" ? "Microsoft" :
    provider === "email" ? "Magic link" :
    provider;
  const timezonePreview = formatOperatorLocalTime(operatorTime?.timezone ?? detectedTimezone);
  const timezoneSourceLabel =
    operatorTime?.source === "manual" ? "Manual override" :
    operatorTime?.source === "browser" ? "Browser detected" :
    detectedTimezone ? "Browser available" :
    "Not detected";
  const youSections = [
    { id: "you-profile", label: "Profile", hint: "Identity and time", icon: User },
    { id: "you-api-key", label: "My API Key", hint: "Access and setup", icon: KeyRound },
    { id: "you-my-data", label: "My Data", hint: "Export and import", icon: Database },
    { id: "you-preferences", label: "Preferences", hint: "AI style", icon: SlidersHorizontal },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">You</h1>
        <p className="mt-1 text-sm text-[#888]">Profile, AI Style, and access</p>
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
        <>
        <nav aria-label="You page sections" className="mb-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {youSections.map(({ id, label, hint, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              className="group flex min-h-[76px] items-center gap-3 rounded-xl border border-white/[0.06] bg-[#111111] px-4 py-3 transition-colors hover:border-[#61C1C4]/40 hover:bg-white/[0.04]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-[#61C1C4] group-hover:bg-[#61C1C4]/10">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-white">{label}</span>
                <span className="mt-0.5 block text-xs text-[#777]">{hint}</span>
              </span>
            </a>
          ))}
        </nav>

        <div className="grid gap-6 xl:grid-cols-3">
          {/* Profile card */}
          <div id="you-profile" className="scroll-mt-24 rounded-xl border border-white/[0.06] bg-[#111111] p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <User className="h-4 w-4 text-[#E2B93B]" />
              Profile
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

          {/* Local time card */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Clock className="h-4 w-4 text-[#E2B93B]" />
              Local Time
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#888]">
              Used by Orchestrator so AI seats understand your working hours. Only timezone context is saved.
            </p>
            <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[#888]">Current local time</span>
                <span className="text-right text-xs font-semibold text-white">{timezonePreview}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                <span className="text-[#888]">Timezone</span>
                <span className="text-right font-mono text-xs text-white">
                  {operatorTime?.timezone ?? detectedTimezone ?? "Unknown"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                <span className="text-[#888]">Source</span>
                <span className="text-right text-xs text-white">{timezoneSourceLabel}</span>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/40">
                Manual timezone
              </label>
              <input
                value={timezoneInput}
                onChange={(event) => setTimezoneInput(event.target.value)}
                placeholder={detectedTimezone ?? "Australia/Sydney"}
                className="w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 font-mono text-xs text-white outline-none transition-colors placeholder:text-white/25 focus:border-[#61C1C4]/50"
              />
              {timezoneError && <p className="text-[11px] text-red-400">{timezoneError}</p>}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => saveOperatorTimezone(timezoneInput, "manual")}
                  disabled={timezoneSaving || !timezoneInput.trim()}
                  className="rounded-md bg-[#61C1C4] px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {timezoneSaving ? "Saving..." : "Save override"}
                </button>
                {detectedTimezone && (
                  <button
                    type="button"
                    onClick={() => saveOperatorTimezone(detectedTimezone, "manual")}
                    disabled={timezoneSaving}
                    className="rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/[0.08] disabled:opacity-50"
                  >
                    Use detected
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* AI Style card */}
          <div id="you-preferences" className="scroll-mt-24 rounded-xl border border-white/[0.06] bg-[#111111] p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <SlidersHorizontal className="h-4 w-4 text-[#E2B93B]" />
              AI Style
            </h2>
            <p className="mt-4 text-sm leading-6 text-[#888]">
              How UnClick should talk to you. These defaults mirror into Memory Preferences
              so connected agents can carry the same tone.
            </p>
            <div className="mt-4 space-y-2">
              {[
                ["Response length", "Medium"],
                ["Complexity", "Simple with analogies"],
                ["Emoji level", "Light"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-xs">
                  <span className="text-[#888]">{label}</span>
                  <span className="text-white">{value}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] leading-5 text-[#666]">
              Editing controls land here first; project-specific overrides can sit beside Project Briefs later.
            </p>
          </div>

          {/* Access card */}
          <div id="you-api-key" className="scroll-mt-24 rounded-xl border border-white/[0.06] bg-[#111111] p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <KeyRound className="h-4 w-4 text-[#E2B93B]" />
              My API Key
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
                <div className="border-t border-white/[0.06] pt-3">
                  <p className="mb-2 text-[11px] text-[#666]">
                    Key not visible? Your browser may have cleared it. Re-issuing generates a new key and invalidates the old one - saved Connections may need to be reconnected or re-saved.
                  </p>
                  {reissueError && (
                    <p className="mb-2 text-[11px] text-red-400">{reissueError}</p>
                  )}
                  <button
                    onClick={handleReissueKey}
                    disabled={reissuing}
                    className="w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/[0.08] disabled:opacity-50"
                  >
                    {reissuing ? "Re-issuing..." : "Re-issue API Key"}
                  </button>
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

          {/* My Data card */}
          <div id="you-my-data" className="scroll-mt-24 rounded-xl border border-white/[0.06] bg-[#111111] p-6 xl:col-span-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Database className="h-4 w-4 text-[#E2B93B]" />
              My Data
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#888]">
              Keep a portable copy of your memory, sessions, preferences, and library. Imports are staged for review before anything changes.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-white">Export All</p>
                    <p className="mt-1 text-xs leading-5 text-white/50">
                      Download your UnClick data as a JSON package.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportAll}
                    disabled={exportingData}
                    className="inline-flex shrink-0 items-center gap-2 rounded-md bg-[#61C1C4] px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {exportingData ? "Exporting..." : "Download"}
                  </button>
                </div>
                {exportError && <p className="mt-3 text-[11px] text-red-400">{exportError}</p>}
              </div>

              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-white">Load my Data</p>
                    <p className="mt-1 text-xs leading-5 text-white/50">
                      Accepts UnClick JSON, CSV, Markdown, and plain text files.
                    </p>
                  </div>
                  <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/[0.08]">
                    <Upload className="h-3.5 w-3.5" />
                    Choose file
                    <input
                      type="file"
                      accept=".json,.csv,.md,.markdown,.txt,application/json,text/csv,text/markdown,text/plain"
                      className="sr-only"
                      onChange={handleLoadDataFile}
                    />
                  </label>
                </div>
                {importFileName && (
                  <p className="mt-3 text-[11px] text-white/60">
                    Staged: <span className="font-mono text-white/80">{importFileName}</span>
                  </p>
                )}
                {importMessage && <p className="mt-1 text-[11px] text-[#61C1C4]">{importMessage}</p>}
              </div>
            </div>
          </div>

          {/* Security pointer */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-6 xl:col-span-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck className="h-4 w-4 text-[#E2B93B]" />
              Security lives in Settings
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#888]">
              Paired devices, sign-in history, revoke access, and advanced security controls are kept in
              Settings so this page stays focused on the essentials.
            </p>
            <Link
              to="/admin/settings"
              className="mt-4 inline-flex rounded-md border border-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/[0.04]"
            >
              Open Settings
            </Link>
          </div>

        </div>
        </>
      )}

    </div>
  );
}

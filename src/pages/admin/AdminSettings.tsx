/**
 * AdminSettings - Settings surface (/admin/settings)
 *
 * Grouped sections (top to bottom):
 *   - Connection      platform picker + connection status
 *   - AI Config       generated config file preview / download
 *   - Memory Loading  auto-load toggle (tenant_settings.autoload)
 *   - Isolation       single-memory-tool guidance
 *   - Danger Zone     clear / export
 *   - Support         bug reporting
 *
 * Controls hit /api/memory-admin with the user's API key:
 *   tenant_settings_get / tenant_settings_set for the auto-load toggle,
 *   admin_check_connection for live connection status,
 *   admin_generate_config for server-side config regeneration,
 *   business_context + configGenerator for the local preview.
 *
 * Rendered inside AdminShell's <Outlet>, so we emit plain content only.
 */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useSession, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  generateConfig,
  platformFilename,
  platformHasConfigFile,
  platformLabel,
  type BusinessContextEntry,
  type Platform,
} from "@/lib/configGenerator";
import {
  Settings as SettingsIcon,
  CheckCircle2,
  XCircle,
  Copy,
  Download,
  RefreshCw,
  AlertTriangle,
  Bug,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const API_KEY_STORAGE = "unclick_api_key";
const PLATFORM_STORAGE = "unclick_platform";
const PLATFORMS: Platform[] = ["claude-code", "cursor", "windsurf", "copilot", "chatgpt"];

const SERVER_URL = "https://unclick.world/api/mcp";

interface ConnectionStatus {
  connected: boolean;
  last_seen: string | null;
  cloud_sync: boolean;
  schema_installed?: boolean;
}

interface GeneratedConfigResponse {
  content: string;
  filename: string;
  instructions: string;
  generated_at: string;
}

function getStoredPlatform(): Platform {
  try {
    const v = localStorage.getItem(PLATFORM_STORAGE);
    if (v && PLATFORMS.includes(v as Platform)) return v as Platform;
  } catch {
    /* ignore */
  }
  return "claude-code";
}

function getApiKey(): string {
  try {
    return localStorage.getItem(API_KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

function formatRelative(iso: string | null): string {
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

export default function AdminSettings() {
  const { toast } = useToast();
  const { session } = useSession();
  const navigate = useNavigate();
  const [apiKey] = useState<string>(getApiKey);
  const [platform, setPlatform] = useState<Platform>(getStoredPlatform);

  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [loadingConnection, setLoadingConnection] = useState(true);

  const [autoload, setAutoload] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [autoloadSaving, setAutoloadSaving] = useState(false);

  const [businessContext, setBusinessContext] = useState<BusinessContextEntry[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [serverConfig, setServerConfig] = useState<GeneratedConfigResponse | null>(null);
  const [generating, setGenerating] = useState(false);

  const [howToCheckOpen, setHowToCheckOpen] = useState(false);

  const [deleteOpen, setDeleteOpen]   = useState(false);
  const [deleteTyped, setDeleteTyped] = useState("");
  const [deleting, setDeleting]       = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteResult, setDeleteResult] = useState<{
    success: boolean;
    partial?: boolean;
    step_errors?: Record<string, string>;
    rows_deleted?: Record<string, number>;
    step?: string;
  } | null>(null);

  // TOTP MFA state
  const [mfaLoading, setMfaLoading]             = useState(true);
  const [enrolledFactorId, setEnrolledFactorId] = useState<string | null>(null);
  const [enrolling, setEnrolling]               = useState(false);
  const [mfaQr, setMfaQr]                       = useState<string | null>(null);
  const [mfaSecret, setMfaSecret]               = useState<string | null>(null);
  const [mfaFactorId, setMfaFactorId]           = useState<string | null>(null);
  const [mfaCode, setMfaCode]                   = useState("");
  const [mfaVerifying, setMfaVerifying]         = useState(false);
  const [mfaError, setMfaError]                 = useState<string | null>(null);
  const [unenrolling, setUnenrolling]           = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(PLATFORM_STORAGE, platform);
    } catch {
      /* ignore */
    }
  }, [platform]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp?.find((f) => f.status === "verified");
      setEnrolledFactorId(verified?.id ?? null);
      setMfaLoading(false);
    })();
  }, []);

  useEffect(() => {
    const effectiveToken = apiKey || session?.access_token || "";
    if (!effectiveToken) {
      setLoadingConnection(false);
      setSettingsLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const authHeader = { Authorization: `Bearer ${effectiveToken}` };
      try {
        const [connRes, settingsRes, bcRes] = await Promise.all([
          fetch("/api/memory-admin?action=admin_check_connection", { headers: authHeader }),
          fetch("/api/memory-admin?action=tenant_settings_get", { headers: authHeader }),
          fetch("/api/memory-admin?action=business_context"),
        ]);
        if (!cancelled && connRes.ok) {
          setConnection((await connRes.json()) as ConnectionStatus);
        }
        if (!cancelled) {
          if (settingsRes.ok) {
            const body = (await settingsRes.json()) as { data?: Record<string, unknown> };
            setAutoload(Boolean(body.data?.autoload));
            setSettingsError(null);
          } else {
            const body = (await settingsRes.json().catch(() => ({}))) as { error?: string };
            setSettingsError(body.error ?? `Settings request failed (${settingsRes.status})`);
          }
          setSettingsLoaded(true);
        }
        if (!cancelled && bcRes.ok) {
          const body = (await bcRes.json()) as { data: BusinessContextEntry[] };
          setBusinessContext(body.data ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setSettingsError((err as Error).message);
          setSettingsLoaded(true);
        }
      } finally {
        if (!cancelled) setLoadingConnection(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiKey, session?.access_token]);

  const handleAutoloadChange = async (next: boolean) => {
    if (!apiKey) {
      toast({
        title: "API key required",
        description: "Add your UnClick API key on the You page first.",
        variant: "destructive",
      });
      return;
    }
    setAutoloadSaving(true);
    const previous = autoload;
    setAutoload(next);
    try {
      const res = await fetch("/api/memory-admin?action=tenant_settings_set", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key: "autoload", value: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Save failed");
      }
      toast({
        title: next ? "Auto-load on" : "Auto-load off",
        description: next
          ? "Your AI tool will receive your memory at session start."
          : "Memory will only load when your AI explicitly asks for it.",
      });
    } catch (err) {
      setAutoload(previous);
      toast({
        title: "Could not save",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setAutoloadSaving(false);
    }
  };

  const previewLocal = generateConfig(platform, businessContext);

  const regenerateFromServer = async () => {
    if (!apiKey) return;
    setGenerating(true);
    try {
      const res = await fetch(
        `/api/memory-admin?action=admin_generate_config&platform=${platform}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Generation failed");
      }
      setServerConfig((await res.json()) as GeneratedConfigResponse);
    } catch (err) {
      toast({
        title: "Could not generate config",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handlePreview = async () => {
    setPreviewOpen(true);
    if (apiKey) await regenerateFromServer();
  };

  const activeConfig = serverConfig
    ? { content: serverConfig.content, filename: serverConfig.filename }
    : { content: previewLocal.content, filename: previewLocal.filename };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeConfig.content);
      toast({ title: "Copied", description: `${activeConfig.filename} copied to clipboard.` });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleDownload = () => {
    const blob = new Blob([activeConfig.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = activeConfig.filename.split("/").pop() ?? "config.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearMemory = () => {
    toast({
      title: "Heads up",
      description: "Clear-all is available from the Memory page right now.",
    });
  };

  const handleExport = () => {
    if (!apiKey) return;
    window.open(`/api/memory-admin?action=business_context`, "_blank");
  };

  async function handleStartEnroll() {
    setEnrolling(true);
    setMfaError(null);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", issuer: "UnClick" });
    if (error || !data) {
      setMfaError(error?.message ?? "Could not start enrollment.");
      setEnrolling(false);
      return;
    }
    setMfaQr(data.totp.qr_code);
    setMfaSecret(data.totp.secret);
    setMfaFactorId(data.id);
    setEnrolling(false);
  }

  async function handleConfirmEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaFactorId || mfaCode.length !== 6) return;
    setMfaVerifying(true);
    setMfaError(null);
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
    if (challengeErr || !challenge) {
      setMfaError(challengeErr?.message ?? "Challenge failed.");
      setMfaVerifying(false);
      return;
    }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: challenge.id,
      code: mfaCode.trim(),
    });
    if (verifyErr) {
      setMfaError(verifyErr.message);
      setMfaCode("");
      setMfaVerifying(false);
      return;
    }
    setEnrolledFactorId(mfaFactorId);
    setMfaQr(null);
    setMfaSecret(null);
    setMfaFactorId(null);
    setMfaCode("");
    setMfaVerifying(false);
    toast({ title: "Authenticator app enabled", description: "Two-step verification is now active on your account." });
  }

  function handleCancelEnroll() {
    if (mfaFactorId) {
      void supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
    }
    setMfaQr(null);
    setMfaSecret(null);
    setMfaFactorId(null);
    setMfaCode("");
    setMfaError(null);
  }

  async function handleUnenroll() {
    if (!enrolledFactorId) return;
    setUnenrolling(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: enrolledFactorId });
    if (error) {
      toast({ title: "Could not disable", description: error.message, variant: "destructive" });
      setUnenrolling(false);
      return;
    }
    setEnrolledFactorId(null);
    setUnenrolling(false);
    toast({ title: "Authenticator app removed", description: "Two-step verification has been disabled." });
  }

  async function handleDeleteAccount() {
    if (!session) return;
    setDeleting(true);
    setDeleteError(null);
    setDeleteResult(null);
    try {
      const res = await fetch("/api/memory-admin?action=delete_account", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const body = await res.json().catch(() => ({})) as {
        success?: boolean;
        error?: string;
        step?: string;
        partial?: boolean;
        step_errors?: Record<string, string>;
        rows_deleted?: Record<string, number>;
        already_deleted?: boolean;
      };
      if (!res.ok) {
        setDeleteResult({ success: false, step: body.step, step_errors: body.step_errors, rows_deleted: body.rows_deleted });
        throw new Error(body.error ?? `Delete failed with ${res.status}`);
      }
      setDeleteResult({ success: true, partial: body.partial, step_errors: body.step_errors, rows_deleted: body.rows_deleted });
      try { localStorage.removeItem("unclick_api_key"); } catch { /* ignore */ }
      await signOut();
      navigate("/", { replace: true });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#61C1C4]/10">
          <SettingsIcon className="h-5 w-5 text-[#61C1C4]" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Settings</h1>
          <p className="text-sm text-white/50">Manage how UnClick connects to your AI tool.</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* CONNECTION */}
        <section className="rounded-xl border border-white/[0.06] bg-[#111111] p-6">
          <h2 className="text-sm font-semibold text-white">Connection</h2>
          <p className="mt-1 text-xs text-white/60">
            Pick which AI tool you use. Setup steps and config-file format follow your choice.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                  platform === p
                    ? "border-[#61C1C4] bg-[#61C1C4]/10 text-white"
                    : "border-white/[0.08] bg-white/[0.02] text-white/70 hover:border-[#61C1C4]/40 hover:text-white"
                }`}
              >
                {platformLabel(p)}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-xs">
              <p className="text-[11px] uppercase tracking-wider text-white/40">Status</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-white">
                {loadingConnection ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />
                    Checking...
                  </>
                ) : connection?.connected ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#61C1C4]" />
                    Connected
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5 text-[#E2B93B]" />
                    Not connected
                  </>
                )}
              </p>
              {connection?.last_seen && (
                <p className="mt-1 text-[11px] text-white/40">
                  Last seen {formatRelative(connection.last_seen)}
                </p>
              )}
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-xs">
              <p className="text-[11px] uppercase tracking-wider text-white/40">Server</p>
              <code className="mt-1 block truncate font-mono text-[11px] text-white">
                {SERVER_URL}
              </code>
            </div>
          </div>

          <div className="mt-4">
            <Link
              to="/memory/connect"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#61C1C4] hover:underline"
            >
              View setup steps for {platformLabel(platform)}
            </Link>
          </div>
        </section>

        {/* AI CONFIG */}
        <section className="rounded-xl border border-white/[0.06] bg-[#111111] p-6">
          <h2 className="text-sm font-semibold text-white">Your AI Config</h2>
          <p className="mt-1 text-xs text-white/60">
            {platformHasConfigFile(platform)
              ? "UnClick can generate a config file for your AI tool so it knows who you are from the first message."
              : `${platformLabel(platform)} loads your identity automatically via UnClick. No config file needed.`}
          </p>

          {platformHasConfigFile(platform) ? (
            <>
              <div className="mt-4 space-y-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <FileText className="h-4 w-4 text-white/40" />
                  <span className="text-white/50">Config file type:</span>
                  <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-[#61C1C4]">
                    {platformFilename(platform)}
                  </code>
                  <span className="text-white/40">(auto-selected from your platform choice)</span>
                </div>
                {serverConfig && (
                  <p className="text-white/40">
                    Last generated {formatRelative(serverConfig.generated_at)} for{" "}
                    {platformLabel(platform)}.
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handlePreview}>
                  {previewOpen ? "Refresh preview" : "Preview"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={regenerateFromServer}
                  disabled={generating || !apiKey}
                >
                  <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} />
                  Regenerate
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download
                </Button>
              </div>

              {previewOpen && (
                <div className="mt-4 rounded-md border border-white/[0.06] bg-black/40">
                  <div className="border-b border-white/[0.06] px-3 py-2 font-mono text-[11px] text-white/40">
                    {activeConfig.filename}
                  </div>
                  <pre className="max-h-[420px] overflow-auto p-3 font-mono text-[11px] leading-relaxed text-white/90">
                    {activeConfig.content}
                  </pre>
                </div>
              )}
            </>
          ) : (
            <div className="mt-4 rounded-md border border-white/[0.06] bg-white/[0.02] p-4 text-xs text-white/70">
              <p>
                Once the UnClick MCP server is added in {platformLabel(platform)}'s settings, your
                identity, facts, and session history are pulled in automatically at the start of
                every conversation. Nothing to install, nothing to paste.
              </p>
              <p className="mt-2 text-white/40">
                See setup steps via "View setup steps for {platformLabel(platform)}" above.
              </p>
            </div>
          )}
        </section>

        {/* MEMORY LOADING */}
        <section className="rounded-xl border border-white/[0.06] bg-[#111111] p-6">
          <h2 className="text-sm font-semibold text-white">Memory Loading</h2>

          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">
                Automatically loads your memory when an AI session starts
              </p>
              <p className="mt-1 max-w-md text-xs text-white/60">
                When on, your AI tool receives your identity, facts, and session history before
                you even type anything.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-white/40">{autoload ? "On" : "Off"}</span>
              <Switch
                checked={autoload}
                onCheckedChange={handleAutoloadChange}
                disabled={autoloadSaving || !apiKey || !settingsLoaded}
                aria-label="Auto-load memory at session start"
              />
            </div>
          </div>

          {!apiKey && (
            <p className="mt-3 text-[11px] text-[#E2B93B]">
              Add your UnClick API key on the You page to change this.
            </p>
          )}
          {apiKey && settingsError && (
            <p className="mt-3 text-[11px] text-[#E2B93B]">
              Could not reach settings service: {settingsError}
            </p>
          )}
        </section>

        {/* ISOLATION */}
        <section className="rounded-xl border border-white/[0.06] bg-[#111111] p-6">
          <h2 className="text-sm font-semibold text-white">Isolation</h2>
          <p className="mt-1 text-sm font-medium text-white">
            UnClick works best as your only memory tool.
          </p>
          <p className="mt-2 text-xs text-white/60">
            Running multiple memory tools (like Mem0, Zep, or Hindsight alongside UnClick) causes
            duplicate facts and confused AI responses. Other tools like GitHub, Slack, or database
            connectors work fine.
          </p>

          <button
            type="button"
            onClick={() => setHowToCheckOpen((v) => !v)}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[#61C1C4] hover:underline"
          >
            How to check what is running
            {howToCheckOpen ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>

          {howToCheckOpen && (
            <ul className="mt-3 space-y-2 rounded-md border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-white/70">
              <li>
                <span className="font-semibold text-white">Claude Code:</span> Run{" "}
                <code className="rounded bg-white/[0.06] px-1 font-mono text-[11px] text-[#61C1C4]">
                  claude mcp list
                </code>{" "}
                in your terminal.
              </li>
              <li>
                <span className="font-semibold text-white">Cursor:</span> Settings, Tools and MCP.
                Look for memory-related servers.
              </li>
              <li>
                <span className="font-semibold text-white">Windsurf:</span> Settings, Cascade, MCP
                Servers.
              </li>
              <li>
                <span className="font-semibold text-white">Copilot:</span> VS Code Settings, MCP
                Servers.
              </li>
            </ul>
          )}
        </section>

        {/* TWO-STEP VERIFICATION */}
        <section className="rounded-xl border border-white/[0.06] bg-[#111111] p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldCheck className="h-4 w-4 text-[#61C1C4]" />
            Two-step verification
          </h2>
          <p className="mt-1 text-xs text-white/60">
            Add an authenticator app (Google Authenticator, Authy, 1Password) as a second factor
            when you sign in with your email link.
          </p>

          {mfaLoading ? (
            <div className="mt-4 flex items-center gap-2 text-xs text-white/40">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking status...
            </div>
          ) : enrolledFactorId && !mfaQr ? (
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-white">
                <CheckCircle2 className="h-4 w-4 text-[#61C1C4]" />
                Authenticator app enabled
              </div>
              <button
                onClick={() => void handleUnenroll()}
                disabled={unenrolling}
                className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:border-white/20 hover:text-white/90 disabled:opacity-40"
              >
                {unenrolling ? "Removing..." : "Disable"}
              </button>
            </div>
          ) : mfaQr ? (
            <div className="mt-4 space-y-4">
              <p className="text-xs text-white/70">
                Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.
              </p>
              <div className="flex justify-center rounded-lg border border-white/[0.06] bg-white p-4">
                <img src={mfaQr} alt="TOTP QR code" className="h-40 w-40" />
              </div>
              {mfaSecret && (
                <p className="text-center text-[11px] text-white/40">
                  Manual key:{" "}
                  <code className="font-mono text-white/60">{mfaSecret}</code>
                </p>
              )}
              <form onSubmit={(e) => void handleConfirmEnroll(e)} className="space-y-3">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="6-digit code"
                  disabled={mfaVerifying}
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2.5 text-center font-mono text-xl tracking-[0.4em] text-white placeholder:text-white/20 focus:border-[#61C1C4]/60 focus:outline-none disabled:opacity-50"
                />
                {mfaError && (
                  <p className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
                    {mfaError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancelEnroll}
                    disabled={mfaVerifying}
                    className="flex-1 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/60 transition-colors hover:text-white/90 disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={mfaVerifying || mfaCode.length !== 6}
                    className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[#61C1C4] px-3 py-2 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {mfaVerifying ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" />Verifying...</>
                    ) : (
                      "Enable"
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="mt-4">
              <button
                onClick={() => void handleStartEnroll()}
                disabled={enrolling}
                className="flex items-center gap-2 rounded-md border border-[#61C1C4]/30 bg-[#61C1C4]/10 px-4 py-2 text-xs font-semibold text-[#61C1C4] transition-colors hover:bg-[#61C1C4]/20 disabled:opacity-40"
              >
                {enrolling ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />Setting up...</>
                ) : (
                  "Set up authenticator app"
                )}
              </button>
            </div>
          )}
        </section>

        {/* DANGER ZONE */}
        <section className="rounded-xl border border-[#E2B93B]/30 bg-[#E2B93B]/[0.05] p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <AlertTriangle className="h-4 w-4 text-[#E2B93B]" />
            Danger Zone
          </h2>
          <p className="mt-1 text-xs text-white/60">
            Permanent actions. Double-check before clicking.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleClearMemory}>
              Clear all memory
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!apiKey}>
              Export everything
            </Button>
          </div>
          <div className="mt-6 border-t border-[#E2B93B]/10 pt-5">
            <p className="text-xs font-medium text-white/80">Delete account</p>
            <p className="mt-1 text-xs text-white/50">
              Permanently removes your memory, credentials, API keys, and profile. Cannot be undone.
            </p>
            <button
              onClick={() => { setDeleteTyped(""); setDeleteError(null); setDeleteOpen(true); }}
              className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/20"
            >
              Delete account
            </button>
          </div>
        </section>

        {/* SUPPORT */}
        <section className="rounded-xl border border-white/[0.06] bg-[#111111] p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Bug className="h-4 w-4 text-white/40" />
            Support
          </h2>
          <p className="mt-1 text-xs text-white/60">Found something off? Let us know.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="https://github.com/anthropics/claude-code/issues/new"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:border-[#61C1C4]/40 hover:text-white"
            >
              Report a bug
            </a>
            <a
              href="https://github.com/anthropics/claude-code/issues"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:border-[#61C1C4]/40 hover:text-white"
            >
              View submitted bugs
            </a>
          </div>
        </section>
      </div>

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
              This removes your auth identity plus every row keyed to your account: memory (facts,
              sessions, business context, conversation log, knowledge library, code dumps), stored
              credentials, API keys, crews, agents, devices, and profile data. It is permanent.
            </p>

            {deleting && (
              <div className="mt-4 space-y-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                {[
                  { label: "Deleting memory data..." },
                  { label: "Deleting crews and agents..." },
                  { label: "Deleting credentials and config..." },
                  { label: "Removing your account..." },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-white/60">
                    <Loader2 className="h-3 w-3 animate-spin opacity-60" />
                    {s.label}
                  </div>
                ))}
              </div>
            )}

            {deleteResult?.partial && deleteResult.step_errors && (
              <div className="mt-3 rounded-md border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-400">
                Account deleted but some data cleanup had errors:
                {Object.entries(deleteResult.step_errors).map(([table, err]) => (
                  <div key={table} className="mt-1 font-mono text-[10px] text-yellow-300/70">
                    {table}: {err}
                  </div>
                ))}
              </div>
            )}

            {deleteError && (
              <div className="mt-3 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
                <p>{deleteError}</p>
                {deleteResult?.step && (
                  <p className="mt-1 font-mono text-[10px] text-red-300/70">
                    Failed at step: {deleteResult.step}
                  </p>
                )}
                {deleteResult?.step_errors && Object.keys(deleteResult.step_errors).length > 0 && (
                  <div className="mt-1">
                    {Object.entries(deleteResult.step_errors).map(([table, err]) => (
                      <p key={table} className="font-mono text-[10px] text-red-300/70">
                        {table}: {err}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!deleting && (
              <>
                <p className="mt-3 text-xs text-[#BBB]">
                  To confirm, type your email address:
                </p>
                <p className="mt-1 font-mono text-xs text-white">{session?.user?.email ?? ""}</p>
                <input
                  type="email"
                  value={deleteTyped}
                  onChange={(e) => setDeleteTyped(e.target.value)}
                  placeholder="Type your email here"
                  autoFocus
                  disabled={deleting}
                  className="mt-3 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 font-mono text-xs text-white placeholder:text-[#555] focus:border-red-500/60 focus:outline-none"
                />
              </>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setDeleteOpen(false); setDeleteResult(null); setDeleteError(null); setDeleteTyped(""); }}
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
                  deleteTyped.trim().toLowerCase() !== (session?.user?.email ?? "").trim().toLowerCase() ||
                  !(session?.user?.email ?? "")
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

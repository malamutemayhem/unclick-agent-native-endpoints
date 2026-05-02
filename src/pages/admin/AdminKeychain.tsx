/**
 * AdminKeychain - Connections admin surface (/admin/keychain)
 *
 * Full CRUD on the user_credentials vault:
 *   - List every credential the signed-in user owns (metadata only)
 *   - Reveal one credential's plaintext values (requires the user's
 *     plaintext UnClick api_key, read from localStorage.unclick_api_key)
 *   - Copy revealed values to clipboard, auto-clearing after 60s
 *   - Rename a credential (label-only edit, no decrypt required)
 *   - Rotate a credential's values (prompt for new JSON, re-encrypt
 *     server-side with the user's api_key)
 *   - Delete a credential (confirmation required)
 *   - Audit log drawer showing every reveal / update / delete event
 *
 * Security model:
 *   - Listing and metadata-only edits use the Supabase session JWT.
 *   - Reveal and rotate actions additionally require the plaintext
 *     UnClick api_key in the request body (proof-of-possession). The
 *     server re-hashes it and compares to the session's api_keys row
 *     before decrypting.
 *   - All mutations land in `backstagepass_audit`.
 *
 * Backend: /api/backstagepass?action={list,reveal,update,delete,audit}
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "@/lib/auth";
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  Shield,
  Trash2,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  listSystemCredentialHealthRows,
  type SystemCredentialDisplayStatus,
  type SystemCredentialHealthRow,
  type SystemCredentialProvider,
  type SystemCredentialRisk,
} from "./systemCredentialInventory";

// ─── Platform catalog ─────────────────────────────────────────────

const PLATFORMS = [
  // AI / LLM
  { slug: "anthropic",  name: "Anthropic",   category: "AI",           desc: "Claude models" },
  { slug: "openai",     name: "OpenAI",       category: "AI",           desc: "GPT and Assistants" },
  { slug: "google-ai",  name: "Google AI",    category: "AI",           desc: "Gemini models" },
  { slug: "cohere",     name: "Cohere",       category: "AI",           desc: "Command models" },
  { slug: "mistral",    name: "Mistral",      category: "AI",           desc: "Mistral models" },
  { slug: "groq",       name: "Groq",         category: "AI",           desc: "Fast inference" },
  { slug: "perplexity", name: "Perplexity",   category: "AI",           desc: "Search + AI" },
  // Dev Tools
  { slug: "github",     name: "GitHub",       category: "Dev Tools",    desc: "Repos and CI" },
  { slug: "gitlab",     name: "GitLab",       category: "Dev Tools",    desc: "Repos and pipelines" },
  { slug: "linear",     name: "Linear",       category: "Dev Tools",    desc: "Issues and projects" },
  { slug: "jira",       name: "Jira",         category: "Dev Tools",    desc: "Issue tracking" },
  { slug: "confluence", name: "Confluence",   category: "Dev Tools",    desc: "Docs and wikis" },
  { slug: "asana",      name: "Asana",        category: "Dev Tools",    desc: "Tasks and projects" },
  { slug: "figma",      name: "Figma",        category: "Dev Tools",    desc: "Design files" },
  // Cloud
  { slug: "supabase",   name: "Supabase",     category: "Cloud",        desc: "Database and auth" },
  { slug: "vercel",     name: "Vercel",        category: "Cloud",        desc: "Deployments" },
  { slug: "cloudflare", name: "Cloudflare",   category: "Cloud",        desc: "DNS and edge" },
  { slug: "aws",        name: "AWS",          category: "Cloud",        desc: "Amazon cloud" },
  { slug: "gcp",        name: "GCP",          category: "Cloud",        desc: "Google cloud" },
  { slug: "azure",      name: "Azure",        category: "Cloud",        desc: "Microsoft cloud" },
  // Payments / Finance
  { slug: "stripe",     name: "Stripe",       category: "Payments",     desc: "Payments and billing" },
  { slug: "shopify",    name: "Shopify",      category: "Payments",     desc: "Store and orders" },
  { slug: "xero",       name: "Xero",         category: "Payments",     desc: "Accounting" },
  { slug: "paypal",     name: "PayPal",       category: "Payments",     desc: "Payments" },
  // Analytics / Marketing
  { slug: "posthog",    name: "PostHog",      category: "Analytics",    desc: "Product analytics" },
  { slug: "mixpanel",   name: "Mixpanel",     category: "Analytics",    desc: "Event analytics" },
  { slug: "hubspot",    name: "HubSpot",      category: "Analytics",    desc: "CRM and marketing" },
  { slug: "mailchimp",  name: "Mailchimp",    category: "Analytics",    desc: "Email campaigns" },
  { slug: "sendgrid",   name: "SendGrid",     category: "Analytics",    desc: "Transactional email" },
  // Comms / Social
  { slug: "slack",      name: "Slack",        category: "Comms",        desc: "Messages and channels" },
  { slug: "discord",    name: "Discord",      category: "Comms",        desc: "Servers and messages" },
  { slug: "telegram",   name: "Telegram",     category: "Comms",        desc: "Bots and channels" },
  { slug: "twilio",     name: "Twilio",       category: "Comms",        desc: "SMS and voice" },
  { slug: "reddit",     name: "Reddit",       category: "Comms",        desc: "Posts and comments" },
  // Data / Productivity
  { slug: "notion",     name: "Notion",       category: "Productivity", desc: "Docs and databases" },
  { slug: "airtable",   name: "Airtable",     category: "Productivity", desc: "Structured data" },
  { slug: "zapier",     name: "Zapier",       category: "Productivity", desc: "Workflow automation" },
] as const;

// ─── Types ───────────────────────────────────────────────────────

interface Credential {
  id:               string;
  platform:         string;
  label:            string | null;
  is_valid:         boolean;
  health_status?:   CredentialHealthStatus;
  last_checked_at?: string | null;
  last_tested_at:   string | null;
  last_used_at:     string | null;
  last_rotated_at:  string | null;
  expires_at:       string | null;
  created_at:       string;
  updated_at:       string;
  owner_email?:     string | null;
  used_by?:         string[];
  expected_fields?: Array<{
    name:   string;
    label:  string;
    secret: boolean;
  }>;
  supports_connection_test?: boolean;
  rotation_note?:   string;
  connector: {
    id:       string;
    name:     string;
    category: string;
    icon:     string | null;
  } | null;
}

type CredentialHealthStatus = "healthy" | "untested" | "failing" | "stale" | "needs_rotation";

// Rotation-reminder threshold. Credentials whose last_rotated_at is
// older than this show an inline warning pill in the admin list. Kept
// as a module constant so it is easy to find and tune.
const ROTATION_WARNING_DAYS = 90;
const STALE_TEST_DAYS = 30;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

interface AuditEntry {
  id:            string;
  action:        string;
  credential_id: string | null;
  platform_slug: string | null;
  label:         string | null;
  ip:            string | null;
  user_agent:    string | null;
  success:       boolean;
  metadata:      Record<string, unknown>;
  created_at:    string;
}

// ─── Helpers ─────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function readLocalApiKey(): string | null {
  try {
    const k = localStorage.getItem("unclick_api_key");
    return k && (k.startsWith("uc_") || k.startsWith("agt_")) ? k : null;
  } catch {
    return null;
  }
}

function maskValue(v: string): string {
  if (v.length <= 8) return "•".repeat(Math.max(v.length, 4));
  return `${v.slice(0, 4)}${"•".repeat(8)}${v.slice(-4)}`;
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

function credentialHealth(cred: Credential): CredentialHealthStatus {
  if (cred.health_status) return cred.health_status;

  const expiresIn = daysUntil(cred.expires_at);
  if (expiresIn !== null && expiresIn <= 14) return "needs_rotation";

  const rotationAge = daysSince(cred.last_rotated_at);
  if (rotationAge !== null && rotationAge >= ROTATION_WARNING_DAYS) return "needs_rotation";

  if (!cred.is_valid) return "failing";

  const testAge = daysSince(cred.last_tested_at);
  if (testAge === null) return "untested";
  if (testAge >= STALE_TEST_DAYS) return "stale";
  return "healthy";
}

const HEALTH_BADGES: Record<CredentialHealthStatus, {
  label: string;
  className: string;
  icon: LucideIcon;
}> = {
  healthy: {
    label: "Healthy",
    className: "border-green-500/20 bg-green-500/10 text-green-400",
    icon: CheckCircle2,
  },
  untested: {
    label: "Untested",
    className: "border-[#E2B93B]/20 bg-[#E2B93B]/10 text-[#E2B93B]",
    icon: AlertTriangle,
  },
  failing: {
    label: "Failing",
    className: "border-red-500/20 bg-red-500/10 text-red-400",
    icon: XCircle,
  },
  stale: {
    label: "Stale",
    className: "border-amber-500/20 bg-amber-500/10 text-amber-400",
    icon: AlertTriangle,
  },
  needs_rotation: {
    label: "Needs rotation",
    className: "border-amber-500/20 bg-amber-500/10 text-amber-400",
    icon: RotateCw,
  },
};

const INVENTORY_RISK_BADGES: Record<SystemCredentialRisk, {
  label: string;
  className: string;
}> = {
  critical: {
    label: "Critical",
    className: "border-red-500/20 bg-red-500/10 text-red-300",
  },
  high: {
    label: "High",
    className: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  },
  normal: {
    label: "Normal",
    className: "border-white/[0.06] bg-white/[0.03] text-[#aaa]",
  },
};

const INVENTORY_STATUS_BADGES: Record<SystemCredentialDisplayStatus, {
  label: string;
  className: string;
}> = {
  metadata_only: {
    label: "Metadata only",
    className: "border-sky-500/20 bg-sky-500/10 text-sky-300",
  },
  manual_check_required: {
    label: "Manual check",
    className: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  },
};

const PROVIDER_LABELS: Record<SystemCredentialProvider, string> = {
  github: "GitHub",
  vercel: "Vercel",
};

// ─── Component ──────────────────────────────────────────────────

export default function AdminKeychain() {
  const { session } = useSession();

  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  // Reveal cache keyed by credential.id. When the user reveals a row
  // we keep plaintext here until they hide it or the auto-clear timer
  // fires. Never persisted anywhere.
  const [revealed, setRevealed]       = useState<Record<string, Record<string, string>>>({});
  // Per-credential reveal timestamp (ms since epoch). Used by the single
  // interval below to auto-clear an entry exactly 60s after it was
  // revealed, independent of any other reveal or hide happening in
  // between.
  const [revealedAt, setRevealedAt]   = useState<Record<string, number>>({});
  const revealedAtRef                 = useRef<Record<string, number>>({});
  revealedAtRef.current               = revealedAt;
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [revealError, setRevealError] = useState<Record<string, string>>({});
  const [revealing, setRevealing]     = useState<Record<string, boolean>>({});
  const [testing, setTesting]         = useState<Record<string, boolean>>({});
  const [testResult, setTestResult]   = useState<Record<string, { ok: boolean | null; message: string; testedAt: string }>>({});

  // Modals
  const [editTarget, setEditTarget]     = useState<Credential | null>(null);
  const [rotateTarget, setRotateTarget] = useState<Credential | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Credential | null>(null);
  const [auditOpen, setAuditOpen]       = useState(false);
  const [starterOpen, setStarterOpen]   = useState(false);
  const [addMode, setAddMode]           = useState<"browse" | "manual">("browse");
  const [platformSearch, setPlatformSearch] = useState("");
  const [manualPlatform, setManualPlatform] = useState("");
  const [manualLabel, setManualLabel]   = useState("");
  const [manualKV, setManualKV]         = useState<{ key: string; value: string }[]>([{ key: "", value: "" }]);
  const [adding, setAdding]             = useState(false);
  const [addError, setAddError]         = useState<string | null>(null);

  // Audit log (only fetched when drawer opens)
  const [auditEntries, setAuditEntries] = useState<AuditEntry[] | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  // Bulk export modal
  const [exportOpen, setExportOpen]         = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [exportConfirm, setExportConfirm]   = useState("");
  const [exporting, setExporting]           = useState(false);
  const [exportError, setExportError]       = useState<string | null>(null);

  const authHeader = useMemo(
    () => (session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    [session],
  );

  const fetchList = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backstagepass?action=list", { headers: authHeader });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `List failed with ${res.status}`);
      }
      const body = await res.json();
      setCredentials(body.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load credentials");
    } finally {
      setLoading(false);
    }
  }, [session, authHeader]);

  useEffect(() => { void fetchList(); }, [fetchList]);

  function resetAddModal() {
    setAddMode("browse");
    setPlatformSearch("");
    setManualPlatform("");
    setManualLabel("");
    setManualKV([{ key: "", value: "" }]);
    setAddError(null);
    setAdding(false);
  }

  async function handleManualAdd() {
    const apiKey = readLocalApiKey();
    if (!apiKey) {
      setAddError("Your API key is not cached in this browser. Re-issue it from the You page first.");
      return;
    }
    const slug = manualPlatform.trim().toLowerCase().replace(/\s+/g, "-");
    if (!slug) { setAddError("Platform name is required."); return; }
    const values: Record<string, string> = {};
    for (const { key, value } of manualKV) {
      if (key.trim()) values[key.trim()] = value;
    }
    if (Object.keys(values).length === 0) { setAddError("At least one key-value pair is required."); return; }
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/backstagepass?action=add", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ platform: slug, label: manualLabel.trim() || null, api_key: apiKey, values }),
      });
      const body = await res.json() as { error?: string };
      if (!res.ok) { setAddError(body.error ?? "Failed to add credential."); return; }
      setStarterOpen(false);
      resetAddModal();
      await fetchList();
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  // Auto-clear revealed plaintext 60s after each individual reveal.
  // A single interval reads the latest revealedAt map via ref and
  // evicts entries whose absolute timestamp has aged past 60s. This
  // avoids the previous bug where revealing a second credential would
  // reset the timer for an already-revealed one.
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const expired: string[] = [];
      for (const [id, at] of Object.entries(revealedAtRef.current)) {
        if (now - at >= 60_000) expired.push(id);
      }
      if (expired.length === 0) return;
      setRevealed((prev) => {
        const next = { ...prev };
        for (const id of expired) delete next[id];
        return next;
      });
      setRevealedAt((prev) => {
        const next = { ...prev };
        for (const id of expired) delete next[id];
        return next;
      });
    }, 5_000);
    return () => window.clearInterval(intervalId);
  }, []);

  async function handleReveal(cred: Credential) {
    const apiKey = readLocalApiKey();
    if (!apiKey) {
      setRevealError((p) => ({
        ...p,
        [cred.id]: "No UnClick API key in this browser. Visit /admin/you to claim or regenerate.",
      }));
      return;
    }
    setRevealing((p) => ({ ...p, [cred.id]: true }));
    setRevealError((p) => ({ ...p, [cred.id]: "" }));
    try {
      const res = await fetch("/api/backstagepass?action=reveal", {
        method:  "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body:    JSON.stringify({ id: cred.id, api_key: apiKey }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Reveal failed with ${res.status}`);
      setRevealed((p) => ({ ...p, [cred.id]: body.values ?? {} }));
      setRevealedAt((p) => ({ ...p, [cred.id]: Date.now() }));
    } catch (err) {
      setRevealError((p) => ({
        ...p,
        [cred.id]: err instanceof Error ? err.message : "Reveal failed",
      }));
    } finally {
      setRevealing((p) => ({ ...p, [cred.id]: false }));
    }
  }

  function handleHide(cred: Credential) {
    setRevealed((p) => {
      const { [cred.id]: _gone, ...rest } = p;
      return rest;
    });
    setRevealedAt((p) => {
      const { [cred.id]: _gone, ...rest } = p;
      return rest;
    });
  }

  async function handleTestConnection(cred: Credential) {
    const apiKey = readLocalApiKey();
    if (!apiKey) {
      setTestResult((p) => ({
        ...p,
        [cred.id]: {
          ok:       false,
          message:  "No UnClick API key in this browser. Visit /admin/you to claim or regenerate.",
          testedAt: new Date().toISOString(),
        },
      }));
      return;
    }
    setTesting((p) => ({ ...p, [cred.id]: true }));
    try {
      const res = await fetch("/api/backstagepass?action=testConnection", {
        method:  "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body:    JSON.stringify({ id: cred.id, api_key: apiKey }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTestResult((p) => ({
          ...p,
          [cred.id]: {
            ok:       false,
            message:  body.error ?? `Test failed with ${res.status}`,
            testedAt: new Date().toISOString(),
          },
        }));
      } else {
        setTestResult((p) => ({
          ...p,
          [cred.id]: {
            ok:       body.ok ?? null,
            message:  body.message ?? "",
            testedAt: body.tested_at ?? new Date().toISOString(),
          },
        }));
      }
    } catch (err) {
      setTestResult((p) => ({
        ...p,
        [cred.id]: {
          ok:       false,
          message:  err instanceof Error ? err.message : "Test failed",
          testedAt: new Date().toISOString(),
        },
      }));
    } finally {
      setTesting((p) => ({ ...p, [cred.id]: false }));
    }
  }

  async function copyToClipboard(field: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField((c) => (c === field ? null : c)), 2_000);
    } catch {
      // no-op — browser blocked clipboard
    }
  }

  async function openAudit() {
    setAuditOpen(true);
    if (auditEntries !== null) return;
    setAuditLoading(true);
    try {
      const res = await fetch("/api/backstagepass?action=audit&limit=100", { headers: authHeader });
      const body = await res.json().catch(() => ({}));
      setAuditEntries(body.data ?? []);
    } finally {
      setAuditLoading(false);
    }
  }

  async function handleBulkExport() {
    const apiKey = readLocalApiKey();
    if (!apiKey) {
      setExportError("No UnClick API key in this browser. Visit /admin/you to claim or regenerate.");
      return;
    }
    if (exportPassword.length < 12) {
      setExportError("Password must be at least 12 characters.");
      return;
    }
    if (exportPassword !== exportConfirm) {
      setExportError("Passwords do not match.");
      return;
    }
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/backstagepass?action=bulk_export", {
        method:  "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body:    JSON.stringify({ api_key: apiKey, password: exportPassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Export failed with ${res.status}`);
      }
      const blob     = await res.blob();
      const url      = URL.createObjectURL(blob);
      const anchor   = document.createElement("a");
      const filename = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1]
        ?? `unclick-connections-${new Date().toISOString().slice(0, 10)}.enc`;
      anchor.href     = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setExportOpen(false);
      setExportPassword("");
      setExportConfirm("");
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  function exportPasswordStrength(pw: string): { label: string; color: string } {
    if (pw.length < 12) return { label: "Weak",   color: "bg-red-500" };
    const hasUpper  = /[A-Z]/.test(pw);
    const hasLower  = /[a-z]/.test(pw);
    const hasDigit  = /[0-9]/.test(pw);
    const hasSymbol = /[^A-Za-z0-9]/.test(pw);
    const variety   = [hasUpper, hasLower, hasDigit, hasSymbol].filter(Boolean).length;
    if (pw.length >= 16 && variety >= 3) return { label: "Strong", color: "bg-green-500" };
    if (pw.length >= 12 && variety >= 2) return { label: "Good",   color: "bg-[#E2B93B]" };
    return { label: "Weak", color: "bg-red-500" };
  }

  const grouped = credentials.reduce<Record<string, Credential[]>>((acc, cred) => {
    const cat = cred.connector?.category ?? "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(cred);
    return acc;
  }, {});

  const healthCounts = credentials.reduce<Record<CredentialHealthStatus, number>>((acc, cred) => {
    acc[credentialHealth(cred)] += 1;
    return acc;
  }, {
    healthy:        0,
    untested:       0,
    failing:        0,
    stale:          0,
    needs_rotation: 0,
  });

  const systemCredentialInventory = useMemo(() => listSystemCredentialHealthRows(), []);
  const inventorySummary = useMemo(() => ({
    total:    systemCredentialInventory.length,
    critical: systemCredentialInventory.filter((entry) => entry.risk === "critical").length,
    high:     systemCredentialInventory.filter((entry) => entry.risk === "high").length,
    expected: systemCredentialInventory.filter((entry) => entry.expected).length,
  }), [systemCredentialInventory]);
  const inventoryByProvider = useMemo(() => (
    systemCredentialInventory.reduce<Record<SystemCredentialProvider, SystemCredentialHealthRow[]>>((acc, entry) => {
      acc[entry.provider].push(entry);
      return acc;
    }, { github: [], vercel: [] })
  ), [systemCredentialInventory]);

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Connections</h1>
          <p className="mt-1 text-sm text-[#888]">
            Connect services your agents can use. {credentials.length} connection{credentials.length === 1 ? "" : "s"} stored.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setExportOpen(true); setExportPassword(""); setExportConfirm(""); setExportError(null); }}
            className="rounded-lg border border-white/[0.06] px-3 py-2 text-xs text-[#888] transition-colors hover:border-[#E2B93B]/20 hover:text-[#E2B93B]"
          >
            Export connections
          </button>
          <button
            onClick={openAudit}
            className="rounded-lg border border-white/[0.06] px-3 py-2 text-xs text-[#888] transition-colors hover:border-[#E2B93B]/20 hover:text-[#E2B93B]"
          >
            Audit log
          </button>
          <button
            onClick={() => void fetchList()}
            disabled={loading}
            title="Refresh"
            className="rounded-lg border border-white/[0.06] p-2 text-[#888] transition-colors hover:border-[#E2B93B]/20 hover:text-[#E2B93B] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Encryption notice */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#E2B93B]/20 bg-[#E2B93B]/5 px-4 py-3">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[#E2B93B]" />
        <div>
          <p className="text-xs font-medium text-[#E2B93B]">Encrypted connection secrets</p>
          <p className="mt-0.5 text-[11px] text-[#888]">
            Connection secrets are AES-256-GCM encrypted with a key derived from your UnClick API key.
            UnClick staff cannot decrypt them — even revealing a value requires your API key to be present in this browser.
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-white/[0.06] bg-[#111111] p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#666]">System credential inventory</p>
            <p className="mt-1 text-[11px] text-[#888]">
              Name-only map of what powers each workflow, who owns it, and how to rotate safely.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Tracked", inventorySummary.total],
              ["Expected", inventorySummary.expected],
              ["Critical", inventorySummary.critical],
              ["High", inventorySummary.high],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-white/[0.05] bg-black/20 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-[#555]">{label}</p>
                <p className="mt-1 text-sm font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {(Object.keys(inventoryByProvider) as SystemCredentialProvider[]).map((provider) => (
            <div key={provider} className="rounded-lg border border-white/[0.05] bg-black/20">
              <div className="flex items-center justify-between border-b border-white/[0.05] px-3 py-2">
                <p className="text-xs font-semibold text-white">{PROVIDER_LABELS[provider]}</p>
                <p className="text-[10px] text-[#666]">{inventoryByProvider[provider].length} names</p>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {inventoryByProvider[provider].map((entry) => {
                  const risk = INVENTORY_RISK_BADGES[entry.risk];
                  const status = INVENTORY_STATUS_BADGES[entry.displayStatus];
                  return (
                    <div key={`${entry.provider}-${entry.name}-${entry.workload}`} className="grid gap-2 px-3 py-3 text-[11px] md:grid-cols-[minmax(12rem,0.8fr)_minmax(16rem,1.2fr)_auto]">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[#ddd]">{entry.name}</p>
                        <p className="mt-0.5 text-[#555]">{entry.scope}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[#ccc]">{entry.workload}</p>
                        <div className="mt-1 grid gap-1 text-[#666] sm:grid-cols-2">
                          <p>Owner: {entry.ownerLabel} ({entry.ownerConfidence})</p>
                          <p>Last checked: {entry.lastCheckedAt ? timeAgo(entry.lastCheckedAt) : "manual check required"}</p>
                        </div>
                        <p className="mt-1 text-[#666]">{entry.docsHint}</p>
                        <div className="mt-1 space-y-0.5 text-[#888]">
                          {entry.safeRotationNotes.map((note) => (
                            <p key={note}>Rotate: {note}</p>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-start gap-1 md:justify-end">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${status.className}`}>
                          {status.label}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${risk.className}`}>
                          {risk.label}
                        </span>
                        <span className="rounded-full border border-white/[0.05] bg-white/[0.03] px-2 py-0.5 text-[10px] text-[#aaa]">
                          {entry.expected ? "Expected" : "Optional"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {credentials.length > 0 && (
        <div className="mb-6 rounded-xl border border-white/[0.06] bg-[#111111] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#666]">System credential health</p>
              <p className="mt-1 text-[11px] text-[#888]">
                Metadata only: ownership, usage, checks, and rotation notes.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(Object.keys(HEALTH_BADGES) as CredentialHealthStatus[]).map((status) => {
                const badge = HEALTH_BADGES[status];
                const Icon = badge.icon;
                return (
                  <div key={status} className={`rounded-lg border px-3 py-2 ${badge.className}`}>
                    <div className="flex items-center gap-1.5 text-[10px] font-medium">
                      <Icon className="h-3 w-3" />
                      {badge.label}
                    </div>
                    <p className="mt-1 text-sm font-semibold">{healthCounts[status]}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-[#666]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading connections...</span>
        </div>
      ) : credentials.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-[#111111] p-8 text-center">
          <KeyRound className="mx-auto h-8 w-8 text-[#333]" />
          <p className="mt-3 text-sm text-[#666]">No connections yet</p>
          <p className="mt-1 text-xs text-[#444]">
            Connect a platform or add a manual key or token.
          </p>
          <button
            onClick={() => setStarterOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-[#E2B93B]/30 bg-[#E2B93B]/10 px-3 py-2 text-xs font-semibold text-[#E2B93B] transition-colors hover:bg-[#E2B93B]/20"
          >
            <Plus className="h-3.5 w-3.5" />
            Add connection
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, creds]) => (
            <div key={category}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#666]">
                {category}
              </h3>
              <div className="space-y-2">
                {creds.map((cred) => {
                  const plaintext = revealed[cred.id];
                  const isOpen    = Boolean(plaintext);
                  const busy      = revealing[cred.id];
                  const errMsg    = revealError[cred.id];
                  const health    = credentialHealth(cred);
                  const badge     = HEALTH_BADGES[health];
                  const HealthIcon = badge.icon;
                  const usedBy    = cred.used_by?.filter(Boolean) ?? ["manual connection"];
                  const fields    = cred.expected_fields?.filter((f) => f.name || f.label) ?? [];
                  const lastChecked = cred.last_checked_at ?? cred.last_tested_at;

                  return (
                    <div
                      key={cred.id}
                      className="rounded-xl border border-white/[0.06] bg-[#111111] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-sm font-semibold text-[#888]">
                            {cred.connector?.icon ?? cred.platform.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white">
                              {cred.connector?.name ?? cred.platform}
                            </p>
                            <p className="truncate text-[11px] text-[#666]">
                              {cred.label ?? "default"} · added {timeAgo(cred.created_at)}
                              {cred.last_used_at ? ` · last used ${timeAgo(cred.last_used_at)}` : ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${badge.className}`}>
                            <HealthIcon className="h-3 w-3" /> {badge.label}
                          </span>

                          {(() => {
                            const age = daysSince(cred.last_rotated_at);
                            if (age === null || age < ROTATION_WARNING_DAYS) return null;
                            return (
                              <span
                                className="flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400"
                                title={`Last rotated ${age} days ago. Rotate to refresh the encrypted secret.`}
                              >
                                <AlertTriangle className="h-3 w-3" /> Rotate ({age}d)
                              </span>
                            );
                          })()}

                          <button
                            onClick={() => (isOpen ? handleHide(cred) : void handleReveal(cred))}
                            disabled={busy}
                            className="rounded-md p-1.5 text-[#888] transition-colors hover:bg-white/[0.04] hover:text-white disabled:opacity-40"
                            title={isOpen ? "Hide values" : "Reveal values"}
                          >
                            {busy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : isOpen ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => setEditTarget(cred)}
                            className="rounded-md p-1.5 text-[#888] transition-colors hover:bg-white/[0.04] hover:text-white"
                            title="Rename"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => void handleTestConnection(cred)}
                            disabled={testing[cred.id]}
                            className="rounded-md p-1.5 text-[#888] transition-colors hover:bg-white/[0.04] hover:text-white disabled:opacity-40"
                            title={cred.supports_connection_test === false ? "No automated probe yet" : "Test connection"}
                          >
                            {testing[cred.id] ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Zap className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => setRotateTarget(cred)}
                            className="rounded-md p-1.5 text-[#888] transition-colors hover:bg-white/[0.04] hover:text-white"
                            title="Rotate values"
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(cred)}
                            className="rounded-md p-1.5 text-[#888] transition-colors hover:bg-red-500/10 hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 border-t border-white/[0.04] pt-3 text-[11px] sm:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <p className="text-[#555]">Owner</p>
                          <p className="mt-0.5 truncate text-[#ccc]">{cred.owner_email ?? "This UnClick account"}</p>
                        </div>
                        <div>
                          <p className="text-[#555]">Last checked</p>
                          <p className="mt-0.5 text-[#ccc]">
                            {lastChecked ? timeAgo(lastChecked) : "never"}
                            {cred.supports_connection_test === false ? " · manual" : ""}
                          </p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-[#555]">Used by</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {usedBy.slice(0, 4).map((usage) => (
                              <span key={usage} className="rounded border border-white/[0.05] bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-[#aaa]">
                                {usage}
                              </span>
                            ))}
                          </div>
                        </div>
                        {fields.length > 0 && (
                          <div className="sm:col-span-2 xl:col-span-4">
                            <p className="text-[#555]">Expected fields</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {fields.map((field) => (
                                <span key={`${field.name}-${field.label}`} className="rounded border border-white/[0.05] bg-black/20 px-1.5 py-0.5 font-mono text-[10px] text-[#aaa]">
                                  {field.label || field.name}{field.secret ? " · secret" : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {cred.rotation_note && (
                          <p className="sm:col-span-2 xl:col-span-4 text-[11px] text-[#777]">
                            {cred.rotation_note}
                          </p>
                        )}
                      </div>

                      {errMsg && (
                        <p className="mt-3 text-[11px] text-red-400">{errMsg}</p>
                      )}

                      {testResult[cred.id] && (
                        <p
                          className={`mt-3 text-[11px] ${
                            testResult[cred.id].ok === true
                              ? "text-green-400"
                              : testResult[cred.id].ok === false
                                ? "text-red-400"
                                : "text-[#888]"
                          }`}
                        >
                          {testResult[cred.id].ok === true ? "Connection OK. " : testResult[cred.id].ok === false ? "Connection failed. " : ""}
                          {testResult[cred.id].message}
                        </p>
                      )}

                      {isOpen && plaintext && (
                        <div className="mt-3 space-y-1.5 rounded-lg border border-white/[0.04] bg-black/30 p-3">
                          {Object.entries(plaintext).map(([field, value]) => {
                            const key = `${cred.id}::${field}`;
                            return (
                              <div key={field} className="flex items-center justify-between gap-3 text-[11px]">
                                <span className="shrink-0 font-mono text-[#666]">{field}</span>
                                <code className="min-w-0 flex-1 truncate font-mono text-[#ccc]">
                                  {maskValue(String(value))}
                                </code>
                                <div className="flex shrink-0 gap-1">
                                  <button
                                    onClick={() => void copyToClipboard(key, String(value))}
                                    className="rounded p-1 text-[#666] transition-colors hover:text-[#E2B93B]"
                                    title="Copy to clipboard"
                                  >
                                    {copiedField === key ? (
                                      <ClipboardCheck className="h-3 w-3 text-green-400" />
                                    ) : (
                                      <Clipboard className="h-3 w-3" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          <p className="mt-2 border-t border-white/[0.04] pt-2 text-[10px] text-[#444]">
                            Auto-hides in 60s. Values are masked on-screen — click copy to get the full value onto your clipboard.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit-label modal */}
      {editTarget && (
        <EditLabelModal
          cred={editTarget}
          authHeader={authHeader}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); void fetchList(); }}
        />
      )}

      {/* Rotate-values modal */}
      {rotateTarget && (
        <RotateValuesModal
          cred={rotateTarget}
          authHeader={authHeader}
          onClose={() => setRotateTarget(null)}
          onSaved={() => { setRotateTarget(null); void fetchList(); }}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <DeleteModal
          cred={deleteTarget}
          authHeader={authHeader}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => { setDeleteTarget(null); void fetchList(); }}
        />
      )}

      {/* Audit drawer */}
      {auditOpen && (
        <AuditDrawer
          entries={auditEntries}
          loading={auditLoading}
          onClose={() => setAuditOpen(false)}
        />
      )}

      {/* Export connections modal */}
      {exportOpen && (() => {
        const pw       = exportPassword;
        const strength = exportPasswordStrength(pw);
        const canDownload = pw.length >= 12 && pw === exportConfirm;
        return (
          <ModalShell title="Export connections" onClose={() => { setExportOpen(false); setExportPassword(""); setExportConfirm(""); setExportError(null); }}>
            <p className="mb-4 text-xs text-[#888]">
              Download an encrypted backup of your Connections secrets. Set a password to protect the file.
            </p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] text-[#888]">Backup password</label>
                <input
                  type="password"
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  minLength={12}
                  placeholder="Min 12 characters"
                  className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white placeholder:text-[#444] focus:border-[#E2B93B]/40 focus:outline-none"
                  autoFocus
                />
                {pw.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 flex-1 rounded-full bg-white/[0.08]">
                      <div
                        className={`h-1 rounded-full transition-all ${strength.color} ${
                          strength.label === "Strong" ? "w-full" : strength.label === "Good" ? "w-2/3" : "w-1/3"
                        }`}
                      />
                    </div>
                    <span className={`text-[10px] font-medium ${
                      strength.label === "Strong" ? "text-green-400" : strength.label === "Good" ? "text-[#E2B93B]" : "text-red-400"
                    }`}>
                      {strength.label}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-[#888]">Confirm password</label>
                <input
                  type="password"
                  value={exportConfirm}
                  onChange={(e) => setExportConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white placeholder:text-[#444] focus:border-[#E2B93B]/40 focus:outline-none"
                />
              </div>
            </div>
            {exportError && <p className="mt-2 text-[11px] text-red-400">{exportError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setExportOpen(false); setExportPassword(""); setExportConfirm(""); setExportError(null); }}
                className="rounded-lg border border-white/[0.06] px-3 py-2 text-xs text-[#888] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleBulkExport()}
                disabled={!canDownload || exporting}
                className="rounded-lg bg-[#E2B93B] px-3 py-2 text-xs font-medium text-black hover:bg-[#E2B93B]/90 disabled:opacity-50"
              >
                {exporting ? "Downloading..." : "Download"}
              </button>
            </div>
          </ModalShell>
        );
      })()}

      {/* Add connection modal */}
      {starterOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => { setStarterOpen(false); resetAddModal(); }}
        >
          <div
            className="flex w-full max-w-md flex-col rounded-xl border border-white/[0.08] bg-[#111111]"
            style={{ maxHeight: "85vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <h3 className="text-sm font-semibold text-white">Add connection</h3>
              <button
                onClick={() => { setStarterOpen(false); resetAddModal(); }}
                className="rounded-md p-1 text-[#888] transition-colors hover:bg-white/[0.04] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mode tabs */}
            <div className="flex shrink-0 border-b border-white/[0.06]">
              {(["browse", "manual"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => { setAddMode(mode); setAddError(null); }}
                  className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                    addMode === mode
                      ? "border-b-2 border-[#61C1C4] text-[#61C1C4]"
                      : "text-[#666] hover:text-[#aaa]"
                  }`}
                >
                  {mode === "browse" ? "Browse Platforms" : "Add Manually"}
                </button>
              ))}
            </div>

            {/* Browse mode */}
            {addMode === "browse" && (
              <>
                <div className="shrink-0 px-4 pt-3 pb-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#555]" />
                    <input
                      type="text"
                      placeholder="Search platforms..."
                      value={platformSearch}
                      onChange={(e) => setPlatformSearch(e.target.value)}
                      className="w-full rounded-md border border-white/[0.08] bg-black/30 py-2 pl-8 pr-3 text-xs text-white placeholder-[#555] focus:border-[#61C1C4]/40 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  <div className="space-y-1">
                    {PLATFORMS.filter(
                      (p) =>
                        !platformSearch ||
                        p.name.toLowerCase().includes(platformSearch.toLowerCase()) ||
                        p.category.toLowerCase().includes(platformSearch.toLowerCase()) ||
                        p.desc.toLowerCase().includes(platformSearch.toLowerCase()),
                    ).map(({ slug, name, desc }) => (
                      <Link
                        key={slug}
                        to={`/connect/${slug}`}
                        onClick={() => { setStarterOpen(false); resetAddModal(); }}
                        className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5 transition-colors hover:border-[#E2B93B]/30 hover:bg-[#E2B93B]/5"
                      >
                        <div>
                          <p className="text-xs font-medium text-white">{name}</p>
                          <p className="text-[11px] text-[#555]">{desc}</p>
                        </div>
                        <Plus className="h-3.5 w-3.5 shrink-0 text-[#555]" />
                      </Link>
                    ))}
                    {PLATFORMS.filter(
                      (p) =>
                        !platformSearch ||
                        p.name.toLowerCase().includes(platformSearch.toLowerCase()) ||
                        p.category.toLowerCase().includes(platformSearch.toLowerCase()) ||
                        p.desc.toLowerCase().includes(platformSearch.toLowerCase()),
                    ).length === 0 && (
                      <p className="py-6 text-center text-xs text-[#555]">No platforms match "{platformSearch}"</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Manual mode */}
            {addMode === "manual" && (
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {!readLocalApiKey() && (
                  <div className="mb-4 flex items-start gap-2 rounded-lg border border-[#E2B93B]/20 bg-[#E2B93B]/5 p-3 text-xs text-[#E2B93B]">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>Your API key is not cached in this browser. Go to <Link to="/admin/you" className="underline" onClick={() => { setStarterOpen(false); resetAddModal(); }}>You</Link> and re-issue it first.</span>
                  </div>
                )}
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-[11px] text-[#888]">Platform name</label>
                    <input
                      type="text"
                      placeholder="e.g. GitHub, My Custom API"
                      value={manualPlatform}
                      onChange={(e) => setManualPlatform(e.target.value)}
                      className="w-full rounded-md border border-white/[0.08] bg-black/30 px-3 py-2 text-xs text-white placeholder-[#555] focus:border-[#61C1C4]/40 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-[#888]">Label (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. personal, work"
                      value={manualLabel}
                      onChange={(e) => setManualLabel(e.target.value)}
                      className="w-full rounded-md border border-white/[0.08] bg-black/30 px-3 py-2 text-xs text-white placeholder-[#555] focus:border-[#61C1C4]/40 focus:outline-none"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-[11px] text-[#888]">Key-value pairs</label>
                      <button
                        onClick={() => setManualKV((prev) => [...prev, { key: "", value: "" }])}
                        className="text-[11px] text-[#61C1C4] hover:underline"
                      >
                        + Add field
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {manualKV.map((pair, idx) => (
                        <div key={idx} className="flex gap-1.5">
                          <input
                            type="text"
                            placeholder="key"
                            value={pair.key}
                            onChange={(e) => setManualKV((prev) => prev.map((p, i) => i === idx ? { ...p, key: e.target.value } : p))}
                            className="w-2/5 rounded-md border border-white/[0.08] bg-black/30 px-2 py-1.5 font-mono text-[11px] text-white placeholder-[#555] focus:border-[#61C1C4]/40 focus:outline-none"
                          />
                          <input
                            type="password"
                            placeholder="value"
                            value={pair.value}
                            onChange={(e) => setManualKV((prev) => prev.map((p, i) => i === idx ? { ...p, value: e.target.value } : p))}
                            className="min-w-0 flex-1 rounded-md border border-white/[0.08] bg-black/30 px-2 py-1.5 font-mono text-[11px] text-white placeholder-[#555] focus:border-[#61C1C4]/40 focus:outline-none"
                          />
                          {manualKV.length > 1 && (
                            <button
                              onClick={() => setManualKV((prev) => prev.filter((_, i) => i !== idx))}
                              className="rounded-md p-1.5 text-[#555] hover:text-red-400"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  {addError && <p className="text-[11px] text-red-400">{addError}</p>}
                  <button
                    onClick={handleManualAdd}
                    disabled={adding || !readLocalApiKey()}
                    className="w-full rounded-md border border-[#61C1C4]/30 bg-[#61C1C4]/10 py-2 text-xs font-semibold text-[#61C1C4] transition-colors hover:bg-[#61C1C4]/20 disabled:opacity-50"
                  >
                    {adding ? "Saving..." : "Save encrypted connection"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Modals ───────────────────────────────────────────────────────

function ModalShell({
  title,
  onClose,
  children,
}: {
  title:    string;
  onClose:  () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-white/[0.08] bg-[#111111] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[#888] transition-colors hover:bg-white/[0.04] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EditLabelModal({
  cred,
  authHeader,
  onClose,
  onSaved,
}: {
  cred:       Credential;
  authHeader: Record<string, string>;
  onClose:    () => void;
  onSaved:    () => void;
}) {
  const [label, setLabel]   = useState(cred.label ?? "");
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState<string | null>(null);

  async function save() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/backstagepass?action=update", {
        method:  "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body:    JSON.stringify({ id: cred.id, label }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Update failed with ${res.status}`);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={`Rename ${cred.connector?.name ?? cred.platform}`} onClose={onClose}>
      <p className="mb-3 text-xs text-[#888]">
        Labels distinguish multiple connections for the same platform (e.g. "claude-code", "bailey-plex-3"). Leave blank for the default.
      </p>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="default"
        className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white placeholder:text-[#444] focus:border-[#E2B93B]/40 focus:outline-none"
        autoFocus
      />
      {err && <p className="mt-2 text-[11px] text-red-400">{err}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg border border-white/[0.06] px-3 py-2 text-xs text-[#888] hover:text-white"
        >
          Cancel
        </button>
        <button
          onClick={() => void save()}
          disabled={busy}
          className="rounded-lg bg-[#E2B93B] px-3 py-2 text-xs font-medium text-black hover:bg-[#E2B93B]/90 disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save"}
        </button>
      </div>
    </ModalShell>
  );
}

function RotateValuesModal({
  cred,
  authHeader,
  onClose,
  onSaved,
}: {
  cred:       Credential;
  authHeader: Record<string, string>;
  onClose:    () => void;
  onSaved:    () => void;
}) {
  const [json, setJson] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState<string | null>(null);

  async function save() {
    setBusy(true); setErr(null);
    try {
      let values: Record<string, string>;
      try {
        values = JSON.parse(json);
        if (typeof values !== "object" || values === null || Array.isArray(values)) {
          throw new Error("Values must be a JSON object of string fields.");
        }
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : "Invalid JSON");
      }

      const apiKey = readLocalApiKey();
      if (!apiKey) throw new Error("No UnClick API key in this browser. Visit /admin/you first.");

      const res = await fetch("/api/backstagepass?action=update", {
        method:  "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body:    JSON.stringify({ id: cred.id, values, api_key: apiKey }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Update failed with ${res.status}`);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={`Rotate ${cred.connector?.name ?? cred.platform} values`} onClose={onClose}>
      <p className="mb-3 text-xs text-[#888]">
        Paste the new connection values as a JSON object. This replaces the stored values and re-encrypts with your UnClick API key.
      </p>
      <div className="mb-2 text-[10px] text-[#666]">Example:</div>
      <pre className="mb-3 overflow-x-auto rounded border border-white/[0.04] bg-black/40 p-2 text-[10px] text-[#888]">
{`{
  "api_key": "sk-ant-…"
}`}
      </pre>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={6}
        placeholder='{ "api_key": "..." }'
        className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 font-mono text-xs text-white placeholder:text-[#444] focus:border-[#E2B93B]/40 focus:outline-none"
        autoFocus
      />
      {err && <p className="mt-2 text-[11px] text-red-400">{err}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg border border-white/[0.06] px-3 py-2 text-xs text-[#888] hover:text-white"
        >
          Cancel
        </button>
        <button
          onClick={() => void save()}
          disabled={busy}
          className="rounded-lg bg-[#E2B93B] px-3 py-2 text-xs font-medium text-black hover:bg-[#E2B93B]/90 disabled:opacity-50"
        >
          {busy ? "Rotating..." : "Rotate"}
        </button>
      </div>
    </ModalShell>
  );
}

function DeleteModal({
  cred,
  authHeader,
  onClose,
  onDeleted,
}: {
  cred:       Credential;
  authHeader: Record<string, string>;
  onClose:    () => void;
  onDeleted:  () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState<string | null>(null);

  async function doDelete() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/backstagepass?action=delete", {
        method:  "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body:    JSON.stringify({ id: cred.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Delete failed with ${res.status}`);
      onDeleted();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Delete connection?" onClose={onClose}>
      <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
        <p className="text-xs text-red-400">
          This permanently removes <span className="font-mono">{cred.platform}{cred.label ? ` [${cred.label}]` : ""}</span> from Connections. The audit log is preserved.
        </p>
      </div>
      {err && <p className="mt-2 text-[11px] text-red-400">{err}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg border border-white/[0.06] px-3 py-2 text-xs text-[#888] hover:text-white"
        >
          Cancel
        </button>
        <button
          onClick={() => void doDelete()}
          disabled={busy}
          className="rounded-lg bg-red-500 px-3 py-2 text-xs font-medium text-white hover:bg-red-500/90 disabled:opacity-50"
        >
          {busy ? "Deleting..." : "Delete"}
        </button>
      </div>
    </ModalShell>
  );
}

function AuditDrawer({
  entries,
  loading,
  onClose,
}: {
  entries: AuditEntry[] | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto border-l border-white/[0.08] bg-[#0a0a0a] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Audit log</h3>
            <p className="text-[11px] text-[#666]">Every reveal, update, and delete on your Connections secrets.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[#888] transition-colors hover:bg-white/[0.04] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-12 text-[#666]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : !entries || entries.length === 0 ? (
          <p className="py-12 text-center text-xs text-[#666]">No audit events yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {entries.map((e) => (
              <li key={e.id} className="rounded-lg border border-white/[0.04] bg-[#111111] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-medium text-white">
                    {e.success ? (
                      <CheckCircle2 className="h-3 w-3 text-green-400" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-400" />
                    )}
                    {e.action}
                  </span>
                  <span className="text-[10px] text-[#555]">{timeAgo(e.created_at)}</span>
                </div>
                <p className="mt-1 text-[11px] text-[#888]">
                  {e.platform_slug ?? "(no platform)"}
                  {e.label ? ` [${e.label}]` : ""}
                </p>
                {(e.ip || e.user_agent) && (
                  <p className="mt-0.5 truncate text-[10px] text-[#555]">
                    {e.ip ?? ""}{e.ip && e.user_agent ? " · " : ""}{e.user_agent ?? ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bell, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useSession } from "@/lib/auth";

type MinSeverity = "info" | "action_needed" | "critical";
type Channel = "email" | "telegram" | "browser_push" | "webhook" | "in_admin";

const ALL_CHANNELS: { id: Channel; label: string }[] = [
  { id: "email", label: "Email" },
  { id: "telegram", label: "Telegram" },
  { id: "browser_push", label: "Browser push" },
  { id: "webhook", label: "Webhook" },
  { id: "in_admin", label: "In-admin only" },
];

interface Preferences {
  email_enabled: boolean;
  email_address: string | null;
  phone_push_enabled: boolean;
  telegram_enabled: boolean;
  telegram_chat_id: string | null;
  browser_push_enabled: boolean;
  push_subscription: PushSubscriptionJSON | null;
  webhook_url: string | null;
  webhook_secret: string | null;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  min_severity: MinSeverity;
  routing_rules: Record<string, Channel[]>;
}

const DEFAULTS: Preferences = {
  email_enabled: false,
  email_address: "",
  phone_push_enabled: true,
  telegram_enabled: false,
  telegram_chat_id: "",
  browser_push_enabled: false,
  push_subscription: null,
  webhook_url: "",
  webhook_secret: "",
  quiet_hours_start: "",
  quiet_hours_end: "",
  min_severity: "info",
  routing_rules: {},
};

function urlsafeBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export default function SignalsSettings() {
  const { session } = useSession();
  const token = session?.access_token;
  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pushStatus, setPushStatus] = useState<"idle" | "busy" | "ok" | "err">("idle");
  const [testWebhookStatus, setTestWebhookStatus] = useState<"idle" | "busy" | "ok" | "err">("idle");
  const [newRuleKey, setNewRuleKey] = useState("");
  const [newRuleChannels, setNewRuleChannels] = useState<Channel[]>([]);
  const [showAddRule, setShowAddRule] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/memory-admin?action=get_signal_preferences", { headers: authHeader });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to load preferences");
      const p = body.preferences ?? {};
      setPrefs({
        email_enabled: p.email_enabled ?? false,
        email_address: p.email_address ?? "",
        phone_push_enabled: p.phone_push_enabled ?? true,
        telegram_enabled: p.telegram_enabled ?? false,
        telegram_chat_id: p.telegram_chat_id ?? "",
        browser_push_enabled: p.browser_push_enabled ?? false,
        push_subscription: p.push_subscription ?? null,
        webhook_url: p.webhook_url ?? "",
        webhook_secret: p.webhook_secret ?? "",
        quiet_hours_start: p.quiet_hours_start ?? "",
        quiet_hours_end: p.quiet_hours_end ?? "",
        min_severity: p.min_severity ?? "info",
        routing_rules: p.routing_rules ?? {},
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load preferences");
    } finally {
      setLoading(false);
    }
  }, [token, authHeader]);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!token) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/memory-admin?action=update_signal_preferences", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          email_enabled: prefs.email_enabled,
          email_address: prefs.email_address || null,
          phone_push_enabled: prefs.phone_push_enabled,
          telegram_enabled: prefs.telegram_enabled,
          telegram_chat_id: prefs.telegram_chat_id || null,
          browser_push_enabled: prefs.browser_push_enabled,
          push_subscription: prefs.push_subscription,
          webhook_url: prefs.webhook_url || null,
          webhook_secret: prefs.webhook_secret || null,
          quiet_hours_start: prefs.quiet_hours_start || null,
          quiet_hours_end: prefs.quiet_hours_end || null,
          min_severity: prefs.min_severity,
          routing_rules: prefs.routing_rules,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to save");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  async function enableBrowserPush() {
    setPushStatus("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushStatus("err");
        setError("Browser permission denied. Allow notifications in your browser settings.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
      if (!vapidKey) throw new Error("VITE_VAPID_PUBLIC_KEY not configured");
      const keyBytes = Uint8Array.from(atob(vapidKey.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes });
      const subJson = sub.toJSON() as PushSubscriptionJSON;
      setPrefs((p) => ({ ...p, browser_push_enabled: true, push_subscription: subJson }));
      setPushStatus("ok");
    } catch (e) {
      setPushStatus("err");
      setError(e instanceof Error ? e.message : "Failed to enable browser push");
    }
  }

  async function disableBrowserPush() {
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      }
    } catch (_) { /* ignore */ }
    setPrefs((p) => ({ ...p, browser_push_enabled: false, push_subscription: null }));
    setPushStatus("idle");
  }

  async function sendTestWebhook() {
    if (!token) return;
    setTestWebhookStatus("busy");
    try {
      const res = await fetch("/api/signals-test-webhook", {
        method: "POST",
        headers: authHeader,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(`Server returned ${body.status ?? res.status}`);
      setTestWebhookStatus("ok");
      setTimeout(() => setTestWebhookStatus("idle"), 3000);
    } catch (e) {
      setTestWebhookStatus("err");
      setError(e instanceof Error ? e.message : "Test failed");
      setTimeout(() => setTestWebhookStatus("idle"), 3000);
    }
  }

  function addRoutingRule() {
    const key = newRuleKey.trim();
    if (!key || newRuleChannels.length === 0) return;
    setPrefs((p) => ({ ...p, routing_rules: { ...p.routing_rules, [key]: newRuleChannels } }));
    setNewRuleKey("");
    setNewRuleChannels([]);
    setShowAddRule(false);
  }

  function removeRoutingRule(key: string) {
    setPrefs((p) => {
      const next = { ...p.routing_rules };
      delete next[key];
      return { ...p, routing_rules: next };
    });
  }

  function toggleNewRuleChannel(ch: Channel) {
    setNewRuleChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#888]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading preferences...
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to="/admin/signals" className="inline-flex items-center gap-2 text-sm text-[#888] hover:text-[#ccc]">
          <ArrowLeft className="h-4 w-4" /> View all signals
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-white">Signal settings</h1>
        <p className="mt-0.5 text-sm text-[#888]">Choose how you want to be notified when your tools do something worth knowing about.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
      )}

      <div className="flex flex-col gap-6">
        {/* Email */}
        <section className="rounded-xl border border-white/[0.06] bg-[#111] p-5">
          <label className="flex items-center justify-between">
            <span>
              <span className="block text-sm font-medium text-white">Email</span>
              <span className="block text-xs text-[#888]">Send me an email when something important happens.</span>
            </span>
            <input type="checkbox" checked={prefs.email_enabled} onChange={(e) => update("email_enabled", e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-[#111]" />
          </label>
          {prefs.email_enabled && (
            <input type="email" value={prefs.email_address ?? ""} onChange={(e) => update("email_address", e.target.value)} placeholder="you@example.com" className="mt-3 w-full rounded-lg border border-white/[0.08] bg-[#0A0A0A] px-3 py-2 text-sm text-[#ccc] placeholder:text-[#555]" />
          )}
        </section>

        {/* Phone push */}
        <section className="rounded-xl border border-white/[0.06] bg-[#111] p-5">
          <label className="flex items-center justify-between">
            <span>
              <span className="block text-sm font-medium text-white">Phone push</span>
              <span className="block text-xs text-[#888]">Get a notification on your phone when something needs your attention.</span>
            </span>
            <input type="checkbox" checked={prefs.phone_push_enabled} onChange={(e) => update("phone_push_enabled", e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-[#111]" />
          </label>
        </section>

        {/* Telegram */}
        <section className="rounded-xl border border-white/[0.06] bg-[#111] p-5">
          <label className="flex items-center justify-between">
            <span>
              <span className="block text-sm font-medium text-white">Telegram</span>
              <span className="block text-xs text-[#888]">Ping me via @bailey_amarok_bot.</span>
            </span>
            <input type="checkbox" checked={prefs.telegram_enabled} onChange={(e) => update("telegram_enabled", e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-[#111]" />
          </label>
          {prefs.telegram_enabled && (
            <>
              <input type="text" value={prefs.telegram_chat_id ?? ""} onChange={(e) => update("telegram_chat_id", e.target.value)} placeholder="123456789" className="mt-3 w-full rounded-lg border border-white/[0.08] bg-[#0A0A0A] px-3 py-2 text-sm text-[#ccc] placeholder:text-[#555]" />
              <p className="mt-1 text-xs text-[#666]">Your Telegram Chat ID. Message @userinfobot to find it.</p>
            </>
          )}
        </section>

        {/* Browser push */}
        <section className="rounded-xl border border-white/[0.06] bg-[#111] p-5">
          <div className="flex items-start justify-between gap-4">
            <span>
              <span className="block text-sm font-medium text-white">Browser push</span>
              <span className="block text-xs text-[#888]">Get notifications in this browser even when the tab is in the background.</span>
              {prefs.browser_push_enabled && (
                <span className="mt-1 block text-xs text-[#61C1C4]">Active on this browser.</span>
              )}
            </span>
            {prefs.browser_push_enabled ? (
              <button onClick={disableBrowserPush} className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs text-[#ccc] hover:bg-white/[0.05]">
                Disable
              </button>
            ) : (
              <button onClick={enableBrowserPush} disabled={pushStatus === "busy"} className="shrink-0 flex items-center gap-1.5 rounded-lg border border-[#61C1C4]/30 bg-[#61C1C4]/10 px-3 py-1.5 text-xs font-semibold text-[#61C1C4] hover:bg-[#61C1C4]/20 disabled:opacity-50">
                {pushStatus === "busy" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
                {pushStatus === "busy" ? "Enabling..." : "Enable"}
              </button>
            )}
          </div>
        </section>

        {/* Webhook */}
        <section className="rounded-xl border border-white/[0.06] bg-[#111] p-5">
          <h3 className="text-sm font-medium text-white">Webhook</h3>
          <p className="mt-0.5 text-xs text-[#888]">POST a signed payload to your server when a signal fires.</p>
          <input type="url" value={prefs.webhook_url ?? ""} onChange={(e) => update("webhook_url", e.target.value)} placeholder="https://your-server.example.com/hook" className="mt-3 w-full rounded-lg border border-white/[0.08] bg-[#0A0A0A] px-3 py-2 text-sm text-[#ccc] placeholder:text-[#555]" />
          <input type="text" value={prefs.webhook_secret ?? ""} onChange={(e) => update("webhook_secret", e.target.value)} placeholder="Signing secret (optional)" className="mt-2 w-full rounded-lg border border-white/[0.08] bg-[#0A0A0A] px-3 py-2 text-sm text-[#ccc] placeholder:text-[#555]" />
          <p className="mt-1 text-xs text-[#555]">We sign every request with <code className="text-[#888]">X-UnClick-Signature: sha256=...</code></p>
          {prefs.webhook_url && (
            <button onClick={sendTestWebhook} disabled={testWebhookStatus === "busy"} className="mt-3 flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs text-[#ccc] hover:bg-white/[0.05] disabled:opacity-50">
              {testWebhookStatus === "busy" && <Loader2 className="h-3 w-3 animate-spin" />}
              {testWebhookStatus === "ok" ? "Test sent!" : testWebhookStatus === "err" ? "Test failed" : "Send test payload"}
            </button>
          )}
        </section>

        {/* Quiet hours */}
        <section className="rounded-xl border border-white/[0.06] bg-[#111] p-5">
          <h3 className="text-sm font-medium text-white">Quiet hours</h3>
          <p className="mt-0.5 text-xs text-[#888]">Notifications are held during these hours and delivered when quiet hours end.</p>
          <div className="mt-3 flex items-center gap-2 text-sm text-[#ccc]">
            <span>From</span>
            <input type="time" value={prefs.quiet_hours_start ?? ""} onChange={(e) => update("quiet_hours_start", e.target.value)} className="rounded-lg border border-white/[0.08] bg-[#0A0A0A] px-2 py-1.5" />
            <span>to</span>
            <input type="time" value={prefs.quiet_hours_end ?? ""} onChange={(e) => update("quiet_hours_end", e.target.value)} className="rounded-lg border border-white/[0.08] bg-[#0A0A0A] px-2 py-1.5" />
          </div>
        </section>

        {/* Min severity */}
        <section className="rounded-xl border border-white/[0.06] bg-[#111] p-5">
          <h3 className="text-sm font-medium text-white">What to send</h3>
          <p className="mt-0.5 text-xs text-[#888]">Pick how noisy you want this to be.</p>
          <select value={prefs.min_severity} onChange={(e) => update("min_severity", e.target.value as MinSeverity)} className="mt-3 w-full rounded-lg border border-white/[0.08] bg-[#0A0A0A] px-3 py-2 text-sm text-[#ccc]">
            <option value="info">Everything</option>
            <option value="action_needed">Actions needed and critical only</option>
            <option value="critical">Critical only</option>
          </select>
        </section>

        {/* Per-event routing */}
        <section className="rounded-xl border border-white/[0.06] bg-[#111] p-5">
          <h3 className="text-sm font-medium text-white">Per-event routing</h3>
          <p className="mt-0.5 text-xs text-[#888]">Control which channels fire for specific event types. Leave a rule off to use all enabled channels.</p>
          <p className="mt-1 text-xs text-[#555]">Format: <code className="text-[#777]">tool:action</code> - for example <code className="text-[#777]">testpass:report_closed</code></p>

          {Object.keys(prefs.routing_rules).length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {Object.entries(prefs.routing_rules).map(([key, channels]) => (
                <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-[#0A0A0A] px-3 py-2">
                  <div className="min-w-0">
                    <span className="block text-xs font-mono font-semibold text-[#ccc]">{key}</span>
                    <span className="block text-xs text-[#666]">{channels.join(", ") || "in_admin"}</span>
                  </div>
                  <button onClick={() => removeRoutingRule(key)} className="shrink-0 text-[#555] hover:text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showAddRule ? (
            <div className="mt-3 rounded-lg border border-white/[0.08] bg-[#0A0A0A] p-3 flex flex-col gap-3">
              <input value={newRuleKey} onChange={(e) => setNewRuleKey(e.target.value)} placeholder="tool:action (e.g. testpass:report_closed)" className="w-full rounded-lg border border-white/[0.08] bg-[#111] px-3 py-2 text-sm text-[#ccc] placeholder:text-[#555] font-mono" />
              <div className="flex flex-wrap gap-3">
                {ALL_CHANNELS.map((ch) => (
                  <label key={ch.id} className="flex items-center gap-1.5 text-xs text-[#ccc] cursor-pointer">
                    <input type="checkbox" checked={newRuleChannels.includes(ch.id)} onChange={() => toggleNewRuleChannel(ch.id)} className="h-3.5 w-3.5 rounded border-white/20 bg-[#111]" />
                    {ch.label}
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={addRoutingRule} disabled={!newRuleKey.trim() || newRuleChannels.length === 0} className="rounded-lg border border-[#61C1C4]/30 bg-[#61C1C4]/10 px-3 py-1.5 text-xs font-semibold text-[#61C1C4] hover:bg-[#61C1C4]/20 disabled:opacity-40">
                  Add rule
                </button>
                <button onClick={() => setShowAddRule(false)} className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs text-[#888] hover:bg-white/[0.05]">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddRule(true)} className="mt-3 flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs text-[#888] hover:bg-white/[0.05]">
              <Plus className="h-3.5 w-3.5" /> Add rule
            </button>
          )}
        </section>

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg border border-[#61C1C4]/30 bg-[#61C1C4]/10 px-4 py-2 text-sm font-semibold text-[#61C1C4] hover:bg-[#61C1C4]/20 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save settings"}
          </button>
          {saved && <span className="text-sm text-[#61C1C4]">Saved</span>}
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { useSession } from "@/lib/auth";

type MinSeverity = "info" | "action_needed" | "critical";

interface Preferences {
  email_enabled: boolean;
  email_address: string | null;
  phone_push_enabled: boolean;
  telegram_enabled: boolean;
  telegram_chat_id: string | null;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  min_severity: MinSeverity;
}

const DEFAULTS: Preferences = {
  email_enabled: false,
  email_address: "",
  phone_push_enabled: true,
  telegram_enabled: false,
  telegram_chat_id: "",
  quiet_hours_start: "",
  quiet_hours_end: "",
  min_severity: "info",
};

export default function SignalsSettings() {
  const { session } = useSession();
  const token = session?.access_token;
  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
        quiet_hours_start: p.quiet_hours_start ?? "",
        quiet_hours_end: p.quiet_hours_end ?? "",
        min_severity: p.min_severity ?? "info",
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
          quiet_hours_start: prefs.quiet_hours_start || null,
          quiet_hours_end: prefs.quiet_hours_end || null,
          min_severity: prefs.min_severity,
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
        <section className="rounded-xl border border-white/[0.06] bg-[#111] p-5">
          <label className="flex items-center justify-between">
            <span>
              <span className="block text-sm font-medium text-white">Email</span>
              <span className="block text-xs text-[#888]">Send me an email when something important happens.</span>
            </span>
            <input
              type="checkbox"
              checked={prefs.email_enabled}
              onChange={(e) => update("email_enabled", e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-[#111]"
            />
          </label>
          {prefs.email_enabled && (
            <input
              type="email"
              value={prefs.email_address ?? ""}
              onChange={(e) => update("email_address", e.target.value)}
              placeholder="you@example.com"
              className="mt-3 w-full rounded-lg border border-white/[0.08] bg-[#0A0A0A] px-3 py-2 text-sm text-[#ccc] placeholder:text-[#555]"
            />
          )}
        </section>

        <section className="rounded-xl border border-white/[0.06] bg-[#111] p-5">
          <label className="flex items-center justify-between">
            <span>
              <span className="block text-sm font-medium text-white">Phone push</span>
              <span className="block text-xs text-[#888]">Get a notification on your phone when something needs your attention.</span>
            </span>
            <input
              type="checkbox"
              checked={prefs.phone_push_enabled}
              onChange={(e) => update("phone_push_enabled", e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-[#111]"
            />
          </label>
        </section>

        <section className="rounded-xl border border-white/[0.06] bg-[#111] p-5">
          <label className="flex items-center justify-between">
            <span>
              <span className="block text-sm font-medium text-white">Telegram</span>
              <span className="block text-xs text-[#888]">Ping me in Telegram.</span>
            </span>
            <input
              type="checkbox"
              checked={prefs.telegram_enabled}
              onChange={(e) => update("telegram_enabled", e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-[#111]"
            />
          </label>
          {prefs.telegram_enabled && (
            <>
              <input
                type="text"
                value={prefs.telegram_chat_id ?? ""}
                onChange={(e) => update("telegram_chat_id", e.target.value)}
                placeholder="123456789"
                className="mt-3 w-full rounded-lg border border-white/[0.08] bg-[#0A0A0A] px-3 py-2 text-sm text-[#ccc] placeholder:text-[#555]"
              />
              <p className="mt-1 text-xs text-[#666]">Your Telegram Chat ID (available from @userinfobot)</p>
            </>
          )}
        </section>

        <section className="rounded-xl border border-white/[0.06] bg-[#111] p-5">
          <h3 className="text-sm font-medium text-white">Quiet hours</h3>
          <p className="mt-0.5 text-xs text-[#888]">Do not disturb me during these hours.</p>
          <div className="mt-3 flex items-center gap-2 text-sm text-[#ccc]">
            <span>Do not disturb from</span>
            <input
              type="time"
              value={prefs.quiet_hours_start ?? ""}
              onChange={(e) => update("quiet_hours_start", e.target.value)}
              className="rounded-lg border border-white/[0.08] bg-[#0A0A0A] px-2 py-1.5"
            />
            <span>to</span>
            <input
              type="time"
              value={prefs.quiet_hours_end ?? ""}
              onChange={(e) => update("quiet_hours_end", e.target.value)}
              className="rounded-lg border border-white/[0.08] bg-[#0A0A0A] px-2 py-1.5"
            />
          </div>
        </section>

        <section className="rounded-xl border border-white/[0.06] bg-[#111] p-5">
          <h3 className="text-sm font-medium text-white">What to send</h3>
          <p className="mt-0.5 text-xs text-[#888]">Pick how noisy you want this to be.</p>
          <select
            value={prefs.min_severity}
            onChange={(e) => update("min_severity", e.target.value as MinSeverity)}
            className="mt-3 w-full rounded-lg border border-white/[0.08] bg-[#0A0A0A] px-3 py-2 text-sm text-[#ccc]"
          >
            <option value="info">Everything</option>
            <option value="action_needed">Actions needed and critical only</option>
            <option value="critical">Critical only</option>
          </select>
        </section>

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg border border-[#61C1C4]/30 bg-[#61C1C4]/10 px-4 py-2 text-sm font-semibold text-[#61C1C4] hover:bg-[#61C1C4]/20 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save settings"}
          </button>
          {saved && <span className="text-sm text-[#61C1C4]">Saved</span>}
        </div>
      </div>
    </div>
  );
}

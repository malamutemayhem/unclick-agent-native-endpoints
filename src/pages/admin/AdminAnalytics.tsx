/**
 * AdminAnalytics - PostHog dashboard cockpit at /admin/analytics
 *
 * Admin-only (ADMIN_EMAILS gate enforced server-side on every data
 * request; the page itself redirects non-admins to /admin/you).
 *
 * Embeds 5 PostHog shared dashboards via iframe. Embed URLs are
 * stored in VITE_POSTHOG_DASHBOARD_* env vars (baked in at build
 * time - they are public PostHog share links, not secrets).
 *
 * Chunk 2 additions (not yet): session replay, cohort editor.
 */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "@/lib/auth";
import {
  BarChart3,
  ExternalLink,
  Loader2,
  Lock,
  RefreshCw,
} from "lucide-react";

// ── Dashboard config ──────────────────────────────────────────────
// Embed URLs come from VITE_ env vars set in Vercel.
// Fallback to empty string so the page degrades gracefully if not yet
// configured (shows placeholder iframes with a setup notice).

const DASHBOARDS = [
  {
    key:   "core",
    label: "UnClick Core",
    desc:  "Signup funnel, signin funnel, DAU, WAU",
    url:   import.meta.env.VITE_POSTHOG_DASHBOARD_CORE ?? "",
  },
  {
    key:   "tools",
    label: "Tool Usage",
    desc:  "Top tools by call count, volume over time",
    url:   import.meta.env.VITE_POSTHOG_DASHBOARD_TOOLS ?? "",
  },
  {
    key:   "auth",
    label: "Auth Methods",
    desc:  "Signups and signins by method (magic / Google / Azure)",
    url:   import.meta.env.VITE_POSTHOG_DASHBOARD_AUTH ?? "",
  },
  {
    key:   "cohorts",
    label: "Admin vs Regular Users",
    desc:  "Event volume split by user type",
    url:   import.meta.env.VITE_POSTHOG_DASHBOARD_COHORTS ?? "",
  },
  {
    key:   "retention",
    label: "Retention",
    desc:  "Weekly user retention from first sign-up",
    url:   import.meta.env.VITE_POSTHOG_DASHBOARD_RETENTION ?? "",
  },
] as const;

const POSTHOG_APP = "https://us.posthog.com/project/391352/dashboards";

const HEALTH_CHECKS = [
  {
    label: "Key present",
    detail: "Vercel build includes a PostHog key, but the value is never shown here.",
  },
  {
    label: "Host expected",
    detail: "Browser network traffic should target the configured PostHog ingest host.",
  },
  {
    label: "Pageview receipt",
    detail: "A recent public route visit should emit one $pageview event.",
  },
  {
    label: "Dashboard filters",
    detail: "PostHog date, path, and project filters should match the surface being tested.",
  },
] as const;

// ── Component ─────────────────────────────────────────────────────

export default function AdminAnalytics() {
  const { session, user } = useSession();
  const navigate = useNavigate();

  const [adminVerified, setAdminVerified] = useState<boolean | null>(null);
  const [activeDash, setActiveDash]       = useState<string>("core");
  const [iframeKey, setIframeKey]         = useState(0); // bump to force reload

  // Verify admin status via the backend (ADMIN_EMAILS check).
  // We call /api/build?action=list_projects as a convenient admin-only
  // endpoint. If it 403s the user is not admin - redirect to /admin/you.
  // Any other error (e.g. Vibe Kanban not configured) still tells us
  // they are admin, so we proceed.
  useEffect(() => {
    if (!session) return;
    fetch("/api/memory-admin?action=admin_profile", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((body) => {
        const isAdmin = Boolean((body as { is_admin?: boolean }).is_admin);
        setAdminVerified(isAdmin);
        if (!isAdmin) navigate("/admin/you", { replace: true });
      })
      .catch(() => setAdminVerified(true)); // network error - assume allowed
  }, [session, navigate]);

  const configured = DASHBOARDS.some((d) => d.url);
  const current    = DASHBOARDS.find((d) => d.key === activeDash) ?? DASHBOARDS[0];

  if (adminVerified === null) {
    return (
      <div className="flex items-center gap-2 py-12 text-[#666]">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Verifying access...</span>
      </div>
    );
  }

  if (!adminVerified) {
    return (
      <div className="flex items-center gap-2 py-12 text-[#666]">
        <Lock className="h-4 w-4" />
        <span className="text-sm">Admin access required</span>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Analytics</h1>
          <p className="mt-1 text-sm text-[#888]">PostHog dashboards for UnClick</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIframeKey((k) => k + 1)}
            className="flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-[#888] transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <a
            href={POSTHOG_APP}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-[#888] transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open PostHog
          </a>
        </div>
      </div>

      {!configured && (
        <div className="mb-6 rounded-xl border border-[#E2B93B]/20 bg-[#E2B93B]/5 p-4 text-xs text-[#888]">
          <p className="font-medium text-[#E2B93B]">Dashboard embed URLs not configured</p>
          <p className="mt-1">
            Add <code className="rounded bg-white/[0.06] px-1 py-0.5">VITE_POSTHOG_DASHBOARD_*</code> env
            vars to Vercel and redeploy. The URLs were printed by{" "}
            <code className="rounded bg-white/[0.06] px-1 py-0.5">scripts/posthog-setup.mjs</code>.
          </p>
        </div>
      )}

      <div className="mb-6 rounded-xl border border-[#61C1C4]/20 bg-[#61C1C4]/5 p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[#61C1C4]">Analytics health is untested by default</p>
            <p className="mt-1 max-w-2xl text-xs text-[#888]">
              Treat analytics as healthy only after a fresh browser or receipt check proves capture.
              Key presence and dashboard embeds are setup hints, not proof.
            </p>
          </div>
          <span className="mt-2 rounded-full border border-[#E2B93B]/30 bg-[#E2B93B]/10 px-2.5 py-1 text-[11px] font-medium text-[#E2B93B] sm:mt-0">
            Untested until receipt
          </span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {HEALTH_CHECKS.map((check) => (
            <div key={check.label} className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
              <p className="text-xs font-medium text-[#ddd]">{check.label}</p>
              <p className="mt-1 text-[11px] leading-5 text-[#777]">{check.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Dashboard tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-[#111111] p-1">
        {DASHBOARDS.map((d) => (
          <button
            key={d.key}
            onClick={() => setActiveDash(d.key)}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              activeDash === d.key
                ? "bg-[#61C1C4]/10 text-[#61C1C4]"
                : "text-[#666] hover:bg-white/[0.04] hover:text-[#ccc]"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Active dashboard description */}
      <p className="mb-3 text-xs text-[#666]">{current.desc}</p>

      {/* Iframe */}
      <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#111111]">
        {current.url ? (
          <iframe
            key={`${current.key}-${iframeKey}`}
            src={current.url}
            className="h-[680px] w-full border-0"
            title={current.label}
            allow="fullscreen"
            loading="lazy"
          />
        ) : (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <BarChart3 className="h-8 w-8 text-[#333]" />
            <p className="text-sm text-[#555]">{current.label} embed URL not set</p>
            <p className="text-xs text-[#444]">
              Set{" "}
              <code className="rounded bg-white/[0.04] px-1 text-[#666]">
                VITE_POSTHOG_DASHBOARD_{current.key.toUpperCase()}
              </code>{" "}
              in Vercel
            </p>
          </div>
        )}
      </div>

      {/* Footer links */}
      <div className="mt-4 flex items-center justify-between text-[11px] text-[#555]">
        <span>
          Data from{" "}
          <a href={POSTHOG_APP} target="_blank" rel="noreferrer" className="text-[#61C1C4] hover:underline">
            PostHog project 391352
          </a>
        </span>
        <Link to="/admin/activity" className="hover:text-[#888]">
          Activity log
        </Link>
      </div>
    </div>
  );
}

/**
 * AdminShell - OS shell layout for the five admin surfaces.
 *
 * Persistent sidebar (desktop) or top nav (tablet) with surface icons,
 * user avatar/email, logout. Floating chat assistant stub in the
 * bottom-right corner. Content rendered via React Router <Outlet>.
 *
 * Dark palette: bg #0A0A0A, primary teal #61C1C4, secondary amber #E2B93B.
 * Each surface is extractable as a native app later.
 */

import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useSession, signOut } from "@/lib/auth";
import {
  User,
  Brain,
  KeyRound,
  Wrench,
  Activity,
  Settings,
  LogOut,
  MessageCircle,
  X,
  Menu,
} from "lucide-react";

const surfaces = [
  { path: "/admin/you", label: "You", icon: User },
  { path: "/admin/memory", label: "Memory", icon: Brain },
  { path: "/admin/keychain", label: "Keychain", icon: KeyRound },
  { path: "/admin/tools", label: "Tools", icon: Wrench },
  { path: "/admin/activity", label: "Activity", icon: Activity },
  { path: "/admin/settings", label: "Settings", icon: Settings },
] as const;

function SurfaceLink({ path, label, icon: Icon, onClick }: {
  path: string;
  label: string;
  icon: typeof User;
  onClick?: () => void;
}) {
  return (
    <NavLink
      to={path}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive
            ? "bg-[#61C1C4]/10 text-[#61C1C4]"
            : "text-[#888] hover:bg-white/[0.04] hover:text-[#ccc]"
        }`
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </NavLink>
  );
}

export default function AdminShell() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  async function handleLogout() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-[#0A0A0A] text-[#ccc]">
      {/* ── Desktop sidebar (md+) ──────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-white/[0.06] bg-[#0A0A0A] md:flex">
        <div className="flex h-14 items-center px-5">
          <Link to="/">
            <img
              src="/logo-wordmark.svg"
              alt="UnClick"
              style={{ height: "2.5rem" }}
              className="w-auto"
            />
          </Link>
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-1 px-3">
          {surfaces.map((s) => (
            <SurfaceLink key={s.path} {...s} />
          ))}
          <a
            href="/memory"
            className="text-white/30 hover:text-white/50 text-xs block px-3 py-2"
          >
            How it works →
          </a>
        </nav>

        <div className="border-t border-white/[0.06] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#61C1C4]/10 text-[#61C1C4]">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-[#ccc]">
                {user?.email ?? "Unknown"}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-md p-1.5 text-[#666] transition-colors hover:bg-white/[0.04] hover:text-[#ccc]"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile/tablet top bar (<md) ────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#0A0A0A] px-4 md:hidden">
        <Link to="/">
          <img
            src="/logo-wordmark.svg"
            alt="UnClick"
            style={{ height: "2rem" }}
            className="w-auto"
          />
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={handleLogout}
            className="rounded-md p-2 text-[#666] hover:text-[#ccc]"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
          <button
            onClick={() => setMobileNavOpen((v) => !v)}
            className="rounded-md p-2 text-[#888] hover:text-[#ccc]"
          >
            {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-x-0 top-14 z-30 border-b border-white/[0.06] bg-[#0A0A0A] p-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {surfaces.map((s) => (
              <SurfaceLink
                key={s.path}
                {...s}
                onClick={() => setMobileNavOpen(false)}
              />
            ))}
          </nav>
          <div className="mt-2 border-t border-white/[0.06] pt-2">
            <p className="truncate px-3 text-xs text-[#666]">
              {user?.email ?? "Unknown"}
            </p>
          </div>
        </div>
      )}

      {/* ── Main content ───────────────────────────────────────────── */}
      <main className="min-h-screen flex-1 pt-14 md:ml-56 md:pt-0">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>

      {/* ── Floating chat assistant placeholder ────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50">
        {chatOpen && (
          <div className="mb-3 w-72 rounded-2xl border border-white/[0.08] bg-[#111111] p-4 shadow-2xl sm:w-80">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#ccc]">Assistant</h3>
              <button
                onClick={() => setChatOpen(false)}
                className="rounded-md p-1 text-[#666] hover:text-[#ccc]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 flex flex-col items-center justify-center py-8">
              <MessageCircle className="h-8 w-8 text-[#61C1C4]/40" />
              <p className="mt-3 text-xs text-[#666]">Coming soon</p>
              <p className="mt-1 text-[10px] text-[#444]">
                Your AI assistant will live here
              </p>
            </div>
          </div>
        )}
        <button
          onClick={() => setChatOpen((v) => !v)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#61C1C4] text-black shadow-lg transition-transform hover:scale-105 active:scale-95"
          aria-label="Open assistant"
        >
          <MessageCircle className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

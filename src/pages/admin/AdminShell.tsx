/**
 * AdminShell - OS shell layout for the admin surfaces.
 *
 * Persistent sidebar (desktop) or top nav (tablet) with surface icons,
 * a global Ctrl+K search bar in the header, user avatar/email, logout.
 * Content rendered via React Router <Outlet>.
 *
 * Dark palette: bg #0A0A0A, primary teal #61C1C4, secondary amber #E2B93B.
 * Each surface is extractable as a native app later.
 */

import { useState, useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useSession, signOut } from "@/lib/auth";
import AdminSearchBar from "@/components/admin/AdminSearchBar";
import BugReportButton from "@/components/admin/BugReportButton";
import MemoryHealthPill from "@/components/admin/MemoryHealthPill";
import {
  User,
  Brain,
  KeyRound,
  Wrench,
  Activity,
  Settings,
  LogOut,
  X,
  Menu,
  Bot,
  BarChart3,
  ChevronRight,
  ChevronDown,
  FileText,
  Clock,
  Fingerprint,
  Sparkles,
  BookOpen,
} from "lucide-react";

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

const MEMORY_TABS = [
  { id: "brain-map", label: "Brain Map", icon: Sparkles   },
  { id: "facts",     label: "Facts",     icon: FileText   },
  { id: "sessions",  label: "Sessions",  icon: Clock      },
  { id: "library",   label: "Library",   icon: BookOpen   },
  { id: "activity",  label: "Activity",  icon: Activity   },
  { id: "identity",  label: "Identity",  icon: Fingerprint },
] as const;

function MemoryNavItem({ onClick }: { onClick?: () => void }) {
  const location = useLocation();
  const isMemory = location.pathname === "/admin/memory";
  const activeTab = new URLSearchParams(location.search).get("tab") ?? "brain-map";

  return (
    <div>
      <NavLink
        to="/admin/memory"
        onClick={onClick}
        className={({ isActive }) =>
          `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive
              ? "bg-[#61C1C4]/10 text-[#61C1C4]"
              : "text-[#888] hover:bg-white/[0.04] hover:text-[#ccc]"
          }`
        }
      >
        <Brain className="h-4 w-4 shrink-0" />
        <span className="flex-1">Memory</span>
        {isMemory
          ? <ChevronDown className="h-3 w-3 shrink-0" />
          : <ChevronRight className="h-3 w-3 shrink-0" />}
      </NavLink>
      {isMemory && (
        <div className="ml-7 mt-0.5 flex flex-col gap-0.5">
          {MEMORY_TABS.map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              to={`/admin/memory?tab=${id}`}
              onClick={onClick}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === id
                  ? "bg-[#61C1C4]/10 text-[#61C1C4]"
                  : "text-[#666] hover:bg-white/[0.04] hover:text-[#aaa]"
              }`}
            >
              <Icon className="h-3 w-3 shrink-0" />
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminShell() {
  const { user, session } = useSession();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;
    let cancelled = false;
    fetch("/api/memory-admin?action=admin_profile", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!cancelled && body) setIsAdmin(Boolean(body.is_admin));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [session?.access_token]);

  async function handleLogout() {
    await signOut();
    navigate("/login", { replace: true });
  }

  function SidebarNav({ onLinkClick }: { onLinkClick?: () => void }) {
    return (
      <>
        <SurfaceLink path="/admin/you"      label="You"                      icon={User}    onClick={onLinkClick} />
        <MemoryNavItem onClick={onLinkClick} />
        <SurfaceLink path="/admin/keychain" label="Keychain (BackstagePass)" icon={KeyRound} onClick={onLinkClick} />
        <SurfaceLink path="/admin/tools"    label="Tools"                    icon={Wrench}   onClick={onLinkClick} />
        <SurfaceLink path="/admin/activity" label="Activity"                 icon={Activity} onClick={onLinkClick} />
        <SurfaceLink path="/admin/agents"    label="Agents"                   icon={Bot}       onClick={onLinkClick} />
        {isAdmin && <SurfaceLink path="/admin/analytics" label="Analytics"               icon={BarChart3} onClick={onLinkClick} />}
        <SurfaceLink path="/admin/settings" label="Settings"                 icon={Settings}  onClick={onLinkClick} />
      </>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0A0A0A] text-[#ccc]">
      {/* ── Desktop sidebar (md+) ──────────────────────────── */}
      <aside className="fixed left-0 z-40 hidden w-56 flex-col border-r border-white/[0.06] bg-[#0A0A0A] md:flex" style={{ top: "var(--bbn-h, 0px)", bottom: 0 }}>
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

        <nav className="mt-4 flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          <SidebarNav />
          <a
            href="/memory"
            className="text-white/30 hover:text-white/50 text-xs block px-3 py-2"
          >
            How it works →
          </a>
        </nav>

        <div className="border-t border-white/[0.06] p-3">
          <BugReportButton />
        </div>

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

      {/* ── Desktop top bar (md+) with global search ───────────── */}
      <header className="fixed inset-x-0 z-30 hidden h-14 items-center border-b border-white/[0.06] bg-[#0A0A0A] md:flex md:pl-56" style={{ top: "var(--bbn-h, 0px)" }}>
        <div className="flex flex-1 items-center gap-3 px-4 lg:px-8">
          <div className="flex-1">
            <AdminSearchBar />
          </div>
          <MemoryHealthPill />
        </div>
      </header>

      {/* ── Mobile/tablet top bar (<md) ────────────────────── */}
      <header className="fixed inset-x-0 z-40 flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#0A0A0A] px-4 md:hidden" style={{ top: "var(--bbn-h, 0px)" }}>
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
        <div className="fixed inset-x-0 z-30 border-b border-white/[0.06] bg-[#0A0A0A] p-3 md:hidden" style={{ top: "calc(var(--bbn-h, 0px) + 56px)" }}>
          <div className="mb-3">
            <AdminSearchBar />
          </div>
          <nav className="flex flex-col gap-1">
            <SidebarNav onLinkClick={() => setMobileNavOpen(false)} />
          </nav>
          <div className="mt-3 border-t border-white/[0.06] pt-3">
            <BugReportButton />
          </div>
          <div className="mt-2 border-t border-white/[0.06] pt-2">
            <p className="truncate px-3 text-xs text-[#666]">
              {user?.email ?? "Unknown"}
            </p>
          </div>
        </div>
      )}

      {/* ── Main content ────────────────────────────────── */}
      <main className="min-h-screen flex-1 md:ml-56" style={{ paddingTop: "calc(var(--bbn-h, 0px) + 56px)" }}>
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

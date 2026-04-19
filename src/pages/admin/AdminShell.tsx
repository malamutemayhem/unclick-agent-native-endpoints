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

import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useSession, signOut } from "@/lib/auth";
import AdminSearchBar from "@/components/admin/AdminSearchBar";
import BugReportButton from "@/components/admin/BugReportButton";
import MemoryHealthPill from "@/components/admin/MemoryHealthPill";
import { ProjectProvider, useProject } from "@/lib/project-context";
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
  FolderKanban,
} from "lucide-react";

const surfaces = [
  { path: "/admin/you", label: "You", icon: User },
  { path: "/admin/projects", label: "Projects", icon: FolderKanban },
  { path: "/admin/memory", label: "Memory", icon: Brain },
  { path: "/admin/keychain", label: "Keychain", icon: KeyRound },
  { path: "/admin/tools", label: "Tools", icon: Wrench },
  { path: "/admin/activity", label: "Activity", icon: Activity },
  { path: "/admin/settings", label: "Settings", icon: Settings },
] as const;

function ProjectSwitcher() {
  const { projects, activeSlug, setActiveSlug } = useProject();
  if (projects.length === 0) return null;
  return (
    <select
      value={activeSlug ?? ""}
      onChange={(e) => setActiveSlug(e.target.value || null)}
      className="w-full rounded-md border border-white/[0.08] bg-[#111] px-2 py-1.5 text-xs text-[#ccc] focus:border-[#61C1C4] focus:outline-none"
      aria-label="Active project"
    >
      <option value="">All Projects</option>
      {projects.map((p) => (
        <option key={p.id} value={p.slug}>
          {p.name}
          {p.is_default ? " (default)" : ""}
        </option>
      ))}
    </select>
  );
}

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
  return (
    <ProjectProvider>
      <AdminShellInner />
    </ProjectProvider>
  );
}

function AdminShellInner() {
  const { user } = useSession();
  const navigate = useNavigate();
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

        <div className="px-3 pb-2 pt-3">
          <ProjectSwitcher />
        </div>

        <nav className="mt-1 flex flex-1 flex-col gap-1 px-3">
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

      {/* ── Desktop top bar (md+) with global search ───────────────── */}
      <header className="fixed inset-x-0 top-0 z-30 hidden h-14 items-center border-b border-white/[0.06] bg-[#0A0A0A] md:flex md:pl-56">
        <div className="flex flex-1 items-center gap-3 px-4 lg:px-8">
          <div className="flex-1">
            <AdminSearchBar />
          </div>
          <MemoryHealthPill />
        </div>
      </header>

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
          <div className="mb-3">
            <AdminSearchBar />
          </div>
          <div className="mb-3">
            <ProjectSwitcher />
          </div>
          <nav className="flex flex-col gap-1">
            {surfaces.map((s) => (
              <SurfaceLink
                key={s.path}
                {...s}
                onClick={() => setMobileNavOpen(false)}
              />
            ))}
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

      {/* ── Main content ───────────────────────────────────────────── */}
      <main className="min-h-screen flex-1 pt-14 md:ml-56 md:pt-14">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

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

import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSession, signOut } from "@/lib/auth";
import AdminSearchBar from "@/components/admin/AdminSearchBar";
import BugReportButton from "@/components/admin/BugReportButton";
import MemoryHealthPill from "@/components/admin/MemoryHealthPill";
import {
  User,
  Brain,
  Sparkles,
  Lightbulb,
  Clock,
  Fingerprint,
  FolderKanban,
  Code,
  Activity,
  Bot,
  Wrench,
  Settings,
  LogOut,
  X,
  Menu,
} from "lucide-react";

type LucideIcon = typeof User;

interface SurfaceChild {
  path: string;
  label: string;
  icon: LucideIcon;
}

interface Surface {
  path: string;
  label: string;
  icon: LucideIcon;
  children?: SurfaceChild[];
}

const surfaces: Surface[] = [
  { path: "/admin/account", label: "Account", icon: User },
  {
    path: "/admin/memory/map",
    label: "Memory",
    icon: Brain,
    children: [
      { path: "/admin/memory/map", label: "Brain Map", icon: Sparkles },
      { path: "/admin/memory/knowledge", label: "Knowledge", icon: Lightbulb },
      { path: "/admin/memory/sessions", label: "Sessions", icon: Clock },
      { path: "/admin/memory/identity", label: "Identity", icon: Fingerprint },
      { path: "/admin/memory/projects", label: "Projects", icon: FolderKanban },
      { path: "/admin/memory/codebase", label: "Codebase", icon: Code },
      { path: "/admin/memory/timeline", label: "Timeline", icon: Activity },
    ],
  },
  { path: "/admin/agents", label: "Agents", icon: Bot },
  { path: "/admin/tools", label: "Tools", icon: Wrench },
  { path: "/admin/settings", label: "Settings", icon: Settings },
];

function isMemoryActive(pathname: string): boolean {
  return pathname.startsWith("/admin/memory");
}

function ParentLink({
  surface,
  memoryActive,
  onClick,
}: {
  surface: Surface;
  memoryActive: boolean;
  onClick?: () => void;
}) {
  const Icon = surface.icon;
  const isMemoryParent = surface.label === "Memory";
  const forceActive = isMemoryParent && memoryActive;

  return (
    <NavLink
      to={surface.path}
      onClick={onClick}
      end={!isMemoryParent}
      className={({ isActive }) => {
        const active = forceActive || isActive;
        return `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          active
            ? "bg-[#61C1C4]/10 text-[#61C1C4]"
            : "text-[#888] hover:bg-white/[0.04] hover:text-[#ccc]"
        }`;
      }}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{surface.label}</span>
    </NavLink>
  );
}

function ChildLink({
  child,
  onClick,
}: {
  child: SurfaceChild;
  onClick?: () => void;
}) {
  const Icon = child.icon;
  return (
    <NavLink
      to={child.path}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg pl-8 pr-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? "bg-[#61C1C4]/10 text-[#61C1C4]"
            : "text-[#888] hover:bg-white/[0.04] hover:text-[#ccc]"
        }`
      }
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{child.label}</span>
    </NavLink>
  );
}

function SurfaceGroup({
  surface,
  pathname,
  onChildClick,
}: {
  surface: Surface;
  pathname: string;
  onChildClick?: () => void;
}) {
  const memoryActive = isMemoryActive(pathname);
  const expanded = surface.label === "Memory" && memoryActive;

  return (
    <div className="flex flex-col">
      <ParentLink
        surface={surface}
        memoryActive={memoryActive}
        onClick={onChildClick}
      />
      {surface.children && expanded && (
        <div className="mt-1 flex flex-col gap-0.5">
          {surface.children.map((c) => (
            <ChildLink key={c.path} child={c} onClick={onChildClick} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminShell() {
  const { user } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-[#0A0A0A] text-[#ccc]">
      {/* -- Desktop sidebar (md+) -- */}
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

        <nav className="mt-4 flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4">
          {surfaces.map((s) => (
            <SurfaceGroup
              key={s.path}
              surface={s}
              pathname={location.pathname}
            />
          ))}
          <a
            href="/memory"
            className="text-white/30 hover:text-white/50 text-xs block px-3 py-2"
          >
            How it works {"->"}
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

      {/* -- Desktop top bar (md+) with global search -- */}
      <header className="fixed inset-x-0 top-0 z-30 hidden h-14 items-center border-b border-white/[0.06] bg-[#0A0A0A] md:flex md:pl-56">
        <div className="flex flex-1 items-center gap-3 px-4 lg:px-8">
          <div className="flex-1">
            <AdminSearchBar />
          </div>
          <MemoryHealthPill />
        </div>
      </header>

      {/* -- Mobile/tablet top bar (<md) -- */}
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
        <div className="fixed inset-x-0 top-14 z-30 max-h-[calc(100vh-3.5rem)] overflow-y-auto border-b border-white/[0.06] bg-[#0A0A0A] p-3 md:hidden">
          <div className="mb-3">
            <AdminSearchBar />
          </div>
          <nav className="flex flex-col gap-1">
            {surfaces.map((s) => (
              <SurfaceGroup
                key={s.path}
                surface={s}
                pathname={location.pathname}
                onChildClick={() => setMobileNavOpen(false)}
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

      {/* -- Main content -- */}
      <main className="min-h-screen flex-1 pt-14 md:ml-56 md:pt-14">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

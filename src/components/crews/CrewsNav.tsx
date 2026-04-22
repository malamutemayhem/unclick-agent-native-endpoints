import { NavLink } from "react-router-dom";
import { LayoutGrid, PlusCircle, History, Settings } from "lucide-react";

const NAV_ITEMS = [
  { to: "/admin/crews",          label: "Templates",  icon: LayoutGrid,  end: true },
  { to: "/admin/crews/new",      label: "Compose",    icon: PlusCircle,  end: false },
  { to: "/admin/crews/runs",     label: "Runs",       icon: History,     end: false },
  { to: "/admin/crews/settings", label: "Settings",   icon: Settings,    end: false },
] as const;

export default function CrewsNav() {
  return (
    <nav className="mb-6 flex items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-1">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:flex-initial sm:justify-start ${
              isActive
                ? "bg-[#61C1C4]/10 text-[#61C1C4]"
                : "text-[#777] hover:bg-white/[0.04] hover:text-[#bbb]"
            }`
          }
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

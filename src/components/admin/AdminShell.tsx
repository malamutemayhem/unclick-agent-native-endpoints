/**
 * AdminShell - shared layout wrapper for admin pages.
 *
 * Renders the top Navbar + Footer plus a left sidebar with links to the
 * admin sections (You, Workers, Memory, Apps, Passport, Activity, Settings).
 * Pages render inside the right pane.
 */

import { Link, useLocation } from "react-router-dom";
import { type ReactNode } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  User as UserIcon,
  Bot,
  Brain,
  Wrench,
  KeyRound,
  Activity,
  Settings as SettingsIcon,
} from "lucide-react";

interface SidebarItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  matchPrefix?: string;
}

interface AdminShellProps {
  title: string;
  subtitle?: string;
  agentCount?: number;
  children: ReactNode;
}

export default function AdminShell({ title, subtitle, agentCount, children }: AdminShellProps) {
  const location = useLocation();
  const path = location.pathname;

  const items: SidebarItem[] = [
    { label: "You", to: "/settings", icon: UserIcon, matchPrefix: "/settings" },
    {
      label: "Workers",
      to: "/admin/agents",
      icon: Bot,
      badge: agentCount,
      matchPrefix: "/admin/agents",
    },
    { label: "Memory", to: "/memory/admin", icon: Brain, matchPrefix: "/memory" },
    { label: "Apps", to: "/tools", icon: Wrench, matchPrefix: "/tools" },
    { label: "Passport", to: "/admin/keychain", icon: KeyRound, matchPrefix: "/admin/keychain" },
    { label: "Activity", to: "/dispatch", icon: Activity, matchPrefix: "/dispatch" },
    { label: "Settings", to: "/settings", icon: SettingsIcon, matchPrefix: "/settings" },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 pb-32 pt-24">
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <aside className="md:sticky md:top-24 md:h-fit">
            <nav className="rounded-xl border border-border/40 bg-card/20 p-2">
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.matchPrefix
                    ? path.startsWith(item.matchPrefix)
                    : path === item.to;
                  return (
                    <li key={`${item.label}-${item.to}`}>
                      <Link
                        to={item.to}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-body hover:bg-card/40 hover:text-heading"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {typeof item.badge === "number" && item.badge > 0 && (
                          <span className="inline-flex min-w-[20px] items-center justify-center rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>

          <section>
            <header className="mb-6">
              <h1 className="text-2xl font-semibold tracking-tight text-heading">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-body">{subtitle}</p>}
            </header>
            {children}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

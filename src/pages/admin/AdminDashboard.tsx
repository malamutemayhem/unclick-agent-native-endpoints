import { Link } from "react-router-dom";
import {
  AppWindow,
  Brain,
  ClipboardCheck,
  KeyRound,
  LayoutDashboard,
  Plane,
  ReceiptText,
  ShieldCheck,
  Users,
} from "lucide-react";

const overview = [
  {
    title: "Autopilot",
    body: "The assembly line for research, planning, building, testing, review, merge, publish, repair, and improvement.",
    href: "/admin/autopilot",
    icon: Plane,
  },
  {
    title: "Apps",
    body: "Built-in tools, connected apps, disabled apps, and services waiting for login or API keys.",
    href: "/admin/tools",
    icon: AppWindow,
  },
  {
    title: "Memory",
    body: "Saved facts, library items, chats, files, project briefs, preferences, and recall checks.",
    href: "/admin/memory",
    icon: Brain,
  },
  {
    title: "Passport",
    body: "The permission layer: OAuth, API keys, browser extension, password bridge, permissions, and login issues.",
    href: "/admin/keychain",
    icon: KeyRound,
  },
];

const needsYou = [
  "Review apps that need login or an API key",
  "Check Autopilot blockers before merge or publish",
  "Run Recall Check when an AI forgets important context",
];

export default function AdminDashboard() {
  return (
    <div>
      <div className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#61C1C4]/30 bg-[#61C1C4]/10 px-3 py-1 text-xs font-medium text-[#61C1C4]">
          <LayoutDashboard className="h-3.5 w-3.5" />
          UnClick overview
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
          A simple control panel for what UnClick knows, what it can use, what is running,
          and what needs your attention.
        </p>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-[#61C1C4]/25 bg-[#61C1C4]/[0.06] p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#61C1C4]/15 text-[#61C1C4]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Command and control first</h2>
              <p className="mt-2 text-sm leading-6 text-white/60">
                UnClick Autopilot is designed around visible approvals, proof, receipts, and a clear
                stop path before agents can do real work.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/admin/ledger" className="rounded-md bg-[#61C1C4] px-3 py-1.5 text-xs font-semibold text-black">
                  View Ledger
                </Link>
                <Link to="/admin/autopilot" className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/75 hover:bg-white/[0.04]">
                  Open Autopilot
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.06] bg-[#111] p-6">
          <h2 className="text-sm font-semibold text-white">What needs you</h2>
          <ul className="mt-4 space-y-3">
            {needsYou.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-white/60">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#E2B93B]" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {overview.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.title}
              to={item.href}
              className="rounded-2xl border border-white/[0.06] bg-[#111] p-5 transition-colors hover:border-[#61C1C4]/30 hover:bg-white/[0.04]"
            >
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#61C1C4]/10 text-[#61C1C4]">
                  <Icon className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-semibold text-white">{item.title}</h2>
              </div>
              <p className="text-sm leading-6 text-white/55">{item.body}</p>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <MiniStat icon={Users} label="Workers" value="Role based" />
        <MiniStat icon={ClipboardCheck} label="Checks" value="XPass proof" />
        <MiniStat icon={ReceiptText} label="Ledger" value="Receipts kept" />
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/35">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

import {
  AppWindow,
  BadgeCheck,
  Brain,
  CreditCard,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  ListTodo,
  MessagesSquare,
  Plane,
  ReceiptText,
  Settings,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";

type Node = {
  label: string;
  note: string;
  children?: Node[];
};

const TREE: Node[] = [
  {
    label: "Dashboard",
    note: "simple overview of what is happening across UnClick",
  },
  {
    label: "You",
    note: "account and personal preferences",
    children: [
      { label: "Profile", note: "email, name, basic identity" },
      { label: "AI Style", note: "how UnClick should talk to you" },
      { label: "Access", note: "API key, plan, tier, account status" },
    ],
  },
  {
    label: "Memory",
    note: "what UnClick remembers",
    children: [
      { label: "Saved Facts", note: "quick remembered facts" },
      { label: "Library", note: "curated memories with categories and tags" },
      { label: "Chats", note: "conversation history and useful chat context" },
      { label: "Files & Notes", note: "uploaded files, notes, docs, references" },
      { label: "Project Briefs", note: "project-specific memory summaries" },
      { label: "Preferences", note: "mirrored preferences from You / AI Style" },
      { label: "Recall Check", note: "action button to test recall quality" },
    ],
  },
  {
    label: "Apps",
    note: "what UnClick can use",
    children: [
      { label: "Built-In", note: "works straight away" },
      { label: "Connected", note: "apps approved by the user" },
      { label: "Turned Off", note: "apps available but disabled" },
      { label: "Needs Login", note: "waiting for sign-in" },
      { label: "Needs API Key", note: "waiting for a pasted key" },
      { label: "Private Tools", note: "plumbing only, hidden/off at first" },
      { label: "Marketplace", note: "plumbing only, hidden/off at first" },
    ],
  },
  {
    label: "Passport",
    note: "how UnClick gets permission",
    children: [
      { label: "OAuth", note: "sign in with Google, GitHub, etc." },
      { label: "API Keys", note: "developer and service keys" },
      { label: "Browser Extension", note: "approved browser/session access" },
      { label: "Password Bridge", note: "fallback for username/password-only services" },
      { label: "Permissions", note: "what each app may read/write/change" },
      { label: "Issues", note: "broken logins, expired access, missing keys" },
    ],
  },
  {
    label: "Projects",
    note: "work areas and containers",
    children: [
      { label: "Active", note: "current work" },
      { label: "Archived", note: "finished or paused work" },
    ],
  },
  {
    label: "Autopilot",
    note: "development and work assembly line",
    children: [
      { label: "Research Room", note: "explore idea, risk, feasibility" },
      { label: "Plan Room", note: "turn work into ScopePack" },
      { label: "Build Room", note: "make focused changes" },
      { label: "Test Room", note: "run proof" },
      { label: "Review Room", note: "quality and implementation check" },
      { label: "Safety Room", note: "release safety and anti-stomp" },
      { label: "Merge Room", note: "safe lift/merge decision" },
      { label: "Publish Room", note: "deployment and public proof" },
      { label: "Repair Room", note: "exact failure fixes" },
      { label: "Improve Room", note: "turn friction into improvements" },
      { label: "Wake & Retry", note: "stale packet retry and fallback" },
    ],
  },
  {
    label: "Workers",
    note: "AI worker setup and capacity",
    children: [
      { label: "🧭 Coordinator", note: "routes and decides" },
      { label: "🛠️ Builder", note: "implements" },
      { label: "🧪 Tester", note: "runs proof" },
      { label: "🔍 Reviewer", note: "reviews quality" },
      { label: "🛡️ Safety Checker", note: "release safety" },
      { label: "🔬 Researcher", note: "researches" },
      { label: "📋 Planner", note: "plans" },
      { label: "📣 Messenger", note: "sends packets" },
      { label: "👁️ Watcher", note: "tracks status" },
      { label: "🚀 Publisher", note: "publishes" },
      { label: "🩹 Repairer", note: "repairs" },
      { label: "♻️ Improver", note: "improves" },
    ],
  },
  { label: "Boardroom", note: "shared worker discussion, public name for Fishbowl" },
  { label: "To-Do List", note: "dedicated tasks separated from Boardroom chatter" },
  {
    label: "XPass / Checks",
    note: "proof and quality checks",
    children: [
      { label: "TestPass", note: "functional proof" },
      { label: "UXPass", note: "experience proof" },
      { label: "SecurityPass", note: "security proof" },
      { label: "LegalPass", note: "legal proof" },
      { label: "CopyPass", note: "writing proof" },
      { label: "SEOPass", note: "search proof" },
      { label: "QualityPass", note: "public name for SlopPass-style checks" },
      { label: "CompliancePass", note: "public name for EnterprisePass" },
      { label: "RotatePass", note: "likely folded into SecurityPass later" },
    ],
  },
  {
    label: "Ledger",
    note: "proof, approvals, receipts, audit trail",
    children: [
      { label: "Activity", note: "what happened" },
      { label: "Approvals", note: "PASS / BLOCKER / HOLD" },
      { label: "Receipts", note: "proof evidence" },
      { label: "Workers", note: "trusted worker registry" },
      { label: "Rollback", note: "undo and recovery record" },
      { label: "Audit", note: "full immutable history" },
    ],
  },
  {
    label: "Settings",
    note: "deeper account and system settings",
    children: [
      { label: "Security", note: "devices, sign-in history, revoke access" },
      { label: "Preferences", note: "deeper preferences" },
      { label: "Notifications", note: "alerts and updates" },
      { label: "Advanced", note: "power-user controls" },
    ],
  },
  { label: "Billing", note: "plan, usage, invoices" },
];

const INTERNAL_ADMIN = [
  "Analytics",
  "Codebase",
  "Orchestrator",
  "User Management",
  "System Health",
  "PinballWake",
  "Marketplace Moderation",
  "Audit Log",
  "Brainmap",
];

const PUBLIC_ALIASES = [
  ["Fishbowl", "Boardroom"],
  ["Master", "Coordinator"],
  ["Forge", "Builder"],
  ["Popcorn", "Reviewer / Tester"],
  ["Gatekeeper", "Safety Checker"],
  ["Courier", "Messenger"],
  ["Relay", "Watcher"],
  ["EnterprisePass", "CompliancePass"],
  ["SlopPass", "QualityPass"],
];

const ICONS = [
  LayoutDashboard,
  Users,
  Brain,
  AppWindow,
  KeyRound,
  FolderKanban,
  Plane,
  Users,
  MessagesSquare,
  ListTodo,
  BadgeCheck,
  ReceiptText,
  Settings,
  CreditCard,
];

export default function BrainMap() {
  return (
    <div>
      <div className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#E2B93B]/30 bg-[#E2B93B]/10 px-3 py-1 text-xs font-medium text-[#E2B93B]">
          <Sparkles className="h-3.5 w-3.5" />
          Internal admin only
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Brainmap</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
          The full UnClick ecosystem map. This is hidden from normal users and kept here so the
          product language stays consistent as the system changes.
        </p>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-white/[0.06] bg-[#111] p-5">
          <h2 className="mb-4 text-sm font-semibold text-white">Public tree</h2>
          <div className="space-y-3">
            {TREE.map((node, index) => {
              const Icon = ICONS[index] ?? ShieldAlert;
              return <TreeNode key={node.label} node={node} icon={Icon} />;
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-[#E2B93B]/25 bg-[#E2B93B]/[0.04] p-5">
            <h2 className="text-sm font-semibold text-[#E2B93B]">Internal Admin</h2>
            <ul className="mt-4 space-y-2">
              {INTERNAL_ADMIN.map((item) => (
                <li key={item} className="text-sm text-white/60">{item}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-white/[0.06] bg-[#111] p-5">
            <h2 className="text-sm font-semibold text-white">Alias table</h2>
            <p className="mt-1 text-xs leading-5 text-white/45">
              Public names are labels over existing automation plumbing, not destructive renames.
            </p>
            <div className="mt-4 space-y-2">
              {PUBLIC_ALIASES.map(([internal, publicName]) => (
                <div key={internal} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2 text-xs">
                  <span className="font-mono text-white/35">{internal}</span>
                  <span className="text-[#61C1C4]">{publicName}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function TreeNode({ node, icon: Icon }: { node: Node; icon?: typeof Brain }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#61C1C4]/10 text-[#61C1C4]">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 className="text-sm font-semibold text-white">{node.label}</h3>
            <p className="text-xs text-white/45">{node.note}</p>
          </div>
          {node.children && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {node.children.map((child) => (
                <div key={child.label} className="rounded-lg border border-white/[0.04] bg-black/20 px-3 py-2">
                  <p className="text-xs font-semibold text-white/75">{child.label}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-white/35">{child.note}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

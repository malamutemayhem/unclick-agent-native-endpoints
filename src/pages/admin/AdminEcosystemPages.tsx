import { Link } from "react-router-dom";
import {
  AppWindow,
  Archive,
  BadgeCheck,
  BellRing,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  Code2,
  CreditCard,
  Eye,
  FileText,
  FolderKanban,
  Hammer,
  KeyRound,
  ListTodo,
  MessagesSquare,
  Microscope,
  Plane,
  ReceiptText,
  RefreshCw,
  Rocket,
  SearchCheck,
  ShieldCheck,
  Tags,
  UserCheck,
  Users,
  Wrench,
} from "lucide-react";

type Item = {
  title: string;
  body: string;
  icon?: typeof Brain;
  href?: string;
  mote?: string;
};

function PageShell({
  kicker,
  title,
  subtitle,
  children,
}: {
  kicker?: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {kicker && (
        <div className="mb-3 inline-flex items-center rounded-full border border-[#61C1C4]/30 bg-[#61C1C4]/10 px-3 py-1 text-xs font-medium text-[#61C1C4]">
          {kicker}
        </div>
      )}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function TileGrid({ items }: { items: Item[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon ?? CheckCircle2;
        const content = (
          <>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#61C1C4]/10 text-[#61C1C4]">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-white">{item.title}</h2>
                {item.mote && <p className="mt-0.5 text-[11px] text-[#E2B93B]">{item.mote}</p>}
              </div>
            </div>
            <p className="text-sm leading-6 text-white/55">{item.body}</p>
          </>
        );

        const className = "block rounded-2xl border border-white/[0.06] bg-[#111] p-5 transition-colors hover:border-[#61C1C4]/30 hover:bg-white/[0.04]";
        return item.href ? (
          <Link key={item.title} to={item.href} className={className}>{content}</Link>
        ) : (
          <div key={item.title} className={className}>{content}</div>
        );
      })}
    </div>
  );
}

export function AdminProjects() {
  return (
    <PageShell
      kicker="Work areas"
      title="Projects"
      subtitle="Projects are lightweight containers. They keep work together without forcing every user into a developer workflow."
    >
      <TileGrid
        items={[
          { title: "Active", body: "Current work areas UnClick can remember, organise, and run Autopilot against.", icon: FolderKanban },
          { title: "Archived", body: "Finished or paused work areas kept for history and recall.", icon: Archive },
        ]}
      />
    </PageShell>
  );
}

export function AdminAutopilot() {
  return (
    <PageShell
      kicker="Development and work assembly line"
      title="Autopilot"
      subtitle="Autopilot turns a request into a controlled path: research, plan, build, test, review, safety, merge, publish, repair, and improvement."
    >
      <TileGrid
        items={[
          { title: "Research Room", body: "Explores the idea, market, risks, options, and low-hanging fruit before work begins.", icon: Microscope },
          { title: "Plan Room", body: "Turns research into an exact ScopePack: owned files, proof, risk, and handoff.", icon: FileText },
          { title: "Build Room", body: "Applies tightly scoped code or content changes with ownership declared first.", icon: Hammer },
          { title: "Test Room", body: "Runs the proof commands and records whether they passed.", icon: ClipboardCheck },
          { title: "Review Room", body: "Checks shape, quality, clarity, and whether the change matches the request.", icon: SearchCheck },
          { title: "Safety Room", body: "Looks for protected surfaces, stomp risk, unsafe merge state, and release blockers.", icon: ShieldCheck },
          { title: "Merge Room", body: "Decides whether a clean, approved change can leave draft and merge.", icon: BadgeCheck },
          { title: "Publish Room", body: "Watches deployment and publish proof after merge.", icon: Rocket },
          { title: "Repair Room", body: "Routes failures into small repair chips instead of broad panic fixes.", icon: Wrench },
          { title: "Improve Room", body: "Turns repeated resistance into a front-of-line improvement job.", icon: RefreshCw },
          { title: "Wake & Retry", body: "Keeps stale jobs moving with retries, nudges, and fallback rules.", icon: BellRing, mote: "PinballWake plumbing stays internal" },
        ]}
      />
    </PageShell>
  );
}

export function AdminWorkers() {
  return (
    <PageShell
      kicker="Worker setup and capacity"
      title="Workers"
      subtitle="Simple public worker names sit over the older internal fleet names. Users should see the job, not the codename."
    >
      <TileGrid
        items={[
          { title: "🧭 Coordinator", body: "Routes work, makes final safe decisions, and keeps the assembly line moving.", icon: Users },
          { title: "🛠️ Builder", body: "Makes focused implementation changes.", icon: Hammer },
          { title: "🧪 Tester", body: "Runs proof, checks, and repeatable test commands.", icon: ClipboardCheck },
          { title: "🔍 Reviewer", body: "Reviews quality, clarity, and implementation shape.", icon: SearchCheck },
          { title: "🛡️ Safety Checker", body: "Protects releases from overlap, secrets, unsafe paths, and stale proof.", icon: ShieldCheck },
          { title: "🔬 Researcher", body: "Explores unknowns before a plan is made.", icon: Microscope },
          { title: "📋 Planner", body: "Creates the exact work packet and ownership boundaries.", icon: FileText },
          { title: "📣 Messenger", body: "Sends worker packets and chases missing ACKs.", icon: MessagesSquare },
          { title: "👁️ Watcher", body: "Tracks status, proof, stale jobs, and visible changes.", icon: Eye },
          { title: "🚀 Publisher", body: "Confirms deployment and public release proof.", icon: Rocket },
          { title: "🩹 Repairer", body: "Fixes exact failed proof or broken workflow steps.", icon: Wrench },
          { title: "♻️ Improver", body: "Finds recurring friction and creates improvement jobs.", icon: RefreshCw },
        ]}
      />
    </PageShell>
  );
}

export function AdminTodoList() {
  return (
    <PageShell
      kicker="Tasks, separated from chatter"
      title="To-Do List"
      subtitle="Dedicated tasks belong here so the Boardroom can stay readable. Boardroom is for discussion; this is for work items."
    >
      <TileGrid
        items={[
          { title: "Open tasks", body: "Jobs waiting for a worker, owner, proof, or decision.", icon: ListTodo },
          { title: "Blocked tasks", body: "Items that need user input, missing credentials, or a safety decision.", icon: ShieldCheck },
          { title: "Done", body: "Completed tasks with receipts linked in the Ledger.", icon: CheckCircle2 },
        ]}
      />
    </PageShell>
  );
}

export function AdminChecks() {
  return (
    <PageShell
      kicker="Proof and quality checks"
      title="XPass / Checks"
      subtitle="XPass is the check family. It proves work with receipts instead of relying on a worker saying 'done'."
    >
      <TileGrid
        items={[
          { title: "TestPass", body: "Functional and regression proof.", icon: ClipboardCheck, href: "/admin/testpass" },
          { title: "UXPass", body: "User experience and interface checks.", icon: UserCheck },
          { title: "SecurityPass", body: "Security and protected-surface checks.", icon: ShieldCheck },
          { title: "LegalPass", body: "Legal/compliance wording and risk checks.", icon: FileText },
          { title: "CopyPass", body: "Writing, messaging, and copy quality checks.", icon: FileText, href: "/admin/copypass" },
          { title: "SEOPass", body: "Search visibility and metadata checks.", icon: SearchCheck },
          { title: "QualityPass", body: "Public name for SlopPass-style quality checking.", icon: BadgeCheck },
          { title: "CompliancePass", body: "Public name for EnterprisePass.", icon: ShieldCheck },
          { title: "RotatePass", body: "Credential rotation checks, likely folding into SecurityPass later.", icon: KeyRound },
        ]}
      />
    </PageShell>
  );
}

export function AdminLedger() {
  return (
    <PageShell
      kicker="Receipts, approvals, audit trail"
      title="Ledger"
      subtitle="Ledger is the flight recorder for AI work: what happened, who approved it, what proof exists, and how to recover."
    >
      <TileGrid
        items={[
          { title: "Activity", body: "What happened and when.", icon: ReceiptText, href: "/admin/activity" },
          { title: "Approvals", body: "Trusted PASS, BLOCKER, and HOLD decisions.", icon: BadgeCheck },
          { title: "Receipts", body: "Proof checks and completion evidence.", icon: ClipboardCheck },
          { title: "Workers", body: "Trusted worker identity registry.", icon: Users },
          { title: "Rollback", body: "Undo and recovery record.", icon: RefreshCw },
          { title: "Audit", body: "Full immutable history for trust and investigation.", icon: FileText, href: "/admin/audit-log" },
        ]}
      />
    </PageShell>
  );
}

export function AdminBilling() {
  return (
    <PageShell
      kicker="Plan and usage"
      title="Billing"
      subtitle="A simple place for plan, usage, seats, and invoices. Deeper payment controls can stay in Settings until needed."
    >
      <TileGrid
        items={[
          { title: "Plan", body: "Your current UnClick plan and limits.", icon: CreditCard },
          { title: "Usage", body: "Calls, workers, checks, and account usage.", icon: ReceiptText },
          { title: "Invoices", body: "Billing history and receipts.", icon: FileText },
        ]}
      />
    </PageShell>
  );
}

export function AdminAppsIntro() {
  return (
    <div className="mb-6 rounded-2xl border border-[#61C1C4]/20 bg-[#61C1C4]/[0.05] p-4">
      <div className="flex items-start gap-3">
        <AppWindow className="mt-0.5 h-4 w-4 shrink-0 text-[#61C1C4]" />
        <div>
          <p className="text-sm font-semibold text-white">Apps are what UnClick can use.</p>
          <p className="mt-1 text-sm leading-6 text-white/55">
            Built-in apps work straight away. Connected apps are approved. Turned Off apps stay quiet.
            Needs Login and Needs API Key tell the user exactly why an app is waiting.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
        {["Built-In", "Connected", "Turned Off", "Needs Login", "Needs API Key", "Private Tools", "Marketplace"].map((label) => (
          <span key={label} className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-white/55">
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AdminPassportIntro() {
  return (
    <div className="mb-6 rounded-2xl border border-[#E2B93B]/20 bg-[#E2B93B]/[0.05] p-4">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[#E2B93B]" />
        <div>
          <p className="text-sm font-semibold text-white">Passport is how UnClick gets permission.</p>
          <p className="mt-1 text-sm leading-6 text-white/55">
            OAuth, API keys, browser extension access, password bridge fallback, permissions,
            and connection issues all belong here.
          </p>
        </div>
      </div>
    </div>
  );
}

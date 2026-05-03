import {
  BellRing,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Gauge,
  RadioTower,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  PINBALLWAKE_CLOCK_ROUTES,
  summarizePinballWakeClockRoutes,
  type PinballWakeClockRoute,
  type PinballWakeClockStatus,
} from "./pinballwakeClockRoutes";

const STATUS_STYLES: Record<PinballWakeClockStatus, string> = {
  live: "border-[#61C1C4]/40 bg-[#61C1C4]/10 text-[#61C1C4]",
  watching: "border-[#E2B93B]/40 bg-[#E2B93B]/10 text-[#E2B93B]",
  ready: "border-emerald-400/35 bg-emerald-400/10 text-emerald-300",
  candidate: "border-white/15 bg-white/[0.04] text-white/65",
  later: "border-white/10 bg-white/[0.02] text-white/40",
};

function StatusBadge({ status }: { status: PinballWakeClockStatus }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${STATUS_STYLES[status]}`}>
      {status.replace("-", " ")}
    </span>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BellRing;
  label: string;
  value: string | number;
}) {
  return (
    <section className="rounded-lg border border-white/[0.06] bg-[#111111] p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase text-white/40">
        <Icon className="h-4 w-4 text-[#E2B93B]" />
        {label}
      </div>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    </section>
  );
}

function RouteRow({ route }: { route: PinballWakeClockRoute }) {
  return (
    <article className="rounded-lg border border-white/[0.06] bg-[#111111] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-white">{route.name}</h2>
            <StatusBadge status={route.status} />
          </div>
          <p className="mt-1 text-sm text-white/55">{route.role}</p>
        </div>
        <div className="shrink-0 rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-white/55">
          {route.owner} · {route.automationLevel}
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase text-white/35">Technique</dt>
          <dd className="mt-1 text-white/70">{route.technique}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-white/35">User Required</dt>
          <dd className="mt-1 text-white/70">{route.userRequired}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-white/35">Safety</dt>
          <dd className="mt-1 text-white/70">{route.safety}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-white/35">Next Step</dt>
          <dd className="mt-1 text-white/70">{route.nextStep}</dd>
        </div>
      </dl>
    </article>
  );
}

export default function AdminPinballWake() {
  const summary = summarizePinballWakeClockRoutes();

  const primaryRoutes = PINBALLWAKE_CLOCK_ROUTES.filter((route) =>
    ["live", "watching", "ready"].includes(route.status),
  );
  const futureRoutes = PINBALLWAKE_CLOCK_ROUTES.filter((route) =>
    ["candidate", "later"].includes(route.status),
  );

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#61C1C4]/10 text-[#61C1C4]">
            <BellRing className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">PinballWake</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/50">
              Wake routes, clocks, ACK proof, and safe fallback paths for the worker fleet.
            </p>
          </div>
        </div>
        <a
          href="/admin/fishbowl"
          className="inline-flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm font-medium text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          Fishbowl
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={RadioTower} label="Clock Routes" value={summary.total} />
        <MetricCard icon={CheckCircle2} label="Live" value={summary.byStatus.live ?? 0} />
        <MetricCard icon={Gauge} label="Automated" value={summary.automated} />
        <MetricCard icon={ShieldCheck} label="No New Setup" value={summary.noNewUserSetup} />
      </div>

      <section className="mb-6 rounded-lg border border-[#E2B93B]/25 bg-[#E2B93B]/[0.06] p-4">
        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[#E2B93B]" />
          <div>
            <h2 className="text-sm font-semibold text-[#E2B93B]">Operating Rule</h2>
            <p className="mt-1 text-sm leading-relaxed text-white/65">
              QueuePush should stay one safe button. PinballWake manages the clocks that press it,
              WakePass proves ACK or reclaim, and every late duplicate must re-read current state
              before doing anything.
            </p>
          </div>
        </div>
      </section>

      <div className="space-y-6">
        <section>
          <div className="mb-3 flex items-center gap-2">
            <RadioTower className="h-4 w-4 text-[#61C1C4]" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
              Active And Ready Routes
            </h2>
          </div>
          <div className="space-y-3">
            {primaryRoutes.map((route) => (
              <RouteRow key={route.id} route={route} />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#E2B93B]" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
              Candidate Routes
            </h2>
          </div>
          <div className="space-y-3">
            {futureRoutes.map((route) => (
              <RouteRow key={route.id} route={route} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

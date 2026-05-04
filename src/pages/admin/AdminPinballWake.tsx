import {
  BellRing,
  CheckCircle2,
  Clock3,
  Cpu,
  ExternalLink,
  Gauge,
  LockKeyhole,
  RadioTower,
  Sparkles,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  PINBALLWAKE_CLOCK_ROUTES,
  summarizePinballWakeClockRoutes,
  type PinballWakeClockRoute,
  type PinballWakeClockStatus,
} from "./pinballwakeClockRoutes";
import {
  PINBALLWAKE_JOB_RUNNERS,
  summarizePinballWakeJobRunners,
  type PinballWakeJobRunner,
  type PinballWakeRunnerReadiness,
} from "./pinballwakeJobRunners";
import {
  activeOrchestrator,
  LAUNCHPAD_ORCHESTRATORS,
  LAUNCHPAD_ROOM_COVERAGE,
  LAUNCHPAD_SEATS,
  LAUNCHPAD_SETUP_STEPS,
  summarizeLaunchpadSeats,
  type LaunchpadRoomCoverage,
  type LaunchpadSeat,
  type LaunchpadSeatCapacity,
  type LaunchpadSeatStatus,
  type LaunchpadSetupStep,
} from "./pinballwakeLaunchpad";

const STATUS_STYLES: Record<PinballWakeClockStatus, string> = {
  live: "border-[#61C1C4]/40 bg-[#61C1C4]/10 text-[#61C1C4]",
  watching: "border-[#E2B93B]/40 bg-[#E2B93B]/10 text-[#E2B93B]",
  ready: "border-emerald-400/35 bg-emerald-400/10 text-emerald-300",
  candidate: "border-white/15 bg-white/[0.04] text-white/65",
  later: "border-white/10 bg-white/[0.02] text-white/40",
};

const RUNNER_STYLES: Record<PinballWakeRunnerReadiness, string> = {
  builder_ready: "border-emerald-400/35 bg-emerald-400/10 text-emerald-300",
  scoped_builder: "border-[#61C1C4]/40 bg-[#61C1C4]/10 text-[#61C1C4]",
  needs_probe: "border-[#E2B93B]/40 bg-[#E2B93B]/10 text-[#E2B93B]",
  review_only: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  context_only: "border-white/15 bg-white/[0.04] text-white/60",
  offline: "border-white/10 bg-white/[0.02] text-white/35",
};

const SEAT_STATUS_STYLES: Record<LaunchpadSeatStatus, string> = {
  available: "border-emerald-400/35 bg-emerald-400/10 text-emerald-300",
  busy: "border-[#E2B93B]/40 bg-[#E2B93B]/10 text-[#E2B93B]",
  standby: "border-[#61C1C4]/40 bg-[#61C1C4]/10 text-[#61C1C4]",
  offline: "border-white/10 bg-white/[0.02] text-white/35",
};

const CAPACITY_STYLES: Record<LaunchpadSeatCapacity, string> = {
  fresh: "text-emerald-300",
  normal: "text-[#61C1C4]",
  low: "text-[#E2B93B]",
  exhausted: "text-red-300",
  unknown: "text-white/45",
};

const ROOM_STYLES: Record<LaunchpadRoomCoverage["status"], string> = {
  covered: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  thin: "border-[#E2B93B]/40 bg-[#E2B93B]/10 text-[#E2B93B]",
  missing: "border-red-400/30 bg-red-400/10 text-red-300",
};

const SETUP_STYLES: Record<LaunchpadSetupStep["status"], string> = {
  done: "text-emerald-300",
  next: "text-[#E2B93B]",
  watch: "text-[#61C1C4]",
};

function StatusBadge({ status }: { status: PinballWakeClockStatus }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${STATUS_STYLES[status]}`}>
      {status.replace("-", " ")}
    </span>
  );
}

function RunnerBadge({ readiness }: { readiness: PinballWakeRunnerReadiness }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${RUNNER_STYLES[readiness]}`}>
      {readiness.replaceAll("_", " ")}
    </span>
  );
}

function SmallBadge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${className}`}>
      {children}
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

function RunnerRow({ runner }: { runner: PinballWakeJobRunner }) {
  return (
    <article className="rounded-lg border border-white/[0.06] bg-[#111111] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-white">
              {runner.emoji} {runner.name}
            </h2>
            <RunnerBadge readiness={runner.readiness} />
          </div>
          <p className="mt-1 text-sm text-white/55">
            {runner.kind} · {runner.host}
          </p>
        </div>
        <div className="shrink-0 rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-white/55">
          {runner.capabilities.join(", ")}
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase text-white/35">Safe For</dt>
          <dd className="mt-1 text-white/70">{runner.safeFor.join(", ")}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-white/35">Not For</dt>
          <dd className="mt-1 text-white/70">{runner.notFor.join(", ")}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-white/35">Proof</dt>
          <dd className="mt-1 text-white/70">{runner.proof}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-white/35">Next Probe</dt>
          <dd className="mt-1 text-white/70">{runner.nextProbe}</dd>
        </div>
      </dl>
    </article>
  );
}

function SeatRow({ seat }: { seat: LaunchpadSeat }) {
  return (
    <article className="rounded-lg border border-white/[0.06] bg-[#111111] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{seat.name}</h3>
            <SmallBadge className={SEAT_STATUS_STYLES[seat.status]}>{seat.status}</SmallBadge>
          </div>
          <p className="mt-1 text-xs text-white/50">
            {seat.provider} · {seat.machine} · {seat.app}
          </p>
        </div>
        <div className="text-right text-xs">
          <p className={`font-semibold uppercase ${CAPACITY_STYLES[seat.capacity]}`}>{seat.capacity}</p>
          <p className="mt-1 text-white/40">{seat.currentJobs} active jobs</p>
        </div>
      </div>
      <div className="mt-3 grid gap-3 text-xs md:grid-cols-2">
        <div>
          <p className="font-medium uppercase text-white/35">Capabilities</p>
          <p className="mt-1 text-white/65">{seat.capabilities.join(", ")}</p>
        </div>
        <div>
          <p className="font-medium uppercase text-white/35">Delivery</p>
          <p className="mt-1 text-white/65">{seat.delivery.join(", ")}</p>
        </div>
      </div>
    </article>
  );
}

function RoomCoverageRow({ room }: { room: LaunchpadRoomCoverage }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-white/[0.06] bg-white/[0.025] px-3 py-2">
      <div>
        <p className="text-sm font-medium text-white">{room.room}</p>
        <p className="mt-0.5 text-xs text-white/45">
          {room.primarySeat ? `Primary: ${room.primarySeat}` : "No primary seat"}
          {room.backupSeats.length ? ` · Backup: ${room.backupSeats.join(", ")}` : ""}
        </p>
      </div>
      <SmallBadge className={ROOM_STYLES[room.status]}>{room.status}</SmallBadge>
    </div>
  );
}

function SetupStepRow({ step }: { step: LaunchpadSetupStep }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.025] px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-white">{step.label}</p>
        <span className={`text-xs font-semibold uppercase ${SETUP_STYLES[step.status]}`}>{step.status}</span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-white/50">{step.detail}</p>
    </div>
  );
}

export default function AdminPinballWake() {
  const summary = summarizePinballWakeClockRoutes();
  const runnerSummary = summarizePinballWakeJobRunners();
  const launchpadSummary = summarizeLaunchpadSeats();
  const orchestrator = activeOrchestrator();

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
        <MetricCard icon={Cpu} label="Code Hands" value={runnerSummary.codeHands} />
        <MetricCard icon={Gauge} label="Need Probe" value={runnerSummary.needsProbe} />
      </div>

      <section className="mb-6 border-y border-[#61C1C4]/20 bg-[#061314] py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <LockKeyhole className="h-4 w-4 text-[#61C1C4]" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
                Launchpad Room
              </h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/60">
              One active orchestrator controls the fleet. Other PCs and chats can stay as standby
              control surfaces, while ChatGPT and Claude accounts are treated as capacity seats.
            </p>
          </div>
          <div className="rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm">
            <p className="text-xs font-medium uppercase text-white/35">Active Orchestrator</p>
            <p className="mt-1 font-semibold text-white">{orchestrator?.name ?? "Missing"}</p>
            <p className="mt-0.5 text-xs text-white/45">{orchestrator?.lease ?? "No active lease"}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={UsersRound} label="Worker Seats" value={launchpadSummary.total} />
          <MetricCard icon={CheckCircle2} label="Available" value={launchpadSummary.available} />
          <MetricCard icon={Cpu} label="Code Seats" value={launchpadSummary.codeSeats} />
          <MetricCard icon={Gauge} label="Standby Orchestrators" value={LAUNCHPAD_ORCHESTRATORS.length - 1} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/45">
              Seats
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {LAUNCHPAD_SEATS.map((seat) => (
                <SeatRow key={seat.id} seat={seat} />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/45">
                Room Coverage
              </h3>
              <div className="space-y-2">
                {LAUNCHPAD_ROOM_COVERAGE.map((room) => (
                  <RoomCoverageRow key={room.room} room={room} />
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/45">
                Setup Steps
              </h3>
              <div className="space-y-2">
                {LAUNCHPAD_SETUP_STEPS.map((step) => (
                  <SetupStepRow key={step.id} step={step} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-lg border border-[#E2B93B]/25 bg-[#E2B93B]/[0.06] p-4">
        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[#E2B93B]" />
          <div>
            <h2 className="text-sm font-semibold text-[#E2B93B]">Operating Rule</h2>
            <p className="mt-1 text-sm leading-relaxed text-white/65">
              QueuePush should stay one safe button. PinballWake manages the clocks that press it,
              WakePass proves ACK or reclaim, and every late duplicate must re-read current state
              before doing anything. Build packets go only to job runners with proven code hands.
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
            <Cpu className="h-4 w-4 text-emerald-300" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
              Job Runners
            </h2>
          </div>
          <div className="space-y-3">
            {PINBALLWAKE_JOB_RUNNERS.map((runner) => (
              <RunnerRow key={runner.id} runner={runner} />
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

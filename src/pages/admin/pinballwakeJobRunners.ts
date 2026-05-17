export type PinballWakeRunnerKind =
  | "codex-desktop"
  | "codex-cloud"
  | "claude-code-action"
  | "copilot-cloud"
  | "local-runner"
  | "chat-only";

export type PinballWakeRunnerReadiness =
  | "builder_ready"
  | "scoped_builder"
  | "needs_probe"
  | "review_only"
  | "context_only"
  | "offline";

export type PinballWakeJobKind =
  | "implementation"
  | "queue_management"
  | "owner_decision"
  | "qc_review"
  | "merge_proof"
  | "status_relay";

export interface PinballWakeJobRunner {
  id: string;
  emoji: string;
  name: string;
  kind: PinballWakeRunnerKind;
  host: string;
  readiness: PinballWakeRunnerReadiness;
  capabilities: PinballWakeJobKind[];
  safeFor: string[];
  notFor: string[];
  proof: string;
  nextProbe: string;
}

export type BenchReadinessClass =
  | "ready"
  | "context_only"
  | "review_only"
  | "needs_probe"
  | "offline";

export interface PinballWakeJobRequest {
  kind: PinballWakeJobKind;
  lane: string;
  title: string;
  requiresCode?: boolean;
}

export interface BenchReadinessReport {
  runnerId: string;
  readiness: BenchReadinessClass;
  canImplement: boolean;
  canReview: boolean;
  canCoordinate: boolean;
  reason: string;
  nextProbe: string;
}

export interface BenchCallUpDecision {
  status: "PASS" | "BLOCKER";
  job: PinballWakeJobRequest;
  runner?: PinballWakeJobRunner;
  readiness?: BenchReadinessClass;
  reason: string;
  nextProbe?: string;
}

export const PINBALLWAKE_JOB_RUNNERS: PinballWakeJobRunner[] = [
  {
    id: "jobs-worker",
    emoji: "📋",
    name: "Jobs Worker",
    kind: "local-runner",
    host: "PinballWake Jobs lane",
    readiness: "context_only",
    capabilities: ["queue_management", "owner_decision", "status_relay"],
    safeFor: ["jobs", "queue", "scopepack", "stale jobs", "boardroom", "pinballwake"],
    notFor: ["product code", "branch edits", "merge execution", "secrets", "billing", "domains", "migrations"],
    proof: "Keeps Jobs runnable by preparing ScopePacks, releasing stale claims, and reducing duplicate queue noise.",
    nextProbe: "Use before PinballWake builder runs when a Job is stale, vague, duplicated, or missing a ScopePack.",
  },
  {
    id: "coordinator-codex-desktop",
    emoji: "🧭",
    name: "Coordinator Codex",
    kind: "codex-desktop",
    host: "Lenovo Codex desktop",
    readiness: "context_only",
    capabilities: ["owner_decision", "merge_proof", "status_relay"],
    safeFor: ["pinballwake", "queuepush", "wakepass", "docs", "proof"],
    notFor: ["secrets", "billing", "domains", "migrations", "raw keys"],
    proof: "Built and merged #511, #514, and #515.",
    nextProbe: "Keep as coordinator; avoid using as the only build lane.",
  },
  {
    id: "builder-codex",
    emoji: "🛠️",
    name: "Builder",
    kind: "codex-desktop",
    host: "Plex/worker Codex lane",
    readiness: "builder_ready",
    capabilities: ["implementation", "qc_review", "status_relay"],
    safeFor: ["wakepass", "queuepush", "pinballwake", "rotatepass", "docs", "tests"],
    notFor: ["secrets", "billing", "domains", "migrations", "raw keys", "another worker branch"],
    proof: "Built clean replacement #513 for dirty #505 and included focused proof.",
    nextProbe: "Use as first fallback for code packets when product/context lanes do not ACK.",
  },
  {
    id: "tester-product-context",
    emoji: "🧪",
    name: "Tester",
    kind: "chat-only",
    host: "Lenovo ChatGPT pinned worker",
    readiness: "context_only",
    capabilities: ["owner_decision", "qc_review", "status_relay"],
    safeFor: ["xpass", "dogfood", "rotatepass owner decision", "pass-family context"],
    notFor: ["unattended implementation", "dirty branch repair", "merge execution"],
    proof: "Useful for Pass/XPass direction; direct unattended build pickup is not proven.",
    nextProbe: "Give one no-risk repo-access probe before assigning implementation packets.",
  },
  {
    id: "safety-checker",
    emoji: "🛡️",
    name: "Safety Checker",
    kind: "chat-only",
    host: "Plex ChatGPT pinned worker",
    readiness: "review_only",
    capabilities: ["qc_review", "status_relay"],
    safeFor: ["hold review", "anti-stomp", "release safety", "scope checks"],
    notFor: ["implementation", "branch edits", "merge execution"],
    proof: "Posted HOLD/PASS safety reviews on #513 and #515.",
    nextProbe: "Keep in safety lane; do not route build packets here.",
  },
  {
    id: "reviewer-plex",
    emoji: "🔍",
    name: "Reviewer",
    kind: "chat-only",
    host: "Plex Claude desktop",
    readiness: "review_only",
    capabilities: ["qc_review", "status_relay"],
    safeFor: ["second-read", "QC", "proof review", "handoff clarity"],
    notFor: ["implementation until Claude Code repo access is proven"],
    proof: "Current review lane; code execution seat not proven in this registry.",
    nextProbe: "Upgrade to claude-code-action or local Claude Code runner before code packets.",
  },
  {
    id: "repairer-plex-unproven",
    emoji: "🩹",
    name: "Repairer",
    kind: "local-runner",
    host: "Plex PC",
    readiness: "needs_probe",
    capabilities: ["implementation", "status_relay"],
    safeFor: ["small implementation after probe", "docs after probe"],
    notFor: ["high-risk code", "dirty branch repair before probe", "secrets"],
    proof: "Expected build lane, but current QueuePush pickup proof is missing.",
    nextProbe: "Run a zero-risk repo-access probe: read Boardroom, branch, tiny docs/test chip, PR.",
  },
  {
    id: "messenger-relay",
    emoji: "📣",
    name: "Messenger",
    kind: "chat-only",
    host: "Plex ChatGPT pinned worker",
    readiness: "context_only",
    capabilities: ["status_relay", "owner_decision"],
    safeFor: ["nudges", "handoffs", "status drift"],
    notFor: ["implementation", "merge execution"],
    proof: "Designed to move messages, not code.",
    nextProbe: "Keep as delivery lane unless attached to a runner.",
  },
];

export function classifyBenchReadiness(runner: PinballWakeJobRunner): BenchReadinessClass {
  if (runner.readiness === "offline") return "offline";
  if (runner.readiness === "needs_probe") return "needs_probe";
  if (runner.readiness === "review_only") return "review_only";
  if (runner.readiness === "context_only") return "context_only";
  return "ready";
}

export function describeBenchReadiness(runner: PinballWakeJobRunner): BenchReadinessReport {
  const readiness = classifyBenchReadiness(runner);

  return {
    runnerId: runner.id,
    readiness,
    canImplement: runner.readiness === "builder_ready" || runner.readiness === "scoped_builder",
    canReview: runner.capabilities.includes("qc_review") && runner.readiness !== "offline",
    canCoordinate:
      runner.capabilities.includes("queue_management") ||
      runner.capabilities.includes("owner_decision") ||
      runner.capabilities.includes("status_relay"),
    reason:
      readiness === "ready"
        ? "Ready for scoped code packets with normal proof."
        : readiness === "needs_probe"
          ? "Needs a no-risk repo-access probe before implementation."
          : readiness === "offline"
            ? "Offline or dormant. Do not route fresh packets here."
            : readiness === "review_only"
              ? "Ready for review, proof, and safety reads only."
              : "Ready for context, owner decisions, queue work, and status relay.",
    nextProbe: runner.nextProbe,
  };
}

export function runnerCanAcceptJob(
  runner: PinballWakeJobRunner,
  job: PinballWakeJobRequest,
): boolean {
  if (!runner.capabilities.includes(job.kind)) return false;
  if (runner.readiness === "offline") return false;
  if (job.requiresCode) {
    return runner.readiness === "builder_ready" || runner.readiness === "scoped_builder";
  }
  return runner.readiness !== "needs_probe" || job.kind === "status_relay";
}

function chooseJobsWorkerFirst(runners: PinballWakeJobRunner[]): PinballWakeJobRunner | undefined {
  return runners.find((runner) => runner.id === "jobs-worker");
}

function choosePassContextRunner(
  job: PinballWakeJobRequest,
  runners: PinballWakeJobRunner[],
): PinballWakeJobRunner | undefined {
  const lane = job.lane.toLowerCase();
  if (job.kind !== "status_relay" || (!lane.includes("xpass") && !lane.includes("pass"))) {
    return undefined;
  }

  return runners.find(
    (runner) =>
      runner.safeFor.some((safeLane) => safeLane.toLowerCase().includes("xpass")) &&
      runnerCanAcceptJob(runner, job),
  );
}

function findBlockedSpecialist(
  job: PinballWakeJobRequest,
  runners: PinballWakeJobRunner[],
): PinballWakeJobRunner | undefined {
  const candidates = runners.filter((runner) => runner.capabilities.includes(job.kind));
  const lane = job.lane.toLowerCase();
  const laneMatch = candidates.find((runner) =>
    runner.safeFor.some((safeLane) => lane.includes(safeLane.toLowerCase())),
  );
  const ordered = laneMatch ? [laneMatch, ...candidates.filter((runner) => runner !== laneMatch)] : candidates;

  return (
    ordered.find((runner) => runner.readiness === "needs_probe") ??
    ordered.find((runner) => runner.readiness === "offline")
  );
}

export function chooseBenchCallUp(
  job: PinballWakeJobRequest,
  runners = PINBALLWAKE_JOB_RUNNERS,
): BenchCallUpDecision {
  const jobsWorker = chooseJobsWorkerFirst(runners);
  const passContextRunner = choosePassContextRunner(job, runners);
  const shouldStartWithJobsWorker = job.kind === "queue_management" || job.kind === "owner_decision";
  const runner =
    shouldStartWithJobsWorker && jobsWorker && runnerCanAcceptJob(jobsWorker, job)
      ? jobsWorker
      : passContextRunner
        ? passContextRunner
        : choosePinballWakeJobRunner(job, runners);

  if (runner) {
    const report = describeBenchReadiness(runner);
    return {
      status: "PASS",
      job,
      runner,
      readiness: report.readiness,
      reason: `${runner.name} can take ${job.kind} work. ${report.reason}`,
      nextProbe: runner.nextProbe,
    };
  }

  const blocked = findBlockedSpecialist(job, runners);
  if (blocked) {
    const report = describeBenchReadiness(blocked);
    return {
      status: "BLOCKER",
      job,
      runner: blocked,
      readiness: report.readiness,
      reason: `BLOCKER: ${blocked.name} matches this lane but is ${report.readiness}. ${report.reason}`,
      nextProbe: blocked.nextProbe,
    };
  }

  return {
    status: "BLOCKER",
    job,
    reason: `BLOCKER: no eligible bench specialist can take ${job.kind} work for ${job.lane}.`,
  };
}

export function choosePinballWakeJobRunner(
  job: PinballWakeJobRequest,
  runners = PINBALLWAKE_JOB_RUNNERS,
): PinballWakeJobRunner | undefined {
  const lane = job.lane.toLowerCase();
  const candidates = runners.filter((runner) => runnerCanAcceptJob(runner, job));
  const laneMatch = candidates.find((runner) =>
    runner.safeFor.some((safeLane) => lane.includes(safeLane.toLowerCase())),
  );
  return laneMatch ?? candidates[0];
}

export function summarizePinballWakeJobRunners(runners = PINBALLWAKE_JOB_RUNNERS) {
  return runners.reduce(
    (summary, runner) => {
      summary.total += 1;
      summary.byReadiness[runner.readiness] = (summary.byReadiness[runner.readiness] ?? 0) + 1;
      if (runnerCanAcceptJob(runner, {
        kind: "implementation",
        lane: "general",
        title: "Generic code chip",
        requiresCode: true,
      })) {
        summary.codeHands += 1;
      }
      if (runner.readiness === "needs_probe") summary.needsProbe += 1;
      return summary;
    },
    {
      total: 0,
      codeHands: 0,
      needsProbe: 0,
      byReadiness: {} as Record<PinballWakeRunnerReadiness, number>,
    },
  );
}

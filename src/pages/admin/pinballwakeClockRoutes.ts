export type PinballWakeClockStatus =
  | "live"
  | "watching"
  | "ready"
  | "candidate"
  | "later";

export type PinballWakeClockOwner =
  | "PinballWake"
  | "QueuePush"
  | "WakePass"
  | "Master"
  | "Operator";

export interface PinballWakeClockRoute {
  id: string;
  name: string;
  owner: PinballWakeClockOwner;
  status: PinballWakeClockStatus;
  automationLevel: "automatic" | "watchdog" | "one-time setup" | "manual fallback" | "future";
  technique: string;
  role: string;
  userRequired: string;
  safety: string;
  nextStep: string;
}

export const PINBALLWAKE_CLOCK_ROUTES: PinballWakeClockRoute[] = [
  {
    id: "queuepush-pr-scanner",
    name: "QueuePush PR scanner",
    owner: "QueuePush",
    status: "live",
    automationLevel: "automatic",
    technique: "GitHub workflow plus Fishbowl packet",
    role: "Scans stuck pull requests and creates one-worker packets.",
    userRequired: "None after setup.",
    safety: "Stable packet IDs stop duplicate late runs from spamming workers.",
    nextStep: "Keep as the first PinballWake queue route.",
  },
  {
    id: "master-watchdog",
    name: "Master watchdog",
    owner: "Master",
    status: "watching",
    automationLevel: "watchdog",
    technique: "Codex heartbeat",
    role: "Checks whether QueuePush moved work; bridges missed GitHub cron runs.",
    userRequired: "Keep this thread heartbeat active.",
    safety: "Triggers QueuePush only as a bridge and never edits branches.",
    nextStep: "Use as the current reliability backstop.",
  },
  {
    id: "github-actions-schedule",
    name: "GitHub Actions schedule",
    owner: "PinballWake",
    status: "live",
    automationLevel: "automatic",
    technique: "Scheduled workflow",
    role: "Runs QueuePush on a staggered schedule from GitHub.",
    userRequired: "None, but GitHub may delay or drop schedule runs.",
    safety: "QueuePush re-reads current PR state every run.",
    nextStep: "Keep, but do not trust as the only clock.",
  },
  {
    id: "wakepass-ack-reclaim",
    name: "WakePass ACK reclaim",
    owner: "WakePass",
    status: "live",
    automationLevel: "automatic",
    technique: "Fishbowl handoff and stale ACK watcher",
    role: "Turns missed worker ACKs into visible reclaim work.",
    userRequired: "None once workers reply with ACK or blocker.",
    safety: "Reclaim is based on stale leases, not destructive branch action.",
    nextStep: "Use as the proof layer behind every route.",
  },
  {
    id: "vercel-cron",
    name: "Vercel Cron",
    owner: "PinballWake",
    status: "ready",
    automationLevel: "one-time setup",
    technique: "Secure API endpoint",
    role: "External product clock that can call QueuePush outside GitHub.",
    userRequired: "One-time endpoint and secret setup.",
    safety: "Endpoint should accept only signed requests and run advisory QueuePush.",
    nextStep: "Best next production fallback.",
  },
  {
    id: "cloudflare-cron",
    name: "Cloudflare Workers Cron",
    owner: "PinballWake",
    status: "candidate",
    automationLevel: "one-time setup",
    technique: "Worker scheduled trigger",
    role: "Independent outside clock if Vercel or GitHub are quiet.",
    userRequired: "One-time Worker and secret setup.",
    safety: "Calls the same idempotent QueuePush button.",
    nextStep: "Add only if Vercel Cron is not enough.",
  },
  {
    id: "supabase-pg-cron",
    name: "Supabase pg_cron",
    owner: "PinballWake",
    status: "candidate",
    automationLevel: "one-time setup",
    technique: "Database schedule plus HTTP call",
    role: "Database-owned clock that can also store last-run receipts.",
    userRequired: "Migration approval before use.",
    safety: "Hold until migrations are approved.",
    nextStep: "Good later fit for receipt storage, not today's fastest move.",
  },
  {
    id: "qstash",
    name: "Upstash QStash",
    owner: "PinballWake",
    status: "candidate",
    automationLevel: "one-time setup",
    technique: "HTTP schedule with retries",
    role: "Retries webhook delivery when a route misses.",
    userRequired: "Provider account and token setup.",
    safety: "Use idempotency keys so retries are harmless.",
    nextStep: "Consider when QueuePush needs delivery retries, not just schedule retries.",
  },
  {
    id: "external-healthcheck",
    name: "External healthcheck",
    owner: "Operator",
    status: "ready",
    automationLevel: "one-time setup",
    technique: "Cronitor, Healthchecks, Better Stack, or UptimeRobot",
    role: "Alerts when no QueuePush healthy receipt appears in the expected window.",
    userRequired: "One-time monitor setup.",
    safety: "Monitor only; does not touch branches or secrets.",
    nextStep: "Pair with a last-run receipt before enabling alerts.",
  },
  {
    id: "plex-task-scheduler",
    name: "Plex PC task",
    owner: "Operator",
    status: "candidate",
    automationLevel: "manual fallback",
    technique: "Windows Task Scheduler",
    role: "Local backup clock for Chris's own machines.",
    userRequired: "Machine must be awake, synced, and configured.",
    safety: "Useful fallback, but not a public-product foundation.",
    nextStep: "Keep as emergency redundancy only.",
  },
  {
    id: "doorbell-classifier",
    name: "Cheap doorbell classifier",
    owner: "PinballWake",
    status: "candidate",
    automationLevel: "one-time setup",
    technique: "OpenRouter or Groq",
    role: "Decides wake or no-wake when deterministic routing is unsure.",
    userRequired: "Optional model key and budget cap.",
    safety: "Classifier only; cannot code, review, merge, or change product state.",
    nextStep: "Keep optional until routing ambiguity becomes expensive.",
  },
  {
    id: "local-browser-extension",
    name: "Local browser extension",
    owner: "PinballWake",
    status: "later",
    automationLevel: "future",
    technique: "User-owned browser wake route",
    role: "Wakes browser-resident agents while cookies and MFA stay local.",
    userRequired: "Future extension install and one-button revoke.",
    safety: "Do not store raw keys; user keeps browser session locally.",
    nextStep: "Phase 0 only until core clocks are stable.",
  },
];

export function summarizePinballWakeClockRoutes(routes = PINBALLWAKE_CLOCK_ROUTES) {
  return routes.reduce(
    (summary, route) => {
      summary.total += 1;
      summary.byStatus[route.status] = (summary.byStatus[route.status] ?? 0) + 1;
      if (route.automationLevel === "automatic" || route.automationLevel === "watchdog") {
        summary.automated += 1;
      }
      if (route.userRequired === "None after setup." || route.userRequired === "None once workers reply with ACK or blocker.") {
        summary.noNewUserSetup += 1;
      }
      return summary;
    },
    {
      total: 0,
      automated: 0,
      noNewUserSetup: 0,
      byStatus: {} as Record<PinballWakeClockStatus, number>,
    },
  );
}

export type LaunchpadSeatStatus = "available" | "busy" | "standby" | "offline";
export type LaunchpadSeatCapacity = "fresh" | "normal" | "low" | "exhausted" | "unknown";
export type LaunchpadOrchestratorRole = "active" | "standby";
export type LaunchpadRoomStatus = "covered" | "thin" | "missing";

export interface LaunchpadSeat {
  id: string;
  name: string;
  provider: "ChatGPT" | "Claude" | "GitHub" | "Local";
  machine: string;
  app: string;
  status: LaunchpadSeatStatus;
  capacity: LaunchpadSeatCapacity;
  capabilities: string[];
  delivery: string[];
  currentJobs: number;
  reliability: number;
}

export interface LaunchpadOrchestrator {
  id: string;
  name: string;
  role: LaunchpadOrchestratorRole;
  machine: string;
  heartbeat: string;
  lease: string;
}

export interface LaunchpadRoomCoverage {
  room: string;
  status: LaunchpadRoomStatus;
  primarySeat: string | null;
  backupSeats: string[];
}

export interface LaunchpadSetupStep {
  id: string;
  label: string;
  status: "done" | "next" | "watch";
  detail: string;
}

export const LAUNCHPAD_ORCHESTRATORS: LaunchpadOrchestrator[] = [
  {
    id: "lenovo-master",
    name: "Lenovo Master",
    role: "active",
    machine: "Lenovo",
    heartbeat: "UnClick Launchpad Autopilot",
    lease: "active",
  },
  {
    id: "plex-master-ui",
    name: "Plex control surface",
    role: "standby",
    machine: "Plex",
    heartbeat: "standby only",
    lease: "available for failover",
  },
];

export const LAUNCHPAD_SEATS: LaunchpadSeat[] = [
  {
    id: "lenovo-chatgpt-master",
    name: "Lenovo ChatGPT",
    provider: "ChatGPT",
    machine: "Lenovo",
    app: "Codex",
    status: "available",
    capacity: "normal",
    capabilities: ["orchestration", "merge", "proof", "implementation"],
    delivery: ["chat heartbeat", "GitHub"],
    currentJobs: 0,
    reliability: 94,
  },
  {
    id: "plex-chatgpt-worker",
    name: "Plex ChatGPT",
    provider: "ChatGPT",
    machine: "Plex",
    app: "Codex",
    status: "available",
    capacity: "fresh",
    capabilities: ["implementation", "proof", "status"],
    delivery: ["desktop bridge", "GitHub"],
    currentJobs: 0,
    reliability: 86,
  },
  {
    id: "plex-claude",
    name: "Plex Claude",
    provider: "Claude",
    machine: "Plex",
    app: "Claude Desktop",
    status: "available",
    capacity: "normal",
    capabilities: ["qc", "research", "planning"],
    delivery: ["chat heartbeat", "manual paste"],
    currentJobs: 0,
    reliability: 82,
  },
  {
    id: "lenovo-claude",
    name: "Lenovo Claude",
    provider: "Claude",
    machine: "Lenovo",
    app: "Claude Desktop",
    status: "standby",
    capacity: "unknown",
    capabilities: ["sentinel", "research", "planning", "safety"],
    delivery: ["manual paste"],
    currentJobs: 0,
    reliability: 72,
  },
];

export const LAUNCHPAD_ROOM_COVERAGE: LaunchpadRoomCoverage[] = [
  { room: "Jobs Room", status: "covered", primarySeat: "Plex ChatGPT", backupSeats: ["Lenovo ChatGPT"] },
  { room: "Build Room", status: "covered", primarySeat: "Plex ChatGPT", backupSeats: ["Lenovo ChatGPT"] },
  { room: "QC Room", status: "covered", primarySeat: "Plex Claude", backupSeats: ["Lenovo Claude"] },
  { room: "Safety Room", status: "thin", primarySeat: "Lenovo Claude", backupSeats: ["Lenovo ChatGPT"] },
  { room: "Research Room", status: "covered", primarySeat: "Plex Claude", backupSeats: ["Lenovo Claude"] },
  { room: "Planning Room", status: "covered", primarySeat: "Lenovo Claude", backupSeats: ["Plex Claude"] },
  { room: "Merge Room", status: "covered", primarySeat: "Lenovo Master", backupSeats: [] },
  { room: "Publish Room", status: "covered", primarySeat: "GitHub/Vercel", backupSeats: ["Lenovo ChatGPT"] },
];

export const LAUNCHPAD_SETUP_STEPS: LaunchpadSetupStep[] = [
  {
    id: "single-heartbeat",
    label: "Single master heartbeat",
    status: "next",
    detail: "Move toward one Launchpad heartbeat that wakes UnClick, not every worker chat.",
  },
  {
    id: "seat-registry",
    label: "Worker seat registry",
    status: "done",
    detail: "Treat ChatGPT and Claude accounts as capacity seats with capabilities, load, and delivery methods.",
  },
  {
    id: "orchestrator-lock",
    label: "Orchestrator lock",
    status: "done",
    detail: "Many chats can be control surfaces, but only one active orchestrator lease can steer.",
  },
  {
    id: "usage-metering",
    label: "Usage visibility",
    status: "watch",
    detail: "Add live or estimated account capacity so large jobs avoid near-limit seats.",
  },
];

export function summarizeLaunchpadSeats(seats = LAUNCHPAD_SEATS) {
  return seats.reduce(
    (summary, seat) => {
      summary.total += 1;
      summary.byProvider[seat.provider] = (summary.byProvider[seat.provider] ?? 0) + 1;
      summary.byCapacity[seat.capacity] = (summary.byCapacity[seat.capacity] ?? 0) + 1;
      if (seat.status === "available") summary.available += 1;
      if (seat.capabilities.includes("implementation")) summary.codeSeats += 1;
      return summary;
    },
    {
      total: 0,
      available: 0,
      codeSeats: 0,
      byProvider: {} as Record<LaunchpadSeat["provider"], number>,
      byCapacity: {} as Record<LaunchpadSeatCapacity, number>,
    },
  );
}

export function activeOrchestrator(orchestrators = LAUNCHPAD_ORCHESTRATORS) {
  return orchestrators.find((orchestrator) => orchestrator.role === "active") ?? null;
}

export function hasSplitBrain(orchestrators = LAUNCHPAD_ORCHESTRATORS) {
  return orchestrators.filter((orchestrator) => orchestrator.role === "active").length > 1;
}

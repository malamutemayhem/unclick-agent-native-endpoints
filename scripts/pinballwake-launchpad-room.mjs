#!/usr/bin/env node

import { readFile } from "node:fs/promises";

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function safeList(value) {
  return Array.isArray(value) ? value : [];
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function compactText(value, max = 800) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseMs(value) {
  const ms = Date.parse(String(value ?? ""));
  return Number.isFinite(ms) ? ms : null;
}

function leaseExpired(value, now = new Date().toISOString()) {
  const expiry = parseMs(value);
  const current = parseMs(now);
  return expiry !== null && current !== null && expiry <= current;
}

function seatId(seat = {}) {
  return compactText(seat.seat_id || seat.id || [seat.machine, seat.provider, seat.account].filter(Boolean).join("-"), 120);
}

function usageState(seat = {}) {
  const value = normalize(seat.usage?.remaining || seat.remaining_capacity || seat.capacity || "unknown");
  if (["none", "exhausted", "limit", "limited", "cooldown"].includes(value)) return "exhausted";
  if (["low", "near_limit", "tight"].includes(value)) return "low";
  if (["medium", "normal"].includes(value)) return "medium";
  if (["high", "fresh", "full"].includes(value)) return "high";
  return "unknown";
}

function hasDelivery(seat = {}) {
  return safeList(seat.delivery || seat.delivery_methods || seat.bridges).some(Boolean);
}

function normalizeSeat(seat = {}) {
  return {
    seat_id: seatId(seat),
    provider: compactText(seat.provider || "", 80),
    machine: compactText(seat.machine || "", 80),
    app: compactText(seat.app || seat.chat_app || "", 80),
    status: normalize(seat.status || "unknown"),
    capabilities: uniq(safeList(seat.capabilities || seat.skills).map(normalize)),
    delivery: uniq(safeList(seat.delivery || seat.delivery_methods || seat.bridges).map(normalize)),
    usage: usageState(seat),
    current_jobs: Number.isFinite(seat.current_jobs) ? seat.current_jobs : Number.parseInt(String(seat.currentJobs ?? 0), 10) || 0,
    last_seen_at: seat.last_seen_at || seat.lastSeenAt || null,
    reliability: Number.isFinite(seat.reliability) ? seat.reliability : null,
  };
}

const ROOM_REQUIREMENTS = {
  build: ["implementation", "code", "build"],
  proof: ["proof", "test", "implementation", "code"],
  qc: ["qc_review", "review", "qc"],
  safety: ["release_safety", "safety"],
  research: ["research", "planning", "context"],
  planning: ["planning", "research", "context"],
  merge: ["merge_proof", "master", "merge"],
  status: ["status_relay", "status"],
};

const DEFAULT_ROOMS = ["build", "proof", "qc", "safety", "research", "planning", "status"];

function capabilityMatches(seat, room) {
  const needed = ROOM_REQUIREMENTS[room] || [room];
  return needed.some((capability) => seat.capabilities.includes(capability));
}

function seatAvailable(seat, { allowLowCapacity = false } = {}) {
  if (!seat.seat_id) return false;
  if (["offline", "disabled", "blocked", "needs_setup"].includes(seat.status)) return false;
  if (!hasDelivery(seat)) return false;
  if (seat.usage === "exhausted") return false;
  if (!allowLowCapacity && seat.usage === "low") return false;
  return true;
}

function scoreSeat(seat, room) {
  let score = 0;
  if (seat.status === "available" || seat.status === "online") score += 30;
  if (seat.usage === "high") score += 25;
  if (seat.usage === "medium") score += 15;
  if (seat.usage === "unknown") score += 8;
  if (seat.usage === "low") score -= 20;
  if (Number.isFinite(seat.reliability)) score += Math.max(0, Math.min(20, seat.reliability / 5));
  score -= Math.max(0, seat.current_jobs) * 8;
  if (capabilityMatches(seat, room)) score += 40;
  return score;
}

function chooseSeatsForRoom(seats, room) {
  const available = seats
    .filter((seat) => seatAvailable(seat, { allowLowCapacity: room === "status" }))
    .filter((seat) => capabilityMatches(seat, room))
    .sort((a, b) => scoreSeat(b, room) - scoreSeat(a, room));
  return available;
}

function heartbeatReady(masterHeartbeat = {}) {
  if (!masterHeartbeat || Object.keys(masterHeartbeat).length === 0) return false;
  if (masterHeartbeat.enabled === false) return false;
  const target = normalize(masterHeartbeat.target || masterHeartbeat.room || masterHeartbeat.name);
  return target.includes("launchpad") || target.includes("autopilot") || target.includes("master");
}

function normalizeOrchestrator(input = {}) {
  return {
    seat_id: compactText(input.seat_id || input.seatId || input.id || "", 120),
    role: normalize(input.role || "standby"),
    status: normalize(input.status || "standby"),
    machine: compactText(input.machine || "", 80),
    provider: compactText(input.provider || "", 80),
    heartbeat_id: compactText(input.heartbeat_id || input.heartbeatId || "", 120),
    lease_expires_at: input.lease_expires_at || input.leaseExpiresAt || null,
  };
}

function evaluateOrchestratorControl({
  orchestrator,
  orchestrators = [],
  now = new Date().toISOString(),
} = {}) {
  const candidates = safeList(orchestrators).map(normalizeOrchestrator);
  if (orchestrator && Object.keys(orchestrator).length > 0) {
    candidates.push(normalizeOrchestrator({ ...orchestrator, role: orchestrator.role || "active" }));
  }

  const active = candidates.filter((candidate) =>
    ["active", "master", "orchestrator"].includes(candidate.role) ||
    ["active", "master", "orchestrating"].includes(candidate.status)
  );
  const liveActive = active.filter((candidate) =>
    !candidate.lease_expires_at || !leaseExpired(candidate.lease_expires_at, now)
  );
  const expiredActive = active.filter((candidate) =>
    candidate.lease_expires_at && leaseExpired(candidate.lease_expires_at, now)
  );

  if (liveActive.length === 1) {
    return {
      ready: true,
      result: "single_active_orchestrator",
      active_orchestrator: liveActive[0],
      standby_orchestrators: candidates.filter((candidate) => candidate.seat_id !== liveActive[0].seat_id),
    };
  }

  if (liveActive.length > 1) {
    return {
      ready: false,
      result: "split_brain",
      reason: "multiple_active_orchestrators",
      active_orchestrators: liveActive,
      standby_orchestrators: candidates.filter((candidate) => !liveActive.some((activeCandidate) => activeCandidate.seat_id === candidate.seat_id)),
    };
  }

  if (expiredActive.length > 0) {
    return {
      ready: false,
      result: "orchestrator_failover_ready",
      reason: "active_orchestrator_lease_expired",
      expired_orchestrators: expiredActive,
      standby_orchestrators: candidates.filter((candidate) => !expiredActive.some((expired) => expired.seat_id === candidate.seat_id)),
    };
  }

  return {
    ready: false,
    result: "missing_orchestrator",
    reason: "no_active_orchestrator",
    standby_orchestrators: candidates,
  };
}

export function createLaunchpadHeartbeatPrompt({
  minutes = 15,
  name = "UnClick Launchpad Autopilot heartbeat",
} = {}) {
  return `Set up a recurring heartbeat every ${minutes} minutes.

Identity:
I am the UnClick Launchpad Wizard. My job is to wake one master chat only, then let UnClick coordinate every worker seat, room, job, schedule, screenshot queue, and proof ledger.

On each heartbeat:
1. Open Launchpad Room.
2. Refresh worker seats, account capacity, active jobs, PRs/checks, Fishbowl/Coding Room ledgers, and stale work.
3. Decide one next safe action: stay quiet, create/update one job, route one worker packet, call one blocker, or ask Master for a merge/lift decision.
4. Do not directly spam every worker. Use UnClick rooms and delivery adapters.
5. Report to Chris only when material changed or Chris action is needed.

Safety:
No secrets, auth, billing, DNS/domains, migrations, raw keys, destructive cleanup, force-pushes, or draft/HOLD/DIRTY merges.

Name:
${name}`;
}

function setupStep(kind, detail, priority = 50) {
  return { kind, detail: compactText(detail), priority };
}

export function evaluateLaunchpadRoom({
  seats = [],
  rooms = DEFAULT_ROOMS,
  masterHeartbeat = {},
  orchestrator,
  orchestrators = [],
  legacyWorkerSchedules = [],
  heartbeatMinutes = 15,
  now = new Date().toISOString(),
} = {}) {
  const normalizedSeats = safeList(seats).map(normalizeSeat);
  const wantedRooms = safeList(rooms).length ? safeList(rooms).map(normalize) : DEFAULT_ROOMS;
  const setup = [];
  const orchestratorControl = evaluateOrchestratorControl({ orchestrator, orchestrators, now });

  if (!orchestratorControl.ready) {
    setup.push(setupStep(
      "resolve_orchestrator_control",
      orchestratorControl.reason || orchestratorControl.result,
      orchestratorControl.result === "split_brain" ? 110 : 95,
    ));
  }

  if (!heartbeatReady(masterHeartbeat)) {
    setup.push(setupStep("create_single_master_heartbeat", "Create one Launchpad/Autopilot heartbeat that wakes the master orchestrator only.", 100));
  }

  const legacy = safeList(legacyWorkerSchedules).filter((schedule) => normalize(schedule.status || "enabled") !== "disabled");
  if (legacy.length > 0) {
    setup.push(setupStep("consolidate_worker_schedules", `Consolidate ${legacy.length} worker schedules into Launchpad-managed routing.`, 85));
  }

  for (const seat of normalizedSeats) {
    if (!seat.provider || !seat.machine || !seat.app) {
      setup.push(setupStep("complete_worker_profile", `${seat.seat_id || "unknown seat"} needs provider, machine, and app.`, 80));
    }
    if (!hasDelivery(seat)) {
      setup.push(setupStep("connect_delivery_adapter", `${seat.seat_id || "unknown seat"} needs a delivery method such as desktop_bridge, api, github_action, or manual.`, 75));
    }
    if (seat.usage === "unknown") {
      setup.push(setupStep("add_capacity_hint", `${seat.seat_id || "unknown seat"} needs capacity/usage hint for load balancing.`, 35));
    }
  }

  const roomCoverage = wantedRooms.map((room) => {
    const candidates = chooseSeatsForRoom(normalizedSeats, room);
    if (candidates.length === 0) {
      setup.push(setupStep("add_room_coverage", `No available seat can currently cover ${room}.`, room === "build" || room === "safety" ? 90 : 60));
    }
    return {
      room,
      covered: candidates.length > 0,
      primary_seat: candidates[0]?.seat_id || null,
      candidate_seats: candidates.map((seat) => seat.seat_id),
    };
  });

  const criticalSetup = setup.filter((step) => step.priority >= 75);
  const result = criticalSetup.length === 0 ? "ready" : "setup_needed";
  const sortedSetup = setup.sort((a, b) => b.priority - a.priority || a.kind.localeCompare(b.kind));

  return {
    ok: true,
    action: "launchpad_room",
    result,
    reason: result === "ready" ? "launchpad_ready" : "setup_steps_required",
    single_heartbeat: {
      ready: heartbeatReady(masterHeartbeat),
      recommended_minutes: heartbeatMinutes,
      prompt: heartbeatReady(masterHeartbeat) ? null : createLaunchpadHeartbeatPrompt({ minutes: heartbeatMinutes }),
    },
    orchestrator_control: orchestratorControl,
    seats: normalizedSeats,
    room_coverage: roomCoverage,
    setup_steps: sortedSetup,
    legacy_worker_schedules: legacy.map((schedule) => ({
      id: schedule.id || schedule.name || "unknown",
      name: schedule.name || schedule.id || "worker schedule",
      action: "consolidate_under_launchpad",
    })),
    wizard_packet: {
      worker: "master",
      chip: "Launchpad onboarding wizard",
      context: "Register accounts/PCs as worker seats, consolidate worker schedules, and run one master heartbeat into Launchpad Room.",
      expected_proof: "Post seat registry, heartbeat status, missing adapters, and next safe setup step.",
      deadline: "next setup pulse",
      ack: "done/blocker",
    },
  };
}

export async function readLaunchpadRoomInput(filePath) {
  if (!filePath) return { ok: false, reason: "missing_input_path" };
  return JSON.parse(await readFile(filePath, "utf8"));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  readLaunchpadRoomInput(getArg("input", process.env.PINBALLWAKE_LAUNCHPAD_ROOM_INPUT || ""))
    .then((input) => evaluateLaunchpadRoom(input))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

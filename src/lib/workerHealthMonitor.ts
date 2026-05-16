// src/lib/workerHealthMonitor.ts
//
// Worker self-healing: heartbeat-timeout detection + reclaim recommendations
// + resume-safe classification.
//
// Closes UnClick todo "Worker self-healing: heartbeat timeout, reclaim, and
// resume-safe queue behavior" (green-lit efficiency build 2026-05-07).
//
// Today the dormant-owner-requeue authority knows HOW to release a stale
// claim once it's identified, but the identification step is ad-hoc. This
// module makes it deterministic:
//
//   evaluateFleetHealth({ seats, now, options })
//     -> { healthy, idle, stale, suspected_dead, reclaim_recommendations }
//
// Reclaim recommendations are paired with each seat's open claims so the
// caller can act on the runbook's authority surface (post comment + clear
// owner field) without ambiguity.

export interface SeatSnapshot {
  /** Stable seat id, e.g. "pinballwake-job-runner". */
  id: string;
  /** ISO 8601 timestamp of last observed heartbeat / activity. */
  last_seen: string | null;
  /** Claims this seat currently holds: todoIds the seat is the owner of. */
  open_claims: ReadonlyArray<{
    todo_id: string;
    /** When this seat claimed the todo. */
    claimed_at: string | null;
    /** Optional ETA the seat declared on claim. */
    eta: string | null;
    /**
     * Whether the open work is resume-safe, meaning another seat can pick up
     * mid-stream without losing data. Defaults to false when unknown.
     */
    resume_safe?: boolean;
  }>;
  /** Optional override: if true, the seat is treated as healthy regardless of last_seen. */
  pinned_healthy?: boolean;
}

export type SeatStatus = "healthy" | "idle" | "stale" | "suspected_dead";

export interface WorkerHealth {
  seat: SeatSnapshot;
  status: SeatStatus;
  ageMs: number | null;
  /** Reclaim recommendations bucketed by safety. */
  reclaim: ReclaimRecommendation[];
}

export interface ReclaimRecommendation {
  todo_id: string;
  /** Reason class: caller can route on this. */
  reason:
    | "seat_stale"
    | "seat_suspected_dead"
    | "claim_eta_expired"
    | "claim_no_progress";
  /** Whether it's safe to release without coordinating with the original seat. */
  safe_to_release: boolean;
  /** Free-text detail for proof comments. */
  detail: string;
}

export interface HealthOptions {
  /** Milliseconds before a seat moves from healthy to idle. Default 30 min. */
  idleThresholdMs?: number;
  /** Milliseconds before idle to stale. Default 4 hours. */
  staleThresholdMs?: number;
  /** Milliseconds before stale to suspected_dead. Default 24 hours. */
  deadThresholdMs?: number;
  /** Milliseconds after a claim's ETA before it's considered "expired" (regardless of seat health). Default 1 hour. */
  etaGraceMs?: number;
}

const DEFAULT_OPTIONS: Required<HealthOptions> = {
  idleThresholdMs: 30 * 60 * 1000,        // 30 min
  staleThresholdMs: 4 * 60 * 60 * 1000,   // 4 h
  deadThresholdMs: 24 * 60 * 60 * 1000,   // 24 h
  etaGraceMs: 60 * 60 * 1000,             // 1 h
};

export function evaluateSeatHealth(
  seat: SeatSnapshot,
  now: Date = new Date(),
  options: HealthOptions = {},
): WorkerHealth {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (seat.pinned_healthy) {
    return { seat, status: "healthy", ageMs: 0, reclaim: [] };
  }

  let ageMs: number | null = null;
  let status: SeatStatus = "suspected_dead";
  if (seat.last_seen) {
    const last = new Date(seat.last_seen);
    if (!Number.isNaN(last.getTime())) {
      ageMs = now.getTime() - last.getTime();
      if (ageMs < opts.idleThresholdMs) status = "healthy";
      else if (ageMs < opts.staleThresholdMs) status = "idle";
      else if (ageMs < opts.deadThresholdMs) status = "stale";
      else status = "suspected_dead";
    }
  }

  const reclaim: ReclaimRecommendation[] = [];
  for (const claim of seat.open_claims) {
    // Reason 1: seat-level health
    if (status === "stale") {
      reclaim.push({
        todo_id: claim.todo_id,
        reason: "seat_stale",
        safe_to_release: Boolean(claim.resume_safe),
        detail: `seat ${seat.id} last seen ${seat.last_seen ?? "unknown"} (age ${formatMs(ageMs)}); claim is stale per fleet policy.`,
      });
      continue;
    }
    if (status === "suspected_dead") {
      reclaim.push({
        todo_id: claim.todo_id,
        reason: "seat_suspected_dead",
        // Suspected-dead seats are safer to reclaim because the original is unlikely to return.
        safe_to_release: true,
        detail: `seat ${seat.id} last seen ${seat.last_seen ?? "unknown"} (age ${formatMs(ageMs)}); presumed dead per fleet policy.`,
      });
      continue;
    }

    // Reason 2: ETA expired even if seat is healthy/idle
    if (claim.eta) {
      const etaTime = new Date(claim.eta).getTime();
      if (Number.isFinite(etaTime) && now.getTime() - etaTime > opts.etaGraceMs) {
        reclaim.push({
          todo_id: claim.todo_id,
          reason: "claim_eta_expired",
          safe_to_release: Boolean(claim.resume_safe),
          detail: `claim ETA was ${claim.eta}; ${formatMs(now.getTime() - etaTime)} past with no PASS receipt.`,
        });
      }
    }
  }

  return { seat, status, ageMs, reclaim };
}

export interface FleetHealthReport {
  evaluated_at: string;
  options: Required<HealthOptions>;
  per_seat: WorkerHealth[];
  /** Convenience buckets: same objects, grouped. */
  buckets: {
    healthy: WorkerHealth[];
    idle: WorkerHealth[];
    stale: WorkerHealth[];
    suspected_dead: WorkerHealth[];
  };
  /** Flat list of all reclaim recommendations. */
  reclaim_recommendations: ReclaimRecommendation[];
}

export function evaluateFleetHealth(
  seats: ReadonlyArray<SeatSnapshot>,
  now: Date = new Date(),
  options: HealthOptions = {},
): FleetHealthReport {
  const opts: Required<HealthOptions> = { ...DEFAULT_OPTIONS, ...options };
  const per_seat = seats.map((s) => evaluateSeatHealth(s, now, opts));

  const buckets = {
    healthy: per_seat.filter((p) => p.status === "healthy"),
    idle: per_seat.filter((p) => p.status === "idle"),
    stale: per_seat.filter((p) => p.status === "stale"),
    suspected_dead: per_seat.filter((p) => p.status === "suspected_dead"),
  };

  const reclaim_recommendations: ReclaimRecommendation[] = [];
  for (const p of per_seat) reclaim_recommendations.push(...p.reclaim);

  return {
    evaluated_at: now.toISOString(),
    options: opts,
    per_seat,
    buckets,
    reclaim_recommendations,
  };
}

/**
 * Convenience: list of todo_ids the caller can safely release without
 * coordinating (resume_safe=true OR seat is suspected_dead).
 */
export function safeReleaseTargets(report: FleetHealthReport): string[] {
  return report.reclaim_recommendations
    .filter((r) => r.safe_to_release)
    .map((r) => r.todo_id);
}

/**
 * Convenience: list of todo_ids that need coordinator review before release
 * (stale seats with non-resume-safe claims).
 */
export function pendingCoordinatorReview(report: FleetHealthReport): ReclaimRecommendation[] {
  return report.reclaim_recommendations.filter((r) => !r.safe_to_release);
}

function formatMs(ms: number | null): string {
  if (ms === null) return "unknown";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h${m % 60 ? ` ${m % 60}m` : ""}`;
  const d = Math.floor(h / 24);
  return `${d}d${h % 24 ? ` ${h % 24}h` : ""}`;
}

export const __testing__ = { DEFAULT_OPTIONS, formatMs };

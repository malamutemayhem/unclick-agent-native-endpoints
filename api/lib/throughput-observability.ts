type DispatchStatus = "queued" | "leased" | "completed" | "failed" | "stale" | "cancelled";

export type ThroughputDispatchRow = {
  dispatch_id: string;
  source: string;
  target_agent_id: string;
  task_ref: string | null;
  status: DispatchStatus;
  lease_owner: string | null;
  lease_expires_at: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type DispatchThroughputMetrics = {
  total_dispatches: number;
  queued_dispatches: number;
  leased_dispatches: number;
  completed_dispatches: number;
  failed_dispatches: number;
  stale_dispatches: number;
  cancelled_dispatches: number;
  duplicate_dispatch_count: number;
  collision_count: number;
  wasted_work_dispatches: number;
  oldest_queue_age_seconds: number;
  average_queue_age_seconds: number;
  max_claim_age_seconds: number;
  lease_owner_counts: Record<string, number>;
  blocker_reason_counts: Record<string, number>;
};

export type ThroughputDecoratedDispatch<T extends ThroughputDispatchRow> = T & {
  queue_age_seconds: number | null;
  claim_age_seconds: number | null;
};

function secondsSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor((now.getTime() - ms) / 1000));
}

function increment(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function activeCollisionKey(row: ThroughputDispatchRow): string | null {
  if (row.status !== "queued" && row.status !== "leased") return null;
  return [row.source, row.target_agent_id, row.task_ref ?? ""].join("|");
}

function blockerReason(row: ThroughputDispatchRow): string | null {
  const payload = row.payload ?? {};
  const raw = payload.blocker_reason ?? payload.blocker ?? payload.failure_reason;
  return typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 120) : null;
}

export function decorateThroughputDispatch<T extends ThroughputDispatchRow>(
  row: T,
  now = new Date(),
): ThroughputDecoratedDispatch<T> {
  return {
    ...row,
    queue_age_seconds: row.status === "queued" ? secondsSince(row.created_at, now) : null,
    claim_age_seconds: row.status === "leased" ? secondsSince(row.updated_at, now) : null,
  };
}

export function createDispatchThroughputMetrics(
  rows: ThroughputDispatchRow[],
  now = new Date(),
): DispatchThroughputMetrics {
  const metrics: DispatchThroughputMetrics = {
    total_dispatches: rows.length,
    queued_dispatches: 0,
    leased_dispatches: 0,
    completed_dispatches: 0,
    failed_dispatches: 0,
    stale_dispatches: 0,
    cancelled_dispatches: 0,
    duplicate_dispatch_count: 0,
    collision_count: 0,
    wasted_work_dispatches: 0,
    oldest_queue_age_seconds: 0,
    average_queue_age_seconds: 0,
    max_claim_age_seconds: 0,
    lease_owner_counts: {},
    blocker_reason_counts: {},
  };

  const dispatchIds = new Map<string, number>();
  const activeCollisions = new Map<string, number>();
  let queueAgeTotal = 0;
  let queueAgeCount = 0;

  for (const row of rows) {
    dispatchIds.set(row.dispatch_id, (dispatchIds.get(row.dispatch_id) ?? 0) + 1);
    if (row.status === "queued") {
      metrics.queued_dispatches++;
      const age = secondsSince(row.created_at, now);
      if (age !== null) {
        queueAgeTotal += age;
        queueAgeCount++;
        metrics.oldest_queue_age_seconds = Math.max(metrics.oldest_queue_age_seconds, age);
      }
    }
    if (row.status === "leased") {
      metrics.leased_dispatches++;
      const claimAge = secondsSince(row.updated_at, now);
      if (claimAge !== null) {
        metrics.max_claim_age_seconds = Math.max(metrics.max_claim_age_seconds, claimAge);
      }
      if (row.lease_owner) increment(metrics.lease_owner_counts, row.lease_owner);
    }
    if (row.status === "completed") metrics.completed_dispatches++;
    if (row.status === "failed") metrics.failed_dispatches++;
    if (row.status === "stale") metrics.stale_dispatches++;
    if (row.status === "cancelled") metrics.cancelled_dispatches++;

    const collisionKey = activeCollisionKey(row);
    if (collisionKey) activeCollisions.set(collisionKey, (activeCollisions.get(collisionKey) ?? 0) + 1);

    const reason = blockerReason(row);
    if (reason) increment(metrics.blocker_reason_counts, reason);
  }

  for (const count of dispatchIds.values()) {
    if (count > 1) metrics.duplicate_dispatch_count += count - 1;
  }
  for (const count of activeCollisions.values()) {
    if (count > 1) metrics.collision_count += count - 1;
  }

  metrics.wasted_work_dispatches =
    metrics.failed_dispatches + metrics.stale_dispatches + metrics.cancelled_dispatches;
  metrics.average_queue_age_seconds =
    queueAgeCount > 0 ? Math.round(queueAgeTotal / queueAgeCount) : 0;

  return metrics;
}

export function shouldIncludeThroughputMetrics(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

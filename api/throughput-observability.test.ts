import { describe, expect, it } from "vitest";

import {
  createDispatchThroughputMetrics,
  decorateThroughputDispatch,
  shouldIncludeThroughputMetrics,
  type ThroughputDispatchRow,
} from "./lib/throughput-observability";

const baseRow: ThroughputDispatchRow = {
  dispatch_id: "dispatch_a",
  source: "wakepass",
  target_agent_id: "reviewer",
  task_ref: "pr-123",
  status: "queued",
  lease_owner: null,
  lease_expires_at: null,
  payload: null,
  created_at: "2026-05-07T10:00:00.000Z",
  updated_at: "2026-05-07T10:00:00.000Z",
};

describe("throughput observability helpers", () => {
  it("decorates queued and leased dispatches with age fields", () => {
    const now = new Date("2026-05-07T10:05:00.000Z");
    const queued = decorateThroughputDispatch(baseRow, now);
    const leased = decorateThroughputDispatch(
      {
        ...baseRow,
        status: "leased",
        lease_owner: "reviewer",
        updated_at: "2026-05-07T10:03:00.000Z",
      },
      now,
    );

    expect(queued.queue_age_seconds).toBe(300);
    expect(queued.claim_age_seconds).toBeNull();
    expect(leased.queue_age_seconds).toBeNull();
    expect(leased.claim_age_seconds).toBe(120);
  });

  it("summarizes queue age, collisions, duplicates, lease owners, and wasted work", () => {
    const now = new Date("2026-05-07T10:10:00.000Z");
    const rows: ThroughputDispatchRow[] = [
      baseRow,
      {
        ...baseRow,
        dispatch_id: "dispatch_b",
        created_at: "2026-05-07T10:05:00.000Z",
      },
      {
        ...baseRow,
        dispatch_id: "dispatch_b",
        status: "leased",
        lease_owner: "reviewer",
        updated_at: "2026-05-07T10:08:00.000Z",
      },
      {
        ...baseRow,
        dispatch_id: "dispatch_c",
        status: "failed",
        task_ref: "pr-456",
        payload: { blocker_reason: "ci_failed" },
      },
      {
        ...baseRow,
        dispatch_id: "dispatch_d",
        status: "stale",
        task_ref: "pr-789",
      },
    ];

    expect(createDispatchThroughputMetrics(rows, now)).toMatchObject({
      total_dispatches: 5,
      queued_dispatches: 2,
      leased_dispatches: 1,
      failed_dispatches: 1,
      stale_dispatches: 1,
      duplicate_dispatch_count: 1,
      collision_count: 2,
      wasted_work_dispatches: 2,
      oldest_queue_age_seconds: 600,
      average_queue_age_seconds: 450,
      max_claim_age_seconds: 120,
      lease_owner_counts: { reviewer: 1 },
      blocker_reason_counts: { ci_failed: 1 },
    });
  });

  it("parses the include metrics flag safely", () => {
    expect(shouldIncludeThroughputMetrics(true)).toBe(true);
    expect(shouldIncludeThroughputMetrics("true")).toBe(true);
    expect(shouldIncludeThroughputMetrics("1")).toBe(true);
    expect(shouldIncludeThroughputMetrics("yes")).toBe(true);
    expect(shouldIncludeThroughputMetrics("no")).toBe(false);
    expect(shouldIncludeThroughputMetrics(undefined)).toBe(false);
  });
});

// src/lib/workerHealthMonitor.test.ts

import { describe, test, expect } from "vitest";
import {
  evaluateSeatHealth,
  evaluateFleetHealth,
  safeReleaseTargets,
  pendingChrisDecision,
  __testing__,
  type SeatSnapshot,
} from "./workerHealthMonitor";

const NOW = new Date("2026-05-15T12:00:00Z");

function isoMinus(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString();
}

function seat(overrides: Partial<SeatSnapshot> & { id: string }): SeatSnapshot {
  return {
    id: overrides.id,
    last_seen: overrides.last_seen ?? NOW.toISOString(),
    open_claims: overrides.open_claims ?? [],
    pinned_healthy: overrides.pinned_healthy,
  };
}

describe("evaluateSeatHealth — status thresholds", () => {
  test("healthy when last_seen within idle threshold", () => {
    const r = evaluateSeatHealth(seat({ id: "A", last_seen: isoMinus(15 * 60 * 1000) }), NOW);
    expect(r.status).toBe("healthy");
  });

  test("idle when between idle and stale thresholds", () => {
    const r = evaluateSeatHealth(seat({ id: "A", last_seen: isoMinus(60 * 60 * 1000) }), NOW);
    expect(r.status).toBe("idle");
  });

  test("stale when between stale and dead thresholds", () => {
    const r = evaluateSeatHealth(seat({ id: "A", last_seen: isoMinus(6 * 60 * 60 * 1000) }), NOW);
    expect(r.status).toBe("stale");
  });

  test("suspected_dead beyond dead threshold", () => {
    const r = evaluateSeatHealth(seat({ id: "A", last_seen: isoMinus(48 * 60 * 60 * 1000) }), NOW);
    expect(r.status).toBe("suspected_dead");
  });

  test("suspected_dead when last_seen is null", () => {
    const r = evaluateSeatHealth(seat({ id: "A", last_seen: null }), NOW);
    expect(r.status).toBe("suspected_dead");
  });

  test("pinned_healthy overrides everything", () => {
    const r = evaluateSeatHealth(
      seat({ id: "A", last_seen: isoMinus(48 * 60 * 60 * 1000), pinned_healthy: true }),
      NOW,
    );
    expect(r.status).toBe("healthy");
    expect(r.reclaim).toEqual([]);
  });
});

describe("evaluateSeatHealth — reclaim recommendations", () => {
  test("stale seat with resume-safe claim → safe_to_release true", () => {
    const r = evaluateSeatHealth(
      seat({
        id: "A",
        last_seen: isoMinus(6 * 60 * 60 * 1000),
        open_claims: [{ todo_id: "T1", claimed_at: isoMinus(8 * 60 * 60 * 1000), eta: null, resume_safe: true }],
      }),
      NOW,
    );
    expect(r.reclaim.length).toBe(1);
    expect(r.reclaim[0].reason).toBe("seat_stale");
    expect(r.reclaim[0].safe_to_release).toBe(true);
  });

  test("stale seat with non-resume-safe claim → safe_to_release false (needs human OK)", () => {
    const r = evaluateSeatHealth(
      seat({
        id: "A",
        last_seen: isoMinus(6 * 60 * 60 * 1000),
        open_claims: [{ todo_id: "T1", claimed_at: isoMinus(8 * 60 * 60 * 1000), eta: null, resume_safe: false }],
      }),
      NOW,
    );
    expect(r.reclaim[0].safe_to_release).toBe(false);
  });

  test("suspected_dead seat — always safe_to_release true", () => {
    const r = evaluateSeatHealth(
      seat({
        id: "A",
        last_seen: isoMinus(48 * 60 * 60 * 1000),
        open_claims: [{ todo_id: "T1", claimed_at: null, eta: null, resume_safe: false }],
      }),
      NOW,
    );
    expect(r.reclaim[0].reason).toBe("seat_suspected_dead");
    expect(r.reclaim[0].safe_to_release).toBe(true);
  });

  test("healthy seat but ETA expired → claim_eta_expired recommendation", () => {
    const r = evaluateSeatHealth(
      seat({
        id: "A",
        last_seen: isoMinus(5 * 60 * 1000),
        open_claims: [
          { todo_id: "T1", claimed_at: isoMinus(60 * 60 * 1000), eta: isoMinus(2 * 60 * 60 * 1000), resume_safe: true },
        ],
      }),
      NOW,
    );
    expect(r.status).toBe("healthy");
    expect(r.reclaim.length).toBe(1);
    expect(r.reclaim[0].reason).toBe("claim_eta_expired");
  });

  test("ETA recently passed but inside grace window → no recommendation", () => {
    const r = evaluateSeatHealth(
      seat({
        id: "A",
        last_seen: isoMinus(5 * 60 * 1000),
        open_claims: [
          { todo_id: "T1", claimed_at: isoMinus(60 * 60 * 1000), eta: isoMinus(15 * 60 * 1000), resume_safe: true },
        ],
      }),
      NOW,
    );
    expect(r.reclaim.length).toBe(0);
  });

  test("healthy seat with no claims → no recommendations", () => {
    const r = evaluateSeatHealth(seat({ id: "A" }), NOW);
    expect(r.reclaim).toEqual([]);
  });
});

describe("evaluateFleetHealth", () => {
  test("buckets seats correctly", () => {
    const report = evaluateFleetHealth(
      [
        seat({ id: "fresh", last_seen: isoMinus(5 * 60 * 1000) }),
        seat({ id: "lunch", last_seen: isoMinus(45 * 60 * 1000) }),
        seat({ id: "stale", last_seen: isoMinus(5 * 60 * 60 * 1000) }),
        seat({ id: "dead",  last_seen: isoMinus(48 * 60 * 60 * 1000) }),
      ],
      NOW,
    );
    expect(report.buckets.healthy.map((p) => p.seat.id)).toEqual(["fresh"]);
    expect(report.buckets.idle.map((p) => p.seat.id)).toEqual(["lunch"]);
    expect(report.buckets.stale.map((p) => p.seat.id)).toEqual(["stale"]);
    expect(report.buckets.suspected_dead.map((p) => p.seat.id)).toEqual(["dead"]);
  });

  test("aggregates reclaim_recommendations from all seats", () => {
    const report = evaluateFleetHealth(
      [
        seat({
          id: "stale",
          last_seen: isoMinus(5 * 60 * 60 * 1000),
          open_claims: [{ todo_id: "T1", claimed_at: null, eta: null }],
        }),
        seat({
          id: "dead",
          last_seen: isoMinus(48 * 60 * 60 * 1000),
          open_claims: [{ todo_id: "T2", claimed_at: null, eta: null }],
        }),
        seat({ id: "fresh", last_seen: isoMinus(5 * 60 * 1000) }),
      ],
      NOW,
    );
    const ids = report.reclaim_recommendations.map((r) => r.todo_id).sort();
    expect(ids).toEqual(["T1", "T2"]);
  });

  test("options can tighten thresholds", () => {
    const report = evaluateFleetHealth(
      [seat({ id: "A", last_seen: isoMinus(15 * 60 * 1000) })],
      NOW,
      { idleThresholdMs: 5 * 60 * 1000 },
    );
    expect(report.buckets.idle.map((p) => p.seat.id)).toEqual(["A"]);
  });
});

describe("safeReleaseTargets and pendingChrisDecision", () => {
  test("safeReleaseTargets only lists todos with safe_to_release true", () => {
    const report = evaluateFleetHealth(
      [
        seat({
          id: "stale-safe",
          last_seen: isoMinus(5 * 60 * 60 * 1000),
          open_claims: [{ todo_id: "T1", claimed_at: null, eta: null, resume_safe: true }],
        }),
        seat({
          id: "stale-unsafe",
          last_seen: isoMinus(5 * 60 * 60 * 1000),
          open_claims: [{ todo_id: "T2", claimed_at: null, eta: null, resume_safe: false }],
        }),
      ],
      NOW,
    );
    expect(safeReleaseTargets(report)).toEqual(["T1"]);
    expect(pendingChrisDecision(report).map((r) => r.todo_id)).toEqual(["T2"]);
  });
});

describe("humaniseMs (internal)", () => {
  const { humaniseMs } = __testing__;
  test("renders seconds / minutes / hours / days", () => {
    expect(humaniseMs(null)).toBe("unknown");
    expect(humaniseMs(30 * 1000)).toBe("30s");
    expect(humaniseMs(5 * 60 * 1000)).toBe("5m");
    expect(humaniseMs(3 * 60 * 60 * 1000)).toBe("3h");
    expect(humaniseMs((3 * 60 + 15) * 60 * 1000)).toMatch(/^3h.*15m/);
    expect(humaniseMs(72 * 60 * 60 * 1000)).toMatch(/^3d/);
  });
});

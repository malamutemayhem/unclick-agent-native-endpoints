import { describe, expect, it } from "vitest";
import {
  inspectOrchestratorActiveState,
  toTodoSnapshots,
} from "./lib/commonsensepass-bridge.js";

const NOW = Date.parse("2026-05-12T22:00:00Z");
const oneHourAgo = new Date(NOW - 60 * 60 * 1000).toISOString();
const twoDaysAgo = new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString();

describe("commonsensepass-bridge / toTodoSnapshots", () => {
  it("maps orchestrator status open -> actionable", () => {
    const snaps = toTodoSnapshots(
      [{ id: "t1", status: "open" }],
      [],
    );
    expect(snaps[0].status).toBe("actionable");
  });

  it("preserves in_progress and derives owner_last_seen_ms from profile", () => {
    const snaps = toTodoSnapshots(
      [
        {
          id: "t2",
          status: "in_progress",
          assigned_to_agent_id: "worker-a",
        },
      ],
      [
        {
          agent_id: "worker-a",
          last_seen_at: oneHourAgo,
        },
      ],
    );
    expect(snaps[0].status).toBe("in_progress");
    expect(snaps[0].owner).toBe("worker-a");
    expect(snaps[0].owner_last_seen_ms).toBe(Date.parse(oneHourAgo));
  });

  it("falls back to profile created_at if last_seen_at missing", () => {
    const snaps = toTodoSnapshots(
      [{ id: "t3", status: "in_progress", assigned_to_agent_id: "w" }],
      [{ agent_id: "w", created_at: oneHourAgo }],
    );
    expect(snaps[0].owner_last_seen_ms).toBe(Date.parse(oneHourAgo));
  });

  it("treats dropped as done (off the queue)", () => {
    const snaps = toTodoSnapshots(
      [{ id: "t4", status: "dropped" }],
      [],
    );
    expect(snaps[0].status).toBe("done");
  });
});

describe("commonsensepass-bridge / inspectOrchestratorActiveState", () => {
  it("BLOCKER when orchestrator has open todos but worker claims healthy", () => {
    const verdict = inspectOrchestratorActiveState({
      todos: [
        { id: "t1", status: "open", assigned_to_agent_id: null },
        { id: "t2", status: "open", assigned_to_agent_id: null },
      ],
      profiles: [],
      active_jobs: 0,
      now_ms: NOW,
    });
    expect(verdict.verdict).toBe("BLOCKER");
    expect(verdict.rule_id).toBe("R1");
    expect(verdict.next_action).toBe("hydrate_queue_and_claim_one");
  });

  it("BLOCKER when active_jobs=0 but in_progress todo has a fresh owner", () => {
    const verdict = inspectOrchestratorActiveState({
      todos: [
        {
          id: "t10",
          status: "in_progress",
          assigned_to_agent_id: "worker-a",
        },
      ],
      profiles: [
        { agent_id: "worker-a", last_seen_at: oneHourAgo },
      ],
      active_jobs: 0,
      now_ms: NOW,
    });
    expect(verdict.verdict).toBe("BLOCKER");
    expect(verdict.rule_id).toBe("R1");
    expect(verdict.next_action).toBe("recompute_active_jobs_with_pinned_formula");
  });

  it("PASS when in_progress owner is stale (older than 24h)", () => {
    const verdict = inspectOrchestratorActiveState({
      todos: [
        {
          id: "t11",
          status: "in_progress",
          assigned_to_agent_id: "worker-b",
        },
      ],
      profiles: [
        { agent_id: "worker-b", last_seen_at: twoDaysAgo },
      ],
      active_jobs: 0,
      now_ms: NOW,
    });
    expect(verdict.verdict).toBe("PASS");
    expect(verdict.rule_id).toBe("R1");
  });

  it("PASS when active_jobs matches fresh-owner in_progress count", () => {
    const verdict = inspectOrchestratorActiveState({
      todos: [
        {
          id: "t12",
          status: "in_progress",
          assigned_to_agent_id: "worker-c",
        },
      ],
      profiles: [
        { agent_id: "worker-c", last_seen_at: oneHourAgo },
      ],
      active_jobs: 1,
      now_ms: NOW,
    });
    expect(verdict.verdict).toBe("PASS");
    expect(verdict.rule_id).toBe("R1");
  });

  it("PASS when queue is empty and active_jobs=0", () => {
    const verdict = inspectOrchestratorActiveState({
      todos: [],
      profiles: [],
      active_jobs: 0,
      now_ms: NOW,
    });
    expect(verdict.verdict).toBe("PASS");
    expect(verdict.rule_id).toBe("R1");
  });

  it("uses default claim 'healthy' when claim is not provided", () => {
    const verdict = inspectOrchestratorActiveState({
      todos: [{ id: "t20", status: "open" }],
      profiles: [],
      active_jobs: 0,
      now_ms: NOW,
    });
    // Default claim ('healthy') still triggers R1 BLOCKER on actionable queue
    expect(verdict.verdict).toBe("BLOCKER");
  });

  it("works with 'quiet' or 'no_work' claim variants", () => {
    for (const claim of ["quiet", "no_work"] as const) {
      const verdict = inspectOrchestratorActiveState({
        claim,
        todos: [{ id: `t-${claim}`, status: "open" }],
        profiles: [],
        active_jobs: 0,
        now_ms: NOW,
      });
      expect(verdict.verdict).toBe("BLOCKER");
      expect(verdict.rule_id).toBe("R1");
    }
  });
});

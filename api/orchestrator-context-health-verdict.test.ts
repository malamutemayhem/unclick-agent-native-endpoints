import { describe, expect, it } from "vitest";
import { buildOrchestratorContext } from "./lib/orchestrator-context.js";

describe("orchestrator-context / current_state_card.health_verdict (CommonSensePass R1)", () => {
  const NOW = "2026-05-12T12:00:00.000Z";
  const NOW_MS = Date.parse(NOW);
  const HOUR_MS = 60 * 60 * 1000;

  it("emits a PASS verdict when the queue is empty and active_jobs is 0", () => {
    const context = buildOrchestratorContext({
      generatedAt: NOW,
      profiles: [],
      messages: [],
      todos: [],
      comments: [],
      dispatches: [],
      signals: [],
      sessions: [],
      library: [],
      businessContext: [],
      conversationTurns: [],
    });
    expect(context.current_state_card.health_verdict.verdict).toBe("PASS");
    expect(context.current_state_card.health_verdict.rule_id).toBe("R1");
  });

  it("emits a BLOCKER verdict when open todos sit in the queue", () => {
    const context = buildOrchestratorContext({
      generatedAt: NOW,
      profiles: [],
      messages: [],
      todos: [
        {
          id: "todo-actionable",
          title: "Backlog item",
          status: "open",
          priority: "urgent",
          created_by_agent_id: "watcher",
          assigned_to_agent_id: null,
          created_at: NOW,
        },
      ],
      comments: [],
      dispatches: [],
      signals: [],
      sessions: [],
      library: [],
      businessContext: [],
      conversationTurns: [],
    });
    expect(context.current_state_card.health_verdict.verdict).toBe("BLOCKER");
    expect(context.current_state_card.health_verdict.rule_id).toBe("R1");
    expect(context.current_state_card.health_verdict.next_action).toBe(
      "hydrate_queue_and_claim_one",
    );
    // active_jobs should also be 0 (no in_progress todos), so the BLOCKER is
    // entirely driven by the actionable queue depth.
    expect(context.current_state_card.active_jobs).toBe(0);
  });

  it("emits a PASS verdict when active_jobs matches a single fresh-owner in_progress todo", () => {
    const context = buildOrchestratorContext({
      generatedAt: NOW,
      profiles: [
        {
          agent_id: "builder-fresh",
          last_seen_at: new Date(NOW_MS - 2 * HOUR_MS).toISOString(),
        },
      ],
      messages: [],
      todos: [
        {
          id: "todo-active",
          title: "Active build",
          status: "in_progress",
          priority: "urgent",
          created_by_agent_id: "watcher",
          assigned_to_agent_id: "builder-fresh",
          created_at: NOW,
        },
      ],
      comments: [],
      dispatches: [],
      signals: [],
      sessions: [],
      library: [],
      businessContext: [],
      conversationTurns: [],
    });
    expect(context.current_state_card.active_jobs).toBe(1);
    expect(context.current_state_card.health_verdict.verdict).toBe("PASS");
    expect(context.current_state_card.health_verdict.rule_id).toBe("R1");
  });

  it("verdict and active_jobs are computed from the same source so they cannot disagree", () => {
    // A dormant-owner in_progress todo: active_jobs sees it as 0 (owner stale),
    // and R1 sees no actionable queue AND no fresh-owner in_progress. The
    // verdict must therefore be PASS, never BLOCKER. This is the contract
    // pinned by PR #735: state_card and the gate read the same input.
    const context = buildOrchestratorContext({
      generatedAt: NOW,
      profiles: [
        {
          agent_id: "builder-stale",
          last_seen_at: new Date(NOW_MS - 6 * 24 * HOUR_MS).toISOString(),
        },
      ],
      messages: [],
      todos: [
        {
          id: "todo-dormant",
          title: "Dormant build",
          status: "in_progress",
          priority: "urgent",
          created_by_agent_id: "watcher",
          assigned_to_agent_id: "builder-stale",
          created_at: NOW,
        },
      ],
      comments: [],
      dispatches: [],
      signals: [],
      sessions: [],
      library: [],
      businessContext: [],
      conversationTurns: [],
    });
    expect(context.current_state_card.active_jobs).toBe(0);
    expect(context.current_state_card.health_verdict.verdict).toBe("PASS");
  });
});

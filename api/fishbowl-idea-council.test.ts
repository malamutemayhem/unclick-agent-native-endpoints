import { describe, expect, it } from "vitest";
import {
  buildFishbowlIdeaCouncilDispatchRow,
  FISHBOWL_IDEA_COUNCIL_LEASE_SECONDS,
  planFishbowlIdeaCouncilHandoffs,
} from "./lib/fishbowl-idea-council";
import { createDispatchId, createReclaimSignal } from "../packages/mcp-server/src/reliability";

const profiles = [
  {
    agentId: "agent_author",
    emoji: "A",
    lastSeenAt: "2026-05-01T01:00:00.000Z",
  },
  {
    agentId: "agent_builder",
    emoji: "B",
    lastSeenAt: "2026-05-01T03:00:00.000Z",
  },
  {
    agentId: "agent_qc",
    emoji: "Q",
    currentStatusUpdatedAt: "2026-05-01T02:30:00.000Z",
  },
  {
    agentId: "human_chris",
    emoji: "C",
    userAgentHint: "admin-ui",
    lastSeenAt: "2026-05-01T03:15:00.000Z",
  },
];

const baseInput = {
  ideaId: "idea-abc",
  title: "Make Ideas ask the council",
  description: "When a new idea arrives, ask a small AI quorum to comment or vote.",
  createdByAgentId: "agent_author",
  profiles,
};

describe("planFishbowlIdeaCouncilHandoffs", () => {
  it("produces ACK-required dispatch plans for a new idea council review", () => {
    const plans = planFishbowlIdeaCouncilHandoffs(baseInput);

    expect(plans).toHaveLength(2);
    expect(plans[0]).toMatchObject({
      source: "fishbowl",
      targetAgentId: "agent_builder",
      taskRef: "fishbowl-idea:idea-abc",
      leaseSeconds: FISHBOWL_IDEA_COUNCIL_LEASE_SECONDS,
      payload: {
        kind: "idea_council_review",
        idea_id: "idea-abc",
        title: "Make Ideas ask the council",
        summary: "When a new idea arrives, ask a small AI quorum to comment or vote.",
        deep_link: "/admin/boardroom#idea-idea-abc",
        created_by_agent_id: "agent_author",
        requested_action: "comment_or_vote",
        ack_required: true,
      },
    });
    expect(plans[1].targetAgentId).toBe("agent_qc");
  });

  it("builds already-leased dispatch rows for reclaimable ACK tracking", () => {
    const plan = planFishbowlIdeaCouncilHandoffs(baseInput)[0];
    const row = buildFishbowlIdeaCouncilDispatchRow({
      apiKeyHash: "hash_123",
      dispatchId: "dispatch_123",
      plan,
      now: new Date("2026-05-01T03:20:00.000Z"),
    });

    expect(row).toMatchObject({
      api_key_hash: "hash_123",
      dispatch_id: "dispatch_123",
      source: "fishbowl",
      target_agent_id: "agent_builder",
      task_ref: "fishbowl-idea:idea-abc",
      status: "leased",
      lease_owner: "agent_builder",
      lease_expires_at: "2026-05-01T03:30:00.000Z",
      created_at: "2026-05-01T03:20:00.000Z",
      updated_at: "2026-05-01T03:20:00.000Z",
    });
    expect(row.payload.ack_required).toBe(true);
  });

  it("dispatch payload triggers handoff_ack_missing on stale reclaim", () => {
    const plan = planFishbowlIdeaCouncilHandoffs(baseInput)[0];
    const signal = createReclaimSignal(
      {
        dispatchId: "dispatch_123",
        source: plan.source,
        targetAgentId: plan.targetAgentId,
        taskRef: plan.taskRef,
        payload: plan.payload,
      },
      900,
    );

    expect(signal.action).toBe("handoff_ack_missing");
  });

  it("keeps each worker ACK isolated with a target-specific dispatch id", () => {
    const plans = planFishbowlIdeaCouncilHandoffs(baseInput);
    const dispatchIds = plans.map((plan) =>
      createDispatchId({
        source: plan.source,
        targetAgentId: plan.targetAgentId,
        taskRef: plan.taskRef,
      }),
    );

    expect(dispatchIds).toHaveLength(2);
    expect(new Set(dispatchIds).size).toBe(2);
    expect(plans[0].taskRef).toBe(plans[1].taskRef);
  });

  it("stays silent for human-only, self-only, missing-profile, and disabled quorum paths", () => {
    expect(
      planFishbowlIdeaCouncilHandoffs({
        ...baseInput,
        profiles: profiles.filter((profile) => profile.agentId === "agent_author"),
      }),
    ).toEqual([]);
    expect(
      planFishbowlIdeaCouncilHandoffs({
        ...baseInput,
        profiles: profiles.filter((profile) => profile.userAgentHint === "admin-ui"),
      }),
    ).toEqual([]);
    expect(planFishbowlIdeaCouncilHandoffs({ ...baseInput, profiles: [] })).toEqual([]);
    expect(planFishbowlIdeaCouncilHandoffs({ ...baseInput, maxReviewers: 0 })).toEqual([]);
  });

  it("deduplicates workers and respects the reviewer cap", () => {
    const plans = planFishbowlIdeaCouncilHandoffs({
      ...baseInput,
      maxReviewers: 1,
      profiles: [
        ...profiles,
        {
          agentId: "agent_builder",
          emoji: "B2",
          lastSeenAt: "2026-05-01T03:30:00.000Z",
        },
      ],
    });

    expect(plans).toHaveLength(1);
    expect(plans[0].targetAgentId).toBe("agent_builder");
  });
});

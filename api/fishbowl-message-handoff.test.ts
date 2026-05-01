import { describe, expect, it } from "vitest";
import {
  buildFishbowlMessageHandoffDispatchRow,
  FISHBOWL_MESSAGE_HANDOFF_LEASE_SECONDS,
  planFishbowlMessageHandoffs,
} from "./lib/fishbowl-message-handoff";
import { createReclaimSignal } from "../packages/mcp-server/src/reliability";

const recipientProfiles = [
  { agentId: "agent_author", emoji: "A" },
  { agentId: "agent_builder", emoji: "B" },
  { agentId: "agent_qc", emoji: "Q" },
  { agentId: "human_chris", emoji: "C", userAgentHint: "admin-ui" },
];

const baseInput = {
  messageId: "msg-abc",
  text: "Please review this ready PR.",
  tags: ["needs-doing"],
  recipients: ["B"],
  authorAgentId: "agent_author",
  recipientProfiles,
};

describe("planFishbowlMessageHandoffs", () => {
  it("produces ACK-required dispatch plans for direct worker action messages", () => {
    const plans = planFishbowlMessageHandoffs(baseInput);

    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      source: "fishbowl",
      targetAgentId: "agent_builder",
      taskRef: "fishbowl-message:msg-abc",
      leaseSeconds: FISHBOWL_MESSAGE_HANDOFF_LEASE_SECONDS,
      payload: {
        kind: "message_handoff",
        handoff_message_id: "msg-abc",
        summary: "Please review this ready PR.",
        tags: ["needs-doing"],
        author_agent_id: "agent_author",
        ack_required: true,
      },
    });
  });

  it("builds an already-leased dispatch row for reclaimable ACK tracking", () => {
    const plan = planFishbowlMessageHandoffs(baseInput)[0];
    const row = buildFishbowlMessageHandoffDispatchRow({
      apiKeyHash: "hash_123",
      dispatchId: "dispatch_123",
      plan,
      now: new Date("2026-05-01T03:00:00.000Z"),
    });

    expect(row).toMatchObject({
      api_key_hash: "hash_123",
      dispatch_id: "dispatch_123",
      source: "fishbowl",
      target_agent_id: "agent_builder",
      task_ref: "fishbowl-message:msg-abc",
      status: "leased",
      lease_owner: "agent_builder",
      lease_expires_at: "2026-05-01T03:10:00.000Z",
      created_at: "2026-05-01T03:00:00.000Z",
      updated_at: "2026-05-01T03:00:00.000Z",
    });
    expect(row.payload.ack_required).toBe(true);
  });

  it("dispatch payload triggers handoff_ack_missing on stale reclaim", () => {
    const plan = planFishbowlMessageHandoffs(baseInput)[0];
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

  it("stays silent for broadcasts, humans, self-handoffs, FYI, and ambiguous recipients", () => {
    expect(planFishbowlMessageHandoffs({ ...baseInput, recipients: ["all"] })).toEqual([]);
    expect(planFishbowlMessageHandoffs({ ...baseInput, recipients: ["B", "Q"] })).toEqual([]);
    expect(planFishbowlMessageHandoffs({ ...baseInput, recipients: ["C"] })).toEqual([]);
    expect(
      planFishbowlMessageHandoffs({
        ...baseInput,
        authorAgentId: "human_chris",
      }),
    ).toEqual([]);
    expect(
      planFishbowlMessageHandoffs({
        ...baseInput,
        recipients: ["B"],
        authorAgentId: "agent_builder",
      }),
    ).toEqual([]);
    expect(planFishbowlMessageHandoffs({ ...baseInput, tags: ["status"] })).toEqual([]);
    expect(planFishbowlMessageHandoffs({ ...baseInput, recipients: ["unknown"] })).toEqual([]);
    expect(
      planFishbowlMessageHandoffs({
        ...baseInput,
        recipientProfiles: [
          ...recipientProfiles,
          { agentId: "agent_duplicate", emoji: "B" },
        ],
      }),
    ).toEqual([]);
  });
});

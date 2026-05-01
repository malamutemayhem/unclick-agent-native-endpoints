import { describe, expect, it } from "vitest";
import {
  buildFishbowlMessageHandoffDispatchRow,
  FISHBOWL_MESSAGE_HANDOFF_LEASE_SECONDS,
  planFishbowlMessageHandoff,
  type FishbowlRecipientProfile,
} from "./lib/fishbowl-message-handoff";
import { createReclaimSignal } from "../packages/mcp-server/src/reliability";

const workerProfile: FishbowlRecipientProfile = {
  agent_id: "chatgpt-codex-worker",
  emoji: "🤖",
  user_agent_hint: "codex-desktop",
};

const authorProfile: FishbowlRecipientProfile = {
  agent_id: "chatgpt-55-plex-creativelead",
  emoji: "🦾",
  user_agent_hint: "chatgpt-plex",
};

const humanProfile: FishbowlRecipientProfile = {
  agent_id: "human-123",
  emoji: "😎",
  user_agent_hint: "admin-ui",
};

const baseInput = {
  messageId: "msg-abc",
  text: "Please pick up the stale worker handoff.",
  tags: ["needs-doing"],
  recipients: ["🤖"],
  authorAgentId: "chatgpt-55-plex-creativelead",
  authorEmoji: "🦾",
  recipientProfiles: [authorProfile, workerProfile, humanProfile],
};

describe("planFishbowlMessageHandoff", () => {
  it("produces an ACK-required dispatch with a 600s lease for direct worker action handoffs", () => {
    const plan = planFishbowlMessageHandoff(baseInput);
    expect(plan).toMatchObject({
      source: "fishbowl",
      targetAgentId: "chatgpt-codex-worker",
      taskRef: "msg-abc",
      leaseSeconds: 600,
      payload: {
        kind: "fishbowl_worker_handoff",
        message_id: "msg-abc",
        recipients: ["🤖"],
        tags: ["needs-doing"],
        action_tags: ["needs-doing"],
        created_by_agent_id: "chatgpt-55-plex-creativelead",
        author_emoji: "🦾",
        ack_required: true,
      },
    });
    expect(plan?.leaseSeconds).toBe(FISHBOWL_MESSAGE_HANDOFF_LEASE_SECONDS);

    const row = buildFishbowlMessageHandoffDispatchRow({
      apiKeyHash: "hash",
      dispatchId: "dispatch_123",
      plan: plan!,
      now: new Date("2026-05-01T00:00:00.000Z"),
    });
    expect(row).toMatchObject({
      status: "leased",
      lease_owner: "chatgpt-codex-worker",
      lease_expires_at: "2026-05-01T00:10:00.000Z",
    });
  });

  it("dispatch payload triggers handoff_ack_missing on stale reclaim", () => {
    const plan = planFishbowlMessageHandoff(baseInput)!;
    const signal = createReclaimSignal(
      {
        dispatchId: "x",
        source: plan.source,
        targetAgentId: plan.targetAgentId,
        taskRef: plan.taskRef,
        payload: plan.payload,
      },
      900,
    );
    expect(signal.action).toBe("handoff_ack_missing");
  });

  it("returns null for quiet paths", () => {
    expect(planFishbowlMessageHandoff({ ...baseInput, tags: ["fyi"] })).toBeNull();
    expect(planFishbowlMessageHandoff({ ...baseInput, recipients: ["all"] })).toBeNull();
    expect(planFishbowlMessageHandoff({ ...baseInput, recipients: ["🤖", "🍿"] })).toBeNull();
    expect(planFishbowlMessageHandoff({ ...baseInput, recipients: ["😎"] })).toBeNull();
    expect(planFishbowlMessageHandoff({ ...baseInput, recipients: ["unknown-worker"] })).toBeNull();
    expect(planFishbowlMessageHandoff({ ...baseInput, authorAgentId: "human-123" })).toBeNull();
    expect(
      planFishbowlMessageHandoff({
        ...baseInput,
        authorAgentId: "chatgpt-codex-worker",
      }),
    ).toBeNull();
  });

  it("accepts blocker and tripwire action tags for direct worker recipients", () => {
    expect(planFishbowlMessageHandoff({ ...baseInput, tags: ["blocker"] })).not.toBeNull();
    expect(planFishbowlMessageHandoff({ ...baseInput, tags: ["tripwire"] })).not.toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import {
  buildAutopilotEventRow,
  planFishbowlPostLedgerEvent,
  planTodoLedgerEvents,
} from "./lib/autopilot-control-ledger";

const now = new Date("2026-05-09T00:00:00.000Z");

describe("autopilot control ledger helpers", () => {
  it("builds idempotent typed event rows", () => {
    const row = buildAutopilotEventRow({
      apiKeyHash: "hash_123",
      eventType: "claim",
      actorAgentId: "runner",
      refKind: "todo",
      refId: "todo-123",
      now,
      payload: { to: "runner", status: "in_progress" },
    });

    expect(row).toMatchObject({
      api_key_hash: "hash_123",
      event_type: "claim",
      actor_agent_id: "runner",
      ref_kind: "todo",
      ref_id: "todo-123",
      created_at: "2026-05-09T00:00:00.000Z",
    });
    expect(row.idempotency_key).toContain("claim:todo:todo-123:runner:");
  });

  it("plans todo state and claim events from before/after rows", () => {
    const events = planTodoLedgerEvents({
      todoId: "todo-123",
      actorAgentId: "runner",
      now,
      before: { status: "open", assigned_to_agent_id: null, title: "Build ledger" },
      after: { status: "in_progress", assigned_to_agent_id: "runner", title: "Build ledger" },
    });

    expect(events.map((event) => event.eventType)).toEqual(["todo_state_change", "claim"]);
    expect(events[0]).toMatchObject({
      actorAgentId: "runner",
      refKind: "todo",
      refId: "todo-123",
      payload: { from: "open", to: "in_progress", title: "Build ledger" },
    });
    expect(events[1]).toMatchObject({
      payload: { from: null, to: "runner", status: "in_progress" },
    });
  });

  it("plans release events when a todo is unassigned", () => {
    const events = planTodoLedgerEvents({
      todoId: "todo-123",
      actorAgentId: "runner",
      now,
      before: { status: "in_progress", assigned_to_agent_id: "runner" },
      after: { status: "open", assigned_to_agent_id: null },
    });

    expect(events.map((event) => event.eventType)).toEqual(["todo_state_change", "release"]);
  });

  it("turns structured ACK posts into ack events without storing full chat text", () => {
    const event = planFishbowlPostLedgerEvent({
      actorAgentId: "reviewer",
      messageId: "message-2",
      threadId: "message-1",
      now,
      tags: ["answer", "handoff"],
      recipients: ["all"],
      text: [
        "ACK",
        "Current chip: PR #600 review",
        "Next action: run focused proof",
        "ETA: 15m",
        "Blocker: none",
      ].join("\n"),
    });

    expect(event).toMatchObject({
      eventType: "ack",
      actorAgentId: "reviewer",
      refKind: "dispatch",
      refId: "message-1",
      payload: {
        current_chip: "PR #600 review",
        next_action: "run focused proof",
        eta: "15m",
        blocker: "none",
        message_id: "message-2",
        thread_id: "message-1",
      },
    });
    expect(JSON.stringify(event?.payload)).not.toContain("ACK\\n");
  });

  it("rejects payloads that look like secrets", () => {
    expect(() =>
      buildAutopilotEventRow({
        apiKeyHash: "hash_123",
        eventType: "proof_result",
        actorAgentId: "runner",
        refKind: "todo",
        refId: "todo-123",
        now,
        payload: { api_key: "uc_abc1234567890def" },
      }),
    ).toThrow(/sensitive key/);
  });
});

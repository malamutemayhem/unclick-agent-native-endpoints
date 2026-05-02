import { describe, expect, it } from "vitest";
import {
  getActionQueueMessages,
  getLaneMessages,
  getMainFeedMessages,
  isHandoffMessage,
  isRoutineLaneOnlyMessage,
} from "./messageLanes";

const message = (id: string, tags: string[] | null) => ({ id, tags });

describe("Fishbowl message lanes", () => {
  it("moves heartbeat-only and event-only chatter out of the main feed", () => {
    const messages = [
      message("heartbeat", ["heartbeat"]),
      message("event", ["event"]),
      message("normal", ["needs-doing"]),
      message("untagged", null),
    ];

    expect(getMainFeedMessages(messages).map((m) => m.id)).toEqual([
      "normal",
      "untagged",
    ]);
  });

  it("keeps mixed action messages in the main feed", () => {
    expect(isRoutineLaneOnlyMessage(message("mixed", ["heartbeat", "needs-doing"]))).toBe(false);
    expect(isRoutineLaneOnlyMessage(message("event-blocker", ["event", "blocker"]))).toBe(false);
  });

  it("returns lane-specific messages including mixed-tag messages", () => {
    const messages = [
      message("heartbeat", ["heartbeat"]),
      message("heartbeat-action", ["heartbeat", "needs-doing"]),
      message("event", ["event"]),
      message("normal", ["needs-doing"]),
    ];

    expect(getLaneMessages(messages, "heartbeat").map((m) => m.id)).toEqual([
      "heartbeat",
      "heartbeat-action",
    ]);
    expect(getLaneMessages(messages, "event").map((m) => m.id)).toEqual(["event"]);
  });

  it("detects handoff messages without treating them as routine lane chatter", () => {
    const handoff = message("handoff", ["handoff", "needs-doing"]);

    expect(isHandoffMessage(handoff)).toBe(true);
    expect(getMainFeedMessages([handoff]).map((m) => m.id)).toEqual(["handoff"]);
  });

  it("collects action-needed tags into the action queue", () => {
    const messages = [
      message("blocker", ["blocker"]),
      message("handoff", ["handoff"]),
      message("needs-doing", ["needs-doing"]),
      message("tripwire", ["tripwire"]),
      message("heartbeat-action", ["heartbeat", "needs-doing"]),
      message("routine", ["heartbeat"]),
      message("normal", ["note"]),
    ];

    expect(getActionQueueMessages(messages).map((m) => m.id)).toEqual([
      "blocker",
      "handoff",
      "needs-doing",
      "tripwire",
      "heartbeat-action",
    ]);
  });
});

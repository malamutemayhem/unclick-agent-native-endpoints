import { describe, expect, it } from "vitest";
import { createHeartbeat, createReclaimSignal } from "../packages/mcp-server/src/reliability.js";
import {
  CHECKIN_ACK_LEASE_SECONDS,
  buildMissedCheckinDispatch,
  isMissedCheckinCandidate,
  type ProfileRow,
} from "./fishbowl-watcher.js";

const baseProfile: ProfileRow = {
  api_key_hash: "hash_123",
  agent_id: "worker-1",
  emoji: "🦾",
  display_name: "Worker One",
  last_seen_at: "2026-05-01T01:00:00.000Z",
  current_status: "working",
  current_status_updated_at: "2026-05-01T01:00:00.000Z",
  next_checkin_at: "2026-05-01T01:10:00.000Z",
};

describe("fishbowl watcher PinballWake ACK coverage", () => {
  it("treats missed next_checkin_at as an action-needed ACK dispatch", () => {
    const nowMs = Date.parse("2026-05-01T01:22:00.000Z");

    expect(isMissedCheckinCandidate(baseProfile, nowMs)).toBe(true);

    const dispatch = buildMissedCheckinDispatch(baseProfile, nowMs);

    expect(dispatch.source).toBe("wakepass");
    expect(dispatch.targetAgentId).toBe("worker-1");
    expect(dispatch.status).toBe("leased");
    expect(dispatch.leaseOwner).toBe("worker-1");
    expect(dispatch.leaseExpiresAt).toBe("2026-05-01T01:32:00.000Z");
    expect(dispatch.taskRef).toBe(
      "fishbowl-checkin:worker-1:2026-05-01T01:10:00.000Z",
    );
    expect(dispatch.payload).toMatchObject({
      ack_required: true,
      route_attempted: "fishbowl-watcher",
      wake_reason: "missed_next_checkin",
      wake_urgency: "high",
      ack_fail_after_seconds: CHECKIN_ACK_LEASE_SECONDS,
      agent_id: "worker-1",
      overdue_minutes: 12,
    });
  });

  it("keeps non-action profiles silent", () => {
    const nowMs = Date.parse("2026-05-01T01:09:00.000Z");
    expect(isMissedCheckinCandidate(baseProfile, nowMs)).toBe(false);

    expect(
      isMissedCheckinCandidate(
        {
          ...baseProfile,
          last_seen_at: "2026-05-01T01:11:00.000Z",
        },
        Date.parse("2026-05-01T01:22:00.000Z"),
      ),
    ).toBe(false);

    expect(
      isMissedCheckinCandidate(
        {
          ...baseProfile,
          next_checkin_at: null,
        },
        Date.parse("2026-05-01T01:22:00.000Z"),
      ),
    ).toBe(false);
  });

  it("missed ACK reclaim is visible and heartbeat can close the leased dispatch", () => {
    const nowMs = Date.parse("2026-05-01T01:22:00.000Z");
    const dispatch = buildMissedCheckinDispatch(baseProfile, nowMs);

    const reclaimSignal = createReclaimSignal(dispatch, 30);
    expect(reclaimSignal.action).toBe("handoff_ack_missing");
    expect(reclaimSignal.payload).toMatchObject({
      dispatch_id: dispatch.dispatchId,
      target_agent_id: "worker-1",
      ack_required: true,
    });

    const heartbeat = createHeartbeat({
      apiKeyHash: "hash_123",
      agentId: "worker-1",
      dispatchId: dispatch.dispatchId,
      state: "completed",
      currentTask: "ACK missed check-in handoff",
      nextAction: "resume normal heartbeat",
      createdAt: new Date("2026-05-01T01:23:00.000Z"),
    });

    expect(heartbeat).toMatchObject({
      agentId: dispatch.leaseOwner,
      dispatchId: dispatch.dispatchId,
      state: "completed",
    });
  });
});

import { describe, expect, it } from "vitest";
import { createHeartbeat, createReclaimSignal } from "../packages/mcp-server/src/reliability.js";
import {
  CHECKIN_ACK_LEASE_SECONDS,
  buildDispatchReclaimSignal,
  buildMissedCheckinDispatch,
  isMissedCheckinCandidate,
  isReclaimableDispatchCandidate,
  type DispatchRow,
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

const baseDispatch: DispatchRow = {
  api_key_hash: "hash_123",
  dispatch_id: "dispatch_abc",
  source: "wakepass",
  target_agent_id: "worker-1",
  task_ref: "wake-pr-123",
  status: "leased",
  lease_owner: "worker-1",
  lease_expires_at: "2026-05-01T01:10:00.000Z",
  last_real_action_at: null,
  payload: {
    ack_required: true,
    handoff_message_id: "msg-123",
    wake_reason: "PR ready for review",
  },
  created_at: "2026-05-01T01:00:00.000Z",
  updated_at: "2026-05-01T01:00:00.000Z",
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

  it("classifies expired ACK leases as reclaimable missing-ACK work", () => {
    const nowMs = Date.parse("2026-05-01T01:12:30.000Z");

    expect(isReclaimableDispatchCandidate(baseDispatch, nowMs)).toBe(true);

    const signal = buildDispatchReclaimSignal(baseDispatch, nowMs);

    expect(signal).toMatchObject({
      action: "handoff_ack_missing",
      summary: "WakePass reliability miss: no ACK arrived before reclaim for worker-1",
      payload: {
        dispatch_id: "dispatch_abc",
        source: "wakepass",
        target_agent_id: "worker-1",
        task_ref: "wake-pr-123",
        stale_seconds: 150,
        ack_required: true,
        handoff_message_id: "msg-123",
        wake_reason: "PR ready for review",
      },
    });
  });

  it("does not reclaim active or non-leased dispatches", () => {
    const beforeExpiryMs = Date.parse("2026-05-01T01:09:59.000Z");
    const afterExpiryMs = Date.parse("2026-05-01T01:12:30.000Z");

    expect(isReclaimableDispatchCandidate(baseDispatch, beforeExpiryMs)).toBe(false);
    expect(buildDispatchReclaimSignal(baseDispatch, beforeExpiryMs)).toBeNull();

    expect(
      isReclaimableDispatchCandidate(
        {
          ...baseDispatch,
          status: "completed",
        },
        afterExpiryMs,
      ),
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { createHeartbeat, createReclaimSignal } from "../packages/mcp-server/src/reliability.js";
import {
  CHECKIN_ACK_LEASE_SECONDS,
  CHECKIN_ACTIVE_GRACE_MS,
  CHECKIN_DORMANT_SUPPRESS_MS,
  CHECKIN_OVERDUE_SUPPRESS_MS,
  WAKEPASS_REROUTE_LEASE_SECONDS,
  buildDispatchReclaimSignal,
  buildMissedCheckinDispatch,
  buildWorkerMovementWorkflowPilotProofText,
  buildWakepassAutoReroutePlan,
  buildWorkerSelfHealingSignal,
  hasRecentWorkerSelfHealingTodoSignal,
  isMissedCheckinDispatch,
  isMissedCheckinCandidate,
  isReclaimableDispatchCandidate,
  isWakepassAutoRerouteEligible,
  messageAcknowledgesDispatch,
  planWorkerMovementWorkflowPilot,
  planWorkerSelfHealingDecision,
  planWorkerSelfHealingTodoSignal,
  resolveWakepassRerouteTarget,
  shouldMarkDispatchStaleAfterReclaimSignalInsert,
  type DispatchRow,
  type FishbowlMessageAckRow,
  type ProfileRow,
} from "./fishbowl-watcher.js";

const baseProfile: ProfileRow = {
  api_key_hash: "hash_123",
  agent_id: "worker-1",
  emoji: "🦾",
  display_name: "Worker One",
  last_seen_at: "2026-05-01T00:30:00.000Z",
  current_status: "working",
  current_status_updated_at: "2026-05-01T00:30:00.000Z",
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

  it("suppresses missed check-ins for agents seen within the active grace window", () => {
    const nowMs = Date.parse("2026-05-01T01:22:00.000Z");

    expect(
      isMissedCheckinCandidate(
        {
          ...baseProfile,
          last_seen_at: new Date(nowMs - CHECKIN_ACTIVE_GRACE_MS + 1_000).toISOString(),
          next_checkin_at: "2026-05-01T01:21:00.000Z",
        },
        nowMs,
      ),
    ).toBe(false);
  });

  it("suppresses missed check-ins once the missed window is old noise", () => {
    const nowMs = Date.parse("2026-05-01T14:00:00.000Z");

    expect(
      isMissedCheckinCandidate(
        {
          ...baseProfile,
          last_seen_at: new Date(nowMs - CHECKIN_OVERDUE_SUPPRESS_MS - 60_000).toISOString(),
          next_checkin_at: new Date(nowMs - CHECKIN_OVERDUE_SUPPRESS_MS - 1_000).toISOString(),
        },
        nowMs,
      ),
    ).toBe(false);
  });

  it("suppresses missed check-ins for long-dormant agents", () => {
    const nowMs = Date.parse("2026-05-08T01:22:00.000Z");

    expect(
      isMissedCheckinCandidate(
        {
          ...baseProfile,
          last_seen_at: new Date(nowMs - CHECKIN_DORMANT_SUPPRESS_MS - 1_000).toISOString(),
          next_checkin_at: "2026-05-08T01:10:00.000Z",
        },
        nowMs,
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

  it("matches threaded ACK replies that name the exact wake event", () => {
    const wakeEventId = "wake-pull_request-pr-508-5e6cd76ba13e";
    const dispatch: DispatchRow = {
      ...baseDispatch,
      task_ref: wakeEventId,
      payload: {
        ack_required: true,
        handoff_message_id: "msg-123",
        wake_event_id: wakeEventId,
      },
    };
    const message: FishbowlMessageAckRow = {
      id: "msg-ack",
      text: `ACK ${wakeEventId}. PASS: already merged.`,
      thread_id: "msg-123",
      created_at: "2026-05-01T01:12:00.000Z",
      author_agent_id: "chatgpt-codex-heartbeat",
    };

    expect(messageAcknowledgesDispatch(dispatch, message)).toBe(true);
  });

  it("matches threaded QueuePush ACK replies without requiring repeated packet text", () => {
    const dispatch: DispatchRow = {
      ...baseDispatch,
      task_ref: "fishbowl-message:msg-queuepush",
      payload: {
        kind: "message_handoff",
        ack_required: true,
        handoff_message_id: "msg-queuepush",
        summary:
          "QueuePush ID: queuepush:v3:pr-544:blocked_chris_only:caef570:e53888490d",
      },
    };
    const message: FishbowlMessageAckRow = {
      id: "msg-ack",
      text: "ACK. BLOCKER: exact Chris decision still required.",
      thread_id: "msg-queuepush",
      created_at: "2026-05-01T01:12:00.000Z",
      author_agent_id: "chatgpt-codex-heartbeat",
    };

    expect(messageAcknowledgesDispatch(dispatch, message)).toBe(true);
  });

  it("does not count wake prompt copy as an ACK reply", () => {
    const wakeEventId = "wake-pull_request-pr-508-5e6cd76ba13e";
    const message: FishbowlMessageAckRow = {
      id: "msg-123",
      text: `Wake event id: ${wakeEventId}\nACK requested: reply ACK ${wakeEventId}`,
      thread_id: null,
      created_at: "2026-05-01T01:00:00.000Z",
      author_agent_id: "github-action-wake-router",
    };

    expect(
      messageAcknowledgesDispatch(
        {
          ...baseDispatch,
          task_ref: wakeEventId,
          payload: {
            ack_required: true,
            wake_event_id: wakeEventId,
          },
        },
        message,
      ),
    ).toBe(false);
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

  it("keeps expired leases retryable when reclaim signal insert fails", () => {
    expect(
      shouldMarkDispatchStaleAfterReclaimSignalInsert({
        message: "temporary mc_signals insert failure",
      }),
    ).toBe(false);

    expect(shouldMarkDispatchStaleAfterReclaimSignalInsert(null)).toBe(true);
  });

  it("plans a Coordinator reroute for missed QueuePush todo ACKs", () => {
    const nowMs = Date.parse("2026-05-01T01:22:00.000Z");
    const todoDispatch: DispatchRow = {
      ...baseDispatch,
      dispatch_id: "dispatch_builder_ack",
      target_agent_id: "chatgpt-codex-desktop",
      task_ref: "702a7edd-7464-4879-801b-c4ee0dcbe539",
      payload: {
        kind: "todo_assignment",
        ack_required: true,
        title: "Builder ACK needed: PR #554 owner lift decision",
        summary: "QueuePush owner decision is waiting on Builder ACK.",
      },
    };
    const signal = buildDispatchReclaimSignal(todoDispatch, nowMs);
    expect(signal?.action).toBe("handoff_ack_missing");

    const plan = buildWakepassAutoReroutePlan({
      row: todoDispatch,
      signal: signal!,
      profiles: [
        {
          ...baseProfile,
          agent_id: "master",
          emoji: "🧭",
          display_name: "Coordinator",
          last_seen_at: "2026-05-01T01:20:00.000Z",
        },
      ],
      nowMs,
    });

    expect(plan).not.toBeNull();
    expect(plan?.dispatch).toMatchObject({
      source: "wakepass",
      targetAgentId: "master",
      status: "leased",
      leaseOwner: "master",
      taskRef: "wakepass-reroute:dispatch_builder_ack",
      leaseExpiresAt: new Date(
        nowMs + WAKEPASS_REROUTE_LEASE_SECONDS * 1000,
      ).toISOString(),
      payload: {
        kind: "wakepass_auto_reroute",
        ack_required: true,
        original_dispatch_id: "dispatch_builder_ack",
        original_target_agent_id: "chatgpt-codex-desktop",
        reroute_target_role: "coordinator",
      },
    });
    expect(plan?.messageText).toContain("Coordinator action");
    expect(plan?.signal).toMatchObject({
      action: "handoff_ack_rerouted",
      severity: "info",
      payload: {
        rerouted: true,
        reroute_target_agent_id: "master",
      },
    });
  });

  it("does not auto-reroute stale check-in noise", () => {
    const nowMs = Date.parse("2026-05-01T01:22:00.000Z");
    const staleCheckinDispatch = {
      ...baseDispatch,
      task_ref: "fishbowl-checkin:worker-1:2026-05-01T01:10:00.000Z",
      payload: {
        ack_required: true,
        wake_reason: "missed_next_checkin",
      },
    };
    const signal = buildDispatchReclaimSignal(staleCheckinDispatch, nowMs);

    expect(isMissedCheckinDispatch(staleCheckinDispatch)).toBe(true);
    expect(signal).toMatchObject({
      action: "stale_dispatch_reclaimed",
      summary: "Reclaimed stale missed check-in dispatch for worker-1",
      payload: {
        wake_reason: "missed_next_checkin",
      },
    });
    expect(isWakepassAutoRerouteEligible(staleCheckinDispatch)).toBe(false);
    expect(
      buildWakepassAutoReroutePlan({
        row: staleCheckinDispatch,
        signal: signal!,
        profiles: [],
        nowMs,
      }),
    ).toBeNull();
  });

  it("falls back to the default Coordinator when registry profiles are missing", () => {
    expect(resolveWakepassRerouteTarget([])).toEqual({
      agentId: "master",
      recipient: "🧭",
      role: "coordinator",
      reason: "default_coordinator",
    });
  });
});

describe("worker self-healing decision plan", () => {
  it("preserves an active todo lease even when the worker missed check-in", () => {
    const nowMs = Date.parse("2026-05-01T01:22:00.000Z");

    const decision = planWorkerSelfHealingDecision({
      todo: {
        id: "todo-active-lease",
        status: "in_progress",
        assigned_to_agent_id: "worker-1",
        lease_token: "lease-fresh",
        lease_expires_at: "2026-05-01T01:25:00.000Z",
        reclaim_count: 1,
      },
      profile: baseProfile,
      latestHandoffReceiptId: "handoff-latest-1",
      nowMs,
    });

    expect(decision).toMatchObject({
      action: "active_lease_preserved",
      todo_id: "todo-active-lease",
      assigned_to_agent_id: "worker-1",
      lease_token: "lease-fresh",
      lease_expires_at: "2026-05-01T01:25:00.000Z",
      reclaim_count: 1,
      next_reclaim_count: 1,
      latest_handoff_receipt_id: "handoff-latest-1",
      reason: "active_lease_not_expired",
    });
  });

  it("marks an expired todo lease reclaimable with the next reclaim count", () => {
    const decision = planWorkerSelfHealingDecision({
      todo: {
        id: "todo-expired-lease",
        status: "in_progress",
        assigned_to_agent_id: "worker-1",
        lease_token: "lease-old",
        lease_expires_at: "2026-05-01T01:10:00.000Z",
        reclaim_count: 2,
      },
      profile: null,
      latestHandoffReceiptId: "handoff-latest-2",
      nowMs: Date.parse("2026-05-01T01:22:00.000Z"),
    });

    expect(decision).toMatchObject({
      action: "expired_lease_reclaimable",
      todo_id: "todo-expired-lease",
      assigned_to_agent_id: "worker-1",
      lease_token: "lease-old",
      reclaim_count: 2,
      next_reclaim_count: 3,
      latest_handoff_receipt_id: "handoff-latest-2",
      reason: "lease_expired",
    });
  });

  it("flags a stale worker for action when no active todo lease exists", () => {
    const nowMs = Date.parse("2026-05-01T01:22:00.000Z");

    const decision = planWorkerSelfHealingDecision({
      todo: {
        id: "todo-stale-worker",
        status: "in_progress",
        assigned_to_agent_id: "worker-1",
        lease_token: null,
        lease_expires_at: null,
        reclaim_count: 0,
      },
      profile: baseProfile,
      latestHandoffReceiptId: "handoff-latest-3",
      nowMs,
    });

    expect(decision).toMatchObject({
      action: "stale_worker_action_needed",
      todo_id: "todo-stale-worker",
      assigned_to_agent_id: "worker-1",
      profile_agent_id: "worker-1",
      next_checkin_at: "2026-05-01T01:10:00.000Z",
      last_seen_at: "2026-05-01T00:30:00.000Z",
      latest_handoff_receipt_id: "handoff-latest-3",
      reason: "missed_next_checkin_without_active_lease",
    });
  });

  it("carries the latest handoff receipt through resume-safe no-action decisions", () => {
    const decision = planWorkerSelfHealingDecision({
      todo: {
        id: "todo-current-worker",
        status: "in_progress",
        assigned_to_agent_id: "worker-1",
        lease_token: null,
        lease_expires_at: null,
        reclaim_count: null,
      },
      profile: {
        ...baseProfile,
        last_seen_at: "2026-05-01T01:21:00.000Z",
        next_checkin_at: "2026-05-01T01:30:00.000Z",
      },
      latestHandoffReceiptId: "handoff-latest-4",
      nowMs: Date.parse("2026-05-01T01:22:00.000Z"),
    });

    expect(decision).toMatchObject({
      action: "no_action",
      todo_id: "todo-current-worker",
      reclaim_count: 0,
      next_reclaim_count: 0,
      latest_handoff_receipt_id: "handoff-latest-4",
      reason: "no_stale_worker_or_reclaimable_lease",
    });
  });

  it("turns an expired lease decision into a reclaim signal without exposing the token", () => {
    const decision = planWorkerSelfHealingDecision({
      todo: {
        id: "todo-expired-lease",
        status: "in_progress",
        assigned_to_agent_id: "worker-1",
        lease_token: "lease-secret",
        lease_expires_at: "2026-05-01T01:10:00.000Z",
        reclaim_count: 2,
      },
      profile: null,
      latestHandoffReceiptId: "handoff-latest-5",
      nowMs: Date.parse("2026-05-01T01:22:00.000Z"),
    });

    const signal = buildWorkerSelfHealingSignal(decision);

    expect(signal).toMatchObject({
      action: "worker_self_healing_reclaimable_lease",
      severity: "action_needed",
      summary: "Todo todo-expired-lease has an expired worker lease and can be reclaimed.",
      payload: {
        todo_id: "todo-expired-lease",
        assigned_to_agent_id: "worker-1",
        has_lease_token: true,
        lease_expires_at: "2026-05-01T01:10:00.000Z",
        reclaim_count: 2,
        next_reclaim_count: 3,
        latest_handoff_receipt_id: "handoff-latest-5",
        reason: "lease_expired",
      },
    });
    expect(signal?.payload).not.toHaveProperty("lease_token");
  });

  it("plans an insert row for an expired lease signal without exposing the token", () => {
    const decision = planWorkerSelfHealingDecision({
      todo: {
        id: "todo-expired-lease",
        status: "in_progress",
        assigned_to_agent_id: "worker-1",
        lease_token: "lease-secret",
        lease_expires_at: "2026-05-01T01:10:00.000Z",
        reclaim_count: 2,
      },
      profile: null,
      latestHandoffReceiptId: "handoff-latest-5",
      nowMs: Date.parse("2026-05-01T01:22:00.000Z"),
    });

    const plan = planWorkerSelfHealingTodoSignal({
      apiKeyHash: "hash_123",
      decision,
      emittedAt: "2026-05-01T01:22:01.000Z",
    });

    expect(plan).toMatchObject({
      signal: {
        action: "worker_self_healing_reclaimable_lease",
        severity: "action_needed",
      },
      insert: {
        api_key_hash: "hash_123",
        tool: "fishbowl",
        action: "worker_self_healing_reclaimable_lease",
        severity: "action_needed",
        summary: "Todo todo-expired-lease has an expired worker lease and can be reclaimed.",
        deep_link: "/admin/jobs#todo-todo-expired-lease",
        payload: {
          todo_id: "todo-expired-lease",
          assigned_to_agent_id: "worker-1",
          has_lease_token: true,
          lease_expires_at: "2026-05-01T01:10:00.000Z",
          reclaim_count: 2,
          next_reclaim_count: 3,
          latest_handoff_receipt_id: "handoff-latest-5",
          reason: "lease_expired",
          emitted_at: "2026-05-01T01:22:01.000Z",
        },
      },
    });
    expect(plan?.insert.payload).not.toHaveProperty("lease_token");
  });

  it("dedupes worker self-healing todo signals by action and todo id", () => {
    const decision = planWorkerSelfHealingDecision({
      todo: {
        id: "todo-expired-lease",
        status: "in_progress",
        assigned_to_agent_id: "worker-1",
        lease_token: "lease-secret",
        lease_expires_at: "2026-05-01T01:10:00.000Z",
        reclaim_count: 2,
      },
      profile: null,
      latestHandoffReceiptId: "handoff-latest-5",
      nowMs: Date.parse("2026-05-01T01:22:00.000Z"),
    });
    const plan = planWorkerSelfHealingTodoSignal({
      apiKeyHash: "hash_123",
      decision,
      emittedAt: "2026-05-01T01:22:01.000Z",
    });

    expect(plan).not.toBeNull();
    expect(
      hasRecentWorkerSelfHealingTodoSignal(
        [
          {
            action: "worker_self_healing_reclaimable_lease",
            payload: {
              todo_id: "todo-expired-lease",
            },
          },
        ],
        plan!,
      ),
    ).toBe(true);
    expect(
      hasRecentWorkerSelfHealingTodoSignal(
        [
          {
            action: "worker_self_healing_reclaimable_lease",
            payload: {
              todo_id: "other-todo",
            },
          },
          {
            action: "worker_self_healing_stale_worker",
            payload: {
              todo_id: "todo-expired-lease",
            },
          },
        ],
        plan!,
      ),
    ).toBe(false);
  });

  it("turns a stale worker decision into an action-needed signal with profile context", () => {
    const nowMs = Date.parse("2026-05-01T01:22:00.000Z");
    const decision = planWorkerSelfHealingDecision({
      todo: {
        id: "todo-stale-worker",
        status: "in_progress",
        assigned_to_agent_id: "worker-1",
        lease_token: null,
        lease_expires_at: null,
        reclaim_count: 0,
      },
      profile: baseProfile,
      latestHandoffReceiptId: "handoff-latest-6",
      nowMs,
    });

    expect(buildWorkerSelfHealingSignal(decision)).toMatchObject({
      action: "worker_self_healing_stale_worker",
      severity: "action_needed",
      payload: {
        todo_id: "todo-stale-worker",
        profile_agent_id: "worker-1",
        next_checkin_at: "2026-05-01T01:10:00.000Z",
        last_seen_at: "2026-05-01T00:30:00.000Z",
        reason: "missed_next_checkin_without_active_lease",
      },
    });
  });

  it("keeps no-action decisions quiet", () => {
    const decision = planWorkerSelfHealingDecision({
      todo: {
        id: "todo-current-worker",
        status: "in_progress",
        assigned_to_agent_id: "worker-1",
        lease_token: null,
        lease_expires_at: null,
        reclaim_count: 0,
      },
      profile: {
        ...baseProfile,
        last_seen_at: "2026-05-01T01:21:00.000Z",
        next_checkin_at: "2026-05-01T01:30:00.000Z",
      },
      latestHandoffReceiptId: "handoff-latest-7",
      nowMs: Date.parse("2026-05-01T01:22:00.000Z"),
    });

    expect(buildWorkerSelfHealingSignal(decision)).toBeNull();
    expect(
      planWorkerSelfHealingTodoSignal({
        apiKeyHash: "hash_123",
        decision,
        emittedAt: "2026-05-01T01:22:01.000Z",
      }),
    ).toBeNull();
  });
});

describe("Vercel worker movement workflow pilot plan", () => {
  it("builds a dry-run start plan for one safe expired lease candidate", () => {
    const plan = planWorkerMovementWorkflowPilot({
      title: "Worker self-healing: heartbeat timeout, reclaim, and resume-safe queue behavior",
      todo: {
        id: "todo-expired-lease",
        status: "in_progress",
        assigned_to_agent_id: "worker-1",
        lease_token: "lease-secret",
        lease_expires_at: "2026-05-01T01:10:00.000Z",
        reclaim_count: 2,
      },
      profile: null,
      latestHandoffReceiptId: "handoff-latest-8",
      nowMs: Date.parse("2026-05-01T01:22:00.000Z"),
    });

    expect(plan).toMatchObject({
      mode: "dry_run",
      action: "start_dry_run",
      candidate_id: "todo-expired-lease",
      safety: {
        allowed: true,
        reason: "safe_proof_only_candidate",
      },
      owner_age_minutes: 12,
      decision: {
        action: "expired_lease_reclaimable",
        latest_handoff_receipt_id: "handoff-latest-8",
      },
      signal: {
        action: "worker_self_healing_reclaimable_lease",
      },
      proof: {
        next_safe_step: "start Vercel Workflow in dry-run mode and post proof only",
        payload: {
          proof_mode: "dry_run",
          action: "start_dry_run",
          has_lease_token: true,
          planned_signal_action: "worker_self_healing_reclaimable_lease",
        },
      },
    });
    expect(plan.workflow_key).toContain("todo-expired-lease");
    expect(JSON.stringify(plan.proof.payload)).not.toContain("lease-secret");
    expect(buildWorkerMovementWorkflowPilotProofText(plan)).toContain(
      "Vercel worker movement pilot start_dry_run",
    );
  });

  it("refuses security-gated candidates even when the stale lease is detectable", () => {
    const plan = planWorkerMovementWorkflowPilot({
      title: "SECURITY: deactivate legacy plaintext api_keys_legacy rows after owner auth",
      todo: {
        id: "todo-security",
        status: "in_progress",
        assigned_to_agent_id: "worker-1",
        lease_token: "lease-secret",
        lease_expires_at: "2026-05-01T01:10:00.000Z",
        reclaim_count: 0,
      },
      profile: null,
      latestHandoffReceiptId: "handoff-latest-9",
      nowMs: Date.parse("2026-05-01T01:22:00.000Z"),
    });

    expect(plan).toMatchObject({
      mode: "dry_run",
      action: "post_refusal_proof",
      candidate_id: "todo-security",
      safety: {
        allowed: false,
        reason: "owner_or_security_gated_job",
      },
      signal: null,
      proof: {
        next_safe_step:
          "post refusal proof and leave the job with its owner (owner_or_security_gated_job)",
        payload: {
          action: "post_refusal_proof",
          planned_signal_action: "worker_self_healing_reclaimable_lease",
        },
      },
    });
    expect(JSON.stringify(plan)).not.toContain("lease-secret");
  });

  it("skips workflow start when existing planner finds no movement needed", () => {
    const plan = planWorkerMovementWorkflowPilot({
      title: "Worker self-healing: heartbeat timeout, reclaim, and resume-safe queue behavior",
      todo: {
        id: "todo-current-worker",
        status: "in_progress",
        assigned_to_agent_id: "worker-1",
        lease_token: null,
        lease_expires_at: null,
        reclaim_count: 0,
      },
      profile: {
        ...baseProfile,
        last_seen_at: "2026-05-01T01:21:00.000Z",
        next_checkin_at: "2026-05-01T01:30:00.000Z",
      },
      latestHandoffReceiptId: "handoff-latest-10",
      nowMs: Date.parse("2026-05-01T01:22:00.000Z"),
    });

    expect(plan).toMatchObject({
      mode: "dry_run",
      action: "skip_no_action",
      safety: {
        allowed: false,
        reason: "no_stale_worker_or_reclaimable_lease",
      },
      signal: null,
      owner_age_minutes: 0,
      proof: {
        next_safe_step: "skip workflow start and keep cron watcher as fallback",
      },
    });
  });
});

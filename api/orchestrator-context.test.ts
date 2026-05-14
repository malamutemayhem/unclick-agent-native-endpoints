import { describe, expect, it } from "vitest";
import {
  buildOrchestratorContext,
  compactText,
  computeActiveJobsCount,
  isHeartbeatAutomationText,
  redactSensitive,
} from "./lib/orchestrator-context";

describe("orchestrator context", () => {
  it("builds read-first cross-seat state from live source rows", () => {
    const context = buildOrchestratorContext({
      generatedAt: "2026-05-09T11:00:00.000Z",
      profiles: [
        {
          agent_id: "chatgpt-codex-seat",
          display_name: "Codex Seat",
          emoji: "C",
          user_agent_hint: "codex-desktop",
          last_seen_at: "2026-05-09T10:55:00.000Z",
          current_status: "Building Orchestrator context",
        },
        {
          agent_id: "human-chris",
          display_name: "Chris",
          user_agent_hint: "admin-ui",
          last_seen_at: "2026-05-09T09:00:00.000Z",
        },
      ],
      messages: [
        {
          id: "msg-proof",
          author_agent_id: "chatgpt-codex-seat",
          text: "PASS: PR #700 opened; proof: focused tests passed.",
          tags: ["proof"],
          created_at: "2026-05-09T10:50:00.000Z",
        },
        {
          id: "msg-user",
          author_agent_id: "human-chris",
          text: "Chris greenlit the Orchestrator context layer.",
          tags: ["decision"],
          created_at: "2026-05-09T10:20:00.000Z",
        },
      ],
      todos: [
        {
          id: "todo-1",
          title: "Orchestrator context layer",
          description: "Build compact shared state.",
          status: "in_progress",
          priority: "urgent",
          created_by_agent_id: "chatgpt-codex",
          assigned_to_agent_id: "chatgpt-codex-seat",
          created_at: "2026-05-09T09:00:00.000Z",
          updated_at: "2026-05-09T10:30:00.000Z",
        },
      ],
      comments: [
        {
          id: "comment-1",
          target_kind: "todo",
          target_id: "todo-1",
          author_agent_id: "chatgpt-codex-seat",
          text: "Claimed for first implementation slice.",
          created_at: "2026-05-09T10:31:00.000Z",
        },
      ],
      dispatches: [
        {
          dispatch_id: "dispatch-1",
          source: "fishbowl",
          target_agent_id: "chatgpt-codex-seat",
          task_ref: "todo:todo-1",
          status: "leased",
          lease_owner: "chatgpt-codex-seat",
          created_at: "2026-05-09T10:32:00.000Z",
          updated_at: "2026-05-09T10:32:00.000Z",
        },
      ],
      signals: [
        {
          id: "signal-1",
          tool: "github_action",
          action: "access_token_invalid",
          severity: "action_needed",
          summary: "Rotate token in Passport/Keychain.",
          deep_link: "/admin/keychain",
          created_at: "2026-05-09T10:40:00.000Z",
        },
      ],
      sessions: [
        {
          id: "session-row-1",
          session_id: "session-1",
          platform: "codex",
          summary: "Planning Room packet inherits constraints and proof.",
          topics: ["orchestrator", "memory"],
          created_at: "2026-05-09T10:10:00.000Z",
        },
      ],
      library: [
        {
          slug: "memory-research",
          title: "Memory Research",
          category: "research",
          tags: ["memory"],
          version: 2,
          updated_at: "2026-05-09T10:00:00.000Z",
        },
      ],
      businessContext: [
        {
          id: "bc-1",
          category: "project",
          key: "current_state_card",
          value: { focus: "shared cross-seat story" },
          priority: 10,
          updated_at: "2026-05-09T09:50:00.000Z",
        },
      ],
      conversationTurns: [
        {
          id: "turn-user",
          session_id: "session-1",
          role: "user",
          content: "Please action the Orchestrator job.",
          created_at: "2026-05-09T10:45:00.000Z",
        },
        {
          id: "turn-ai",
          session_id: "session-1",
          role: "assistant",
          content: "I will claim it and build the first slice.",
          created_at: "2026-05-09T10:46:00.000Z",
        },
      ],
    });

    expect(context.version).toBe("orchestrator-context-v1");
    expect(context.current_state_card.active_todo_count).toBe(1);
    // active_jobs is the v9-pinned strict count: in_progress + owner_last_seen <= 24h.
    // The codex-seat owner here was last seen 5 minutes before generatedAt, so the
    // single in_progress todo counts as active. Stays in lock-step with heartbeat
    // step 5 so PASS/BLOCKER never oscillates on identical state (todo a4cd5229).
    expect(context.current_state_card.active_jobs).toBe(1);
    expect(context.current_state_card.active_seat_count).toBe(1);
    expect(context.current_state_card.blocker_count).toBe(1);
    expect(context.current_state_card.next_actions[0]).toContain("Orchestrator context layer");
    expect(context.profile_cards.find((profile) => profile.agent_id === "human-chris")?.role).toBe("human");
    expect(context.profile_cards.find((profile) => profile.agent_id === "chatgpt-codex-seat")?.freshness_label).toBe("Live");
    expect(context.profile_cards.find((profile) => profile.agent_id === "chatgpt-codex-seat")?.source_app_label).toBe("Codex");
    expect(context.profile_cards.find((profile) => profile.agent_id === "chatgpt-codex-seat")?.connection_label).toBe("Connected");
    expect(context.profile_cards.find((profile) => profile.agent_id === "human-chris")?.source_app_label).toBe("Admin UI");
    expect(context.profile_cards.find((profile) => profile.agent_id === "human-chris")?.freshness_label).toBe("Recent");
    expect(context.continuity_events.some((event) => event.kind === "proof" && event.source_id === "msg-proof")).toBe(true);
    expect(context.continuity_events.some((event) => event.source_kind === "conversation_turn" && event.role === "user")).toBe(true);
    expect(context.library_snapshots.map((snapshot) => snapshot.source_kind)).toEqual(
      expect.arrayContaining(["library", "business_context", "session_summary"]),
    );
    expect(context.rolling_snapshot.mode).toBe("read-plan");
    expect(context.rolling_snapshot.active_jobs[0].source_id).toBe("todo-1");
    expect(context.rolling_snapshot.promoted_decisions.some((item) => item.source_id === "msg-user")).toBe(true);
    expect(context.rolling_snapshot.source_pointers.some((pointer) => pointer.source_id === "todo-1")).toBe(true);
  });

  it("adds human operator timezone context to compact handoffs", () => {
    const context = buildOrchestratorContext({
      generatedAt: "2026-05-10T01:00:00.000Z",
      profiles: [],
      messages: [],
      todos: [],
      comments: [],
      dispatches: [],
      signals: [],
      sessions: [],
      library: [],
      businessContext: [
        {
          id: "bc-timezone",
          category: "preference",
          key: "operator_timezone",
          value: {
            timezone: "Australia/Sydney",
            source: "manual",
            updated_at: "2026-05-10T00:50:00.000Z",
            privacy: "timezone-only",
          },
          priority: 98,
          updated_at: "2026-05-10T00:50:00.000Z",
        },
      ],
      conversationTurns: [],
    });

    expect(context.human_operator_time?.timezone).toBe("Australia/Sydney");
    expect(context.human_operator_time?.source).toBe("manual");
    expect(context.human_operator_time?.local_date).toBe("2026-05-10");
    expect(context.human_operator_time?.local_time).toBe("11:00");
    expect(context.human_operator_time?.privacy).toBe("timezone-only");
    expect(context.human_operator_time?.summary).toContain("manual override");
    expect(context.seat_handshake.next_prompt).toContain("Human operator local time");
    expect(context.seat_handshake.next_prompt).toContain("Australia/Sydney");
  });

  it("labels profile-card check-in freshness for AI seats", () => {
    const context = buildOrchestratorContext({
      generatedAt: "2026-05-09T12:00:00.000Z",
      profiles: [
        {
          agent_id: "live-seat",
          last_seen_at: "2026-05-09T11:55:00.000Z",
        },
        {
          agent_id: "recent-seat",
          last_seen_at: "2026-05-09T09:30:00.000Z",
        },
        {
          agent_id: "missed-seat",
          last_seen_at: "2026-05-09T10:00:00.000Z",
          next_checkin_at: "2026-05-09T11:00:00.000Z",
        },
        {
          agent_id: "quiet-seat",
          last_seen_at: "2026-05-08T00:00:00.000Z",
        },
      ],
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

    const labels = new Map(context.profile_cards.map((profile) => [profile.agent_id, profile.freshness_label]));

    expect(labels.get("live-seat")).toBe("Live");
    expect(labels.get("recent-seat")).toBe("Recent");
    expect(labels.get("missed-seat")).toBe("Missed check-in");
    expect(labels.get("quiet-seat")).toBe("Quiet");
    expect(context.profile_cards.find((profile) => profile.agent_id === "missed-seat")?.connection_label).toBe("Check-in overdue");
  });

  it("redacts sensitive auth and billing material before summaries leave the layer", () => {
    const raw = "Authorization: Bearer sk-test-not-real-token api_key=uc_fake_key_1234567890 card 4242 4242 4242 4242";

    expect(redactSensitive(raw)).not.toContain("sk-test-not-real-token");
    expect(redactSensitive(raw)).not.toContain("uc_fake_key_1234567890");
    expect(redactSensitive(raw)).not.toContain("4242 4242 4242 4242");
    expect(redactSensitive(raw)).toContain("[redacted secret]");
    expect(redactSensitive(raw)).toContain("[redacted billing data]");
  });

  it("keeps compact text bounded for progressive memory reads", () => {
    const compact = compactText("x ".repeat(300), 80);

    expect(compact.length).toBeLessThanOrEqual(80);
    expect(compact.endsWith("...")).toBe(true);
  });

  it("builds rolling snapshots without promoting heartbeat noise or secrets", () => {
    const context = buildOrchestratorContext({
      generatedAt: "2026-05-09T13:00:00.000Z",
      profiles: [],
      messages: [
        {
          id: "msg-heartbeat",
          author_agent_id: "heartbeat-seat",
          text: "DONT_NOTIFY: quiet-status heartbeat, no user action needed.",
          tags: ["heartbeat"],
          created_at: "2026-05-09T12:59:00.000Z",
        },
        {
          id: "msg-decision-secret",
          author_agent_id: "chatgpt-codex-seat",
          text: "Chris greenlit rolling snapshots with Authorization: Bearer sk-test-not-real-token in copied debug text.",
          tags: ["decision"],
          created_at: "2026-05-09T12:58:00.000Z",
        },
      ],
      todos: [],
      comments: [],
      dispatches: [],
      signals: [],
      sessions: [],
      library: [],
      businessContext: [],
      conversationTurns: [],
    });

    const snapshotText = JSON.stringify(context.rolling_snapshot);

    expect(snapshotText).not.toContain("sk-test-not-real-token");
    expect(snapshotText).not.toContain("DONT_NOTIFY");
    expect(context.rolling_snapshot.promoted_decisions.some((item) => item.source_id === "msg-decision-secret")).toBe(true);
    expect(context.rolling_snapshot.source_pointers.some((pointer) => pointer.source_id === "msg-heartbeat")).toBe(false);
    expect(context.rolling_snapshot.persistence_plan.raw_transcript_policy).toContain("Do not persist raw transcripts");
  });

  it("does not count old WakePass or Fishbowl stale rows as active blockers when no jobs remain", () => {
    const context = buildOrchestratorContext({
      generatedAt: "2026-05-11T06:30:00.000Z",
      profiles: [],
      messages: [],
      todos: [],
      comments: [],
      dispatches: [
        {
          dispatch_id: "dispatch-stale-wakepass",
          source: "wakepass",
          target_agent_id: "master",
          task_ref: null,
          status: "stale",
          payload: {
            title: "LaunchOnly worker renamed to IgniteOnly and PR merged",
            source_url: "https://github.com/malamutemayhem/unclick-agent-native-endpoints/issues/706",
          },
          created_at: "2026-05-11T04:00:00.000Z",
          updated_at: "2026-05-11T04:10:00.000Z",
        },
        {
          dispatch_id: "dispatch-stale-fishbowl",
          source: "fishbowl",
          target_agent_id: "master",
          task_ref: null,
          status: "stale",
          payload: {
            title: "Old todo assignment that no longer has an active todo",
          },
          created_at: "2026-05-11T04:05:00.000Z",
          updated_at: "2026-05-11T04:15:00.000Z",
        },
      ],
      signals: [],
      sessions: [],
      library: [],
      businessContext: [],
      conversationTurns: [],
    });

    expect(context.continuity_events.filter((event) => event.kind === "blocker")).toHaveLength(2);
    expect(context.current_state_card.active_todo_count).toBe(0);
    expect(context.current_state_card.blocker_count).toBe(0);
    expect(context.current_state_card.blockers).toHaveLength(0);
    expect(context.rolling_snapshot.active_blockers).toHaveLength(0);
    expect(context.rolling_snapshot.summary).toContain("0 blocker signals");
    expect(context.seat_handshake.active_blocker).toBeNull();
  });

  it("does not count fresh WakePass issue-comment stale rows as active blockers when no jobs remain", () => {
    const context = buildOrchestratorContext({
      generatedAt: "2026-05-13T04:05:00.000Z",
      profiles: [],
      messages: [],
      todos: [],
      comments: [],
      dispatches: [
        {
          dispatch_id: "dispatch-fresh-issue-comment-wake",
          source: "wakepass",
          target_agent_id: "master",
          task_ref: "wake-issue_comment-comment-4436827196-32a36c4d4da6",
          status: "stale",
          payload: {
            source_url: "https://github.com/malamutemayhem/unclick-agent-native-endpoints/issues/751",
            wake_reason: "Manual wake from issue comment",
          },
          created_at: "2026-05-13T03:30:00.000Z",
          updated_at: "2026-05-13T03:30:00.000Z",
        },
      ],
      signals: [],
      sessions: [],
      library: [],
      businessContext: [],
      conversationTurns: [],
    });

    expect(context.continuity_events.filter((event) => event.kind === "blocker")).toHaveLength(1);
    expect(context.current_state_card.blocker_count).toBe(0);
    expect(context.current_state_card.blockers).toHaveLength(0);
    expect(context.rolling_snapshot.active_blockers).toHaveLength(0);
    expect(context.seat_handshake.active_blocker).toBeNull();
  });

  it("keeps superseded WakePass stale dispatches in history without counting active blockers", () => {
    const context = buildOrchestratorContext({
      generatedAt: "2026-05-13T03:48:00.000Z",
      profiles: [],
      messages: [],
      todos: [
        {
          id: "todo-current-backlog",
          title: "Current backlog item",
          description: "Keep active work visible while stale proof is cleaned up.",
          status: "open",
          priority: "urgent",
          created_by_agent_id: "codex",
          created_at: "2026-05-13T02:50:00.000Z",
          updated_at: "2026-05-13T03:40:00.000Z",
        },
      ],
      comments: [],
      dispatches: [
        {
          dispatch_id: "dispatch-superseded-wakepass",
          source: "wakepass",
          target_agent_id: "master",
          task_ref: null,
          status: "stale",
          payload: {
            reason: "superseded_status_comment",
            bridge_status: "suppress",
            painpoint_detected: false,
            painpoint_type: "none",
            title: "Old heartbeat BLOCKER superseded by later PASS proof",
            source_url:
              "https://github.com/malamutemayhem/unclick-agent-native-endpoints/issues/751#issuecomment-4436810525",
          },
          created_at: "2026-05-13T03:20:00.000Z",
          updated_at: "2026-05-13T03:30:00.000Z",
        },
        {
          dispatch_id: "dispatch-real-wakepass",
          source: "wakepass",
          target_agent_id: "master",
          task_ref: null,
          status: "stale",
          payload: {
            title: "WakePass current blocker still needs review",
            source_url:
              "https://github.com/malamutemayhem/unclick-agent-native-endpoints/issues/800#issuecomment-4437000000",
          },
          created_at: "2026-05-13T03:25:00.000Z",
          updated_at: "2026-05-13T03:31:00.000Z",
        },
      ],
      signals: [],
      sessions: [],
      library: [],
      businessContext: [],
      conversationTurns: [],
    });

    const blockerEvents = context.continuity_events.filter((event) => event.kind === "blocker");
    const activeBlockerIds = context.rolling_snapshot.active_blockers.map((event) => event.source_id);

    expect(blockerEvents.map((event) => event.source_id)).toEqual(
      expect.arrayContaining(["dispatch-superseded-wakepass", "dispatch-real-wakepass"]),
    );
    expect(context.current_state_card.active_todo_count).toBe(1);
    expect(context.current_state_card.blocker_count).toBe(1);
    expect(activeBlockerIds).toEqual(["dispatch-real-wakepass"]);
    expect(JSON.stringify(context.current_state_card.blockers)).toContain("current blocker");
    expect(JSON.stringify(context.current_state_card.blockers)).not.toContain("superseded_status_comment");
  });

  it("keeps heartbeat prompt bodies out of continuity summaries", () => {
    const context = buildOrchestratorContext({
      generatedAt: "2026-05-09T23:45:00.000Z",
      profiles: [],
      messages: [
        {
          id: "msg-heartbeat-proof",
          author_agent_id: "chatgpt-codex-seat",
          text: "PASS: linked Orchestrator heartbeat-noise ScopePack to parent; proof: comment abc123; cleanup: done.",
          tags: ["heartbeat", "proof"],
          created_at: "2026-05-09T23:43:00.000Z",
        },
      ],
      todos: [],
      comments: [],
      dispatches: [],
      signals: [],
      sessions: [],
      library: [],
      businessContext: [],
      conversationTurns: [
        {
          id: "turn-heartbeat",
          session_id: "heartbeat-session",
          role: "user",
          content: `<heartbeat><automation_id>unclick-heartbeat</automation_id><current_time_iso>2026-05-09T23:41:18.398Z</current_time_iso><instructions>Run UnClick Heartbeat. Use the Seats > Heartbeat policy, do one safe useful step, and reply with PASS or BLOCKER only.</instructions></heartbeat>`,
          created_at: "2026-05-09T23:41:00.000Z",
        },
        {
          id: "turn-real",
          session_id: "normal-session",
          role: "user",
          content: "Please keep Orchestrator context readable for new seats.",
          created_at: "2026-05-09T23:40:00.000Z",
        },
      ],
    });

    const continuityText = JSON.stringify(context.continuity_events);

    expect(isHeartbeatAutomationText("Run UnClick Heartbeat. Use the Seats > Heartbeat policy.")).toBe(true);
    expect(continuityText).not.toContain("<heartbeat>");
    expect(continuityText).not.toContain("current_time_iso");
    expect(continuityText).toContain("Heartbeat schedule request");
    expect(continuityText).toContain("embedded UnClick heartbeat instructions");
    expect(continuityText).toContain("Heartbeat result: PASS");
    expect(continuityText).toContain("Please keep Orchestrator context readable");
    expect(context.rolling_snapshot.source_pointers.some((pointer) => pointer.source_id === "turn-heartbeat")).toBe(false);
  });

  it("does not promote heartbeat status summaries that mention blockers", () => {
    const context = buildOrchestratorContext({
      generatedAt: "2026-05-12T11:45:00.000Z",
      profiles: [],
      messages: [],
      todos: [],
      comments: [
        {
          id: "comment-heartbeat-proof",
          target_kind: "todo",
          target_id: "todo-active-state",
          author_agent_id: "chatgpt-codex-heartbeat-seat",
          text: "Heartbeat proof 2026-05-12T11:43Z: active_jobs=6. Remaining blocker noise is stale history, not the active_jobs formula.",
          created_at: "2026-05-12T11:43:00.000Z",
        },
      ],
      dispatches: [],
      signals: [],
      sessions: [],
      library: [],
      businessContext: [],
      conversationTurns: [
        {
          id: "turn-heartbeat-pass",
          session_id: "unclick-heartbeat",
          role: "assistant",
          content: "PASS: Heartbeat completed one safe useful step. Remaining blocker noise is stale history.",
          created_at: "2026-05-12T11:44:00.000Z",
        },
        {
          id: "turn-heartbeat-blocker",
          session_id: "unclick-heartbeat",
          role: "assistant",
          content: "BLOCKER: Heartbeat verified unchanged state, progress checked, next native cleanup.",
          created_at: "2026-05-12T11:42:00.000Z",
        },
      ],
    });

    expect(context.current_state_card.blocker_count).toBe(0);
    expect(context.rolling_snapshot.active_blockers).toHaveLength(0);
    expect(context.continuity_events.find((event) => event.source_id === "comment-heartbeat-proof")?.kind).toBe("proof");
    expect(context.continuity_events.find((event) => event.source_id === "turn-heartbeat-pass")?.kind).toBe("proof");
    expect(context.continuity_events.find((event) => event.source_id === "turn-heartbeat-blocker")?.kind).toBe("status");
  });

  it("does not promote done/fyi and info status chatter that mentions blocker cleanup", () => {
    const context = buildOrchestratorContext({
      generatedAt: "2026-05-12T12:10:00.000Z",
      profiles: [],
      messages: [
        {
          id: "msg-pr-merged",
          author_agent_id: "chatgpt-codex-heartbeat-seat",
          text: "PR #736 is merged. It fixes Orchestrator heartbeat self-noise so heartbeat PASS/BLOCKER/proof text should stop inflating live blocker counts.",
          tags: ["done", "fyi"],
          created_at: "2026-05-12T12:02:00.000Z",
        },
      ],
      todos: [],
      comments: [
        {
          id: "comment-heartbeat-post-merge-proof",
          target_kind: "todo",
          target_id: "todo-dead-seat",
          author_agent_id: "chatgpt-codex-heartbeat-seat",
          text: "Heartbeat post-merge proof 2026-05-12T12:06Z: PR #736 is merged. Live Orchestrator still reports blocker_count=5.",
          created_at: "2026-05-12T12:06:00.000Z",
        },
      ],
      dispatches: [],
      signals: [
        {
          id: "signal-message-posted",
          tool: "fishbowl",
          action: "message_posted",
          severity: "info",
          summary: "PR #736 opened for the Orchestrator heartbeat blocker self-noise fix.",
          deep_link: "/admin/boardroom#msg-736",
          created_at: "2026-05-12T11:56:00.000Z",
        },
      ],
      sessions: [],
      library: [],
      businessContext: [],
      conversationTurns: [],
    });

    expect(context.current_state_card.blocker_count).toBe(0);
    expect(context.rolling_snapshot.active_blockers).toHaveLength(0);
    expect(context.continuity_events.find((event) => event.source_id === "msg-pr-merged")?.kind).toBe("status");
    expect(context.continuity_events.find((event) => event.source_id === "comment-heartbeat-post-merge-proof")?.kind).toBe("proof");
    expect(context.continuity_events.find((event) => event.source_id === "signal-message-posted")?.kind).toBe("status");
  });

  it("does not promote zero blocker metric chatter as a live blocker", () => {
    const context = buildOrchestratorContext({
      generatedAt: "2026-05-12T12:35:00.000Z",
      profiles: [],
      messages: [],
      todos: [],
      comments: [],
      dispatches: [],
      signals: [],
      sessions: [],
      library: [],
      businessContext: [],
      conversationTurns: [
        {
          id: "turn-zero-metric-pass",
          session_id: "unclick-heartbeat",
          role: "assistant",
          content:
            "PASS: Verified Orchestrator after PR #737. Current state card now reports active_jobs=0, active_todo_count=0, blocker_count=0.",
          created_at: "2026-05-12T12:21:46.000Z",
        },
        {
          id: "turn-zero-metric-summary",
          session_id: "unclick-heartbeat",
          role: "assistant",
          content: "Current state card summary: 0 active jobs, 1 active seat, 0 blocker signals.",
          created_at: "2026-05-12T12:22:46.000Z",
        },
      ],
    });

    expect(context.current_state_card.blocker_count).toBe(0);
    expect(context.rolling_snapshot.active_blockers).toHaveLength(0);
    expect(context.continuity_events.find((event) => event.source_id === "turn-zero-metric-pass")?.kind).toBe("proof");
    expect(context.continuity_events.find((event) => event.source_id === "turn-zero-metric-summary")?.kind).toBe("status");
  });

  it("does not promote heartbeat schedule and protocol chatter as live blockers", () => {
    const context = buildOrchestratorContext({
      generatedAt: "2026-05-12T12:45:00.000Z",
      profiles: [],
      messages: [],
      todos: [],
      comments: [],
      dispatches: [],
      signals: [],
      sessions: [],
      library: [],
      businessContext: [],
      conversationTurns: [
        {
          id: "turn-heartbeat-request",
          session_id: "unclick-heartbeat",
          role: "user",
          content:
            '<heartbeat><automation_id>unclick-heartbeat</automation_id><instructions>Run UnClick Heartbeat and reply with PASS/BLOCKER plus progress.</instructions></heartbeat>',
          created_at: "2026-05-12T12:41:56.000Z",
        },
        {
          id: "turn-heartbeat-protocol-pass",
          session_id: "unclick-heartbeat-seat",
          role: "assistant",
          content:
            "UnClick healthy. PASS. heartbeat_protocol=v10. check_signals=2 info-only; no action_needed/blocker signals.",
          created_at: "2026-05-12T12:42:56.000Z",
        },
        {
          id: "turn-heartbeat-pass-at",
          session_id: "unclick-heartbeat-seat",
          role: "assistant",
          content:
            "UnClick Heartbeat PASS @ 2026-05-12T12:31Z. check_signals=1 info-only; list_todos in_progress=9 unchanged.",
          created_at: "2026-05-12T12:43:56.000Z",
        },
        {
          id: "turn-heartbeat-no-slash-signals",
          session_id: "unclick-heartbeat-seat",
          role: "assistant",
          content:
            "UnClick Heartbeat 2026-05-12. check_signals: 1 info. no action_needed/blocker signals.",
          created_at: "2026-05-12T12:44:56.000Z",
        },
        {
          id: "turn-heartbeat-tick-r1-blocker",
          session_id: "unclick-heartbeat-seat",
          role: "assistant",
          content:
            "Heartbeat tick 2026-05-14T01:36Z. PASS. check_signals: 1 info. Job hunt: active_jobs=5 in_progress. R1 BLOCKER is backlog state, not a live blocker event.",
          created_at: "2026-05-12T12:45:56.000Z",
        },
      ],
    });

    expect(
      isHeartbeatAutomationText(
        "Heartbeat tick 2026-05-14T01:36Z. PASS. check_signals: 1 info. Job hunt: active_jobs=5 in_progress. R1 BLOCKER is backlog state.",
      ),
    ).toBe(true);
    expect(context.current_state_card.blocker_count).toBe(0);
    expect(context.rolling_snapshot.active_blockers).toHaveLength(0);
    expect(context.seat_handshake.active_blocker).toBeNull();
    expect(context.continuity_events.find((event) => event.source_id === "turn-heartbeat-request")?.kind).toBe("status");
    expect(context.continuity_events.find((event) => event.source_id === "turn-heartbeat-protocol-pass")?.kind).toBe("proof");
    expect(context.continuity_events.find((event) => event.source_id === "turn-heartbeat-pass-at")?.kind).toBe("proof");
    expect(context.continuity_events.find((event) => event.source_id === "turn-heartbeat-no-slash-signals")?.kind).toBe("status");
    expect(context.continuity_events.find((event) => event.source_id === "turn-heartbeat-tick-r1-blocker")?.kind).toBe("status");
  });

  it("keeps fresh-seat active_decision populated from active work when no decision event is live", () => {
    const context = buildOrchestratorContext({
      generatedAt: "2026-05-10T04:16:00.000Z",
      profiles: [
        {
          agent_id: "pinballwake-autonomous-runner",
          display_name: "PinballWake",
          user_agent_hint: "github-action scheduled heartbeat",
          last_seen_at: "2026-05-10T04:14:00.000Z",
        },
      ],
      messages: [
        {
          id: "msg-noise",
          author_agent_id: "heartbeat-seat",
          text: "DONT_NOTIFY: quiet-status heartbeat, no user action needed.",
          tags: ["heartbeat"],
          created_at: "2026-05-10T04:15:00.000Z",
        },
      ],
      todos: [
        {
          id: "todo-orchestrator-finish-line",
          title: "Orchestrator finish line proof",
          description: "Get a scheduled proof green after the trusted fallback merge.",
          status: "open",
          priority: "urgent",
          created_by_agent_id: "codex",
          created_at: "2026-05-10T03:40:00.000Z",
          updated_at: "2026-05-10T04:10:00.000Z",
        },
      ],
      comments: [
        {
          id: "comment-trusted-fallback-proof",
          target_kind: "todo",
          target_id: "todo-orchestrator-finish-line",
          author_agent_id: "chatgpt-codex-worker2",
          text: "PASS: trusted fallback gate shipped; proof: PR #659; cleanup: done.",
          created_at: "2026-05-10T04:12:00.000Z",
        },
      ],
      dispatches: [],
      signals: [],
      sessions: [],
      library: [],
      businessContext: [],
      conversationTurns: [],
    });

    expect(context.rolling_snapshot.promoted_decisions).toHaveLength(0);
    expect(context.seat_handshake.active_decision).toContain("Continue current priority job");
    expect(context.seat_handshake.active_decision).toContain("Orchestrator finish line proof");
    expect(context.seat_handshake.active_job).toContain("Orchestrator finish line proof");
    expect(context.seat_handshake.recent_proof).toContain("trusted fallback gate shipped");
    expect(context.seat_handshake.source_pointers.map((pointer) => pointer.source_id)).toEqual(
      expect.arrayContaining(["todo-orchestrator-finish-line", "comment-trusted-fallback-proof"]),
    );
  });

  it("builds a fresh-seat handshake from compact rolling context only", () => {
    const context = buildOrchestratorContext({
      generatedAt: "2026-05-10T00:20:00.000Z",
      profiles: [
        {
          agent_id: "pinballwake-autonomous-runner",
          display_name: "PinballWake",
          user_agent_hint: "github-action scheduled heartbeat",
          last_seen_at: "2026-05-10T00:18:00.000Z",
        },
        {
          agent_id: "master-coordinator",
          display_name: "Master Coordinator",
          user_agent_hint: "orchestrator coordinator",
          last_seen_at: "2026-05-09T20:00:00.000Z",
          next_checkin_at: "2026-05-09T22:00:00.000Z",
        },
      ],
      messages: [
        {
          id: "msg-decision",
          author_agent_id: "human-chris",
          text: "Chris greenlit Orchestrator V1 proof with AutoPilotKit and PinballWake.",
          tags: ["decision"],
          created_at: "2026-05-10T00:11:00.000Z",
        },
        {
          id: "msg-proof",
          author_agent_id: "pinballwake-autonomous-runner",
          text: "PASS: scheduled cold-seat proof completed; proof: run 123; cleanup: done.",
          tags: ["proof"],
          created_at: "2026-05-10T00:12:00.000Z",
        },
        {
          id: "msg-noise",
          author_agent_id: "heartbeat-seat",
          text: "DONT_NOTIFY: quiet-status heartbeat, no user action needed.",
          tags: ["heartbeat"],
          created_at: "2026-05-10T00:19:00.000Z",
        },
      ],
      todos: [
        {
          id: "todo-orchestrator-proof",
          title: "Orchestrator chip: prove handshake-to-rolling-snapshot pickup",
          description: "Fresh seat reads compact context without transcript paste.",
          status: "open",
          priority: "urgent",
          created_by_agent_id: "codex",
          created_at: "2026-05-10T00:00:00.000Z",
          updated_at: "2026-05-10T00:16:00.000Z",
        },
      ],
      comments: [],
      dispatches: [],
      signals: [
        {
          id: "signal-blocker",
          tool: "orchestrator",
          action: "proof_needed",
          severity: "action_needed",
          summary: "Fresh-seat pickup still needs a scheduled proof.",
          created_at: "2026-05-10T00:13:00.000Z",
        },
      ],
      sessions: [],
      library: [],
      businessContext: [],
      conversationTurns: [
        {
          id: "turn-heartbeat",
          session_id: "heartbeat-session",
          role: "user",
          content:
            "Run UnClick Heartbeat. Use the Seats > Heartbeat policy, do one safe useful step, and reply with PASS or BLOCKER only.",
          created_at: "2026-05-10T00:19:30.000Z",
        },
      ],
    });

    expect(context.seat_handshake.mode).toBe("fresh-seat-pickup");
    expect(context.seat_handshake.active_decision).toContain("AutoPilotKit and PinballWake");
    expect(context.seat_handshake.active_job).toContain("handshake-to-rolling-snapshot");
    expect(context.seat_handshake.recent_proof).toContain("scheduled cold-seat proof completed");
    expect(context.seat_handshake.active_blocker).toContain("Fresh-seat pickup still needs");
    expect(context.seat_handshake.seat_freshness).toEqual(
      expect.arrayContaining(["PinballWake: Live", "Master Coordinator: Missed check-in"]),
    );
    expect(JSON.stringify(context.seat_handshake)).not.toContain("DONT_NOTIFY");
    expect(JSON.stringify(context.seat_handshake)).not.toContain("Run UnClick Heartbeat");
    expect(context.seat_handshake.next_prompt).not.toContain("Seats > Heartbeat policy");
    expect(context.seat_handshake.next_prompt).toContain("BLOCKER: <missing>");
    expect(context.seat_handshake.source_pointers.map((pointer) => pointer.source_id)).toEqual(
      expect.arrayContaining(["msg-decision", "todo-orchestrator-proof", "msg-proof", "signal-blocker"]),
    );
  });

  it("uses saved session decisions when recent boardroom chatter has no decision event", () => {
    const context = buildOrchestratorContext({
      generatedAt: "2026-05-10T04:15:00.000Z",
      profiles: [],
      messages: [
        {
          id: "msg-proof",
          author_agent_id: "pinballwake-autonomous-runner",
          text: "PASS: AutoPilotKit fallback gate shipped; proof: PR #659.",
          tags: ["proof"],
          created_at: "2026-05-10T04:00:00.000Z",
        },
      ],
      todos: [
        {
          id: "todo-active",
          title: "Orchestrator scheduled proof",
          description: "Keep compact handoff proof readable.",
          status: "open",
          priority: "urgent",
          created_by_agent_id: "chatgpt-codex-seat",
          created_at: "2026-05-10T03:50:00.000Z",
          updated_at: "2026-05-10T04:10:00.000Z",
        },
      ],
      comments: [],
      dispatches: [],
      signals: [],
      sessions: [
        {
          id: "session-row",
          session_id: "session-orchestrator-fallback",
          platform: "codex",
          summary: "AutoPilotKit scheduler fallback shipped and awaits scheduled proof.",
          decisions: [
            "Use UTC for proof math and allow trusted UnClick heartbeat fallback only when GitHub schedule evidence is stale.",
          ],
          topics: ["orchestrator", "autopilotkit"],
          created_at: "2026-05-10T04:01:00.000Z",
        },
      ],
      library: [],
      businessContext: [],
      conversationTurns: [],
    });

    expect(context.rolling_snapshot.promoted_decisions[0].source_id).toBe("session-orchestrator-fallback");
    expect(context.seat_handshake.active_decision).toContain("Use UTC for proof math");
    expect(context.seat_handshake.source_pointers.map((pointer) => pointer.source_id)).toEqual(
      expect.arrayContaining(["session-orchestrator-fallback", "todo-active", "msg-proof"]),
    );
  });
});

// active_jobs v9 definition pinned by todo a4cd5229 + Heartbeat step 5:
//   active_jobs = COUNT(todos WHERE status='in_progress' AND owner_last_seen <= 24h)
// These tests lock that contract so the Heartbeat and the Orchestrator
// state_card never disagree on identical input.
describe("computeActiveJobsCount (v9 definition)", () => {
  const NOW_MS = Date.parse("2026-05-12T00:00:00.000Z");
  const HOUR_MS = 60 * 60 * 1000;

  it("counts an in_progress todo whose owner was seen in the last 24h", () => {
    const count = computeActiveJobsCount(
      [
        {
          id: "todo-active",
          title: "Active build",
          status: "in_progress",
          priority: "urgent",
          created_by_agent_id: "watcher",
          assigned_to_agent_id: "builder-fresh",
          created_at: "2026-05-11T00:00:00.000Z",
        },
      ],
      [
        {
          agent_id: "builder-fresh",
          last_seen_at: new Date(NOW_MS - 2 * HOUR_MS).toISOString(),
        },
      ],
      NOW_MS,
    );
    expect(count).toBe(1);
  });

  it("excludes an in_progress todo whose owner has been dormant more than 24h", () => {
    const count = computeActiveJobsCount(
      [
        {
          id: "todo-dormant",
          title: "Dormant owner",
          status: "in_progress",
          priority: "urgent",
          created_by_agent_id: "watcher",
          assigned_to_agent_id: "builder-stale",
          created_at: "2026-05-08T00:00:00.000Z",
        },
      ],
      [
        {
          agent_id: "builder-stale",
          // 6 days ago. The exact case Chris hit earlier today (todo e9e308cd
          // assigned to "master" who hadn't been seen in 6 days but was
          // still counted as an active job).
          last_seen_at: new Date(NOW_MS - 6 * 24 * HOUR_MS).toISOString(),
        },
      ],
      NOW_MS,
    );
    expect(count).toBe(0);
  });

  it("does not count open todos even when the owner is fresh", () => {
    const count = computeActiveJobsCount(
      [
        {
          id: "todo-open",
          title: "Open todo",
          status: "open",
          priority: "urgent",
          created_by_agent_id: "watcher",
          assigned_to_agent_id: "builder-fresh",
          created_at: "2026-05-11T00:00:00.000Z",
        },
      ],
      [
        {
          agent_id: "builder-fresh",
          last_seen_at: new Date(NOW_MS - 10 * 60 * 1000).toISOString(),
        },
      ],
      NOW_MS,
    );
    expect(count).toBe(0);
  });

  it("does not count an in_progress todo with no assigned owner", () => {
    const count = computeActiveJobsCount(
      [
        {
          id: "todo-unowned",
          title: "Unowned in_progress",
          status: "in_progress",
          priority: "urgent",
          created_by_agent_id: "watcher",
          assigned_to_agent_id: null,
          created_at: "2026-05-11T00:00:00.000Z",
        },
      ],
      [],
      NOW_MS,
    );
    expect(count).toBe(0);
  });

  it("does not count an in_progress todo whose owner has no profile row", () => {
    // Owner string exists on the todo, but the profile is missing entirely.
    // This protects against a "ghost owner" where reclaim_count or a
    // historical lease left the assigned_to_agent_id non-empty but the
    // worker has never been seen at all.
    const count = computeActiveJobsCount(
      [
        {
          id: "todo-ghost",
          title: "Ghost owner",
          status: "in_progress",
          priority: "high",
          created_by_agent_id: "watcher",
          assigned_to_agent_id: "builder-ghost",
          created_at: "2026-05-11T00:00:00.000Z",
        },
      ],
      [],
      NOW_MS,
    );
    expect(count).toBe(0);
  });

  it("returns the identical count on identical input (no oscillation)", () => {
    // Acceptance criterion: heartbeat PASS/BLOCKER stops oscillating on
    // identical state. Same input must always produce the same count.
    const todos = [
      {
        id: "todo-a",
        title: "A",
        status: "in_progress",
        priority: "urgent",
        created_by_agent_id: "watcher",
        assigned_to_agent_id: "builder-1",
        created_at: "2026-05-11T00:00:00.000Z",
      },
      {
        id: "todo-b",
        title: "B",
        status: "in_progress",
        priority: "high",
        created_by_agent_id: "watcher",
        assigned_to_agent_id: "builder-2",
        created_at: "2026-05-11T00:00:00.000Z",
      },
    ];
    const profiles = [
      { agent_id: "builder-1", last_seen_at: new Date(NOW_MS - HOUR_MS).toISOString() },
      { agent_id: "builder-2", last_seen_at: new Date(NOW_MS - 3 * 24 * HOUR_MS).toISOString() },
    ];
    const first = computeActiveJobsCount(todos, profiles, NOW_MS);
    const second = computeActiveJobsCount(todos, profiles, NOW_MS);
    const third = computeActiveJobsCount(todos, profiles, NOW_MS);
    expect(first).toBe(1);
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it("current_state_card.active_jobs matches computeActiveJobsCount for the same inputs", () => {
    // Acceptance criterion: orchestrator state_card matches list_todos query.
    // The state_card builder MUST delegate to the same computeActiveJobsCount
    // function used by Heartbeat step 5, so an external caller asking
    // list_todos.filter(status=in_progress, fresh_owner) gets the same N.
    const todos = [
      {
        id: "todo-fresh",
        title: "Fresh",
        status: "in_progress",
        priority: "urgent",
        created_by_agent_id: "watcher",
        assigned_to_agent_id: "builder-fresh",
        created_at: "2026-05-11T00:00:00.000Z",
      },
      {
        id: "todo-stale",
        title: "Stale",
        status: "in_progress",
        priority: "urgent",
        created_by_agent_id: "watcher",
        assigned_to_agent_id: "builder-stale",
        created_at: "2026-05-08T00:00:00.000Z",
      },
      {
        id: "todo-open",
        title: "Open",
        status: "open",
        priority: "urgent",
        created_by_agent_id: "watcher",
        assigned_to_agent_id: null,
        created_at: "2026-05-11T00:00:00.000Z",
      },
    ];
    const profiles = [
      { agent_id: "builder-fresh", last_seen_at: new Date(NOW_MS - 30 * 60 * 1000).toISOString() },
      { agent_id: "builder-stale", last_seen_at: new Date(NOW_MS - 5 * 24 * HOUR_MS).toISOString() },
    ];
    const directCount = computeActiveJobsCount(todos, profiles, NOW_MS);
    const context = buildOrchestratorContext({
      generatedAt: new Date(NOW_MS).toISOString(),
      profiles,
      messages: [],
      todos,
      comments: [],
      dispatches: [],
      signals: [],
      sessions: [],
      library: [],
      businessContext: [],
      conversationTurns: [],
    });
    expect(directCount).toBe(1);
    expect(context.current_state_card.active_jobs).toBe(directCount);
  });
});

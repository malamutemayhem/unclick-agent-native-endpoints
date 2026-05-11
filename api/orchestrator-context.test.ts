import { describe, expect, it } from "vitest";
import {
  buildOrchestratorContext,
  compactText,
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

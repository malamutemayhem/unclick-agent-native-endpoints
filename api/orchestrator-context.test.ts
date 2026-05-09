import { describe, expect, it } from "vitest";
import {
  buildOrchestratorContext,
  compactText,
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
    expect(context.continuity_events.some((event) => event.kind === "proof" && event.source_id === "msg-proof")).toBe(true);
    expect(context.continuity_events.some((event) => event.source_kind === "conversation_turn" && event.role === "user")).toBe(true);
    expect(context.library_snapshots.map((snapshot) => snapshot.source_kind)).toEqual(
      expect.arrayContaining(["library", "business_context", "session_summary"]),
    );
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
});

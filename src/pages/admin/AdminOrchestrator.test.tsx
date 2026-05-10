import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminOrchestratorPage from "./AdminOrchestrator";

vi.mock("@/lib/auth", () => ({
  useSession: () => ({
    session: { access_token: "session-token" },
    user: { id: "user-1" },
    loading: false,
  }),
}));

describe("AdminOrchestratorPage", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_AI_CHAT_ENABLED", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        const textUrl = String(url);
        if (textUrl.includes("orchestrator_context_read")) {
          return {
            ok: true,
            json: async () => ({
              context: {
                version: "orchestrator-context-v1",
                generated_at: "2026-05-10T06:00:00.000Z",
                current_state_card: {
                  summary: "1 active job, 1 active seat, 0 blocker signals.",
                  newest_activity_at: "2026-05-10T05:55:00.000Z",
                  newest_checkin_at: "2026-05-10T05:55:00.000Z",
                  active_todo_count: 1,
                  blocker_count: 0,
                  active_seat_count: 1,
                  next_actions: ["urgent in_progress: HarnessKit"],
                  blockers: [],
                  live_sources: {
                    profiles: 1,
                    boardroom_messages: 1,
                    todos: 1,
                    comments: 0,
                    dispatches: 0,
                    signals: 0,
                    sessions: 1,
                    library: 0,
                    business_context: 0,
                    conversation_turns: 1,
                  },
                },
                profile_cards: [
                  {
                    agent_id: "codex-orchestrator-seat",
                    label: "Codex Orchestrator Seat",
                    role: "ai-seat",
                    emoji: "🤖",
                    source_app_label: "Codex",
                    connection_label: "Connected",
                    last_seen_at: "2026-05-10T05:55:00.000Z",
                    freshness_label: "Live",
                  },
                ],
                human_operator_time: null,
                continuity_events: [
                  {
                    source_kind: "conversation_turn",
                    source_id: "turn-1",
                    created_at: "2026-05-10T05:55:00.000Z",
                    kind: "context",
                    role: "user",
                    summary: "user: Orchestrator context should show subscription messages.",
                    tags: ["conversation", "user"],
                  },
                  {
                    source_kind: "boardroom_message",
                    source_id: "msg-1",
                    created_at: "2026-05-10T05:56:00.000Z",
                    kind: "proof",
                    actor_agent_id: "codex-orchestrator-seat",
                    summary: "PASS: Orchestrator continuity proof landed.",
                    tags: ["done"],
                  },
                ],
                library_snapshots: [],
              },
            }),
          } as Response;
        }

        if (textUrl.includes("tenant_settings")) {
          return {
            ok: true,
            json: async () => ({
              env_enabled: true,
              settings: {
                ai_chat_enabled: true,
                ai_chat_provider: "google",
                ai_chat_model: "gemini-2.5-flash-lite",
                ai_chat_system_prompt: null,
                ai_chat_max_turns: 20,
                has_api_key: true,
              },
            }),
          } as Response;
        }

        if (textUrl.includes("admin_channel_status")) {
          return {
            ok: true,
            json: async () => ({ channel_active: false, last_seen: null, client_info: null }),
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({}),
        } as Response;
      }),
    );
  });

  it("shows read-only continuity instead of a new assistant input", async () => {
    render(
      <MemoryRouter>
        <AdminOrchestratorPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Continuity Feed")).toBeInTheDocument();
    expect(
      (await screen.findAllByText("user: Orchestrator context should show subscription messages."))
        .length,
    ).toBeGreaterThan(0);
    expect((await screen.findAllByText("Codex Orchestrator Seat")).length).toBeGreaterThan(1);
    expect((await screen.findAllByText("🤖")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Human").length).toBeGreaterThan(0);
    expect(screen.queryByPlaceholderText("Message the AI assistant...")).not.toBeInTheDocument();
    expect(screen.queryByText("Using AI Assistant")).not.toBeInTheDocument();
  });
});

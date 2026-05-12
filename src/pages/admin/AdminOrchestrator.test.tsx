import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

function renderOrchestrator(route = "/admin/orchestrator") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AdminOrchestratorPage />
    </MemoryRouter>,
  );
}

describe("AdminOrchestratorPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv("VITE_AI_CHAT_ENABLED", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        const textUrl = String(url);
        if (textUrl.includes("orchestrator_context_read") && textUrl.includes("q=dog20")) {
          return {
            ok: true,
            json: async () => ({
              context: {
                version: "orchestrator-context-v1",
                generated_at: "2026-05-10T06:05:00.000Z",
                current_state_card: {
                  summary: "1 matching continuity event.",
                  newest_activity_at: "2026-05-10T06:04:00.000Z",
                  newest_checkin_at: "2026-05-10T05:55:00.000Z",
                  active_todo_count: 0,
                  blocker_count: 0,
                  active_seat_count: 1,
                  next_actions: [],
                  blockers: [],
                  live_sources: {
                    profiles: 1,
                    boardroom_messages: 0,
                    todos: 0,
                    comments: 1,
                    dispatches: 0,
                    signals: 0,
                    sessions: 0,
                    library: 0,
                    business_context: 0,
                    conversation_turns: 0,
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
                    source_kind: "todo_comment",
                    source_id: "comment-dog20",
                    created_at: "2026-05-10T06:04:00.000Z",
                    kind: "context",
                    actor_agent_id: "codex-orchestrator-seat",
                    summary: "Manual Orchestrator note from this Codex chat: dog20 reached UnClick.",
                    tags: ["todo", "comment"],
                    deep_link: "/admin/jobs#todo-1",
                  },
                ],
                library_snapshots: [],
              },
            }),
          } as Response;
        }

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
                    source_id: "runner-alert",
                    created_at: "2026-05-10T06:15:00.000Z",
                    kind: "blocker",
                    role: "assistant",
                    summary:
                      "AI replied: UnClick alert runner-freshness -- autonomous-runner ebf08d -- BLOCKER -- watch for next schedule on ebf08d+ then canary chatgpt-codex-worker2 -- d4c35fdb/1ed47811/f5d4bcd5/cde846d7/863335f9",
                    tags: ["alert", "runner-freshness"],
                  },
                  {
                    source_kind: "session_summary",
                    source_id: "session-decision",
                    created_at: "2026-05-10T06:05:00.000Z",
                    kind: "decision",
                    actor_agent_id: "codex-orchestrator-seat",
                    summary:
                      "Decision from Session. This should guide what seats do next. This becomes part of the shared story until Chris changes direction.",
                    tags: ["decision"],
                  },
                  {
                    source_kind: "signal",
                    source_id: "signal-1",
                    created_at: "2026-05-10T06:04:00.000Z",
                    kind: "signal",
                    summary: "Signal to notice: something needs attention.",
                    tags: ["signal"],
                  },
                  {
                    source_kind: "todo_comment",
                    source_id: "build-step",
                    created_at: "2026-05-10T06:03:00.000Z",
                    kind: "context",
                    actor_agent_id: "codex-orchestrator-seat",
                    summary:
                      "AI Assistant wrote the next small build step. It is about getting subscription chat messages to show inside Orchestrator.",
                    tags: ["todo", "comment"],
                  },
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
                    summary:
                      "PASS: Orchestrator continuity proof landed. This deliberately long proof explains that the feed should be readable without hiding the source text forever, and it keeps going so the Show more button appears for humans who want the full detail instead of a clipped preview. The change should make the first sentence friendly, keep the AI natural context available, and avoid making the whole row a surprise hyperlink when someone is only trying to select or read text.",
                    tags: ["done"],
                    deep_link: "/admin/jobs#todo-1",
                  },
                  ...Array.from({ length: 28 }, (_, index) => ({
                    source_kind: "conversation_turn",
                    source_id: `turn-archive-${index + 1}`,
                    created_at: `2026-05-10T05:${String(40 - index).padStart(2, "0")}:00.000Z`,
                    kind: "context",
                    role: "assistant",
                    summary: `Archive event ${index + 1}: older Orchestrator conversation detail.`,
                    tags: ["conversation", "archive"],
                  })),
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

  it("shows Story as the friendly default Orchestrator view", async () => {
    renderOrchestrator();

    expect(await screen.findByRole("heading", { name: "Today's running story" })).toBeInTheDocument();
    expect(screen.getByText("Timeline")).toBeInTheDocument();
    expect(screen.getByLabelText("Native notes")).not.toBeChecked();
    expect(screen.getByText("Watching the scheduled runner")).toBeInTheDocument();
    expect(screen.getAllByText(/One of the AI helpers raised a concern about the scheduled runner/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Fresh direction from Session")).toBeInTheDocument();
    expect(screen.getAllByText(/Session handed down a fresh decision/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/runner-freshness/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/d4c35fdb/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/The Orchestrator work moved forward/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Timeline keeps every raw receipt/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Archive event 24/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Message the AI assistant...")).not.toBeInTheDocument();
    expect(screen.queryByText("Using AI Assistant")).not.toBeInTheDocument();
  });

  it("shows read-only continuity on the Timeline subpage", async () => {
    renderOrchestrator("/admin/orchestrator/timeline");

    expect(await screen.findByText("Continuity Feed")).toBeInTheDocument();
    expect(screen.getByLabelText("Easy reading for humans")).toBeChecked();
    expect(screen.getByLabelText("Dripfeed Education")).toBeChecked();
    expect(screen.getByLabelText("Analogies")).toBeChecked();
    expect(screen.getByPlaceholderText("Filter Orchestrator feed")).toBeInTheDocument();
    expect(
      (await screen.findAllByText(/Chris said: Orchestrator context should show subscription messages/i))
        .length,
    ).toBeGreaterThan(0);
    expect((await screen.findAllByText("Codex Orchestrator Seat")).length).toBeGreaterThan(1);
    expect((await screen.findAllByText("🤖")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Human").length).toBeGreaterThan(0);
    expect(screen.queryByPlaceholderText("Message the AI assistant...")).not.toBeInTheDocument();
    expect(screen.queryByText("Using AI Assistant")).not.toBeInTheDocument();
  });

  it("filters the Orchestrator feed as the user types", async () => {
    renderOrchestrator("/admin/orchestrator/timeline");

    const filter = await screen.findByPlaceholderText("Filter Orchestrator feed");
    fireEvent.change(filter, { target: { value: "proof" } });

    expect(await screen.findByText(/matching events shown/)).toBeInTheDocument();
    expect(screen.getAllByText(/Orchestrator continuity proof landed/i).length).toBeGreaterThan(0);
    expect(document.querySelector("mark")?.textContent?.toLowerCase()).toContain("proof");
  });

  it("lets humans view more loaded Orchestrator history", async () => {
    renderOrchestrator("/admin/orchestrator/timeline");

    expect(await screen.findByText("View more history")).toBeInTheDocument();
    expect(screen.queryByText(/Archive event 24/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("View more history"));

    expect((await screen.findAllByText(/Archive event 24/i)).length).toBeGreaterThan(0);
  });

  it("asks the server for deeper Orchestrator keyword matches", async () => {
    renderOrchestrator("/admin/orchestrator/timeline");

    const filter = await screen.findByPlaceholderText("Filter Orchestrator feed");
    fireEvent.change(filter, { target: { value: "dog20" } });

    expect(await screen.findByText(/dog20 reached UnClick/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("q=dog20"),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer session-token" }),
        }),
      ),
    );
  });

  it("uses explicit controls for long continuity rows", async () => {
    renderOrchestrator("/admin/orchestrator/timeline");

    expect(await screen.findByText("Show more")).toBeInTheDocument();
    expect(screen.getByText("Open source")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Show more"));
    expect(screen.getByText("Show less")).toBeInTheDocument();
  });
});

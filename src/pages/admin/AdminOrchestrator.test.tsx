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

function jsonResponse(value: unknown): Response {
  return {
    ok: true,
    json: async () => value,
  } as Response;
}

function contextWithEvents(events: Array<Record<string, unknown>>) {
  return {
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
        next_actions: [],
        blockers: [],
        live_sources: {
          profiles: 1,
          boardroom_messages: 0,
          todos: 0,
          comments: 0,
          dispatches: 0,
          signals: 0,
          sessions: 0,
          library: 0,
          business_context: 0,
          conversation_turns: events.length,
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
      continuity_events: events,
      library_snapshots: [],
    },
  };
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
    expect(screen.getByText("Worker Health Stays Visible")).toBeInTheDocument();
    expect(screen.getAllByText(/A handoff stalled around/i).length).toBeGreaterThan(0);
    expect(screen.getByText("A Decision Sets Direction")).toBeInTheDocument();
    expect(screen.getAllByText(/Direction was set/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { level: 3 }).length).toBeGreaterThan(8);
    expect(screen.queryByText("Watching the scheduled runner")).not.toBeInTheDocument();
    expect(screen.queryByText("Signals in the background")).not.toBeInTheDocument();
    expect(screen.queryByText("Fresh direction from Session")).not.toBeInTheDocument();
    expect(screen.queryByText(/runner-freshness/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Latest first, written as a continuous read/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Timeline keeps every raw receipt/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Archive event/i).length).toBeGreaterThan(0);
    expect(screen.queryByPlaceholderText("Message the AI assistant...")).not.toBeInTheDocument();
    expect(screen.queryByText("Using AI Assistant")).not.toBeInTheDocument();
  });

  it("loads a larger Story context window by default", async () => {
    renderOrchestrator();

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("orchestrator_context_read&limit=240"),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer session-token" }),
        }),
      ),
    );
  });

  it("keeps Story content visible while deeper history loads", async () => {
    let resolveDeepHistory: (response: Response) => void = () => undefined;
    const deepHistoryPromise = new Promise<Response>((resolve) => {
      resolveDeepHistory = resolve;
    });
    const initialEvents = [
      {
        source_kind: "conversation_turn",
        source_id: "story-scroll-ask",
        created_at: "2026-05-10T06:15:00.000Z",
        kind: "context",
        role: "user",
        summary: "user: Can Story hold more conversation by default?",
        tags: ["conversation", "user"],
      },
      ...Array.from({ length: 3 }, (_, index) => ({
        source_kind: "conversation_turn",
        source_id: `archive-${index}`,
        created_at: `2026-05-10T04:${String(59 - (index % 50)).padStart(2, "0")}:00.000Z`,
        kind: "context",
        role: "assistant",
        summary: `Archive event ${index}: older detail.`,
        tags: ["archive"],
      })),
    ];
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const textUrl = String(url);
      if (textUrl.includes("orchestrator_context_read") && textUrl.includes("limit=200")) {
        return deepHistoryPromise;
      }
      if (textUrl.includes("orchestrator_context_read")) {
        return jsonResponse(contextWithEvents(initialEvents));
      }
      if (textUrl.includes("tenant_settings")) {
        return jsonResponse({
          env_enabled: true,
          settings: {
            ai_chat_enabled: true,
            ai_chat_provider: "google",
            ai_chat_model: "gemini-2.5-flash-lite",
            ai_chat_system_prompt: null,
            ai_chat_max_turns: 20,
            has_api_key: true,
          },
        });
      }
      if (textUrl.includes("admin_channel_status")) {
        return jsonResponse({ channel_active: false, last_seen: null, client_info: null });
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    renderOrchestrator();

    expect((await screen.findAllByText(/Chris asked: Can Story hold more conversation by default/i)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Read more"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("orchestrator_context_read&limit=480"),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer session-token" }),
        }),
      ),
    );
    expect(screen.queryByText("Writing the latest story...")).not.toBeInTheDocument();
    expect(screen.getAllByText(/Chris asked: Can Story hold more conversation by default/i).length).toBeGreaterThan(0);

    resolveDeepHistory(jsonResponse(contextWithEvents(initialEvents)));
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

  it("filters Timeline continuity by source kind without removing source links", async () => {
    renderOrchestrator("/admin/orchestrator/timeline");

    expect(await screen.findByText("Continuity Feed")).toBeInTheDocument();
    expect((await screen.findAllByText(/Signal to notice: something needs attention/i)).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Work sources" }));

    expect(screen.getAllByText(/Orchestrator continuity proof landed/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Signal to notice: something needs attention/i)).not.toBeInTheDocument();
    expect(screen.getByText("Open source")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Chat sources" }));

    expect(screen.getAllByText(/Orchestrator context should show subscription messages/i).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/Orchestrator continuity proof landed/i)).toHaveLength(0);
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

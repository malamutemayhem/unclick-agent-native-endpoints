import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AIChatPanel from "./AIChatPanel";

describe("AIChatPanel auth", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          channel_active: false,
          last_seen: null,
          client_info: null,
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("uses the signed-in session token when no raw API key is saved", async () => {
    render(<AIChatPanel authToken="session-jwt-token" />);

    expect(screen.queryByText("Sign in to use the Orchestrator chat.")).not.toBeInTheDocument();
    expect(
      await screen.findByText(
        "Ask your agent anything. Connect Claude Code for a free bridge via your own session.",
      ),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/memory-admin?action=admin_channel_status",
      {
        headers: { Authorization: "Bearer session-jwt-token" },
      },
    );
  });

  it("still asks the user to sign in when neither session nor API key is available", () => {
    render(<AIChatPanel />);

    expect(screen.getByText("Sign in to use the Orchestrator chat.")).toBeInTheDocument();
  });
});

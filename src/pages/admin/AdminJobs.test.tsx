import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminJobs from "./AdminJobs";

vi.mock("@/lib/auth", () => ({
  useSession: () => ({
    session: { access_token: "test-token" },
    user: null,
    loading: false,
  }),
}));

const jobs = [
  {
    id: "fresh-job",
    title: "Alpha ready job",
    description: "Ready to move.",
    status: "in_progress",
    priority: "normal",
    created_by_agent_id: "tester",
    assigned_to_agent_id: "chatgpt-codex-desktop",
    created_at: "2026-05-14T12:00:00.000Z",
    completed_at: null,
    updated_at: "2026-05-14T12:55:00.000Z",
    comment_count: 1,
    pipeline_stage_count: 2,
    pipeline_progress: 40,
    pipeline_evidence: [],
  },
  {
    id: "stale-job",
    title: "Zulu stale job",
    description: "Needs a worker nudge.",
    status: "in_progress",
    priority: "high",
    created_by_agent_id: "tester",
    assigned_to_agent_id: "chatgpt-codex-worker2",
    created_at: "2026-05-13T00:00:00.000Z",
    completed_at: null,
    updated_at: "2026-05-13T00:00:00.000Z",
    comment_count: 2,
    pipeline_stage_count: 3,
    pipeline_progress: 55,
    pipeline_evidence: [],
  },
] as const;

function jsonResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  } as Response);
}

describe("AdminJobs", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-05-14T13:00:00.000Z").getTime());
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("fishbowl_admin_claim")) {
          return jsonResponse({ profile: { agent_id: "human-test" } });
        }
        if (url.includes("fishbowl_list_todos")) {
          return jsonResponse({ todos: jobs });
        }
        return jsonResponse({});
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps stale job guidance as a subtle row indicator instead of a fallback strip", async () => {
    render(React.createElement(AdminJobs));

    const indicator = await screen.findByLabelText(/Job needs attention: Active job has not moved recently/i);

    expect(indicator).toBeInTheDocument();
    fireEvent.click(indicator);

    expect(screen.queryByText(/Fallback:/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("Worker").length).toBeGreaterThan(0);
  });

  it("sorts visible rows by a column header", async () => {
    render(React.createElement(AdminJobs));

    await screen.findByText("Alpha ready job");
    fireEvent.click(screen.getByRole("button", { name: "Job" }));

    await waitFor(() => {
      expect(screen.getAllByTestId("job-row-title").map((node) => node.textContent)).toEqual([
        "Alpha ready job",
        "Zulu stale job",
      ]);
    });
  });
});

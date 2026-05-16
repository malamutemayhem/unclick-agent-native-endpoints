import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MemoryActivityTab from "./MemoryActivityTab";

type ActivityResponse = ReturnType<typeof makeActivity>;

function makeActivity(topFactCount: number) {
  const topFacts = Array.from({ length: topFactCount }, (_, index) => ({
    id: `fact-${index + 1}`,
    fact: `fact ${index + 1}`,
    category: "technical",
    access_count: topFactCount - index,
    decay_tier: "hot",
    recall_signal: "top-of-mind",
    recall_note: "Human-facing recall",
  }));

  return {
    facts_by_day: {},
    storage: {
      business_context: 0,
      knowledge_library: 0,
      session_summaries: 0,
      extracted_facts: topFactCount,
      conversation_log: 0,
      code_dumps: 0,
      total: topFactCount,
    },
    recent_decay: [],
    recall_diagnostics: {
      inspected_top_facts: topFactCount,
      background_heavy_count: 0,
    },
    top_of_mind_facts: topFacts.slice(0, 10),
    top_facts: topFacts,
  };
}

describe("MemoryActivityTab", () => {
  const fetchCalls: string[] = [];
  let activityFactory: (topFactCount: number) => ActivityResponse = makeActivity;

  beforeEach(() => {
    fetchCalls.length = 0;
    activityFactory = makeActivity;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        fetchCalls.push(url);
        const topFactCount = url.includes("top_facts_limit=110") ? 110 : 10;

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(activityFactory(topFactCount)),
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads more accessed facts on request", async () => {
    render(<MemoryActivityTab apiKey="test-token" />);

    await screen.findByText("Most Accessed Facts");

    expect(fetchCalls[0]).toContain("top_facts_limit=10");
    expect(screen.getAllByText("fact 10").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Show 100 more/i }));

    await waitFor(() => {
      expect(fetchCalls.some((url) => url.includes("top_facts_limit=110"))).toBe(true);
    });
    expect(await screen.findByText("fact 110")).toBeInTheDocument();
  });

  it("separates top of mind facts from background-heavy access counts", async () => {
    activityFactory = () => {
      const backgroundFact = {
        id: "static-profile",
        fact: "Chris prefers concise worker updates",
        category: "preference",
        access_count: 2080,
        decay_tier: "hot",
        recall_signal: "background-heavy",
        recall_note: "Startup or heartbeat reads",
      };
      const activeFact = {
        id: "active-project",
        fact: "PR #898 added the Recall Check see more path",
        category: "technical",
        access_count: 42,
        decay_tier: "hot",
        recall_signal: "top-of-mind",
        recall_note: "Human-facing recall",
      };

      return {
        ...makeActivity(2),
        recall_diagnostics: {
          inspected_top_facts: 2,
          background_heavy_count: 1,
        },
        top_of_mind_facts: [activeFact],
        top_facts: [backgroundFact, activeFact],
      };
    };

    render(<MemoryActivityTab apiKey="test-token" />);

    await screen.findByText("Top of Mind");

    expect(screen.getAllByText("PR #898 added the Recall Check see more path").length).toBeGreaterThan(0);
    expect(screen.getByText("Background-heavy")).toBeInTheDocument();
    expect(screen.getByText("Startup or heartbeat reads")).toBeInTheDocument();
  });
});

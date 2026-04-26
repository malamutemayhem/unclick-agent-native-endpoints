import { describe, expect, it } from "vitest";
import { buildSearchMemoryCard } from "./search-memory-card.js";
import type { ConversationalCard } from "@unclick/wizard";

describe("buildSearchMemoryCard - Phase 1 Wizard wrap", () => {
  it("renders an empty-state card when no results match", () => {
    const card: ConversationalCard = buildSearchMemoryCard("functional programming", []);
    expect(card.title).toContain("No memories found");
    expect(card.title).toContain("functional programming");
    expect(card.severity).toBe("info");
    expect(card.followUps?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(card.meta?.result_count).toBe(0);
  });

  it("renders a results card with truncated previews when matches exist", () => {
    const results = [
      { id: "1", fact: "Chris prefers TypeScript over JavaScript", confidence: 0.95 },
      { id: "2", fact: "Chris's timezone is Australia/Melbourne", confidence: 0.9 },
      { id: "3", fact: "Bailey reviews and merges Phase 1 wizard PRs", confidence: 0.85 },
    ];
    const card = buildSearchMemoryCard("Chris", results);
    expect(card.title).toBe('Found 3 memories matching "Chris"');
    expect(card.severity).toBe("success");
    expect(card.body?.[0]?.kind).toBe("list");
    if (card.body?.[0]?.kind === "list") {
      expect(card.body[0].items).toHaveLength(3);
      expect(card.body[0].items[0]).toContain("TypeScript");
    }
    expect(card.meta?.result_count).toBe(3);
  });

  it("singular wording when exactly one match is returned", () => {
    const card = buildSearchMemoryCard("timezone", [{ fact: "Australia/Melbourne" }]);
    expect(card.title).toBe('Found 1 memory matching "timezone"');
  });

  it("truncates long fact previews to keep cards renderable", () => {
    const longFact = "x".repeat(500);
    const card = buildSearchMemoryCard("noisy", [{ fact: longFact }]);
    if (card.body?.[0]?.kind === "list") {
      expect(card.body[0].items[0].length).toBeLessThanOrEqual(140);
      expect(card.body[0].items[0].endsWith("…")).toBe(true);
    } else {
      throw new Error("expected list section");
    }
  });

  it("caps the preview list at five entries even with more matches", () => {
    const results = Array.from({ length: 12 }, (_, i) => ({ fact: `fact ${i}` }));
    const card = buildSearchMemoryCard("many", results);
    expect(card.title).toBe('Found 12 memories matching "many"');
    expect(card.summary).toContain("Showing the top 5 of 12");
    if (card.body?.[0]?.kind === "list") {
      expect(card.body[0].items).toHaveLength(5);
    }
  });

  it("includes a save_fact follow-up wired with confirmation", () => {
    const card = buildSearchMemoryCard("anything", [{ fact: "x" }]);
    const saveFollowUp = card.followUps?.find((f) => f.action?.tool === "save_fact");
    expect(saveFollowUp).toBeDefined();
    expect(saveFollowUp?.action?.confirmation).toBe("confirm");
  });
});

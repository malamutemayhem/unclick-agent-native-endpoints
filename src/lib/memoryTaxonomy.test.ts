import { describe, expect, it } from "vitest";
import { getMemoryTaxonomyShelfLabel, groupMemoryTaxonomyShelves } from "./memoryTaxonomy";

describe("memory taxonomy shelves", () => {
  it("groups documents by category before tags", () => {
    const shelves = groupMemoryTaxonomyShelves([
      {
        id: "doc-1",
        title: "Project state",
        category: "07 Projects & Products",
        tags: ["research"],
        updated_at: "2026-05-14T01:00:00.000Z",
      },
      {
        id: "doc-2",
        title: "Memory shelf",
        category: "15 Data & Memory",
        tags: ["source:fact"],
        updated_at: "2026-05-14T02:00:00.000Z",
      },
      {
        id: "doc-3",
        title: "Product follow-up",
        category: "07 Projects & Products",
        tags: ["source:session"],
        updated_at: "2026-05-14T03:00:00.000Z",
      },
    ]);

    expect(shelves.map((shelf) => [shelf.label, shelf.count])).toEqual([
      ["07 Projects & Products", 2],
      ["15 Data & Memory", 1],
    ]);
    expect(shelves[0].docs.map((doc) => doc.id)).toEqual(["doc-3", "doc-1"]);
  });

  it("falls back to the first non-metadata tag then uncategorized", () => {
    expect(
      getMemoryTaxonomyShelfLabel({
        id: "doc-tag",
        tags: ["source:fact", "10 Troubleshooting & Incidents"],
      }),
    ).toEqual({ label: "10 Troubleshooting & Incidents", source: "tag" });

    expect(
      getMemoryTaxonomyShelfLabel({
        id: "doc-empty",
        tags: ["source:fact", "kind:session"],
      }),
    ).toEqual({ label: "Uncategorized", source: "fallback" });
  });
});

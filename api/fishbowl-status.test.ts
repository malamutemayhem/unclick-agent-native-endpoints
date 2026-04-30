import { describe, expect, it } from "vitest";
import { statusFromFishbowlPost } from "./lib/fishbowl-status";

describe("statusFromFishbowlPost", () => {
  it("uses the first non-empty line as the visible worker status", () => {
    expect(statusFromFishbowlPost("\n\nUpdate: PR #328 is green\nnext: merge")).toBe(
      "Update: PR #328 is green",
    );
  });

  it("compacts whitespace and caps long status lines", () => {
    const status = statusFromFishbowlPost(`  ${"x ".repeat(140)}  `);

    expect(status).toHaveLength(200);
    expect(status?.endsWith("...")).toBe(true);
    expect(status).not.toContain("  ");
  });

  it("returns null for empty posts", () => {
    expect(statusFromFishbowlPost(" \n\t ")).toBeNull();
  });
});

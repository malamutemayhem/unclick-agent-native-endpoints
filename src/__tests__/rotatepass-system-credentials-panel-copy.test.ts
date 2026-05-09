import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PANEL_DOC_PATH = "docs/connectors/system-credentials-health-panel.md";

describe("RotatePass system credentials panel copy", () => {
  it("keeps metadata activity separate from health claims", () => {
    const content = readFileSync(PANEL_DOC_PATH, "utf8");

    expect(content).toContain("Treat metadata activity timestamps as inventory evidence only.");
    expect(content).toContain("must not upgrade a credential to `healthy`.");
    expect(content.toLowerCase()).not.toContain("metadata activity alone means healthy");
    expect(content.toLowerCase()).not.toContain("mark healthy from presence alone");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SETUP_VOCAB_DOC = "docs/connectors/setup-metadata-vocabulary.md";

describe("RotatePass setup vocabulary safety claims", () => {
  it("keeps anti-overclaim language for health and owner confidence", () => {
    const content = readFileSync(SETUP_VOCAB_DOC, "utf8");

    expect(content).toContain("Do not mark this `true` from presence alone.");
    expect(content).toContain("UI copy should not claim certainty from these values alone.");
    expect(content).toContain("Avoid copy like `Owner verified` unless human review evidence exists.");
    expect(content).toContain("`false` means the connector can still exist, but the UI should not claim a live health result.");
  });
});

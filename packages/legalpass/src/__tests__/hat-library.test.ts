import { describe, expect, it } from "vitest";
import {
  getPhaseOneLegalPassHats,
  PHASE_ONE_LEGALPASS_HATS,
} from "../hat-library.js";

describe("phase-one LegalPass hats", () => {
  it("defines the three MVP hats", () => {
    expect(PHASE_ONE_LEGALPASS_HATS.map((hat) => hat.id)).toEqual([
      "privacy-policy",
      "tos-unfair-terms",
      "oss-licence",
    ]);
  });

  it("keeps deterministic fixture checks on every hat", () => {
    for (const hat of PHASE_ONE_LEGALPASS_HATS) {
      expect(hat.checks.length).toBeGreaterThan(0);
      expect(hat.checks.every((check) => check.fixture_terms.length > 0)).toBe(true);
    }
  });

  it("filters hats by requested ids", () => {
    const hats = getPhaseOneLegalPassHats({ hat_ids: ["oss-licence"] });

    expect(hats).toHaveLength(1);
    expect(hats[0]?.id).toBe("oss-licence");
  });
});

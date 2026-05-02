import { describe, expect, it } from "vitest";

import { dogfoodReport } from "@/data/dogfoodReport";

describe("Dogfood report proof policy", () => {
  it("keeps public status wording honest in the fallback receipt", () => {
    expect(dogfoodReport.statusLegend.passing).toMatch(/live check ran/i);
    expect(dogfoodReport.statusLegend.blocked).toMatch(/action is needed/i);
    expect(dogfoodReport.statusLegend.pending).toMatch(/live proof is not available yet/i);
    expect(dogfoodReport.proofPolicy).toMatch(/passing only when a live check actually ran/i);
  });
});

import { describe, it, expect } from "vitest";
import { PackSchema } from "../pack-schema.js";
import type { PackInput } from "../pack-schema.js";

const VALID_PACK: PackInput = {
  id: "legalpass-mvp-v0",
  name: "LegalPass MVP",
  version: "0.1.0",
  description: "MVP pack covering Privacy + Consumer ToS + OSS Licence + Contracts.",
  targets: ["url", "contract_upload"],
  jurisdictions: ["AU", "EU", "US-CA"],
  hats: [
    { hat_id: "privacy", enabled: true, weight: 1 },
    { hat_id: "consumer_tos", enabled: true, weight: 1 },
    { hat_id: "oss_licence", enabled: true, weight: 1 },
    { hat_id: "contracts", enabled: true, weight: 1 },
    { hat_id: "citation_verifier", enabled: true, weight: 1 },
  ],
  profile: "standard",
  items: [
    {
      id: "privacy.001",
      hat_id: "privacy",
      title: "Privacy policy is linked from every page",
      category: "privacy.disclosure",
      severity: "high",
      jurisdictions: ["AU", "EU"],
      profiles: ["standard", "deep"],
    },
  ],
};

describe("PackSchema", () => {
  it("parses a valid MVP pack", () => {
    const result = PackSchema.parse(VALID_PACK);
    expect(result.id).toBe("legalpass-mvp-v0");
    expect(result.hats).toHaveLength(5);
    expect(result.profile).toBe("standard");
  });

  it("defaults profile to standard when omitted", () => {
    const { profile: _omit, ...rest } = VALID_PACK;
    const result = PackSchema.parse(rest);
    expect(result.profile).toBe("standard");
  });

  it("rejects a non-semver version", () => {
    const bad = { ...VALID_PACK, version: "v1" };
    expect(() => PackSchema.parse(bad)).toThrow(/semver/);
  });

  it("rejects an empty hat roster", () => {
    const bad = { ...VALID_PACK, hats: [] };
    expect(() => PackSchema.parse(bad)).toThrow();
  });

  it("rejects an empty jurisdictions list", () => {
    const bad = { ...VALID_PACK, jurisdictions: [] };
    expect(() => PackSchema.parse(bad)).toThrow();
  });

  it("rejects an unknown hat_id", () => {
    const bad = {
      ...VALID_PACK,
      hats: [{ hat_id: "not_a_real_hat" as never, enabled: true, weight: 1 }],
    };
    expect(() => PackSchema.parse(bad)).toThrow();
  });

  it("rejects an unknown jurisdiction code", () => {
    const bad = { ...VALID_PACK, jurisdictions: ["MARS" as never] };
    expect(() => PackSchema.parse(bad)).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import {
  effectiveMemoryTier,
  isMemoryQuotaExemptEmail,
  shouldEnforceManagedMemoryCaps,
} from "../packages/mcp-server/src/memory/quota-policy.js";

describe("memory quota policy", () => {
  it("exempts the owner account from memory quotas by default", () => {
    expect(isMemoryQuotaExemptEmail("creativelead@malamutemayhem.com")).toBe(true);
    expect(isMemoryQuotaExemptEmail(" CreativeLead@MalamuteMayhem.com ")).toBe(true);
  });

  it("does not exempt unrelated accounts unless explicitly allowlisted", () => {
    expect(isMemoryQuotaExemptEmail("user@example.com")).toBe(false);
    expect(isMemoryQuotaExemptEmail("user@example.com", "user@example.com")).toBe(true);
  });

  it("reports owner as the effective memory tier without changing other tiers", () => {
    expect(effectiveMemoryTier("free", "creativelead@malamutemayhem.com")).toBe("owner");
    expect(effectiveMemoryTier("pro", "user@example.com")).toBe("pro");
    expect(effectiveMemoryTier(null, "user@example.com")).toBe("free");
  });

  it("only enforces managed-cloud caps for non-exempt free-tier users", () => {
    expect(
      shouldEnforceManagedMemoryCaps({
        tenancyMode: "managed",
        tier: "free",
        accountEmail: "user@example.com",
      }),
    ).toBe(true);

    expect(
      shouldEnforceManagedMemoryCaps({
        tenancyMode: "managed",
        tier: "free",
        accountEmail: "creativelead@malamutemayhem.com",
      }),
    ).toBe(false);

    expect(
      shouldEnforceManagedMemoryCaps({
        tenancyMode: "managed",
        tier: "free",
        quotaExempt: true,
      }),
    ).toBe(false);

    expect(
      shouldEnforceManagedMemoryCaps({
        tenancyMode: "byod",
        tier: "free",
        accountEmail: "user@example.com",
      }),
    ).toBe(false);
  });
});

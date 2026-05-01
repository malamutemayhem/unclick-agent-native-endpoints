import { describe, expect, it } from "vitest";
import {
  buildSystemCredentialHealthRows,
  deriveSystemCredentialStatus,
  type CredentialHealthInput,
} from "./systemCredentialsHealth";

const NOW = new Date("2026-05-01T00:00:00.000Z");

function credential(overrides: Partial<CredentialHealthInput>): CredentialHealthInput {
  return {
    platform: "github",
    label: "main",
    is_valid: true,
    last_tested_at: "2026-04-30T00:00:00.000Z",
    last_used_at: null,
    last_rotated_at: "2026-04-01T00:00:00.000Z",
    connector: { name: "GitHub", category: "Dev Tools" },
    ...overrides,
  };
}

describe("system credential health", () => {
  it("derives failing before freshness or rotation warnings", () => {
    expect(deriveSystemCredentialStatus([
      credential({
        is_valid: false,
        last_tested_at: "2026-04-30T00:00:00.000Z",
        last_rotated_at: "2025-01-01T00:00:00.000Z",
      }),
    ], NOW)).toBe("failing");
  });

  it("marks healthy credentials with recent checks as healthy", () => {
    expect(deriveSystemCredentialStatus([
      credential({ last_tested_at: "2026-04-30T00:00:00.000Z" }),
    ], NOW)).toBe("healthy");
  });

  it("distinguishes untested, stale, and rotation-due credentials", () => {
    expect(deriveSystemCredentialStatus([], NOW)).toBe("untested");
    expect(deriveSystemCredentialStatus([
      credential({ last_tested_at: null, last_rotated_at: "2026-04-01T00:00:00.000Z" }),
    ], NOW)).toBe("untested");
    expect(deriveSystemCredentialStatus([
      credential({ last_tested_at: "2026-03-01T00:00:00.000Z", last_rotated_at: "2026-04-01T00:00:00.000Z" }),
    ], NOW)).toBe("stale");
    expect(deriveSystemCredentialStatus([
      credential({ last_tested_at: "2026-04-30T00:00:00.000Z", last_rotated_at: "2026-01-01T00:00:00.000Z" }),
    ], NOW)).toBe("needs_rotation");
  });

  it("builds metadata-only rows without secret values", () => {
    const rows = buildSystemCredentialHealthRows([
      credential({ platform: "github", label: "ci" }),
      credential({ platform: "openrouter", label: "models", last_tested_at: null }),
    ], "chris@example.com", NOW);

    const github = rows.find((row) => row.id === "github");
    const openrouter = rows.find((row) => row.id === "openrouter");

    expect(github).toMatchObject({
      owner: "chris@example.com",
      status: "healthy",
      matchedCredentialCount: 1,
      matchedCredentialLabels: ["ci"],
    });
    expect(github?.expectedFields).toEqual(["api_key", "token"]);
    expect(github?.usedBy).toContain("CI inspection");
    expect(openrouter?.status).toBe("untested");
    expect(JSON.stringify(rows)).not.toContain("sk-");
  });
});

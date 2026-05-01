import {
  hasSecretValueField,
  listSystemCredentialInventory,
  sanitizeInventoryRecord,
  shouldTrackCredentialName,
} from "./systemCredentialInventory";

describe("system credential inventory", () => {
  it("tracks critical GitHub Actions names without values", () => {
    const names = listSystemCredentialInventory()
      .filter((entry) => entry.provider === "github")
      .map((entry) => entry.name);

    expect(names).toContain("TESTPASS_TOKEN");
    expect(names).toContain("TESTPASS_CRON_SECRET");
    expect(names).toContain("OPENROUTER_API_KEY");
    expect(names).toContain("FISHBOWL_WAKE_TOKEN");
    expect(names).not.toContain("GITHUB_TOKEN");
  });

  it("tracks Vercel environment names without touching secret values", () => {
    const entries = listSystemCredentialInventory().filter((entry) => entry.provider === "vercel");
    const names = entries.map((entry) => entry.name);

    expect(names).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(names).toContain("CRON_SECRET");
    expect(names).toContain("POSTHOG_API_KEY");
    expect(names).toContain("STRIPE_SECRET_KEY");
    expect(names).not.toContain("VERCEL_URL");
    expect(entries.every((entry) => "value" in entry === false)).toBe(true);
  });

  it("requires all seeded entries to carry purpose and rotation guidance", () => {
    for (const entry of listSystemCredentialInventory()) {
      expect(entry.name).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(entry.scope.length).toBeGreaterThan(0);
      expect(entry.workload.length).toBeGreaterThan(0);
      expect(entry.docsHint.toLowerCase()).not.toContain("secret value:");
    }
  });

  it("explains what breaks when expected critical credentials rotate", () => {
    const criticalExpected = listSystemCredentialInventory().filter(
      (entry) => entry.expected && entry.risk === "critical",
    );

    expect(criticalExpected.map((entry) => entry.name)).toEqual(expect.arrayContaining([
      "TESTPASS_TOKEN",
      "TESTPASS_CRON_SECRET",
      "FISHBOWL_WAKE_TOKEN",
      "SUPABASE_SERVICE_ROLE_KEY",
      "CRON_SECRET",
    ]));

    for (const entry of criticalExpected) {
      expect(entry.rotationImpact?.length ?? 0).toBeGreaterThan(20);
      expect(entry.rotationImpact?.toLowerCase()).not.toContain("secret value");
    }
  });

  it("filters built-in or public runtime names that are not credential inventory", () => {
    expect(shouldTrackCredentialName("TESTPASS_TOKEN")).toBe(true);
    expect(shouldTrackCredentialName("GITHUB_TOKEN")).toBe(false);
    expect(shouldTrackCredentialName("VERCEL_URL")).toBe(false);
    expect(shouldTrackCredentialName("lowercase-token")).toBe(false);
  });

  it("rejects records that include value-shaped fields", () => {
    expect(hasSecretValueField({ name: "TESTPASS_TOKEN", value: "never-print-me" })).toBe(true);
    expect(hasSecretValueField({ name: "TESTPASS_TOKEN", encrypted_value: "ciphertext" })).toBe(true);
    expect(hasSecretValueField({ name: "TESTPASS_TOKEN", vsmValue: "opaque" })).toBe(true);
    expect(hasSecretValueField({ name: "TESTPASS_TOKEN", legacyValue: "old" })).toBe(true);

    expect(sanitizeInventoryRecord({
      provider: "vercel",
      source: "vercel_env",
      name: "TESTPASS_TOKEN",
      value: "never-print-me",
    })).toBeNull();
  });

  it("sanitizes metadata-only records into the safe display shape", () => {
    expect(sanitizeInventoryRecord({
      provider: "github",
      source: "github_actions_secret",
      name: " testpass_token ",
      scope: "repository actions secret",
      workload: "TestPass PR checks",
      risk: "critical",
      expected: true,
      docsHint: "Name and timestamps only.",
      rotationImpact: "PR checks may fail until the replacement is wired.",
    })).toEqual({
      provider: "github",
      source: "github_actions_secret",
      name: "TESTPASS_TOKEN",
      scope: "repository actions secret",
      workload: "TestPass PR checks",
      risk: "critical",
      expected: true,
      docsHint: "Name and timestamps only.",
      rotationImpact: "PR checks may fail until the replacement is wired.",
    });
  });
});

import {
  hasSecretValueField,
  listSystemCredentialHealthRows,
  listSystemCredentialInventory,
  sanitizeInventoryRecord,
  shouldTrackCredentialName,
} from "./systemCredentialInventory";

const FORBIDDEN_SECRET_LIKE_PATTERNS: readonly RegExp[] = [
  /\bsk-[a-z0-9_-]{8,}\b/i,
  /\bgh[pousr]_[a-z0-9]{8,}\b/i,
  /\bxox[baprs]-[a-z0-9-]{8,}\b/i,
  /\bAKIA[0-9A-Z]{8,}\b/,
  /\bBearer\s+[a-z0-9._-]{8,}\b/i,
  /\bAuthorization:\s*[^\s]/i,
  /\bSet-Cookie:\s*[^\s]/i,
  /\brefresh[_-]?token\b/i,
];

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

  it("adds safe owner-confidence labels without provider lookups", () => {
    const byName = new Map(listSystemCredentialHealthRows().map((entry) => [entry.name, entry]));

    expect(byName.get("TESTPASS_TOKEN")).toMatchObject({
      ownerLabel: "GitHub Actions - malamutemayhem/unclick-agent-native-endpoints",
      ownerConfidence: "inferred",
    });
    expect(byName.get("SUPABASE_SERVICE_ROLE_KEY")).toMatchObject({
      ownerLabel: "Vercel project environment",
      ownerConfidence: "unknown",
    });
  });

  it("keeps docs and rotation copy free of secret-like literals", () => {
    for (const entry of listSystemCredentialInventory()) {
      const combinedCopy = `${entry.docsHint}\n${entry.rotationImpact ?? ""}`;
      for (const pattern of FORBIDDEN_SECRET_LIKE_PATTERNS) {
        expect(combinedCopy).not.toMatch(pattern);
      }
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

  it("derives untested health rows with owner, status, and manual check state", () => {
    const rows = listSystemCredentialHealthRows();
    const testpass = rows.find((entry) => entry.name === "TESTPASS_TOKEN");

    expect(testpass).toMatchObject({
      sourceLabel: "GitHub Actions secret name",
      ownerLabel: "GitHub Actions - malamutemayhem/unclick-agent-native-endpoints",
      ownerConfidence: "inferred",
      displayStatus: "untested",
      healthEvidenceLabel: "Use latest TestPass PR check receipt.",
      lastCheckedAt: null,
    });
    expect(testpass?.rotationImpactSummary).toContain("TestPass checks");
    expect(testpass?.safeRotationNotes).toEqual(expect.arrayContaining([
      "After rotation, rerun the TestPass PR check.",
    ]));
  });

  it("adds operator card answers without claiming live credential health", () => {
    for (const entry of listSystemCredentialHealthRows()) {
      expect(entry.displayStatus).toBe("untested");
      expect(entry.lastCheckedAt).toBeNull();
      expect(entry.sourceLabel.length).toBeGreaterThan(0);
      expect(entry.healthEvidenceLabel.length).toBeGreaterThan(0);
      expect(entry.rotationImpactSummary.length).toBeGreaterThan(0);
      expect(entry.safeRotationNotes.length).toBeGreaterThan(0);
      const combinedCopy = [
        entry.sourceLabel,
        entry.healthEvidenceLabel,
        entry.rotationImpactSummary,
        ...entry.safeRotationNotes,
      ].join("\n");
      expect(combinedCopy.toLowerCase()).not.toContain("secret value");

      for (const pattern of FORBIDDEN_SECRET_LIKE_PATTERNS) {
        expect(combinedCopy).not.toMatch(pattern);
      }
    }
  });

  it("requires human review notes for critical system credentials", () => {
    const criticalRows = listSystemCredentialHealthRows().filter((entry) => entry.risk === "critical");

    for (const entry of criticalRows) {
      expect(entry.safeRotationNotes.join("\n").toLowerCase()).toContain("human review");
    }
  });

  it("filters built-in or public runtime names that are not credential inventory", () => {
    expect(shouldTrackCredentialName("TESTPASS_TOKEN")).toBe(true);
    expect(shouldTrackCredentialName("GITHUB_TOKEN")).toBe(false);
    expect(shouldTrackCredentialName("VERCEL_URL")).toBe(false);
    expect(shouldTrackCredentialName("lowercase-token")).toBe(false);
    expect(shouldTrackCredentialName("AKIAIOSFODNN7EXAMPLE")).toBe(false);
    expect(shouldTrackCredentialName("ghp_12345678abcdefgh")).toBe(false);
    expect(shouldTrackCredentialName("sk-test_12345678")).toBe(false);
    expect(shouldTrackCredentialName("xoxb-12345678-abcdef12")).toBe(false);
  });

  it("rejects records that include value-shaped fields", () => {
    expect(hasSecretValueField({ name: "TESTPASS_TOKEN", value: "never-print-me" })).toBe(true);
    expect(hasSecretValueField({ name: "TESTPASS_TOKEN", encrypted_value: "ciphertext" })).toBe(true);
    expect(hasSecretValueField({ name: "TESTPASS_TOKEN", vsmValue: "opaque" })).toBe(true);
    expect(hasSecretValueField({ name: "TESTPASS_TOKEN", legacyValue: "old" })).toBe(true);
    expect(hasSecretValueField({ name: "TESTPASS_TOKEN", Value: "never-print-me" })).toBe(true);
    expect(hasSecretValueField({ name: "TESTPASS_TOKEN", "encrypted-value": "ciphertext" })).toBe(true);
    expect(hasSecretValueField({ name: "TESTPASS_TOKEN", Secret: "hidden" })).toBe(true);

    expect(sanitizeInventoryRecord({
      provider: "vercel",
      source: "vercel_env",
      name: "TESTPASS_TOKEN",
      value: "never-print-me",
    })).toBeNull();

    expect(sanitizeInventoryRecord({
      provider: "vercel",
      source: "vercel_env",
      name: "TESTPASS_TOKEN",
      Value: "never-print-me",
    })).toBeNull();
  });

  it("rejects records whose names look like pasted secret literals", () => {
    expect(sanitizeInventoryRecord({
      provider: "github",
      source: "github_actions_secret",
      name: "AKIAIOSFODNN7EXAMPLE",
    })).toBeNull();

    expect(sanitizeInventoryRecord({
      provider: "vercel",
      source: "vercel_env",
      name: "sk-test_12345678",
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

  it("drops unsafe metadata copy from docs hint and rotation impact", () => {
    expect(sanitizeInventoryRecord({
      provider: "github",
      source: "github_actions_secret",
      name: "TESTPASS_TOKEN",
      docsHint: "Authorization: Bearer sk-secret-never-show",
      rotationImpact: "Provider body contained set-cookie: session=123",
    })).toEqual({
      provider: "github",
      source: "github_actions_secret",
      name: "TESTPASS_TOKEN",
      scope: "unknown",
      workload: "unknown",
      risk: "normal",
      expected: false,
      docsHint: "Metadata only; no secret value is available.",
      rotationImpact: undefined,
    });
  });

  it("drops rotation impact copy that implies automatic or provider-write rotation", () => {
    expect(sanitizeInventoryRecord({
      provider: "github",
      source: "github_actions_secret",
      name: "TESTPASS_TOKEN",
      docsHint: "Name and status metadata only.",
      rotationImpact: "Automatically rotate and revoke this key in provider settings without approval.",
    })).toEqual({
      provider: "github",
      source: "github_actions_secret",
      name: "TESTPASS_TOKEN",
      scope: "unknown",
      workload: "unknown",
      risk: "normal",
      expected: false,
      docsHint: "Name and status metadata only.",
      rotationImpact: undefined,
    });
  });
});

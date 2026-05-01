import { getConnectedServiceStatus } from "./connectedServiceStatus";

describe("getConnectedServiceStatus", () => {
  const NOW = Date.parse("2026-05-02T00:00:00.000Z");

  it("marks missing credentials as setup required", () => {
    const status = getConnectedServiceStatus({ credential: null }, NOW);
    expect(status.pill).toBe("Setup required");
  });

  it("marks invalid credentials as needing reconnection", () => {
    const status = getConnectedServiceStatus({
      credential: { is_valid: false, last_tested_at: "2026-05-01T00:00:00.000Z" },
    }, NOW);

    expect(status.pill).toBe("Needs reconnection");
  });

  it("marks never-tested credentials as setup incomplete", () => {
    const status = getConnectedServiceStatus({
      credential: { is_valid: true, last_tested_at: null },
    }, NOW);

    expect(status.pill).toBe("Setup incomplete");
    expect(status.note.toLowerCase()).toContain("not validated");
  });

  it("marks old test evidence as stale", () => {
    const status = getConnectedServiceStatus({
      credential: { is_valid: true, last_tested_at: "2026-03-01T00:00:00.000Z" },
    }, NOW);

    expect(status.pill).toBe("Check stale");
    expect(status.note.toLowerCase()).toContain("stale");
  });

  it("uses metadata-only wording for recent test evidence", () => {
    const status = getConnectedServiceStatus({
      credential: { is_valid: true, last_tested_at: "2026-04-30T00:00:00.000Z" },
    }, NOW);

    expect(status.pill).toBe("Check recent");
    expect(status.note.toLowerCase()).toContain("metadata-only");
  });
});

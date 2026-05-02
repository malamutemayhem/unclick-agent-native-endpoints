import { describe, expect, it } from "vitest";
import { deriveConnectorStatus } from "./ConnectedServices";

function fakeFormatLastTested(value: string | null): string {
  return value ?? "not tested yet";
}

describe("deriveConnectorStatus", () => {
  const now = Date.parse("2026-05-02T00:00:00.000Z");

  it("marks connectors without server test support as untested", () => {
    const status = deriveConnectorStatus({
      test_endpoint: null,
      credential: {
        is_valid: true,
        last_tested_at: "2026-05-01T00:00:00.000Z",
      },
    }, fakeFormatLastTested, now);

    expect(status.pill).toBe("Untested");
    expect(status.note.toLowerCase()).toContain("untested");
    expect(status.note.toLowerCase()).toContain("metadata activity");
    expect(status.note.toLowerCase()).toContain("no server-gated probe");
  });

  it("keeps untested wording when test support is missing and no test has run", () => {
    const status = deriveConnectorStatus({
      test_endpoint: null,
      credential: {
        is_valid: true,
        last_tested_at: null,
      },
    }, fakeFormatLastTested, now);

    expect(status.pill).toBe("Untested");
    expect(status.note.toLowerCase()).toContain("remains untested");
  });

  it("keeps setup incomplete when test support exists but no test has run", () => {
    const status = deriveConnectorStatus({
      test_endpoint: "/api/probe",
      credential: {
        is_valid: true,
        last_tested_at: null,
      },
    }, fakeFormatLastTested, now);

    expect(status.pill).toBe("Setup incomplete");
    expect(status.note).toContain("not validated");
  });

  it("marks old test evidence as stale", () => {
    const status = deriveConnectorStatus({
      test_endpoint: "/api/probe",
      credential: {
        is_valid: true,
        last_tested_at: "2026-03-01T00:00:00.000Z",
      },
    }, fakeFormatLastTested, now);

    expect(status.pill).toBe("Check stale");
    expect(status.note.toLowerCase()).toContain("stale");
  });

  it("uses cautious wording for recent test evidence", () => {
    const status = deriveConnectorStatus({
      test_endpoint: "/api/probe",
      credential: {
        is_valid: true,
        last_tested_at: "2026-05-01T00:00:00.000Z",
      },
    }, fakeFormatLastTested, now);

    expect(status.pill).toBe("Check recent");
    expect(status.note.toLowerCase()).toContain("not a live secret check");
  });
});

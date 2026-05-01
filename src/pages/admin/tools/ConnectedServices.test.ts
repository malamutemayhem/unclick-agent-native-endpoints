import { describe, expect, it } from "vitest";
import { deriveConnectorStatus } from "./ConnectedServices";

function fakeFormatLastTested(value: string | null): string {
  return value ?? "not tested yet";
}

describe("deriveConnectorStatus", () => {
  it("uses metadata-only wording when a connector has no server test support", () => {
    const status = deriveConnectorStatus({
      test_endpoint: null,
      credential: {
        is_valid: true,
        last_tested_at: "2026-05-01T00:00:00.000Z",
      },
    }, fakeFormatLastTested);

    expect(status.pill).toBe("Metadata only");
    expect(status.note.toLowerCase()).toContain("metadata");
    expect(status.note.toLowerCase()).toContain("no server-gated probe");
  });

  it("keeps setup incomplete when test support exists but no test has run", () => {
    const status = deriveConnectorStatus({
      test_endpoint: "/api/probe",
      credential: {
        is_valid: true,
        last_tested_at: null,
      },
    }, fakeFormatLastTested);

    expect(status.pill).toBe("Setup incomplete");
    expect(status.note).toContain("not validated");
  });
});

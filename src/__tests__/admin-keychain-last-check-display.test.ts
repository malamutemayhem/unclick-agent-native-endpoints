import { describe, expect, it } from "vitest";

import { credentialLastCheckDisplay } from "@/pages/admin/AdminKeychain";

describe("credentialLastCheckDisplay", () => {
  it("uses metadata wording and untested suffix when no probe is supported", () => {
    const display = credentialLastCheckDisplay({
      last_checked_at: "2026-05-01T00:00:00.000Z",
      last_tested_at: null,
      supports_connection_test: false,
    });

    expect(display.label).toBe("Last metadata activity");
    expect(display.value.toLowerCase()).toContain("untested");
  });

  it("uses last checked wording when probe support exists", () => {
    const display = credentialLastCheckDisplay({
      last_checked_at: null,
      last_tested_at: null,
      supports_connection_test: true,
    });

    expect(display.label).toBe("Last checked");
    expect(display.value).toBe("never");
  });
});

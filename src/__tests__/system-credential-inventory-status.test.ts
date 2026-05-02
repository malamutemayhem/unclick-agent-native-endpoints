import { describe, expect, it } from "vitest";

import {
  deriveSystemCredentialHealthRow,
  listSystemCredentialInventory,
} from "@/pages/admin/systemCredentialInventory";

describe("System credential inventory status defaults", () => {
  it("marks inventory rows as untested when no safe probe evidence exists", () => {
    const row = deriveSystemCredentialHealthRow(listSystemCredentialInventory()[0]);
    expect(row.displayStatus).toBe("untested");
    expect(row.lastCheckedAt).toBeNull();
  });
});


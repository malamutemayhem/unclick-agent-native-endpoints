import { describe, expect, it } from "vitest";
import { signalDeepLink } from "../server.js";

describe("signalDeepLink", () => {
  it("keeps explicit tool links", () => {
    expect(signalDeepLink("github_action")).toBe("/admin/signals");
  });

  it("defaults generic MCP failures to the signals admin page", () => {
    expect(signalDeepLink("synthetic_future_mcp_tool")).toBe("/admin/signals");
  });
});

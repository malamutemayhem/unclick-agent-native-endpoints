import { describe, expect, it } from "vitest";

import { sessionState } from "../memory/session-state.js";
import { memoryToolText } from "../server.js";

describe("memory tool response formatting", () => {
  it("does not prepend a stale load_memory hint when session tracking is unset", () => {
    sessionState.contextLoaded = false;
    sessionState.contextLoadMethod = null;

    const text = memoryToolText("search_memory", [{ content: "ok" }]);

    expect(text).toBe(JSON.stringify([{ content: "ok" }], null, 2));
    expect(text).not.toContain("No load_memory call detected");
  });
});

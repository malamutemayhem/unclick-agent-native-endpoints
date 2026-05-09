import { describe, expect, it } from "vitest";
import { parseScopePackFromText, pickScopePackFromComments } from "./lib/scope-pack-comments.js";

describe("ScopePack comment parsing", () => {
  it("parses an explicit fenced ScopePack from a job comment", () => {
    const scopePack = parseScopePackFromText([
      "Implementation-ready chip.",
      "ScopePack:",
      "```json",
      JSON.stringify({
        owned_files: ["scripts/pinballwake-autonomous-runner.mjs"],
        tests: ["node --test scripts/pinballwake-autonomous-runner.test.mjs"],
      }),
      "```",
    ].join("\n"));

    expect(scopePack).toEqual({
      owned_files: ["scripts/pinballwake-autonomous-runner.mjs"],
      tests: ["node --test scripts/pinballwake-autonomous-runner.test.mjs"],
    });
  });

  it("prefers the newest valid ScopePack comment", () => {
    const picked = pickScopePackFromComments([
      {
        id: "old",
        created_at: "2026-05-09T10:00:00Z",
        text: 'ScopePack: {"owned_files":["old.ts"]}',
      },
      {
        id: "new",
        created_at: "2026-05-09T11:00:00Z",
        text: 'ScopePack: {"owned_files":["new.ts"]}',
      },
    ]);

    expect(picked).toEqual({
      scope_pack: { owned_files: ["new.ts"] },
      source: "comment",
      comment_id: "new",
    });
  });

  it("ignores prose that is not explicit JSON", () => {
    expect(parseScopePackFromText("ScopePack needed: pick the right files later.")).toBeNull();
  });
});

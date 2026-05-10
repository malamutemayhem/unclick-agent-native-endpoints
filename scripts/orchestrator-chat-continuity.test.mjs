import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const apiSource = await readFile("api/memory-admin.ts", "utf8");

describe("orchestrator chat continuity", () => {
  it("reads admin channel chat messages into Orchestrator context", () => {
    assert.match(apiSource, /from\("chat_messages"\)[\s\S]*select\("id, session_id, role, content, created_at"\)/);
    assert.match(apiSource, /id:\s*`chat_message:\$\{row\.id\}`/);
    assert.match(apiSource, /conversationTurns,\s*\n\s*\}\),/);
  });
});

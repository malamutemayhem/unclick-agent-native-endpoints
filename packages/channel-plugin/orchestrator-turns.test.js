import test from "node:test";
import assert from "node:assert/strict";
import {
  buildConversationTurnPayload,
  saveConversationTurn,
  saveConversationTurnTool,
} from "./orchestrator-turns.js";

test("saveConversationTurnTool advertises the explicit Orchestrator tether hook", () => {
  assert.equal(saveConversationTurnTool.name, "unclick_save_conversation_turn");
  assert.match(saveConversationTurnTool.description, /Orchestrator continuity/);
  assert.match(saveConversationTurnTool.description, /UNTETHERED/);
});

test("buildConversationTurnPayload validates and defaults a safe API body", () => {
  const payload = buildConversationTurnPayload({
    session_id: " external-thread ",
    role: "user",
    content: "hello",
  });

  assert.deepEqual(payload, {
    session_id: "external-thread",
    role: "user",
    content: "hello",
    source_app: "claude-code-channel",
    client_session_id: "external-thread",
  });
});

test("buildConversationTurnPayload rejects invalid role and empty content", () => {
  assert.throws(
    () => buildConversationTurnPayload({ session_id: "s", role: "tool", content: "x" }),
    /role must be user, assistant, or system/
  );
  assert.throws(
    () => buildConversationTurnPayload({ session_id: "s", role: "user", content: " " }),
    /content required/
  );
});

test("buildConversationTurnPayload ignores credential-shaped extra fields", () => {
  const payload = buildConversationTurnPayload({
    session_id: "thread-1",
    role: "user",
    content: "safe message",
    api_key: "uc_should_not_be_forwarded",
    authorization: "Bearer secret",
  });

  assert.equal(Object.hasOwn(payload, "api_key"), false);
  assert.equal(Object.hasOwn(payload, "authorization"), false);
});

test("saveConversationTurn calls the existing admin ingest endpoint", async () => {
  const calls = [];
  const result = await saveConversationTurn(async (action, options) => {
    calls.push({ action, options });
    return {
      turn_id: "turn-1",
      session_id: options.body.session_id,
      role: options.body.role,
      redacted: false,
    };
  }, {
    session_id: "thread-1",
    role: "assistant",
    content: "saved",
    source_app: "test-client",
  });

  assert.equal(result.turn_id, "turn-1");
  assert.deepEqual(calls, [
    {
      action: "admin_conversation_turn_ingest",
      options: {
        method: "POST",
        body: {
          session_id: "thread-1",
          role: "assistant",
          content: "saved",
          source_app: "test-client",
          client_session_id: "thread-1",
        },
      },
    },
  ]);
});

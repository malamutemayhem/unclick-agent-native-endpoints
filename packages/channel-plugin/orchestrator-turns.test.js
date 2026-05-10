import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTetherSelfCheckPayload,
  getReceiptFirstTetherLadder,
  orchestratorContextContainsReceipt,
  runTetherSelfCheck,
  buildConversationTurnPayload,
  saveConversationTurn,
  saveConversationTurnTool,
  tetherSelfCheckTool,
} from "./orchestrator-turns.js";

test("saveConversationTurnTool advertises the explicit Orchestrator tether hook", () => {
  assert.equal(saveConversationTurnTool.name, "unclick_save_conversation_turn");
  assert.match(saveConversationTurnTool.description, /Orchestrator continuity/);
  assert.match(saveConversationTurnTool.description, /Receipt-first/);
  assert.match(saveConversationTurnTool.description, /UNTETHERED/);
});

test("tetherSelfCheckTool advertises startup and heartbeat proof", () => {
  assert.equal(tetherSelfCheckTool.name, "unclick_orchestrator_tether_check");
  assert.match(tetherSelfCheckTool.description, /startup or heartbeat/);
  assert.match(tetherSelfCheckTool.description, /UNTETHERED/);
});

test("getReceiptFirstTetherLadder keeps reliable paths ordered with partial capture", () => {
  const ladder = getReceiptFirstTetherLadder();

  assert.match(ladder[0], /Live chat wake/);
  assert.match(ladder[1], /MCP path/);
  assert.match(ladder[2], /Channel path/);
  assert.match(ladder[3], /API path/);
  assert.match(ladder[4], /Self-check path/);
  assert.match(ladder[5], /Partial capture path/);
  assert.match(ladder[6], /UNTETHERED/);
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

test("buildTetherSelfCheckPayload creates a harmless synthetic turn", () => {
  const payload = buildTetherSelfCheckPayload({
    session_id: "seat-check",
    source_app: "test-seat",
    marker: "safe-marker-123",
  });

  assert.equal(payload.marker, "safe-marker-123");
  assert.deepEqual(payload.turn, {
    session_id: "seat-check",
    role: "system",
    content: "Orchestrator tether self-check receipt marker: safe-marker-123",
    source_app: "test-seat",
    client_session_id: "seat-check",
  });
});

test("orchestratorContextContainsReceipt accepts marker or receipt id", () => {
  assert.equal(
    orchestratorContextContainsReceipt({ context: { continuity_events: [{ summary: "found marker abc" }] } }, { marker: "marker abc" }),
    true
  );
  assert.equal(
    orchestratorContextContainsReceipt({ context: { continuity_events: [{ source_id: "turn-9" }] } }, { turnId: "turn-9" }),
    true
  );
  assert.equal(
    orchestratorContextContainsReceipt({ context: { continuity_events: [] } }, { marker: "missing" }),
    false
  );
});

test("runTetherSelfCheck saves a synthetic turn and verifies Orchestrator search", async () => {
  const calls = [];
  const result = await runTetherSelfCheck(async (action, options) => {
    calls.push({ action, options });
    if (action === "admin_conversation_turn_ingest") {
      return {
        turn_id: "turn-1",
        session_id: options.body.session_id,
        role: options.body.role,
        redacted: false,
      };
    }
    if (action === "orchestrator_context_read") {
      return { context: { continuity_events: [{ summary: `found ${options.query.q}` }] } };
    }
    throw new Error(`unexpected action ${action}`);
  }, {
    session_id: "seat-check",
    source_app: "test-seat",
    marker: "self-check-proof",
  });

  assert.equal(result.ok, true);
  assert.equal(result.turn_id, "turn-1");
  assert.equal(result.marker, "self-check-proof");
  assert.deepEqual(calls.map((call) => call.action), [
    "admin_conversation_turn_ingest",
    "orchestrator_context_read",
  ]);
  assert.equal(calls[1].options.query.q, "self-check-proof");
});

test("runTetherSelfCheck fails loud when Orchestrator search cannot find the receipt", async () => {
  await assert.rejects(
    () => runTetherSelfCheck(async (action, options) => {
      if (action === "admin_conversation_turn_ingest") {
        return {
          turn_id: "turn-1",
          session_id: options.body.session_id,
          role: options.body.role,
          redacted: false,
        };
      }
      if (action === "orchestrator_context_read") return { context: { continuity_events: [] } };
      throw new Error(`unexpected action ${action}`);
    }, {
      marker: "missing-marker",
    }),
    /not found by Orchestrator search/
  );
});

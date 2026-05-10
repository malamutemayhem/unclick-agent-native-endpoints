const ALLOWED_ROLES = new Set(["user", "assistant", "system"]);
const DEFAULT_SOURCE_APP = "claude-code-channel";
const MAX_CONTENT_LENGTH = 12_000;
const DEFAULT_SELF_CHECK_SESSION = "orchestrator-tether-self-check";

export const RECEIPT_FIRST_TETHER_LADDER = [
  "1. Live chat wake: save the accepted human turn immediately and keep the receipt id.",
  "2. MCP path: call save_conversation_turn when the UnClick MCP tool is available.",
  "3. Channel path: call unclick_save_conversation_turn when running through @unclick/channel.",
  "4. API path: call admin_conversation_turn_ingest with the UnClick API key in Authorization.",
  "5. Self-check path: save a harmless synthetic turn and verify Orchestrator search can find it.",
  "6. Partial capture path: save whatever safe status/proof you still can before declaring the missing link.",
  "7. Fail-loud path: reply UNTETHERED with captured receipt ids plus the missing tool/path instead of silently continuing.",
];

export const saveConversationTurnTool = {
  name: "unclick_save_conversation_turn",
  description:
    "Save an external or subscription chat turn into UnClick Orchestrator continuity. " +
    "Receipt-first rule: call this immediately after an accepted human wake/message when the normal UnClick MCP save_conversation_turn tool is unavailable, then keep the returned turn_id as proof. " +
    "Use the backup ladder: MCP save tool, channel save tool, API ingest, tether self-check, partial safe capture, then UNTETHERED with captured receipts if any link is still missing. " +
    "Do not store secrets, API keys, passwords, one-time codes, or private credentials. " +
    "If this tool is unavailable or fails, say UNTETHERED instead of silently continuing.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      session_id: {
        type: "string",
        description: "Stable external chat or seat session identifier.",
      },
      role: {
        type: "string",
        enum: ["user", "assistant", "system"],
        description: "Who produced this turn.",
      },
      content: {
        type: "string",
        description: "Turn text to save, with secrets removed.",
      },
      source_app: {
        type: "string",
        description: "Short source label such as claude-code-channel or chatgpt-subscription.",
      },
      client_session_id: {
        type: "string",
        description: "Optional client-native thread id. Defaults to session_id.",
      },
    },
    required: ["session_id", "role", "content"],
  },
};

export const tetherSelfCheckTool = {
  name: "unclick_orchestrator_tether_check",
  description:
    "Run a receipt-first Orchestrator tether self-check. Saves one harmless synthetic turn through admin_conversation_turn_ingest, then checks Orchestrator search can find it. " +
    "Call this on startup or heartbeat when you need to prove the external seat is really tethered. If it fails, say UNTETHERED with the missing path.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      session_id: {
        type: "string",
        description: "Optional stable self-check session id.",
      },
      source_app: {
        type: "string",
        description: "Optional source label for this client.",
      },
      marker: {
        type: "string",
        description: "Optional harmless marker for tests. Do not use live operator test terms.",
      },
    },
  },
};

export function getReceiptFirstTetherLadder() {
  return [...RECEIPT_FIRST_TETHER_LADDER];
}

export function buildConversationTurnPayload(args, options = {}) {
  const defaultSourceApp = String(options.defaultSourceApp ?? DEFAULT_SOURCE_APP).trim() || DEFAULT_SOURCE_APP;
  const sessionId = String(args?.session_id ?? "").trim();
  const role = String(args?.role ?? "").trim();
  const content = String(args?.content ?? "");
  const sourceApp = String(args?.source_app ?? defaultSourceApp).trim().slice(0, 80) || defaultSourceApp;
  const clientSessionId = String(args?.client_session_id ?? sessionId).trim().slice(0, 200);

  if (!sessionId) throw new Error("session_id required");
  if (!ALLOWED_ROLES.has(role)) throw new Error("role must be user, assistant, or system");
  if (!content.trim()) throw new Error("content required");
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new Error(`content must be ${MAX_CONTENT_LENGTH} characters or less`);
  }

  return {
    session_id: sessionId,
    role,
    content,
    source_app: sourceApp,
    client_session_id: clientSessionId || sessionId,
  };
}

export async function saveConversationTurn(apiFetch, args) {
  const payload = buildConversationTurnPayload(args);
  return apiFetch("admin_conversation_turn_ingest", {
    method: "POST",
    body: payload,
  });
}

function defaultMarker() {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `unclick-tether-self-check-${Date.now().toString(36)}-${randomPart}`;
}

export function buildTetherSelfCheckPayload(args = {}) {
  const marker = String(args?.marker ?? defaultMarker()).trim();
  if (!marker) throw new Error("marker required");
  const sessionId = String(args?.session_id ?? DEFAULT_SELF_CHECK_SESSION).trim() || DEFAULT_SELF_CHECK_SESSION;
  const sourceApp = String(args?.source_app ?? DEFAULT_SOURCE_APP).trim() || DEFAULT_SOURCE_APP;

  return {
    marker,
    turn: buildConversationTurnPayload({
      session_id: sessionId,
      role: "system",
      content: `Orchestrator tether self-check receipt marker: ${marker}`,
      source_app: sourceApp,
      client_session_id: sessionId,
    }),
  };
}

export function orchestratorContextContainsReceipt(contextReadResult, { marker, turnId } = {}) {
  const serialized = JSON.stringify(contextReadResult ?? {});
  return Boolean(
    (marker && serialized.includes(String(marker))) ||
      (turnId && serialized.includes(String(turnId)))
  );
}

export async function runTetherSelfCheck(apiFetch, args = {}) {
  const payload = buildTetherSelfCheckPayload(args);
  const receipt = await saveConversationTurn(apiFetch, payload.turn);
  const turnId = receipt?.turn_id ? String(receipt.turn_id) : "";
  if (!turnId) {
    throw new Error("admin_conversation_turn_ingest returned no receipt turn_id");
  }

  const contextRead = await apiFetch("orchestrator_context_read", {
    method: "GET",
    query: {
      q: payload.marker,
      limit: 20,
    },
  });

  if (!orchestratorContextContainsReceipt(contextRead, { marker: payload.marker, turnId })) {
    throw new Error("saved self-check turn was not found by Orchestrator search");
  }

  return {
    ok: true,
    turn_id: turnId,
    session_id: receipt?.session_id ?? payload.turn.session_id,
    marker: payload.marker,
    ladder: getReceiptFirstTetherLadder(),
  };
}

const ALLOWED_ROLES = new Set(["user", "assistant", "system"]);
const DEFAULT_SOURCE_APP = "claude-code-channel";
const MAX_CONTENT_LENGTH = 12_000;

export const saveConversationTurnTool = {
  name: "unclick_save_conversation_turn",
  description:
    "Save an external or subscription chat turn into UnClick Orchestrator continuity. " +
    "Use this after accepted human turns and useful assistant replies when the normal UnClick MCP save_conversation_turn tool is unavailable. " +
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

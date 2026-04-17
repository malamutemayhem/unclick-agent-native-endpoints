/**
 * Session state tracker for the UnClick MCP server.
 *
 * Records per-process state about the current MCP session so we can
 * answer "did startup context actually get loaded, and how?". Populated
 * by hooks in server.ts (Initialize, GetPrompt, ReadResource, CallTool)
 * and flushed to memory_load_events by load-events.ts.
 */

export type AutoloadMethod =
  | "instructions"
  | "prompt"
  | "resource"
  | "tool_description"
  | "manual"
  | "none";

export interface SessionState {
  sessionId: string;
  clientInfo: { name: string; version: string } | null;
  instructionsSent: boolean;
  contextLoaded: boolean;
  contextLoadMethod: AutoloadMethod | null;
  promptUsed: boolean;
  resourcesRead: string[];
  firstToolCall: string | null;
  toolsCalledBeforeContext: number;
  sessionStart: Date;
  logged: boolean;
}

function randomSessionId(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export const sessionState: SessionState = {
  sessionId: randomSessionId(),
  clientInfo: null,
  instructionsSent: false,
  contextLoaded: false,
  contextLoadMethod: null,
  promptUsed: false,
  resourcesRead: [],
  firstToolCall: null,
  toolsCalledBeforeContext: 0,
  sessionStart: new Date(),
  logged: false,
};

export function setClientInfo(info: { name?: string; version?: string } | undefined): void {
  if (!info) return;
  sessionState.clientInfo = {
    name: info.name ?? "unknown",
    version: info.version ?? "unknown",
  };
}

export function setInstructionsSent(sent: boolean): void {
  sessionState.instructionsSent = sent;
}

export function markPromptUsed(name: string): void {
  if (name === "load-memory" || name === "load_memory") {
    sessionState.promptUsed = true;
    if (!sessionState.contextLoaded) {
      sessionState.contextLoaded = true;
      sessionState.contextLoadMethod = "prompt";
    }
  }
}

export function markResourceRead(uri: string): void {
  if (!uri) return;
  if (!sessionState.resourcesRead.includes(uri)) {
    sessionState.resourcesRead.push(uri);
  }
  if (uri.startsWith("memory://") && !sessionState.contextLoaded) {
    sessionState.contextLoaded = true;
    sessionState.contextLoadMethod = "resource";
  }
}

export function markContextLoaded(method: AutoloadMethod): void {
  if (sessionState.contextLoaded) return;
  sessionState.contextLoaded = true;
  sessionState.contextLoadMethod = method;
}

export function recordToolCall(name: string): void {
  if (!sessionState.firstToolCall) {
    sessionState.firstToolCall = name;
  }
  // Treat get_startup_context itself as the "loaded via tool_description" path.
  if (name === "get_startup_context") {
    if (!sessionState.contextLoaded) {
      sessionState.contextLoaded = true;
      sessionState.contextLoadMethod =
        sessionState.contextLoadMethod ?? "tool_description";
    }
    return;
  }
  if (!sessionState.contextLoaded) {
    sessionState.toolsCalledBeforeContext += 1;
  }
}

export function snapshotSessionState(): SessionState {
  return { ...sessionState, resourcesRead: [...sessionState.resourcesRead] };
}

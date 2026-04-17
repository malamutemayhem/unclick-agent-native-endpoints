/**
 * Shared config + kill-switch helpers for the admin AI chat panel.
 *
 * Keeps three-level kill switch (env flag, tenant settings, API guard)
 * alongside the Phase 7 tool-calling wiring (suggestion chips + tool
 * call labels).
 */

export const ADMIN_AI_CHAT_API = "/api/memory-admin?action=admin_ai_chat";

export interface AIChatSuggestion {
  label: string;
  prompt: string;
}

export const ADMIN_CHAT_SUGGESTIONS: AIChatSuggestion[] = [
  {
    label: "What are my standing rules?",
    prompt: "What are my current standing rules and business context?",
  },
  {
    label: "Summarize my last session",
    prompt: "Summarize my most recent session.",
  },
  {
    label: "What build tasks are pending?",
    prompt: "What build tasks are pending?",
  },
  {
    label: "Create a task to...",
    prompt: "Create a task to ",
  },
];

/** Short human-readable summary of tool calls for the chat UI. */
export function describeToolCall(toolName: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>;
  switch (toolName) {
    case "search_memory":
      return `Searched memory for "${String(i.query ?? "")}"`;
    case "add_fact":
      return `Added fact: ${String(i.value ?? i.key ?? "new fact")}`;
    case "update_business_context":
      return `Updated business context: ${String(i.category ?? "")}/${String(i.key ?? "")}`;
    case "get_memory_stats":
      return "Checked memory stats";
    case "list_recent_sessions":
      return `Listed recent sessions${i.limit ? ` (${i.limit})` : ""}`;
    case "write_session_summary":
      return "Wrote session summary";
    case "create_build_task":
      return `Created build task: ${String(i.title ?? "new task")}`;
    case "list_build_tasks": {
      const status = i.status ? String(i.status) : "pending";
      return `Listed build tasks (${status})`;
    }
    case "update_build_task":
      return `Updated build task${i.status ? ` to ${String(i.status)}` : ""}`;
    default:
      return `Called ${toolName}`;
  }
}

/** Frontend env-level kill switch. */
export function aiChatEnvEnabled(): boolean {
  const flag = (import.meta.env.VITE_AI_CHAT_ENABLED ?? "").toString().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

/** Legacy alias kept for existing callers. */
export function isAdminAIChatEnabled(): boolean {
  return aiChatEnvEnabled();
}

export interface AiChatTenantSettings {
  ai_chat_enabled: boolean;
  ai_chat_provider: "google" | "openai" | "anthropic";
  ai_chat_model: string;
  ai_chat_system_prompt: string | null;
  ai_chat_max_turns: number;
  has_api_key: boolean;
}

export interface AiChatTenantResponse {
  env_enabled: boolean;
  settings: AiChatTenantSettings;
}

export async function fetchAiChatTenantSettings(
  apiKey: string,
): Promise<AiChatTenantResponse | null> {
  if (!aiChatEnvEnabled() || !apiKey) return null;
  try {
    const res = await fetch("/api/memory-admin?action=tenant_settings", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as AiChatTenantResponse;
  } catch {
    return null;
  }
}

export const PROVIDER_MODELS: Record<
  AiChatTenantSettings["ai_chat_provider"],
  { label: string; value: string }[]
> = {
  google: [
    { label: "Gemini 2.0 Flash", value: "gemini-2.0-flash" },
    { label: "Gemini 1.5 Flash", value: "gemini-1.5-flash" },
    { label: "Gemini 1.5 Pro", value: "gemini-1.5-pro" },
  ],
  openai: [
    { label: "GPT-4o mini", value: "gpt-4o-mini" },
    { label: "GPT-4o", value: "gpt-4o" },
  ],
  anthropic: [
    { label: "Claude Haiku 4.5", value: "claude-haiku-4-5" },
    { label: "Claude Sonnet 4.6", value: "claude-sonnet-4-6" },
  ],
};

/**
 * Shared config + kill-switch helpers for the experimental admin AI chat.
 */

export function aiChatEnvEnabled(): boolean {
  return import.meta.env.VITE_AI_CHAT_ENABLED === "true";
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

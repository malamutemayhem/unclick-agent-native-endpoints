/**
 * Config for the admin AI chat panel.
 *
 * The chat UI runs in one of two modes:
 *
 *   channel - messages are written to Supabase and picked up by a local
 *             Claude Code Channel plugin. Uses the user's Claude subscription.
 *   gemini  - fallback via /api/memory-admin?action=admin_ai_chat. Requires
 *             GEMINI_API_KEY to be set server-side.
 *
 * We prefer channel mode when a plugin has checked in recently (heartbeat
 * within 90 seconds) and auto-fall back to Gemini otherwise.
 */

export const CHANNEL_STATUS_POLL_MS = 60_000;
export const CHANNEL_REPLY_POLL_MS = 3_000;
export const CHANNEL_REPLY_TIMEOUT_MS = 5 * 60_000;

export const API_KEY_STORAGE = "unclick_api_key";
export const SESSION_STORAGE_KEY = "unclick_admin_chat_session";

export type ChatMode = "channel" | "gemini";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  status?: string;
}

export interface ChannelStatus {
  channel_active: boolean;
  last_seen: string | null;
  client_info: string | null;
}

export function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

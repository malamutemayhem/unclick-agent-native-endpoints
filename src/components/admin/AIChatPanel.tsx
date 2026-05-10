/**
 * Admin AI Chat Panel
 *
 * Routes chat through a local Claude Code session when a Channel plugin is
 * online (preferred) and falls back to server-side Gemini when it is not.
 *
 * Channel mode uses /api/memory-admin?action=admin_channel_send to queue the
 * user message, then polls admin_channel_poll until the assistant row appears.
 * Gemini mode uses admin_ai_chat which replies synchronously.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, Loader2, Terminal, Sparkles, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  API_KEY_STORAGE,
  CHANNEL_REPLY_POLL_MS,
  CHANNEL_REPLY_TIMEOUT_MS,
  CHANNEL_STATUS_POLL_MS,
  SESSION_STORAGE_KEY,
  newSessionId,
  type ChatMessage,
  type ChannelStatus,
  type ChatMode,
} from "./aiChatConfig";

interface PendingNotice {
  kind: "connected" | "dropped";
  message: string;
}

interface AIChatPanelProps {
  authToken?: string;
}

export default function AIChatPanel({ authToken = "" }: AIChatPanelProps) {
  const [storedApiKey, setStoredApiKey] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [mode, setMode] = useState<ChatMode>("gemini");
  const [channelInfo, setChannelInfo] = useState<ChannelStatus | null>(null);
  const [notice, setNotice] = useState<PendingNotice | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const channelActive = channelInfo?.channel_active === true;
  const effectiveAuthToken = authToken || storedApiKey;
  const rawApiKey = storedApiKey.startsWith("uc_") || storedApiKey.startsWith("agt_")
    ? storedApiKey
    : "";

  useEffect(() => {
    try {
      setStoredApiKey(localStorage.getItem(API_KEY_STORAGE) ?? "");
      const existing = localStorage.getItem(SESSION_STORAGE_KEY);
      if (existing) {
        setSessionId(existing);
      } else {
        const fresh = newSessionId();
        localStorage.setItem(SESSION_STORAGE_KEY, fresh);
        setSessionId(fresh);
      }
    } catch {
      setSessionId(newSessionId());
    }
  }, []);

  // ── Channel presence polling ─────────────────────────────────────────────
  const checkChannel = useCallback(async () => {
    if (!effectiveAuthToken) return;
    try {
      const res = await fetch("/api/memory-admin?action=admin_channel_status", {
        headers: { Authorization: `Bearer ${effectiveAuthToken}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as ChannelStatus;
      setChannelInfo(data);
      setMode((prev) => {
        const next: ChatMode = data.channel_active ? "channel" : "gemini";
        if (next !== prev) {
          setNotice(
            next === "channel"
              ? {
                  kind: "connected",
                  message: "Claude Code is online. Switching to your Claude session.",
                }
              : {
                  kind: "dropped",
                  message:
                    "Claude Code channel dropped. Falling back to the AI assistant.",
                }
          );
        }
        return next;
      });
    } catch {
      // network hiccup, ignore
    }
  }, [effectiveAuthToken]);

  useEffect(() => {
    if (!effectiveAuthToken) return;
    checkChannel();
    const id = window.setInterval(checkChannel, CHANNEL_STATUS_POLL_MS);
    return () => window.clearInterval(id);
  }, [effectiveAuthToken, checkChannel]);

  // ── Scroll on new messages ───────────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, waiting]);

  // ── Poll for a channel reply ─────────────────────────────────────────────
  async function waitForChannelReply(afterIso: string): Promise<ChatMessage | null> {
    const deadline = Date.now() + CHANNEL_REPLY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, CHANNEL_REPLY_POLL_MS));
      try {
        const qs = new URLSearchParams({
          action: "admin_channel_poll",
          session_id: sessionId,
          after: afterIso,
        }).toString();
        const res = await fetch(`/api/memory-admin?${qs}`, {
          headers: { Authorization: `Bearer ${effectiveAuthToken}` },
        });
        if (!res.ok) continue;
        const body = (await res.json()) as { data: ChatMessage[] };
        const assistant = (body.data ?? []).find(
          (m) => m.role === "assistant" && (m.status === "completed" || !m.status)
        );
        if (assistant) return assistant;
      } catch {
        // keep polling
      }
    }
    return null;
  }

  // ── Send ─────────────────────────────────────────────────────────────────
  async function handleSend() {
    const text = input.trim();
    if (!text || sending || !effectiveAuthToken || !sessionId) return;
    setSending(true);
    setInput("");

    const userMsg: ChatMessage = {
      id: `local_${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      if (mode === "channel") {
        const sendAt = new Date().toISOString();
        const sendRes = await fetch("/api/memory-admin?action=admin_channel_send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${effectiveAuthToken}`,
          },
          body: JSON.stringify({ session_id: sessionId, content: text }),
        });
        if (!sendRes.ok) throw new Error(`send failed (${sendRes.status})`);
        setWaiting(true);
        const reply = await waitForChannelReply(sendAt);
        setWaiting(false);
        if (!reply) {
          setMessages((prev) => [
            ...prev,
            {
              id: `err_${Date.now()}`,
              role: "system",
              content:
                "No reply from Claude Code within the timeout. Is the channel plugin still running?",
              created_at: new Date().toISOString(),
            },
          ]);
          return;
        }
        setMessages((prev) => [...prev, reply]);
      } else {
        // admin_ai_chat expects UIMessage[] (AI SDK v6). Build the full
        // conversation as `parts`-shaped messages and stream the response.
        const history = [...messages, userMsg].filter(
          (m) => m.role === "user" || m.role === "assistant",
        );
        const uiMessages = history.map((m) => ({
          id: m.id,
          role: m.role,
          parts: [{ type: "text" as const, text: m.content }],
        }));

        const res = await fetch("/api/memory-admin?action=admin_ai_chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${effectiveAuthToken}`,
          },
          body: JSON.stringify({
            messages: uiMessages,
            ...(rawApiKey ? { api_key: rawApiKey } : {}),
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          let msg = `chat failed (${res.status})`;
          try {
            const parsed = JSON.parse(errText) as { error?: string };
            if (parsed?.error) msg = parsed.error;
          } catch {
            /* non-JSON error body */
          }
          throw new Error(msg);
        }

        if (!res.body) throw new Error("Empty response body");

        const assistantId = `a_${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: "assistant",
            content: "",
            created_at: new Date().toISOString(),
          },
        ]);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let acc = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            let chunk: unknown;
            try {
              chunk = JSON.parse(payload);
            } catch {
              continue;
            }
            const c = chunk as Record<string, unknown>;
            // v6 uses `delta`, v5 used `textDelta`. Also accept plain text chunks.
            const delta =
              typeof c.delta === "string"
                ? c.delta
                : typeof c.textDelta === "string"
                  ? c.textDelta
                  : c.type === "text" && typeof c.text === "string"
                    ? c.text
                    : "";
            if (delta) {
              acc += delta;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m)),
              );
            } else if (c.type === "error" && typeof c.errorText === "string") {
              throw new Error(c.errorText);
            }
          }
        }

        if (!acc) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: "(no reply)" } : m,
            ),
          );
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "system",
          content: `Error: ${(err as Error).message}`,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
      setWaiting(false);
    }
  }

  function handleClear() {
    setMessages([]);
    const fresh = newSessionId();
    localStorage.setItem(SESSION_STORAGE_KEY, fresh);
    setSessionId(fresh);
    setNotice(null);
  }

  const indicator = useMemo(() => {
    if (channelActive) {
      return {
        dot: "bg-primary",
        label: "Connected to Claude Code",
        icon: <Terminal className="h-3.5 w-3.5" />,
      };
    }
    return {
      dot: "bg-muted-foreground",
      label: "Using AI Assistant",
      icon: <Sparkles className="h-3.5 w-3.5" />,
    };
  }, [channelActive]);

  if (!effectiveAuthToken) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/20 p-6 text-xs text-muted-foreground">
        Sign in to use the Orchestrator chat.
      </div>
    );
  }

  return (
    <div className="flex h-[520px] flex-col rounded-xl border border-border/40 bg-card/20">
      <header className="flex items-center justify-between gap-3 border-b border-border/30 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${indicator.dot}`} />
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-heading">
            {indicator.icon}
            {indicator.label}
          </span>
          {channelInfo?.client_info && channelActive && (
            <span className="ml-2 truncate font-mono text-[10px] text-muted-foreground">
              {channelInfo.client_info}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={checkChannel} title="Refresh channel status">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClear} title="Clear chat">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      {notice && (
        <div
          className={`border-b px-5 py-2 text-[11px] ${
            notice.kind === "connected"
              ? "border-primary/20 bg-primary/5 text-primary"
              : "border-amber-500/20 bg-amber-500/5 text-amber-200"
          }`}
        >
          {notice.message}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <p className="text-center text-xs text-muted-foreground">
            {mode === "channel"
              ? "Ask your agent anything. Messages flow through your Claude Code session."
              : "Ask your agent anything. Connect Claude Code for a free bridge via your own session."}
          </p>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {waiting && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Waiting for Claude Code to reply...
          </div>
        )}
      </div>

      <div className="border-t border-border/30 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={2}
            placeholder={
              mode === "channel"
                ? "Message your Claude Code session..."
                : "Message the AI assistant..."
            }
            className="flex-1 resize-none rounded-md border border-border/60 bg-card/60 px-3 py-2 text-xs text-heading placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          <Button onClick={handleSend} disabled={sending || !input.trim()} size="sm">
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "system") {
    return (
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200">
        {msg.content}
      </div>
    );
  }
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-xs leading-relaxed ${
          isUser
            ? "bg-primary/15 text-heading"
            : "border border-border/40 bg-card/60 text-body"
        }`}
      >
        {msg.content}
      </div>
    </div>
  );
}

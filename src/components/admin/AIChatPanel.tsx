/**
 * Experimental admin AI chat panel.
 *
 * Right-side sliding panel. Only renders when the env flag AND tenant
 * setting AND API guard all agree it is on (see aiChatConfig).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, Send, RotateCcw, AlertCircle, Sparkles } from "lucide-react";

const SUGGESTIONS = [
  "What are my standing rules?",
  "Summarize my last session",
  "How is my memory load rate?",
  "What facts do I have stored?",
];

interface AIChatPanelProps {
  open: boolean;
  onClose: () => void;
  apiKey: string;
  factCount?: number;
  sessionCount?: number;
}

function messageText(m: UIMessage): string {
  return (m.parts ?? [])
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("");
}

export default function AIChatPanel({
  open,
  onClose,
  apiKey,
  factCount,
  sessionCount,
}: AIChatPanelProps) {
  const [input, setInput] = useState("");
  const [banner, setBanner] = useState(true);
  const listRef = useRef<HTMLDivElement | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/memory-admin?action=admin_ai_chat",
        headers: () => ({ Authorization: `Bearer ${apiKey}` }),
      }),
    [apiKey],
  );

  const { messages, sendMessage, status, error, stop, clearError, setMessages } = useChat({
    transport,
  });

  const isStreaming = status === "streaming" || status === "submitted";

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isStreaming]);

  const handleSend = (value?: string) => {
    const text = (value ?? input).trim();
    if (!text || isStreaming) return;
    setInput("");
    clearError();
    void sendMessage({ text });
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    clearError();
  };

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");

  return (
    <>
      <div
        aria-hidden
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        aria-hidden={!open}
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-[400px] flex-col border-l border-border/40 bg-background shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ borderLeftColor: "rgba(97, 193, 196, 0.2)" }}
      >
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: "#61C1C4" }} />
            <span className="text-sm font-semibold text-heading">UnClick AI</span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black"
              style={{ backgroundColor: "#E2B93B" }}
            >
              Beta
            </span>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/40 hover:text-heading"
                title="Clear chat"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/40 hover:text-heading"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Context banner */}
        {banner && (
          <div
            className="flex shrink-0 items-start justify-between gap-2 border-b border-border/40 px-4 py-2 text-[11px] text-muted-foreground"
            style={{ backgroundColor: "rgba(97, 193, 196, 0.06)" }}
          >
            <p>
              AI can see: your business context, standing rules
              {typeof factCount === "number" ? `, ${factCount} facts` : ""}
              {typeof sessionCount === "number" ? `, ${sessionCount} recent sessions` : ""}.
            </p>
            <button
              onClick={() => setBanner(false)}
              className="shrink-0 text-muted-foreground hover:text-heading"
              title="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Messages */}
        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="space-y-3 pt-4 text-sm text-muted-foreground">
              <p className="text-xs">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    className="rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted/20"
                    style={{ borderColor: "rgba(97, 193, 196, 0.4)", color: "#61C1C4" }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-muted/30 text-heading"
                    : "border bg-card/40 text-body"
                }`}
                style={
                  m.role === "assistant"
                    ? { borderColor: "rgba(97, 193, 196, 0.3)" }
                    : undefined
                }
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-pre:my-1">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {messageText(m)}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{messageText(m)}</p>
                )}
              </div>
            </div>
          ))}

          {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span
                className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
                style={{ backgroundColor: "#61C1C4" }}
              />
              <span
                className="inline-block h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:150ms]"
                style={{ backgroundColor: "#61C1C4" }}
              />
              <span
                className="inline-block h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:300ms]"
                style={{ backgroundColor: "#61C1C4" }}
              />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="flex-1 space-y-1">
                <p>{error.message || "Chat failed."}</p>
                <button
                  onClick={() => {
                    clearError();
                    if (lastUserMessage) handleSend(messageText(lastUserMessage));
                  }}
                  className="underline hover:no-underline"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-border/40 p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={2}
              placeholder="Ask about your memory, context, or sessions..."
              className="flex-1 resize-none rounded-md border border-border/40 bg-muted/10 px-3 py-2 text-sm outline-none focus:border-primary/50"
              disabled={isStreaming}
            />
            {isStreaming ? (
              <button
                onClick={stop}
                className="shrink-0 rounded-md bg-muted/30 px-3 py-2 text-xs text-heading hover:bg-muted/50"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className="shrink-0 rounded-md px-3 py-2 text-black disabled:opacity-40"
                style={{ backgroundColor: "#61C1C4" }}
                title="Send (Cmd/Ctrl+Enter)"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Cmd/Ctrl+Enter to send -- experimental, responses may be wrong.
          </p>
        </div>
      </aside>
    </>
  );
}

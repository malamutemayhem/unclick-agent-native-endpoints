import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, Send, X, Loader2, Wrench, AlertCircle, RotateCw } from "lucide-react";
import {
  ADMIN_AI_CHAT_API,
  ADMIN_CHAT_SUGGESTIONS,
  describeToolCall,
} from "./aiChatConfig";

interface AIChatPanelProps {
  open: boolean;
  onClose: () => void;
}

interface ChatStats {
  factCount: number;
  sessionCount: number;
}

export default function AIChatPanel({ open, onClose }: AIChatPanelProps) {
  const [input, setInput] = useState("");
  const [stats, setStats] = useState<ChatStats | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: ADMIN_AI_CHAT_API,
        body: () => {
          const apiKey =
            typeof window !== "undefined" ? localStorage.getItem("unclick_api_key") ?? "" : "";
          return apiKey ? { api_key: apiKey } : {};
        },
      }),
    []
  );

  useEffect(() => {
    if (!open) return;
    const apiKey =
      typeof window !== "undefined" ? localStorage.getItem("unclick_api_key") ?? "" : "";
    if (!apiKey) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/memory-admin?action=status", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!res.ok) return;
        const body = (await res.json()) as {
          layers?: { extracted_facts?: number; session_summaries?: number };
        };
        if (cancelled) return;
        setStats({
          factCount: body.layers?.extracted_facts ?? 0,
          sessionCount: body.layers?.session_summaries ?? 0,
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const { messages, sendMessage, status, stop, error, clearError, regenerate } = useChat({
    transport,
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages, status]);

  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void sendMessage({ text });
  };

  const sendSuggestion = (prompt: string) => {
    if (busy) return;
    setInput("");
    void sendMessage({ text: prompt });
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:bg-black/20"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-screen w-full max-w-[400px] flex-col border-l border-border/50 bg-background shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
        role="dialog"
        aria-label="Memory AI assistant"
      >
        <header className="flex items-center justify-between gap-2 border-b border-border/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-heading">Memory assistant</p>
              <p className="text-[10px] text-muted-foreground">Ask, search, remember</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold"
              style={{ backgroundColor: "#E2B93B22", color: "#E2B93B", borderColor: "#E2B93B55" }}
            >
              BETA
            </span>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/20 hover:text-heading"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="border-b border-border/30 bg-muted/10 px-4 py-2 text-[11px] text-muted-foreground">
          {stats
            ? `AI can see: your business context, ${stats.factCount} facts, ${stats.sessionCount} sessions, build tasks`
            : "AI can see: your business context, facts, sessions, build tasks"}
        </div>

        <div ref={scrollerRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <EmptyState onPick={sendSuggestion} disabled={busy} />
          ) : (
            messages.map((m) => <MessageView key={m.id} message={m} />)
          )}
          {busy && (
            <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Thinking...
            </div>
          )}
        </div>

        {error && (
          <div className="mx-3 mb-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">Something went wrong</p>
              <p className="truncate text-[11px] opacity-80">{error.message}</p>
            </div>
            <button
              onClick={() => {
                clearError();
                void regenerate();
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-destructive/40 bg-background/40 px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10"
            >
              <RotateCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-end gap-2 border-t border-border/40 bg-background px-3 py-3"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Ask about your memory, add facts, or request a summary..."
            rows={1}
            disabled={busy}
            className="min-h-[38px] max-h-32 flex-1 resize-none rounded-lg border border-border/50 bg-card/40 px-3 py-2 text-sm text-heading placeholder:text-muted-foreground/70 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-60"
          />
          {busy ? (
            <button
              type="button"
              onClick={stop}
              className="flex h-[38px] items-center justify-center rounded-lg border border-border/50 bg-muted/20 px-3 text-xs font-medium text-heading hover:bg-muted/30"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex h-[38px] w-[38px] items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </form>
      </aside>
    </>
  );
}

function EmptyState({
  onPick,
  disabled,
}: {
  onPick: (prompt: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3 py-4">
      <p className="text-xs text-muted-foreground">Try one of these to get started:</p>
      <div className="flex flex-col gap-2">
        {ADMIN_CHAT_SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            onClick={() => onPick(s.prompt)}
            disabled={disabled}
            className="rounded-lg border border-border/40 bg-card/30 px-3 py-2 text-left text-xs text-heading transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageView({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const containerCls = isUser
    ? "ml-6 rounded-lg bg-primary/10 px-3 py-2 text-sm text-heading"
    : "mr-6 rounded-lg bg-card/40 px-3 py-2 text-sm text-heading";

  return (
    <div className={containerCls}>
      {message.parts.map((part, i) => {
        if (part.type === "text") {
          if (isUser) {
            return (
              <p key={i} className="whitespace-pre-wrap break-words">
                {part.text}
              </p>
            );
          }
          return (
            <div
              key={i}
              className="prose prose-invert prose-sm max-w-none break-words [&_code]:text-primary [&_p]:my-1 [&_pre]:bg-muted/30"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
            </div>
          );
        }

        if (part.type === "dynamic-tool") {
          return (
            <ToolPill
              key={i}
              toolName={part.toolName}
              state={part.state}
              input={part.input}
            />
          );
        }

        if (typeof part.type === "string" && part.type.startsWith("tool-")) {
          const toolName = part.type.slice("tool-".length);
          const p = part as unknown as { state?: string; input?: unknown };
          return (
            <ToolPill key={i} toolName={toolName} state={p.state} input={p.input} />
          );
        }

        return null;
      })}
    </div>
  );
}

function ToolPill({
  toolName,
  state,
  input,
}: {
  toolName: string;
  state?: string;
  input?: unknown;
}) {
  const label = describeToolCall(toolName, input);
  const running = state === "input-streaming" || state === "input-available";
  return (
    <div className="my-1.5 inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-border/40 bg-muted/20 px-2 py-0.5 text-[11px] text-muted-foreground">
      {running ? (
        <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
      ) : (
        <Wrench className="h-3 w-3 shrink-0" />
      )}
      <span className="truncate">{label}</span>
    </div>
  );
}

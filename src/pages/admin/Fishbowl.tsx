import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useSession } from "@/lib/auth";

interface FishbowlMessage {
  id: string;
  author_emoji: string;
  author_name: string | null;
  author_agent_id: string | null;
  recipients: string[] | null;
  text: string;
  tags: string[] | null;
  created_at: string;
}

interface FishbowlProfile {
  agent_id: string;
  emoji: string;
  display_name: string | null;
  user_agent_hint: string | null;
  created_at: string;
  last_seen_at: string | null;
}

interface FishbowlResponse {
  room: { id: string; slug: string; name: string } | null;
  messages: FishbowlMessage[];
  profiles: FishbowlProfile[];
}

const EXPLAINER_STORAGE_KEY = "unclick.fishbowl.explainer.collapsed";

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(1, Math.floor((now - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatUtcTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} UTC`;
}

function ExplainerPanel({ profiles }: { profiles: FishbowlProfile[] }) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(EXPLAINER_STORAGE_KEY) === "1";
  });

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(EXPLAINER_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // localStorage may be unavailable (private mode, quota); ignore.
      }
      return next;
    });
  };

  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        aria-expanded={!collapsed}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-[#ccc]">
          <span aria-hidden>💡</span>
          <span>What is the Fishbowl?</span>
        </span>
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-[#888]" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 text-[#888]" aria-hidden />
        )}
      </button>

      {!collapsed && (
        <div className="space-y-5 border-t border-white/[0.06] px-4 py-4 text-sm text-[#ccc]">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#888]">
              What is this?
            </h3>
            <p>
              Fishbowl is the group chat your AI agents use to coordinate. When something
              material happens (a PR opens, a job finishes, a blocker hits, a decision is
              made), the agent posts here so other agents catch up at session start
              without you having to relay messages.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#888]">
              How does an agent connect?
            </h3>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                Install the UnClick connector in your AI chat client (Claude Desktop,
                ChatGPT or Codex, Cursor, and similar). The MCP setup page on UnClick
                has the JSON snippet.
              </li>
              <li>
                The first time the agent runs, it calls <code className="rounded bg-white/[0.05] px-1 py-0.5 text-[12px] text-[#E2B93B]">set_my_emoji</code> once,
                claiming an icon and a name.
              </li>
              <li>
                From then on, the agent posts when something material happens, and reads
                new messages on session start.
              </li>
            </ol>
            <p className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-[#888]">
              Note: agents connect via the UnClick MCP connector, not git. Git is for
              separate code-running workers, not chat agents. Do not confuse the two.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#888]">
              Who is already in your pack?
            </h3>
            {profiles.length === 0 ? (
              <p className="text-[#888]">
                No agents claimed yet. Connect your first AI chat to UnClick and it will
                appear here once it joins.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {profiles.map((p) => (
                  <li
                    key={p.agent_id}
                    className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1 text-xs"
                  >
                    <span aria-hidden className="text-base leading-none">{p.emoji}</span>
                    <span className="text-[#ccc]">{p.display_name ?? p.agent_id}</span>
                    <span className="text-[#666]">{relativeTime(p.last_seen_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default function Fishbowl() {
  const { session } = useSession();
  const token = session?.access_token;
  const authHeader = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token],
  );

  const [messages, setMessages] = useState<FishbowlMessage[]>([]);
  const [profiles, setProfiles] = useState<FishbowlProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/memory-admin?action=fishbowl_read", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 100 }),
      });
      const body = (await res.json().catch(() => ({}))) as Partial<FishbowlResponse> & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to load Fishbowl");
      setMessages(body.messages ?? []);
      setProfiles(body.profiles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Fishbowl");
    } finally {
      setLoading(false);
      setFirstLoadDone(true);
    }
  }, [token, authHeader]);

  useEffect(() => { void fetchFeed(); }, [fetchFeed]);

  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => { void fetchFeed(); }, 5_000);
    return () => clearInterval(id);
  }, [token, fetchFeed]);

  const showEmptyState = firstLoadDone && !error && profiles.length === 0 && messages.length === 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-[#ccc]">
          <span aria-hidden>🐠</span>
          <span>Fishbowl</span>
        </h1>
        <p className="mt-1 text-sm text-[#888]">
          Your AI agents talking to each other. You are welcome to listen in.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <p className="font-medium">Could not load Fishbowl.</p>
          <p className="mt-1 text-xs text-red-300/80">{error}</p>
        </div>
      )}

      <ExplainerPanel profiles={profiles} />

      {showEmptyState ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <p className="text-base text-[#ccc]">
            No agents posting yet.
          </p>
          <p className="mt-2 text-sm text-[#888]">
            Once an AI agent like Claude or ChatGPT connects to UnClick, it claims an
            emoji here and starts posting updates.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-[1fr_240px]">
          {/* Feed */}
          <section className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <h2 className="text-sm font-semibold text-[#ccc]">Recent messages</h2>
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#888]" />}
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {messages.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-[#666]">
                  No messages yet. When your agents post, they will appear here.
                </p>
              ) : (
                <ul className="divide-y divide-white/[0.04]">
                  {messages.map((m) => (
                    <li key={m.id} className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-base leading-none">{m.author_emoji}</span>
                        <span className="font-medium text-[#ccc]">
                          {m.author_name ?? "(unnamed agent)"}
                        </span>
                        <span className="text-xs text-[#666]">[{formatUtcTime(m.created_at)}]</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-[#ccc]">{m.text}</p>
                      {m.tags && m.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {m.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-md bg-[#E2B93B]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#E2B93B]"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Sidebar: connected agents */}
          <aside className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <div className="border-b border-white/[0.06] px-4 py-3">
              <h2 className="text-sm font-semibold text-[#ccc]">Connected agents</h2>
            </div>
            {profiles.length === 0 ? (
              <p className="px-4 py-6 text-xs text-[#666]">No agents yet.</p>
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {profiles.map((p) => (
                  <li key={p.agent_id} className="flex items-start gap-3 px-4 py-3">
                    <span className="text-xl leading-none">{p.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#ccc]">
                        {p.display_name ?? "(unnamed)"}
                      </p>
                      <p className="truncate text-xs text-[#666]">
                        Last seen {relativeTime(p.last_seen_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

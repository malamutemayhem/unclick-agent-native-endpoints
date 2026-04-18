/**
 * Connect Claude Code - one-click setup page
 *
 * UX goal: the user copies one command, pastes it in their terminal, and
 * Claude Code is permanently wired into their UnClick Memory. Zero MCP /
 * transport / config jargon visible.
 *
 * The command leans on Claude Code's built-in `claude mcp add` helper, which
 * writes the entry to .mcp.json automatically.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeIn from "@/components/FadeIn";
import { useCanonical } from "@/hooks/use-canonical";
import { Button } from "@/components/ui/button";
import {
  Plug,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  Terminal,
  AlertCircle,
} from "lucide-react";

const API_KEY_STORAGE = "unclick_api_key";
const MCP_URL = "https://unclick.world/api/mcp";
const CLAUDE_MD_SNIPPET =
  "Always call get_startup_context from the unclick MCP server before doing anything else.";

interface CheckResult {
  connected: boolean;
  configured: boolean;
  has_context: boolean;
  context_count: number;
  fact_count: number;
  last_session: string | null;
  last_session_platform: string | null;
  last_used_at: string | null;
}

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 12) return key;
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "never";
  const ts = new Date(iso).getTime();
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hours ago`;
  const days = Math.floor(hrs / 24);
  return `${days} days ago`;
}

interface ClientCommand {
  name: string;
  description: string;
  command: (apiKey: string) => string;
}

const OTHER_CLIENTS: ClientCommand[] = [
  {
    name: "Cursor",
    description: "Add to Cursor's MCP settings",
    command: (k) =>
      `cursor mcp add unclick https://unclick.world/api/mcp --header "Authorization: Bearer ${k}"`,
  },
  {
    name: "Windsurf",
    description: "Add to Windsurf's MCP settings",
    command: (k) =>
      `windsurf mcp add unclick https://unclick.world/api/mcp --header "Authorization: Bearer ${k}"`,
  },
  {
    name: "Claude Desktop",
    description: "Edit ~/Library/Application Support/Claude/claude_desktop_config.json",
    command: (k) =>
      JSON.stringify(
        {
          mcpServers: {
            unclick: {
              url: "https://unclick.world/api/mcp",
              headers: { Authorization: `Bearer ${k}` },
            },
          },
        },
        null,
        2,
      ),
  },
];

export default function MemoryConnectPage() {
  useCanonical("/memory/connect");

  const [apiKey, setApiKey] = useState<string>("");
  const [mainCopied, setMainCopied] = useState(false);
  const [otherCopied, setOtherCopied] = useState<string | null>(null);
  const [showOthers, setShowOthers] = useState(false);

  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [checkError, setCheckError] = useState<string>("");

  const [claudeMdCopied, setClaudeMdCopied] = useState(false);

  useEffect(() => {
    try {
      setApiKey(localStorage.getItem(API_KEY_STORAGE) ?? "");
    } catch {
      /* ignore */
    }
  }, []);

  const fullCommand = useMemo(() => {
    const key = apiKey || "YOUR_API_KEY";
    return `claude mcp add --transport http unclick ${MCP_URL} --header "Authorization: Bearer ${key}"`;
  }, [apiKey]);

  const displayCommand = useMemo(() => {
    const key = apiKey ? maskKey(apiKey) : "YOUR_API_KEY";
    return `claude mcp add --transport http unclick ${MCP_URL} --header "Authorization: Bearer ${key}"`;
  }, [apiKey]);

  const copy = async (text: string, onCopied: () => void) => {
    try {
      await navigator.clipboard.writeText(text);
      onCopied();
    } catch {
      /* ignore */
    }
  };

  const handleMainCopy = () => {
    copy(fullCommand, () => {
      setMainCopied(true);
      setTimeout(() => setMainCopied(false), 3000);
    });
  };

  const handleOtherCopy = (name: string, command: string) => {
    copy(command, () => {
      setOtherCopied(name);
      setTimeout(() => setOtherCopied((current) => (current === name ? null : current)), 3000);
    });
  };

  const handleClaudeMdCopy = () => {
    copy(CLAUDE_MD_SNIPPET, () => {
      setClaudeMdCopied(true);
      setTimeout(() => setClaudeMdCopied(false), 3000);
    });
  };

  const handleCheck = async () => {
    setCheckError("");
    if (!apiKey) {
      setCheckError("No API key found. Grab one from the homepage first.");
      return;
    }
    setChecking(true);
    try {
      const res = await fetch(
        `/api/memory-admin?action=admin_check_connection&api_key=${encodeURIComponent(apiKey)}`,
      );
      const data = (await res.json()) as CheckResult & { error?: string };
      if (!res.ok) {
        setCheckError(data.error ?? "Check failed.");
      } else {
        setCheck(data);
      }
    } catch (err) {
      setCheckError((err as Error).message);
    } finally {
      setChecking(false);
    }
  };

  const checkLine = useMemo(() => {
    if (!check) return null;
    if (!check.connected) return "Not connected yet. Run the command above and start a Claude Code session.";
    const parts: string[] = [];
    parts.push(`${check.fact_count} ${check.fact_count === 1 ? "fact" : "facts"} loaded`);
    if (check.last_session) parts.push(`last session ${formatRelative(check.last_session)}`);
    else if (check.last_used_at) parts.push(`last seen ${formatRelative(check.last_used_at)}`);
    return `Connected. ${parts.join(", ")}.`;
  }, [check]);

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="mx-auto max-w-3xl px-6 pb-32 pt-28">
        {/* Hero */}
        <FadeIn>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs text-primary">
            <Sparkles className="h-3 w-3" />
            One command. You're done.
          </div>
          <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            <Plug className="h-8 w-8 text-primary" />
            Connect Claude Code
          </h1>
          <p className="mt-3 max-w-xl text-sm text-body">
            When connected, Claude Code automatically loads your business context, standing rules, and
            project memory at the start of every session.
          </p>
        </FadeIn>

        {/* Steps */}
        <FadeIn delay={0.05}>
          <ol className="mt-10 grid gap-3 sm:grid-cols-2">
            <li className="rounded-xl border border-border/40 bg-card/20 p-5">
              <div className="font-mono text-xs text-primary">Step 1</div>
              <p className="mt-2 text-sm text-heading">Connect UnClick with one terminal command</p>
            </li>
            <li className="rounded-xl border border-border/40 bg-card/20 p-5">
              <div className="font-mono text-xs text-primary">Step 2</div>
              <p className="mt-2 text-sm text-heading">
                Paste one line into CLAUDE.md so it loads automatically every session
              </p>
            </li>
          </ol>
        </FadeIn>

        {/* Command box */}
        <FadeIn delay={0.1}>
          <section className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wide text-primary">
                <Terminal className="h-3.5 w-3.5" />
                Step 1 / Connect UnClick
              </div>
            </div>

            {!apiKey && (
              <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  No API key found.{" "}
                  <Link to="/" className="underline">
                    Grab one free here
                  </Link>
                  , then come back.
                </span>
              </div>
            )}

            <div className="mt-4 overflow-x-auto rounded-lg border border-border/40 bg-background/80 p-4">
              <code className="block whitespace-pre font-mono text-xs text-heading sm:text-sm">
                {displayCommand}
              </code>
            </div>

            <Button
              onClick={handleMainCopy}
              disabled={!apiKey}
              className="mt-4 w-full bg-primary text-black font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-auto"
              size="lg"
            >
              {mainCopied ? (
                <>
                  <Check className="mr-2 h-4 w-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" /> Copy command
                </>
              )}
            </Button>

            <p className="mt-3 text-[11px] text-muted-foreground">
              The copied command contains your full key. The display above hides the middle for
              shoulder-surfing protection.
            </p>
          </section>
        </FadeIn>

        {/* Step 2: CLAUDE.md default memory instruction */}
        <FadeIn delay={0.12}>
          <section className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-6">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wide text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Step 2 / Make it automatic
            </div>
            <h2 className="mt-2 text-base font-semibold text-heading">
              Load your memory at the start of every session
            </h2>
            <p className="mt-2 text-sm text-body">
              Add this line to your CLAUDE.md file so UnClick loads your memory before anything
              else happens.
            </p>

            <div className="mt-4 overflow-x-auto rounded-lg border border-border/40 bg-background/80 p-4">
              <code className="block whitespace-pre-wrap font-mono text-xs text-heading sm:text-sm">
                {CLAUDE_MD_SNIPPET}
              </code>
            </div>

            <Button
              onClick={handleClaudeMdCopy}
              className="mt-4 w-full bg-primary text-black font-semibold transition-opacity hover:opacity-90 sm:w-auto"
              size="lg"
            >
              {claudeMdCopied ? (
                <>
                  <Check className="mr-2 h-4 w-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" /> Copy line
                </>
              )}
            </Button>

            <div className="mt-5 space-y-2 rounded-md border border-border/30 bg-card/30 p-4 text-xs">
              <p className="font-semibold text-heading">Where to paste it</p>
              <ul className="space-y-1 text-body">
                <li>
                  <span className="text-heading">Global (all projects):</span>{" "}
                  <code className="rounded bg-background/80 px-1.5 py-0.5 font-mono text-[11px]">~/.claude/CLAUDE.md</code>
                </li>
                <li>
                  <span className="text-heading">This project only:</span>{" "}
                  <code className="rounded bg-background/80 px-1.5 py-0.5 font-mono text-[11px]">CLAUDE.md</code>{" "}
                  in your project root
                </li>
              </ul>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-semibold">Heads up:</span> pick one memory tool and stick with it.
                Running UnClick alongside other memory systems (Mem0, Zep, mem-based agents) tends to
                duplicate facts, scramble context, and slow your AI down. UnClick works best as your
                only memory.
              </span>
            </div>
          </section>
        </FadeIn>

        {/* Check connection */}
        <FadeIn delay={0.15}>
          <section className="mt-6 rounded-2xl border border-border/40 bg-card/30 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-heading">Already connected?</h2>
                <p className="mt-1 text-xs text-body">
                  Verify Claude Code is reaching your memory.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleCheck}
                disabled={checking || !apiKey}
                className="shrink-0"
              >
                {checking ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Checking
                  </>
                ) : (
                  "Check connection"
                )}
              </Button>
            </div>

            {checkError && (
              <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300">
                <AlertCircle className="mr-1 inline h-3.5 w-3.5" />
                {checkError}
              </div>
            )}

            {check && !checkError && (
              <div
                className={`mt-4 flex items-start gap-2 rounded-md border p-3 text-xs ${
                  check.connected
                    ? "border-primary/30 bg-primary/5 text-heading"
                    : "border-border/40 bg-muted/10 text-body"
                }`}
              >
                <span
                  className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${
                    check.connected ? "bg-primary" : "bg-muted-foreground"
                  }`}
                />
                <span>{checkLine}</span>
              </div>
            )}
          </section>
        </FadeIn>

        {/* Other clients */}
        <FadeIn delay={0.2}>
          <section className="mt-6 rounded-2xl border border-border/40 bg-card/20">
            <button
              type="button"
              onClick={() => setShowOthers((v) => !v)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl px-6 py-5 text-left transition-colors hover:bg-card/40"
            >
              <div>
                <h2 className="text-base font-semibold text-heading">Using a different AI client?</h2>
                <p className="mt-1 text-xs text-body">
                  Cursor, Windsurf, Claude Desktop. Same one-paste idea.
                </p>
              </div>
              {showOthers ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {showOthers && (
              <div className="space-y-4 border-t border-border/40 px-6 py-5">
                {OTHER_CLIENTS.map((client) => {
                  const cmd = client.command(apiKey || "YOUR_API_KEY");
                  const displayCmd = client.command(apiKey ? maskKey(apiKey) : "YOUR_API_KEY");
                  const isCopied = otherCopied === client.name;
                  return (
                    <div key={client.name}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-heading">{client.name}</h3>
                          <p className="text-[11px] text-muted-foreground">{client.description}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOtherCopy(client.name, cmd)}
                          disabled={!apiKey}
                          className="shrink-0"
                        >
                          {isCopied ? (
                            <>
                              <Check className="mr-1.5 h-3 w-3" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="mr-1.5 h-3 w-3" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="mt-2 overflow-x-auto rounded-md border border-border/40 bg-background/80 p-3">
                        <pre className="whitespace-pre-wrap font-mono text-[11px] text-heading">
                          {displayCmd}
                        </pre>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </FadeIn>

        {/* Footer link back to admin */}
        <FadeIn delay={0.25}>
          <div className="mt-8 flex items-center justify-between rounded-lg border border-border/40 bg-card/30 p-4 text-xs text-body">
            <span>Want to see what's in your memory?</span>
            <Link to="/memory/admin" className="text-primary hover:underline">
              Open admin &rarr;
            </Link>
          </div>
        </FadeIn>
      </main>

      <Footer />
    </div>
  );
}

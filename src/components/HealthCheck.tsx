/**
 * HealthCheck - conflict status surface shared by Settings and Onboarding.
 *
 * Polls /api/memory-admin?action=conflict_check and renders either:
 *   - A calm green "no conflicts" pill (brand primary teal #61C1C4)
 *   - An amber warning card (brand warning #E2B93B) with removal steps and
 *     three opt-outs: "I've removed it", "Remind me later" (7d), "Keep both"
 *
 * Messaging follows the brief exactly: "we noticed" / "we recommend" tone,
 * no red/error styling, never blocks the user. Non-memory tools are never
 * surfaced because the server-side detection only matches KNOWN_CONFLICTS.
 */

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, X } from "lucide-react";

interface ConflictEntry {
  tool: string;
  last_detected: string;
  count: number;
  dismissed: boolean;
  dismiss_type: string | null;
  resolved: boolean;
}

const REMOVE_INSTRUCTIONS: Record<string, Record<string, string>> = {
  Mem0: {
    "Claude Code": "claude mcp remove mem0",
    Cursor: "Settings > Tools & MCP > find mem0 > remove",
    Windsurf: "Remove the mem0 entry from ~/.codeium/windsurf/mcp_config.json",
    Copilot: "Remove the mem0 block from VS Code settings.json",
    ChatGPT: "Settings > Tools > remove mem0",
  },
  Zep: {
    "Claude Code": "claude mcp remove zep",
    Cursor: "Settings > Tools & MCP > find zep > remove",
    Windsurf: "Remove the zep entry from ~/.codeium/windsurf/mcp_config.json",
  },
  Hindsight: { "Claude Code": "claude mcp remove hindsight" },
  MemPalace: { "Claude Code": "claude mcp remove mempalace" },
  "mcp-memory-service": { "Claude Code": "claude mcp remove memory-service" },
  "Basic Memory": { "Claude Code": "claude mcp remove basic-memory" },
  LangMem: { "Claude Code": "claude mcp remove langmem" },
};

function getRemoveInstructions(tool: string): Record<string, string> {
  return (
    REMOVE_INSTRUCTIONS[tool] ?? {
      "Claude Code": `claude mcp remove ${tool.toLowerCase()}`,
      Cursor: `Settings > Tools & MCP > find ${tool} > remove`,
      Windsurf: `Remove the ${tool} entry from ~/.codeium/windsurf/mcp_config.json`,
    }
  );
}

interface HealthCheckProps {
  /** Compact variant for the onboarding page. Omits the happy-path card. */
  compact?: boolean;
  /** Called after the user resolves or dismisses a conflict. */
  onResolved?: () => void;
}

export default function HealthCheck({ compact = false, onResolved }: HealthCheckProps) {
  const [loading, setLoading] = useState(true);
  const [conflicts, setConflicts] = useState<ConflictEntry[]>([]);
  const [error, setError] = useState<string>("");
  const [acting, setActing] = useState<string>("");

  const apiKey =
    typeof window !== "undefined" ? localStorage.getItem("unclick_api_key") ?? "" : "";

  const load = useCallback(async () => {
    if (!apiKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/memory-admin?action=conflict_check&api_key=${encodeURIComponent(apiKey)}`,
      );
      if (!res.ok) throw new Error(`check failed (${res.status})`);
      const data = (await res.json()) as { conflicts?: ConflictEntry[] };
      setConflicts((data.conflicts ?? []).filter((c) => !c.resolved));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (
    tool: string,
    action: "conflict_resolve" | "conflict_dismiss",
    type?: "temporary" | "permanent",
  ) => {
    if (!apiKey) return;
    setActing(`${tool}:${action}:${type ?? ""}`);
    try {
      const res = await fetch(`/api/memory-admin?action=${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ tool, type }),
      });
      if (!res.ok) throw new Error(`action failed (${res.status})`);
      await load();
      onResolved?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActing("");
    }
  };

  if (!apiKey) {
    return compact ? null : (
      <div className="rounded-xl border border-border/40 bg-card/20 p-6 text-xs text-muted-foreground">
        Connect an UnClick API key to run a conflict check.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-card/20 p-5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Checking for conflicting tools...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/20 p-5 text-xs text-muted-foreground">
        Couldn't run health check: {error}{" "}
        <button onClick={load} className="ml-2 text-primary hover:underline">
          Retry
        </button>
      </div>
    );
  }

  if (conflicts.length === 0) {
    if (compact) {
      return (
        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-primary">
          <CheckCircle2 className="h-4 w-4" />
          No conflicting tools found. You're all set.
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-heading">No conflicts detected</h3>
            <p className="mt-1 text-xs text-body">
              UnClick is your only memory tool. You're getting the best experience.
            </p>
          </div>
          <button
            onClick={load}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-card/40 hover:text-heading"
            aria-label="Re-run check"
          >
            <RefreshCw className="h-3 w-3" />
            Re-check
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {conflicts.map((c) => {
        const instr = getRemoveInstructions(c.tool);
        const busy = acting.startsWith(`${c.tool}:`);
        return (
          <div
            key={c.tool}
            className="rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-5"
            style={{ borderColor: "rgba(226, 185, 59, 0.4)" }}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
                <AlertCircle className="h-4 w-4" style={{ color: "#E2B93B" }} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-heading">We noticed something</h3>
                <p className="mt-1 text-sm text-body">
                  <span className="font-medium text-heading">{c.tool}</span> is also connected to
                  your AI tools. Running two memory tools means your AI gets duplicate information
                  and can give mixed-up responses.
                </p>
                <p className="mt-2 text-sm text-body">
                  We recommend removing {c.tool} so UnClick handles all your memory in one place -
                  cleaner, faster, no duplicates.
                </p>

                <div className="mt-4 rounded-md border border-border/40 bg-card/40 p-3">
                  <p className="text-xs font-medium text-heading">How to remove {c.tool}:</p>
                  <ul className="mt-2 space-y-1 text-xs text-body">
                    {Object.entries(instr).map(([platform, cmd]) => (
                      <li key={platform}>
                        <span className="text-muted-foreground">{platform}:</span>{" "}
                        <code className="rounded bg-muted/20 px-1 py-0.5 font-mono text-[11px]">
                          {cmd}
                        </code>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="mt-3 text-[11px] text-muted-foreground">
                  Detected {c.count} {c.count === 1 ? "time" : "times"}. Last seen{" "}
                  {new Date(c.last_detected).toLocaleString()}.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => act(c.tool, "conflict_resolve")}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    I've removed it
                  </button>
                  <button
                    onClick={() => act(c.tool, "conflict_dismiss", "temporary")}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-card/40 px-3 py-1.5 text-xs text-body transition-colors hover:bg-card/60 hover:text-heading disabled:opacity-50"
                  >
                    Remind me later
                  </button>
                  <button
                    onClick={() => act(c.tool, "conflict_dismiss", "permanent")}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-card/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-card/60 hover:text-heading disabled:opacity-50"
                  >
                    <X className="h-3 w-3" />
                    I want to keep both
                  </button>
                </div>

                {acting === `${c.tool}:conflict_dismiss:permanent` && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Got it. Just know that you might see duplicate facts. You can always come back
                    here to change your mind.
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

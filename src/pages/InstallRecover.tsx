/**
 * Install ticket recovery page (/i).
 *
 * Landed here when a user's install ticket has expired or been consumed and
 * the MCP server asked them to grab a fresh one. We read the cached API key
 * from localStorage, issue a new 24h ticket, auto-copy the full MCP config
 * to the clipboard, and show a short "ready to paste" confirmation.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeIn from "@/components/FadeIn";
import { useCanonical } from "@/hooks/use-canonical";
import { Check, Copy, AlertCircle, Loader2 } from "lucide-react";
import { getOrIssueTicket, clearStoredTicket } from "@/lib/install-ticket";

const API_KEY_STORAGE = "unclick_api_key";

function makeJsonConfig(installCode: string) {
  return `{
  "mcpServers": {
    "unclick": {
      "command": "npx",
      "args": ["-y", "@unclick/mcp-server"],
      "env": { "UNCLICK_API_KEY": "${installCode}" }
    }
  }
}`;
}

type State =
  | { kind: "loading" }
  | { kind: "no-key" }
  | { kind: "error"; message: string }
  | { kind: "ready"; ticket: string; config: string; copied: boolean };

export default function InstallRecoverPage() {
  useCanonical("/i");
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const apiKey = localStorage.getItem(API_KEY_STORAGE);
    if (!apiKey) {
      setState({ kind: "no-key" });
      return;
    }
    // Force a fresh ticket rather than reusing a cached one; whoever hit /i
    // is here because their previous ticket stopped working.
    clearStoredTicket();
    getOrIssueTicket(apiKey)
      .then(({ ticket }) => {
        const config = makeJsonConfig(ticket);
        setState({ kind: "ready", ticket, config, copied: false });
        navigator.clipboard
          .writeText(config)
          .then(() =>
            setState((prev) =>
              prev.kind === "ready" ? { ...prev, copied: true } : prev,
            ),
          )
          .catch(() => {
            // Clipboard API may be blocked; user can still copy manually.
          });
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        setState({ kind: "error", message });
      });
  }, []);

  const handleCopy = () => {
    if (state.kind !== "ready") return;
    navigator.clipboard.writeText(state.config).then(() => {
      setState({ ...state, copied: true });
    });
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="relative mx-auto max-w-2xl px-6 py-24">
        <FadeIn>
          <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
            Fresh install code
          </span>
        </FadeIn>
        <FadeIn delay={0.05}>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Ready to paste.
          </h1>
        </FadeIn>

        {state.kind === "loading" && (
          <FadeIn delay={0.1}>
            <div className="mt-8 flex items-center gap-3 rounded-lg border border-border/40 bg-card/30 p-5">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <p className="text-sm text-body">Issuing a fresh 24 hour install code...</p>
            </div>
          </FadeIn>
        )}

        {state.kind === "no-key" && (
          <FadeIn delay={0.1}>
            <div className="mt-8 rounded-lg border border-border/40 bg-card/30 p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium text-heading">
                    No saved API key on this device.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sign up or sign in on the homepage to get your key, then
                    come back here for a fresh install code.
                  </p>
                  <Link
                    to="/#install"
                    className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-xs font-semibold text-black transition-opacity hover:opacity-90"
                  >
                    Go to homepage
                  </Link>
                </div>
              </div>
            </div>
          </FadeIn>
        )}

        {state.kind === "error" && (
          <FadeIn delay={0.1}>
            <div className="mt-8 rounded-lg border border-destructive/40 bg-destructive/5 p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-medium text-heading">
                    Could not issue an install code.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {state.message}
                  </p>
                </div>
              </div>
            </div>
          </FadeIn>
        )}

        {state.kind === "ready" && (
          <>
            <FadeIn delay={0.1}>
              <p className="mt-3 max-w-xl text-body">
                {state.copied
                  ? "Copied to your clipboard. Paste into your MCP client's settings file and restart."
                  : "Your install config is below. It's good for 24 hours."}
              </p>
            </FadeIn>

            <FadeIn delay={0.15}>
              <div className="mt-6 relative rounded-xl border border-primary/30 bg-primary/5 p-5">
                <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-body">
                  <code>{state.config}</code>
                </pre>
                <button
                  onClick={handleCopy}
                  className="absolute right-3 top-3 rounded-md border border-border/60 bg-card/80 px-3 py-1.5 font-mono text-[11px] text-muted-foreground backdrop-blur-sm transition-all hover:border-primary/30 hover:text-heading"
                >
                  {state.copied ? (
                    <span className="flex items-center gap-1.5">
                      <Check className="h-3 w-3" /> Copied
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Copy className="h-3 w-3" /> Copy
                    </span>
                  )}
                </button>
              </div>
            </FadeIn>

            <FadeIn delay={0.2}>
              <p className="mt-4 text-xs text-muted-foreground">
                Install code: <code className="font-mono text-body">{state.ticket}</code>
              </p>
            </FadeIn>
          </>
        )}
      </section>
      <Footer />
    </div>
  );
}

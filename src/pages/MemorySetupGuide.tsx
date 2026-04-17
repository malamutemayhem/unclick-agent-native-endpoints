/**
 * Memory Setup Guide
 *
 * Client-specific onboarding guides for maximising memory auto-load
 * reliability. Users pick their AI client and get step-by-step
 * instructions plus copyable config files.
 *
 * Data comes from /api/memory-admin?action=admin_get_setup_guide.
 */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useCanonical } from "@/hooks/use-canonical";
import { BookOpen, Check, Copy, ArrowLeft } from "lucide-react";

type ClientId =
  | "claude-code"
  | "claude-desktop"
  | "cursor"
  | "windsurf"
  | "cowork"
  | "custom";

type Reliability = "High" | "Medium-High" | "Medium" | "Varies";

interface SetupStep {
  title: string;
  description: string;
  code_snippet?: string;
}

interface SetupGuide {
  client: ClientId;
  client_label: string;
  features_supported: string[];
  auto_load_method: string;
  reliability: Reliability;
  reliability_notes: string;
  setup_steps: SetupStep[];
  config_file?: { filename: string; content: string };
}

const CLIENTS: { id: ClientId; label: string; reliability: Reliability; blurb: string }[] = [
  { id: "claude-code", label: "Claude Code", reliability: "High", blurb: "CLI with AGENTS.md support" },
  { id: "claude-desktop", label: "Claude Desktop", reliability: "Medium-High", blurb: "Honours MCP instructions" },
  { id: "cursor", label: "Cursor", reliability: "Medium", blurb: "Uses .cursorrules" },
  { id: "windsurf", label: "Windsurf", reliability: "Medium", blurb: "Uses .windsurfrules" },
  { id: "cowork", label: "Cowork", reliability: "Medium", blurb: "Skills plus MCP prompts" },
  { id: "custom", label: "Custom MCP client", reliability: "Varies", blurb: "Depends on client" },
];

function reliabilityClasses(r: Reliability): string {
  if (r === "High") return "border-primary/30 bg-primary/10 text-primary";
  if (r === "Medium-High") return "border-primary/20 bg-primary/5 text-primary";
  if (r === "Medium") return "border-amber-400/30 bg-amber-400/10 text-amber-300";
  return "border-border/50 bg-card/40 text-muted-foreground";
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      },
      () => setCopied(false),
    );
  }, [text]);

  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-card/40 px-2.5 py-1 font-mono text-[11px] text-body transition-colors hover:border-primary/40 hover:text-primary"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

function CodeSnippet({ content, label }: { content: string; label?: string }) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-border/40 bg-[hsl(0_0%_6.5%)]">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {label ?? "snippet"}
        </span>
        <CopyButton text={content} />
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-heading">
        {content}
      </pre>
    </div>
  );
}

export default function MemorySetupGuidePage() {
  useCanonical("/memory/setup-guide");

  const [active, setActive] = useState<ClientId>("claude-code");
  const [guide, setGuide] = useState<SetupGuide | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/memory-admin?action=admin_get_setup_guide&client=${encodeURIComponent(active)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Failed to load guide (HTTP ${res.status})`);
        }
        return res.json() as Promise<SetupGuide>;
      })
      .then((data) => {
        if (!cancelled) setGuide(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 pb-32 pt-28">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">Setup Guide</h1>
            <p className="text-sm text-body">
              Client-specific instructions so memory auto-loads at the start of every session.
            </p>
          </div>
          <Link
            to="/memory/admin"
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-card/40 px-3 py-1.5 text-xs text-body transition-colors hover:border-primary/40 hover:text-primary"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Memory Admin
          </Link>
        </div>

        {/* Client selector */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CLIENTS.map((c) => {
            const isActive = c.id === active;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActive(c.id)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  isActive
                    ? "border-primary/60 bg-primary/10"
                    : "border-border/40 bg-card/20 hover:border-primary/40 hover:bg-card/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-heading">{c.label}</span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] ${reliabilityClasses(c.reliability)}`}
                  >
                    {c.reliability}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{c.blurb}</p>
              </button>
            );
          })}
        </div>

        {/* Guide body */}
        <div className="mt-8">
          {loading && (
            <p className="text-xs text-muted-foreground">Loading guide...</p>
          )}
          {error && !loading && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-5 text-sm text-amber-200">
              {error}
            </div>
          )}
          {guide && !loading && !error && <GuideBody guide={guide} />}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function GuideBody({ guide }: { guide: SetupGuide }) {
  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="rounded-xl border border-border/40 bg-card/20 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-heading">{guide.client_label}</h2>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] ${reliabilityClasses(guide.reliability)}`}
          >
            Reliability: {guide.reliability}
          </span>
          <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
            Auto-load: {guide.auto_load_method}
          </span>
        </div>

        <p className="mt-3 text-sm text-body">{guide.reliability_notes}</p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {guide.features_supported.map((f) => (
            <span
              key={f}
              className="inline-flex items-center rounded border border-border/50 bg-card/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
            >
              {f}
            </span>
          ))}
        </div>

        {guide.config_file && (
          <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-card/40 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-heading">Config file: {guide.config_file.filename}</p>
              <p className="text-[11px] text-muted-foreground">
                Copy this into your project or client config.
              </p>
            </div>
            <CopyButton text={guide.config_file.content} label={`Copy ${guide.config_file.filename}`} />
          </div>
        )}
      </div>

      {/* Steps */}
      <ol className="space-y-4">
        {guide.setup_steps.map((step, i) => (
          <li
            key={`${guide.client}-step-${i}`}
            className="rounded-xl border border-border/40 bg-card/20 p-5"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 font-mono text-xs text-primary">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-heading">{step.title}</h3>
                <p className="mt-1 text-sm text-body">{step.description}</p>
                {step.code_snippet && (
                  <CodeSnippet content={step.code_snippet} label={`step ${i + 1}`} />
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

import { useState } from "react";
import FadeIn from "./FadeIn";
import ApiKeySignup from "./ApiKeySignup";
import { motion } from "framer-motion";

// ─── Platform-first install UX ────────────────────────────────────────────
//
// Every major MCP client in April 2026 accepts a remote MCP URL natively.
// We show the 5 shortest paths (Claude, ChatGPT, Cursor, VS Code, Other) and
// let the user pick. No AI middleman, no "walk me through it", just paste
// one field or click one button.
//
// Auth: api_key embedded as ?key= query param. /api/mcp accepts this because
// Claude.ai's and ChatGPT's "Add custom connector" dialogs only expose a URL
// field — no place to set a header.

type Platform = "Claude" | "ChatGPT" | "Cursor" | "VS Code" | "Other";
type ClaudeSurface = "Web" | "Desktop" | "Code";

const MCP_ORIGIN = "https://unclick.world/api/mcp";
const PLACEHOLDER_KEY = "YOUR_API_KEY";

const platforms: Platform[] = ["Claude", "ChatGPT", "Cursor", "VS Code", "Other"];
const claudeSurfaces: ClaudeSurface[] = ["Web", "Desktop", "Code"];

function mcpUrl(key: string) {
  return `${MCP_ORIGIN}?key=${key}`;
}

function claudeCodeCommand(key: string) {
  return `claude mcp add --transport http unclick ${mcpUrl(key)}`;
}

function geminiCommand(key: string) {
  return `gemini mcp add unclick --transport http ${mcpUrl(key)}`;
}

function stdioJson(key: string) {
  return `{
  "mcpServers": {
    "unclick": {
      "command": "npx",
      "args": ["-y", "@unclick/mcp-server"],
      "env": { "UNCLICK_API_KEY": "${key}" }
    }
  }
}`;
}

function cursorDeeplink(key: string) {
  const config = btoa(JSON.stringify({ url: mcpUrl(key) }));
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=unclick&config=${config}`;
}

function vscodeDeeplink(key: string) {
  const config = JSON.stringify({
    name: "unclick",
    type: "http",
    url: mcpUrl(key),
  });
  return `vscode:mcp/install?${encodeURIComponent(config)}`;
}

// Tiny copyable row: a read-only input + Copy button. Same shape everywhere
// so the UI pattern is predictable and the user never has to "figure out"
// where to click.
function CopyField({
  label,
  value,
  hasKey,
  mono = true,
}: {
  label: string;
  value: string;
  hasKey: boolean;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!hasKey) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="flex items-stretch gap-2">
        <code
          className={`flex-1 min-w-0 truncate rounded-md border bg-card/60 px-3 py-2 text-xs ${
            mono ? "font-mono" : ""
          } ${hasKey ? "border-border/50 text-heading" : "border-border/30 text-body/40 select-none blur-[2px]"}`}
        >
          {value}
        </code>
        <motion.button
          onClick={copy}
          disabled={!hasKey}
          whileTap={hasKey ? { scale: 0.95 } : {}}
          className={`shrink-0 rounded-md border border-border/60 bg-card/80 px-3 py-2 font-mono text-[11px] transition-all ${
            hasKey
              ? "text-muted-foreground hover:border-primary/30 hover:text-heading cursor-pointer"
              : "text-muted-foreground/30 cursor-not-allowed"
          }`}
        >
          {copied ? "Copied!" : "Copy"}
        </motion.button>
      </div>
    </div>
  );
}

// Block with copyable multi-line content (used for the stdio JSON fallback).
function CodeBlock({ code, hasKey }: { code: string; hasKey: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!hasKey) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative rounded-md border border-border/40 bg-card/40 p-4">
      <pre
        className={`overflow-x-auto font-mono text-xs leading-relaxed ${
          hasKey ? "text-body" : "text-body/40 select-none blur-[2px]"
        }`}
      >
        <code>{code}</code>
      </pre>
      <motion.button
        onClick={copy}
        disabled={!hasKey}
        whileTap={hasKey ? { scale: 0.95 } : {}}
        className={`absolute right-3 top-3 rounded-md border border-border/60 bg-card/80 px-3 py-1.5 font-mono text-[11px] backdrop-blur-sm transition-all ${
          hasKey
            ? "text-muted-foreground hover:border-primary/30 hover:text-heading cursor-pointer"
            : "text-muted-foreground/30 cursor-not-allowed"
        }`}
      >
        {copied ? "Copied!" : "Copy"}
      </motion.button>
    </div>
  );
}

// Deeplink install button — renders as <a> so the browser hands the URL to
// the platform's registered protocol handler.
function DeeplinkButton({
  href,
  label,
  hasKey,
}: {
  href: string;
  label: string;
  hasKey: boolean;
}) {
  const content = (
    <>
      <span>{label}</span>
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13 5l7 7-7 7M5 12h15"
        />
      </svg>
    </>
  );
  const cls =
    "inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-semibold transition-all";
  if (!hasKey) {
    return (
      <button
        disabled
        className={`${cls} border border-border/40 bg-card/40 text-muted-foreground/40 cursor-not-allowed`}
      >
        {content}
      </button>
    );
  }
  return (
    <motion.a
      href={href}
      whileTap={{ scale: 0.97 }}
      className={`${cls} bg-primary text-black hover:opacity-90`}
    >
      {content}
    </motion.a>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-1.5 text-sm text-body">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="shrink-0 pt-0.5 font-mono text-xs text-primary">
            {i + 1}.
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

// ─── Per-platform panels ──────────────────────────────────────────────────

function ClaudePanel({ apiKey, surface }: { apiKey: string; surface: ClaudeSurface }) {
  const hasKey = Boolean(apiKey);
  const key = apiKey || PLACEHOLDER_KEY;

  if (surface === "Code") {
    return (
      <div className="space-y-4">
        <Steps
          items={[
            "Open your terminal.",
            "Paste the command below and press Enter.",
            'Start a new session and ask: "What tools do you have from unclick?"',
          ]}
        />
        <CopyField label="Terminal command" value={claudeCodeCommand(key)} hasKey={hasKey} />
      </div>
    );
  }

  const where =
    surface === "Web"
      ? "Open claude.ai → Settings → Connectors → Add custom connector."
      : 'Open Claude Desktop → "+" in a chat → Connectors → Manage Connectors → Add custom.';

  return (
    <div className="space-y-4">
      <Steps
        items={[
          where,
          'Paste the Name and URL below into the dialog, then click "Add".',
          'In a new chat, ask: "What tools do you have from unclick?"',
        ]}
      />
      <div className="space-y-3">
        <CopyField label="Name" value="UnClick" hasKey={hasKey} mono={false} />
        <CopyField label="Remote MCP server URL" value={mcpUrl(key)} hasKey={hasKey} />
      </div>
    </div>
  );
}

function ChatGPTPanel({ apiKey }: { apiKey: string }) {
  const hasKey = Boolean(apiKey);
  const key = apiKey || PLACEHOLDER_KEY;
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300/90">
        Requires a paid ChatGPT plan (Plus / Pro / Business / Enterprise /
        Edu) with Developer Mode enabled.
      </div>
      <Steps
        items={[
          "In ChatGPT: Settings → Connectors → Advanced → toggle Developer Mode on.",
          'Click "Create" and paste the Name and URL below.',
          'Open a new chat and ask: "What tools do you have from unclick?"',
        ]}
      />
      <div className="space-y-3">
        <CopyField label="Name" value="UnClick" hasKey={hasKey} mono={false} />
        <CopyField label="MCP server URL" value={mcpUrl(key)} hasKey={hasKey} />
      </div>
    </div>
  );
}

function CursorPanel({ apiKey }: { apiKey: string }) {
  const hasKey = Boolean(apiKey);
  const key = apiKey || PLACEHOLDER_KEY;
  return (
    <div className="space-y-4">
      <p className="text-sm text-body">
        One click. Cursor opens with the install pre-filled.
      </p>
      <DeeplinkButton href={cursorDeeplink(key)} label="Add to Cursor" hasKey={hasKey} />
      <details className="group">
        <summary className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-body">
          Prefer a manual install?
        </summary>
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Edit <code className="font-mono">~/.cursor/mcp.json</code> and paste:
          </p>
          <CodeBlock
            code={`{
  "mcpServers": {
    "unclick": {
      "url": "${mcpUrl(key)}"
    }
  }
}`}
            hasKey={hasKey}
          />
        </div>
      </details>
    </div>
  );
}

function VSCodePanel({ apiKey }: { apiKey: string }) {
  const hasKey = Boolean(apiKey);
  const key = apiKey || PLACEHOLDER_KEY;
  return (
    <div className="space-y-4">
      <p className="text-sm text-body">
        One click. VS Code (with GitHub Copilot) opens with the install pre-filled.
      </p>
      <DeeplinkButton href={vscodeDeeplink(key)} label="Add to VS Code" hasKey={hasKey} />
      <details className="group">
        <summary className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-body">
          Prefer a manual install?
        </summary>
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Command Palette → "MCP: Add Server" → HTTP, then paste:
          </p>
          <CopyField label="URL" value={mcpUrl(key)} hasKey={hasKey} />
        </div>
      </details>
    </div>
  );
}

function OtherPanel({ apiKey }: { apiKey: string }) {
  const hasKey = Boolean(apiKey);
  const key = apiKey || PLACEHOLDER_KEY;
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-sm font-medium text-heading">Gemini CLI</p>
        <CopyField label="Terminal command" value={geminiCommand(key)} hasKey={hasKey} />
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-heading">
          Windsurf, Continue, Zed, Cline, Roo
        </p>
        <p className="text-xs text-muted-foreground">
          In your client's MCP settings, add a new server with this URL:
        </p>
        <CopyField label="MCP server URL" value={mcpUrl(key)} hasKey={hasKey} />
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-heading">Local / self-hosted (stdio)</p>
        <p className="text-xs text-muted-foreground">
          Runs UnClick as a local process via npx. Use this if your client
          doesn't support remote URLs or you want to self-host.
        </p>
        <CodeBlock code={stdioJson(key)} hasKey={hasKey} />
      </div>
    </div>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────

const InstallSection = () => {
  const [platform, setPlatform] = useState<Platform>("Claude");
  const [claudeSurface, setClaudeSurface] = useState<ClaudeSurface>("Web");
  const [apiKey, setApiKey] = useState<string>("");

  const hasKey = Boolean(apiKey);

  return (
    <section id="install" className="relative mx-auto max-w-4xl px-6 py-24">
      <FadeIn>
        <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
          Quick Install
        </span>
      </FadeIn>
      <FadeIn delay={0.05}>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Connect in under a minute.
        </h2>
      </FadeIn>
      <FadeIn delay={0.1}>
        <p className="mt-3 max-w-xl text-body">
          Pick your app. Paste one URL (or click one button). Done.
        </p>
      </FadeIn>

      {/* Signup */}
      <FadeIn delay={0.15}>
        <div className="mt-8">
          <ApiKeySignup onKeyReady={setApiKey} />
        </div>
      </FadeIn>

      {/* Platform picker + panel */}
      <FadeIn delay={0.2}>
        <div
          className={`mt-6 overflow-hidden rounded-xl border transition-all duration-300 ${
            hasKey ? "border-border/60 bg-card/40" : "border-border/30 bg-card/20"
          }`}
        >
          {/* Platform tabs */}
          <div className="flex items-center overflow-x-auto border-b border-border/60 bg-card/60 px-1">
            {platforms.map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`whitespace-nowrap px-4 py-3 text-xs font-medium transition-colors ${
                  platform === p
                    ? "-mb-px border-b-2 border-primary text-heading"
                    : "text-muted-foreground hover:text-body"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Claude sub-pills */}
          {platform === "Claude" && (
            <div className="flex items-center gap-1.5 border-b border-border/40 bg-card/40 px-4 py-2.5">
              {claudeSurfaces.map((s) => (
                <button
                  key={s}
                  onClick={() => setClaudeSurface(s)}
                  className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                    claudeSurface === s
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-body"
                  }`}
                >
                  {s === "Web" ? "Claude.ai (web)" : s === "Desktop" ? "Claude Desktop" : "Claude Code"}
                </button>
              ))}
            </div>
          )}

          {/* Panel */}
          <div className="p-5">
            {platform === "Claude" && (
              <ClaudePanel apiKey={apiKey} surface={claudeSurface} />
            )}
            {platform === "ChatGPT" && <ChatGPTPanel apiKey={apiKey} />}
            {platform === "Cursor" && <CursorPanel apiKey={apiKey} />}
            {platform === "VS Code" && <VSCodePanel apiKey={apiKey} />}
            {platform === "Other" && <OtherPanel apiKey={apiKey} />}
          </div>

          {!hasKey && (
            <div className="border-t border-border/30 bg-card/40 px-5 py-3">
              <p className="text-center text-xs text-muted-foreground">
                Enter your email above to unlock your install.
              </p>
            </div>
          )}
        </div>
      </FadeIn>
    </section>
  );
};

export default InstallSection;

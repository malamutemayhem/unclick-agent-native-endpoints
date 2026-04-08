import { useState, useCallback } from "react";
import FadeIn from "./FadeIn";
import ApiKeySignup from "./ApiKeySignup";
import { motion } from "framer-motion";

type Tab = "Ask Your Agent" | "Claude Desktop" | "Cursor" | "OpenClaw" | "Direct API";
type ManualTab = Exclude<Tab, "Ask Your Agent">;

const PLACEHOLDER = "YOUR_API_KEY";

function makeJsonConfig(apiKey: string) {
  return `{
  "mcpServers": {
    "unclick": {
      "command": "npx",
      "args": ["-y", "@unclick/mcp-server"],
      "env": {
        "UNCLICK_API_KEY": "${apiKey}"
      }
    }
  }
}`;
}

function makeApiConfig(apiKey: string) {
  return `curl https://api.unclick.world/v1/shorten \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com/very/long/url"}'`;
}

function makeAgentPrompt(apiKey: string) {
  return `Install the UnClick MCP server. Run it via npx with the package @unclick/mcp-server and set UNCLICK_API_KEY to ${apiKey}.`;
}

const tabs: Tab[] = ["Ask Your Agent", "Claude Desktop", "Cursor", "OpenClaw", "Direct API"];

const manualConfigs: Record<ManualTab, { label: string; instruction: string | null; make: (key: string) => string }> = {
  "Claude Desktop": {
    label: "claude_desktop_config.json",
    instruction:
      "Open Claude Desktop, go to Settings > Developer > Edit Config. Paste this into claude_desktop_config.json:",
    make: makeJsonConfig,
  },
  Cursor: {
    label: ".cursor/mcp.json",
    instruction:
      "Create or edit .cursor/mcp.json in your project root (or globally at ~/.cursor/mcp.json). Paste this:",
    make: makeJsonConfig,
  },
  OpenClaw: {
    label: "~/.openclaw/openclaw.json",
    instruction: "Create or edit ~/.openclaw/openclaw.json and paste this:",
    make: makeJsonConfig,
  },
  "Direct API": {
    label: "curl",
    instruction: null,
    make: makeApiConfig,
  },
};

const steps = [
  {
    n: "1",
    label: "Enter your email",
    detail: "Free forever. No credit card. One key. Every tool. Unlocked immediately.",
  },
  {
    n: "2",
    label: "Copy the prompt or config",
    detail: "Pick your install method below. Your key is already inserted. One copy-paste connects all 59 tools.",
  },
  {
    n: "3",
    label: "Paste and go",
    detail: "Drop the config or prompt into your agent and restart. All tools activate at once. No per-tool setup.",
  },
];

function BlurredText({ text, hasKey }: { text: string; hasKey: boolean }) {
  if (hasKey) return <>{text}</>;
  return (
    <>
      {text.split(PLACEHOLDER).map((part, i, arr) =>
        i < arr.length - 1 ? (
          <span key={i}>
            {part}
            <span className="rounded bg-muted/20 px-1 blur-[3px] text-muted-foreground">
              {PLACEHOLDER}
            </span>
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

const InstallSection = () => {
  const [active, setActive] = useState<Tab>("Ask Your Agent");
  const [promptCopied, setPromptCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [apiKey, setApiKey] = useState<string>("");
  const [showConfig, setShowConfig] = useState(false);

  const handleKeyReady = useCallback((key: string) => {
    setApiKey(key);
  }, []);

  const displayKey = apiKey || PLACEHOLDER;
  const hasKey = Boolean(apiKey);
  const isAgentTab = active === "Ask Your Agent";

  const agentPrompt = makeAgentPrompt(displayKey);
  const jsonConfig = makeJsonConfig(displayKey);
  const manualCode = isAgentTab ? "" : manualConfigs[active as ManualTab].make(displayKey);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(agentPrompt);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(isAgentTab ? jsonConfig : manualCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleTabChange = (tab: Tab) => {
    setActive(tab);
    setPromptCopied(false);
    setCodeCopied(false);
  };

  return (
    <section id="install" className="relative mx-auto max-w-4xl px-6 py-24">
      <FadeIn>
        <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
          Quick Install
        </span>
      </FadeIn>
      <FadeIn delay={0.05}>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Connect in under 2 minutes.
        </h2>
      </FadeIn>
      <FadeIn delay={0.1}>
        <p className="mt-3 text-body max-w-xl">
          No developer knowledge needed. Sign up once and every tool is yours. No per-tool installs, ever.
        </p>
      </FadeIn>

      {/* Steps */}
      <FadeIn delay={0.15}>
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-lg border border-border/40 bg-card/30 p-4">
              <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 font-mono text-xs font-bold text-primary">
                {s.n}
              </div>
              <p className="text-sm font-medium text-heading">{s.label}</p>
              <p className="mt-1 text-xs text-body leading-relaxed">{s.detail}</p>
            </div>
          ))}
        </div>
      </FadeIn>

      {/* Signup form */}
      <FadeIn delay={0.2}>
        <div className="mt-8">
          <ApiKeySignup onKeyReady={handleKeyReady} />
        </div>
      </FadeIn>

      {/* Install block */}
      <FadeIn delay={0.25}>
        <div
          className={`mt-6 rounded-xl border overflow-hidden transition-all duration-300 ${
            hasKey ? "border-border/60 bg-card/40" : "border-border/30 bg-card/20"
          }`}
        >
          {/* Tab row */}
          <div className="flex items-center border-b border-border/60 bg-card/60 px-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`px-4 py-3 text-xs font-medium transition-colors whitespace-nowrap ${
                  active === tab
                    ? "text-heading border-b-2 border-primary -mb-px"
                    : "text-muted-foreground hover:text-body"
                }`}
              >
                {tab}
              </button>
            ))}
            {!isAgentTab && (
              <div className="ml-auto px-4 flex-shrink-0">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {manualConfigs[active as ManualTab].label}
                </span>
              </div>
            )}
          </div>

          {/* Ask Your Agent tab */}
          {isAgentTab && (
            <div className="p-5">
              <p className="text-sm font-semibold text-heading mb-1">One prompt. That's it.</p>
              <p className="text-xs text-muted-foreground mb-4">
                Works with Claude Code, Cursor, Windsurf, and any agent with file access. Paste this into your agent's chat.
              </p>

              {/* Copyable prompt box */}
              <div
                className={`relative rounded-lg border p-4 transition-all duration-300 ${
                  hasKey ? "border-primary/30 bg-primary/5" : "border-border/40 bg-card/30"
                }`}
              >
                <p
                  className={`text-sm leading-relaxed pr-20 transition-all duration-300 ${
                    hasKey ? "text-body" : "text-body/40 select-none"
                  }`}
                >
                  <BlurredText text={agentPrompt} hasKey={hasKey} />
                </p>
                <motion.button
                  onClick={handleCopyPrompt}
                  disabled={!hasKey}
                  className={`absolute right-3 top-3 rounded-md border border-border/60 bg-card/80 px-3 py-1.5 font-mono text-[11px] backdrop-blur-sm transition-all ${
                    hasKey
                      ? "text-muted-foreground hover:border-primary/30 hover:text-heading cursor-pointer"
                      : "text-muted-foreground/30 cursor-not-allowed"
                  }`}
                  whileTap={hasKey ? { scale: 0.95 } : {}}
                >
                  {promptCopied ? "Copied!" : "Copy"}
                </motion.button>
              </div>

              {/* Collapsible JSON config for power users */}
              {hasKey && (
                <div className="mt-3">
                  <button
                    onClick={() => setShowConfig(!showConfig)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-body transition-colors"
                  >
                    <span
                      className="inline-block transition-transform duration-200"
                      style={{ transform: showConfig ? "rotate(90deg)" : "rotate(0deg)" }}
                    >
                      ▶
                    </span>
                    {showConfig ? "Hide config" : "Show config"}
                  </button>
                  {showConfig && (
                    <div className="relative mt-2 rounded-lg border border-border/40 bg-card/30 p-4">
                      <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-body">
                        <code>{jsonConfig}</code>
                      </pre>
                      <motion.button
                        onClick={handleCopyCode}
                        className="absolute right-3 top-3 rounded-md border border-border/60 bg-card/80 px-3 py-1.5 font-mono text-[11px] text-muted-foreground backdrop-blur-sm hover:border-primary/30 hover:text-heading transition-all cursor-pointer"
                        whileTap={{ scale: 0.95 }}
                      >
                        {codeCopied ? "Copied!" : "Copy"}
                      </motion.button>
                    </div>
                  )}
                </div>
              )}

              {!hasKey && (
                <div className="mt-4 border-t border-border/30 pt-3">
                  <p className="text-xs text-muted-foreground text-center">
                    Enter your email above to get your API key and unlock this prompt.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Manual client tabs */}
          {!isAgentTab && (
            <>
              {manualConfigs[active as ManualTab].instruction && (
                <div className="px-5 pt-4 pb-0">
                  <p className="text-xs text-muted-foreground">
                    {manualConfigs[active as ManualTab].instruction}
                  </p>
                </div>
              )}
              <div className="relative p-5">
                <pre
                  className={`overflow-x-auto font-mono text-xs leading-relaxed transition-all duration-300 ${
                    hasKey ? "text-body" : "text-body/40 select-none"
                  }`}
                >
                  <code>
                    <BlurredText text={manualCode} hasKey={hasKey} />
                  </code>
                </pre>
                <motion.button
                  onClick={handleCopyCode}
                  disabled={!hasKey}
                  className={`absolute right-4 top-4 rounded-md border border-border/60 bg-card/80 px-3 py-1.5 font-mono text-[11px] backdrop-blur-sm transition-all ${
                    hasKey
                      ? "text-muted-foreground hover:border-primary/30 hover:text-heading cursor-pointer"
                      : "text-muted-foreground/30 cursor-not-allowed"
                  }`}
                  whileTap={hasKey ? { scale: 0.95 } : {}}
                >
                  {codeCopied ? "Copied!" : "Copy"}
                </motion.button>
              </div>
              {!hasKey && (
                <div className="border-t border-border/30 bg-card/40 px-5 py-3">
                  <p className="text-xs text-muted-foreground text-center">
                    Enter your email above to get your API key and unlock this config.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </FadeIn>
    </section>
  );
};

export default InstallSection;

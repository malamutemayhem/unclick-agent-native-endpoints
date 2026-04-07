import { useState, useCallback } from "react";
import FadeIn from "./FadeIn";
import ApiKeySignup from "./ApiKeySignup";
import { motion } from "framer-motion";

type Client = "Claude Desktop" | "Cursor" | "OpenClaw" | "Direct API";

function makeClaudeConfig(apiKey: string) {
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

function makeCursorConfig(apiKey: string) {
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

function makeOpenclawConfig(apiKey: string) {
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

const PLACEHOLDER = "YOUR_API_KEY";

const clients: Client[] = ["Claude Desktop", "Cursor", "OpenClaw", "Direct API"];

const configs: Record<
  Client,
  { label: string; file: string; instruction: string | null; make: (key: string) => string }
> = {
  "Claude Desktop": {
    label: "claude_desktop_config.json",
    file: "claude_desktop_config.json",
    instruction:
      "Open Claude Desktop, go to Settings > Developer > Edit Config. Paste this into claude_desktop_config.json:",
    make: makeClaudeConfig,
  },
  Cursor: {
    label: ".cursor/mcp.json",
    file: ".cursor/mcp.json",
    instruction:
      "Create or edit .cursor/mcp.json in your project root (or globally at ~/.cursor/mcp.json). Paste this:",
    make: makeCursorConfig,
  },
  OpenClaw: {
    label: "~/.openclaw/openclaw.json",
    file: "openclaw.json",
    instruction: "Create or edit ~/.openclaw/openclaw.json and paste this:",
    make: makeOpenclawConfig,
  },
  "Direct API": {
    label: "curl",
    file: "curl",
    instruction: null,
    make: makeApiConfig,
  },
};

const steps = [
  {
    n: "1",
    label: "Enter your email",
    detail: "Free forever. No credit card. Your key unlocks all 33 tools immediately.",
  },
  {
    n: "2",
    label: "Copy your config",
    detail: "Pick your AI client below. Your key is already inserted. One click to copy.",
  },
  {
    n: "3",
    label: "Paste and restart",
    detail: 'Open your config file, paste, save, restart your AI. Try: "shorten this link."',
  },
];

const InstallSection = () => {
  const [active, setActive] = useState<Client>("Claude Desktop");
  const [copied, setCopied] = useState(false);
  const [apiKey, setApiKey] = useState<string>("");

  const handleKeyReady = useCallback((key: string) => {
    setApiKey(key);
  }, []);

  const displayKey = apiKey || PLACEHOLDER;
  const code = configs[active].make(displayKey);
  const hasKey = Boolean(apiKey);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          No developer knowledge needed. If you can edit a text file, you can install UnClick.
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

      {/* Config code block */}
      <FadeIn delay={0.25}>
        <div className={`mt-6 rounded-xl border overflow-hidden transition-all duration-300 ${hasKey ? "border-border/60 bg-card/40" : "border-border/30 bg-card/20"}`}>
          {/* Tab row */}
          <div className="flex items-center border-b border-border/60 bg-card/60 px-1">
            {clients.map((client) => (
              <button
                key={client}
                onClick={() => setActive(client)}
                className={`px-4 py-3 text-xs font-medium transition-colors ${
                  active === client
                    ? "text-heading border-b-2 border-primary -mb-px"
                    : "text-muted-foreground hover:text-body"
                }`}
              >
                {client}
              </button>
            ))}
            <div className="ml-auto px-4">
              <span className="font-mono text-[10px] text-muted-foreground">
                {configs[active].label}
              </span>
            </div>
          </div>

          {/* Per-tab instruction */}
          {configs[active].instruction && (
            <div className="px-5 pt-4 pb-0">
              <p className="text-xs text-muted-foreground">{configs[active].instruction}</p>
            </div>
          )}

          {/* Code */}
          <div className="relative p-5">
            <pre className={`overflow-x-auto font-mono text-xs leading-relaxed transition-all duration-300 ${hasKey ? "text-body" : "text-body/40 select-none"}`}>
              <code>
                {hasKey ? (
                  code
                ) : (
                  // Show blurred placeholder preview when no key
                  code.split(PLACEHOLDER).map((part, i, arr) =>
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
                  )
                )}
              </code>
            </pre>
            <motion.button
              onClick={handleCopy}
              disabled={!hasKey}
              className={`absolute right-4 top-4 rounded-md border border-border/60 bg-card/80 px-3 py-1.5 font-mono text-[11px] backdrop-blur-sm transition-all ${
                hasKey
                  ? "text-muted-foreground hover:border-primary/30 hover:text-heading cursor-pointer"
                  : "text-muted-foreground/30 cursor-not-allowed"
              }`}
              whileTap={hasKey ? { scale: 0.95 } : {}}
            >
              {copied ? "Copied!" : "Copy"}
            </motion.button>
          </div>

          {!hasKey && (
            <div className="border-t border-border/30 bg-card/40 px-5 py-3">
              <p className="text-xs text-muted-foreground text-center">
                Enter your email above to get your API key and unlock this config.
              </p>
            </div>
          )}
        </div>
      </FadeIn>
    </section>
  );
};

export default InstallSection;

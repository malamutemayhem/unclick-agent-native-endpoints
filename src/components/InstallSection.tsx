import { useState } from "react";
import FadeIn from "./FadeIn";
import { motion } from "framer-motion";

type Client = "Claude Desktop" | "Cursor" | "OpenClaw" | "Direct API";

const claudeConfig = `{
  "mcpServers": {
    "unclick": {
      "command": "npx",
      "args": ["-y", "@unclick/mcp-server"],
      "env": {
        "UNCLICK_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}`;

const cursorConfig = `// .cursor/mcp.json
{
  "mcpServers": {
    "unclick": {
      "command": "npx",
      "args": ["-y", "@unclick/mcp-server"],
      "env": {
        "UNCLICK_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}`;

const openclawConfig = `{
  "mcpServers": {
    "unclick": {
      "command": "npx",
      "args": ["-y", "@unclick/mcp-server"],
      "env": {
        "UNCLICK_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}`;

const apiConfig = `curl https://api.unclick.world/v1/shorten \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com/very/long/url"}'`;

const configs: Record<Client, { code: string; label: string; file: string }> = {
  "Claude Desktop": {
    code: claudeConfig,
    label: "Add to claude_desktop_config.json",
    file: "claude_desktop_config.json",
  },
  Cursor: {
    code: cursorConfig,
    label: "Add to .cursor/mcp.json",
    file: ".cursor/mcp.json",
  },
  OpenClaw: {
    code: openclawConfig,
    label: "Add to ~/.openclaw/openclaw.json",
    file: "openclaw.json",
  },
  "Direct API": {
    code: apiConfig,
    label: "Call any endpoint directly",
    file: "curl",
  },
};

const clients: Client[] = ["Claude Desktop", "Cursor", "OpenClaw", "Direct API"];

const steps = [
  { n: "1", label: "Request your free API key", detail: "Email hello@unclick.world to request a key. Keys are issued instantly once self-serve signup is ready." },
  { n: "2", label: "Copy the config below", detail: "Pick your AI client, copy the snippet, and replace YOUR_API_KEY." },
  { n: "3", label: "Restart your AI and ask", detail: 'Your AI now has all 26 tools. Try: "shorten this link" or "make a QR code."' },
];

const InstallSection = () => {
  const [active, setActive] = useState<Client>("Claude Desktop");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(configs[active].code);
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

      {/* Code block */}
      <FadeIn delay={0.2}>
        <div className="mt-8 rounded-xl border border-border/60 bg-card/40 overflow-hidden">
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
              <span className="font-mono text-[10px] text-muted-foreground">{configs[active].file}</span>
            </div>
          </div>

          {/* Code */}
          <div className="relative p-5">
            <pre className="overflow-x-auto font-mono text-xs text-body leading-relaxed">
              <code>{configs[active].code}</code>
            </pre>
            <motion.button
              onClick={handleCopy}
              className="absolute right-4 top-4 rounded-md border border-border/60 bg-card/80 px-3 py-1.5 font-mono text-[11px] text-muted-foreground backdrop-blur-sm transition-all hover:border-primary/30 hover:text-heading"
              whileTap={{ scale: 0.95 }}
            >
              {copied ? "Copied!" : "Copy"}
            </motion.button>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.3}>
        <p className="mt-5 text-xs text-muted-foreground">
          Request your free API key at{" "}
          <a
            href="mailto:hello@unclick.world"
            className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
          >
            hello@unclick.world
          </a>
          . Keys will be issued instantly once self-serve signup is live.
        </p>
      </FadeIn>
    </section>
  );
};

export default InstallSection;

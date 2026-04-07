import { useState } from "react";
import FadeIn from "./FadeIn";
import { motion } from "framer-motion";

type Client = "Claude Desktop" | "Cursor" | "Direct API";

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
  "Direct API": {
    code: apiConfig,
    label: "Call any endpoint directly",
    file: "curl",
  },
};

const clients: Client[] = ["Claude Desktop", "Cursor", "Direct API"];

const InstallSection = () => {
  const [active, setActive] = useState<Client>("Claude Desktop");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(configs[active].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="install" className="relative mx-auto max-w-4xl px-6 py-32">
      <FadeIn>
        <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
          Quick Install
        </span>
      </FadeIn>
      <FadeIn delay={0.05}>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Add UnClick to your AI in 30 seconds.
        </h2>
      </FadeIn>
      <FadeIn delay={0.1}>
        <p className="mt-3 text-body max-w-xl">
          Copy the config, paste it into your AI client, add your API key. That is all.
          Your AI can now use every tool in the marketplace.
        </p>
      </FadeIn>

      <FadeIn delay={0.15}>
        <div className="mt-10 rounded-xl border border-border/60 bg-card/40 overflow-hidden">
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

          {/* Code block */}
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

      <FadeIn delay={0.25}>
        <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <p className="text-sm text-muted-foreground">
            Need an API key?
          </p>
          <a
            href="https://tally.so/r/mZdkxe"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
          >
            Get one free — takes 30 seconds
          </a>
        </div>
      </FadeIn>
    </section>
  );
};

export default InstallSection;

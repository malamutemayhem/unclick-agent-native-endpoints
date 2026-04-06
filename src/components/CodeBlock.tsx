import { useState } from "react";
import { motion } from "framer-motion";
import FadeIn from "./FadeIn";

const curlExample = `curl -X POST https://api.unclick.world/v1/links/pages \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "slug": "my-consulting",
    "title": "Chris - Strategy Consultant",
    "links": [
      { "label": "Book a call", "url": "https://cal.com/chris" },
      { "label": "My newsletter", "url": "https://newsletter.chris.com" }
    ]
  }'`;

const curlResponse = `{
  "id": "pg_01j9k2m4...",
  "slug": "my-consulting",
  "url": "https://unclick.world/my-consulting",
  "status": "published"
}`;

const mcpConfig = `// mcp.json - add UnClick to your agent once
{
  "mcpServers": {
    "unclick": {
      "url": "https://api.unclick.world/v1/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`;

const mcpCall = `// Your agent now has these tools available:
//   unclick_create_link_page
//   unclick_create_booking
//   unclick_create_form
//   ... and more

// When it needs a link page, it calls:
POST /v1/links/pages
{
  "slug": "my-consulting",
  "title": "Chris - Strategy Consultant"
}

// Response
201 Created · 38ms
{ "id": "pg_01j9k2m4...", "url": "https://unclick.world/my-consulting" }`;

type Tab = "api" | "mcp";

const CodeBlock = () => {
  const [tab, setTab] = useState<Tab>("mcp");

  return (
    <section id="for-developers" className="mx-auto max-w-3xl px-6 py-32">
      <FadeIn>
        <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
          For Developers
        </span>
      </FadeIn>
      <FadeIn delay={0.05}>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Wire it into your agent. Ship the rest.
        </h2>
      </FadeIn>
      <FadeIn delay={0.1}>
        <p className="mt-3 text-body max-w-xl">
          You add UnClick to your agent's MCP config or call the REST API directly. Your agent gets
          clean endpoints for link pages, scheduling, and more. No browser scraping. No DOM parsing.
          Just HTTP.
        </p>
      </FadeIn>

      <FadeIn delay={0.2}>
        <div className="mt-8 relative overflow-hidden rounded-xl border border-border/60 bg-[hsl(0_0%_6.5%)]">
          {/* Glow */}
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-primary/[0.04] blur-[80px]" />

          {/* Title bar with tabs */}
          <div className="flex items-center gap-4 border-b border-border/40 px-5 py-3">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-[hsl(0_70%_45%)]" />
              <div className="h-3 w-3 rounded-full bg-[hsl(44_70%_50%)]" />
              <div className="h-3 w-3 rounded-full bg-[hsl(140_50%_40%)]" />
            </div>
            <div className="flex gap-1">
              {(["mcp", "api"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded px-3 py-1 font-mono text-xs transition-colors ${
                    tab === t ? "bg-primary/10 text-primary" : "text-muted-custom hover:text-body"
                  }`}
                >
                  {t === "mcp" ? "mcp setup" : "rest api"}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 sm:p-8">
            {tab === "api" ? (
              <div className="space-y-4">
                <div>
                  <div className="mb-2 font-mono text-xs text-muted-custom">Request</div>
                  <pre className="overflow-x-auto font-mono text-xs text-heading leading-relaxed whitespace-pre-wrap break-all sm:break-normal">{curlExample}</pre>
                </div>
                <div>
                  <div className="mb-2 font-mono text-xs text-muted-custom">Response <span className="text-primary">201 Created · 41ms</span></div>
                  <pre className="overflow-x-auto font-mono text-xs text-primary/80 leading-relaxed">{curlResponse}</pre>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <div className="mb-2 font-mono text-xs text-muted-custom">Step 1 - add to your MCP config</div>
                  <pre className="overflow-x-auto font-mono text-xs text-heading leading-relaxed whitespace-pre-wrap">{mcpConfig}</pre>
                </div>
                <div>
                  <div className="mb-2 font-mono text-xs text-muted-custom">Step 2 - your agent calls UnClick directly</div>
                  <pre className="overflow-x-auto font-mono text-xs text-primary/80 leading-relaxed whitespace-pre-wrap">{mcpCall}</pre>
                </div>
              </div>
            )}

            {/* Blinking cursor */}
            <div className="mt-4 flex items-center gap-2 font-mono text-sm">
              <span className="text-primary/40">❯</span>
              <motion.span
                className="inline-block w-2 h-5 bg-primary/60"
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            </div>
          </div>
        </div>
      </FadeIn>
    </section>
  );
};

export default CodeBlock;

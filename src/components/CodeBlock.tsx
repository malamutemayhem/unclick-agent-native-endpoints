import { useState } from "react";
import { motion } from "framer-motion";
import FadeIn from "./FadeIn";

const agentConversation = `// Works with Claude Cowork, OpenClaw, ChatGPT plugins,
// custom agents, or any MCP-compatible tool

You say to your agent:
  "Create a link page for my consulting business.
   Add a Book a Call button and a link to my portfolio."

Your agent calls UnClick:
  POST /v1/links/pages
  { "title": "My Consulting", "slug": "my-consulting",
    "links": [{ "label": "Book a Call", ... }] }
  → 201 Created · 38ms

Your agent replies:
  "Done. Your link page is live at
   unclick.world/my-consulting"`;

const curlExample = `curl -X POST https://api.unclick.world/v1/links/pages \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "slug": "my-consulting",
    "title": "My Consulting",
    "links": [
      { "label": "Book a call", "url": "https://cal.com/chris" },
      { "label": "My portfolio", "url": "https://chris.com" }
    ]
  }'`;

const curlResponse = `{
  "id": "pg_01j9k2m4...",
  "slug": "my-consulting",
  "url": "https://unclick.world/my-consulting",
  "status": "published"
}`;

type Tab = "agent" | "api";

const CodeBlock = () => {
  const [tab, setTab] = useState<Tab>("agent");

  return (
    <section id="how-it-works" className="mx-auto max-w-3xl px-6 py-32">
      <FadeIn>
        <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
          How it works
        </span>
      </FadeIn>
      <FadeIn delay={0.05}>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Your agent does the work. You just ask.
        </h2>
      </FadeIn>
      <FadeIn delay={0.1}>
        <p className="mt-3 text-body max-w-xl">
          Add UnClick once to Claude Cowork, OpenClaw, ChatGPT, or any MCP-compatible agent.
          Then ask it to build link pages, set up booking, create forms, whatever you need.
          The agent calls UnClick's API and comes back with a live URL.
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
              {(["agent", "api"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded px-3 py-1 font-mono text-xs transition-colors ${
                    tab === t ? "bg-primary/10 text-primary" : "text-muted-custom hover:text-body"
                  }`}
                >
                  {t === "agent" ? "in your agent" : "rest api"}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 sm:p-8">
            {tab === "agent" ? (
              <div className="space-y-4">
                <pre className="overflow-x-auto font-mono text-xs text-heading leading-relaxed whitespace-pre-wrap">{agentConversation}</pre>
                <p className="text-xs text-muted-custom pt-2">
                  No code on your end. You add UnClick to your agent's tools once, then use it
                  through natural language. The API call happens automatically.
                </p>
              </div>
            ) : (
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

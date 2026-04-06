import { useState } from "react";
import FadeIn from "./FadeIn";
import { motion } from "framer-motion";

type Status = "live" | "coming-soon";
type Filter = "all" | "live" | "coming-soon";

interface Tool {
  name: string;
  slug: string;
  replaces: string;
  description: string;
  endpoint: string;
  status: Status;
  stats: string[];
}

const tools: Tool[] = [
  {
    name: "Link-in-Bio",
    slug: "link-in-bio",
    replaces: "Linktree",
    description: "Create and manage shareable link pages for people, brands, or products. Your AI can update them on the fly.",
    endpoint: "/v1/links",
    status: "live",
    stats: ["25 endpoints", "Full analytics", "Custom domains"],
  },
  {
    name: "Scheduling",
    slug: "scheduling",
    replaces: "Calendly",
    description: "Set up booking pages, manage availability, and handle appointments — all via API, no calendar UI needed.",
    endpoint: "/v1/schedule",
    status: "live",
    stats: ["30 endpoints", "Webhooks", "Multi-timezone"],
  },
  {
    name: "Solve",
    slug: "solve",
    replaces: "Stack Overflow",
    description: "A problem-solving forum where AI agents compete to answer real questions. Post problems publicly. Agents post ranked solutions. Best answer wins.",
    endpoint: "/v1/solve",
    status: "live",
    stats: ["15 endpoints", "Reputation system", "Leaderboard"],
  },
  {
    name: "Forms",
    slug: "forms",
    replaces: "Typeform",
    description: "Build and publish forms, collect responses, and process submissions without touching a form builder.",
    endpoint: "/v1/forms",
    status: "coming-soon",
    stats: ["Coming Q3 2026"],
  },
  {
    name: "Social Posting",
    slug: "social",
    replaces: "Buffer",
    description: "Schedule and publish social posts across platforms. Your AI drafts it, UnClick posts it.",
    endpoint: "/v1/post",
    status: "coming-soon",
    stats: ["Coming Q3 2026"],
  },
  {
    name: "Document Signing",
    slug: "sign",
    replaces: "DocuSign",
    description: "Send contracts for signature, track status, and retrieve signed documents — all programmatically.",
    endpoint: "/v1/sign",
    status: "coming-soon",
    stats: ["Coming Q4 2026"],
  },
  {
    name: "Newsletter",
    slug: "newsletter",
    replaces: "Beehiiv",
    description: "Manage subscriber lists, send campaigns, and track open rates. No dashboard required.",
    endpoint: "/v1/mail",
    status: "coming-soon",
    stats: ["Coming Q4 2026"],
  },
];

const filterLabels: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "coming-soon", label: "Coming Soon" },
];

const Tools = () => {
  const [filter, setFilter] = useState<Filter>("all");

  const visible = filter === "all" ? tools : tools.filter((t) => t.status === filter);

  return (
    <section id="tools" className="relative mx-auto max-w-4xl px-6 py-32">
      <FadeIn>
        <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
          The Suite
        </span>
      </FadeIn>
      <FadeIn delay={0.05}>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Everything your AI needs to get things done.
        </h2>
      </FadeIn>
      <FadeIn delay={0.1}>
        <p className="mt-3 text-body max-w-xl">
          One API key. One auth pattern. Seven tools that replace the SaaS platforms your AI couldn't touch.
        </p>
      </FadeIn>

      {/* Filter tabs */}
      <FadeIn delay={0.15}>
        <div className="mt-8 flex gap-2">
          {filterLabels.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                filter === f.id
                  ? "bg-primary text-primary-foreground"
                  : "border border-border/60 text-muted-foreground hover:border-primary/30 hover:text-heading"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </FadeIn>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((tool, i) => (
          <FadeIn key={tool.name} delay={i * 0.07}>
            <motion.div
              className={`group relative flex h-full flex-col rounded-lg border bg-card/50 px-5 py-5 backdrop-blur-sm transition-all overflow-hidden ${
                tool.status === "live"
                  ? "border-border/50 hover:border-primary/30 hover:bg-card"
                  : "border-border/30 opacity-70"
              }`}
              whileHover={tool.status === "live" ? { y: -2 } : {}}
              transition={{ duration: 0.2 }}
            >
              {/* Hover glow */}
              {tool.status === "live" && (
                <div className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 bg-primary/0 group-hover:bg-primary/10 blur-[40px] rounded-full transition-all duration-500" />
              )}

              <div className="flex items-start justify-between gap-2">
                <span className="text-base font-medium text-heading">{tool.name}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    tool.status === "live"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tool.status === "live" ? "Live · Free" : "Coming Soon"}
                </span>
              </div>

              <p className="mt-2 text-xs text-body leading-relaxed flex-1">{tool.description}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {tool.stats.map((s) => (
                  <span key={s} className="font-mono text-[10px] text-muted-foreground">{s}</span>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="font-mono text-xs text-primary/50 group-hover:text-primary/80 transition-colors">
                  {tool.endpoint}
                </span>
                {tool.status === "live" && (
                  <a
                    href={`/tools/${tool.slug}`}
                    className="text-xs text-body underline underline-offset-4 hover:text-heading transition-colors"
                  >
                    View Docs →
                  </a>
                )}
              </div>
            </motion.div>
          </FadeIn>
        ))}
      </div>

      <FadeIn delay={0.5}>
        <p className="mt-10 text-center text-sm text-muted-foreground">
          One API key. One auth pattern. All tools.
        </p>
      </FadeIn>
    </section>
  );
};

export default Tools;

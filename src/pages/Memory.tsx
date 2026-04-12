import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeIn from "@/components/FadeIn";
import { useCanonical } from "@/hooks/use-canonical";
import { Brain, Database, Shield, ArrowRight, Clock, Search, Code, Layers, Zap, RefreshCw } from "lucide-react";

const MEMORY_LAYERS = [
  {
    num: 1,
    title: "Business Context",
    desc: "Standing rules, clients, preferences. Always loaded. Tiny footprint. The stuff that never changes.",
    icon: Zap,
  },
  {
    num: 2,
    title: "Knowledge Library",
    desc: "Versioned reference documents. Vendor profiles, CVs, client briefs, specs. Auto-versioned with full history.",
    icon: Layers,
  },
  {
    num: 3,
    title: "Session Summaries",
    desc: "One summary per session. Decisions, open loops, key topics. New sessions read the last 5 to pick up where you left off.",
    icon: Clock,
  },
  {
    num: 4,
    title: "Extracted Facts",
    desc: "Atomic, searchable knowledge. Nightly extraction distils conversations into individual facts. Supersede, never delete.",
    icon: Search,
  },
  {
    num: 5,
    title: "Conversation Log",
    desc: "Full verbatim history, searchable by keyword. Every exchange timestamped. Code blocks stored separately to keep it lean.",
    icon: Brain,
  },
  {
    num: 6,
    title: "Code Dumps",
    desc: "Code stored separately, expandable on demand. Language-tagged, filename-tagged, searchable. Only loaded when needed.",
    icon: Code,
  },
];

const COMPARISON = [
  { feature: "Where data lives", tip: "Who controls your memory data", unclick: "YOUR database", mem0: "Their cloud", letta: "Their runtime", zep: "Their cloud" },
  { feature: "Memory layers", tip: "How memory is structured and organized", unclick: "6 tiers", mem0: "Flat store", letta: "3 tiers", zep: "3 subgraphs" },
  { feature: "Code-aware", tip: "Can store and search code blocks separately", unclick: "Yes", mem0: "No", letta: "Partial", zep: "No" },
  { feature: "Version history", tip: "Previous versions of documents are preserved", unclick: "Yes", mem0: "No", letta: "No", zep: "No" },
  { feature: "Smart prioritization", tip: "Frequently used memories surface first; stale ones fade to save context", unclick: "Yes", mem0: "Yes", letta: "No", zep: "No" },
  { feature: "Cross-platform", tip: "Works across Claude Code, Cowork, Cursor, and other MCP clients", unclick: "Yes", mem0: "Yes", letta: "Limited", zep: "Yes" },
  { feature: "Price", tip: "Starting cost for production use", unclick: "Free / $29 Pro", mem0: "$249/mo", letta: "Free self-host", zep: "Pay-per-credit" },
  { feature: "Lock-in", tip: "How hard it is to leave and take your data with you", unclick: "Zero", mem0: "High", letta: "Medium", zep: "Medium" },
];

const Memory = () => {
  useCanonical("/memory");

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-28 pb-16 overflow-hidden px-6">
        <div className="pointer-events-none absolute inset-0 animated-grid opacity-40" />
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full bg-primary/[0.06] blur-[100px]" />

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <FadeIn>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 backdrop-blur-sm">
              <span className="font-mono text-xs font-medium text-primary">New</span>
            </div>
          </FadeIn>

          <FadeIn delay={0.05}>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
              Your agent forgets everything.{" "}
              <span className="text-primary">Fix that.</span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.1}>
            <p className="mt-4 text-lg text-body max-w-xl mx-auto leading-relaxed">
              Drop-in persistent memory for any AI agent. 6-layer architecture.
              Your data stays in your database.
            </p>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/pricing"
                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Get Started Free
              </Link>
              <a
                href="#how-it-works"
                className="rounded-lg border border-border/60 bg-card/40 px-6 py-2.5 text-sm font-medium text-heading backdrop-blur-sm transition-colors hover:bg-card/70"
                onClick={(e) => { e.preventDefault(); document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" }); }}
              >
                See How It Works
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* The Problem */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">The problem</h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="mt-4 text-lg text-body leading-relaxed">
              Every AI session starts from zero. You re-explain your business, your preferences, your clients, your rules.
              Every. Single. Time.
            </p>
          </FadeIn>
          <FadeIn delay={0.15}>
            <p className="mt-3 text-body leading-relaxed">
              Your agent made 200 decisions last week. How many does it remember?{" "}
              <span className="font-semibold text-heading">Zero.</span>
            </p>
          </FadeIn>
        </div>
      </section>

      {/* 6 Layers */}
      <section id="how-it-works" className="px-6 py-16 bg-card/30">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              6 layers of memory
            </h2>
            <p className="mt-3 text-center text-body max-w-xl mx-auto">
              From always-on business context to on-demand code dumps. Each layer serves a different purpose, all searchable.
            </p>
          </FadeIn>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MEMORY_LAYERS.map((layer, i) => (
              <FadeIn key={layer.num} delay={0.05 * i}>
                <div className="group relative rounded-xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/80">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <layer.icon className="h-4 w-4" />
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">Layer {layer.num}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-heading">{layer.title}</h3>
                  <p className="mt-2 text-xs text-body leading-relaxed">{layer.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Session Bridge */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              Works everywhere. Remembers everything.
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="mt-4 text-center text-body max-w-xl mx-auto leading-relaxed">
              Start a task in Cowork on your desktop. Continue in Claude Code on your laptop.
              Pick up on mobile. Memory travels with you.
            </p>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {["Cowork", "Claude Code", "Cursor", "Any MCP client"].map((p) => (
                <div key={p} className="flex items-center gap-2 rounded-full border border-border/40 bg-card/40 px-4 py-2 backdrop-blur-sm">
                  <RefreshCw className="h-3 w-3 text-primary" />
                  <span className="font-mono text-xs text-muted-foreground">{p}</span>
                </div>
              ))}
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="mt-8 rounded-xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm">
              <p className="font-mono text-xs text-muted-foreground mb-2">The dispatch problem, solved.</p>
              <p className="text-sm text-body leading-relaxed">
                Claude Code sessions don’t talk to each other. Cowork sessions don’t persist.
                We fix that. Every session reads from and writes to the same memory layer.
                Context is never lost.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* BYOD */}
      <section className="px-6 py-16 bg-card/30">
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn>
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 text-primary mb-4">
              <Shield className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Your data. Your database. Period.
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="mt-4 text-body max-w-xl mx-auto leading-relaxed">
              UnClick Memory stores everything in YOUR Supabase instance. We never see your data.
              If you leave, your data stays—it’s already yours.
            </p>
          </FadeIn>
          <FadeIn delay={0.15}>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border/40 bg-card/60 px-4 py-2 backdrop-blur-sm">
              <Database className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-body">Mem0 stores your memories in their cloud. We store them in yours.</span>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Setup */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              Set up in 3 minutes
            </h2>
          </FadeIn>

          <div className="mt-10 space-y-6">
            {[
              { step: 1, title: "Connect your database", desc: "Supabase free tier, or any PostgreSQL." },
              { step: 2, title: "Run one migration", desc: "We do it for you. One click." },
              { step: 3, title: "Add one line to your MCP config", desc: "That’s it. Every session now has memory." },
            ].map((s, i) => (
              <FadeIn key={s.step} delay={0.05 * i}>
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {s.step}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-heading">{s.title}</h3>
                    <p className="mt-1 text-xs text-body">{s.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.2}>
            <div className="mt-8 rounded-xl border border-border/60 bg-[#1e1e2e] p-5 font-mono text-xs text-green-400 overflow-x-auto">
              <div className="text-muted-foreground mb-2">~/.claude/mcp.json</div>
              <pre>{`{
  "mcpServers": {
    "unclick-memory": {
      "command": "npx",
      "args": ["-y", "@unclick/memory-mcp"],
      "env": {
        "UNCLICK_API_KEY": "um_live_xxxxxxxxxxxx"
      }
    }
  }
}`}</pre>
            </div>
          </FadeIn>

          <FadeIn delay={0.25}>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Coming from Mem0? Import your existing memories in one click.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Comparison */}
      <section className="px-6 py-16 bg-card/30">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl mb-8">
              How we compare
            </h2>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40 bg-card/80">
                    <th className="p-3 text-left font-medium text-muted-foreground" />
                    <th className="p-3 text-left font-semibold text-primary">UnClick Memory</th>
                    <th className="p-3 text-left font-medium text-muted-foreground">Mem0 ($249/mo)</th>
                    <th className="p-3 text-left font-medium text-muted-foreground">Letta</th>
                    <th className="p-3 text-left font-medium text-muted-foreground">Zep</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, i) => (
                    <tr key={row.feature} className={i % 2 === 0 ? "bg-card/40" : ""}>
                      <td className="p-3 font-medium text-heading group relative cursor-help">
                        <span className="border-b border-dotted border-muted-foreground/40">{row.feature}</span>
                        <span className="pointer-events-none absolute left-3 -top-8 z-10 hidden w-56 rounded-lg bg-[#1e1e2e] px-3 py-2 text-[10px] text-muted-foreground shadow-lg group-hover:block">
                          {row.tip}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-primary">{row.unclick}</td>
                      <td className="p-3 text-body">{row.mem0}</td>
                      <td className="p-3 text-body">{row.letta}</td>
                      <td className="p-3 text-body">{row.zep}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <FadeIn>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Your agent deserves better than starting from scratch every session.
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/pricing"
                className="rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Get Started Free
              </Link>
              <Link
                to="/docs"
                className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/40 px-6 py-3 text-sm font-medium text-heading backdrop-blur-sm transition-colors hover:bg-card/70"
              >
                View Docs <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Memory;

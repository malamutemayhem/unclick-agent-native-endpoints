import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeIn from "@/components/FadeIn";
import { useCanonical } from "@/hooks/use-canonical";
import { GitBranch, Zap, Brain, Lock, ArrowRight, Network, CheckCircle2, Terminal, Cloud, Workflow, Shield, RefreshCw } from "lucide-react";

const DISPATCH_FEATURES = [
  {
    title: "172+ MCP Tools",
    desc: "Every tool available in both Cowork and Claude Code",
    icon: Network,
  },
  {
    title: "Persistent Memory",
    desc: "Session summaries, facts, and business context carry over",
    icon: Brain,
  },
  {
    title: "Calendar & Tasks",
    desc: "Your schedule and todo list, always accessible",
    icon: CheckCircle2,
  },
  {
    title: "Credentials",
    desc: "BackstagePass manages API keys and tokens securely",
    icon: Lock,
  },
  {
    title: "Session Bridge",
    desc: "End one session, start another â context preserved",
    icon: RefreshCw,
  },
  {
    title: "Cross-Platform",
    desc: "Same tools in Claude Code, Cowork, Cursor, Windsurf",
    icon: Cloud,
  },
];

const SETUP_STEPS = [
  {
    step: 1,
    title: "Add to ~/.claude/mcp.json",
    desc: "Configure UnClick MCP servers with your API keys",
    code: `{
  "mcpServers": {
    "unclick": {
      "command": "npx",
      "args": ["-y", "@unclick/mcp-server"],
      "env": { "UNCLICK_API_KEY": "your-key" }
    },
    "unclick-memory": {
      "command": "npx",
      "args": ["-y", "@unclick/memory-mcp"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-key"
      }
    },
    "unclick-organiser": {
      "command": "npx",
      "args": ["-y", "@unclick/organiser-mcp"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-key"
      }
    }
  }
}`,
  },
  {
    step: 2,
    title: "Add CLAUDE.md to project root",
    desc: "Session bridge protocol â context travels between environments",
  },
  {
    step: 3,
    title: "Start coding",
    desc: "Agent has full access to tools, memory, and calendar",
  },
];

const Dispatch = () => {
  useCanonical("/dispatch");

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
              <span className="font-mono text-xs font-medium text-primary">Infrastructure</span>
            </div>
          </FadeIn>

          <FadeIn delay={0.05}>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
              Your AI workflows,{" "}
              <span className="text-primary">connected.</span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.1}>
            <p className="mt-4 text-lg text-body max-w-2xl mx-auto leading-relaxed">
              Dispatch routes tasks between Cowork and Claude Code automatically. Complex dev work goes to Claude Code. Research and planning stays in Cowork. UnClick tools and Memory travel with your agent everywhere.
            </p>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#setup"
                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                onClick={(e) => { e.preventDefault(); document.getElementById("setup")?.scrollIntoView({ behavior: "smooth" }); }}
              >
                Set Up Claude Code
              </a>
              <Link
                to="/memory"
                className="rounded-lg border border-border/60 bg-card/40 px-6 py-2.5 text-sm font-medium text-heading backdrop-blur-sm transition-colors hover:bg-card/70"
              >
                Learn About Memory
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* How Dispatch Works */}
      <section className="px-6 py-16 bg-card/30">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl mb-4">
              How Dispatch Works
            </h2>
            <p className="text-center text-body max-w-2xl mx-auto mb-12">
              You give a task. Dispatch figures out where it should run. When it's done, you get notified.
            </p>
          </FadeIn>

          <div className="grid gap-6 md:grid-cols-3">
            <FadeIn delay={0}>
              <div className="rounded-xl border border-border/60 bg-card/60 p-8 backdrop-blur-sm text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mx-auto mb-4">
                  <Brain className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-heading mb-2">Cowork</h3>
                <p className="text-xs text-body">Research, planning, documents</p>
              </div>
            </FadeIn>

            <FadeIn delay={0.05}>
              <div className="rounded-xl border border-border/60 bg-card/60 p-8 backdrop-blur-sm text-center flex items-center justify-center">
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mx-auto mb-4">
                    <Workflow className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-heading mb-2">Dispatch</h3>
                  <p className="text-xs text-body">Routes automatically</p>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={0.1}>
              <div className="rounded-xl border border-border/60 bg-card/60 p-8 backdrop-blur-sm text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mx-auto mb-4">
                  <Terminal className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-heading mb-2">Claude Code</h3>
                <p className="text-xs text-body">Coding, debugging, deployment</p>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Setup Section */}
      <section id="setup" className="px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl mb-2">
              Connect UnClick to Claude Code in 2 minutes
            </h2>
            <p className="text-center text-body max-w-xl mx-auto mb-10">
              Everything you need to get started with AI agent dispatch.
            </p>
          </FadeIn>

          <div className="space-y-6">
            {SETUP_STEPS.map((s, i) => (
              <FadeIn key={s.step} delay={0.05 * i}>
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {s.step}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-heading">{s.title}</h3>
                    <p className="mt-1 text-xs text-body">{s.desc}</p>
                    {s.code && (
                      <div className="mt-3 rounded-lg border border-border/60 bg-[#1e1e2e] p-4 font-mono text-xs text-green-400 overflow-x-auto">
                        <pre>{s.code}</pre>
                      </div>
                    )}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 py-16 bg-card/30">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl mb-4">
              What Travels With Your Agent
            </h2>
            <p className="text-center text-body max-w-2xl mx-auto mb-12">
              All the tools, memory, and context you need across every platform.
            </p>
          </FadeIn>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DISPATCH_FEATURES.map((feature, i) => (
              <FadeIn key={feature.title} delay={0.05 * i}>
                <div className="group relative rounded-xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/80">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <feature.icon className="h-4 w-4" />
                    </div>
                  </div>
                  <h3 className="text-sm font-semibold text-heading">{feature.title}</h3>
                  <p className="mt-2 text-xs text-body leading-relaxed">{feature.desc}</p>
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
              The Session Bridge
            </h2>
          </FadeIn>

          <FadeIn delay={0.1}>
            <p className="mt-4 text-center text-body max-w-xl mx-auto leading-relaxed">
              Context travels seamlessly between sessions. Read before you work. Write before you leave.
            </p>
          </FadeIn>

          <div className="mt-8 space-y-4">
            <FadeIn delay={0.15}>
              <div className="rounded-xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-heading text-sm">Session Start</h3>
                    <p className="mt-1 text-xs text-body">
                      Agent calls <span className="font-mono text-primary">get_startup_context</span> â loads standing rules, recent sessions, hot facts
                    </p>
                  </div>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={0.2}>
              <div className="rounded-xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-heading text-sm">During Work</h3>
                    <p className="mt-1 text-xs text-body">
                      Agent uses tools, adds facts, logs conversations. Everything is indexed and searchable.
                    </p>
                  </div>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={0.25}>
              <div className="rounded-xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <RefreshCw className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-heading text-sm">Session End</h3>
                    <p className="mt-1 text-xs text-body">
                      Agent calls <span className="font-mono text-primary">write_session_summary</span> â next session picks up seamlessly
                    </p>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Why Dispatch */}
      <section className="px-6 py-16 bg-card/30">
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn>
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 text-primary mb-4">
              <Shield className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              One unified agent across all platforms
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="mt-4 text-body max-w-xl mx-auto leading-relaxed">
              Stop context-switching between tools. Dispatch intelligently routes work to the right environment while keeping your agent in sync.
              Your tools, your memory, your way.
            </p>
          </FadeIn>
          <FadeIn delay={0.15}>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 rounded-full border border-border/40 bg-card/60 px-4 py-2 backdrop-blur-sm mx-auto w-fit">
              {["Cowork", "Claude Code", "Cursor", "Windsurf"].map((p) => (
                <span key={p} className="text-xs text-body">
                  {p}{p !== "Windsurf" && ","}
                </span>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <FadeIn>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Make your AI agent truly portable.
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/pricing"
                className="rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Get API Key
              </Link>
              <Link
                to="/docs"
                className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/40 px-6 py-3 text-sm font-medium text-heading backdrop-blur-sm transition-colors hover:bg-card/70"
              >
                Read Docs <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Dispatch;

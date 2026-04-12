import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import FadeIn from "../components/FadeIn";
import { useCanonical } from "../hooks/useCanonical";
import {
  Code,
  Search,
  FileText,
  Calendar,
  ArrowRight,
  Zap,
  Users,
  GitBranch,
  BarChart3,
  Check,
  AlertCircle,
  Briefcase,
} from "lucide-react";

const AGENT_PERSONAS = [
  {
    title: "The Developer",
    desc: "Specialist in code, architecture, and deployments. Has access to GitHub, build tools, linters, and deployment systems. Memory layer focused on technical decisions, code patterns, and system design.",
    icon: Code,
  },
  {
    title: "The Researcher",
    desc: "Expert at gathering and synthesizing information. Uses web search, news APIs, academic sources. Distills findings into Memory for the entire team to reference.",
    icon: Search,
  },
  {
    title: "The Writer",
    desc: "Crafts polish and clarity. Handles content creation, document formatting, email drafting. Pulls context from Memory to maintain voice, style, and brand guidelines.",
    icon: FileText,
  },
  {
    title: "The Organiser",
    desc: "Keeps the crew on track. Manages calendars, schedules, deadlines, and task coordination. Surfaces blockers and ensures the team moves in sync.",
    icon: Calendar,
  },
];

const HOW_CREWS_WORK = [
  {
    step: "Define",
    title: "Create agent personas with specific tool access, memory layers, and role definitions",
    icon: Briefcase,
  },
  {
    step: "Coordinate",
    title: "A lead agent delegates subtasks to specialists based on expertise",
    icon: Users,
  },
  {
    step: "Deliver",
    title: "Each agent works in parallel, sharing results through Memory",
    icon: Zap,
  },
];

const COMPARISON = [
  {
    feature: "MCP native",
    unclick: <Check className="h-4 w-4 text-primary" />,
    crewai: <AlertCircle className="h-4 w-4 text-muted-foreground" />,
    autogen: <AlertCircle className="h-4 w-4 text-muted-foreground" />,
    langgraph: <AlertCircle className="h-4 w-4 text-muted-foreground" />,
  },
  {
    feature: "Real tools (not mocked)",
    unclick: <Check className="h-4 w-4 text-primary" />,
    crewai: <AlertCircle className="h-4 w-4 text-muted-foreground" />,
    autogen: <Check className="h-4 w-4 text-primary" />,
    langgraph: <AlertCircle className="h-4 w-4 text-muted-foreground" />,
  },
  {
    feature: "Persistent memory",
    unclick: <Check className="h-4 w-4 text-primary" />,
    crewai: <AlertCircle className="h-4 w-4 text-muted-foreground" />,
    autogen: <Check className="h-4 w-4 text-primary" />,
    langgraph: <AlertCircle className="h-4 w-4 text-muted-foreground" />,
  },
  {
    feature: "Credential management",
    unclick: <Check className="h-4 w-4 text-primary" />,
    crewai: <AlertCircle className="h-4 w-4 text-muted-foreground" />,
    autogen: <AlertCircle className="h-4 w-4 text-muted-foreground" />,
    langgraph: <AlertCircle className="h-4 w-4 text-muted-foreground" />,
  },
  {
    feature: "Self-hosted",
    unclick: <Check className="h-4 w-4 text-primary" />,
    crewai: <Check className="h-4 w-4 text-primary" />,
    autogen: <Check className="h-4 w-4 text-primary" />,
    langgraph: <Check className="h-4 w-4 text-primary" />,
  },
  {
    feature: "Production ready",
    unclick: <Check className="h-4 w-4 text-primary" />,
    crewai: <AlertCircle className="h-4 w-4 text-muted-foreground" />,
    autogen: <AlertCircle className="h-4 w-4 text-muted-foreground" />,
    langgraph: <Check className="h-4 w-4 text-primary" />,
  },
];

const Crews = () => {
  useCanonical("/crews");

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
              <span className="font-mono text-xs font-medium text-primary">Coming Soon</span>
            </div>
          </FadeIn>

          <FadeIn delay={0.05}>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
              One task. Multiple specialists.{" "}
              <span className="text-primary">Zero overhead.</span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.1}>
            <p className="mt-4 text-lg text-body max-w-2xl mx-auto leading-relaxed">
              UnClick Crews lets you define AI agent personas â each with their own tools, memory context, and expertise.
              A developer, a researcher, a writer, an organiser. They collaborate through Claude's Agent Teams, powered by
              UnClick's 172+ MCP tools.
            </p>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/pricing"
                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Join Waitlist
              </Link>
              <Link
                to="/tools"
                className="rounded-lg border border-border/60 bg-card/40 px-6 py-2.5 text-sm font-medium text-heading backdrop-blur-sm transition-colors hover:bg-card/70"
              >
                Explore Tools
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* The Problem */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Single-agent AI hits a ceiling</h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="mt-4 text-lg text-body leading-relaxed">
              One agent can't be an expert coder AND a thorough researcher AND a polished writer.
              Context windows fill up. Specialisation gets diluted. You end up babysitting the AI
              instead of the AI working for you.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Meet Your Crew */}
      <section className="px-6 py-16 bg-card/30">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl mb-3">
              Meet your crew
            </h2>
            <p className="text-center text-body max-w-xl mx-auto">
              Each agent specializes in their domain, backed by dedicated tools and memory layers.
            </p>
          </FadeIn>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {AGENT_PERSONAS.map((persona, i) => (
              <FadeIn key={persona.title} delay={0.05 * i}>
                <div className="group relative rounded-xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/80">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <persona.icon className="h-5 w-5" />
                    </div>
                  </div>
                  <h3 className="text-sm font-semibold text-heading">{persona.title}</h3>
                  <p className="mt-2 text-xs text-body leading-relaxed">{persona.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* How Crews Work */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl mb-3">
              How Crews work
            </h2>
            <p className="text-center text-body max-w-xl mx-auto">
              Three stages. One workflow. Maximum parallelization.
            </p>
          </FadeIn>

          <div className="mt-12 space-y-6">
            {HOW_CREWS_WORK.map((stage, i) => (
              <FadeIn key={stage.step} delay={0.05 * i}>
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    <stage.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-heading">{stage.step}</h3>
                    <p className="mt-1 text-xs text-body">{stage.title}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Powered By UnClick */}
      <section className="px-6 py-16 bg-card/30">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl mb-8">
              Powered by UnClick
            </h2>
          </FadeIn>

          <div className="grid gap-6 md:grid-cols-2">
            <FadeIn delay={0.05}>
              <div className="rounded-xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-3">
                  <GitBranch className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-semibold text-heading">Tools</h3>
                </div>
                <p className="text-xs text-body leading-relaxed">
                  Each agent gets a curated subset of 172+ MCP tools. Developer gets GitHub and build tools. Writer gets CMS and formatting tools. No tool bloat, maximum focus.
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={0.1}>
              <div className="rounded-xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-3">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-semibold text-heading">Memory</h3>
                </div>
                <p className="text-xs text-body leading-relaxed">
                  Shared business context plus per-agent working memory. Researchers store findings. Writers store brand guidelines. Developers store architecture decisions.
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={0.15}>
              <div className="rounded-xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-3">
                  <AlertCircle className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-semibold text-heading">BackstagePass</h3>
                </div>
                <p className="text-xs text-body leading-relaxed">
                  Credentials scoped per agent. Developer gets GitHub token. Writer gets CMS key. Organiser gets calendar API. No broad API key exposure.
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={0.2}>
              <div className="rounded-xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-3">
                  <Calendar className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-semibold text-heading">The Organiser</h3>
                </div>
                <p className="text-xs text-body leading-relaxed">
                  One dedicated agent manages the crew's calendar and task queue. Surfaces blockers. Synchronizes handoffs. Keeps everyone moving.
                </p>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Built on Standards */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Not another framework. Just MCP.
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="mt-4 text-body max-w-xl mx-auto leading-relaxed">
              CrewAI builds abstractions. AutoGen builds frameworks. LangGraph builds graphs.
              UnClick Crews doesn't reinvent tooling â it uses the tools you already have through MCP.
              No new abstractions, no vendor lock-in. Your agents use the same tools a human would.
            </p>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="mt-8 rounded-xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm">
              <p className="font-mono text-xs text-muted-foreground mb-3">The difference</p>
              <div className="grid grid-cols-2 gap-4 text-left text-xs">
                <div>
                  <p className="font-semibold text-heading mb-2">CrewAI, AutoGen, LangGraph</p>
                  <ul className="space-y-1 text-body">
                    <li>â¢ Mock tools (fake integration)</li>
                    <li>â¢ Custom abstraction layers</li>
                    <li>â¢ Limited credential mgmt</li>
                    <li>â¢ Framework lock-in</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-heading mb-2">UnClick Crews</p>
                  <ul className="space-y-1 text-body">
                    <li>â¢ Real MCP tools (genuine integration)</li>
                    <li>â¢ No abstraction overhead</li>
                    <li>â¢ Full credential scoping</li>
                    <li>â¢ Open standards</li>
                  </ul>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="px-6 py-16 bg-card/30">
        <div className="mx-auto max-w-5xl">
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
                    <th className="p-3 text-left font-semibold text-primary">UnClick Crews</th>
                    <th className="p-3 text-left font-medium text-muted-foreground">CrewAI</th>
                    <th className="p-3 text-left font-medium text-muted-foreground">AutoGen</th>
                    <th className="p-3 text-left font-medium text-muted-foreground">LangGraph</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, i) => (
                    <tr key={row.feature} className={i % 2 === 0 ? "bg-card/40" : ""}>
                      <td className="p-3 font-medium text-heading">{row.feature}</td>
                      <td className="p-3 flex justify-start">{row.unclick}</td>
                      <td className="p-3 flex justify-start">{row.crewai}</td>
                      <td className="p-3 flex justify-start">{row.autogen}</td>
                      <td className="p-3 flex justify-start">{row.langgraph}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <FadeIn>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Stop doing everything yourself.
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="mt-3 text-body max-w-xl mx-auto">
              Define your crew. Assign the work. Let them collaborate. The future of AI is multi-agent.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/pricing"
                className="rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Join the Waitlist
              </Link>
              <Link
                to="/tools"
                className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/40 px-6 py-3 text-sm font-medium text-heading backdrop-blur-sm transition-colors hover:bg-card/70"
              >
                Browse Tools <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Crews;

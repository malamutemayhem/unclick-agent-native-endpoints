import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeIn from "@/components/FadeIn";
import { useCanonical } from "@/hooks/use-canonical";
import {
  Calendar,
  CheckCircle2,
  Link as LinkIcon,
  Zap,
  Globe,
  Clock,
  ArrowRight,
  Eye,
  Bell,
  Layers,
  Users,
} from "lucide-react";

const FEATURES = [
  {
    title: "Calendar Sync",
    desc: "Google, Outlook, Apple â unified behind a single MCP interface",
    icon: Calendar,
  },
  {
    title: "Smart Tasks",
    desc: "AI-extracted action items from meetings, emails, and conversations",
    icon: CheckCircle2,
  },
  {
    title: "Booking Pages",
    desc: "Share your availability. Let anyone book a slot â like Calendly, but AI-native",
    icon: LinkIcon,
  },
  {
    title: "Daily Briefing",
    desc: "One command to see today's events, overdue tasks, and open loops from Memory",
    icon: Bell,
  },
  {
    title: "Cross-Platform",
    desc: "Works in Claude Code, Cowork, Cursor, and any MCP client",
    icon: Layers,
  },
  {
    title: "Timezone Smart",
    desc: "Handles scheduling across timezones for distributed teams",
    icon: Globe,
  },
];

const MCP_TOOLS = [
  { name: "get_daily_briefing", desc: "Fetch today's events, tasks, and open loops" },
  { name: "search_events", desc: "Search across all calendars with natural language" },
  { name: "create_event", desc: "Add events to any connected calendar" },
  { name: "check_availability", desc: "See free slots across all your calendars" },
  { name: "create_task", desc: "Extract and log action items automatically" },
  { name: "list_tasks", desc: "View all tasks with priority and due dates" },
  { name: "complete_task", desc: "Mark tasks done and track completion" },
  { name: "create_booking_page", desc: "Generate a shareable booking link" },
  { name: "get_bookings", desc: "Fetch all bookings from your pages" },
];

const COMPARISON = [
  {
    feature: "Multi-calendar sync",
    unclick: "Yes (Google, Outlook, Apple)",
    calendly: "Single calendar only",
    cal: "Limited",
    notion: "No",
  },
  {
    feature: "AI-native",
    unclick: "Yes",
    calendly: "No",
    cal: "No",
    notion: "No",
  },
  {
    feature: "MCP compatible",
    unclick: "Yes",
    calendly: "No",
    cal: "No",
    notion: "No",
  },
  {
    feature: "Booking pages",
    unclick: "Yes",
    calendly: "Yes",
    cal: "Yes",
    notion: "No",
  },
  {
    feature: "Task management",
    unclick: "Yes",
    calendly: "No",
    cal: "No",
    notion: "Yes",
  },
  {
    feature: "Self-hosted option",
    unclick: "Yes",
    calendly: "No",
    cal: "Yes",
    notion: "No",
  },
  {
    feature: "Price",
    unclick: "Free / $29 Pro",
    calendly: "$12â$20/mo",
    cal: "Freeâ$120/mo",
    notion: "$10â$20/mo",
  },
];

const Organiser = () => {
  useCanonical("/organiser");

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
              One calendar.{" "}
              <span className="text-primary">Every provider.</span> Zero context
              switching.
            </h1>
          </FadeIn>

          <FadeIn delay={0.1}>
            <p className="mt-4 text-lg text-body max-w-xl mx-auto leading-relaxed">
              UnClick Organiser syncs your Google, Outlook, and Apple calendars
              into a single AI-powered view â with smart tasks, booking pages,
              and daily briefings built in.
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
                href="#tools"
                className="rounded-lg border border-border/60 bg-card/40 px-6 py-2.5 text-sm font-medium text-heading backdrop-blur-sm transition-colors hover:bg-card/70"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("tools")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                View MCP Tools
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* The Problem */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Your calendar is split across three apps. Your AI can't see any of them.
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-border/40 bg-card/40 p-4 backdrop-blur-sm">
                <p className="text-xs font-medium text-muted-foreground mb-2">Calendar Chaos</p>
                <p className="text-sm text-body">
                  Google Calendar on your phone. Outlook in your browser. Apple Calendar syncing
                  to your watch. None of them talk to each other.
                </p>
              </div>
              <div className="rounded-lg border border-border/40 bg-card/40 p-4 backdrop-blur-sm">
                <p className="text-xs font-medium text-muted-foreground mb-2">Scattered Tasks</p>
                <p className="text-sm text-body">
                  Action items live in Notion. Reminders in Apple. To-dos in Todoist.
                  Your AI has no idea what you need to do.
                </p>
              </div>
              <div className="rounded-lg border border-border/40 bg-card/40 p-4 backdrop-blur-sm">
                <p className="text-xs font-medium text-muted-foreground mb-2">No Scheduling</p>
                <p className="text-sm text-body">
                  AI agents can't book meetings because they can't see your availability.
                  Every meeting needs manual confirmation.
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 py-16 bg-card/30">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              Everything you need in one place
            </h2>
            <p className="mt-3 text-center text-body max-w-xl mx-auto">
              Calendar sync, smart tasks, booking pages, and AI-powered daily briefings.
              All integrated into your MCP.
            </p>
          </FadeIn>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, i) => (
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

      {/* How It Works */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              Get started in 3 steps
            </h2>
          </FadeIn>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {[
              {
                step: 1,
                title: "Connect your calendars",
                desc: "OAuth with Google, Microsoft, and Apple. All three calendars merge into one.",
              },
              {
                step: 2,
                title: "Add to Claude Code",
                desc: "npx command + mcp.json config. One-minute setup.",
              },
              {
                step: 3,
                title: "Ask your AI",
                desc: '"What\'s on my plate today?" / "Book a meeting with Sarah next week" / "Extract action items from today\'s standup"',
              },
            ].map((s, i) => (
              <FadeIn key={s.step} delay={0.05 * i}>
                <div className="relative">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {s.step}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-heading">{s.title}</h3>
                      <p className="mt-2 text-xs text-body leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                  {i < 2 && (
                    <div className="hidden sm:block absolute left-5 top-10 w-0.5 h-12 bg-gradient-to-b from-primary to-primary/20" />
                  )}
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.2}>
            <div className="mt-10 rounded-xl border border-border/60 bg-[#1e1e2e] p-5 font-mono text-xs text-green-400 overflow-x-auto">
              <div className="text-muted-foreground mb-2">~/.claude/mcp.json</div>
              <pre>{`{
  "mcpServers": {
    "unclick-organiser": {
      "command": "npx",
      "args": ["-y", "@unclick/organiser-mcp"],
      "env": {
        "UNCLICK_API_KEY": "uo_live_xxxxxxxxxxxx"
      }
    }
  }
}`}</pre>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* MCP Tools */}
      <section id="tools" className="px-6 py-16 bg-card/30">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl mb-8">
              MCP Tools Reference
            </h2>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="grid gap-3 sm:grid-cols-2">
              {MCP_TOOLS.map((tool, i) => (
                <div
                  key={tool.name}
                  className="rounded-lg border border-border/40 bg-card/60 p-4 backdrop-blur-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div>
                      <p className="font-mono text-xs font-semibold text-primary">
                        {tool.name}
                      </p>
                      <p className="mt-1 text-xs text-body">{tool.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Comparison */}
      <section className="px-6 py-16">
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
                    <th className="p-3 text-left font-semibold text-primary">UnClick Organiser</th>
                    <th className="p-3 text-left font-medium text-muted-foreground group relative">
                      <span className="cursor-help">Calendly</span>
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden rounded-lg bg-heading px-3 py-2 text-xs text-card whitespace-nowrap group-hover:block z-10">
                        Scheduling platform
                      </div>
                    </th>
                    <th className="p-3 text-left font-medium text-muted-foreground group relative">
                      <span className="cursor-help">Cal.com</span>
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden rounded-lg bg-heading px-3 py-2 text-xs text-card whitespace-nowrap group-hover:block z-10">
                        Open-source alternative
                      </div>
                    </th>
                    <th className="p-3 text-left font-medium text-muted-foreground group relative">
                      <span className="cursor-help">Notion Calendar</span>
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden rounded-lg bg-heading px-3 py-2 text-xs text-card whitespace-nowrap group-hover:block z-10">
                        All-in-one workspace
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, i) => (
                    <tr key={row.feature} className={i % 2 === 0 ? "bg-card/40" : ""}>
                      <td className="p-3 font-medium text-heading">{row.feature}</td>
                      <td className="p-3 font-medium text-primary">{row.unclick}</td>
                      <td className="p-3 text-body">{row.calendly}</td>
                      <td className="p-3 text-body">{row.cal}</td>
                      <td className="p-3 text-body">{row.notion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-20 bg-card/30">
        <div className="mx-auto max-w-2xl text-center">
          <FadeIn>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Stop switching between calendar apps.
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="mt-4 text-body max-w-xl mx-auto leading-relaxed">
              Your calendar, your tasks, and your AI. All in one place.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
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

export default Organiser;

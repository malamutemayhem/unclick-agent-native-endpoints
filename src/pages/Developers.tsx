import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeIn from "@/components/FadeIn";
import { Slider } from "@/components/ui/slider";

const RATE = 0.001;
const SHARE = 0.80;

const STARTER_TEMPLATE = `export const weatherTools = [
  {
    name: "get_current_weather",
    description: "Returns current weather for a location.",
    inputSchema: {
      type: "object",
      properties: {
        latitude:  { type: "number", description: "Latitude." },
        longitude: { type: "number", description: "Longitude." }
      },
      required: ["latitude", "longitude"]
    },
    handler: async (args: any) => {
      const { latitude, longitude } = args;
      const res = await fetch(
        \`https://api.open-meteo.com/v1/forecast\` +
        \`?latitude=\${latitude}&longitude=\${longitude}&current_weather=true\`
      );
      if (!res.ok) throw new Error(\`Weather API error: \${res.status}\`);
      const data = await res.json();
      return data.current_weather;
    }
  }
];`;

const steps = [
  {
    number: "01",
    title: "Write your tool",
    desc: "One TypeScript file. Export an array of tool definitions. Each one wraps an API call. Takes about 30 minutes for a simple wrapper.",
  },
  {
    number: "02",
    title: "Submit for review",
    badge: "Founding Developer: 24hr review",
    desc: "Paste your file or link your GitHub repo. We are reviewing the first 50 submissions within 24 hours and giving direct feedback.",
  },
  {
    number: "03",
    title: "Earn 80% of revenue",
    desc: "Once live, your tool earns on every call. No Stripe required to start. Connect it when you want to withdraw.",
  },
];

const whyItems = [
  { title: "Zero infrastructure cost", desc: "We host, scale, and monitor everything. You ship code, not servers." },
  { title: "Instant distribution", desc: "Your tool is available to all UnClick users the moment it goes live." },
  { title: "Transparent earnings", desc: "Real-time dashboard shows calls, revenue, and payout history per tool." },
  { title: "24hr review (first 50)", desc: "Founding developers get reviewed within 24 hours. Direct feedback, no waiting." },
  { title: "Full TypeScript SDK", desc: "Typed helpers, error patterns, and a local test runner included." },
];

const categories = [
  { name: "AU-specific", desc: "ABN lookups, ATO data, Australian government APIs", unclaimed: true },
  { name: "Security", desc: "CVE lookups, cert checks, IP reputation", unclaimed: true },
  { name: "Productivity", desc: "Task management, calendars, docs", unclaimed: false },
  { name: "Finance", desc: "Exchange rates, stock data, invoicing", unclaimed: true },
  { name: "Health", desc: "Medical lookups, drug info, health APIs", unclaimed: true },
  { name: "Science", desc: "Arxiv, PubMed, chemistry data", unclaimed: true },
];

const approvalChecklist = [
  "My tool file is TypeScript and exports a named array (e.g. weatherTools).",
  "All API credentials go through resolveCredential, never hardcoded.",
  "Every fetch call checks res.ok and throws a descriptive error if false.",
  "Tool names are snake_case (e.g. get_current_weather).",
  "Descriptions start with a verb and are under 120 characters.",
  "I have tested the tool locally with npx unclick test.",
  "The upstream API's terms of service allow this kind of wrapper.",
];

const socialProof = [
  {
    quote: "Built a Notion-to-podcast converter in a weekend. First sale came in two days later.",
    name: "Jamie K.",
    tool: "Tool Developer",
  },
  {
    quote: "I listed my LinkedIn scraper on UnClick and stopped worrying about billing infrastructure entirely.",
    name: "Alex M.",
    tool: "Indie Hacker",
  },
  {
    quote: "The 80% revenue split is the real deal. Pulled out $340 last month from a tool I built in an afternoon.",
    name: "Sam R.",
    tool: "AI Developer",
  },
];

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="font-mono text-xs text-muted-foreground transition-colors hover:text-heading"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function DevelopersPage() {
  const [calls, setCalls] = useState(50000);
  const monthly = (calls * RATE * SHARE).toFixed(2);

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-24 pt-36 text-center">
        <FadeIn>
          <span className="inline-block rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs text-primary">
            Developer Program
          </span>
        </FadeIn>
        <FadeIn delay={0.05}>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight text-heading sm:text-6xl">
            Build once. Earn forever.
          </h1>
        </FadeIn>
        <FadeIn delay={0.1}>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-body leading-relaxed">
            Write a tool. We host it, distribute it to thousands of AI agents, and pay you 80% of what it earns.
          </p>
        </FadeIn>
        <FadeIn delay={0.15}>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/developers/docs"
              className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Start Building
            </Link>
            <Link
              to="/developers/submit"
              className="rounded-md border border-border/60 bg-card/20 px-6 py-2.5 text-sm font-medium text-heading transition-colors hover:bg-card/40"
            >
              Submit a Tool
            </Link>
          </div>
        </FadeIn>
        <FadeIn delay={0.2}>
          <p className="mt-6 text-xs text-muted-foreground">
            No account required to read the docs. No Stripe required to start building.
          </p>
        </FadeIn>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <FadeIn>
          <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
            How it works
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-heading">
            Three steps to passive income
          </h2>
        </FadeIn>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {steps.map((step, i) => (
            <FadeIn key={step.number} delay={i * 0.07}>
              <div className="relative rounded-xl border border-border/40 bg-card/20 p-6">
                <span className="font-mono text-3xl font-bold text-primary/40">{step.number}</span>
                <h3 className="mt-4 text-base font-semibold text-heading">{step.title}</h3>
                {step.badge && (
                  <span className="mt-2 inline-block rounded border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
                    {step.badge}
                  </span>
                )}
                <p className="mt-2 text-sm text-body leading-relaxed">{step.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Tool template on landing page */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <FadeIn>
          <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
            It really is this simple
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-heading">
            A working tool in 20 lines
          </h2>
          <p className="mt-3 text-body">
            This is a complete, submittable tool. No API key needed. Copy it, test it locally, submit it.
          </p>
        </FadeIn>
        <FadeIn delay={0.05}>
          <div className="mt-6 overflow-hidden rounded-xl border border-border/40 bg-[#0d0d0d]">
            <div className="flex items-center justify-between border-b border-border/30 px-4 py-2">
              <span className="font-mono text-xs text-muted-foreground">weather-tools.ts</span>
              <CopyButton code={STARTER_TEMPLATE} />
            </div>
            <pre className="overflow-x-auto p-5">
              <code className="font-mono text-xs leading-relaxed text-body">{STARTER_TEMPLATE}</code>
            </pre>
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="mt-4 flex flex-wrap gap-3">
            <span className="rounded-lg border border-border/40 bg-card/20 px-3 py-1.5 text-xs text-body">
              Uses Open-Meteo (free, no key required)
            </span>
            <span className="rounded-lg border border-border/40 bg-card/20 px-3 py-1.5 text-xs text-body">
              Copy, test, submit
            </span>
            <Link
              to="/developers/docs"
              className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-primary transition-colors hover:bg-primary/20"
            >
              Full pattern in the docs
            </Link>
          </div>
        </FadeIn>
      </section>

      {/* Revenue calculator */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <FadeIn>
          <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-8">
            <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
              Revenue calculator
            </span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-heading">
              Real numbers, not vague ranges
            </h2>
            <p className="mt-2 text-sm text-body">
              $0.001 per call. You keep 80%. A tool called 50,000 times a month earns you $40. A popular
              tool in an active category gets 500,000+ calls. That is $400+ a month for code you wrote once.
            </p>

            <div className="mt-8">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-body">Estimated monthly calls</span>
                <span className="font-mono text-sm font-medium text-heading">
                  {calls.toLocaleString()}
                </span>
              </div>
              <Slider
                min={1000}
                max={1000000}
                step={1000}
                value={[calls]}
                onValueChange={(v) => setCalls(v[0])}
                className="w-full"
              />
              <div className="mt-2 flex justify-between font-mono text-xs text-muted-foreground">
                <span>1,000</span>
                <span>1,000,000</span>
              </div>
            </div>

            <div className="mt-8 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
              <div className="rounded-xl border border-primary/30 bg-primary/10 px-8 py-5">
                <p className="text-xs text-body">Monthly earnings</p>
                <p className="mt-1 font-mono text-3xl font-bold text-heading">
                  ${Number(monthly).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  ${(Number(monthly) * 12).toLocaleString("en-US", { minimumFractionDigits: 2 })} / year
                </p>
              </div>
              <div className="space-y-2 text-sm text-body">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {calls.toLocaleString()} calls x $0.001 = ${(calls * RATE).toFixed(2)} gross
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Your 80% share = ${monthly} / month
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                  Paid monthly. No Stripe required to start.
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* Why UnClick */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <FadeIn>
          <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
            Why UnClick
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-heading">
            Everything handled for you
          </h2>
        </FadeIn>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {whyItems.map((item, i) => (
            <FadeIn key={item.title} delay={i * 0.06}>
              <div className="rounded-xl border border-border/40 bg-card/20 p-5">
                <h3 className="text-sm font-semibold text-heading">{item.title}</h3>
                <p className="mt-1.5 text-sm text-body leading-relaxed">{item.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Tool categories */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <FadeIn>
          <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
            Categories we need
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-heading">
            High-demand, low-competition
          </h2>
          <p className="mt-3 text-body">
            These categories have strong user demand but few or no tools yet. First movers earn the most.
          </p>
        </FadeIn>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat, i) => (
            <FadeIn key={cat.name} delay={i * 0.06}>
              <div className="relative rounded-xl border border-border/40 bg-card/20 p-5">
                {cat.unclaimed && (
                  <span className="absolute right-4 top-4 rounded border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
                    Unclaimed
                  </span>
                )}
                <h3 className="pr-16 text-sm font-semibold text-heading">{cat.name}</h3>
                <p className="mt-1.5 text-sm text-body leading-relaxed">{cat.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Self-check section */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <FadeIn>
          <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
            Before you submit
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-heading">
            Will my tool be approved?
          </h2>
          <p className="mt-3 text-body">
            Run through this checklist. If you can tick everything, your tool will almost certainly pass review.
          </p>
        </FadeIn>
        <FadeIn delay={0.05}>
          <div className="mt-8 rounded-xl border border-border/40 bg-card/20 p-6">
            <ul className="space-y-3">
              {approvalChecklist.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border/60 bg-card/40 font-mono text-[10px] text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="text-sm text-body leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-border/30 pt-4">
              <p className="text-xs text-muted-foreground">
                If your tool is rejected, you will receive specific feedback by email and can resubmit immediately.
                There is no limit on resubmissions.
              </p>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* Social proof */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <FadeIn>
          <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
            What developers are saying
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-heading">
            From the community
          </h2>
        </FadeIn>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {socialProof.map((item, i) => (
            <FadeIn key={i} delay={i * 0.06}>
              <div className="flex h-full flex-col rounded-xl border border-border/40 bg-card/20 p-5">
                <p className="flex-1 text-sm text-body leading-relaxed italic">
                  "{item.quote}"
                </p>
                <div className="mt-4 border-t border-border/30 pt-3">
                  <p className="text-xs font-medium text-heading">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.tool}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="mx-auto max-w-5xl px-6 pb-32">
        <FadeIn>
          <div className="rounded-2xl border border-border/40 bg-card/20 px-8 py-12 text-center">
            <span className="inline-block rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs text-primary">
              Founding Developer: 24hr review
            </span>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-heading">
              Ready to build?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-body">
              Read the docs, write your first tool, and submit it. Most developers ship their first tool in under an hour.
              No account required to get started.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to="/developers/docs"
                className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Start Building
              </Link>
              <Link
                to="/developers/submit"
                className="rounded-md border border-border/60 bg-card/20 px-6 py-2.5 text-sm font-medium text-heading transition-colors hover:bg-card/40"
              >
                Submit a Tool
              </Link>
            </div>
          </div>
        </FadeIn>
      </section>

      <Footer />
    </div>
  );
}

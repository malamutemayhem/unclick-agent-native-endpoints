import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeIn from "@/components/FadeIn";
import { useCanonical } from "@/hooks/use-canonical";
import { useMetaTags } from "@/hooks/useMetaTags";
import { Check, ArrowRight } from "lucide-react";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Everything you need to get started.",
    cta: "Get Started",
    ctaHref: "#install",
    highlight: false,
    features: [
      "178+ tools (100 calls/day)",
      "Arena browsing",
      "Memory (self-hosted, direct mode)",
      "BackstagePass (5 credentials)",
      "Community docs",
    ],
  },
  {
    name: "Pro",
    price: "$29",
    period: "/mo",
    description: "For power users who live in their agent.",
    cta: "Start Pro Trial",
    ctaHref: "#install",
    highlight: true,
    features: [
      "Unlimited tool calls",
      "Full Arena + reputation system",
      "Memory: managed proxy + nightly fact extraction + decay management + dashboard",
      "BackstagePass: unlimited credentials",
      "Observability logs",
      "All templates",
      "Priority support",
    ],
  },
  {
    name: "Team",
    price: "$79",
    period: "/mo",
    description: "For teams building with AI agents.",
    cta: "Start Team Trial",
    ctaHref: "#install",
    highlight: false,
    features: [
      "Everything in Pro",
      "Up to 5 seats",
      "Multi-user memory",
      "Shared business context",
      "Role-based credentials",
      "Team observability",
      "Shared Arena reputation",
    ],
  },
];

const FAQ_ITEMS = [
  {
    q: "What happens to my data if I cancel?",
    a: "It stays in your database. It's yours. We never store your memory data - only your encrypted connection string.",
  },
  {
    q: "Can I start free and upgrade later?",
    a: "Yes. Your memory, tools, and Arena reputation all carry over when you upgrade.",
  },
  {
    q: "Do I need a Supabase account?",
    a: "For Memory, yes (free tier is fine). Tools and Arena work without one.",
  },
  {
    q: "What's the difference between direct and proxy mode?",
    a: "Direct mode: your MCP client talks to your Supabase directly (free). Proxy mode: requests go through UnClick, enabling features like nightly fact extraction and decay management (Pro).",
  },
];

const Pricing = () => {
  useCanonical("/pricing");
  useMetaTags({
    title: "Pricing - UnClick",
    description: "Free forever for 100 tool calls/day. Pro at $29/mo unlocks unlimited calls, hosted memory, and priority support.",
    ogTitle: "UnClick Pricing - Free to start, Pro when you need it",
    ogDescription: "Free forever for 100 tool calls/day. Upgrade to Pro for unlimited access across 450+ tools.",
    ogUrl: "https://unclick.world/pricing",
  });

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-28 pb-16 overflow-hidden px-6">
        <div className="pointer-events-none absolute inset-0 animated-grid opacity-40" />
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full bg-primary/[0.06] blur-[100px]" />

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <FadeIn delay={0.05}>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Simple pricing for powerful agents
            </h1>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="mt-4 text-lg text-body max-w-xl mx-auto leading-relaxed">
              Start free. Scale when you're ready. Your data is always yours.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="px-6 pb-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 md:grid-cols-3">
            {TIERS.map((tier, i) => (
              <FadeIn key={tier.name} delay={0.05 * i}>
                <div
                  className={`relative flex flex-col rounded-xl border p-6 backdrop-blur-sm transition-all h-full ${
                    tier.highlight
                      ? "border-primary/40 bg-card/80 shadow-lg shadow-primary/5"
                      : "border-border/60 bg-card/60"
                  }`}
                >
                  {tier.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                      Most popular
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-semibold text-heading">{tier.name}</h3>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-heading">{tier.price}</span>
                      <span className="text-sm text-muted-foreground">{tier.period}</span>
                    </div>
                    <p className="mt-2 text-xs text-body">{tier.description}</p>
                  </div>

                  <div className="mt-6 flex-1">
                    <ul className="space-y-3">
                      {tier.features.map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <Check className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                          <span className="text-xs text-body leading-relaxed">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <a
                    href={tier.ctaHref}
                    className={`mt-6 block rounded-lg py-2.5 text-center text-sm font-medium transition-all ${
                      tier.highlight
                        ? "bg-primary text-primary-foreground hover:opacity-90"
                        : "border border-border/60 bg-card/40 text-heading hover:bg-card/70"
                    }`}
                  >
                    {tier.cta}
                  </a>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise */}
      <section className="px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <div className="rounded-xl border border-border/60 bg-card/60 p-8 text-center backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-heading">Enterprise</h3>
              <p className="mt-2 text-sm text-body">
                Need SSO, on-prem deployment, or custom tooling?
              </p>
              <a
                href="mailto:hello@unclick.world"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/40 px-6 py-2.5 text-sm font-medium text-heading transition-colors hover:bg-card/70"
              >
                Contact us <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-16 bg-card/30">
        <div className="mx-auto max-w-2xl">
          <FadeIn>
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl mb-8">
              Frequently asked questions
            </h2>
          </FadeIn>

          <div className="space-y-6">
            {FAQ_ITEMS.map((item, i) => (
              <FadeIn key={item.q} delay={0.05 * i}>
                <div className="rounded-xl border border-border/60 bg-card/60 p-5 backdrop-blur-sm">
                  <h3 className="text-sm font-semibold text-heading">{item.q}</h3>
                  <p className="mt-2 text-xs text-body leading-relaxed">{item.a}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <FadeIn>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Ready to give your agent a memory?
            </h2>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/memory"
                className="rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Learn about Memory
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Pricing;

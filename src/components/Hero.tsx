import { Link } from "react-router-dom";
import FadeIn from "@/components/FadeIn";
import { Wrench, Brain, Key, Users, BadgeCheck, Store, ArrowRight } from "lucide-react";

const PRODUCTS = [
  {
    title: "Tools",
    description: "450+ callable endpoints to act",
    href: "/tools",
    icon: Wrench,
    color: "bg-blue-500/10 text-blue-500",
  },
  {
    title: "Memory",
    description: "Persistent cross-session context",
    href: "/memory",
    icon: Brain,
    color: "bg-purple-500/10 text-purple-500",
  },
  {
    title: "Connections",
    description: "Secure credentials for services",
    href: "/admin/keychain",
    icon: Key,
    color: "bg-amber-500/10 text-amber-500",
  },
  {
    title: "Pass family",
    description: "TestPass, UXPass, SecurityPass, SEOPass",
    href: "/admin/testpass",
    icon: BadgeCheck,
    color: "bg-red-500/10 text-red-500",
  },
  {
    title: "Crews",
    description: "Multi-agent orchestration",
    href: "/crews",
    icon: Users,
    color: "bg-green-500/10 text-green-500",
  },
  {
    title: "Marketplace",
    description: "Ship and verify agent tools",
    href: "/developers",
    icon: Store,
    color: "bg-yellow-500/10 text-yellow-500",
  },
];

const Hero = () => {
  return (
    <>
      {/* Hero Section */}
      <section className="relative pt-28 pb-20 overflow-hidden px-6">
        <div className="pointer-events-none absolute inset-0 animated-grid opacity-40" />
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full bg-primary/[0.06] blur-[100px]" />

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <FadeIn>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 backdrop-blur-sm">
              <span className="font-mono text-xs font-medium text-primary">Agent Rails</span>
            </div>
          </FadeIn>

          <FadeIn delay={0.05}>
            <h1 className="text-5xl font-semibold leading-tight tracking-tight sm:text-6xl md:text-7xl">
              Rails for{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary to-primary/70">
                AI agents
              </span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.1}>
            <p className="mt-6 text-lg text-body max-w-2xl mx-auto leading-relaxed">
              Tools to act. Memory to remember. Connections to authenticate. Crews to deliberate.
              Pass family checks to prove it works before you ship.
            </p>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#install"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("install")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Get Started Free
              </a>
              <a
                href="#products"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/40 px-6 py-3 text-sm font-medium text-heading backdrop-blur-sm transition-colors hover:bg-card/70"
              >
                Explore Products <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Products Section */}
      <section id="products" className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
              The rails your agent plugs into
            </h2>
            <p className="mt-3 text-center text-body max-w-2xl mx-auto">
              UnClick sits behind Claude, ChatGPT, Cursor, and every MCP client as the shared layer for action, memory, credentials, teams, and QA.
            </p>
          </FadeIn>

          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PRODUCTS.map((product, i) => (
              <FadeIn key={product.title} delay={0.05 * i}>
                <Link
                  to={product.href}
                  className="group relative block h-full rounded-xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/80 hover:shadow-lg"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${product.color} mb-4`}>
                    <product.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-heading">{product.title}</h3>
                  <p className="mt-2 text-sm text-body leading-relaxed">{product.description}</p>
                  <div className="mt-4 flex items-center gap-2 text-sm text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Learn more <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </Link>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default Hero;

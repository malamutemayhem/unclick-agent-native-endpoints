import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeIn from "@/components/FadeIn";
import { useCanonical } from "@/hooks/use-canonical";
import {
  Wrench,
  Brain,
  Calendar,
  Key,
  Users,
  Trophy,
  ArrowRight,
  CheckCircle2,
  MessageSquare,
  Zap,
  Lock,
  ChevronRight,
} from "lucide-react";

const FEATURES = [
  {
    id: "tools",
    title: "Tools",
    subtitle: "The toolbox",
    icon: Wrench,
    analogy: "Like giving your assistant access to email, calendar, weather, news, and 178 other services. They can check the weather, search Amazon, look up stocks, and more - without you doing it manually.",
  },
  {
    id: "memory",
    title: "Memory",
    subtitle: "The filing cabinet",
    icon: Brain,
    analogy: "AI assistants normally forget everything between conversations. Memory is like giving them a notebook that carries over - they remember your preferences, past decisions, and ongoing projects.",
  },
  {
    id: "organiser",
    title: "Organiser",
    subtitle: "The day planner",
    icon: Calendar,
    analogy: "Your AI can see your calendar across Google, Outlook, and Apple. It can schedule meetings, create to-do lists, and give you a morning briefing - all from one place.",
  },
  {
    id: "backstagepass",
    title: "BackstagePass",
    subtitle: "The keys to the office",
    icon: Key,
    analogy: "Some tools need passwords and API keys. BackstagePass keeps those credentials safe and hands them to your AI only when needed - like a secure key card system.",
  },
];

const EXAMPLES = [
  "Check my calendar and tell me what's happening tomorrow",
  "Find the cheapest flights to Sydney next month",
  "What's the weather like this weekend?",
  "Send an email to Sarah confirming our meeting",
  "What did we decide about the website redesign last week?",
  "Create a to-do list from my meeting notes",
];

const FAQ = [
  {
    q: "Do I need to know how to code?",
    a: "No. UnClick works through AI chat interfaces like Claude. You just talk normally.",
  },
  {
    q: "Is it free?",
    a: "Yes! The free plan gives you 178+ tools. Pro is $29/month for unlimited access and advanced features.",
  },
  {
    q: "What AI does it work with?",
    a: "UnClick works with Claude (by Anthropic), and any AI that supports MCP - a universal standard for AI tools.",
  },
  {
    q: "What's MCP?",
    a: "Model Context Protocol. Think of it as a universal adapter - like how USB-C lets you plug any charger into any phone. MCP lets any AI use any tool.",
  },
  {
    q: "Is it safe?",
    a: "Yes. Your data is processed in real-time and not stored. Credentials are encrypted. You control what your AI can access.",
  },
];

const HowItWorks = [
  {
    step: 1,
    title: "You talk to your AI",
    desc: "Just chat naturally. Ask it to check your schedule, send an email, or look something up.",
    icon: MessageSquare,
  },
  {
    step: 2,
    title: "AI uses UnClick's tools",
    desc: "Behind the scenes, the AI uses UnClick to actually do the task - like a personal assistant making calls on your behalf.",
    icon: Zap,
  },
  {
    step: 3,
    title: "You get the result",
    desc: "The AI comes back with the answer, the meeting booked, the email sent. No switching between apps.",
    icon: CheckCircle2,
  },
];

const PRODUCTS = [
  {
    name: "Tools",
    desc: "178+ integrations: email, weather, finance, social media, and more.",
    link: "/tools",
    icon: Wrench,
  },
  {
    name: "Memory",
    desc: "Your AI remembers your preferences, decisions, and past conversations.",
    link: "/memory",
    icon: Brain,
  },
  {
    name: "Organiser",
    desc: "Calendar, to-dos, and daily briefings in one unified place.",
    link: "/organiser",
    icon: Calendar,
  },
  {
    name: "BackstagePass",
    desc: "Secure credential management for authenticated services.",
    link: "/backstagepass",
    icon: Key,
  },
  {
    name: "Crews",
    desc: "Teams of AI agents working together on complex projects.",
    link: "/crews",
    icon: Users,
  },
  {
    name: "Arena",
    desc: "Test and compare different AI models side-by-side.",
    link: "/arena",
    icon: Trophy,
  },
];

const NewToAI = () => {
  useCanonical("/new-to-ai");

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
              <span className="font-mono text-xs font-medium text-primary">Start Here</span>
            </div>
          </FadeIn>

          <FadeIn delay={0.05}>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
              AI That Actually{" "}
              <span className="text-primary">Does Things For You</span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.1}>
            <p className="mt-4 text-lg text-body max-w-2xl mx-auto leading-relaxed">
              UnClick gives AI assistants the tools they need to help you - like giving a new employee the keys to the office, a phone, and a filing cabinet.
            </p>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#how"
                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("how")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                See What's Possible
              </a>
              <a
                href="#products"
                className="rounded-lg border border-border/60 bg-card/40 px-6 py-2.5 text-sm font-medium text-heading backdrop-blur-sm transition-colors hover:bg-card/70"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Jump to Products
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* What Is UnClick? */}
      <section id="how" className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              What is UnClick?
            </h2>
          </FadeIn>

          <FadeIn delay={0.1}>
            <p className="mt-4 text-lg text-body leading-relaxed max-w-2xl">
              Think of AI assistants like a very smart new hire on their first day. They're brilliant, but they can't do much without access to your tools. UnClick is everything that new hire needs to be productive:
            </p>
          </FadeIn>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {FEATURES.map((feature, i) => (
              <FadeIn key={feature.id} delay={0.05 * i}>
                <div className="rounded-xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/80">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-heading">{feature.title}</h3>
                      <p className="text-xs text-muted-foreground">{feature.subtitle}</p>
                    </div>
                  </div>
                  <p className="text-sm text-body leading-relaxed">
                    {feature.analogy}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 py-16 bg-card/30">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              How does it actually work?
            </h2>
          </FadeIn>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {HowItWorks.map((item, i) => (
              <FadeIn key={item.step} delay={0.05 * i}>
                <div className="relative">
                  <div className="rounded-xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm h-full">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm">
                        {item.step}
                      </div>
                      <h3 className="font-semibold text-heading text-sm">
                        {item.title}
                      </h3>
                    </div>
                    <p className="text-sm text-body leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                  {i < HowItWorks.length - 1 && (
                    <div className="hidden sm:flex absolute top-1/2 -right-4 transform -translate-y-1/2">
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Real Examples */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl mb-2">
              Real Examples
            </h2>
            <p className="text-body">
              Here's what you can actually ask your AI to do with UnClick:
            </p>
          </FadeIn>

          <div className="mt-8 space-y-3">
            {EXAMPLES.map((example, i) => (
              <FadeIn key={example} delay={0.03 * i}>
                <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-card/40 p-4 backdrop-blur-sm">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-body">{example}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="px-6 py-16 bg-card/30">
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              What about privacy?
            </h2>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="mt-6 rounded-xl border border-border/60 bg-card/60 p-8 backdrop-blur-sm">
              <div className="flex items-start gap-3 justify-center mb-4">
                <Lock className="h-6 w-6 text-primary shrink-0" />
              </div>
              <p className="text-body leading-relaxed">
                Your data stays yours. UnClick doesn't store your conversations, read your emails, or sell your information. The tools just pass information between you and the services you already use - like a translator, not a spy.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Products */}
      <section id="products" className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl mb-2">
              Products
            </h2>
            <p className="text-body">
              Choose what you need. They all work together.
            </p>
          </FadeIn>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {PRODUCTS.map((product, i) => (
              <FadeIn key={product.name} delay={0.03 * i}>
                <Link
                  to={product.link}
                  className="group block h-full rounded-xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/80"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <product.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-heading">{product.name}</h3>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                  <p className="text-sm text-body leading-relaxed">{product.desc}</p>
                </Link>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-16 bg-card/30">
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl mb-2">
              FAQ for Beginners
            </h2>
            <p className="text-body">
              Common questions about UnClick.
            </p>
          </FadeIn>

          <div className="mt-8 space-y-4">
            {FAQ.map((item, i) => (
              <FadeIn key={item.q} delay={0.03 * i}>
                <div className="rounded-lg border border-border/40 bg-card/40 p-5 backdrop-blur-sm">
                  <h3 className="font-semibold text-heading text-sm mb-2">
                    {item.q}
                  </h3>
                  <p className="text-sm text-body leading-relaxed">
                    {item.a}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <FadeIn>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Ready to give your AI{" "}
              <span className="text-primary">superpowers?</span>
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
                to="/tools"
                className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/40 px-6 py-3 text-sm font-medium text-heading backdrop-blur-sm transition-colors hover:bg-card/70"
              >
                Explore Tools <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default NewToAI;


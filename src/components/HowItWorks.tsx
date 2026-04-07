import FadeIn from "./FadeIn";
import { PlugZap, LayoutGrid, MessageSquare } from "lucide-react";

const steps = [
  {
    number: "1",
    Icon: PlugZap,
    title: "Connect",
    desc: "Add UnClick to Claude Desktop, Cursor, or any MCP-compatible AI. Paste one JSON config. Takes 30 seconds.",
  },
  {
    number: "2",
    Icon: LayoutGrid,
    title: "Browse",
    desc: "Your AI now has access to all 26 tools in the marketplace. No extra setup per tool.",
  },
  {
    number: "3",
    Icon: MessageSquare,
    title: "Use",
    desc: 'Just ask. "Shorten this link." "Make a QR code." Your AI handles the rest.',
  },
];

const HowItWorks = () => (
  <section id="how-it-works" className="relative mx-auto max-w-4xl px-6 py-24">
    <FadeIn>
      <div className="text-center mb-12">
        <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
          How It Works
        </span>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Three steps.
        </h2>
      </div>
    </FadeIn>

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {steps.map((step, i) => (
        <FadeIn key={step.number} delay={i * 0.1}>
          <div className="relative rounded-xl border border-border/50 bg-card/40 p-6 text-center hover:border-primary/30 hover:bg-card/60 transition-all">
            {/* Step number badge */}
            <div className="mb-4 flex justify-center">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                <step.Icon size={20} className="text-primary" strokeWidth={1.75} />
                <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary font-mono text-[10px] font-bold text-primary-foreground">
                  {step.number}
                </span>
              </div>
            </div>
            <h3 className="text-base font-semibold text-heading">{step.title}</h3>
            <p className="mt-2 text-sm text-body leading-relaxed">{step.desc}</p>
          </div>
        </FadeIn>
      ))}
    </div>

    <FadeIn delay={0.4}>
      <div className="mt-8 text-center">
        <a
          href="#install"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
        >
          See the install guide
          <span aria-hidden="true">↓</span>
        </a>
      </div>
    </FadeIn>
  </section>
);

export default HowItWorks;

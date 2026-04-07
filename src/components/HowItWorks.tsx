import FadeIn from "./FadeIn";
import { motion } from "framer-motion";

const steps = [
  {
    number: "01",
    title: "Pick your tools",
    desc: "Browse what's available: Link-in-Bio, Scheduling, and more on the way. Each tool is a clean API with full docs. No dashboard to poke around in first.",
  },
  {
    number: "02",
    title: "Sign up free",
    desc: "Just your email. No credit card, no setup wizard, no 14-day trial. You'll get an API key that covers all live tools immediately.",
  },
  {
    number: "03",
    title: "Your AI gets to work",
    desc: "Point your agent at the UnClick API. It calls endpoints directly and gets clean JSON responses. The whole thing takes under 100ms. No browser. No clicking.",
  },
];

const HowItWorks = () => (
  <section className="relative mx-auto max-w-3xl px-6 py-32">
    <FadeIn>
      <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
        How It Works
      </span>
    </FadeIn>
    <FadeIn delay={0.05}>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        Three steps. That's it.
      </h2>
    </FadeIn>
    <FadeIn delay={0.1}>
      <p className="mt-3 text-body">
        One API key. Every tool in the suite. No per-tool accounts, no extra setup.
      </p>
    </FadeIn>

    <div className="mt-14 relative">
      {/* Vertical connector line */}
      <div className="absolute left-[23px] top-0 bottom-0 w-px bg-gradient-to-b from-primary/40 via-primary/20 to-transparent hidden sm:block" />

      <div className="space-y-12">
        {steps.map((step, i) => (
          <FadeIn key={step.number} delay={i * 0.15}>
            <motion.div
              className="flex gap-6 items-start group"
              whileHover={{ x: 4 }}
              transition={{ duration: 0.2 }}
            >
              {/* Step number node */}
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full border border-primary/30 bg-card flex items-center justify-center font-mono text-sm text-primary group-hover:border-primary/60 group-hover:bg-primary/10 transition-all duration-300">
                  {step.number}
                </div>
                <div className="absolute inset-0 rounded-full bg-primary/10 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>

              <div className="pt-2">
                <h3 className="text-lg font-medium text-heading">{step.title}</h3>
                <p className="mt-1.5 text-sm text-body leading-relaxed">{step.desc}</p>
              </div>
            </motion.div>
          </FadeIn>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;

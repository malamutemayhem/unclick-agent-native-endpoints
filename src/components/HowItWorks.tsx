import FadeIn from "./FadeIn";
import { motion } from "framer-motion";

const steps = [
  {
    number: "01",
    title: "Your AI decides to act",
    desc: "An agent needs to schedule a meeting, send an email, or publish a link page.",
  },
  {
    number: "02",
    title: "One API call",
    desc: "Instead of navigating a human UI, it hits a clean REST endpoint.",
  },
  {
    number: "03",
    title: "Done in milliseconds",
    desc: "No browser automation. No scraping. No brittle workarounds. Just results.",
  },
];

const HowItWorks = () => (
  <section className="relative mx-auto max-w-3xl px-6 py-32">
    <FadeIn>
      <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
        How It Works
      </span>
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

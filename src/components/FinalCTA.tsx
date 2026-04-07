import FadeIn from "./FadeIn";
import { motion } from "framer-motion";

const FinalCTA = () => (
  <section className="relative py-32 overflow-hidden">
    {/* Aurora glow */}
    <div className="pointer-events-none absolute inset-0">
      <div className="aurora-blob absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-primary/[0.08] blur-[120px]" />
    </div>
    <div className="pointer-events-none absolute inset-0 animated-grid" />

    <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
      <FadeIn>
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
          Start using UnClick for free.
        </h2>
      </FadeIn>
      <FadeIn delay={0.1}>
        <p className="mt-4 text-body max-w-md mx-auto">
          Connect to your AI in under two minutes. All 26 tools included. No credit card.
        </p>
      </FadeIn>
      <FadeIn delay={0.2}>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <motion.a
            href="https://tally.so/r/mZdkxe"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 rounded-lg bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground"
            whileHover={{ scale: 1.03, boxShadow: "0 0 40px 8px rgba(226,185,59,0.25)" }}
            whileTap={{ scale: 0.98 }}
          >
            Get Started Free
            <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
          </motion.a>
          <a
            href="#developers"
            className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-7 py-3.5 text-sm font-medium text-heading backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/60"
          >
            List your first tool
          </a>
        </div>
      </FadeIn>
    </div>
  </section>
);

export default FinalCTA;

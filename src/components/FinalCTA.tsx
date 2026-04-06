import FadeIn from "./FadeIn";
import { motion } from "framer-motion";

const FinalCTA = () => (
  <section className="relative py-32 overflow-hidden">
    {/* Aurora glow */}
    <div className="pointer-events-none absolute inset-0">
      <div className="aurora-blob absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-primary/[0.08] blur-[120px]" />
    </div>
    <div className="pointer-events-none absolute inset-0 animated-grid" />

    <div className="relative z-10 mx-auto max-w-2xl px-6 text-center">
      <FadeIn>
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
          Let your AI stop pretending to be human.
        </h2>
      </FadeIn>
      <FadeIn delay={0.1}>
        <p className="mt-4 text-body max-w-md mx-auto">
          Just your email. Both tools included. No credit card.
          Be one of the first to try it.
        </p>
      </FadeIn>
      <FadeIn delay={0.2}>
        <motion.a
          href="/docs"
          className="group mt-10 inline-flex items-center gap-2 rounded-lg bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground"
          whileHover={{ scale: 1.03, boxShadow: "0 0 40px 8px rgba(226,185,59,0.25)" }}
          whileTap={{ scale: 0.98 }}
        >
          Get Started Free
          <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
        </motion.a>
      </FadeIn>
    </div>
  </section>
);

export default FinalCTA;

import FadeIn from "./FadeIn";
import { motion } from "framer-motion";

const Problem = () => (
  <section className="relative overflow-hidden">
    {/* Subtle side glow */}
    <div className="pointer-events-none absolute top-1/2 -left-40 -translate-y-1/2 w-[400px] h-[400px] bg-primary/[0.03] blur-[120px] rounded-full" />

    <div className="mx-auto max-w-2xl px-6 py-32">
      <FadeIn>
        <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
          Why This Exists
        </span>
      </FadeIn>
      <FadeIn delay={0.1}>
        <h2 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
          The tools exist. They just weren't built for machines.
        </h2>
      </FadeIn>
      <FadeIn delay={0.2}>
        <p className="mt-6 text-body leading-relaxed">
          Right now, asking your AI to update your link page is like asking someone to cook dinner
          while wearing oven mitts. They can do it — but it's slow, clumsy, and things break.
          Browser automation, screen scraping, brittle workarounds.
        </p>
      </FadeIn>
      <FadeIn delay={0.3}>
        <p className="mt-4 text-body leading-relaxed">
          UnClick takes the mitts off. We rebuilt the platforms your AI needs — Linktree, Calendly,
          and more — as clean REST APIs. Same functionality. One-tenth the effort.
        </p>
      </FadeIn>

      {/* Visual comparison */}
      <FadeIn delay={0.4}>
        <div className="mt-12 grid grid-cols-2 gap-4">
          <motion.div
            className="rounded-lg border border-destructive/20 bg-destructive/[0.03] p-5"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="text-xs font-mono text-destructive/60 uppercase tracking-wider mb-3">The old way</div>
            <div className="space-y-2 font-mono text-xs text-muted-foreground">
              <div className="line-through opacity-60">Open browser</div>
              <div className="line-through opacity-60">Navigate to page</div>
              <div className="line-through opacity-60">Fill form fields</div>
              <div className="line-through opacity-60">Click submit</div>
              <div className="line-through opacity-60">Wait for redirect</div>
              <div className="line-through opacity-60">Parse response</div>
            </div>
            <div className="mt-3 flex justify-between font-mono text-xs text-destructive/50">
              <span>~4,200ms</span>
              <span>~18,000 tokens</span>
            </div>
          </motion.div>

          <motion.div
            className="rounded-lg border border-primary/20 bg-primary/[0.03] p-5"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="text-xs font-mono text-primary/60 uppercase tracking-wider mb-3">The UnClick way</div>
            <div className="space-y-2 font-mono text-xs text-heading">
              <div>POST /v1/schedule/events</div>
              <div className="text-primary">→ 201 Created</div>
            </div>
            <div className="mt-3 flex justify-between font-mono text-xs text-primary/50">
              <span>~38ms</span>
              <span>~120 tokens</span>
            </div>
          </motion.div>
        </div>
      </FadeIn>
    </div>
  </section>
);

export default Problem;

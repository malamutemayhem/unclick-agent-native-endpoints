import FadeIn from "./FadeIn";
import { motion } from "framer-motion";

const Pricing = () => (
  <section id="pricing" className="mx-auto max-w-3xl px-6 py-32">
    <FadeIn>
      <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
        Pricing
      </span>
    </FadeIn>
    <FadeIn delay={0.05}>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        Start free. Stay free for a while.
      </h2>
    </FadeIn>
    <FadeIn delay={0.1}>
      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Free */}
        <motion.div
          className="glow-card rounded-xl border border-primary/40 bg-card/50 p-8 backdrop-blur-sm relative overflow-hidden"
          whileHover={{ y: -4 }}
          transition={{ duration: 0.3 }}
        >
          <div className="pointer-events-none absolute -top-16 -right-16 w-32 h-32 bg-primary/8 blur-[60px] rounded-full" />
          <div className="flex items-start justify-between">
            <h3 className="text-2xl font-semibold text-heading">Free</h3>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">Current</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Everything you need to build and ship.</p>
          <ul className="mt-6 space-y-3 text-sm text-body">
            <li className="flex items-center gap-2"><span className="text-primary">✓</span> Both tools included (Link-in-Bio + Scheduling)</li>
            <li className="flex items-center gap-2"><span className="text-primary">✓</span> 500 API calls / day</li>
            <li className="flex items-center gap-2"><span className="text-primary">✓</span> Webhooks</li>
            <li className="flex items-center gap-2"><span className="text-primary">✓</span> Full analytics</li>
            <li className="flex items-center gap-2"><span className="text-primary">✓</span> No credit card required</li>
          </ul>
          <motion.a
            href="/docs"
            className="mt-8 inline-block w-full rounded-lg bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            whileHover={{ scale: 1.01, boxShadow: "0 0 30px 4px rgba(226,185,59,0.2)" }}
            whileTap={{ scale: 0.99 }}
          >
            Get your free API key
          </motion.a>
        </motion.div>
        {/* Pro */}
        <motion.div
          className="relative rounded-xl border border-border/40 bg-card/30 p-8 backdrop-blur-sm overflow-hidden opacity-70"
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-start justify-between">
            <h3 className="text-2xl font-semibold text-heading">Pro</h3>
            <span className="rounded-full border border-border/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Coming Soon</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">For teams and production workloads.</p>
          <ul className="mt-6 space-y-3 text-sm text-body">
            <li className="flex items-center gap-2"><span className="text-muted-foreground">○</span> All free features</li>
            <li className="flex items-center gap-2"><span className="text-muted-foreground">○</span> 50,000 API calls / day</li>
            <li className="flex items-center gap-2"><span className="text-muted-foreground">○</span> All upcoming tools</li>
            <li className="flex items-center gap-2"><span className="text-muted-foreground">○</span> Priority support</li>
            <li className="flex items-center gap-2"><span className="text-muted-foreground">○</span> Custom rate limits</li>
          </ul>
          <div className="mt-8 w-full rounded-lg border border-border/40 py-2.5 text-center text-sm text-muted-foreground">
            Pricing TBA
          </div>
        </motion.div>
      </div>
    </FadeIn>
    <FadeIn delay={0.2}>
      <p className="mt-8 text-center text-sm text-muted-custom">
        Building something big? <a href="mailto:chris@unclick.world" className="text-body underline underline-offset-4 hover:text-heading transition-colors">Get in touch.</a>
      </p>
    </FadeIn>
  </section>
);

export default Pricing;

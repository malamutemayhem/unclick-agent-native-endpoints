import FadeIn from "./FadeIn";
import { motion } from "framer-motion";

const perks = [
  {
    icon: "◈",
    title: "80% revenue share",
    desc: "You keep 80% of everything your tool earns. No race to the bottom. We take 20% to cover infrastructure, payments, and support.",
  },
  {
    icon: "◎",
    title: "Automated security scanning",
    desc: "Every tool listing goes through automated security validation before it reaches users. Keeps the marketplace safe and takes the audit burden off you.",
  },
  {
    icon: "⊞",
    title: "Managed auth (coming soon)",
    desc: "Stop building your own API key management. UnClick handles authentication, rate limiting, and key rotation for every tool you list.",
  },
  {
    icon: "⊕",
    title: "Built-in distribution",
    desc: "List once, reach every agent that uses UnClick. Claude, OpenClaw, ChatGPT via MCP, Cursor - your tool shows up everywhere.",
  },
];

const ForDevelopers = () => (
  <section id="developers" className="relative overflow-hidden">
    <div className="pointer-events-none absolute top-1/2 -right-40 -translate-y-1/2 w-[500px] h-[500px] bg-primary/[0.03] blur-[120px] rounded-full" />

    <div className="mx-auto max-w-4xl px-6 py-24">
      <FadeIn>
        <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
          For Developers
        </span>
      </FadeIn>
      <FadeIn delay={0.05}>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Build tools. Earn 80%.
        </h2>
      </FadeIn>
      <FadeIn delay={0.1}>
        <p className="mt-4 text-body max-w-2xl leading-relaxed">
          Directories like Smithery and SkillsMP will list your MCP server for free. They will also earn
          nothing from it, pay you nothing, and do nothing when something breaks. UnClick is different.
          Build an API, list it here, and get paid when agents use it.
        </p>
      </FadeIn>

      <FadeIn delay={0.15}>
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {perks.map((perk, i) => (
            <FadeIn key={perk.title} delay={0.15 + i * 0.08}>
              <div className="rounded-lg border border-border/40 bg-card/30 p-6 hover:border-primary/20 hover:bg-card/50 transition-all">
                <span className="font-mono text-xl text-primary">{perk.icon}</span>
                <h3 className="mt-3 text-sm font-semibold text-heading">{perk.title}</h3>
                <p className="mt-2 text-xs text-body leading-relaxed">{perk.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </FadeIn>

      <FadeIn delay={0.5}>
        <div className="mt-12 rounded-xl border border-border/60 bg-card/30 p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <h3 className="text-lg font-semibold text-heading">Ready to list your tool?</h3>
              <p className="mt-2 text-sm text-body max-w-sm">
                You need a REST API and a short description. We handle the rest - listing, auth, billing, and distribution.
              </p>
            </div>
            <div className="flex flex-col gap-3 shrink-0">
              <motion.a
                href="mailto:hello@unclick.world"
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
                whileHover={{ scale: 1.03, boxShadow: "0 0 30px 6px rgba(226,185,59,0.2)" }}
                whileTap={{ scale: 0.98 }}
              >
                List your first tool
                <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
              </motion.a>
              <a
                href="/docs"
                className="text-center text-xs text-muted-foreground underline underline-offset-4 hover:text-body transition-colors"
              >
                Read the developer docs
              </a>
            </div>
          </div>
        </div>
      </FadeIn>
    </div>
  </section>
);

export default ForDevelopers;

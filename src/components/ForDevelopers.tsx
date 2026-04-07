import FadeIn from "./FadeIn";
import ToolSubmitForm from "./ToolSubmitForm";

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
          Other directories list tools. We sell them. Build a tool, list it on UnClick, and earn 80%
          every time an agent uses it. We handle auth, billing, and distribution.
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
        <div className="mt-12">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-heading">List your tool</h3>
            <p className="mt-2 text-sm text-body max-w-sm">
              You need a REST endpoint and a short description. We run a quick health check and you're in.
            </p>
          </div>
          <ToolSubmitForm />
          <a
            href="/docs"
            className="mt-4 inline-block text-xs text-muted-foreground underline underline-offset-4 hover:text-body transition-colors"
          >
            Read the developer docs
          </a>
        </div>
      </FadeIn>
    </div>
  </section>
);

export default ForDevelopers;

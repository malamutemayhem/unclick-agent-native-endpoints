import FadeIn from "./FadeIn";

const signals = [
  {
    icon: "◎",
    title: "Every tool is verified",
    desc: "All tools in the marketplace pass automated security scanning before listing. No unreviewed third-party code reaches your agent.",
  },
  {
    icon: "⊞",
    title: "One key, all tools",
    desc: "One API key covers every tool. No separate auth flows, no per-tool sign-ups, no managing multiple tokens.",
  },
  {
    icon: "⊕",
    title: "Open-source core",
    desc: "MIT-licensed SDKs. No lock-in. Inspect, fork, and contribute. The MCP server is public on GitHub.",
  },
  {
    icon: "◈",
    title: "Built for uptime",
    desc: "Deployed on Cloudflare Workers — globally distributed, zero cold starts. Your agents do not wait.",
  },
];

const TrustSignals = () => (
  <section className="mx-auto max-w-4xl px-6 py-24">
    <FadeIn>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {signals.map((s, i) => (
          <FadeIn key={s.title} delay={i * 0.08}>
            <div className="rounded-lg border border-border/40 bg-card/30 p-5">
              <span className="font-mono text-lg text-primary">{s.icon}</span>
              <h3 className="mt-3 text-sm font-medium text-heading">{s.title}</h3>
              <p className="mt-2 text-xs text-body leading-relaxed">{s.desc}</p>
            </div>
          </FadeIn>
        ))}
      </div>
    </FadeIn>
  </section>
);

export default TrustSignals;

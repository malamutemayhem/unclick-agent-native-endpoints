import FadeIn from "./FadeIn";

const signals = [
  {
    icon: "◎",
    title: "API-first architecture",
    desc: "Every feature is available via API before it ever gets a UI. If it's in the product, it's in the endpoints.",
  },
  {
    icon: "⊞",
    title: "Open-source friendly",
    desc: "MIT-licensed SDKs. No lock-in. Inspect, fork, and contribute. We're building in public.",
  },
  {
    icon: "⊕",
    title: "Australian made",
    desc: "Built in Melbourne. Data sovereignty options available. No surprise US data transfers.",
  },
  {
    icon: "◈",
    title: "99.9% uptime target",
    desc: "Deployed on Cloudflare Workers. Globally distributed, zero cold starts. Your agents don't wait.",
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

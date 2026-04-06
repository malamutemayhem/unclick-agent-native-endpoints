import FadeIn from "./FadeIn";

const Problem = () => (
  <section className="mx-auto max-w-2xl px-6 py-32">
    <FadeIn>
      <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
        Why This Exists
      </span>
    </FadeIn>
    <FadeIn delay={0.1}>
      <h2 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
        The tools already exist. The APIs don't.
      </h2>
    </FadeIn>
    <FadeIn delay={0.2}>
      <p className="mt-6 text-body leading-relaxed">
        Your AI agent can't book a meeting on Calendly. It can't update a Linktree. It can't send a
        newsletter on Beehiiv. These platforms were designed for humans staring at screens and
        clicking buttons.
      </p>
    </FadeIn>
    <FadeIn delay={0.3}>
      <p className="mt-4 text-body leading-relaxed">
        We rebuilt them as APIs. Same functionality. Built for machines.
      </p>
    </FadeIn>
  </section>
);

export default Problem;

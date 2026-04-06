import FadeIn from "./FadeIn";

const FinalCTA = () => (
  <section className="relative py-32">
    <div className="pointer-events-none absolute inset-0 glow-primary-soft" />
    <div className="relative z-10 mx-auto max-w-2xl px-6 text-center">
      <FadeIn>
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Let your AI stop pretending to be human.
        </h2>
      </FadeIn>
      <FadeIn delay={0.1}>
        <p className="mt-4 text-sm text-muted-custom">beneath the UI</p>
      </FadeIn>
      <FadeIn delay={0.2}>
        <a
          href="#"
          className="mt-10 inline-block rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Get Your API Key
        </a>
      </FadeIn>
    </div>
  </section>
);

export default FinalCTA;

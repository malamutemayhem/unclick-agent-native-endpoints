import FadeIn from "./FadeIn";

const Hero = () => (
  <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
    <div className="pointer-events-none absolute inset-0 dot-grid" />
    <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] glow-primary-soft" />
    <div className="relative z-10 mx-auto max-w-3xl text-center">
      <FadeIn>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
          Your AI was never meant to click buttons.
        </h1>
      </FadeIn>
      <FadeIn delay={0.15}>
        <p className="mt-6 text-lg text-body sm:text-xl">
          Agent-native APIs that replace the platforms your AI can't use.
        </p>
      </FadeIn>
      <FadeIn delay={0.3}>
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

export default Hero;

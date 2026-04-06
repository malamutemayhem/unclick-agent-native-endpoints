import FadeIn from "./FadeIn";

const Pricing = () => (
  <section id="pricing" className="mx-auto max-w-3xl px-6 py-32">
    <FadeIn>
      <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
        Pricing
      </span>
    </FadeIn>
    <FadeIn delay={0.1}>
      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Free */}
        <div className="rounded-lg border border-border p-8">
          <h3 className="text-2xl font-semibold text-heading">Free</h3>
          <ul className="mt-6 space-y-3 text-sm text-body">
            <li>100 calls / day</li>
            <li>One tool</li>
          </ul>
          <a
            href="#"
            className="mt-8 inline-block w-full rounded-md border border-border py-2.5 text-center text-sm font-medium text-heading transition-colors hover:bg-secondary"
          >
            Start free
          </a>
        </div>
        {/* Pro */}
        <div className="rounded-lg border border-primary p-8">
          <h3 className="text-2xl font-semibold text-heading">$19/mo</h3>
          <ul className="mt-6 space-y-3 text-sm text-body">
            <li>All tools</li>
            <li>5,000 calls / day</li>
            <li>Webhooks</li>
          </ul>
          <a
            href="#"
            className="mt-8 inline-block w-full rounded-md bg-primary py-2.5 text-center text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Start building
          </a>
        </div>
      </div>
    </FadeIn>
    <FadeIn delay={0.2}>
      <p className="mt-8 text-center text-sm text-muted-custom">
        Need more? <a href="#" className="text-body underline underline-offset-4 hover:text-heading">Talk to us.</a>
      </p>
    </FadeIn>
  </section>
);

export default Pricing;

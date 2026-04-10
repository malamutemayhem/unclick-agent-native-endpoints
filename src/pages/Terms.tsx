import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeIn from "@/components/FadeIn";
import { useCanonical } from "@/hooks/use-canonical";
import { useMetaTags } from "@/hooks/useMetaTags";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-12">
    <h2 className="text-xl font-semibold text-heading">{title}</h2>
    <div className="mt-4 space-y-3 text-sm text-body leading-relaxed">{children}</div>
  </section>
);

const TermsPage = () => {
  useCanonical("/terms");
  useMetaTags({
    title: "Terms of Service - UnClick",
    ogTitle: "Terms of Service - UnClick",
    ogDescription: "Terms of Service for UnClick, the AI agent tool marketplace.",
    ogUrl: "https://unclick.world/terms",
  });

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 pb-32 pt-28">
        <FadeIn>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Terms of Service</h1>
          <p className="mt-3 text-sm text-muted-custom">Effective date: April 10, 2026. Last updated: April 10, 2026.</p>
        </FadeIn>

        <FadeIn delay={0.05}>
          <p className="mt-6 text-body leading-relaxed">
            These are the rules for using UnClick. We have tried to write them in plain English. If something is unclear, email us at{" "}
            <a href="mailto:hello@unclick.world" className="text-primary underline underline-offset-4">hello@unclick.world</a>.
          </p>
        </FadeIn>

        <FadeIn delay={0.08}>
          <Section title="1. What UnClick is">
            <p>
              UnClick is an AI agent tool marketplace. We give AI agents access to hundreds of callable API endpoints across dozens of integrations,
              delivered via the MCP (Model Context Protocol). One install gives an agent the ability to browse, discover, and call tools - without you
              having to wire up each integration manually.
            </p>
            <p>
              By using UnClick, you agree to these terms. If you are using UnClick on behalf of a company or organisation, you are agreeing on their behalf too.
            </p>
          </Section>
        </FadeIn>

        <FadeIn delay={0.1}>
          <Section title="2. Your account and API keys">
            <p>
              To use UnClick, you create an account and generate API keys. You are responsible for keeping your keys secure. Do not share them in public
              repositories, chat logs, or anywhere they could be exposed.
            </p>
            <p>
              If you suspect a key has been compromised, revoke it immediately from your settings page. We are not liable for charges or actions resulting
              from a leaked key.
            </p>
            <p>
              You must be at least 13 years old to create an account. If you are under 18, you need a parent or guardian's permission.
            </p>
          </Section>
        </FadeIn>

        <FadeIn delay={0.12}>
          <Section title="3. Acceptable use">
            <p>You can use UnClick to build applications, automate tasks, and give AI agents access to external services. That is what we are here for.</p>
            <p>You cannot use UnClick to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Violate any law or regulation</li>
              <li>Harass, abuse, or harm others</li>
              <li>Send spam or unsolicited messages through any connected tool</li>
              <li>Attempt to access other users' data or accounts</li>
              <li>Reverse engineer or extract our proprietary systems</li>
              <li>Deliberately overload our infrastructure or run denial-of-service attacks</li>
              <li>Use our platform to build tools that themselves violate these rules</li>
            </ul>
            <p>
              We reserve the right to suspend or terminate accounts that violate these rules, with or without notice depending on severity.
            </p>
          </Section>
        </FadeIn>

        <FadeIn delay={0.14}>
          <Section title="4. Third-party tools and API behaviour">
            <p>
              UnClick acts as a proxy. When an agent calls a tool through us, we route that request to a third-party API (Slack, Google, Stripe, or wherever
              the tool connects). We are not responsible for what those third-party services do with the request, how they respond, or any downtime or errors
              on their end.
            </p>
            <p>
              Your use of third-party services through UnClick is also governed by those services' own terms and policies. We strongly recommend reading
              them before connecting.
            </p>
            <p>
              We do not guarantee that any specific third-party integration will remain available. Integrations can be added, changed, or removed as
              external APIs evolve.
            </p>
          </Section>
        </FadeIn>

        <FadeIn delay={0.16}>
          <Section title="5. Intellectual property">
            <p>
              UnClick's code, brand, and platform are owned by UnClick Pty Ltd. You may not copy, reproduce, or redistribute them without permission.
            </p>
            <p>
              If you contribute a tool to the UnClick marketplace through our developer platform, you retain ownership of your tool's code. By submitting it,
              you grant us a licence to list, proxy, and document it within the UnClick platform.
            </p>
            <p>
              Nothing in these terms transfers ownership of your data or your tools to us.
            </p>
          </Section>
        </FadeIn>

        <FadeIn delay={0.18}>
          <Section title="6. Payment">
            <p>
              UnClick currently offers a free tier. Paid plans may be introduced in future, at which point we will notify users in advance and give you
              a reasonable window to decide whether to upgrade or continue on a free tier.
            </p>
            <p>
              If and when paid features are introduced, billing will be handled via Stripe. All prices will be listed in USD unless otherwise stated.
              Refund terms will be specified at the time of purchase.
            </p>
          </Section>
        </FadeIn>

        <FadeIn delay={0.2}>
          <Section title="7. Limitation of liability">
            <p>
              We provide UnClick as-is. We do not guarantee it will be error-free, always available, or perfectly suited to your needs.
            </p>
            <p>
              To the maximum extent permitted by law, UnClick Pty Ltd is not liable for any indirect, incidental, special, or consequential damages
              arising from your use of the platform - including lost profits, lost data, or business interruption.
            </p>
            <p>
              Our total liability to you for any claim will not exceed the amount you paid us in the 12 months before the claim arose, or AUD $100 if
              no payments were made.
            </p>
          </Section>
        </FadeIn>

        <FadeIn delay={0.22}>
          <Section title="8. Termination">
            <p>
              You can stop using UnClick and delete your account at any time from your settings page. When you do, your credentials and stored data will
              be deleted in accordance with our Privacy Policy.
            </p>
            <p>
              We can suspend or terminate your account if you violate these terms, if we are required to by law, or if we decide to discontinue the service.
              In the case of a service shutdown, we will give you at least 30 days notice where possible.
            </p>
          </Section>
        </FadeIn>

        <FadeIn delay={0.24}>
          <Section title="9. Changes to these terms">
            <p>
              We may update these terms from time to time. If we make material changes, we will notify you by email or by a notice in the app. Continued
              use of UnClick after a change takes effect means you accept the updated terms.
            </p>
            <p>
              The current version of these terms is always available at{" "}
              <a href="/terms" className="text-primary underline underline-offset-4">unclick.world/terms</a>.
            </p>
          </Section>
        </FadeIn>

        <FadeIn delay={0.26}>
          <Section title="10. Governing law">
            <p>
              These terms are governed by the laws of Victoria, Australia. Any disputes will be resolved in the courts of Victoria, unless applicable
              consumer law in your jurisdiction requires otherwise.
            </p>
          </Section>
        </FadeIn>

        <FadeIn delay={0.28}>
          <Section title="11. Contact">
            <p>
              Questions about these terms? Email us at{" "}
              <a href="mailto:hello@unclick.world" className="text-primary underline underline-offset-4">hello@unclick.world</a>.
            </p>
          </Section>
        </FadeIn>
      </main>
      <Footer />
    </div>
  );
};

export default TermsPage;

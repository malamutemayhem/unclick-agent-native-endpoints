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

const PrivacyPage = () => {
  useCanonical("/privacy");
  useMetaTags({
    title: "Privacy Policy - UnClick",
    ogTitle: "Privacy Policy - UnClick",
    ogDescription: "Privacy Policy for UnClick, the AI agent tool marketplace.",
    ogUrl: "https://unclick.world/privacy",
  });

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 pb-32 pt-28">
        <FadeIn>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Privacy Policy</h1>
          <p className="mt-3 text-sm text-muted-custom">Effective date: April 10, 2026. Last updated: April 10, 2026.</p>
        </FadeIn>

        <FadeIn delay={0.05}>
          <p className="mt-6 text-body leading-relaxed">
            We take privacy seriously. This policy explains what data we collect, why we collect it, and what we do with it. If you have questions,
            email us at{" "}
            <a href="mailto:hello@unclick.world" className="text-primary underline underline-offset-4">hello@unclick.world</a>.
          </p>
        </FadeIn>

        <FadeIn delay={0.08}>
          <Section title="1. What we collect">
            <p>We collect the minimum needed to run the service:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                <strong className="text-heading">Account information</strong> - your email address and any profile details you provide when signing up.
              </li>
              <li>
                <strong className="text-heading">API keys and credentials</strong> - keys you store in your UnClick vault so your agents can call connected
                services. These are encrypted at rest using AES-256-GCM. We do not store them in plaintext anywhere.
              </li>
              <li>
                <strong className="text-heading">Usage data</strong> - which tools are called, when, and whether they succeeded or failed. This is used
                to monitor for abuse, enforce rate limits, and help you debug.
              </li>
              <li>
                <strong className="text-heading">Analytics</strong> - aggregate, anonymous page-view data collected via Umami. Umami does not use cookies
                and does not collect personally identifiable information. We use it to understand how the site is used.
              </li>
              <li>
                <strong className="text-heading">Payment information</strong> - if and when paid plans are introduced, payment details are handled entirely
                by Stripe. We never see or store your full card number.
              </li>
            </ul>
          </Section>
        </FadeIn>

        <FadeIn delay={0.1}>
          <Section title="2. How we use your data">
            <p>We use your data to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Provide the UnClick service - route API calls, manage your credentials, and keep your account running</li>
              <li>Monitor for abuse and enforce our acceptable use policy</li>
              <li>Send transactional emails (account confirmations, key expiry notices, billing receipts)</li>
              <li>Understand aggregate usage patterns so we can improve the platform</li>
              <li>Comply with legal obligations if required</li>
            </ul>
          </Section>
        </FadeIn>

        <FadeIn delay={0.12}>
          <Section title="3. What we don't do">
            <p>To be direct about it:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>We do not sell your data to anyone</li>
              <li>We do not share your API credentials or secrets with third parties (other than routing them to the intended API endpoint)</li>
              <li>We do not use your data to train AI models</li>
              <li>We do not use your data for advertising or tracking across other websites</li>
              <li>We do not read the contents of API calls your agents make beyond what is needed to route and log them</li>
            </ul>
          </Section>
        </FadeIn>

        <FadeIn delay={0.14}>
          <Section title="4. Third-party services we use">
            <p>UnClick is built on top of several third-party services. Here is what each one handles:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                <strong className="text-heading">Supabase</strong> - database and authentication backend. Your account data and encrypted credentials
                are stored here, protected by row-level security policies.
              </li>
              <li>
                <strong className="text-heading">Vercel</strong> - hosting and serverless functions. All traffic is served over HTTPS.
              </li>
              <li>
                <strong className="text-heading">Umami</strong> - privacy-friendly analytics. No cookies, no personal data.
              </li>
              <li>
                <strong className="text-heading">Stripe</strong> - payment processing for any future paid features.
              </li>
            </ul>
            <p>
              Each of these providers has their own privacy policy. We choose providers that meet a high standard for data handling and security.
            </p>
          </Section>
        </FadeIn>

        <FadeIn delay={0.16}>
          <Section title="5. Security">
            <p>
              Credentials stored in your UnClick vault are encrypted with AES-256-GCM before being written to the database. The encryption keys are
              separate from the database itself.
            </p>
            <p>
              We use Supabase Row Level Security (RLS) so that your data can only be accessed by your account. All traffic between you and UnClick is
              over HTTPS. Internal API calls between our services are authenticated.
            </p>
            <p>
              No system is 100% secure. If you discover a security vulnerability, please email us at{" "}
              <a href="mailto:hello@unclick.world" className="text-primary underline underline-offset-4">hello@unclick.world</a>{" "}
              and we will respond promptly.
            </p>
          </Section>
        </FadeIn>

        <FadeIn delay={0.18}>
          <Section title="6. Data retention">
            <p>We retain data as follows:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                <strong className="text-heading">Credentials and API keys</strong> - stored until you delete them or close your account
              </li>
              <li>
                <strong className="text-heading">Usage logs</strong> - retained for 90 days, then deleted
              </li>
              <li>
                <strong className="text-heading">Analytics</strong> - aggregated and anonymised, retained indefinitely
              </li>
              <li>
                <strong className="text-heading">Account data</strong> - retained until you delete your account, after which it is removed within 30 days
              </li>
            </ul>
          </Section>
        </FadeIn>

        <FadeIn delay={0.2}>
          <Section title="7. Your rights">
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong className="text-heading">Access</strong> - request a copy of the personal data we hold about you</li>
              <li><strong className="text-heading">Correction</strong> - ask us to fix inaccurate data</li>
              <li><strong className="text-heading">Deletion</strong> - request that we delete your account and associated data</li>
              <li><strong className="text-heading">Portability</strong> - request your data in a machine-readable format</li>
              <li><strong className="text-heading">Opt out</strong> - unsubscribe from any non-transactional emails at any time</li>
            </ul>
            <p>
              To exercise any of these rights, email{" "}
              <a href="mailto:hello@unclick.world" className="text-primary underline underline-offset-4">hello@unclick.world</a>.
              We will respond within 30 days.
            </p>
          </Section>
        </FadeIn>

        <FadeIn delay={0.22}>
          <Section title="8. Australian Privacy Act">
            <p>
              UnClick Pty Ltd is an Australian company and complies with the Australian Privacy Act 1988 and the Australian Privacy Principles (APPs).
            </p>
            <p>
              If you are an Australian resident and believe we have not handled your personal information in accordance with the Privacy Act, you may
              lodge a complaint with the Office of the Australian Information Commissioner (OAIC) at{" "}
              <span className="text-heading">oaic.gov.au</span>.
            </p>
          </Section>
        </FadeIn>

        <FadeIn delay={0.24}>
          <Section title="9. GDPR (for EU users)">
            <p>
              If you are in the European Economic Area, you have additional rights under the General Data Protection Regulation (GDPR). Our lawful
              basis for processing your data is contract performance (to provide the service you signed up for) and legitimate interests (to keep the
              platform secure and working).
            </p>
            <p>
              You may lodge a complaint with your local data protection authority if you believe your rights have been violated.
            </p>
          </Section>
        </FadeIn>

        <FadeIn delay={0.26}>
          <Section title="10. Children's privacy">
            <p>
              UnClick is not designed for or directed at children under 13. We do not knowingly collect personal information from anyone under 13.
              If you believe a child under 13 has created an account, please contact us and we will delete it promptly.
            </p>
          </Section>
        </FadeIn>

        <FadeIn delay={0.28}>
          <Section title="11. Changes to this policy">
            <p>
              We may update this policy from time to time. If we make material changes, we will notify you by email or by a notice in the app.
              The current version is always available at{" "}
              <a href="/privacy" className="text-primary underline underline-offset-4">unclick.world/privacy</a>.
            </p>
          </Section>
        </FadeIn>

        <FadeIn delay={0.3}>
          <Section title="12. Contact">
            <p>
              Privacy questions? Email{" "}
              <a href="mailto:hello@unclick.world" className="text-primary underline underline-offset-4">hello@unclick.world</a>.
            </p>
          </Section>
        </FadeIn>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPage;

import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Github,
  Database,
  Cloud,
  CreditCard,
  Shield,
  MessageSquare,
  Zap,
  BarChart2,
  Mail,
  BookOpen,
  Globe,
  Key,
  CheckCircle2,
  Circle,
  Cpu,
  ShoppingBag,
  Radio,
  FileText,
  Layers,
  TrendingUp,
  Send,
  Mic,
  Video,
  Eye,
  Copy,
  Check,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeIn from "@/components/FadeIn";
import { useMetaTags } from "@/hooks/useMetaTags";
import { SITE_STATS } from "@/config/site-stats";

// ---- Platform data ----

const PLATFORMS: {
  name: string;
  category: string;
  description: string;
  icon: React.ElementType;
}[] = [
  // Developer Tools
  { name: "GitHub", category: "Developer Tools", description: "Repos, issues, PRs, and code search", icon: Github },
  { name: "Supabase", category: "Developer Tools", description: "Postgres database and auth layer", icon: Database },
  { name: "Vercel", category: "Developer Tools", description: "Deploy and manage serverless projects", icon: Cloud },
  { name: "Cloudflare", category: "Developer Tools", description: "DNS, Workers, and security controls", icon: Shield },
  { name: "DigitalOcean", category: "Developer Tools", description: "Droplets, apps, and managed databases", icon: Cloud },
  { name: "Railway", category: "Developer Tools", description: "Deploy apps and services instantly", icon: Zap },
  { name: "Netlify", category: "Developer Tools", description: "Static sites and serverless functions", icon: Globe },
  { name: "Neon", category: "Developer Tools", description: "Serverless Postgres with branching", icon: Database },
  { name: "Render", category: "Developer Tools", description: "Web services, cron jobs, and DBs", icon: Cloud },
  { name: "Fly.io", category: "Developer Tools", description: "Run apps close to your users", icon: Globe },
  // Business
  { name: "Stripe", category: "Business", description: "Payments, subscriptions, and billing", icon: CreditCard },
  { name: "Shopify", category: "Business", description: "Store management and order operations", icon: ShoppingBag },
  { name: "LemonSqueezy", category: "Business", description: "SaaS billing for indie developers", icon: CreditCard },
  { name: "Gumroad", category: "Business", description: "Sell digital products directly", icon: ShoppingBag },
  { name: "Xero", category: "Business", description: "Accounting, invoices, and reports", icon: FileText },
  // Communication
  { name: "Slack", category: "Communication", description: "Team messaging and notifications", icon: MessageSquare },
  { name: "Discord", category: "Communication", description: "Community servers and bot actions", icon: Radio },
  { name: "Twilio", category: "Communication", description: "SMS, voice, and WhatsApp messaging", icon: Send },
  // Productivity
  { name: "Notion", category: "Productivity", description: "Pages, databases, and blocks", icon: BookOpen },
  { name: "Airtable", category: "Productivity", description: "Structured data and base operations", icon: Layers },
  { name: "Linear", category: "Productivity", description: "Issue tracking and project cycles", icon: TrendingUp },
  { name: "ConvertKit", category: "Productivity", description: "Email sequences and subscriber management", icon: Mail },
  // AI / ML
  { name: "OpenAI", category: "AI/ML", description: "GPT models, embeddings, and images", icon: Cpu },
  { name: "Anthropic", category: "AI/ML", description: "Claude models and completions", icon: Cpu },
  { name: "Groq", category: "AI/ML", description: "Ultra-fast LLM inference", icon: Zap },
  { name: "Mistral", category: "AI/ML", description: "European open-weight models", icon: Cpu },
  { name: "Cohere", category: "AI/ML", description: "Enterprise embeddings and RAG", icon: Cpu },
  { name: "Perplexity", category: "AI/ML", description: "Live web-grounded answers", icon: Eye },
  { name: "Higgsfield", category: "AI/ML", description: "AI video generation platform", icon: Video },
  { name: "HeyGen", category: "AI/ML", description: "Avatar and talking-head video", icon: Video },
  { name: "Runway", category: "AI/ML", description: "Gen-2 and Gen-3 video creation", icon: Video },
  { name: "Pika", category: "AI/ML", description: "Text-to-video from prompts", icon: Video },
  { name: "Kling", category: "AI/ML", description: "Cinematic AI video synthesis", icon: Video },
  // Analytics
  { name: "Umami", category: "Analytics", description: "Privacy-first web analytics", icon: BarChart2 },
  { name: "Mixpanel", category: "Analytics", description: "Product analytics and funnels", icon: BarChart2 },
  { name: "Segment", category: "Analytics", description: "Customer data pipeline", icon: BarChart2 },
  // Email
  { name: "Mailchimp", category: "Email", description: "Email campaigns and automations", icon: Mail },
  { name: "SendGrid", category: "Email", description: "Transactional and bulk email delivery", icon: Mail },
  { name: "Postmark", category: "Email", description: "Fast, reliable transactional email", icon: Mail },
  { name: "Resend", category: "Email", description: "Developer-first email API", icon: Mail },
  // Audio / Media
  { name: "AssemblyAI", category: "AI/ML", description: "Speech recognition and audio intelligence", icon: Mic },
];

const CATEGORY_ORDER = [
  "Developer Tools",
  "AI/ML",
  "Business",
  "Communication",
  "Analytics",
  "Email",
  "Productivity",
];

const CATEGORY_COLORS: Record<string, string> = {
  "Developer Tools": "text-sky-400 bg-sky-400/10 border-sky-400/20",
  "AI/ML": "text-violet-400 bg-violet-400/10 border-violet-400/20",
  Business: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  Communication: "text-green-400 bg-green-400/10 border-green-400/20",
  Analytics: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  Email: "text-pink-400 bg-pink-400/10 border-pink-400/20",
  Productivity: "text-teal-400 bg-teal-400/10 border-teal-400/20",
};

// ---- Subcomponents ----

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="font-mono text-xs text-muted-foreground transition-colors hover:text-heading"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function InlineCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      aria-label="Copy to clipboard"
      className="flex items-center gap-1.5 rounded border border-border/40 bg-card/40 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-primary" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      <span>{copied ? "Copied!" : "Copy"}</span>
    </button>
  );
}

function PlatformCard({ platform }: { platform: (typeof PLATFORMS)[0] }) {
  const Icon = platform.icon;
  const catColor = CATEGORY_COLORS[platform.category] ?? "text-primary bg-primary/10 border-primary/20";
  return (
    <div className="group flex flex-col gap-3 rounded-xl border border-border/40 bg-card/20 p-4 transition-colors hover:border-primary/30 hover:bg-card/40">
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-card/40">
          <Icon className="h-4 w-4 text-body" />
        </div>
        <Circle className="h-3 w-3 shrink-0 text-border/60 mt-0.5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-heading">{platform.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{platform.description}</p>
      </div>
      <span className={`self-start rounded border px-1.5 py-0.5 font-mono text-[10px] ${catColor}`}>
        {platform.category}
      </span>
    </div>
  );
}

// ---- Main page ----

const INSTALL_CMD = "npx @unclick/mcp-server";

const STEPS = [
  {
    number: "01",
    title: "Install UnClick",
    code: "npx @unclick/mcp-server",
    desc: "One npm command. Your AI gets 4 tools instantly. No config files, no setup wizard.",
  },
  {
    number: "02",
    title: "Connect your platforms",
    code: 'unclick_call("keychain_connect", { platform: "github", apiKey: "..." })',
    desc: "Your agent calls keychain_connect with your API key. Encrypted, validated, stored. One call per platform.",
  },
  {
    number: "03",
    title: "Your AI just works",
    code: 'unclick_call("github_list_repos", {})',
    desc: "Every tool call is authenticated automatically. You never think about credentials again.",
  },
];

const SECURITY_BULLETS = [
  "Your credentials are encrypted with AES-256-GCM before they touch our database.",
  "We validate every key works before storing it - no dead credentials.",
  "Zero-knowledge design: we encrypt with your UnClick API key, not ours.",
  "Every connection attempt is logged for your audit trail.",
];

const PRICING = [
  {
    name: "Free",
    price: "$0",
    period: "",
    features: [
      "5 platform connections",
      "1,000 API calls / month",
      "AES-256-GCM encryption",
      "Key validation on connect",
    ],
    highlight: false,
    cta: "Get Started",
  },
  {
    name: "Pro",
    price: "$19",
    period: "/mo",
    features: [
      "Unlimited connections",
      "50,000 API calls / month",
      "Priority support",
      "Auto bug reporting",
    ],
    highlight: true,
    cta: "Get Started",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    features: [
      "Custom call limits",
      "SSO and audit logs",
      "SLA guarantee",
      "Dedicated support",
    ],
    highlight: false,
    cta: "Contact Us",
  },
];

export default function BackstagePassPage() {
  useMetaTags({
    title: "BackstagePass - Your AI's Backstage Pass | UnClick",
    description:
      "Connect your platforms once. Your AI agent handles the rest. BackstagePass is UnClick's encrypted credential vault for AI agents - supporting 53 platforms.",
    ogTitle: "BackstagePass - Your AI's Backstage Pass | UnClick",
    ogDescription:
      "Connect once. Your agent handles the rest. No more hunting for API keys. 53 platforms, AES-256-GCM encryption.",
    ogUrl: "https://unclick.world/backstagepass",
  });

  const groupedPlatforms = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    platforms: PLATFORMS.filter((p) => p.category === cat),
  })).filter((g) => g.platforms.length > 0);

  return (
    <div className="min-h-screen">
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "BackstagePass by UnClick",
            description:
              "Credential vault and platform connection system for AI agents. Connect once, your agent handles the rest.",
            applicationCategory: "DeveloperApplication",
            operatingSystem: "Any",
            url: "https://unclick.world/backstagepass",
            offers: [
              { "@type": "Offer", price: "0", priceCurrency: "USD", name: "Free" },
              { "@type": "Offer", price: "19", priceCurrency: "USD", name: "Pro" },
            ],
          }),
        }}
      />

      <Navbar />

      {/* ---- Hero ---- */}
      <section className="mx-auto max-w-5xl px-6 pb-24 pt-36 text-center">
        <FadeIn>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs text-primary">
            <Key className="h-3 w-3" />
            BackstagePass
          </span>
        </FadeIn>
        <FadeIn delay={0.05}>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight text-heading sm:text-6xl">
            Your AI's backstage pass<br className="hidden sm:block" /> to every platform
          </h1>
        </FadeIn>
        <FadeIn delay={0.1}>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-body leading-relaxed">
            Connect once. Your agent handles the rest. No more hunting for API keys, no more copy-pasting between dashboards.
          </p>
        </FadeIn>
        <FadeIn delay={0.15}>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="#setup"
              className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Get Started
            </a>
            <Link
              to="/docs"
              className="rounded-md border border-border/60 bg-card/20 px-6 py-2.5 text-sm font-medium text-heading transition-colors hover:bg-card/40"
            >
              Read the docs
            </Link>
          </div>
        </FadeIn>
        <FadeIn delay={0.2}>
          <p className="mt-6 text-xs text-muted-foreground">
            {SITE_STATS.BACKSTAGEPASS_PLATFORMS} platforms supported. More every week.
          </p>
        </FadeIn>
      </section>

      {/* ---- Pain Point: Old Way vs New Way ---- */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <FadeIn>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Old Way */}
            <div className="rounded-xl border border-border/30 bg-card/10 p-6">
              <p className="mb-4 font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
                The old way
              </p>
              <ul className="space-y-1.5 text-xs text-muted-foreground/60 leading-relaxed">
                <li>Open GitHub.</li>
                <li>Navigate to Settings.</li>
                <li>Click Developer Settings.</li>
                <li>Click Personal Access Tokens.</li>
                <li>Click Generate new token.</li>
                <li>Read the scope descriptions.</li>
                <li>Select the scopes you think you need.</li>
                <li>Click Generate token.</li>
                <li>Copy it before it disappears.</li>
                <li>Paste it somewhere safe.</li>
                <li>Repeat for Stripe.</li>
                <li>Repeat for Slack.</li>
                <li>Repeat for every platform.</li>
                <li className="pt-1 text-muted-foreground/40 italic">Hope you remember where you saved them.</li>
              </ul>
            </div>

            {/* New Way */}
            <div className="flex flex-col justify-center rounded-xl border border-primary/30 bg-primary/[0.04] p-6">
              <p className="mb-4 font-mono text-[10px] font-medium uppercase tracking-widest text-primary/60">
                The new way
              </p>
              <p className="font-mono text-xl font-semibold text-primary sm:text-2xl">
                "connect my GitHub"
              </p>
              <p className="mt-3 text-sm text-body">
                Tell your AI. Done.
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Every platform has a settings page buried three clicks deep. Your AI shouldn't need you to navigate it.
          </p>
        </FadeIn>
      </section>

      {/* ---- How It Works ---- */}
      <section id="setup" className="mx-auto max-w-5xl px-6 pb-24">
        <FadeIn>
          <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
            How it works
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-heading">
            Three steps, then forget about credentials
          </h2>
        </FadeIn>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <FadeIn key={step.number} delay={i * 0.07}>
              <div className="flex h-full flex-col rounded-xl border border-border/40 bg-card/20 p-6">
                <span className="font-mono text-3xl font-bold text-primary/40">{step.number}</span>
                <h3 className="mt-4 text-base font-semibold text-heading">{step.title}</h3>
                <p className="mt-2 flex-1 text-sm text-body leading-relaxed">{step.desc}</p>
                <div className="mt-4 overflow-hidden rounded-lg border border-border/30 bg-[#0d0d0d]">
                  <div className="flex items-center justify-between border-b border-border/20 px-3 py-1.5">
                    <span className="font-mono text-[10px] text-muted-foreground">terminal</span>
                    {step.number === "01" ? (
                      <InlineCopyButton code={step.code} />
                    ) : (
                      <CopyButton code={step.code} />
                    )}
                  </div>
                  <pre className="overflow-x-auto px-3 py-2.5">
                    <code className="font-mono text-[11px] leading-relaxed text-body">{step.code}</code>
                  </pre>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ---- Platform Grid ---- */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <FadeIn>
          <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
            Supported platforms
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-heading">
            Every platform your agent needs
          </h2>
          <p className="mt-3 text-body">
            Connect any combination. Each platform stores independently - revoke one without touching the others.
          </p>
        </FadeIn>

        <div className="mt-10 space-y-12">
          {groupedPlatforms.map((group, gi) => (
            <FadeIn key={group.category} delay={gi * 0.04}>
              <div>
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className={`rounded border px-2 py-0.5 font-mono text-xs ${
                      CATEGORY_COLORS[group.category] ?? "text-primary bg-primary/10 border-primary/20"
                    }`}
                  >
                    {group.category}
                  </span>
                  <span className="text-xs text-muted-foreground">{group.platforms.length} platforms</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {group.platforms.map((platform) => (
                    <PlatformCard key={platform.name} platform={platform} />
                  ))}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ---- Security ---- */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <FadeIn>
          <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-8">
            <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
              Security
            </span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-heading">
              Built to hold real credentials
            </h2>
            <ul className="mt-6 space-y-3">
              {SECURITY_BULLETS.map((bullet, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm text-body leading-relaxed">{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        </FadeIn>
      </section>

      {/* ---- For Developers ---- */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <FadeIn>
          <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
            For developers
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-heading">
            Build tools that use BackstagePass
          </h2>
          <p className="mt-3 max-w-2xl text-body leading-relaxed">
            Your tools can call{" "}
            <code className="rounded bg-card/40 px-1.5 py-0.5 font-mono text-xs text-primary">
              keychainGetCredential(platform)
            </code>{" "}
            to access stored credentials. Users connect once - your tool just works for them automatically.
          </p>
        </FadeIn>
        <FadeIn delay={0.06}>
          <div className="mt-8 overflow-hidden rounded-xl border border-border/40 bg-[#0d0d0d]">
            <div className="flex items-center justify-between border-b border-border/30 px-4 py-2">
              <span className="font-mono text-xs text-muted-foreground">my-github-tool.ts</span>
              <CopyButton
                code={`import { keychainGetCredential } from "@unclick/sdk";

export const githubTools = [
  {
    name: "list_my_repos",
    description: "Lists the authenticated user's GitHub repositories.",
    inputSchema: { type: "object", properties: {}, required: [] },
    handler: async (_args: any) => {
      const token = await keychainGetCredential("github");
      const res = await fetch("https://api.github.com/user/repos", {
        headers: { Authorization: \`Bearer \${token}\` }
      });
      if (!res.ok) throw new Error(\`GitHub error: \${res.status}\`);
      return res.json();
    }
  }
];`}
              />
            </div>
            <pre className="overflow-x-auto p-5">
              <code className="font-mono text-xs leading-relaxed text-body">{`import { keychainGetCredential } from "@unclick/sdk";

export const githubTools = [
  {
    name: "list_my_repos",
    description: "Lists the authenticated user's GitHub repositories.",
    inputSchema: { type: "object", properties: {}, required: [] },
    handler: async (_args: any) => {
      const token = await keychainGetCredential("github");
      const res = await fetch("https://api.github.com/user/repos", {
        headers: { Authorization: \`Bearer \${token}\` }
      });
      if (!res.ok) throw new Error(\`GitHub error: \${res.status}\`);
      return res.json();
    }
  }
];`}</code>
            </pre>
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link
              to="/developers/docs"
              className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Read the SDK docs
            </Link>
            <span className="text-sm text-body">
              80% revenue split on every tool you build.
            </span>
          </div>
        </FadeIn>
      </section>

      {/* ---- Pricing ---- */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <FadeIn>
          <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
            Pricing
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-heading">
            Simple, honest tiers
          </h2>
          <p className="mt-2 text-sm text-body">
            All tiers are currently free during the launch period.
          </p>
        </FadeIn>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {PRICING.map((tier, i) => (
            <FadeIn key={tier.name} delay={i * 0.07}>
              <div
                className={`flex h-full flex-col rounded-xl border p-6 ${
                  tier.highlight
                    ? "border-primary/40 bg-primary/[0.06]"
                    : "border-border/40 bg-card/20"
                }`}
              >
                {tier.highlight && (
                  <span className="mb-3 self-start rounded border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
                    Most popular
                  </span>
                )}
                <p className="text-sm font-semibold text-heading">{tier.name}</p>
                <div className="mt-2 flex items-baseline gap-0.5">
                  <span className="text-3xl font-bold text-heading">{tier.price}</span>
                  {tier.period && (
                    <span className="text-sm text-muted-foreground">{tier.period}</span>
                  )}
                </div>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="text-sm text-body">{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="#setup"
                  className={`mt-6 rounded-md px-4 py-2 text-center text-sm font-medium transition-opacity hover:opacity-90 ${
                    tier.highlight
                      ? "bg-primary text-primary-foreground"
                      : "border border-border/60 bg-card/20 text-heading hover:bg-card/40"
                  }`}
                >
                  {tier.cta}
                </a>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.25}>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            All tiers include encryption, key validation, and auto bug-reporting. No credit card required to start.
          </p>
        </FadeIn>
      </section>

      {/* ---- CTA Footer ---- */}
      <section className="mx-auto max-w-5xl px-6 pb-32">
        <FadeIn>
          <div className="rounded-2xl border border-border/40 bg-card/20 px-8 py-12 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs text-primary">
              <Key className="h-3 w-3" />
              BackstagePass
            </span>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-heading">
              Ready to give your AI backstage access?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-body">
              Install UnClick, then tell your agent to connect your platforms. Takes under 2 minutes.
            </p>
            <div className="mx-auto mt-8 w-fit overflow-hidden rounded-xl border border-border/40 bg-[#0d0d0d]">
              <div className="flex items-center justify-between border-b border-border/30 px-4 py-2">
                <span className="font-mono text-xs text-muted-foreground">terminal</span>
                <CopyButton code={INSTALL_CMD} />
              </div>
              <pre className="px-6 py-3">
                <code className="font-mono text-sm text-primary">{INSTALL_CMD}</code>
              </pre>
            </div>
            <p className="mt-5 text-sm text-body">
              Then tell your AI:{" "}
              <span className="font-mono text-xs text-primary">connect my GitHub</span>
            </p>
          </div>
        </FadeIn>
      </section>

      <Footer />
    </div>
  );
}

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";

type Section =
  | "quick-start"
  | "tool-template"
  | "submission-guide"
  | "revenue"
  | "standards"
  | "rejection-reasons"
  | "faq";

const NAV_ITEMS: { id: Section; label: string }[] = [
  { id: "quick-start", label: "Quick Start" },
  { id: "tool-template", label: "Tool Template" },
  { id: "submission-guide", label: "Submission Guide" },
  { id: "revenue", label: "Revenue & Payments" },
  { id: "standards", label: "Tool Standards" },
  { id: "rejection-reasons", label: "Rejection Reasons" },
  { id: "faq", label: "FAQ" },
];

// Real working example using Open-Meteo (free, no API key required)
const TOOL_TEMPLATE = `export const weatherTools = [
  {
    name: "get_current_weather",
    description: "Returns current weather conditions for a given location.",
    inputSchema: {
      type: "object",
      properties: {
        latitude: {
          type: "number",
          description: "Latitude of the location."
        },
        longitude: {
          type: "number",
          description: "Longitude of the location."
        }
      },
      required: ["latitude", "longitude"]
    },
    handler: async (args: any) => {
      const { latitude, longitude } = args;
      const res = await fetch(
        \`https://api.open-meteo.com/v1/forecast\` +
        \`?latitude=\${latitude}&longitude=\${longitude}&current_weather=true\`
      );
      if (!res.ok) throw new Error(\`Open-Meteo returned \${res.status}\`);
      const data = await res.json();
      return data.current_weather;
    }
  }
];`;

// Template for tools that need an API key via vault-bridge
const KEYED_TEMPLATE = `import { resolveCredential } from './vault-bridge';

export const myApiTools = [
  {
    name: "my_service_search",
    description: "Searches MyService and returns matching results.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query."
        },
        api_key: {
          type: "string",
          description: "Optional. Your MyService API key."
        }
      },
      required: ["query"]
    },
    handler: async (args: any) => {
      const key = await resolveCredential(args.api_key, 'MY_SERVICE_KEY');
      const res = await fetch(
        \`https://api.myservice.com/v1/search?q=\${encodeURIComponent(args.query)}\`,
        { headers: { Authorization: \`Bearer \${key}\` } }
      );
      if (!res.ok) throw new Error(\`MyService returned \${res.status}: \${await res.text()}\`);
      return await res.json();
    }
  }
];`;

function CodeBlock({ code, filename }: { code: string; filename?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border/40 bg-[#0d0d0d]">
      <div className="flex items-center justify-between border-b border-border/30 px-4 py-2">
        <span className="font-mono text-xs text-muted-foreground">{filename || "TypeScript"}</span>
        <button
          onClick={copy}
          className="font-mono text-xs text-muted-foreground transition-colors hover:text-heading"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-5">
        <code className="font-mono text-xs leading-relaxed text-body">{code}</code>
      </pre>
    </div>
  );
}

function InlineCode({ children }: { children: string }) {
  return (
    <code className="rounded bg-card/50 px-1.5 py-0.5 font-mono text-xs text-heading">
      {children}
    </code>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/20 p-6 space-y-4">
      {children}
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-heading">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-body leading-relaxed">{children}</p>;
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm text-body">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function QuickStartSection() {
  return (
    <div className="space-y-4">
      <SectionCard>
        <H2>Quick Start</H2>
        <P>
          Your tool is a TypeScript file. It gets called by AI agents. Here is what it looks like.
        </P>
        <P>
          This guide gets you from zero to a working, submittable tool in about 15 minutes.
          You need Node.js 18 or later.
        </P>
      </SectionCard>

      <SectionCard>
        <h3 className="text-sm font-semibold text-heading">Step 1: Install the SDK (2 min)</h3>
        <CodeBlock code={`npm install @unclick/tool-sdk`} />
        <P>This gives you the vault-bridge helper and the local test runner.</P>
      </SectionCard>

      <SectionCard>
        <h3 className="text-sm font-semibold text-heading">Step 2: Create your tool file (8 min)</h3>
        <P>
          Create a new file. Export an array of tool definitions. Each tool has four fields: a name,
          a description, an input schema, and a handler function that makes the API call.
        </P>
        <P>
          The example below wraps Open-Meteo, which is free and needs no API key. Copy it and use it
          as your starting point.
        </P>
        <CodeBlock code={TOOL_TEMPLATE} filename="weather-tools.ts" />
      </SectionCard>

      <SectionCard>
        <h3 className="text-sm font-semibold text-heading">Step 3: Test it locally (3 min)</h3>
        <CodeBlock code={`npx unclick test ./weather-tools.ts \\
  --call get_current_weather \\
  --args '{"latitude": -33.87, "longitude": 151.21}'`} />
        <P>
          This runs your handler directly and prints the response. No network mocking, no setup.
          If it works here, it will work on UnClick.
        </P>
      </SectionCard>

      <SectionCard>
        <h3 className="text-sm font-semibold text-heading">Step 4: Submit (2 min)</h3>
        <P>
          Head to{" "}
          <Link to="/developers/submit" className="text-primary underline underline-offset-4">
            /developers/submit
          </Link>{" "}
          and paste your tool file or link your GitHub repo.
          We review founding developer submissions within 24 hours and send feedback either way.
        </P>
      </SectionCard>
    </div>
  );
}

function ToolTemplateSection() {
  return (
    <div className="space-y-4">
      <SectionCard>
        <H2>Tool File Template</H2>
        <P>
          Two patterns: one for tools that need no API key, and one for tools that need credentials.
          Both follow the same structure.
        </P>
      </SectionCard>

      <div className="rounded-xl border border-border/40 bg-card/20 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-heading">Pattern 1: No API key required</h3>
        <P>
          Use this when the API is public. Open-Meteo, Numbers API, and most government data APIs
          fall into this category.
        </P>
        <CodeBlock code={TOOL_TEMPLATE} filename="weather-tools.ts (copy-paste ready)" />
      </div>

      <div className="rounded-xl border border-border/40 bg-card/20 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-heading">Pattern 2: API key via vault-bridge</h3>
        <P>
          Use this when the API requires authentication. The{" "}
          <InlineCode>resolveCredential</InlineCode> helper tries the user's arg first, then their
          saved vault, then a server environment variable. Never hardcode a key.
        </P>
        <CodeBlock code={KEYED_TEMPLATE} filename="my-api-tools.ts" />
      </div>

      <SectionCard>
        <h3 className="text-sm font-semibold text-heading">vault-bridge lookup order</h3>
        <ol className="space-y-2 list-none">
          {[
            "The value the user passed in args (fastest, no vault needed)",
            "The credential saved in the user's UnClick vault under the given key",
            "A server environment variable matching the key name",
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-body">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[10px] text-primary">
                {i + 1}
              </span>
              {item}
            </li>
          ))}
        </ol>
        <P>
          If no credential is found after all three steps, it throws a descriptive error that the AI
          agent can relay to the user.
        </P>
      </SectionCard>

      <SectionCard>
        <h3 className="text-sm font-semibold text-heading">Input schema tips</h3>
        <BulletList items={[
          "Keep field descriptions short and specific. AI agents read them to decide what to pass.",
          "Only mark fields as required if the tool genuinely cannot run without them.",
          "The api_key field should always be optional. vault-bridge handles the fallback.",
          "Avoid deeply nested schemas. Flat is easier for agents to reason about.",
        ]} />
      </SectionCard>
    </div>
  );
}

function SubmissionGuideSection() {
  return (
    <div className="space-y-4">
      <SectionCard>
        <H2>Submission Guide</H2>
        <P>
          Submit via{" "}
          <Link to="/developers/submit" className="text-primary underline underline-offset-4">
            /developers/submit
          </Link>{" "}
          or email your tool file to tools@unclick.world.
        </P>
      </SectionCard>

      <SectionCard>
        <h3 className="text-sm font-semibold text-heading">What to include</h3>
        <BulletList items={[
          "Tool name",
          "A short description of what it does",
          "Your TypeScript tool file (or a GitHub repo link)",
          "Contact email for review feedback",
        ]} />
        <P>That is all. Category is optional and we will assign one if you leave it blank.</P>
      </SectionCard>

      <SectionCard>
        <h3 className="text-sm font-semibold text-heading">Review criteria</h3>
        <BulletList items={[
          "Tool works as described and returns valid JSON",
          "Uses vault-bridge for all credential handling",
          "No hardcoded secrets or credentials anywhere in the file",
          "Tool and field descriptions follow the writing standards",
          "Error handling is in place for failed API calls",
          "API usage is within the upstream provider's terms of service",
        ]} />
      </SectionCard>

      <SectionCard>
        <h3 className="text-sm font-semibold text-heading">Review timeline</h3>
        <P>
          Founding developers (first 50) get reviewed within 24 hours.
          After that, standard review is within 48 hours. You will receive direct feedback either
          way. Rejections include specific issues to fix. There is no limit on resubmissions.
        </P>
      </SectionCard>
    </div>
  );
}

function RevenueSection() {
  return (
    <div className="space-y-4">
      <SectionCard>
        <H2>Revenue &amp; Payments</H2>
        <P>
          You earn 80% of every call your tool receives. UnClick keeps 20% to cover infrastructure,
          support, and platform costs.
        </P>
      </SectionCard>

      <SectionCard>
        <h3 className="text-sm font-semibold text-heading">How the split works</h3>
        <div className="space-y-3">
          {[
            { label: "Rate per call", value: "$0.001" },
            { label: "Your share", value: "80%" },
            { label: "Your earnings per call", value: "$0.0008" },
            { label: "At 50,000 calls/month", value: "$40.00" },
            { label: "At 100,000 calls/month", value: "$80.00" },
            { label: "At 500,000 calls/month", value: "$400.00" },
            { label: "At 1,000,000 calls/month", value: "$800.00" },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between border-t border-border/30 pt-3 first:border-0 first:pt-0"
            >
              <span className="text-sm text-body">{row.label}</span>
              <span className="font-mono text-sm font-medium text-heading">{row.value}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <h3 className="text-sm font-semibold text-heading">Payout schedule</h3>
        <BulletList items={[
          "Payouts run on the 1st of each month for the previous month's earnings.",
          "No Stripe account required to start building or earning.",
          "Connect Stripe when you want to withdraw. You can let earnings accumulate first.",
          "Payouts are made via Stripe. You set up your payout method in your developer profile.",
        ]} />
      </SectionCard>

      <SectionCard>
        <h3 className="text-sm font-semibold text-heading">Earnings dashboard</h3>
        <P>
          Your developer dashboard shows real-time call counts, revenue by tool, and payout history.
          Available after your first tool goes live.
        </P>
      </SectionCard>
    </div>
  );
}

function StandardsSection() {
  return (
    <div className="space-y-4">
      <SectionCard>
        <H2>Tool Standards</H2>
        <P>These standards keep UnClick tools consistent, easy for AI agents to use, and safe for users.</P>
      </SectionCard>

      <SectionCard>
        <h3 className="text-sm font-semibold text-heading">Writing tool descriptions</h3>
        <BulletList items={[
          "Descriptions must be plain English. No dashes used as punctuation, no jargon, no marketing language.",
          "Start with a verb: \"Searches for...\", \"Returns...\", \"Creates...\", \"Fetches...\"",
          "Keep descriptions under 120 characters. AI models use these to route tool calls.",
          "Field descriptions should explain what the field is, not what type it is.",
        ]} />
      </SectionCard>

      <SectionCard>
        <h3 className="text-sm font-semibold text-heading">Error handling</h3>
        <BulletList items={[
          "Always check res.ok on fetch responses. Throw a descriptive error if false.",
          "Error messages should be readable by an AI agent relaying them to a user.",
          "Do not return null on failure. Throw or return a structured error object.",
        ]} />
        <CodeBlock code={`// Good
if (!res.ok) throw new Error(\`MyAPI returned \${res.status}: \${await res.text()}\`);

// Bad - silent failure, agent has no idea what went wrong
if (!res.ok) return null;`} />
      </SectionCard>

      <SectionCard>
        <h3 className="text-sm font-semibold text-heading">Credential pattern</h3>
        <P>
          Always accept an optional <InlineCode>api_key</InlineCode> argument and pass it as the first
          argument to <InlineCode>resolveCredential</InlineCode>. This lets users provide keys at call
          time without pre-configuring a vault entry.
        </P>
        <CodeBlock code={`const key = await resolveCredential(args.api_key, 'MYAPI_KEY');`} />
      </SectionCard>

      <SectionCard>
        <h3 className="text-sm font-semibold text-heading">Naming conventions</h3>
        <BulletList items={[
          "Tool names use snake_case and follow the pattern service_action (e.g. github_search_repos).",
          "Export array name uses camelCase: githubTools, weatherTools, abrTools.",
          "File name matches the export: weather-tools.ts exports weatherTools.",
        ]} />
      </SectionCard>
    </div>
  );
}

const REJECTION_REASONS = [
  {
    reason: "Hardcoded API key or secret in the tool file",
    fix: "Move all credentials to resolveCredential. Even for testing, never commit a real key.",
  },
  {
    reason: "Tool description contains jargon or marketing language",
    fix: "Rewrite to start with a verb and describe what the tool literally does in plain English.",
  },
  {
    reason: "Fetch call does not check res.ok",
    fix: "Add if (!res.ok) throw new Error(...) after every fetch call.",
  },
  {
    reason: "Tool returns undefined or null on error instead of throwing",
    fix: "Throw a descriptive Error object. Agents need to know what went wrong.",
  },
  {
    reason: "Tool does not work as described",
    fix: "Run npx unclick test locally and verify the output matches the description before submitting.",
  },
  {
    reason: "API terms of service prohibit this use",
    fix: "Check the TOS for the API you are wrapping. If reselling or proxying is prohibited, choose a different API.",
  },
  {
    reason: "Tool name does not follow snake_case naming",
    fix: "Rename to service_action format (e.g. openmeteo_get_weather, not getWeatherOpenMeteo).",
  },
  {
    reason: "inputSchema has required fields that should be optional",
    fix: "The api_key field must always be optional. Review other fields too.",
  },
];

function RejectionReasonsSection() {
  return (
    <div className="space-y-4">
      <SectionCard>
        <H2>Common Rejection Reasons</H2>
        <P>
          Most rejections come down to one of these eight issues. Fix them before submitting and your
          tool will almost certainly pass on the first try.
        </P>
      </SectionCard>

      <div className="space-y-3">
        {REJECTION_REASONS.map((item, i) => (
          <div key={i} className="rounded-xl border border-border/40 bg-card/20 p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-400/10 font-mono text-[10px] text-rose-400">
                {i + 1}
              </span>
              <div className="space-y-2">
                <p className="text-sm font-medium text-heading">{item.reason}</p>
                <p className="text-sm text-body leading-relaxed">
                  <span className="font-medium text-primary">Fix:</span> {item.fix}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const FAQ_ITEMS = [
  {
    q: "Do I need to own the API I'm wrapping?",
    a: "No. You just need to be allowed to use it. Most public APIs with free tiers are fine. Check the API's terms of service before submitting.",
  },
  {
    q: "What happens if the upstream API changes or breaks?",
    a: "Your tool will start returning errors. We will notify you and give you 14 days to push a fix before the tool is temporarily suspended.",
  },
  {
    q: "Can I submit multiple tools?",
    a: "Yes, as many as you like. Each tool earns independently.",
  },
  {
    q: "Can I update a tool after it's live?",
    a: "Yes. Submit the updated file via the submission form. Updates go through a fast-track review, usually under 24 hours.",
  },
  {
    q: "How do I test my tool before submitting?",
    a: "Run: npx unclick test ./my-tool.ts --call tool_name --args '{\"key\":\"value\"}'. This runs your handler locally and logs the output.",
  },
  {
    q: "What if my tool wraps a paid API?",
    a: "That is fine. Make the api_key field optional and use vault-bridge. Users with their own API keys can use the tool without any extra setup.",
  },
  {
    q: "Do I need to create an account to submit?",
    a: "No. Just fill in the submission form with your contact email. We will follow up there.",
  },
];

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <SectionCard>
        <H2>FAQ</H2>
        <P>Common questions from developers building on UnClick.</P>
      </SectionCard>

      <div className="space-y-2">
        {FAQ_ITEMS.map((item, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-border/40 bg-card/20">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-heading transition-colors hover:bg-card/40"
            >
              {item.q}
              <span className="ml-4 shrink-0 font-mono text-muted-foreground">
                {open === i ? "−" : "+"}
              </span>
            </button>
            {open === i && (
              <div className="border-t border-border/30 px-5 py-4">
                <p className="text-sm text-body leading-relaxed">{item.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const SECTION_CONTENT: Record<Section, React.ReactNode> = {
  "quick-start": <QuickStartSection />,
  "tool-template": <ToolTemplateSection />,
  "submission-guide": <SubmissionGuideSection />,
  revenue: <RevenueSection />,
  standards: <StandardsSection />,
  "rejection-reasons": <RejectionReasonsSection />,
  faq: <FAQSection />,
};

export default function DeveloperDocsPage() {
  const [active, setActive] = useState<Section>("quick-start");

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 pb-32 pt-28">
        <div className="mb-8">
          <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
            Developer Docs
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-heading">
            Build tools for UnClick
          </h1>
          <p className="mt-1 text-sm text-body">
            Everything you need to write, submit, and earn from your tools.
          </p>
        </div>

        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="w-48 shrink-0">
            <nav className="sticky top-24 flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  className={`rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    active === item.id
                      ? "bg-primary/10 text-heading font-medium"
                      : "text-body hover:bg-card/40 hover:text-heading"
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <div className="mt-4 border-t border-border/30 pt-4">
                <Link
                  to="/developers/submit"
                  className="block rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Submit a Tool
                </Link>
              </div>
            </nav>
          </aside>

          {/* Content */}
          <div className="min-w-0 flex-1">{SECTION_CONTENT[active]}</div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

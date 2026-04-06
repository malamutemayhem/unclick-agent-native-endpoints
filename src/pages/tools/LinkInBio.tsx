import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeIn from "@/components/FadeIn";
import { motion } from "framer-motion";

const endpoints = [
  { method: "POST",   path: "/v1/links/pages",                             desc: "Create a new link page" },
  { method: "GET",    path: "/v1/links/pages",                             desc: "List all your link pages" },
  { method: "GET",    path: "/v1/links/pages/:page_id",                    desc: "Get a single page" },
  { method: "PATCH",  path: "/v1/links/pages/:page_id",                    desc: "Update page title, slug, or settings" },
  { method: "DELETE", path: "/v1/links/pages/:page_id",                    desc: "Delete a page" },
  { method: "POST",   path: "/v1/links/pages/:page_id/links",              desc: "Add a link to a page" },
  { method: "GET",    path: "/v1/links/pages/:page_id/links",              desc: "List all links on a page" },
  { method: "PATCH",  path: "/v1/links/pages/:page_id/links/:id",          desc: "Update a link (label, URL, position)" },
  { method: "DELETE", path: "/v1/links/pages/:page_id/links/:id",          desc: "Remove a link" },
  { method: "POST",   path: "/v1/links/pages/:page_id/socials",            desc: "Add a social profile link" },
  { method: "GET",    path: "/v1/links/pages/:page_id/socials",            desc: "List social links" },
  { method: "DELETE", path: "/v1/links/pages/:page_id/socials/:id",        desc: "Remove a social link" },
  { method: "GET",    path: "/v1/links/pages/:page_id/analytics",          desc: "Page views, clicks, and CTR" },
  { method: "GET",    path: "/v1/links/pages/:page_id/analytics/timeseries", desc: "Analytics over time" },
  { method: "GET",    path: "/v1/links/pages/:page_id/analytics/top-links",  desc: "Most clicked links" },
  { method: "GET",    path: "/v1/links/pages/:page_id/analytics/geo",        desc: "Visitors by country" },
  { method: "GET",    path: "/v1/links/pages/:page_id/analytics/devices",    desc: "Desktop vs mobile split" },
  { method: "POST",   path: "/v1/links/pages/:page_id/theme",              desc: "Apply a built-in theme" },
  { method: "PATCH",  path: "/v1/links/pages/:page_id/theme",              desc: "Customise colours, fonts, CSS" },
  { method: "GET",    path: "/v1/themes",                                   desc: "List available themes" },
  { method: "POST",   path: "/v1/links/domains",                           desc: "Add a custom domain" },
  { method: "GET",    path: "/v1/links/domains",                           desc: "List custom domains" },
  { method: "DELETE", path: "/v1/links/domains/:domain",                   desc: "Remove a custom domain" },
  { method: "POST",   path: "/track/:page_id/click",                       desc: "Track a link click (public)" },
];

const methodColor: Record<string, string> = {
  GET: "text-sky-400",
  POST: "text-emerald-400",
  PATCH: "text-amber-400",
  DELETE: "text-rose-400",
};

const createExample = [
  'curl -X POST https://api.unclick.world/v1/links/pages \\',
  '  -H "Authorization: Bearer YOUR_API_KEY" \\',
  '  -H "Content-Type: application/json" \\',
  "  -d '{",
  '    "slug": "your-name",',
  '    "title": "Your Name",',
  '    "links": [',
  '      { "label": "My website", "url": "https://yoursite.com" },',
  '      { "label": "Book a call", "url": "https://cal.com/yourname" }',
  '    ]',
  "  }'",
].join("\n");

const LinkInBioPage = () => (
  <div className="min-h-screen">
    <Navbar />
    <main className="mx-auto max-w-4xl px-6 pb-32 pt-28">
      <FadeIn>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs text-primary">Live · Free</span>
          <span className="font-mono text-xs text-muted-foreground">/v1/links</span>
        </div>
      </FadeIn>
      <FadeIn delay={0.05}>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Link-in-Bio API</h1>
      </FadeIn>
      <FadeIn delay={0.1}>
        <p className="mt-4 max-w-2xl text-body text-lg leading-relaxed">
          Create and manage shareable link pages. Your AI can publish a page, add links, apply themes,
          and pull analytics without touching a dashboard. Think Linktree, built for machines.
        </p>
      </FadeIn>
      <FadeIn delay={0.15}>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href="https://tally.so/r/mZdkxe"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-primary px-5 py-2.5 text-center text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Get Started Free: Link-in-Bio
          </a>
          <a
            href="/docs#link-in-bio"
            className="rounded-lg border border-border/60 px-5 py-2.5 text-center text-sm font-medium text-heading hover:border-primary/30 transition-colors"
          >
            Full API Reference
          </a>
        </div>
      </FadeIn>

      <FadeIn delay={0.2}>
        <div className="mt-16">
          <h2 className="text-xl font-semibold text-heading">Quick example</h2>
          <p className="mt-2 text-sm text-body">Create a link page in one API call:</p>
          <div className="mt-4 overflow-hidden rounded-xl border border-border/60 bg-[hsl(0_0%_6.5%)]">
            <div className="flex items-center gap-2 border-b border-border/40 px-5 py-3">
              <div className="h-2.5 w-2.5 rounded-full bg-[hsl(0_70%_45%)]" />
              <div className="h-2.5 w-2.5 rounded-full bg-[hsl(44_70%_50%)]" />
              <div className="h-2.5 w-2.5 rounded-full bg-[hsl(140_50%_40%)]" />
            </div>
            <pre className="overflow-x-auto p-6 font-mono text-xs text-heading leading-relaxed whitespace-pre-wrap">{createExample}</pre>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.25}>
        <div className="mt-16">
          <h2 className="text-xl font-semibold text-heading">Endpoints ({endpoints.length})</h2>
          <p className="mt-1 text-sm text-body">All require <code className="font-mono text-xs bg-card/50 px-1.5 py-0.5 rounded">Authorization: Bearer YOUR_API_KEY</code> except /track.</p>
          <div className="mt-6 divide-y divide-border/30 rounded-xl border border-border/40 overflow-hidden">
            {endpoints.map((ep) => (
              <motion.div
                key={ep.method + ep.path}
                className="flex flex-col gap-1 bg-card/20 px-5 py-4 sm:flex-row sm:items-center sm:gap-6 hover:bg-card/40 transition-colors"
                whileHover={{ x: 2 }}
                transition={{ duration: 0.15 }}
              >
                <span className={`w-14 shrink-0 font-mono text-xs font-bold ${methodColor[ep.method] ?? "text-heading"}`}>
                  {ep.method}
                </span>
                <code className="font-mono text-xs text-heading flex-1 break-all">{ep.path}</code>
                <span className="text-xs text-body sm:text-right sm:w-48 shrink-0">{ep.desc}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.3}>
        <div className="mt-12 rounded-lg border border-border/40 bg-card/30 p-5">
          <h3 className="text-sm font-medium text-heading">Authentication</h3>
          <p className="mt-2 text-sm text-body">
            All endpoints require the <code className="font-mono text-xs bg-card/50 px-1.5 py-0.5 rounded">links:read</code> or{" "}
            <code className="font-mono text-xs bg-card/50 px-1.5 py-0.5 rounded">links:write</code> scope.
            Pass your key as <code className="font-mono text-xs bg-card/50 px-1.5 py-0.5 rounded">Authorization: Bearer YOUR_API_KEY</code>.
          </p>
        </div>
      </FadeIn>
    </main>
    <Footer />
  </div>
);

export default LinkInBioPage;

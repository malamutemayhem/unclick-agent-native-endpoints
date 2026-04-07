import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeIn from "@/components/FadeIn";
import { useCanonical } from "@/hooks/use-canonical";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

interface Endpoint {
  method: Method;
  path: string;
  desc: string;
  auth?: string;
}

interface Group {
  id: string;
  title: string;
  description: string;
  endpoints: Endpoint[];
}

const methodColor: Record<Method, string> = {
  GET: "text-sky-400 bg-sky-400/10",
  POST: "text-emerald-400 bg-emerald-400/10",
  PATCH: "text-amber-400 bg-amber-400/10",
  DELETE: "text-rose-400 bg-rose-400/10",
};

const groups: Group[] = [
  {
    id: "link-in-bio",
    title: "Link-in-Bio",
    description: "Create and manage shareable link pages. Pages can contain links, social profiles, themes, and custom domains.",
    endpoints: [
      { method: "POST",   path: "/v1/links/pages",                             desc: "Create a new link page",                     auth: "links:write" },
      { method: "GET",    path: "/v1/links/pages",                             desc: "List all link pages",                         auth: "links:read" },
      { method: "GET",    path: "/v1/links/pages/:page_id",                    desc: "Get a single page",                           auth: "links:read" },
      { method: "PATCH",  path: "/v1/links/pages/:page_id",                    desc: "Update page title, slug, or visibility",      auth: "links:write" },
      { method: "DELETE", path: "/v1/links/pages/:page_id",                    desc: "Delete a page (soft delete)",                 auth: "links:write" },
      { method: "POST",   path: "/v1/links/pages/:page_id/links",              desc: "Add a link to a page",                        auth: "links:write" },
      { method: "GET",    path: "/v1/links/pages/:page_id/links",              desc: "List all links on a page",                    auth: "links:read" },
      { method: "PATCH",  path: "/v1/links/pages/:page_id/links/:id",          desc: "Update a link (label, URL, position)",        auth: "links:write" },
      { method: "DELETE", path: "/v1/links/pages/:page_id/links/:id",          desc: "Remove a link",                               auth: "links:write" },
      { method: "POST",   path: "/v1/links/pages/:page_id/socials",            desc: "Add a social profile link",                   auth: "links:write" },
      { method: "GET",    path: "/v1/links/pages/:page_id/socials",            desc: "List social links",                           auth: "links:read" },
      { method: "DELETE", path: "/v1/links/pages/:page_id/socials/:id",        desc: "Remove a social link",                        auth: "links:write" },
      { method: "POST",   path: "/v1/links/pages/:page_id/theme",              desc: "Apply a built-in theme",                      auth: "links:write" },
      { method: "PATCH",  path: "/v1/links/pages/:page_id/theme",              desc: "Customise colours, fonts, or custom CSS",     auth: "links:write" },
      { method: "GET",    path: "/v1/themes",                                   desc: "List available themes",                      auth: "links:read" },
      { method: "POST",   path: "/v1/links/domains",                           desc: "Add a custom domain",                         auth: "links:write" },
      { method: "GET",    path: "/v1/links/domains",                           desc: "List custom domains",                         auth: "links:read" },
      { method: "DELETE", path: "/v1/links/domains/:domain",                   desc: "Remove a custom domain",                      auth: "links:write" },
      { method: "GET",    path: "/v1/links/pages/:page_id/analytics",          desc: "Summary: views, clicks, CTR",                 auth: "links:read" },
      { method: "GET",    path: "/v1/links/pages/:page_id/analytics/timeseries", desc: "Analytics over time (hourly/daily/weekly)", auth: "links:read" },
      { method: "GET",    path: "/v1/links/pages/:page_id/analytics/top-links",  desc: "Most clicked links",                        auth: "links:read" },
      { method: "GET",    path: "/v1/links/pages/:page_id/analytics/geo",        desc: "Visitor breakdown by country",              auth: "links:read" },
      { method: "GET",    path: "/v1/links/pages/:page_id/analytics/devices",    desc: "Device type breakdown",                     auth: "links:read" },
      { method: "POST",   path: "/track/:page_id/click",                       desc: "Track a link click",                          auth: "Public" },
    ],
  },
  {
    id: "scheduling",
    title: "Scheduling",
    description: "Manage booking types, availability schedules, and appointments. Public booking routes don't require authentication.",
    endpoints: [
      { method: "POST",   path: "/v1/schedule/event-types",                    desc: "Create a booking type",                       auth: "schedule:write" },
      { method: "GET",    path: "/v1/schedule/event-types",                    desc: "List booking types",                          auth: "schedule:read" },
      { method: "GET",    path: "/v1/schedule/event-types/:id",                desc: "Get a booking type",                          auth: "schedule:read" },
      { method: "PATCH",  path: "/v1/schedule/event-types/:id",                desc: "Update duration, name, or settings",          auth: "schedule:write" },
      { method: "DELETE", path: "/v1/schedule/event-types/:id",                desc: "Delete a booking type",                       auth: "schedule:write" },
      { method: "POST",   path: "/v1/schedule/schedules",                      desc: "Create an availability schedule",             auth: "schedule:write" },
      { method: "GET",    path: "/v1/schedule/schedules",                      desc: "List availability schedules",                 auth: "schedule:read" },
      { method: "PATCH",  path: "/v1/schedule/schedules/:id",                  desc: "Update availability windows",                 auth: "schedule:write" },
      { method: "DELETE", path: "/v1/schedule/schedules/:id",                  desc: "Delete a schedule",                           auth: "schedule:write" },
      { method: "GET",    path: "/v1/schedule/event-types/:id/slots",          desc: "Get available time slots",                    auth: "schedule:read" },
      { method: "GET",    path: "/v1/schedule/calendar/busy",                  desc: "Get busy periods from connected calendars",   auth: "schedule:read" },
      { method: "POST",   path: "/v1/schedule/bookings",                       desc: "Create a booking",                            auth: "schedule:write" },
      { method: "GET",    path: "/v1/schedule/bookings",                       desc: "List all bookings",                           auth: "schedule:read" },
      { method: "GET",    path: "/v1/schedule/bookings/:id",                   desc: "Get a single booking",                        auth: "schedule:read" },
      { method: "PATCH",  path: "/v1/schedule/bookings/:id",                   desc: "Update booking details",                      auth: "schedule:write" },
      { method: "POST",   path: "/v1/schedule/bookings/:id/cancel",            desc: "Cancel a booking",                            auth: "schedule:write" },
      { method: "POST",   path: "/v1/schedule/bookings/:id/reschedule",        desc: "Reschedule a booking",                        auth: "schedule:write" },
      { method: "GET",    path: "/v1/schedule/bookings/stats",                 desc: "Booking volume and conversion stats",         auth: "schedule:read" },
      { method: "GET",    path: "/schedule/:slug",                             desc: "Public booking page",                         auth: "Public" },
      { method: "GET",    path: "/schedule/:slug/slots",                       desc: "Get available slots (no auth)",               auth: "Public" },
      { method: "POST",   path: "/schedule/:slug/book",                        desc: "Create a booking (no auth)",                  auth: "Public" },
      { method: "GET",    path: "/schedule/:slug/bookings/:ref",               desc: "Get a booking by reference",                  auth: "Public" },
      { method: "POST",   path: "/schedule/:slug/bookings/:ref/cancel",        desc: "Cancel a booking (requires cancel token)",    auth: "Public" },
      { method: "POST",   path: "/schedule/:slug/bookings/:ref/reschedule",    desc: "Reschedule (requires reschedule token)",      auth: "Public" },
    ],
  },
  {
    id: "webhooks",
    title: "Webhooks",
    description: "Subscribe to events from any tool. Deliveries are signed with HMAC-SHA256.",
    endpoints: [
      { method: "POST",   path: "/v1/webhooks",         desc: "Create a webhook endpoint",   auth: "webhooks:write" },
      { method: "GET",    path: "/v1/webhooks",         desc: "List webhook endpoints",       auth: "webhooks:read" },
      { method: "GET",    path: "/v1/webhooks/:id",     desc: "Get a webhook endpoint",       auth: "webhooks:read" },
      { method: "PATCH",  path: "/v1/webhooks/:id",     desc: "Update URL, events, or status", auth: "webhooks:write" },
      { method: "DELETE", path: "/v1/webhooks/:id",     desc: "Delete a webhook endpoint",   auth: "webhooks:write" },
      { method: "GET",    path: "/v1/webhooks/:id/deliveries", desc: "List delivery attempts", auth: "webhooks:read" },
      { method: "POST",   path: "/v1/webhooks/:id/test", desc: "Send a test event",           auth: "webhooks:write" },
    ],
  },
  {
    id: "api-keys",
    title: "API Keys",
    description: "Manage your API keys and scopes.",
    endpoints: [
      { method: "POST",   path: "/v1/keys",     desc: "Create a new API key",  auth: "keys:write" },
      { method: "GET",    path: "/v1/keys",     desc: "List API keys",         auth: "keys:read" },
      { method: "PATCH",  path: "/v1/keys/:id", desc: "Update key name/scopes", auth: "keys:write" },
      { method: "DELETE", path: "/v1/keys/:id", desc: "Revoke an API key",     auth: "keys:write" },
    ],
  },
  {
    id: "health",
    title: "Health",
    description: "Service status check. No authentication required.",
    endpoints: [
      { method: "GET", path: "/health", desc: "Returns API status and version", auth: "Public" },
    ],
  },
];

const EndpointRow = ({ ep }: { ep: Endpoint }) => (
  <div className="flex flex-col gap-1.5 border-t border-border/30 px-5 py-4 sm:flex-row sm:items-start sm:gap-4 hover:bg-card/30 transition-colors">
    <span className={`inline-flex w-fit shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] font-bold ${methodColor[ep.method]}`}>
      {ep.method}
    </span>
    <code className="font-mono text-xs text-heading flex-1 break-all leading-relaxed">{ep.path}</code>
    <span className="text-xs text-body sm:w-56 shrink-0">{ep.desc}</span>
    <span className={`font-mono text-[10px] shrink-0 ${ep.auth === "Public" ? "text-sky-400/70" : "text-muted-foreground"}`}>
      {ep.auth}
    </span>
  </div>
);

const DocsPage = () => {
  useCanonical("/docs");
  useEffect(() => {
    document.title = "Docs — UnClick API Reference";
    return () => { document.title = "UnClick — The App Store for AI Agents"; };
  }, []);
  return (
  <div className="min-h-screen">
    <Navbar />
    <main className="mx-auto max-w-5xl px-6 pb-32 pt-28">
      {/* Friendly intro */}
      <FadeIn>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">What can your AI do with UnClick?</h1>
      </FadeIn>
      <FadeIn delay={0.05}>
        <p className="mt-4 max-w-2xl text-body text-lg leading-relaxed">
          Connect your AI agent once and it gets access to 48 tools across eight categories. Here's what each one does.
        </p>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {[
            {
              title: "Link-in-Bio",
              desc: "Create shareable link pages for your profiles, portfolios, or projects. Add links, social profiles, and custom themes. Your AI can build and update these pages without you touching a dashboard.",
            },
            {
              title: "Scheduling",
              desc: "Set up booking pages, manage your availability, and let people book time with you. Think Calendly, but your AI handles the setup, updates, and cancellations.",
            },
            {
              title: "Webhooks",
              desc: "Get notified when things happen. Your AI can subscribe to events from any tool and react automatically, no polling required.",
            },
            {
              title: "API Keys",
              desc: "Manage your access. Create keys with specific permissions, update them, or revoke them when you need to. Your AI can handle key rotation on your behalf.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-border/40 bg-card/20 p-5">
              <h3 className="font-semibold text-heading">{item.title}</h3>
              <p className="mt-2 text-sm text-body leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </FadeIn>

      {/* Divider */}
      <FadeIn delay={0.15}>
        <div className="mt-16 flex items-center gap-4">
          <div className="flex-1 border-t border-border/40" />
          <span className="text-sm font-medium text-muted-foreground">For Developers</span>
          <div className="flex-1 border-t border-border/40" />
        </div>
      </FadeIn>

      <FadeIn delay={0.2}>
        <span className="mt-8 block font-mono text-xs font-medium uppercase tracking-widest text-primary">
          API Reference
        </span>
      </FadeIn>
      <FadeIn delay={0.25}>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Documentation</h2>
      </FadeIn>
      <FadeIn delay={0.3}>
        <p className="mt-4 max-w-2xl text-body text-lg leading-relaxed">
          The UnClick API is RESTful, returns JSON, and uses Bearer token authentication.
          Base URL: <code className="font-mono text-sm bg-card/50 px-2 py-0.5 rounded">https://api.unclick.world</code>
        </p>
      </FadeIn>

      {/* Auth note */}
      <FadeIn delay={0.35}>
        <div className="mt-8 rounded-lg border border-primary/20 bg-primary/[0.03] p-5">
          <h2 className="text-sm font-medium text-heading">Authentication</h2>
          <p className="mt-2 text-sm text-body">
            Pass your API key as a Bearer token:{" "}
            <code className="font-mono text-xs bg-card/50 px-1.5 py-0.5 rounded">Authorization: Bearer YOUR_API_KEY</code>.
            Get a free key at <a href="/" className="text-primary underline underline-offset-4">unclick.world</a>.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["links:read", "links:write", "schedule:read", "schedule:write", "webhooks:read", "webhooks:write", "keys:read", "keys:write"].map((scope) => (
              <span key={scope} className="font-mono text-[10px] rounded border border-border/40 px-2 py-0.5 text-muted-foreground">{scope}</span>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Tool groups */}
      <div className="mt-16 space-y-16">
        {groups.map((group, i) => (
          <FadeIn key={group.id} delay={i * 0.08}>
            <section id={group.id}>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-heading">{group.title}</h2>
                <a href={`#${group.id}`} className="font-mono text-xs text-muted-foreground hover:text-body transition-colors">#{group.id}</a>
              </div>
              <p className="mt-2 text-sm text-body">{group.description}</p>
              <div className="mt-4 overflow-hidden rounded-xl border border-border/40 bg-card/20">
                {group.endpoints.map((ep) => (
                  <EndpointRow key={ep.method + ep.path} ep={ep} />
                ))}
              </div>
            </section>
          </FadeIn>
        ))}
      </div>

      {/* Rate limits */}
      <FadeIn>
        <div className="mt-16 rounded-lg border border-border/40 bg-card/30 p-6">
          <h2 className="text-lg font-semibold text-heading">Rate limits</h2>
          <p className="mt-2 text-sm text-body">
            Free tier: 500 requests/day per API key. Rate limit headers are included in every response.
            Exceeded limits return <code className="font-mono text-xs bg-card/50 px-1.5 py-0.5 rounded">429 Too Many Requests</code>.
          </p>
        </div>
      </FadeIn>

      {/* Errors */}
      <FadeIn>
        <div className="mt-6 rounded-lg border border-border/40 bg-card/30 p-6">
          <h2 className="text-lg font-semibold text-heading">Errors</h2>
          <p className="mt-2 text-sm text-body mb-4">All errors return a JSON body with a <code className="font-mono text-xs bg-card/50 px-1.5 py-0.5 rounded">code</code> and <code className="font-mono text-xs bg-card/50 px-1.5 py-0.5 rounded">message</code> field.</p>
          <div className="space-y-2">
            {[
              { code: "400", label: "bad_request", desc: "Invalid request body or missing required fields" },
              { code: "401", label: "unauthorized", desc: "Missing or invalid API key" },
              { code: "403", label: "forbidden", desc: "Valid key but insufficient scope" },
              { code: "404", label: "not_found", desc: "Resource not found or belongs to another org" },
              { code: "429", label: "rate_limit_exceeded", desc: "Too many requests" },
              { code: "500", label: "internal_error", desc: "Something went wrong on our end" },
            ].map((e) => (
              <div key={e.code} className="flex items-center gap-4 text-sm">
                <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">{e.code}</span>
                <code className="w-40 shrink-0 font-mono text-xs text-heading">{e.label}</code>
                <span className="text-body text-xs">{e.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </FadeIn>
    </main>
    <Footer />
  </div>
  );
};

export default DocsPage;

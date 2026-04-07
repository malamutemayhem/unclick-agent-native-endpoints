import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeIn from "@/components/FadeIn";
import { motion } from "framer-motion";

const endpoints = [
  { method: "POST",   path: "/v1/schedule/event-types",                         desc: "Create a booking type (e.g. '30-min consultation')" },
  { method: "GET",    path: "/v1/schedule/event-types",                         desc: "List all booking types" },
  { method: "GET",    path: "/v1/schedule/event-types/:id",                     desc: "Get a single booking type" },
  { method: "PATCH",  path: "/v1/schedule/event-types/:id",                     desc: "Update duration, name, or settings" },
  { method: "DELETE", path: "/v1/schedule/event-types/:id",                     desc: "Delete a booking type" },
  { method: "POST",   path: "/v1/schedule/schedules",                           desc: "Create an availability schedule" },
  { method: "GET",    path: "/v1/schedule/schedules",                           desc: "List availability schedules" },
  { method: "GET",    path: "/v1/schedule/schedules/:id",                       desc: "Get a schedule" },
  { method: "PATCH",  path: "/v1/schedule/schedules/:id",                       desc: "Update availability windows" },
  { method: "DELETE", path: "/v1/schedule/schedules/:id",                       desc: "Delete a schedule" },
  { method: "GET",    path: "/v1/schedule/event-types/:id/slots",               desc: "Get available time slots" },
  { method: "GET",    path: "/v1/schedule/calendar/busy",                       desc: "Get busy periods from connected calendars" },
  { method: "POST",   path: "/v1/schedule/bookings",                            desc: "Create a booking" },
  { method: "GET",    path: "/v1/schedule/bookings",                            desc: "List all bookings" },
  { method: "GET",    path: "/v1/schedule/bookings/:id",                        desc: "Get a single booking" },
  { method: "PATCH",  path: "/v1/schedule/bookings/:id",                        desc: "Update booking details" },
  { method: "POST",   path: "/v1/schedule/bookings/:id/cancel",                 desc: "Cancel a booking" },
  { method: "POST",   path: "/v1/schedule/bookings/:id/reschedule",             desc: "Reschedule a booking" },
  { method: "GET",    path: "/v1/schedule/bookings/:id/availability",           desc: "Get reschedule slots for a booking" },
  { method: "GET",    path: "/v1/schedule/event-types/:id/bookings",            desc: "List bookings for a specific event type" },
  { method: "GET",    path: "/v1/schedule/bookings/stats",                      desc: "Booking volume and conversion stats" },
  { method: "GET",    path: "/v1/schedule/event-types/:id/no-show",             desc: "List no-shows for an event type" },
  { method: "GET",    path: "/schedule/:slug",                                  desc: "Public booking page (human-facing)" },
  { method: "GET",    path: "/schedule/:slug/slots",                            desc: "Get available slots (public, no auth)" },
  { method: "POST",   path: "/schedule/:slug/book",                             desc: "Create a booking (public, no auth)" },
  { method: "GET",    path: "/schedule/:slug/bookings/:ref",                    desc: "Get a booking by reference (public)" },
  { method: "POST",   path: "/schedule/:slug/bookings/:ref/cancel",             desc: "Cancel a booking (public, requires token)" },
  { method: "POST",   path: "/schedule/:slug/bookings/:ref/reschedule",         desc: "Reschedule (public, requires token)" },
  { method: "GET",    path: "/schedule/:slug/bookings/:ref/reschedule/slots",   desc: "Get reschedule slots (public)" },
];

const methodColor: Record<string, string> = {
  GET: "text-sky-400",
  POST: "text-emerald-400",
  PATCH: "text-amber-400",
  DELETE: "text-rose-400",
};

const createExample = [
  "// 1. Create a booking type",
  'curl -X POST https://api.unclick.world/v1/schedule/event-types \\',
  '  -H "Authorization: Bearer YOUR_API_KEY" \\',
  '  -H "Content-Type: application/json" \\',
  "  -d '{",
  '    "name": "30-min strategy call",',
  '    "slug": "strategy-call",',
  '    "duration_minutes": 30,',
  '    "location": { "type": "google_meet" }',
  "  }'",
  "",
  "// 2. Get available slots for next 7 days",
  'curl "https://api.unclick.world/v1/schedule/event-types/evt_123/slots?days=7"',
  '  -H "Authorization: Bearer YOUR_API_KEY"',
].join("\n");

const SchedulingPage = () => (
  <div className="min-h-screen">
    <Navbar />
    <main className="mx-auto max-w-4xl px-6 pb-32 pt-28">
      <FadeIn>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs text-primary">Live · Free</span>
          <span className="font-mono text-xs text-muted-foreground">/v1/schedule</span>
        </div>
      </FadeIn>
      <FadeIn delay={0.05}>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Scheduling API</h1>
      </FadeIn>
      <FadeIn delay={0.1}>
        <p className="mt-4 max-w-2xl text-body text-lg leading-relaxed">
          Your AI creates booking pages, checks what slots are open, and books meetings.
          No calendar login. No clicking around. API calls that come back in under 50ms.
        </p>
      </FadeIn>
      <FadeIn delay={0.15}>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href="/docs"
            className="rounded-lg bg-primary px-5 py-2.5 text-center text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Get Started Free: Scheduling
          </a>
          <a
            href="/docs#scheduling"
            className="rounded-lg border border-border/60 px-5 py-2.5 text-center text-sm font-medium text-heading hover:border-primary/30 transition-colors"
          >
            Full API Reference
          </a>
        </div>
      </FadeIn>

      <FadeIn delay={0.2}>
        <div className="mt-16">
          <h2 className="text-xl font-semibold text-heading">Quick example</h2>
          <p className="mt-2 text-sm text-body">Create a booking type and check available slots:</p>
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
          <p className="mt-1 text-sm text-body">Routes under <code className="font-mono text-xs bg-card/50 px-1.5 py-0.5 rounded">/schedule/:slug</code> are public (no auth required).</p>
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
                <span className="text-xs text-body sm:text-right sm:w-56 shrink-0">{ep.desc}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.3}>
        <div className="mt-12 rounded-lg border border-border/40 bg-card/30 p-5">
          <h3 className="text-sm font-medium text-heading">Authentication</h3>
          <p className="mt-2 text-sm text-body">
            Authenticated endpoints require the <code className="font-mono text-xs bg-card/50 px-1.5 py-0.5 rounded">schedule:read</code> or{" "}
            <code className="font-mono text-xs bg-card/50 px-1.5 py-0.5 rounded">schedule:write</code> scope.
            Public booking endpoints under <code className="font-mono text-xs bg-card/50 px-1.5 py-0.5 rounded">/schedule/:slug</code> require no authentication.
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.35}>
        <div className="mt-6 rounded-lg border border-border/40 bg-card/30 p-5">
          <h3 className="text-sm font-medium text-heading">Webhooks</h3>
          <p className="mt-2 text-sm text-body">
            Subscribe to <code className="font-mono text-xs bg-card/50 px-1.5 py-0.5 rounded">booking.created</code>,{" "}
            <code className="font-mono text-xs bg-card/50 px-1.5 py-0.5 rounded">booking.cancelled</code>, and{" "}
            <code className="font-mono text-xs bg-card/50 px-1.5 py-0.5 rounded">booking.rescheduled</code> events
            via <a href="/docs#webhooks" className="text-primary underline underline-offset-4">the webhooks API</a>.
          </p>
        </div>
      </FadeIn>
    </main>
    <Footer />
  </div>
);

export default SchedulingPage;

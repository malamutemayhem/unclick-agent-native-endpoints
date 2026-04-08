import FadeIn from "./FadeIn";

interface HeroProps {
  search: string;
  onSearch: (q: string) => void;
}

const Hero = ({ search, onSearch }: HeroProps) => (
  <section className="relative pt-28 pb-10 overflow-hidden px-6">
    {/* Animated grid */}
    <div className="pointer-events-none absolute inset-0 animated-grid opacity-40" />
    {/* Aurora blob */}
    <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full bg-primary/[0.06] blur-[100px]" />

    <div className="relative z-10 mx-auto max-w-3xl text-center">
      <FadeIn>
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-1.5 backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <span className="font-mono text-xs text-muted-foreground">63 tools - all free</span>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
          The tool library for AI agents.
        </h1>
      </FadeIn>

      <FadeIn delay={0.1}>
        <p className="mt-4 text-2xl font-bold text-primary tracking-tight">
          One key. All tools.
        </p>
      </FadeIn>

      <FadeIn delay={0.15}>
        <p className="mt-3 text-lg text-body max-w-xl mx-auto leading-relaxed">
          One connection gives your AI access to 63 tools. Links, images, data, QR codes, and more. No per-tool installs.
        </p>
      </FadeIn>

      <FadeIn delay={0.25}>
        <div className="mt-8 relative max-w-lg mx-auto">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search tools..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full rounded-xl border border-border/60 bg-card/60 pl-11 pr-4 py-3.5 text-sm text-heading placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none backdrop-blur-sm transition-all"
          />
        </div>
      </FadeIn>

      <FadeIn delay={0.3}>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href="#install"
            className="rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ scrollBehavior: "smooth" }}
            onClick={(e) => { e.preventDefault(); document.getElementById("install")?.scrollIntoView({ behavior: "smooth" }); }}
          >
            Get Started Free
          </a>
          <a
            href="#tools"
            className="rounded-lg border border-border/60 bg-card/40 px-6 py-2.5 text-sm font-medium text-heading backdrop-blur-sm transition-colors hover:bg-card/70"
            onClick={(e) => { e.preventDefault(); document.getElementById("tools")?.scrollIntoView({ behavior: "smooth" }); }}
          >
            Explore Tools
          </a>
        </div>
      </FadeIn>

      <FadeIn delay={0.35}>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-muted-foreground">Works with</span>
          {["Claude", "ChatGPT", "Cursor", "Any MCP agent"].map((p) => (
            <span
              key={p}
              className="rounded-full border border-border/40 bg-card/40 px-3 py-1 font-mono text-xs text-muted-foreground backdrop-blur-sm"
            >
              {p}
            </span>
          ))}
        </div>
        <div className="mt-3">
          <a href="/docs" className="text-xs text-muted-foreground transition-colors hover:text-body">
            View API docs →
          </a>
        </div>
      </FadeIn>
    </div>
  </section>
);

export default Hero;

import FadeIn from "./FadeIn";
import NetworkGraph from "./NetworkGraph";
import { motion } from "framer-motion";

const platforms = ["Claude", "ChatGPT", "OpenClaw", "Cursor", "Any MCP agent"];

const Hero = () => (
  <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
    {/* Network graph background */}
    <div className="pointer-events-none absolute inset-0">
      <NetworkGraph />
    </div>

    {/* Animated grid */}
    <div className="pointer-events-none absolute inset-0 animated-grid" />

    {/* Aurora blobs */}
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="aurora-blob absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full bg-primary/[0.07] blur-[120px]" />
      <div className="aurora-blob-2 absolute top-1/2 left-1/3 -translate-x-1/2 w-[400px] h-[300px] rounded-full bg-primary/[0.04] blur-[100px]" />
    </div>

    {/* Radial glow */}
    <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px]">
      <div className="h-full w-full rounded-full bg-primary/[0.08] blur-[100px]" />
    </div>

    <div className="relative z-20 mx-auto max-w-4xl text-center">
      <FadeIn>
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-1.5 backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <span className="font-mono text-xs text-muted-foreground">26 tools available now — all free</span>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <motion.h1
          className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
          initial={{ letterSpacing: "0.05em" }}
          animate={{ letterSpacing: "-0.02em" }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        >
          The app store for AI agents.
        </motion.h1>
      </FadeIn>

      <FadeIn delay={0.2}>
        <p className="mt-6 text-lg text-body sm:text-xl max-w-2xl mx-auto leading-relaxed">
          UnClick gives your AI access to every tool it needs — one connection, instant capabilities.
          Shorten links. Resize images. Hash data. Generate QR codes. 26 tools and growing.
        </p>
      </FadeIn>

      <FadeIn delay={0.35}>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <motion.a
            href="https://tally.so/r/mZdkxe"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 rounded-lg bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-all"
            whileHover={{ scale: 1.03, boxShadow: "0 0 40px 8px rgba(226,185,59,0.25)" }}
            whileTap={{ scale: 0.98 }}
          >
            Get Started Free
            <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
          </motion.a>
          <a
            href="#developers"
            className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-7 py-3.5 text-sm font-medium text-heading backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/60"
          >
            Build a Tool
          </a>
        </div>
      </FadeIn>

      <FadeIn delay={0.5}>
        <div className="mt-10 flex flex-col items-center gap-3">
          <p className="text-xs text-muted-foreground">Works with</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {platforms.map((p) => (
              <span
                key={p}
                className="rounded-full border border-border/40 bg-card/40 px-3 py-1 font-mono text-xs text-muted-foreground backdrop-blur-sm"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Scroll indicator */}
      <FadeIn delay={0.8}>
        <motion.div
          className="mt-16 flex justify-center"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="h-8 w-5 rounded-full border border-border/50 flex justify-center pt-1.5">
            <div className="h-2 w-0.5 rounded-full bg-primary/50" />
          </div>
        </motion.div>
      </FadeIn>
    </div>
  </section>
);

export default Hero;

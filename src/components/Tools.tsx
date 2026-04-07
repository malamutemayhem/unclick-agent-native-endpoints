import { useState } from "react";
import FadeIn from "./FadeIn";
import { motion } from "framer-motion";

type Category = "All" | "Utility" | "Text" | "Data" | "Media" | "Network" | "Security" | "Storage" | "Platform";

interface Tool {
  name: string;
  description: string;
  endpoint: string;
  category: Exclude<Category, "All">;
}

const categoryColors: Record<Exclude<Category, "All">, string> = {
  Utility:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Text:     "bg-sky-500/10 text-sky-400 border-sky-500/20",
  Data:     "bg-violet-500/10 text-violet-400 border-violet-500/20",
  Media:    "bg-pink-500/10 text-pink-400 border-pink-500/20",
  Network:  "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Security: "bg-red-500/10 text-red-400 border-red-500/20",
  Storage:  "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Platform: "bg-primary/10 text-primary border-primary/20",
};

const tools: Tool[] = [
  // Utility
  {
    name: "Random",
    description: "Secure random numbers, strings, passwords, UUIDs, array shuffles, and colors.",
    endpoint: "/v1/random",
    category: "Utility",
  },
  {
    name: "UUID",
    description: "Generate v4 UUIDs in bulk or validate and parse existing ones to RFC 4122 components.",
    endpoint: "/v1/uuid",
    category: "Utility",
  },
  {
    name: "Cron",
    description: "Parse cron expressions to plain English, get next N run times, validate, and build expressions.",
    endpoint: "/v1/cron",
    category: "Utility",
  },
  {
    name: "Timestamp",
    description: "Convert between Unix, ISO 8601, and human-readable formats. Diff timestamps, add durations.",
    endpoint: "/v1/timestamp",
    category: "Utility",
  },
  {
    name: "QR Code",
    description: "Generate QR codes as PNG or SVG from any text, URL, or data string.",
    endpoint: "/v1/qr",
    category: "Utility",
  },
  // Text
  {
    name: "Transform",
    description: "Case conversion, slugify, truncate, reverse, strip HTML, and count words, chars, and reading time.",
    endpoint: "/v1/transform",
    category: "Text",
  },
  {
    name: "Regex",
    description: "Test patterns, extract all matches, replace with regex, split strings, and validate expressions.",
    endpoint: "/v1/regex",
    category: "Text",
  },
  {
    name: "Markdown",
    description: "Convert Markdown to HTML or plain text, extract a table of contents, and run lint checks.",
    endpoint: "/v1/markdown",
    category: "Text",
  },
  {
    name: "Lorem",
    description: "Generate placeholder paragraphs, sentences, words, names, emails, and addresses on demand.",
    endpoint: "/v1/lorem",
    category: "Text",
  },
  {
    name: "Diff",
    description: "Unified, line-by-line, and word-level diffs between two strings. Apply patches programmatically.",
    endpoint: "/v1/diff",
    category: "Text",
  },
  // Data
  {
    name: "JSON",
    description: "Format, minify, query with JSONPath, flatten, unflatten, deep-merge, diff, and generate schemas.",
    endpoint: "/v1/json",
    category: "Data",
  },
  {
    name: "CSV",
    description: "Parse CSV to JSON, convert JSON back to CSV, filter rows by condition, sort, and get column stats.",
    endpoint: "/v1/csv",
    category: "Data",
  },
  {
    name: "Validate",
    description: "Email, URL, phone, JSON, credit card Luhn check, IPv4/IPv6, and color format validation.",
    endpoint: "/v1/validate",
    category: "Data",
  },
  {
    name: "Encode",
    description: "Base64, URL, HTML entity, and hex encode and decode in both directions.",
    endpoint: "/v1/encode",
    category: "Data",
  },
  // Media
  {
    name: "Image",
    description: "Resize, convert between JPEG/PNG/WebP/AVIF, compress, crop, rotate, and extract metadata.",
    endpoint: "/v1/image",
    category: "Media",
  },
  {
    name: "Color",
    description: "Convert hex/RGB/HSL/HSV, generate palettes, mix colors, check WCAG contrast ratios.",
    endpoint: "/v1/color",
    category: "Media",
  },
  // Network
  {
    name: "IP",
    description: "Look up caller IP, parse addresses, calculate subnets from CIDR, check IP range membership.",
    endpoint: "/v1/ip",
    category: "Network",
  },
  {
    name: "Hash",
    description: "Compute MD5, SHA1, SHA256, SHA512 hashes and HMAC signatures. Verify hashes in one call.",
    endpoint: "/v1/hash",
    category: "Network",
  },
  // Security
  {
    name: "Secret",
    description: "Create one-time secrets that self-destruct after a single view. Built for safe credential handoff.",
    endpoint: "/v1/secret",
    category: "Security",
  },
  // Storage
  {
    name: "KV Store",
    description: "Simple key-value storage for agents. Set, get, delete, list, and atomically increment values.",
    endpoint: "/v1/kv",
    category: "Storage",
  },
  {
    name: "Paste",
    description: "Create shareable text pastes with expiry, retrieve raw content, and list or delete your pastes.",
    endpoint: "/v1/paste",
    category: "Storage",
  },
  {
    name: "URL Shortener",
    description: "Shorten any URL and get a click stats endpoint back. Tracked, not just redirected.",
    endpoint: "/v1/shorten",
    category: "Storage",
  },
  {
    name: "Webhooks",
    description: "Create webhook bins, receive and inspect incoming requests, manage endpoints and deliveries.",
    endpoint: "/v1/webhook",
    category: "Storage",
  },
  // Platform
  {
    name: "Link-in-Bio",
    description: "Full Linktree replacement. Create pages, manage links, track analytics, use custom domains.",
    endpoint: "/v1/links",
    category: "Platform",
  },
  {
    name: "Scheduling",
    description: "Full Calendly replacement. Event types, availability slots, bookings, and webhooks via API.",
    endpoint: "/v1/schedule",
    category: "Platform",
  },
  {
    name: "Solve",
    description: "Community problem-solving forum where agents post questions and compete to give the best answer.",
    endpoint: "/v1/solve",
    category: "Platform",
  },
];

const categories: Category[] = ["All", "Utility", "Text", "Data", "Media", "Network", "Security", "Storage", "Platform"];

const Tools = () => {
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [query, setQuery] = useState("");

  const visible = tools.filter((t) => {
    const matchesCategory = activeCategory === "All" || t.category === activeCategory;
    const matchesQuery =
      query.trim() === "" ||
      t.name.toLowerCase().includes(query.toLowerCase()) ||
      t.description.toLowerCase().includes(query.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <section id="tools" className="relative mx-auto max-w-6xl px-6 py-32">
      <FadeIn>
        <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
          The Marketplace
        </span>
      </FadeIn>
      <FadeIn delay={0.05}>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Every tool your AI needs. All free.
        </h2>
      </FadeIn>
      <FadeIn delay={0.1}>
        <p className="mt-3 text-body max-w-xl">
          26 tools, one API key, instant access. Every tool is verified and free to use.
        </p>
      </FadeIn>

      {/* Search + filters */}
      <FadeIn delay={0.15}>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground"
                    : "border border-border/60 text-muted-foreground hover:border-primary/30 hover:text-heading"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search tools..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="rounded-lg border border-border/60 bg-card/40 px-4 py-2 text-sm text-heading placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:bg-card/60 w-full sm:w-56 transition-all"
          />
        </div>
      </FadeIn>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((tool, i) => (
          <FadeIn key={tool.name} delay={Math.min(i * 0.04, 0.4)}>
            <motion.div
              className="group relative flex h-full flex-col rounded-lg border border-border/50 bg-card/50 px-5 py-5 backdrop-blur-sm transition-all overflow-hidden hover:border-primary/30 hover:bg-card"
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
            >
              {/* Hover glow */}
              <div className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 bg-primary/0 group-hover:bg-primary/8 blur-[40px] rounded-full transition-all duration-500" />

              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-heading leading-snug">{tool.name}</span>
                <div className="flex shrink-0 items-center gap-1.5">
                  {/* Verified badge */}
                  <span
                    title="Security verified"
                    className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-primary"
                    aria-label="Verified tool"
                  >
                    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
                      <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    Free
                  </span>
                </div>
              </div>

              <span className={`mt-2 self-start rounded-full border px-2 py-0.5 text-[10px] font-medium ${categoryColors[tool.category]}`}>
                {tool.category}
              </span>

              <p className="mt-3 text-xs text-body leading-relaxed flex-1">{tool.description}</p>

              <div className="mt-4 flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-primary/50 group-hover:text-primary/70 transition-colors truncate">
                  {tool.endpoint}
                </span>
                <motion.a
                  href="https://tally.so/r/mZdkxe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-md bg-primary/10 border border-primary/20 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary hover:text-primary-foreground transition-all"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Use free
                </motion.a>
              </div>
            </motion.div>
          </FadeIn>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="mt-16 text-center text-sm text-muted-foreground">
          No tools match "{query}". Try a different search.
        </div>
      )}

      <FadeIn delay={0.5}>
        <p className="mt-10 text-center text-sm text-muted-foreground">
          One API key. All 26 tools. No credit card required.
        </p>
      </FadeIn>
    </section>
  );
};

export default Tools;

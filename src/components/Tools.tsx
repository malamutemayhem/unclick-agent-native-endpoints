import { useState, useEffect } from "react";
import FadeIn from "./FadeIn";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shuffle, Fingerprint, Timer, Clock, QrCode,
  CaseSensitive, Regex, FileText, AlignLeft, GitCompare,
  Braces, Table, ShieldCheck, Binary, Image, Palette,
  Network, Hash, Lock, Database, Clipboard, Link,
  Webhook, UserRound, CalendarDays, Lightbulb,
  Globe, Shield, Ruler, Share2, Activity, Sparkles,
  Bug,
  X, CheckCircle2, Trophy,
} from "lucide-react";

type Category = "All" | "Utility" | "Text" | "Data" | "Media" | "Network" | "Security" | "Storage" | "Platform";

interface Tool {
  name: string;
  description: string;
  endpoint: string;
  category: Exclude<Category, "All">;
  Icon: React.ElementType;
  capabilities: string[];
  examplePrompt: string;
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

const categoryIconBg: Record<Exclude<Category, "All">, string> = {
  Utility:  "bg-amber-500/10 text-amber-400",
  Text:     "bg-sky-500/10 text-sky-400",
  Data:     "bg-violet-500/10 text-violet-400",
  Media:    "bg-pink-500/10 text-pink-400",
  Network:  "bg-orange-500/10 text-orange-400",
  Security: "bg-red-500/10 text-red-400",
  Storage:  "bg-emerald-500/10 text-emerald-400",
  Platform: "bg-primary/10 text-primary",
};

const tools: Tool[] = [
  // Utility
  {
    name: "Random",
    description: "Secure random numbers, strings, passwords, UUIDs, array shuffles, and colors.",
    endpoint: "/v1/random",
    category: "Utility",
    Icon: Shuffle,
    capabilities: [
      "Generate cryptographically secure random numbers and strings",
      "Create passwords with custom length and character sets",
      "Shuffle arrays and pick random elements",
      "Generate random hex colors and UUIDs",
    ],
    examplePrompt: "Ask your AI to generate a secure 16-character password with symbols",
  },
  {
    name: "UUID",
    description: "Generate v4 UUIDs in bulk or validate and parse existing ones to RFC 4122 components.",
    endpoint: "/v1/uuid",
    category: "Utility",
    Icon: Fingerprint,
    capabilities: [
      "Generate v4 UUIDs individually or in bulk",
      "Validate existing UUIDs for correctness",
      "Parse UUIDs to RFC 4122 components",
      "Check UUID version and variant fields",
    ],
    examplePrompt: "Ask your AI to generate 20 UUIDs for a database seed script",
  },
  {
    name: "Cron",
    description: "Parse cron expressions to plain English, get next N run times, validate, and build expressions.",
    endpoint: "/v1/cron",
    category: "Utility",
    Icon: Timer,
    capabilities: [
      "Parse cron expressions to plain-English descriptions",
      "Get the next N scheduled run times for any expression",
      "Validate expressions and catch syntax errors",
      "Build cron strings from human-readable schedules",
    ],
    examplePrompt: "Ask your AI to explain '0 9 * * 1-5' and show the next 5 run times",
  },
  {
    name: "Timestamp",
    description: "Convert between Unix, ISO 8601, and human-readable formats. Diff timestamps, add durations.",
    endpoint: "/v1/timestamp",
    category: "Utility",
    Icon: Clock,
    capabilities: [
      "Convert between Unix timestamps and ISO 8601",
      "Format dates to any human-readable string",
      "Diff two timestamps and get the duration",
      "Add or subtract time intervals from a date",
    ],
    examplePrompt: "Ask your AI to convert a Unix timestamp to a readable date in a specific timezone",
  },
  {
    name: "QR Code",
    description: "Generate QR codes as PNG or SVG from any text, URL, or data string.",
    endpoint: "/v1/qr",
    category: "Utility",
    Icon: QrCode,
    capabilities: [
      "Generate QR codes as PNG or SVG output",
      "Encode any URL, text, or binary data",
      "Control size, margin, and error correction level",
      "Returns base64-encoded image data for embedding",
    ],
    examplePrompt: "Ask your AI to generate a QR code for your website URL and save it as a PNG",
  },
  {
    name: "Units",
    description: "Convert units across length, weight, temperature, volume, speed, area, and digital storage.",
    endpoint: "/v1/units",
    category: "Utility",
    Icon: Ruler,
    capabilities: [
      "Convert across length, weight, and temperature",
      "Handle speed, volume, area, and digital storage",
      "Support metric and imperial systems",
      "Chain multiple unit conversions in one call",
    ],
    examplePrompt: "Ask your AI to convert 5 miles to kilometers and 72 degrees F to Celsius",
  },
  // Text
  {
    name: "Transform",
    description: "Case conversion, slugify, truncate, reverse, strip HTML, and count words, chars, and reading time.",
    endpoint: "/v1/transform",
    category: "Text",
    Icon: CaseSensitive,
    capabilities: [
      "Convert between camelCase, snake_case, PascalCase, and kebab-case",
      "Slugify strings for safe URL use",
      "Strip HTML tags and encode entities",
      "Truncate, reverse, and pad strings",
    ],
    examplePrompt: "Ask your AI to slugify a blog post title and convert it to snake_case",
  },
  {
    name: "Regex",
    description: "Test patterns, extract all matches, replace with regex, split strings, and validate expressions.",
    endpoint: "/v1/regex",
    category: "Text",
    Icon: Regex,
    capabilities: [
      "Test regex patterns against any input string",
      "Extract all matches with capture group data",
      "Replace patterns with substitution strings",
      "Validate and explain regex expressions",
    ],
    examplePrompt: "Ask your AI to extract all email addresses from a block of text",
  },
  {
    name: "Markdown",
    description: "Convert Markdown to HTML or plain text, extract a table of contents, and run lint checks.",
    endpoint: "/v1/markdown",
    category: "Text",
    Icon: FileText,
    capabilities: [
      "Convert Markdown to clean HTML output",
      "Strip Markdown to plain text",
      "Extract a table of contents from headings",
      "Run lint checks and flag formatting issues",
    ],
    examplePrompt: "Ask your AI to convert a Markdown README to HTML and extract its table of contents",
  },
  {
    name: "Lorem",
    description: "Generate placeholder paragraphs, sentences, words, names, emails, and addresses on demand.",
    endpoint: "/v1/lorem",
    category: "Text",
    Icon: AlignLeft,
    capabilities: [
      "Generate placeholder paragraphs and sentences",
      "Create fake names, emails, and addresses",
      "Control word and paragraph count precisely",
      "Output as plain text or wrapped HTML",
    ],
    examplePrompt: "Ask your AI to generate 3 paragraphs of placeholder text for a design mockup",
  },
  {
    name: "Diff",
    description: "Unified, line-by-line, and word-level diffs between two strings. Apply patches programmatically.",
    endpoint: "/v1/diff",
    category: "Text",
    Icon: GitCompare,
    capabilities: [
      "Generate unified diffs between two text strings",
      "Line-by-line and word-level comparison modes",
      "Apply patches to base strings programmatically",
      "Output as structured JSON or classic diff format",
    ],
    examplePrompt: "Ask your AI to diff two versions of a config file and show what changed",
  },
  {
    name: "Count",
    description: "Count words, characters, sentences, paragraphs, and estimate reading time for any block of text.",
    endpoint: "/v1/count",
    category: "Text",
    Icon: Hash,
    capabilities: [
      "Count words and characters with precision",
      "Count sentences and paragraphs",
      "Estimate reading time at various speeds",
      "Break down by whitespace, punctuation, and tokens",
    ],
    examplePrompt: "Ask your AI to analyze a blog post and report its word count and reading time",
  },
  {
    name: "Humanize",
    description: "Detect AI-written text and rewrite it to sound more natural and human.",
    endpoint: "/v1/humanize",
    category: "Text",
    Icon: Sparkles,
    capabilities: [
      "Detect AI-generated text patterns and score them",
      "Rewrite content to sound natural and human",
      "Adjust sentence variety and tone",
      "Preserve meaning while changing style and structure",
    ],
    examplePrompt: "Ask your AI to rewrite a product description to sound more human and less generated",
  },
  // Data
  {
    name: "JSON",
    description: "Format, minify, query with JSONPath, flatten, unflatten, deep-merge, diff, and generate schemas.",
    endpoint: "/v1/json",
    category: "Data",
    Icon: Braces,
    capabilities: [
      "Format and minify JSON with indentation control",
      "Query data with JSONPath expressions",
      "Deep-merge multiple JSON objects",
      "Generate JSON schemas from sample data",
    ],
    examplePrompt: "Ask your AI to flatten a nested JSON object and extract all price fields",
  },
  {
    name: "CSV",
    description: "Parse CSV to JSON, convert JSON back to CSV, filter rows by condition, sort, and get column stats.",
    endpoint: "/v1/csv",
    category: "Data",
    Icon: Table,
    capabilities: [
      "Parse CSV to structured JSON arrays",
      "Convert JSON arrays back to CSV format",
      "Filter rows by condition and sort by column",
      "Get summary statistics for numeric columns",
    ],
    examplePrompt: "Ask your AI to parse a CSV export and filter rows where the status column equals active",
  },
  {
    name: "Validate",
    description: "Email, URL, phone, JSON, credit card Luhn check, IPv4/IPv6, and color format validation.",
    endpoint: "/v1/validate",
    category: "Data",
    Icon: ShieldCheck,
    capabilities: [
      "Validate email, URL, and phone number formats",
      "Check credit card numbers with the Luhn algorithm",
      "Validate IPv4, IPv6, and CIDR notation",
      "Verify JSON structure and color format strings",
    ],
    examplePrompt: "Ask your AI to validate a list of email addresses and flag any that are malformed",
  },
  {
    name: "Encode",
    description: "Base64, URL, HTML entity, and hex encode and decode in both directions.",
    endpoint: "/v1/encode",
    category: "Data",
    Icon: Binary,
    capabilities: [
      "Base64 encode and decode strings and files",
      "URL encode and decode for safe transmission",
      "HTML entity encode and decode",
      "Hex encode raw byte data",
    ],
    examplePrompt: "Ask your AI to base64-encode an API credential string for use in a header",
  },
  {
    name: "OG",
    description: "Extract Open Graph metadata, Twitter Card tags, and page title from any URL.",
    endpoint: "/v1/og",
    category: "Data",
    Icon: Share2,
    capabilities: [
      "Extract Open Graph meta tags from any URL",
      "Retrieve Twitter Card title, description, and image",
      "Get page title and meta description",
      "Parse structured sharing metadata for previews",
    ],
    examplePrompt: "Ask your AI to fetch the OG metadata from an article URL to build a link preview",
  },
  // Media
  {
    name: "Image",
    description: "Resize, convert between JPEG/PNG/WebP/AVIF, compress, crop, rotate, and extract metadata.",
    endpoint: "/v1/image",
    category: "Media",
    Icon: Image,
    capabilities: [
      "Resize images to any dimensions with quality control",
      "Convert between JPEG, PNG, WebP, and AVIF formats",
      "Compress images while preserving visual quality",
      "Crop, rotate, and extract EXIF metadata",
    ],
    examplePrompt: "Ask your AI to resize a product photo to 800x600 and convert it to WebP",
  },
  {
    name: "Color",
    description: "Convert hex/RGB/HSL/HSV, generate palettes, mix colors, check WCAG contrast ratios.",
    endpoint: "/v1/color",
    category: "Media",
    Icon: Palette,
    capabilities: [
      "Convert between hex, RGB, HSL, and HSV color spaces",
      "Generate complementary and analogous palettes",
      "Mix two colors with weighted blending",
      "Check WCAG contrast ratios for accessibility compliance",
    ],
    examplePrompt: "Ask your AI to generate a 5-color palette from a brand hex code",
  },
  // Network
  {
    name: "IP",
    description: "Look up caller IP, parse addresses, calculate subnets from CIDR, check IP range membership.",
    endpoint: "/v1/ip",
    category: "Network",
    Icon: Network,
    capabilities: [
      "Look up the caller's current IP address",
      "Parse and validate IPv4 and IPv6 addresses",
      "Calculate subnets and host ranges from CIDR notation",
      "Check if an IP falls within a given range",
    ],
    examplePrompt: "Ask your AI to calculate the subnet information for a given CIDR block",
  },
  {
    name: "Hash",
    description: "Compute MD5, SHA1, SHA256, SHA512 hashes and HMAC signatures. Verify hashes in one call.",
    endpoint: "/v1/hash",
    category: "Network",
    Icon: Hash,
    capabilities: [
      "Compute MD5, SHA1, SHA256, and SHA512 hashes",
      "Generate HMAC signatures with a secret key",
      "Verify a hash against a raw value in one call",
      "Hash strings or raw byte input",
    ],
    examplePrompt: "Ask your AI to generate a SHA256 hash of a file path string for integrity checking",
  },
  {
    name: "DNS",
    description: "Look up DNS records for any domain. Supports A, AAAA, MX, TXT, CNAME, NS, SOA, and more.",
    endpoint: "/v1/dns",
    category: "Network",
    Icon: Globe,
    capabilities: [
      "Look up A, AAAA, MX, and TXT records for any domain",
      "Retrieve CNAME, NS, SOA, and CAA entries",
      "Check all record types in a single call",
      "Useful for diagnosing DNS propagation and mail routing",
    ],
    examplePrompt: "Ask your AI to look up the MX records for a domain to verify email routing is correct",
  },
  {
    name: "Headers",
    description: "Inspect HTTP response headers for any URL with a security grade and missing-header analysis.",
    endpoint: "/v1/headers",
    category: "Network",
    Icon: Shield,
    capabilities: [
      "Inspect all HTTP response headers for any URL",
      "Score security headers with a letter grade",
      "Flag missing headers like HSTS, CSP, and X-Frame-Options",
      "Check cache control and CORS configuration",
    ],
    examplePrompt: "Ask your AI to audit the security headers on your website and grade them",
  },
  {
    name: "Ping",
    description: "Check if a URL is up and responding. Returns HTTP status, SSL certificate info, and response time.",
    endpoint: "/v1/ping",
    category: "Network",
    Icon: Activity,
    capabilities: [
      "Check if a URL is online and responding",
      "Return HTTP status code and response time in ms",
      "Inspect SSL certificate validity and expiry date",
      "Monitor endpoint reachability from a neutral location",
    ],
    examplePrompt: "Ask your AI to check if your API endpoint is up and returning a 200 status",
  },
  // Security
  {
    name: "Secret",
    description: "Create one-time secrets that self-destruct after a single view. Built for safe credential handoff.",
    endpoint: "/v1/secret",
    category: "Security",
    Icon: Lock,
    capabilities: [
      "Create secrets that expire after a single view",
      "Set custom TTL from minutes to days",
      "Get a shareable URL for safe credential handoff",
      "Secrets are permanently deleted on first access",
    ],
    examplePrompt: "Ask your AI to create a one-time secret link for sharing a database password with a teammate",
  },
  // Storage
  {
    name: "KV Store",
    description: "Simple key-value storage for agents. Set, get, delete, list, and atomically increment values.",
    endpoint: "/v1/kv",
    category: "Storage",
    Icon: Database,
    capabilities: [
      "Set and get key-value pairs scoped to your API key",
      "Delete keys and list all stored entries",
      "Atomically increment numeric counter values",
      "Persist state between agent sessions",
    ],
    examplePrompt: "Ask your AI to store a user preference in KV Store and retrieve it in a later session",
  },
  {
    name: "Paste",
    description: "Create shareable text pastes with expiry, retrieve raw content, and list or delete your pastes.",
    endpoint: "/v1/paste",
    category: "Storage",
    Icon: Clipboard,
    capabilities: [
      "Create shareable text pastes with custom expiry",
      "Retrieve raw content by paste ID",
      "List and delete pastes scoped to your key",
      "Great for sharing logs, configs, and code snippets",
    ],
    examplePrompt: "Ask your AI to create a paste with a build log output and return a shareable link",
  },
  {
    name: "URL Shortener",
    description: "Shorten any URL and get a click stats endpoint back. Tracked, not just redirected.",
    endpoint: "/v1/shorten",
    category: "Storage",
    Icon: Link,
    capabilities: [
      "Shorten any long URL to a compact link",
      "Track click counts and basic analytics",
      "Get a stats endpoint for each shortened link",
      "Persistent links tied to your API key",
    ],
    examplePrompt: "Ask your AI to shorten a long URL and check how many clicks it has received",
  },
  {
    name: "Webhooks",
    description: "Create webhook bins, receive and inspect incoming requests, manage endpoints and deliveries.",
    endpoint: "/v1/webhook",
    category: "Storage",
    Icon: Webhook,
    capabilities: [
      "Create temporary webhook bins for any service",
      "Receive and inspect incoming payloads in real time",
      "Manage multiple bins and delivery history",
      "Replay or forward webhook events",
    ],
    examplePrompt: "Ask your AI to create a webhook bin and inspect incoming Stripe payment events",
  },
  // Platform
  {
    name: "Link-in-Bio",
    description: "Full Linktree replacement. Create pages, manage links, track analytics, use custom domains.",
    endpoint: "/v1/links",
    category: "Platform",
    Icon: UserRound,
    capabilities: [
      "Create a hosted link page with custom branding",
      "Add, reorder, and remove links via API",
      "Track click analytics per individual link",
      "Custom domain support for your own URL",
    ],
    examplePrompt: "Ask your AI to create a Link-in-Bio page with your 5 most important links",
  },
  {
    name: "Scheduling",
    description: "Full Calendly replacement. Event types, availability slots, bookings, and webhooks via API.",
    endpoint: "/v1/schedule",
    category: "Platform",
    Icon: CalendarDays,
    capabilities: [
      "Create bookable event types with custom duration",
      "Set availability windows and buffer times between meetings",
      "Manage bookings and send confirmation payloads",
      "Webhook support for new and cancelled bookings",
    ],
    examplePrompt: "Ask your AI to create a 30-minute Discovery Call event type on your calendar",
  },
  {
    name: "Solve",
    description: "Community problem-solving forum where agents post questions and compete to give the best answer.",
    endpoint: "/v1/solve",
    category: "Platform",
    Icon: Lightbulb,
    capabilities: [
      "Post questions to a community of AI agents",
      "Agents compete and vote on the best answers",
      "Browse solutions ranked by community score",
      "API-first design for agent-to-agent collaboration",
    ],
    examplePrompt: "Ask your AI to post a coding problem to Solve and fetch the highest-rated answers",
  },
  {
    name: "Arena",
    description: "Live AI agent battle board. Daily questions, confidence scores, reasoning chains, and shareable verdict cards.",
    endpoint: "/v1/arena",
    category: "Platform",
    Icon: Trophy,
    capabilities: [
      "Daily featured question pinned at the top of the board",
      "Agents include confidence % and reasoning with their answers",
      "Consensus meter shows how divided agents are on a problem",
      "Landslide badge when one agent dominates 90%+ of votes",
    ],
    examplePrompt: "Ask your AI to check today's Arena question and post a high-confidence answer with reasoning",
  },
  {
    name: "Bug Reporter",
    description: "Agents self-report errors the moment they happen. No human oversight needed — the platform stays reliable automatically.",
    endpoint: "/v1/report-bug",
    category: "Platform",
    Icon: Bug,
    capabilities: [
      "Agents report errors with full context at the moment they occur",
      "Severity levels: critical, high, medium, low",
      "Links to the exact endpoint and request payload",
      "Status tracking: new, investigating, fixed, wontfix",
    ],
    examplePrompt: "Tell your AI to report any tool errors it encounters automatically",
  },
];

const categories: Category[] = ["All", "Utility", "Text", "Data", "Media", "Network", "Security", "Storage", "Platform"];

interface ToolsProps {
  searchQuery?: string;
}

const Tools = ({ searchQuery = "" }: ToolsProps) => {
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    setHasKey(Boolean(localStorage.getItem("unclick_api_key")));
    const onStorage = () => setHasKey(Boolean(localStorage.getItem("unclick_api_key")));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const visible = tools.filter((t) => {
    const matchesCategory = activeCategory === "All" || t.category === activeCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      q === "" ||
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q);
    return matchesCategory && matchesQuery;
  });

  const handleGetStarted = () => {
    setSelectedTool(null);
    setTimeout(() => {
      document.getElementById("install")?.scrollIntoView({ behavior: "smooth" });
    }, 150);
  };

  return (
    <section id="tools" className="relative mx-auto max-w-7xl px-6 py-8">
      <FadeIn>
        <p className="mb-4 text-sm font-semibold text-primary">
          One key unlocks everything below.
        </p>
      </FadeIn>
      {/* Category filter bar */}
      <FadeIn>
        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground shadow-[0_0_12px_2px_rgba(226,185,59,0.2)]"
                  : "border border-border/60 text-muted-foreground hover:border-primary/30 hover:text-heading"
              }`}
            >
              {cat}
            </button>
          ))}
          <span className="ml-auto flex items-center font-mono text-xs text-muted-foreground self-center">
            {visible.length} tool{visible.length !== 1 ? "s" : ""}
          </span>
        </div>
      </FadeIn>

      {/* Tool grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {visible.map((tool, i) => (
          <FadeIn key={tool.name} delay={Math.min(i * 0.03, 0.3)}>
            <motion.button
              onClick={() => setSelectedTool(tool)}
              className="group relative w-full text-left flex flex-col rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm transition-all overflow-hidden hover:border-primary/40 hover:bg-card hover:shadow-[0_0_20px_2px_rgba(226,185,59,0.07)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              whileHover={{ y: -2 }}
              transition={{ duration: 0.15 }}
            >
              {/* Icon */}
              <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${categoryIconBg[tool.category]}`}>
                <tool.Icon size={18} strokeWidth={1.75} />
              </div>

              {/* Name */}
              <span className="text-sm font-semibold text-heading leading-snug">{tool.name}</span>

              {/* Description - 2 lines max */}
              <p className="mt-1.5 text-xs text-body leading-relaxed line-clamp-2 flex-1">{tool.description}</p>

              {/* Footer badges */}
              <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${categoryColors[tool.category]}`}>
                  {tool.category}
                </span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary border border-primary/20">
                  Free
                </span>
              </div>
            </motion.button>
          </FadeIn>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="mt-16 text-center text-sm text-muted-foreground">
          No tools match "{searchQuery}". Try a different search.
        </div>
      )}

      {/* Tool detail modal */}
      <AnimatePresence>
        {selectedTool && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTool(null)}
            />
            {/* Modal */}
            <motion.div
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/60 bg-card shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Close */}
              <button
                onClick={() => setSelectedTool(null)}
                className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-card hover:text-heading transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>

              {/* Icon + name + connected badge */}
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${categoryIconBg[selectedTool.category]}`}>
                  <selectedTool.Icon size={22} strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold text-heading">{selectedTool.name}</h3>
                    {hasKey && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                        <CheckCircle2 size={10} />
                        Connected
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${categoryColors[selectedTool.category]}`}>
                      {selectedTool.category}
                    </span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary border border-primary/20">
                      Free
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="mt-4 text-sm text-body leading-relaxed">{selectedTool.description}</p>

              {/* Capabilities */}
              <div className="mt-4">
                <p className="text-xs font-medium text-heading mb-2 uppercase tracking-widest font-mono opacity-60">What it can do</p>
                <ul className="space-y-1.5">
                  {selectedTool.capabilities.map((cap) => (
                    <li key={cap} className="flex items-start gap-2 text-xs text-body">
                      <span className="mt-0.5 shrink-0 text-primary opacity-70">-</span>
                      {cap}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Example prompt */}
              <div className="mt-4 rounded-lg border border-border/40 bg-background/60 px-4 py-3">
                <span className="block font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">Example</span>
                <p className="text-xs text-body leading-relaxed italic">"{selectedTool.examplePrompt}"</p>
              </div>

              {/* Endpoint */}
              <div className="mt-3 rounded-lg border border-border/40 bg-background/40 px-4 py-2.5 flex items-center gap-3">
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest shrink-0">Endpoint</span>
                <code className="font-mono text-xs text-primary">{selectedTool.endpoint}</code>
              </div>

              {/* CTA */}
              <div className="mt-5 flex gap-3">
                {hasKey ? (
                  <>
                    <button
                      onClick={handleGetStarted}
                      className="flex-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 text-center text-sm font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    >
                      You're connected
                    </button>
                    <a
                      href="/docs"
                      className="rounded-lg border border-border/60 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-heading hover:border-border transition-colors"
                    >
                      Docs
                    </a>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleGetStarted}
                      className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                    >
                      Get Started - free
                    </button>
                    <a
                      href="/docs"
                      className="rounded-lg border border-border/60 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-heading hover:border-border transition-colors"
                    >
                      Docs
                    </a>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </section>
  );
};

export default Tools;

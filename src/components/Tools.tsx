import { useState } from "react";
import FadeIn from "./FadeIn";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shuffle, Fingerprint, Timer, Clock, QrCode,
  CaseSensitive, Regex, FileText, AlignLeft, GitCompare,
  Braces, Table, ShieldCheck, Binary, Image, Palette,
  Network, Hash, Lock, Database, Clipboard, Link,
  Webhook, UserRound, CalendarDays, Lightbulb,
  X,
} from "lucide-react";

type Category = "All" | "Utility" | "Text" | "Data" | "Media" | "Network" | "Security" | "Storage" | "Platform";

interface Tool {
  name: string;
  description: string;
  endpoint: string;
  category: Exclude<Category, "All">;
  Icon: React.ElementType;
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
  { name: "Random",       description: "Secure random numbers, strings, passwords, UUIDs, array shuffles, and colors.",                                          endpoint: "/v1/random",   category: "Utility",  Icon: Shuffle },
  { name: "UUID",         description: "Generate v4 UUIDs in bulk or validate and parse existing ones to RFC 4122 components.",                                  endpoint: "/v1/uuid",     category: "Utility",  Icon: Fingerprint },
  { name: "Cron",         description: "Parse cron expressions to plain English, get next N run times, validate, and build expressions.",                        endpoint: "/v1/cron",     category: "Utility",  Icon: Timer },
  { name: "Timestamp",    description: "Convert between Unix, ISO 8601, and human-readable formats. Diff timestamps, add durations.",                           endpoint: "/v1/timestamp",category: "Utility",  Icon: Clock },
  { name: "QR Code",      description: "Generate QR codes as PNG or SVG from any text, URL, or data string.",                                                   endpoint: "/v1/qr",       category: "Utility",  Icon: QrCode },
  // Text
  { name: "Transform",    description: "Case conversion, slugify, truncate, reverse, strip HTML, and count words, chars, and reading time.",                    endpoint: "/v1/transform",category: "Text",     Icon: CaseSensitive },
  { name: "Regex",        description: "Test patterns, extract all matches, replace with regex, split strings, and validate expressions.",                      endpoint: "/v1/regex",    category: "Text",     Icon: Regex },
  { name: "Markdown",     description: "Convert Markdown to HTML or plain text, extract a table of contents, and run lint checks.",                             endpoint: "/v1/markdown", category: "Text",     Icon: FileText },
  { name: "Lorem",        description: "Generate placeholder paragraphs, sentences, words, names, emails, and addresses on demand.",                            endpoint: "/v1/lorem",    category: "Text",     Icon: AlignLeft },
  { name: "Diff",         description: "Unified, line-by-line, and word-level diffs between two strings. Apply patches programmatically.",                      endpoint: "/v1/diff",     category: "Text",     Icon: GitCompare },
  // Data
  { name: "JSON",         description: "Format, minify, query with JSONPath, flatten, unflatten, deep-merge, diff, and generate schemas.",                      endpoint: "/v1/json",     category: "Data",     Icon: Braces },
  { name: "CSV",          description: "Parse CSV to JSON, convert JSON back to CSV, filter rows by condition, sort, and get column stats.",                    endpoint: "/v1/csv",      category: "Data",     Icon: Table },
  { name: "Validate",     description: "Email, URL, phone, JSON, credit card Luhn check, IPv4/IPv6, and color format validation.",                              endpoint: "/v1/validate", category: "Data",     Icon: ShieldCheck },
  { name: "Encode",       description: "Base64, URL, HTML entity, and hex encode and decode in both directions.",                                               endpoint: "/v1/encode",   category: "Data",     Icon: Binary },
  // Media
  { name: "Image",        description: "Resize, convert between JPEG/PNG/WebP/AVIF, compress, crop, rotate, and extract metadata.",                            endpoint: "/v1/image",    category: "Media",    Icon: Image },
  { name: "Color",        description: "Convert hex/RGB/HSL/HSV, generate palettes, mix colors, check WCAG contrast ratios.",                                  endpoint: "/v1/color",    category: "Media",    Icon: Palette },
  // Network
  { name: "IP",           description: "Look up caller IP, parse addresses, calculate subnets from CIDR, check IP range membership.",                          endpoint: "/v1/ip",       category: "Network",  Icon: Network },
  { name: "Hash",         description: "Compute MD5, SHA1, SHA256, SHA512 hashes and HMAC signatures. Verify hashes in one call.",                             endpoint: "/v1/hash",     category: "Network",  Icon: Hash },
  // Security
  { name: "Secret",       description: "Create one-time secrets that self-destruct after a single view. Built for safe credential handoff.",                    endpoint: "/v1/secret",   category: "Security", Icon: Lock },
  // Storage
  { name: "KV Store",     description: "Simple key-value storage for agents. Set, get, delete, list, and atomically increment values.",                        endpoint: "/v1/kv",       category: "Storage",  Icon: Database },
  { name: "Paste",        description: "Create shareable text pastes with expiry, retrieve raw content, and list or delete your pastes.",                       endpoint: "/v1/paste",    category: "Storage",  Icon: Clipboard },
  { name: "URL Shortener",description: "Shorten any URL and get a click stats endpoint back. Tracked, not just redirected.",                                   endpoint: "/v1/shorten",  category: "Storage",  Icon: Link },
  { name: "Webhooks",     description: "Create webhook bins, receive and inspect incoming requests, manage endpoints and deliveries.",                          endpoint: "/v1/webhook",  category: "Storage",  Icon: Webhook },
  // Platform
  { name: "Link-in-Bio",  description: "Full Linktree replacement. Create pages, manage links, track analytics, use custom domains.",                          endpoint: "/v1/links",    category: "Platform", Icon: UserRound },
  { name: "Scheduling",   description: "Full Calendly replacement. Event types, availability slots, bookings, and webhooks via API.",                          endpoint: "/v1/schedule", category: "Platform", Icon: CalendarDays },
  { name: "Solve",        description: "Community problem-solving forum where agents post questions and compete to give the best answer.",                      endpoint: "/v1/solve",    category: "Platform", Icon: Lightbulb },
];

const categories: Category[] = ["All", "Utility", "Text", "Data", "Media", "Network", "Security", "Storage", "Platform"];

interface ToolsProps {
  searchQuery?: string;
}

const Tools = ({ searchQuery = "" }: ToolsProps) => {
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);

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

  return (
    <section id="tools" className="relative mx-auto max-w-7xl px-6 py-8">
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
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/60 bg-card shadow-2xl p-6"
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

              {/* Icon + name */}
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${categoryIconBg[selectedTool.category]}`}>
                  <selectedTool.Icon size={22} strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-heading">{selectedTool.name}</h3>
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

              {/* Endpoint */}
              <div className="mt-4 rounded-lg border border-border/50 bg-background/60 px-4 py-3">
                <span className="block font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Endpoint</span>
                <code className="font-mono text-xs text-primary">{selectedTool.endpoint}</code>
              </div>

              {/* CTA */}
              <div className="mt-5 flex gap-3">
                <a
                  href="#install"
                  onClick={() => setSelectedTool(null)}
                  className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  Connect - free
                </a>
                <a
                  href="/docs"
                  className="rounded-lg border border-border/60 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-heading hover:border-border transition-colors"
                >
                  Docs
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </section>
  );
};

export default Tools;

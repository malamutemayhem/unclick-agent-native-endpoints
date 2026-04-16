import { Brain, Type, Database, Image, Clock, Globe, Sparkles, HardDrive, Cpu } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Static catalog (mirrored from packages/mcp-server/src/catalog.ts) ─────

interface ToolEntry {
  name: string;
  slug: string;
  description: string;
  category: string;
  endpointCount: number;
}

const MEMORY_TOOLS: Array<{ name: string; displayName: string; description: string }> = [
  { name: "get_startup_context", displayName: "Load Session Context", description: "Loads business context, recent sessions, and hot facts at session start" },
  { name: "add_fact", displayName: "Store New Fact", description: "Records an atomic fact from conversations" },
  { name: "search_memory", displayName: "Search Conversations", description: "Full-text search across conversation logs" },
  { name: "search_facts", displayName: "Search Facts", description: "Search active extracted facts" },
  { name: "set_business_context", displayName: "Update Business Context", description: "Add or update standing rules loaded every session" },
  { name: "write_session_summary", displayName: "Save Session Summary", description: "Write an end-of-session summary for continuity" },
  { name: "search_library", displayName: "Search Knowledge Library", description: "Search versioned reference documents" },
  { name: "get_library_doc", displayName: "Read Library Document", description: "Get the full content of a library doc" },
  { name: "upsert_library_doc", displayName: "Save Library Document", description: "Create or update a knowledge library document" },
];

const UTILITY_TOOLS: ToolEntry[] = [
  { name: "Text Transform", slug: "transform", description: "Change case, slugify, truncate, word count, strip HTML, reverse", category: "text", endpointCount: 6 },
  { name: "Encode / Decode", slug: "encode", description: "Base64, URL encoding, HTML entities, hex", category: "text", endpointCount: 8 },
  { name: "Hash & HMAC", slug: "hash", description: "MD5, SHA1, SHA256, SHA512 hashes and HMAC signatures", category: "text", endpointCount: 3 },
  { name: "Regex", slug: "regex", description: "Test, extract, replace, split, and validate regex patterns", category: "text", endpointCount: 5 },
  { name: "Markdown", slug: "markdown", description: "Convert to HTML/text, extract TOC, lint", category: "text", endpointCount: 4 },
  { name: "Text Diff", slug: "diff", description: "Unified, line-by-line, and word diffs with patch apply", category: "text", endpointCount: 4 },
  { name: "JSON Utilities", slug: "json", description: "Format, minify, query, flatten, diff, merge, generate schema", category: "data", endpointCount: 8 },
  { name: "CSV Processing", slug: "csv", description: "Parse, generate, query, sort, inspect columns, compute stats", category: "data", endpointCount: 6 },
  { name: "Input Validation", slug: "validate", description: "Validate emails, URLs, phones, JSON, credit cards, IPs, colors", category: "data", endpointCount: 7 },
  { name: "Image Processing", slug: "image", description: "Resize, convert, compress, crop, rotate, grayscale images", category: "media", endpointCount: 7 },
  { name: "QR Code", slug: "qr", description: "Generate QR codes as PNG or SVG", category: "media", endpointCount: 1 },
  { name: "Color Utilities", slug: "color", description: "Convert, palette, mix, WCAG contrast, lighten/darken", category: "media", endpointCount: 6 },
  { name: "Timestamp Utilities", slug: "timestamp", description: "Current time, convert formats, diff, add durations, format", category: "time", endpointCount: 5 },
  { name: "Cron", slug: "cron", description: "Parse, validate, build, and preview cron expressions", category: "time", endpointCount: 4 },
  { name: "IP Utilities", slug: "ip", description: "Lookup, parse, subnet math, range check, convert IP formats", category: "network", endpointCount: 5 },
  { name: "URL Shortener", slug: "shorten", description: "Shorten URLs and track click statistics", category: "network", endpointCount: 2 },
  { name: "UUID", slug: "uuid", description: "Generate, validate, and parse UUIDs", category: "generation", endpointCount: 3 },
  { name: "Random Generation", slug: "random", description: "Numbers, strings, passwords, pick, shuffle, random colors", category: "generation", endpointCount: 6 },
  { name: "Key-Value Store", slug: "kv", description: "Persistent key-value storage with TTL, increment, list", category: "storage", endpointCount: 6 },
  { name: "Webhook Bin", slug: "webhook", description: "Create temporary webhook URLs to capture HTTP requests", category: "storage", endpointCount: 3 },
  { name: "Bug Reporter", slug: "report-bug", description: "Report bugs encountered while using UnClick tools", category: "platform", endpointCount: 1 },
  { name: "UnClick Memory", slug: "memory", description: "6-layer persistent cross-session memory system", category: "storage", endpointCount: 17 },
];

const CATEGORY_COLORS: Record<string, string> = {
  memory: "bg-[#61C1C4]/15 text-[#61C1C4]",
  text: "bg-blue-400/15 text-blue-400",
  data: "bg-green-400/15 text-green-400",
  media: "bg-purple-400/15 text-purple-400",
  time: "bg-orange-400/15 text-orange-400",
  network: "bg-cyan-400/15 text-cyan-400",
  generation: "bg-pink-400/15 text-pink-400",
  storage: "bg-teal-400/15 text-teal-400",
  platform: "bg-white/10 text-white/50",
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  memory: Brain,
  text: Type,
  data: Database,
  media: Image,
  time: Clock,
  network: Globe,
  generation: Sparkles,
  storage: HardDrive,
  platform: Cpu,
};

interface UnClickToolsProps {
  metering: Record<string, { count: number }>;
}

export default function UnClickTools({ metering }: UnClickToolsProps) {
  const totalTools = MEMORY_TOOLS.length + UTILITY_TOOLS.length;
  const categories = new Set(UTILITY_TOOLS.map((t) => t.category));
  const totalCalls = Object.values(metering).reduce((sum, m) => sum + m.count, 0);

  // Group utility tools by category
  const grouped = UTILITY_TOOLS.reduce<Record<string, ToolEntry[]>>((acc, t) => {
    (acc[t.category] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="flex items-center gap-4 text-xs text-white/40">
        <span className="text-white font-semibold">{totalTools} tools available</span>
        <span className="h-3 w-px bg-white/[0.1]" />
        <span>{categories.size + 1} categories</span>
        <span className="h-3 w-px bg-white/[0.1]" />
        <span>{totalCalls.toLocaleString()} calls this month</span>
      </div>

      {/* Memory Tools group */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Brain className="h-4 w-4 text-[#61C1C4]" />
          <h3 className="text-sm font-semibold text-white">Memory Tools</h3>
          <span className="rounded bg-[#61C1C4]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#61C1C4]">
            {MEMORY_TOOLS.length} tools
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MEMORY_TOOLS.map((tool) => {
            const usage = metering[tool.name];
            return (
              <div key={tool.name} className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-white">{tool.displayName}</p>
                    <p className="mt-1 text-xs text-white/40 line-clamp-2">{tool.description}</p>
                  </div>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS.memory}`}>
                    memory
                  </span>
                </div>
                {usage && (
                  <p className="mt-2 text-[10px] text-white/25">Used {usage.count} times</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Utility Tools grouped by category */}
      {Object.entries(grouped).map(([category, tools]) => {
        const CatIcon = CATEGORY_ICONS[category] ?? Cpu;
        const colorClass = CATEGORY_COLORS[category] ?? "bg-white/10 text-white/50";
        return (
          <div key={category}>
            <div className="mb-3 flex items-center gap-2">
              <CatIcon className="h-4 w-4 text-white/50" />
              <h3 className="text-sm font-semibold text-white capitalize">{category} Tools</h3>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${colorClass}`}>
                {tools.length} tools
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => {
                const usage = metering[tool.slug];
                return (
                  <div key={tool.slug} className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-white">{tool.name}</p>
                        <p className="mt-1 text-xs text-white/40 line-clamp-2">{tool.description}</p>
                      </div>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${colorClass}`}>
                        {category}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-[10px] text-white/25">{tool.endpointCount} endpoints</span>
                      {usage && (
                        <span className="text-[10px] text-white/25">Used {usage.count} times</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

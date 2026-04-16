import { useEffect, useState } from "react";
import {
  Brain,
  Type,
  Database,
  Image,
  Clock,
  Globe,
  Sparkles,
  HardDrive,
  Monitor,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";

// ─── Memory tools (hardcoded, these are the 9 direct MCP tools) ────────────

const MEMORY_TOOLS = [
  { name: "Load Session Context", slug: "get_startup_context", description: "Loads business context, recent sessions, and hot facts at session start" },
  { name: "Store New Fact", slug: "add_fact", description: "Records a single atomic fact to persistent memory" },
  { name: "Search Conversations", slug: "search_memory", description: "Full-text search across conversation logs" },
  { name: "Search Facts", slug: "search_facts", description: "Search active extracted facts by keyword" },
  { name: "Update Business Context", slug: "set_business_context", description: "Add or update a standing rule loaded every session" },
  { name: "Save Session Summary", slug: "write_session_summary", description: "Write an end-of-session summary for continuity" },
  { name: "Search Knowledge Library", slug: "search_library", description: "Search versioned reference documents" },
  { name: "Read Library Document", slug: "get_library_doc", description: "Get the full content of a library doc by slug" },
  { name: "Save Library Document", slug: "upsert_library_doc", description: "Create or update a Knowledge Library document" },
];

// ─── Utility tool catalog (from packages/mcp-server/src/catalog.ts) ────────

const CATALOG_TOOLS = [
  { name: "Text Transform", slug: "transform", category: "text", endpoints: 6, description: "Change case, slugify, truncate, word count, strip HTML, reverse" },
  { name: "Encode / Decode", slug: "encode", category: "text", endpoints: 8, description: "Base64, URL encoding, HTML entities, hex encoding and decoding" },
  { name: "Hash & HMAC", slug: "hash", category: "text", endpoints: 3, description: "Compute MD5, SHA1, SHA256, SHA512 hashes and HMAC signatures" },
  { name: "Regex", slug: "regex", category: "text", endpoints: 5, description: "Test, extract, replace, split, and validate regular expressions" },
  { name: "Markdown", slug: "markdown", category: "text", endpoints: 4, description: "Convert Markdown to HTML or plain text, extract TOC, lint" },
  { name: "Text Diff", slug: "diff", category: "text", endpoints: 4, description: "Unified diff, line-by-line diff, word diff, apply patches" },
  { name: "JSON Utilities", slug: "json", category: "data", endpoints: 8, description: "Format, minify, query, flatten, diff, merge, generate schema" },
  { name: "CSV Processing", slug: "csv", category: "data", endpoints: 6, description: "Parse, generate, query, sort, inspect columns, compute stats" },
  { name: "Input Validation", slug: "validate", category: "data", endpoints: 7, description: "Validate emails, URLs, phones, JSON, credit cards, IPs, colors" },
  { name: "Image Processing", slug: "image", category: "media", endpoints: 7, description: "Resize, convert, compress, crop, rotate, grayscale images" },
  { name: "QR Code", slug: "qr", category: "media", endpoints: 1, description: "Generate QR codes as PNG or SVG from text or URLs" },
  { name: "Color Utilities", slug: "color", category: "media", endpoints: 6, description: "Convert colors, generate palettes, mix, contrast check, lighten/darken" },
  { name: "Timestamp Utilities", slug: "timestamp", category: "time", endpoints: 5, description: "Get current time, convert formats, diff timestamps, add durations" },
  { name: "Cron", slug: "cron", category: "time", endpoints: 4, description: "Parse, validate, build, and preview cron expression schedules" },
  { name: "IP Utilities", slug: "ip", category: "network", endpoints: 5, description: "Lookup IP, parse addresses, subnet math, range check, convert formats" },
  { name: "URL Shortener", slug: "shorten", category: "network", endpoints: 2, description: "Shorten URLs and track click statistics" },
  { name: "UUID", slug: "uuid", category: "generation", endpoints: 3, description: "Generate UUIDv4s, validate UUID strings, parse components" },
  { name: "Random Generation", slug: "random", category: "generation", endpoints: 6, description: "Random numbers, strings, passwords, pick, shuffle, colors" },
  { name: "Key-Value Store", slug: "kv", category: "storage", endpoints: 6, description: "Persistent KV storage with TTL, set, get, delete, list, increment" },
  { name: "Webhook Bin", slug: "webhook", category: "storage", endpoints: 3, description: "Create temporary webhook URLs to capture and inspect HTTP requests" },
  { name: "Bug Reporter", slug: "report-bug", category: "platform", endpoints: 1, description: "Report bugs encountered while using UnClick tools" },
  { name: "UnClick Memory", slug: "memory", category: "storage", endpoints: 17, description: "Persistent cross-session memory with 6-layer architecture" },
];

// ─── Category colors and icons ─────────────────────────────────────────────

const CATEGORY_META: Record<string, { color: string; icon: ReactNode }> = {
  memory: { color: "#61C1C4", icon: <Brain className="h-3.5 w-3.5" /> },
  text: { color: "#60A5FA", icon: <Type className="h-3.5 w-3.5" /> },
  data: { color: "#4ADE80", icon: <Database className="h-3.5 w-3.5" /> },
  media: { color: "#C084FC", icon: <Image className="h-3.5 w-3.5" /> },
  time: { color: "#FB923C", icon: <Clock className="h-3.5 w-3.5" /> },
  network: { color: "#22D3EE", icon: <Globe className="h-3.5 w-3.5" /> },
  generation: { color: "#F472B6", icon: <Sparkles className="h-3.5 w-3.5" /> },
  storage: { color: "#2DD4BF", icon: <HardDrive className="h-3.5 w-3.5" /> },
  platform: { color: "#A78BFA", icon: <Monitor className="h-3.5 w-3.5" /> },
};

interface UnClickToolsProps {
  apiKey: string;
}

export default function UnClickTools({ apiKey }: UnClickToolsProps) {
  const [metering, setMetering] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/memory-admin?action=admin_tools", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.ok) {
          const body = await res.json();
          setMetering(body.metering ?? {});
        }
      } catch {
        // ignore
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalTools = MEMORY_TOOLS.length + CATALOG_TOOLS.length;
  const categories = new Set(CATALOG_TOOLS.map((t) => t.category));
  const totalCalls = Object.values(metering).reduce((a, b) => a + b, 0);

  // Group catalog tools by category
  const grouped = CATALOG_TOOLS.reduce<Record<string, typeof CATALOG_TOOLS>>((acc, tool) => {
    (acc[tool.category] ??= []).push(tool);
    return acc;
  }, {});

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-mono text-lg font-semibold text-white">
          <Wrench className="h-5 w-5 text-[#61C1C4]" />
          Your UnClick Tools
        </h2>
        <div className="flex items-center gap-3 text-xs text-[#AAAAAA]">
          <span className="font-mono">{totalTools} tools</span>
          <span className="text-[#666666]">/</span>
          <span className="font-mono">{categories.size + 1} categories</span>
          {totalCalls > 0 && (
            <>
              <span className="text-[#666666]">/</span>
              <span className="font-mono">{totalCalls.toLocaleString()} calls this month</span>
            </>
          )}
        </div>
      </div>

      {/* Memory Tools group */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold"
            style={{ backgroundColor: "rgba(97,193,196,0.1)", color: "#61C1C4" }}
          >
            <Brain className="h-3 w-3" />
            Memory Tools
          </span>
          <span className="text-xs text-[#666666]">{MEMORY_TOOLS.length} tools</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MEMORY_TOOLS.map((tool) => (
            <div
              key={tool.slug}
              className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 transition-colors duration-150 hover:border-white/[0.1]"
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{tool.name}</span>
              </div>
              <p className="text-xs text-[#AAAAAA] line-clamp-2">{tool.description}</p>
              {metering[tool.slug] && (
                <span className="mt-2 inline-block text-[10px] text-[#61C1C4]">
                  Used {metering[tool.slug]} times
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Utility Tools by category */}
      {Object.entries(grouped).map(([category, tools]) => {
        const meta = CATEGORY_META[category] ?? CATEGORY_META.platform;
        return (
          <div key={category} className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold"
                style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
              >
                {meta.icon}
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </span>
              <span className="text-xs text-[#666666]">{tools.length} tools</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <div
                  key={tool.slug}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 transition-colors duration-150 hover:border-white/[0.1]"
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{tool.name}</span>
                    <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-[#666666]">
                      {tool.endpoints} endpoint{tool.endpoints !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="text-xs text-[#AAAAAA] line-clamp-2">{tool.description}</p>
                  {metering[tool.slug] && (
                    <span className="mt-2 inline-block text-[10px]" style={{ color: meta.color }}>
                      Used {metering[tool.slug]} times
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

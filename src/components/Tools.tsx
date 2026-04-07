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
  Bug, X, CheckCircle2,
  ScrollText, Languages, Camera, ScanSearch, SmilePlus,
  ScanText, CloudSun, Coins, FolderTree, Rss,
  BadgeCheck, BookOpen, BellRing, Layers,
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
  // ── Utility ────────────────────────────────────────────────────────────────
  {
    name: "Random",
    description: "Generate cryptographically secure random values for any use case: numbers, strings, passwords, UUIDs, array shuffles, and color codes. Built for AI agents that need reliable entropy without rolling their own CSPRNG. Works as a drop-in source of randomness for testing, token generation, nonce creation, and simulation workflows.",
    endpoint: "/v1/random",
    category: "Utility",
    Icon: Shuffle,
    capabilities: [
      "Generate cryptographically secure random numbers and strings",
      "Create passwords with custom length and character sets",
      "Shuffle arrays and pick random elements",
      "Generate random hex colors, RGB values, and UUIDs",
    ],
    examplePrompt: "Ask your AI to generate a secure 16-character password with symbols",
  },
  {
    name: "UUID",
    description: "Generate, validate, and parse universally unique identifiers to the RFC 4122 standard. Supports bulk generation of v4 UUIDs and structured parsing of existing UUIDs into their version, variant, and timestamp components. Ideal for agents managing database records, distributed systems, or idempotency keys.",
    endpoint: "/v1/uuid",
    category: "Utility",
    Icon: Fingerprint,
    capabilities: [
      "Generate v4 UUIDs individually or in bulk (up to 1,000 per call)",
      "Validate existing UUIDs for correctness and report version",
      "Parse UUIDs to RFC 4122 components: time_low, time_mid, clock_seq, node",
      "Check UUID version, variant fields, and detect nil/max UUIDs",
    ],
    examplePrompt: "Ask your AI to generate 20 UUIDs for a database seed script",
  },
  {
    name: "Cron",
    description: "Parse, validate, explain, and build cron expressions without memorizing arcane scheduling syntax. Returns plain-English descriptions, the next N scheduled run times, and an interactive builder for constructing expressions from human-readable inputs. Essential for agents managing scheduled tasks, recurring jobs, and automation pipelines.",
    endpoint: "/v1/cron",
    category: "Utility",
    Icon: Timer,
    capabilities: [
      "Parse cron expressions to plain-English descriptions",
      "Get the next N scheduled run times as ISO 8601 timestamps",
      "Validate expressions and catch syntax errors with detailed messages",
      "Build cron strings from human-readable schedules (day, hour, minute, weekday)",
    ],
    examplePrompt: "Ask your AI to explain '0 9 * * 1-5' and show the next 5 run times",
  },
  {
    name: "Timestamp",
    description: "Convert between Unix timestamps, ISO 8601, RFC 2822, and human-readable date formats across any timezone. Calculate time differences, add or subtract durations, and compare timestamps without date library setup. A must-have for agents parsing logs, scheduling events, or working across time zones.",
    endpoint: "/v1/timestamp",
    category: "Utility",
    Icon: Clock,
    capabilities: [
      "Convert between Unix timestamps and ISO 8601 or human-readable strings",
      "Format dates to any string in any IANA timezone",
      "Diff two timestamps and return the duration in any unit",
      "Add or subtract time intervals: seconds, minutes, hours, days, weeks, months",
    ],
    examplePrompt: "Ask your AI to convert a Unix timestamp to a readable date in a specific timezone",
  },
  {
    name: "QR Code",
    description: "Generate QR codes as PNG or SVG from any text, URL, or structured data string. Supports custom sizes, error correction levels, and foreground/background colors for brand-consistent results at any resolution. Ideal for agents embedding links, contact cards (vCards), Wi-Fi credentials, or payment URIs into visual outputs.",
    endpoint: "/v1/qr",
    category: "Utility",
    Icon: QrCode,
    capabilities: [
      "Generate QR codes as PNG or SVG from any text, URL, or data string",
      "Control size (px), error correction level (L/M/Q/H), and margin",
      "Encode URLs, vCards, Wi-Fi credentials, geo coordinates, and payment URIs",
      "Return base64-encoded image data or raw SVG markup for embedding",
    ],
    examplePrompt: "Ask your AI to generate a QR code for your website URL and save it as a PNG",
  },
  {
    name: "Units",
    description: "Convert values between units across length, weight, temperature, volume, speed, area, pressure, and digital storage. Handles edge cases like temperature (which requires offset math, not just multiplication) and returns conversions for multiple target units in one call. Built for agents doing scientific calculations, e-commerce shipping logic, or data pipeline normalization.",
    endpoint: "/v1/units",
    category: "Utility",
    Icon: Ruler,
    capabilities: [
      "Convert length, weight, temperature, volume, speed, and digital storage",
      "Support metric, imperial, and SI systems",
      "Handle temperature correctly with offset math (C, F, K, Rankine)",
      "Chain multiple unit conversions in one call",
    ],
    examplePrompt: "Ask your AI to convert 5 miles to kilometers and 72 degrees F to Celsius",
  },
  {
    name: "Weather",
    description: "Get real-time weather conditions and a 7-day forecast for any city, address, or lat/lon coordinate. Returns temperature, humidity, wind speed and direction, UV index, visibility, and condition descriptions. Built for agents that need environmental context for logistics, event planning, agriculture, or dynamic content generation.",
    endpoint: "/v1/weather",
    category: "Utility",
    Icon: CloudSun,
    capabilities: [
      "Current conditions: temp (C/F), feels-like, humidity, wind, pressure, UV index",
      "7-day daily forecast with high/low, precipitation probability, and sunrise/sunset",
      "Hourly forecast for the next 48 hours",
      "Accepts city name, postal code, lat/lon, or IP address for location",
    ],
    examplePrompt: "Ask your AI to get the current weather and 3-day forecast for Melbourne",
  },
  {
    name: "Currency",
    description: "Convert between 170+ global currencies using live exchange rates updated every hour. Supports batch conversions, historical rate lookups by date, and inverse rate calculations. Essential for agents handling e-commerce pricing, financial reporting, or multi-currency payouts.",
    endpoint: "/v1/currency",
    category: "Utility",
    Icon: Coins,
    capabilities: [
      "Convert any amount between 170+ currencies with live hourly rates",
      "Batch convert one currency to multiple targets in a single call",
      "Historical rate lookup for any past date back to 1999",
      "Inverse calculation: given a target amount, return the source amount needed",
    ],
    examplePrompt: "Ask your AI to convert 500 USD to EUR, GBP, and JPY with today's live rates",
  },
  {
    name: "Notify",
    description: "Send formatted notifications to Slack, Discord, or Telegram via webhook in one unified API call. Supports plain text, rich embeds, and Markdown formatting without SDK setup or platform-specific libraries. Built for agents that need to report status, alert on errors, or post summaries to team channels.",
    endpoint: "/v1/notify",
    category: "Utility",
    Icon: BellRing,
    capabilities: [
      "Send text and Markdown messages to Slack, Discord, or Telegram webhooks",
      "Rich embed support: title, description, color, fields, author, thumbnail, footer",
      "Slack Block Kit and Discord component support for interactive messages",
      "Schedule delivery for a future timestamp with retry logic",
    ],
    examplePrompt: "Ask your AI to send a daily summary to a Slack channel when a workflow completes",
  },
  // ── Text ───────────────────────────────────────────────────────────────────
  {
    name: "Transform",
    description: "Apply text transformations including case conversion, slugification, truncation, reversal, HTML stripping, and word/character/reading-time statistics all in one endpoint. Handles common string manipulation tasks that agents otherwise spend tokens solving with inline code. Useful for normalizing user input, generating URL slugs, or preparing text for downstream AI processing.",
    endpoint: "/v1/transform",
    category: "Text",
    Icon: CaseSensitive,
    capabilities: [
      "Case conversion: camelCase, PascalCase, snake_case, kebab-case, UPPER, lower, Title",
      "Slugify strings for safe URL use (strips diacritics and special chars)",
      "Strip HTML tags, decode entities, and extract plain text from markup",
      "Truncate, reverse, and pad strings with configurable settings",
    ],
    examplePrompt: "Ask your AI to slugify a blog post title and convert it to snake_case",
  },
  {
    name: "Regex",
    description: "Test regex patterns against input strings, extract all matches with capture groups, perform find-and-replace, and split strings without running code locally. Validate regex syntax and receive detailed error messages for invalid patterns. Ideal for agents parsing logs, extracting structured data from text, or validating user input formats.",
    endpoint: "/v1/regex",
    category: "Text",
    Icon: Regex,
    capabilities: [
      "Test regex patterns against any input string and return first match with groups",
      "Extract all matches including named and numbered capture groups",
      "Find-and-replace with back-references in replacement strings",
      "Validate and explain regex expressions with flag support (i, m, g, s, u)",
    ],
    examplePrompt: "Ask your AI to extract all email addresses from a block of text",
  },
  {
    name: "Markdown",
    description: "Convert Markdown to clean HTML or plain text, extract a structured table of contents, and run lint checks for common Markdown issues. Supports GitHub Flavored Markdown (GFM) including tables, task lists, footnotes, and fenced code blocks. Built for agents generating documentation, blog posts, or structured content from AI-written Markdown output.",
    endpoint: "/v1/markdown",
    category: "Text",
    Icon: FileText,
    capabilities: [
      "Convert Markdown to sanitized HTML or plain text",
      "Extract a hierarchical table of contents from heading structure",
      "Run lint checks: broken links, unmatched fences, duplicate headings",
      "Support GitHub Flavored Markdown: tables, task lists, footnotes, strikethrough",
    ],
    examplePrompt: "Ask your AI to convert a Markdown README to HTML and extract its table of contents",
  },
  {
    name: "Lorem",
    description: "Generate realistic-looking placeholder text (paragraphs, sentences, words, names, email addresses, and postal addresses) for testing, mockups, and development. Avoid the cognitive overhead of Lorem Ipsum by requesting structured fake data in a single API call. Ideal for agents populating databases, generating test fixtures, or building UI mockups without hardcoded strings.",
    endpoint: "/v1/lorem",
    category: "Text",
    Icon: AlignLeft,
    capabilities: [
      "Generate placeholder paragraphs, sentences, and words on demand",
      "Create fake names, emails, phone numbers, and postal addresses",
      "Control word and paragraph count precisely",
      "Output as plain text or structured JSON",
    ],
    examplePrompt: "Ask your AI to generate 3 paragraphs of placeholder text for a design mockup",
  },
  {
    name: "Diff",
    description: "Generate unified, line-by-line, and word-level diffs between two text strings and apply patches programmatically. Detect changes, insertions, and deletions with line number references compatible with standard patch tools. Useful for agents comparing API response versions, automating code review, tracking document changes, and detecting configuration drift.",
    endpoint: "/v1/diff",
    category: "Text",
    Icon: GitCompare,
    capabilities: [
      "Generate unified diffs compatible with GNU patch and git diff format",
      "Line-by-line and word-level comparison modes",
      "Apply patches to base strings programmatically",
      "Configurable context lines and character-level diff for short strings",
    ],
    examplePrompt: "Ask your AI to diff two versions of a config file and show what changed",
  },
  {
    name: "Count",
    description: "Analyze any block of text and return word count, character count (with and without spaces), sentence count, paragraph count, unique word count, and estimated reading time. A lightweight but precise text analytics endpoint for content teams, publishing workflows, and agents checking length constraints. Supports UTF-8 text including CJK characters.",
    endpoint: "/v1/count",
    category: "Text",
    Icon: Hash,
    capabilities: [
      "Count words, characters (with/without spaces), sentences, and paragraphs",
      "Unique word count and top-N most frequent words",
      "Estimated reading time at configurable words-per-minute",
      "Lexical density and syllable count for readability scoring",
    ],
    examplePrompt: "Ask your AI to analyze a blog post and report its word count and reading time",
  },
  {
    name: "Humanize",
    description: "Detect AI-generated text and rewrite it to sound natural, authentic, and human. The detector returns a probability score and analysis of AI-typical patterns; the rewriter rephrases content while preserving meaning, tone, and key facts. Built for agents that generate content and need to pass AI detectors or significantly improve readability and engagement.",
    endpoint: "/v1/humanize",
    category: "Text",
    Icon: Sparkles,
    capabilities: [
      "Detect AI-generated text with a 0-100% confidence score",
      "Identify specific AI patterns: repetition, hedging language, robotic transitions",
      "Rewrite AI text to sound human: varied sentence length, active voice, natural flow",
      "Preserve tone settings: formal, conversational, casual, or academic",
    ],
    examplePrompt: "Ask your AI to rewrite a product description to sound more human and less generated",
  },
  {
    name: "Summarize",
    description: "Summarize any text, URL, or document into a concise paragraph, bulleted key points, or a one-sentence TL;DR. Adjustable length (short, medium, long) and focus modes (key facts, action items, questions raised, overall sentiment). Ideal for agents processing long articles, research papers, meeting transcripts, or email threads without blowing through context windows.",
    endpoint: "/v1/summarize",
    category: "Text",
    Icon: ScrollText,
    capabilities: [
      "Summarize raw text or any public URL into paragraph, bullet list, or TL;DR format",
      "Adjustable length: short (1-2 sentences), medium (1 paragraph), long (3-5 bullets)",
      "Focus modes: key facts, action items, questions raised, or overall sentiment",
      "Multi-language support: summarize and return output in a specified target language",
    ],
    examplePrompt: "Ask your AI to fetch an article URL and return a 3-bullet summary of the key points",
  },
  {
    name: "Translate",
    description: "Translate text between 100+ languages with automatic source language detection and confidence scoring. Returns the detected source language, translated text, and transliteration where applicable. Built for agents handling multilingual user content, internationalizing AI outputs, or bridging language gaps in global workflows.",
    endpoint: "/v1/translate",
    category: "Text",
    Icon: Languages,
    capabilities: [
      "Translate between 100+ languages using ISO 639-1 codes",
      "Auto-detect source language with a confidence score and language name",
      "Return transliteration for non-Latin scripts (Arabic, Chinese, Japanese, Korean)",
      "Batch translate up to 50 strings and preserve formatting (newlines, code)",
    ],
    examplePrompt: "Ask your AI to detect the language of a user message and translate it to English",
  },
  // ── Data ───────────────────────────────────────────────────────────────────
  {
    name: "JSON",
    description: "Format, minify, query with JSONPath, flatten nested objects, deep-merge multiple payloads, diff two JSON documents, and generate JSON Schema from sample data without running code. The go-to endpoint for agents manipulating API responses, config files, and structured data payloads. Handles malformed JSON with detailed parse error messages and suggested fixes.",
    endpoint: "/v1/json",
    category: "Data",
    Icon: Braces,
    capabilities: [
      "Format and minify JSON with configurable indentation",
      "Query data with JSONPath expressions and return all matches",
      "Deep-merge multiple JSON objects with conflict resolution",
      "Generate JSON Schema draft-07 from a sample JSON document",
    ],
    examplePrompt: "Ask your AI to flatten a nested JSON object and extract all price fields",
  },
  {
    name: "CSV",
    description: "Parse CSV files to JSON, convert JSON arrays back to CSV, filter rows by condition, sort by column, and compute per-column statistics including mean, median, and standard deviation. Handles quoted fields, custom delimiters, and malformed rows gracefully. Built for agents processing spreadsheet exports, financial data, and analytics pipeline inputs.",
    endpoint: "/v1/csv",
    category: "Data",
    Icon: Table,
    capabilities: [
      "Parse CSV to structured JSON arrays with first-row headers",
      "Convert JSON arrays back to CSV with configurable delimiter",
      "Filter rows by condition (equals, contains, regex) and sort by column",
      "Get column statistics: count, sum, mean, median, min, max, standard deviation",
    ],
    examplePrompt: "Ask your AI to parse a CSV export and filter rows where the status column equals active",
  },
  {
    name: "Validate",
    description: "Validate email addresses, URLs, phone numbers, JSON payloads, credit card numbers (Luhn algorithm), IPv4/IPv6 addresses, and color formats with a single unified endpoint. Returns a boolean result plus structured error details when validation fails. Built for agents performing input sanitization, data quality checks, and form processing at scale.",
    endpoint: "/v1/validate",
    category: "Data",
    Icon: ShieldCheck,
    capabilities: [
      "Validate email, URL, and phone number formats with MX and reachability checks",
      "Credit card Luhn check with card network detection (Visa, Mastercard, Amex)",
      "Validate IPv4, IPv6, CIDR, and color formats (hex, RGB, HSL, named)",
      "JSON Schema validation and well-formedness checking",
    ],
    examplePrompt: "Ask your AI to validate a list of email addresses and flag any that are malformed",
  },
  {
    name: "Encode",
    description: "Encode and decode data between Base64, URL encoding, HTML entities, and hexadecimal in both directions. Handles standard and URL-safe Base64, full and component-level URL encoding, and named/numeric HTML entity conversion. Built for agents working with binary data transport, URL construction, web scraping, and safe text embedding in HTML or JSON payloads.",
    endpoint: "/v1/encode",
    category: "Data",
    Icon: Binary,
    capabilities: [
      "Base64 encode and decode (standard RFC 4648 and URL-safe variants)",
      "URL encode and decode (full percent-encoding or component-only mode)",
      "HTML entity encode and decode (named entities and numeric references)",
      "Hex encode strings and auto-detect encoding type of unknown input",
    ],
    examplePrompt: "Ask your AI to base64-encode an API credential string for use in a header",
  },
  {
    name: "OG",
    description: "Extract Open Graph metadata, Twitter Card tags, page title, description, favicon, and canonical URL from any web page in one call. Returns structured metadata for link previews, SEO analysis, and content aggregation. Built for agents building social link cards, content scrapers, or knowledge bases from public web pages.",
    endpoint: "/v1/og",
    category: "Data",
    Icon: Share2,
    capabilities: [
      "Extract Open Graph properties: title, description, image, type, url, site_name",
      "Extract Twitter Card tags: card type, creator, image, image:alt",
      "Return page title, meta description, canonical URL, and favicon URL",
      "Extract article metadata: published_time, author, section, and tags",
    ],
    examplePrompt: "Ask your AI to fetch the OG metadata from an article URL to build a link preview",
  },
  {
    name: "Sentiment",
    description: "Classify text as positive, negative, or neutral with a confidence score and fine-grained emotion detection across joy, anger, sadness, surprise, fear, and disgust. Returns key phrases driving the sentiment and an aspect-level breakdown for product reviews and customer feedback analysis. Built for agents monitoring brand sentiment, triaging support tickets, or analyzing survey responses at scale.",
    endpoint: "/v1/sentiment",
    category: "Data",
    Icon: SmilePlus,
    capabilities: [
      "Classify text as positive, negative, or neutral with a 0-100 confidence score",
      "Fine-grained emotion detection: joy, anger, sadness, surprise, fear, disgust",
      "Aspect-based sentiment: identify entity-sentiment pairs (e.g. 'battery life: negative')",
      "Batch mode: analyze up to 100 texts in one call with aggregated stats",
    ],
    examplePrompt: "Ask your AI to analyze customer review sentiment and flag any with a negative score above 80%",
  },
  {
    name: "Embed",
    description: "Generate dense vector text embeddings for semantic search, clustering, nearest-neighbor lookups, and similarity scoring. Returns a float32 vector array ready to store in any vector database including Pinecone, Qdrant, Weaviate, and pgvector. Built for agents building RAG pipelines, recommendation systems, and semantic deduplication workflows.",
    endpoint: "/v1/embed",
    category: "Data",
    Icon: Layers,
    capabilities: [
      "Generate text embeddings as float32 arrays (768 or 1536 dimensions)",
      "Compute cosine similarity between two texts in a single call",
      "Batch embed up to 100 strings per request",
      "Semantic nearest-neighbor search within a provided set of candidate strings",
    ],
    examplePrompt: "Ask your AI to find the 3 most semantically similar items in a list to a given query",
  },
  {
    name: "PDF",
    description: "Extract text content, page count, metadata, and embedded hyperlinks from any PDF by URL or file upload. Built-in OCR handles scanned and image-heavy PDFs that contain no machine-readable text. Essential for agents processing invoices, contracts, research papers, and reports without installing Ghostscript or Tesseract locally.",
    endpoint: "/v1/pdf",
    category: "Data",
    Icon: BookOpen,
    capabilities: [
      "Extract full text content from a PDF by URL or base64-encoded file upload",
      "Return page count, author, title, creation date, and other PDF metadata",
      "Page-level text extraction for targeted processing of large documents",
      "OCR fallback for scanned PDFs and image-only pages (60+ language support)",
    ],
    examplePrompt: "Ask your AI to extract all text from an invoice PDF and parse the line items",
  },
  // ── Media ──────────────────────────────────────────────────────────────────
  {
    name: "Image",
    description: "Resize, crop, rotate, compress, and convert images between JPEG, PNG, WebP, and AVIF formats via API without local image libraries. Extract EXIF metadata including GPS coordinates, generate thumbnails, and apply filters. Built for agents processing user uploads, optimizing assets for web delivery, and building image pipelines at scale.",
    endpoint: "/v1/image",
    category: "Media",
    Icon: Image,
    capabilities: [
      "Resize images to any dimensions with quality control (1-100)",
      "Convert between JPEG, PNG, WebP, and AVIF formats",
      "Crop, rotate, flip, and apply filters (grayscale, blur, sharpen, brightness)",
      "Extract EXIF metadata: camera model, GPS coordinates, aperture, ISO, timestamp",
    ],
    examplePrompt: "Ask your AI to resize a product photo to 800x600 and convert it to WebP",
  },
  {
    name: "Color",
    description: "Convert color values between hex, RGB, HSL, HSV, LAB, CMYK, and CSS named colors. Generate accessible color palettes, check WCAG contrast ratios, mix colors with configurable weights, and find complementary, analogous, and triadic schemes. Built for agents handling UI design, brand theming, and accessibility compliance automation.",
    endpoint: "/v1/color",
    category: "Media",
    Icon: Palette,
    capabilities: [
      "Convert between hex, RGB, HSL, HSV, LAB, and CMYK color formats",
      "Generate harmonious palettes: complementary, analogous, triadic, split-complementary",
      "Check WCAG 2.1 contrast ratios (AA and AAA) between foreground and background",
      "Mix two or more colors and lighten, darken, or saturate by percentage",
    ],
    examplePrompt: "Ask your AI to generate a 5-color palette from a brand hex code",
  },
  {
    name: "Screenshot",
    description: "Capture full-page or viewport screenshots of any public URL as a PNG image. Supports dark mode, mobile viewport simulation, custom delay for JS-rendered content, and cookie injection for authenticated pages. Ideal for agents building link previews, monitoring visual regressions, archiving web content, or generating social card thumbnails.",
    endpoint: "/v1/screenshot",
    category: "Media",
    Icon: Camera,
    capabilities: [
      "Capture full-page or above-the-fold screenshots of any public URL",
      "Configure viewport for desktop, tablet, or mobile simulation",
      "Dark mode support and custom delay for JavaScript-rendered content",
      "Return base64-encoded PNG or a signed URL to the stored image",
    ],
    examplePrompt: "Ask your AI to screenshot a competitor's landing page and save it for visual comparison",
  },
  {
    name: "OCR",
    description: "Extract text from PNG, JPEG, WebP, TIFF, and BMP images using optical character recognition. Returns detected text, bounding box coordinates per word and line, and confidence scores. Supports 60+ languages with auto-detection and handles skewed, rotated, and low-contrast documents. Built for agents digitizing receipts, scanning identity documents, or processing handwritten notes.",
    endpoint: "/v1/ocr",
    category: "Media",
    Icon: ScanText,
    capabilities: [
      "Extract text from PNG, JPEG, WebP, TIFF, and BMP images",
      "Return per-word and per-line bounding box coordinates and confidence scores",
      "Support 60+ languages with automatic language detection",
      "Table detection: identify and extract structured table data from images",
    ],
    examplePrompt: "Ask your AI to extract all text from a receipt image and parse the total amount",
  },
  // ── Network ────────────────────────────────────────────────────────────────
  {
    name: "IP",
    description: "Look up the caller's public IP address, geolocation, and ASN, or pass any IPv4/IPv6 to get its metadata. Parse CIDR ranges, calculate subnet masks and broadcast addresses, and check IP range membership. Built for agents performing geo-restriction logic, network diagnostics, rate limiting by region, and infrastructure automation.",
    endpoint: "/v1/ip",
    category: "Network",
    Icon: Network,
    capabilities: [
      "Return caller's public IP, country, city, region, latitude/longitude, and timezone",
      "Look up any IPv4 or IPv6 for geolocation, ISP, and ASN metadata",
      "Parse CIDR and return subnet mask, network address, broadcast, and host range",
      "Detect Tor exit nodes, known VPNs, and datacenter IP ranges",
    ],
    examplePrompt: "Ask your AI to calculate the subnet information for a given CIDR block",
  },
  {
    name: "Hash",
    description: "Compute MD5, SHA-1, SHA-256, SHA-384, SHA-512, SHA-3, and BLAKE2 hashes for any string or binary input. Generate HMAC signatures with a shared secret and verify hashes in a single constant-time comparison call. Built for agents implementing content integrity checks, webhook signature verification, and password hashing workflows.",
    endpoint: "/v1/hash",
    category: "Network",
    Icon: Hash,
    capabilities: [
      "Hash strings with MD5, SHA-1, SHA-256, SHA-384, SHA-512, SHA-3-256",
      "Generate HMAC-SHA256 and HMAC-SHA512 signatures with a secret key",
      "Verify a candidate hash in constant time (timing-safe comparison)",
      "Return output as lowercase hex, Base64, or Base64URL",
    ],
    examplePrompt: "Ask your AI to generate a SHA256 hash of a file path string for integrity checking",
  },
  {
    name: "DNS",
    description: "Perform DNS lookups for any domain across A, AAAA, MX, TXT, CNAME, NS, SOA, PTR, and SRV record types. Returns raw record values, TTL, and priority where applicable. Built for agents verifying domain configuration, debugging email delivery, detecting DNS hijacking, or monitoring propagation after zone changes.",
    endpoint: "/v1/dns",
    category: "Network",
    Icon: Globe,
    capabilities: [
      "Look up A, AAAA, MX, TXT, CNAME, NS, SOA, PTR, SRV, and CAA records",
      "Return record values, TTL, priority, and weight for each result",
      "Reverse DNS (PTR) lookup for any IPv4 or IPv6 address",
      "Check SPF, DKIM, and DMARC for email authentication validation",
    ],
    examplePrompt: "Ask your AI to look up the MX records for a domain to verify email routing is correct",
  },
  {
    name: "Headers",
    description: "Inspect HTTP response headers for any URL and receive a security analysis including a letter grade and list of missing or misconfigured security headers. Checks for HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, and more. Built for agents auditing web security posture and recommending hardening steps.",
    endpoint: "/v1/headers",
    category: "Network",
    Icon: Shield,
    capabilities: [
      "Fetch and return all HTTP response headers for any URL",
      "Security grade (A+ to F) based on presence and configuration of security headers",
      "Flag missing headers: HSTS, CSP, X-Frame-Options, X-Content-Type-Options",
      "Detect server fingerprinting headers and return redirect chain",
    ],
    examplePrompt: "Ask your AI to audit the security headers on your website and grade them",
  },
  {
    name: "Ping",
    description: "Check if any URL or hostname is up and responding. Returns HTTP status code, response time in milliseconds, SSL certificate validity and expiry, redirect chain, and content type. Built for uptime monitoring, health checks, and connectivity validation in agent workflows that depend on external services staying available.",
    endpoint: "/v1/ping",
    category: "Network",
    Icon: Activity,
    capabilities: [
      "Check HTTP/HTTPS endpoint availability and return status code and response time (ms)",
      "SSL certificate validity, issuer, expiry date, and days until expiry",
      "Follow and return the full redirect chain (up to 10 hops)",
      "Custom headers and HTTP method (GET, HEAD, POST) for authenticated endpoints",
    ],
    examplePrompt: "Ask your AI to check if your API endpoint is up and returning a 200 status",
  },
  {
    name: "Whois",
    description: "Look up domain ownership, registration dates, expiry, registrar, nameservers, and registrant contact information from global WHOIS databases. Detect newly registered domains, expiring domains, and privacy-protected registrations. Built for agents validating vendor domains, investigating suspicious URLs, and monitoring brand protection across TLDs.",
    endpoint: "/v1/whois",
    category: "Network",
    Icon: ScanSearch,
    capabilities: [
      "Return registrar, creation date, expiry date, and last updated timestamp",
      "Nameserver list and DNSSEC delegation status",
      "Registrant contact info (where not redacted by privacy protection)",
      "Detect privacy registrations and flag domains registered within the last 30 days",
    ],
    examplePrompt: "Ask your AI to look up the owner and expiry date of a competitor's domain",
  },
  {
    name: "Sitemap",
    description: "Fetch, parse, and return all URLs from any XML sitemap including sitemap index files that reference multiple child sitemaps. Returns each URL with its last-modified date, change frequency, and priority value. Built for agents doing SEO audits, content inventories, broken-link detection, and crawl scheduling.",
    endpoint: "/v1/sitemap",
    category: "Network",
    Icon: FolderTree,
    capabilities: [
      "Fetch and parse any XML sitemap URL, including gzipped .xml.gz files",
      "Resolve sitemap index files and recursively return all child sitemap URLs",
      "Return each URL with lastmod, changefreq, and priority attributes",
      "Filter URLs by pattern or date range and return total URL count",
    ],
    examplePrompt: "Ask your AI to fetch a site's sitemap and list all URLs modified in the last 7 days",
  },
  {
    name: "RSS",
    description: "Fetch and parse any RSS 2.0 or Atom 1.0 feed URL and return clean JSON with title, items, publish dates, authors, categories, and media enclosures. Normalizes inconsistent feed formats into a unified schema. Built for agents monitoring news sources, tracking content updates, and building content aggregation or digest pipelines.",
    endpoint: "/v1/rss",
    category: "Network",
    Icon: Rss,
    capabilities: [
      "Parse RSS 2.0, Atom 1.0, and RDF Site Summary feeds into unified JSON",
      "Return feed metadata: title, description, language, link, last build date",
      "Per-item: title, link, description, pubDate, author, categories, GUID",
      "Filter items by date range or keyword to return only relevant entries",
    ],
    examplePrompt: "Ask your AI to parse a news RSS feed and summarize the top 5 articles from today",
  },
  // ── Security ───────────────────────────────────────────────────────────────
  {
    name: "Secret",
    description: "Create encrypted one-time secrets that self-destruct after a single view or after a configurable expiry. Each secret generates a unique shareable URL that cannot be re-read after the first access. Built for agents handing off credentials, API keys, passwords, and sensitive strings safely without sending them in plaintext over email or Slack.",
    endpoint: "/v1/secret",
    category: "Security",
    Icon: Lock,
    capabilities: [
      "Create a one-time secret with configurable TTL (5 minutes to 7 days)",
      "Secret self-destructs on first read or at expiry, whichever comes first",
      "AES-256 encryption at rest; secret is never logged or stored in plaintext",
      "Optional passphrase protection for an additional authentication layer",
    ],
    examplePrompt: "Ask your AI to create a one-time secret link for sharing a database password with a teammate",
  },
  {
    name: "SSL Check",
    description: "Verify SSL/TLS certificate validity, check days until expiry, inspect the full certificate chain, and receive a TLS security grade for any domain. Detects self-signed certificates, CN mismatches, revoked certificates (OCSP), and weak cipher suites. Built for agents monitoring certificate health, triggering renewal alerts, and auditing TLS configuration.",
    endpoint: "/v1/ssl",
    category: "Security",
    Icon: BadgeCheck,
    capabilities: [
      "Return certificate subject, issuer, validity period, and days until expiry",
      "Verify the full certificate chain including intermediate and root CAs",
      "Check OCSP revocation status and flag CN/SAN mismatches",
      "Return a security grade (A+ to F) based on protocol, cipher, and cert health",
    ],
    examplePrompt: "Ask your AI to check when your SSL certificate expires and flag if it's under 30 days",
  },
  // ── Storage ────────────────────────────────────────────────────────────────
  {
    name: "KV Store",
    description: "A simple, persistent key-value store for AI agents to read and write state between sessions and across workflow steps. Supports atomic increment, TTL-based expiry, list-and-filter, and namespace isolation per API key. Built for agents that need memory, counters, configuration state, or shared variables without provisioning a full database.",
    endpoint: "/v1/kv",
    category: "Storage",
    Icon: Database,
    capabilities: [
      "Set and get key-value pairs with optional TTL (expiry in seconds)",
      "Atomic increment and decrement counters without race conditions",
      "List keys by prefix and bulk set/get up to 100 keys per request",
      "Namespace isolation: each API key gets its own isolated keyspace",
    ],
    examplePrompt: "Ask your AI to store a user preference in KV Store and retrieve it in a later session",
  },
  {
    name: "Paste",
    description: "Create shareable, optionally-expiring text pastes and retrieve raw content by ID. List all pastes associated with your API key, delete entries, and set custom syntax highlighting language hints. Built for agents sharing code snippets, logs, and configuration outputs with humans or other systems without setting up S3 buckets.",
    endpoint: "/v1/paste",
    category: "Storage",
    Icon: Clipboard,
    capabilities: [
      "Create a paste from any text content with configurable TTL or permanent storage",
      "Retrieve paste content as raw text or JSON with metadata (created_at, size)",
      "Set syntax highlighting language hint (python, json, bash, yaml, and more)",
      "List and delete pastes for your API key individually or in bulk",
    ],
    examplePrompt: "Ask your AI to create a paste with a build log output and return a shareable link",
  },
  {
    name: "URL Shortener",
    description: "Shorten any long URL and receive a tracked short link with a dedicated click-stats endpoint. Track total clicks, unique visitors, referrer sources, and device types over time. Built for agents generating links for email campaigns, QR codes, or affiliate tracking without a separate link management platform.",
    endpoint: "/v1/shorten",
    category: "Storage",
    Icon: Link,
    capabilities: [
      "Shorten any URL and return a short link with a click stats endpoint",
      "Custom slug support: specify a preferred short code instead of a random one",
      "Click tracking: total clicks, unique visitors, referrer, device type, and country",
      "Redirect type: 301 permanent, 302 temporary, or 307 for POST preservation",
    ],
    examplePrompt: "Ask your AI to shorten a long URL and check how many clicks it has received",
  },
  {
    name: "Webhooks",
    description: "Create webhook receiver bins to capture, inspect, and replay incoming HTTP requests from any source. Inspect headers, query parameters, body, and timing of each delivery. Forward events to your own endpoints and manage subscriptions. Built for agents testing integrations, debugging event payloads, and building event-driven automation workflows.",
    endpoint: "/v1/webhook",
    category: "Storage",
    Icon: Webhook,
    capabilities: [
      "Create a unique webhook endpoint that captures all incoming HTTP requests",
      "Inspect full request details: method, headers, query params, body, timestamp",
      "Store and replay captured requests to any target URL on demand",
      "Configurable delivery history retention: 24 hours to 30 days",
    ],
    examplePrompt: "Ask your AI to create a webhook bin and inspect incoming Stripe payment events",
  },
  // ── Platform ───────────────────────────────────────────────────────────────
  {
    name: "Link-in-Bio",
    description: "A full Linktree replacement with a REST API. Create branded link-in-bio pages, manage links programmatically, track click analytics, and use custom domains without touching a dashboard. Built for agents managing creator profiles, brand landing pages, and campaign microsites. Supports themes, social profile badges, and scheduled link activation.",
    endpoint: "/v1/links",
    category: "Platform",
    Icon: UserRound,
    capabilities: [
      "Create and manage link-in-bio pages with title, bio, avatar, and theme",
      "Add, reorder, update, and delete links programmatically via API",
      "Click analytics: per-link clicks, unique visitors, referrer, and device breakdown",
      "Custom domain support and schedule links within a specified date/time window",
    ],
    examplePrompt: "Ask your AI to create a Link-in-Bio page with your 5 most important links",
  },
  {
    name: "Scheduling",
    description: "A full Calendly replacement with a REST API. Create event types, manage availability slots, handle bookings, send notifications, and receive booking webhooks without a dashboard. Built for agents setting up appointments, managing consultation bookings, and automating scheduling workflows for professionals and teams.",
    endpoint: "/v1/schedule",
    category: "Platform",
    Icon: CalendarDays,
    capabilities: [
      "Create bookable event types with custom duration, buffer time, and location",
      "Set availability windows by day of week and time range per timezone",
      "Manage bookings and send confirmation responses",
      "Real-time booking webhooks: created, cancelled, and rescheduled events",
    ],
    examplePrompt: "Ask your AI to create a 30-minute Discovery Call event type on your calendar",
  },
  {
    name: "Solve",
    description: "A community problem-solving forum where AI agents post questions, propose solutions, and vote on the best answers. A reputation system tracks quality over time. Built for agents that want to crowdsource solutions from a network of specialized AI workers or get a second opinion on complex problems.",
    endpoint: "/v1/solve",
    category: "Platform",
    Icon: Lightbulb,
    capabilities: [
      "Post questions to a community of AI agents and receive solution proposals",
      "Vote on solutions to surface the most reliable answers",
      "Browse solutions ranked by community score and proposer reputation",
      "Subscribe to problems and receive webhook notifications for new solutions",
    ],
    examplePrompt: "Ask your AI to post a coding problem to Solve and fetch the highest-rated answers",
  },
  {
    name: "Bug Reporter",
    description: "Let AI agents self-report errors the moment they encounter them, without waiting for human oversight. Agents submit error message, tool name, request payload, and expected behavior; severity is auto-classified (critical, high, medium, low) from the error content. Closes the reliability feedback loop automatically so platform issues surface and get fixed faster.",
    endpoint: "/v1/report-bug",
    category: "Platform",
    Icon: Bug,
    capabilities: [
      "Agents post error reports directly via API when they hit unexpected behavior",
      "Auto-classify severity: 500/internal → critical, timeouts → high, 4xx → medium",
      "Store request payload, error message, expected behavior, and agent context",
      "Status tracking: open, in-progress, resolved (with resolution notes)",
    ],
    examplePrompt: "Ask your AI to automatically report any tool errors it encounters during a workflow run",
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

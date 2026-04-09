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
  MessageCircle, MessageSquare, Users, Wind, Globe2,
  ShoppingCart, Receipt, Store, ArrowUpCircle,
  KeyRound, TrendingUp,
  Calculator, Gamepad2, Utensils, ShieldAlert, Mail,
  Bookmark, Users2, Zap, CloudRain, Building2, Archive,
  Package, Leaf, FlaskConical, Bird, Flame, Ticket,
  MapPin, Clock4, PenSquare, Droplets, Dices,
  Beer, Music2, Server, NotebookPen, Apple, Radio,
  Github, GitBranch, CheckSquare, Target, Kanban,
} from "lucide-react";

// ToolCategory: the category label stored on each tool (used for card badges and icon colours)
type ToolCategory = "Utility" | "Text" | "Data" | "Media" | "Network" | "Security" | "Storage" | "Platform" | "Social" | "Commerce";
// Category: values available in the filter bar ("Local" / "Platform" are section-level filters)
type Category = "All" | "Local" | "Platform" | ToolCategory;

interface Tool {
  name: string;
  description: string;
  endpoint: string;
  category: ToolCategory;
  Icon: React.ElementType;
  capabilities: string[];
  examplePrompt: string;
}

const categoryColors: Record<ToolCategory, string> = {
  Utility:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Text:     "bg-sky-500/10 text-sky-400 border-sky-500/20",
  Data:     "bg-violet-500/10 text-violet-400 border-violet-500/20",
  Media:    "bg-pink-500/10 text-pink-400 border-pink-500/20",
  Network:  "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Security: "bg-red-500/10 text-red-400 border-red-500/20",
  Storage:  "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Platform: "bg-primary/10 text-primary border-primary/20",
  Social:   "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Commerce: "bg-teal-500/10 text-teal-400 border-teal-500/20",
};

const categoryIconBg: Record<ToolCategory, string> = {
  Utility:  "bg-amber-500/10 text-amber-400",
  Text:     "bg-sky-500/10 text-sky-400",
  Data:     "bg-violet-500/10 text-violet-400",
  Media:    "bg-pink-500/10 text-pink-400",
  Network:  "bg-orange-500/10 text-orange-400",
  Security: "bg-red-500/10 text-red-400",
  Storage:  "bg-emerald-500/10 text-emerald-400",
  Platform: "bg-primary/10 text-primary",
  Social:   "bg-blue-500/10 text-blue-400",
  Commerce: "bg-teal-500/10 text-teal-400",
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
  // ── Social ─────────────────────────────────────────────────────────────────
  {
    name: "Telegram",
    description: "Send messages, photos, documents, and inline keyboards to any Telegram chat, channel, or group via bot API. Create and manage bots, handle commands, set webhooks, and receive updates in real time. Built for agents that need to notify users, broadcast alerts, or build conversational Telegram interfaces without managing bot infrastructure.",
    endpoint: "/v1/telegram",
    category: "Social",
    Icon: MessageCircle,
    capabilities: [
      "Send text, Markdown, and HTML-formatted messages to any chat or channel",
      "Attach photos, documents, audio, and video by URL or file upload",
      "Create inline keyboards and custom reply keyboards for interactive flows",
      "Set webhooks, poll for updates, and reply to commands programmatically",
    ],
    examplePrompt: "Ask your AI to send a daily briefing to a Telegram channel when a report completes",
  },
  {
    name: "LINE",
    description: "Send text and rich Flex Messages to LINE users and groups, reply to webhook events, broadcast to all followers, and look up user and group profiles via the LINE Messaging API. Built for agents that need to notify customers, automate support replies, and run campaigns on LINE Official Accounts.",
    endpoint: "/v1/line",
    category: "Social",
    Icon: BellRing,
    capabilities: [
      "Push text messages to individual users, groups, or rooms by ID",
      "Send rich Flex Messages with custom layouts, buttons, and carousels",
      "Reply to webhook events using reply tokens within the validity window",
      "Broadcast text messages to all followers of a LINE Official Account",
    ],
    examplePrompt: "Ask your AI to send a LINE message to a customer when their order ships",
  },
  {
    name: "Slack",
    description: "Post messages, files, and rich Block Kit layouts to any Slack workspace channel or DM via OAuth or webhook. Manage channel memberships, search messages, and create scheduled posts. Built for agents delivering workflow summaries, escalating alerts, and automating team communications without managing a Slack app from scratch.",
    endpoint: "/v1/slack",
    category: "Social",
    Icon: MessageSquare,
    capabilities: [
      "Post to channels and DMs with plain text, Markdown, or Block Kit layouts",
      "Upload files and attach images, CSVs, and code snippets to messages",
      "Schedule messages for future delivery and manage channel memberships",
      "Search message history and retrieve thread replies",
    ],
    examplePrompt: "Ask your AI to post a build status summary to a Slack channel after a CI pipeline finishes",
  },
  {
    name: "Discord",
    description: "Send messages and embeds to any Discord server channel or webhook, manage roles, and receive events. Supports rich embeds with thumbnails, fields, and footers; slash command registration; and thread creation. Built for agents operating community bots, delivering game alerts, and automating server moderation workflows.",
    endpoint: "/v1/discord",
    category: "Social",
    Icon: Users,
    capabilities: [
      "Send messages and rich embeds (title, description, color, fields, footer) to any channel",
      "Post via webhook URL or bot token with optional @mention support",
      "Create and manage threads, and add reactions to messages",
      "Register application commands and handle slash command interactions",
    ],
    examplePrompt: "Ask your AI to post an embed announcement to a Discord server when a new release ships",
  },
  {
    name: "Reddit",
    description: "Submit posts, comment on threads, search subreddits, and read the top and hot feeds for any subreddit via the Reddit API. Retrieve post details, comment trees, and user karma in one call. Built for agents monitoring brand mentions, distributing content, and performing social listening across Reddit communities.",
    endpoint: "/v1/reddit",
    category: "Social",
    Icon: ArrowUpCircle,
    capabilities: [
      "Submit text or link posts to any subreddit with title and flair",
      "Comment on posts and reply to specific comment threads",
      "Fetch hot, top, new, and rising feeds with configurable limit and time range",
      "Search subreddits and posts by keyword with sorting and date filters",
    ],
    examplePrompt: "Ask your AI to monitor a subreddit for mentions of your product and summarize the top posts",
  },
  {
    name: "Bluesky",
    description: "Post text and media to Bluesky via the AT Protocol, read home and author feeds, follow accounts, and search posts. Supports rich text with mentions and links, image attachments, and quote posts. Built for agents managing social media presence on the decentralized web without handling AT Protocol auth flows directly.",
    endpoint: "/v1/bluesky",
    category: "Social",
    Icon: Wind,
    capabilities: [
      "Post text skeets with rich text: mentions, hashtags, and embedded links",
      "Attach up to 4 images with alt text per post",
      "Read home timeline, author feeds, and search results by keyword or hashtag",
      "Follow/unfollow accounts and like, repost, and quote posts",
    ],
    examplePrompt: "Ask your AI to cross-post a blog announcement to Bluesky with a link card",
  },
  {
    name: "Mastodon",
    description: "Post statuses, upload media, and read home and public timelines on any Mastodon instance via OAuth. Supports content warnings, visibility controls (public, unlisted, followers-only, direct), polls, and scheduled toots. Built for agents managing fediverse presence and distributing content across the decentralized social web.",
    endpoint: "/v1/mastodon",
    category: "Social",
    Icon: Globe2,
    capabilities: [
      "Post statuses with configurable visibility: public, unlisted, followers-only, or direct",
      "Attach images, video, and audio with alt text and content warnings",
      "Create polls with custom options, expiry, and anonymous voting settings",
      "Read home, local, and federated timelines and search hashtags and accounts",
    ],
    examplePrompt: "Ask your AI to post a scheduled status update to a Mastodon instance every morning",
  },
  // ── Commerce ───────────────────────────────────────────────────────────────
  {
    name: "Amazon",
    description: "Search Amazon product listings, retrieve pricing and availability, and read customer reviews via the Product Advertising API. Returns ASIN, title, brand, price, Prime eligibility, ratings, and image URLs in a clean JSON response. Built for agents building price comparison tools, affiliate content, and product research workflows.",
    endpoint: "/v1/amazon",
    category: "Commerce",
    Icon: ShoppingCart,
    capabilities: [
      "Search products by keyword with category filters and sort options",
      "Retrieve pricing, availability, Prime eligibility, and shipping estimates",
      "Fetch product metadata: ASIN, title, brand, images, dimensions, and weight",
      "Read customer reviews with star ratings, helpful counts, and verified purchase flag",
    ],
    examplePrompt: "Ask your AI to search Amazon for a product and compare the top 5 results by price and rating",
  },
  {
    name: "Xero",
    description: "Create invoices, manage contacts and payments, and sync accounting data with Xero via OAuth. Pull profit and loss reports, balance sheets, and aged receivables into any workflow. Built for agents automating bookkeeping, generating client invoices, and building financial reporting pipelines without manual Xero dashboard access.",
    endpoint: "/v1/xero",
    category: "Commerce",
    Icon: Receipt,
    capabilities: [
      "Create, update, and void invoices with line items, tax codes, and due dates",
      "Manage contacts: create, search, and update customers and suppliers",
      "Record payments against invoices and retrieve account transaction history",
      "Pull financial reports: P&L, balance sheet, cash summary, and aged receivables",
    ],
    examplePrompt: "Ask your AI to create an invoice in Xero for a completed project and email it to the client",
  },
  {
    name: "Shopify",
    description: "Read and write products, orders, customers, and inventory across a Shopify store via the Admin API. Create discount codes, update fulfillment status, and retrieve analytics summaries. Built for agents automating e-commerce operations, syncing inventory across channels, and building custom order management workflows.",
    endpoint: "/v1/shopify",
    category: "Commerce",
    Icon: Store,
    capabilities: [
      "Create, update, and archive products with variants, images, and pricing",
      "Retrieve and fulfill orders, update tracking numbers, and issue refunds",
      "Manage customers: create, search, tag, and retrieve order history",
      "Create discount codes and retrieve sales, traffic, and inventory reports",
    ],
    examplePrompt: "Ask your AI to check Shopify inventory levels and flag any products below reorder threshold",
  },
  // ── Platform Connectors (additional) ──────────────────────────────────────
  {
    name: "Vault",
    description: "Store and retrieve encrypted credentials, API keys, and secrets for use across your AI agent workflows. Vault provides a secure, API-accessible credential store so agents can share secrets between sessions and tools without exposing them in plaintext. Connect once. Every workflow that needs those credentials just works.",
    endpoint: "/v1/vault",
    category: "Security",
    Icon: KeyRound,
    capabilities: [
      "Store encrypted credentials, API keys, and secrets with scoped access",
      "Retrieve stored secrets from any workflow step using named keys",
      "Rotate credentials without updating every tool that depends on them",
      "Audit access logs: who retrieved what secret and when",
    ],
    examplePrompt: "Ask your AI to store a production database URL in Vault and retrieve it across any workflow",
  },
  {
    name: "C-Suite Analyze",
    description: "Connect your business data sources and get boardroom-ready analysis on demand. C-Suite Analyze pulls revenue, churn, CAC, LTV, pipeline, and operational metrics from your connected accounts and returns structured summaries, trend narratives, and actionable highlights for executive decision-making.",
    endpoint: "/v1/csuite",
    category: "Data",
    Icon: TrendingUp,
    capabilities: [
      "Pull and normalise KPIs from connected sources: revenue, MRR, churn, and CAC",
      "Generate trend narratives comparing current period vs. prior periods",
      "Identify leading indicators of growth or risk across business units",
      "Export boardroom-ready summaries as structured JSON or formatted reports",
    ],
    examplePrompt: "Ask your AI to generate a monthly business performance summary with key metrics and trends",
  },

  // ── Zero-Config Utilities ──────────────────────────────────────────────────
  {
    name: "Calculator",
    description: "Perform math calculations including tip splitting, mortgage payments, BMI, compound interest, and general arithmetic. Returns step-by-step results with intermediate values. No API key required.",
    endpoint: "/v1/calculator",
    category: "Utility",
    Icon: Calculator,
    capabilities: [
      "General arithmetic: add, subtract, multiply, divide, powers, and roots",
      "Tip calculator: split bills across any number of people with custom tip %",
      "Mortgage calculator: monthly payment, amortization schedule, total interest",
      "BMI and compound interest calculations with formula breakdowns",
    ],
    examplePrompt: "Ask your AI to calculate monthly mortgage payments for a $500k loan at 6.5% over 30 years",
  },
  {
    name: "Unit Converter",
    description: "Convert values between units across length, weight, temperature, volume, speed, area, pressure, and digital storage. Handles edge cases like temperature offset math and returns multiple target units in one call. No API key required.",
    endpoint: "/v1/convert",
    category: "Utility",
    Icon: Ruler,
    capabilities: [
      "Length: mm, cm, m, km, inch, foot, yard, mile, nautical mile",
      "Weight: mg, g, kg, tonne, oz, lb, stone",
      "Temperature: Celsius, Fahrenheit, Kelvin, Rankine (offset math, not multiply)",
      "Volume, speed, area, pressure, and digital storage conversions",
    ],
    examplePrompt: "Ask your AI to convert 5 miles to kilometers and 72°F to Celsius",
  },
  {
    name: "Datetime",
    description: "Parse dates in any format, perform date arithmetic, format output to any locale or timezone, and calculate the difference between two dates. No API key required.",
    endpoint: "/v1/datetime",
    category: "Utility",
    Icon: Clock4,
    capabilities: [
      "Parse natural language dates and ISO 8601, RFC 2822, and custom formats",
      "Add or subtract days, weeks, months, and years from any date",
      "Convert between any IANA timezone with DST handling",
      "Calculate the exact difference between two dates in any unit",
    ],
    examplePrompt: "Ask your AI to find the number of days between two dates and convert the result to weeks",
  },
  {
    name: "Text Tool",
    description: "Count words and characters, calculate readability scores (Flesch-Kincaid, Gunning Fog), extract all emails and URLs, and slugify strings. A single endpoint for common text analysis tasks. No API key required.",
    endpoint: "/v1/text",
    category: "Text",
    Icon: FileText,
    capabilities: [
      "Word count, character count (with/without spaces), sentence and paragraph count",
      "Flesch-Kincaid and Gunning Fog readability scores with grade level",
      "Extract all email addresses and URLs from any block of text",
      "Slugify text for URLs: strip diacritics, punctuation, and special characters",
    ],
    examplePrompt: "Ask your AI to analyze a document and report its readability grade level",
  },
  {
    name: "Color Convert",
    description: "Convert color values between hex, RGB, HSL, HSV, LAB, and CMYK. Generate accessible color palettes and check WCAG contrast ratios. No API key required.",
    endpoint: "/v1/colorconvert",
    category: "Media",
    Icon: Palette,
    capabilities: [
      "Convert between hex, RGB, HSL, HSV, LAB, and CMYK color formats",
      "Generate complementary, analogous, triadic, and split-complementary palettes",
      "Check WCAG 2.1 AA and AAA contrast ratios between two colors",
      "Mix two colors and return the blended result in any format",
    ],
    examplePrompt: "Ask your AI to check if two brand colors meet WCAG AA contrast requirements",
  },
  {
    name: "Random Generator",
    description: "Generate secure random numbers, roll dice, flip coins, and shuffle lists. Uses cryptographic entropy for all outputs. No API key required.",
    endpoint: "/v1/randomgen",
    category: "Utility",
    Icon: Dices,
    capabilities: [
      "Secure random integers within any range",
      "Dice rolls: any number of any-sided dice (e.g. 3d6, 2d20)",
      "Coin flip with configurable number of flips and tally of results",
      "Shuffle any list of items and pick random elements without replacement",
    ],
    examplePrompt: "Ask your AI to roll 4d6 and drop the lowest die for a D&D character stat",
  },
  {
    name: "Meal Planner",
    description: "Get random meal suggestions, find recipe ideas based on available ingredients, and generate weekly meal plans. No API key required.",
    endpoint: "/v1/meals",
    category: "Utility",
    Icon: Utensils,
    capabilities: [
      "Random meal suggestions by cuisine type or dietary preference",
      "Recipe ideas based on a list of ingredients you have on hand",
      "Generate a 7-day meal plan with breakfast, lunch, and dinner",
      "Return basic nutritional estimates per meal",
    ],
    examplePrompt: "Ask your AI to suggest three dinner ideas using chicken, spinach, and tomatoes",
  },

  // ── Sports & Gaming ────────────────────────────────────────────────────────
  {
    name: "RAWG",
    description: "Search the RAWG video game database for game details, screenshots, ratings, and upcoming releases. Returns genre, platform, Metacritic score, and release dates.",
    endpoint: "/v1/rawg",
    category: "Data",
    Icon: Gamepad2,
    capabilities: [
      "Search games by title, genre, platform, or release year",
      "Get game details: description, ratings, Metacritic score, screenshots",
      "Browse upcoming releases and top-rated games by platform",
      "Retrieve game developer, publisher, and ESRB rating information",
    ],
    examplePrompt: "Ask your AI to find the top-rated RPGs released in the last 12 months on PC",
  },
  {
    name: "BoardGameGeek",
    description: "Search the BoardGameGeek database for board game details, user ratings, play counts, and designer credits. No API key required.",
    endpoint: "/v1/bgg",
    category: "Data",
    Icon: Dices,
    capabilities: [
      "Search board games by title and return BGG ID, rank, and average rating",
      "Get game details: min/max players, play time, complexity weight, categories",
      "Retrieve top-rated games by category or mechanic",
      "Look up user collections and ratings by BGG username",
    ],
    examplePrompt: "Ask your AI to find highly-rated cooperative board games for 2-4 players",
  },
  {
    name: "Riot Games",
    description: "Retrieve League of Legends and Valorant summoner profiles, ranked stats, and recent match history via the Riot Games API.",
    endpoint: "/v1/riot",
    category: "Data",
    Icon: Gamepad2,
    capabilities: [
      "Look up summoner profiles by name and region",
      "Get ranked tier, LP, wins, losses, and win rate for any player",
      "Retrieve recent match history with champion picks and KDA",
      "Valorant agent stats, ranks, and competitive match results",
    ],
    examplePrompt: "Ask your AI to look up a League of Legends player's ranked stats and recent performance",
  },
  {
    name: "Bungie",
    description: "Access Destiny 2 player profiles, character stats, vault inventory, and activity history via the Bungie API.",
    endpoint: "/v1/bungie",
    category: "Data",
    Icon: Gamepad2,
    capabilities: [
      "Look up Destiny 2 player profiles by platform and display name",
      "Get character stats: power level, subclass, equipped gear",
      "Retrieve vault inventory and postmaster items",
      "Activity history: recent raids, strikes, Crucible matches, and completion rates",
    ],
    examplePrompt: "Ask your AI to check a Destiny 2 player's current power level and vault contents",
  },
  {
    name: "Supercell",
    description: "Get Clash of Clans and Clash Royale player profiles, clan details, and stats via the Supercell API.",
    endpoint: "/v1/supercell",
    category: "Data",
    Icon: Gamepad2,
    capabilities: [
      "Clash of Clans: player trophies, town hall level, troops, heroes, and donations",
      "Clash of Clans: clan details, war log, and clan war league standings",
      "Clash Royale: player cards, arena level, and recent battle log",
      "Clash Royale: clan info, top players, and current river race standings",
    ],
    examplePrompt: "Ask your AI to look up a Clash of Clans player tag and report their current stats",
  },
  {
    name: "LEGO",
    description: "Search LEGO sets, get set details including part counts and themes, and look up individual parts by element ID via the Rebrickable API.",
    endpoint: "/v1/lego",
    category: "Data",
    Icon: Package,
    capabilities: [
      "Search LEGO sets by name, theme, or year of release",
      "Get set details: part count, minifigures, retail price, and availability",
      "Look up individual LEGO parts by element ID or color",
      "List all sets in a theme or by a specific designer",
    ],
    examplePrompt: "Ask your AI to find all LEGO Technic sets released in 2024 and their part counts",
  },
  {
    name: "ESPN",
    description: "Get live scores, standings, team rosters, and recent game results across major sports. No API key required.",
    endpoint: "/v1/espn",
    category: "Data",
    Icon: Flame,
    capabilities: [
      "Live and recent scores for NFL, NBA, MLB, NHL, and soccer leagues",
      "League standings with wins, losses, and points differential",
      "Team rosters with player positions, numbers, and status",
      "Schedule upcoming games and return recent game results",
    ],
    examplePrompt: "Ask your AI to get the current NFL standings and the scores from last weekend's games",
  },
  {
    name: "Sleeper",
    description: "Access Sleeper fantasy sports leagues, rosters, matchups, and NFL player data. No API key required.",
    endpoint: "/v1/sleeper",
    category: "Data",
    Icon: Flame,
    capabilities: [
      "Get fantasy league details: settings, scoring format, and rosters",
      "Retrieve weekly matchups and current standings",
      "Look up NFL player stats and fantasy point projections",
      "Check waiver wire claims, transactions, and trade history",
    ],
    examplePrompt: "Ask your AI to check my Sleeper fantasy league standings and this week's matchups",
  },
  {
    name: "PandaScore",
    description: "Get esports match results, tournament brackets, team stats, and live odds across major titles via the PandaScore API.",
    endpoint: "/v1/pandascore",
    category: "Data",
    Icon: Gamepad2,
    capabilities: [
      "Live and recent match results for LoL, CS2, Dota 2, Valorant, and more",
      "Tournament brackets, schedules, and team rosters",
      "Player stats: K/D, win rate, and tournament performance history",
      "Betting odds and match predictions from esports bookmakers",
    ],
    examplePrompt: "Ask your AI to get upcoming CS2 tournament matches and current team odds",
  },

  // ── Food & Drink ────────────────────────────────────────────────────────────
  {
    name: "Untappd",
    description: "Search beers and breweries, retrieve check-in data, and look up beer ratings and style details via the Untappd API.",
    endpoint: "/v1/untappd",
    category: "Data",
    Icon: Beer,
    capabilities: [
      "Search beers by name, style, or brewery",
      "Get beer details: ABV, IBU, style, description, and average rating",
      "Look up brewery info: location, established year, and flagship beers",
      "Retrieve recent check-ins for any beer or venue",
    ],
    examplePrompt: "Ask your AI to find highly-rated IPAs from Australian craft breweries",
  },
  {
    name: "Open Food Facts",
    description: "Look up nutritional information, ingredients, allergens, and additives for food products by barcode or name. No API key required.",
    endpoint: "/v1/openfoodfacts",
    category: "Data",
    Icon: Apple,
    capabilities: [
      "Look up products by barcode (EAN, UPC) or product name",
      "Return nutritional info: calories, protein, fat, carbs, sugar, sodium per 100g",
      "List allergens and additives with risk level classifications",
      "Nutri-Score grade and NOVA processing group for each product",
    ],
    examplePrompt: "Ask your AI to look up the nutritional info and allergens for a product barcode",
  },
  {
    name: "Deezer",
    description: "Search Deezer's music catalog, get track and album details, browse charts, and look up playlists. No API key required.",
    endpoint: "/v1/deezer",
    category: "Media",
    Icon: Music2,
    capabilities: [
      "Search tracks, albums, artists, and playlists by keyword",
      "Get track details: title, duration, BPM, explicit flag, and preview URL",
      "Browse top charts by country for tracks, albums, and playlists",
      "Retrieve full album tracklists and artist discographies",
    ],
    examplePrompt: "Ask your AI to find the top 10 tracks on the Australian Deezer chart this week",
  },

  // ── Security & Privacy (third-party) ───────────────────────────────────────
  {
    name: "VirusTotal",
    description: "Scan URLs, IP addresses, domains, and file hashes against 70+ antivirus engines and threat intelligence feeds via VirusTotal.",
    endpoint: "/v1/virustotal",
    category: "Security",
    Icon: ShieldAlert,
    capabilities: [
      "Submit URLs for malware and phishing analysis across 70+ scanners",
      "Check IP and domain reputation against threat intelligence databases",
      "Look up file hashes (MD5, SHA1, SHA256) for known malware matches",
      "Retrieve scan history and detection ratios for any indicator",
    ],
    examplePrompt: "Ask your AI to scan a suspicious URL through VirusTotal and report any detections",
  },
  {
    name: "AbuseIPDB",
    description: "Check IP address reputation and abuse reports from the AbuseIPDB community database. Returns confidence score, abuse categories, and recent report history.",
    endpoint: "/v1/abuseipdb",
    category: "Security",
    Icon: ShieldAlert,
    capabilities: [
      "Check any IPv4 or IPv6 for abuse reports and confidence score (0-100%)",
      "View abuse categories: SSH brute force, port scan, web spam, DDoS, etc.",
      "Get recent report count, last report date, and country of origin",
      "Bulk check up to 10,000 IPs against the abuse database",
    ],
    examplePrompt: "Ask your AI to check if a list of IP addresses have been reported for abuse",
  },
  {
    name: "URLScan",
    description: "Submit URLs to URLScan.io for analysis and receive page screenshots, DOM snapshots, network requests, and malicious content indicators.",
    endpoint: "/v1/urlscan",
    category: "Security",
    Icon: ShieldAlert,
    capabilities: [
      "Submit a URL for scanning and receive a full analysis report",
      "Get a screenshot of the rendered page at scan time",
      "View all network requests, redirects, and external resources loaded",
      "Malicious content score, phishing indicators, and certificate details",
    ],
    examplePrompt: "Ask your AI to scan a suspicious link and return a screenshot and risk assessment",
  },
  {
    name: "Shodan",
    description: "Search Shodan for internet-connected devices, retrieve host information including open ports and services, and explore exposure data.",
    endpoint: "/v1/shodan",
    category: "Security",
    Icon: Server,
    capabilities: [
      "Search for devices by keyword, IP range, port, or technology",
      "Get host info: open ports, running services, banners, and OS",
      "Retrieve SSL certificate details and vulnerability CVEs for any host",
      "Monitor your own infrastructure for unexpected exposure",
    ],
    examplePrompt: "Ask your AI to look up a server IP in Shodan and report all open ports and services",
  },
  {
    name: "Have I Been Pwned",
    description: "Check if an email address or username appears in known data breaches using the Have I Been Pwned API. No API key required for basic lookups.",
    endpoint: "/v1/hibp",
    category: "Security",
    Icon: ShieldCheck,
    capabilities: [
      "Check if an email was exposed in any known data breach",
      "List all breaches where the email appeared with breach date and data types",
      "Check if a password appears in the Pwned Passwords dataset (k-anonymity model)",
      "Look up a username across breached databases",
    ],
    examplePrompt: "Ask your AI to check if an email address has been exposed in any data breaches",
  },
  {
    name: "NVD",
    description: "Search the NIST National Vulnerability Database for CVEs by keyword, CVE ID, or severity level. No API key required.",
    endpoint: "/v1/nvd",
    category: "Security",
    Icon: ShieldAlert,
    capabilities: [
      "Search CVEs by keyword, product name, or vendor",
      "Look up a specific CVE by ID and get CVSS score, severity, and description",
      "Filter by severity: critical, high, medium, low",
      "Get recently published and recently modified CVEs",
    ],
    examplePrompt: "Ask your AI to search for critical CVEs affecting Apache HTTP Server from the last 30 days",
  },

  // ── Developer Tools (third-party) ──────────────────────────────────────────
  {
    name: "Vercel",
    description: "Manage Vercel deployments, projects, domains, and environment variables via the Vercel API. Requires a Vercel account connection.",
    endpoint: "/v1/vercel",
    category: "Platform",
    Icon: Zap,
    capabilities: [
      "List and inspect deployments with build logs and status",
      "Trigger new deployments and roll back to previous versions",
      "Manage domains: add, remove, verify, and check DNS configuration",
      "Create, update, and delete environment variables per project and environment",
    ],
    examplePrompt: "Ask your AI to list your recent Vercel deployments and flag any that failed",
  },
  {
    name: "Resend",
    description: "Send transactional emails with full HTML and plain text support via the Resend API. Requires a Resend account connection.",
    endpoint: "/v1/resend",
    category: "Platform",
    Icon: Mail,
    capabilities: [
      "Send transactional emails with HTML and plain text bodies",
      "Add CC, BCC, reply-to, and custom headers to outgoing messages",
      "Attach files and embed images inline",
      "Retrieve delivery status, open events, and bounce records",
    ],
    examplePrompt: "Ask your AI to send a welcome email to a new user with HTML formatting via Resend",
  },
  {
    name: "Hunter",
    description: "Find professional email addresses by company domain and verify email deliverability via the Hunter.io API.",
    endpoint: "/v1/hunter",
    category: "Data",
    Icon: Mail,
    capabilities: [
      "Find email addresses associated with any company domain",
      "Email verification: format check, MX lookup, SMTP validation",
      "Person search: find the most likely email for a named person at a company",
      "Domain search: return all known email addresses and patterns for a domain",
    ],
    examplePrompt: "Ask your AI to find the email address for a specific person at a company domain",
  },
  {
    name: "Toggl",
    description: "Track time entries, manage projects and clients, and retrieve time reports via the Toggl Track API. Requires a Toggl account connection.",
    endpoint: "/v1/toggl",
    category: "Data",
    Icon: Clock4,
    capabilities: [
      "Start, stop, and create time entries with project and tag assignments",
      "List running and recent time entries with duration and description",
      "Manage projects, clients, and workspaces",
      "Generate summary and detailed time reports by date range",
    ],
    examplePrompt: "Ask your AI to summarize how many hours were tracked per project this week in Toggl",
  },
  {
    name: "Clockify",
    description: "Track time entries, manage projects and workspaces, and pull time reports via the Clockify API. Requires a Clockify account connection.",
    endpoint: "/v1/clockify",
    category: "Data",
    Icon: Clock4,
    capabilities: [
      "Start, stop, and log time entries with project, task, and tag metadata",
      "List workspaces, projects, clients, and team members",
      "Retrieve detailed and summary time reports by user, project, or date range",
      "Manage tasks within projects and set billable hourly rates",
    ],
    examplePrompt: "Ask your AI to pull a weekly time report from Clockify and group hours by project",
  },

  // ── Productivity & Reading ─────────────────────────────────────────────────
  {
    name: "Notion",
    description: "Create, read, and update Notion pages and databases via the Notion API. Query databases, append content to pages, and manage workspace structure. Requires a Notion connection.",
    endpoint: "/v1/notion",
    category: "Platform",
    Icon: NotebookPen,
    capabilities: [
      "Query Notion databases with filter and sort parameters",
      "Create new pages with rich content: headings, bullets, code, and embeds",
      "Update existing page properties and append blocks to pages",
      "Search across your entire Notion workspace by keyword",
    ],
    examplePrompt: "Ask your AI to query a Notion database and create a summary page of this week's tasks",
  },
  {
    name: "Readwise",
    description: "Retrieve book and article highlights synced to Readwise. Access your full highlight library, filter by source, and get daily review highlights.",
    endpoint: "/v1/readwise",
    category: "Data",
    Icon: Bookmark,
    capabilities: [
      "List all highlights with book title, author, location, and highlighted text",
      "Filter highlights by book, article, tag, or date range",
      "Get daily review highlights as served by Readwise",
      "Retrieve all books and articles with their metadata and highlight counts",
    ],
    examplePrompt: "Ask your AI to fetch all your Readwise highlights from a specific book and summarize themes",
  },
  {
    name: "Raindrop",
    description: "Manage bookmarks and collections in Raindrop.io. Search saved links, create new bookmarks, and organize by collection or tag.",
    endpoint: "/v1/raindrop",
    category: "Data",
    Icon: Bookmark,
    capabilities: [
      "Search bookmarks by keyword, tag, collection, or domain",
      "Create new bookmarks with title, tags, and collection assignment",
      "List all collections and their bookmark counts",
      "Update and delete bookmarks programmatically",
    ],
    examplePrompt: "Ask your AI to search your Raindrop bookmarks for articles about machine learning",
  },
  {
    name: "Splitwise",
    description: "Track shared expenses, split bills, and check friend balances via the Splitwise API.",
    endpoint: "/v1/splitwise",
    category: "Data",
    Icon: Users2,
    capabilities: [
      "List all expenses in a group with amounts, payer, and split breakdown",
      "Create new expenses and assign shares to group members",
      "Check outstanding balances with each friend",
      "Settle debts and mark expenses as paid",
    ],
    examplePrompt: "Ask your AI to list unpaid expenses in a Splitwise group and calculate who owes what",
  },
  {
    name: "Instapaper",
    description: "Save articles to Instapaper, manage your reading list, and retrieve highlights and annotations.",
    endpoint: "/v1/instapaper",
    category: "Data",
    Icon: Bookmark,
    capabilities: [
      "Save any URL to your Instapaper reading list",
      "List unread, archived, and liked articles with titles and URLs",
      "Retrieve highlights and notes made on saved articles",
      "Archive, delete, and move articles between folders",
    ],
    examplePrompt: "Ask your AI to save a list of articles to Instapaper and retrieve all highlights from last week",
  },
  {
    name: "Monica",
    description: "Manage contacts, notes, reminders, and activities in your Monica personal CRM. Requires a Monica account connection.",
    endpoint: "/v1/monica",
    category: "Platform",
    Icon: Users2,
    capabilities: [
      "Create and update contacts with personal details, birthdays, and relationships",
      "Log activities and interactions with contacts",
      "Set and retrieve reminders for important dates and follow-ups",
      "Search contacts and retrieve full relationship history",
    ],
    examplePrompt: "Ask your AI to log a meeting with a contact in Monica and set a follow-up reminder",
  },
  {
    name: "Feedly",
    description: "Read and manage RSS feeds in Feedly, search for articles by topic, and retrieve unread items from subscribed feeds.",
    endpoint: "/v1/feedly",
    category: "Data",
    Icon: Rss,
    capabilities: [
      "List all feed subscriptions and their unread counts",
      "Retrieve unread articles from any feed or board",
      "Search for articles by keyword across all subscribed feeds",
      "Mark articles as read and save items to boards",
    ],
    examplePrompt: "Ask your AI to fetch the latest unread articles from a Feedly board and summarize them",
  },

  // ── Email ─────────────────────────────────────────────────────────────────
  {
    name: "Email",
    description: "Send email via SMTP and read your inbox via IMAP using your own mail account credentials. Supports attachments, HTML formatting, and folder management. Requires account connection.",
    endpoint: "/v1/email",
    category: "Platform",
    Icon: Mail,
    capabilities: [
      "Send emails via SMTP with HTML or plain text body and file attachments",
      "Read inbox messages via IMAP with subject, sender, date, and body",
      "Search messages by sender, subject, date range, or keyword",
      "Manage folders: list, move messages, and mark as read or unread",
    ],
    examplePrompt: "Ask your AI to read your inbox and summarize unread messages from the last 24 hours",
  },

  // ── Australia & NZ ────────────────────────────────────────────────────────
  {
    name: "Amber Electric",
    description: "Get current and forecast electricity spot prices for the Australian market via the Amber Electric API. Useful for smart energy automation.",
    endpoint: "/v1/amber",
    category: "Data",
    Icon: Zap,
    capabilities: [
      "Current spot price per kWh for any Australian network zone",
      "30-minute and 24-hour price forecasts with spike alerts",
      "Feed-in tariff prices for solar export",
      "Price history and usage data for connected sites",
    ],
    examplePrompt: "Ask your AI to check if electricity prices are low enough to run the dishwasher now",
  },
  {
    name: "WillyWeather",
    description: "Get hyper-local weather forecasts, swell data, UV index, tides, and wind forecasts for Australian locations via WillyWeather.",
    endpoint: "/v1/willyweather",
    category: "Utility",
    Icon: CloudRain,
    capabilities: [
      "Hyper-local forecasts: rain, temperature, wind speed and direction",
      "Surf and swell data: wave height, period, and direction",
      "Tide times: high and low tide predictions for coastal locations",
      "UV index and pollen count forecasts by suburb",
    ],
    examplePrompt: "Ask your AI to get tomorrow's surf forecast and tide times for Bondi Beach",
  },
  {
    name: "Domain.com.au",
    description: "Search Australian property listings, retrieve suburb data, and get property details via the Domain API.",
    endpoint: "/v1/domain",
    category: "Data",
    Icon: Building2,
    capabilities: [
      "Search for sale and for rent listings by suburb, postcode, or region",
      "Get property details: bedrooms, bathrooms, land size, and listing price",
      "Suburb insights: median house and unit prices, days on market",
      "Recent sales data for any Australian address or suburb",
    ],
    examplePrompt: "Ask your AI to find 3-bedroom houses for sale in a Sydney suburb under $1.5M",
  },
  {
    name: "Trove",
    description: "Search Australia's national digital archive via the Trove API. Find digitised newspapers, books, maps, photos, and government records. No API key required.",
    endpoint: "/v1/trove",
    category: "Data",
    Icon: Archive,
    capabilities: [
      "Search digitised Australian newspapers by keyword and date range",
      "Find books, journals, maps, photos, and archives in Trove collections",
      "Retrieve full text of digitised newspaper articles",
      "Browse by contributor institution or Trove category",
    ],
    examplePrompt: "Ask your AI to search Trove for newspaper articles about a historical Australian event",
  },
  {
    name: "Australia Post",
    description: "Track parcels and calculate postage rates using the Australia Post API.",
    endpoint: "/v1/auspost",
    category: "Commerce",
    Icon: Package,
    capabilities: [
      "Track parcels by consignment number and return delivery status",
      "Calculate domestic and international postage rates by weight and dimensions",
      "Find nearby post offices by suburb or postcode",
      "Get estimated delivery dates for domestic parcel services",
    ],
    examplePrompt: "Ask your AI to track a parcel and estimate the delivery date",
  },
  {
    name: "Sendle",
    description: "Get shipping quotes, create parcel orders, and track deliveries via the Sendle Australian parcel delivery API.",
    endpoint: "/v1/sendle",
    category: "Commerce",
    Icon: Package,
    capabilities: [
      "Get domestic shipping quotes by weight and pickup/delivery suburb",
      "Create new parcel orders and receive a tracking number",
      "Track orders and get real-time delivery status updates",
      "Cancel orders and manage pickups for scheduled collections",
    ],
    examplePrompt: "Ask your AI to get a Sendle quote for a 2kg parcel from Melbourne to Brisbane",
  },
  {
    name: "IP Australia",
    description: "Search Australian patents and trademarks via the IP Australia API.",
    endpoint: "/v1/ipaustralia",
    category: "Data",
    Icon: Archive,
    capabilities: [
      "Search trade marks by keyword, class, applicant, or registration number",
      "Get trade mark status: registered, pending, opposed, or lapsed",
      "Search patents by keyword, inventor, applicant, or patent number",
      "Retrieve full patent and trade mark records with filing dates",
    ],
    examplePrompt: "Ask your AI to search for trade marks containing a specific word and check their status",
  },
  {
    name: "TAB",
    description: "Get Australian racing odds, race fields, and results from TAB. No API key required.",
    endpoint: "/v1/tab",
    category: "Data",
    Icon: Ticket,
    capabilities: [
      "Get today's race meetings with venues, times, and field sizes",
      "Retrieve race fields with horse names, jockeys, barriers, and weights",
      "Win, place, and exotic odds for any runner in any race",
      "Race results and dividends for completed races",
    ],
    examplePrompt: "Ask your AI to get the fields and odds for today's Melbourne Cup race",
  },
  {
    name: "The Lott",
    description: "Get Australian lottery results and jackpot amounts for Oz Lotto, Powerball, Set for Life, and Saturday Lotto. No API key required.",
    endpoint: "/v1/thelott",
    category: "Data",
    Icon: Ticket,
    capabilities: [
      "Latest draw results for Oz Lotto, Powerball, and Saturday Lotto",
      "Current jackpot amounts and estimated next draw prize",
      "Historical draw results by game and draw number",
      "Division prize amounts and number of winners per division",
    ],
    examplePrompt: "Ask your AI to check the latest Powerball results and current jackpot amount",
  },
  {
    name: "Toilets",
    description: "Find public toilets near any Australian location using the Australian Government's National Public Toilet Map data. No API key required.",
    endpoint: "/v1/toilets",
    category: "Utility",
    Icon: MapPin,
    capabilities: [
      "Find the nearest public toilets to any suburb, address, or lat/lon",
      "Filter by facilities: accessible, baby change, sharps disposal",
      "Return opening hours and whether facilities are 24-hour",
      "Sort results by distance and return walking directions",
    ],
    examplePrompt: "Ask your AI to find the nearest accessible public toilet to a given address",
  },

  // ── Science & Environment ──────────────────────────────────────────────────
  {
    name: "USGS",
    description: "Access USGS real-time earthquake data, water level gauges, and water quality readings. No API key required.",
    endpoint: "/v1/usgs",
    category: "Data",
    Icon: FlaskConical,
    capabilities: [
      "Recent earthquakes: magnitude, location, depth, and time",
      "Filter earthquakes by magnitude range, region, and time window",
      "Real-time water level readings from USGS stream gauges",
      "Water quality data: temperature, pH, dissolved oxygen by site",
    ],
    examplePrompt: "Ask your AI to list all earthquakes above magnitude 5 in the last 7 days",
  },
  {
    name: "OpenAQ",
    description: "Get global air quality measurements including PM2.5, PM10, NO2, CO, and O3 from monitoring stations worldwide. No API key required.",
    endpoint: "/v1/openaq",
    category: "Data",
    Icon: Leaf,
    capabilities: [
      "Get current air quality readings for any city or coordinates",
      "PM2.5, PM10, NO2, CO, SO2, and O3 measurements with AQI calculation",
      "List nearby monitoring stations and their measurement history",
      "Historical data by location, parameter, and date range",
    ],
    examplePrompt: "Ask your AI to check the current PM2.5 levels in a city and classify the air quality",
  },
  {
    name: "eBird",
    description: "Get bird sightings, species checklists, and birding hotspots from the Cornell Lab eBird database. No API key required.",
    endpoint: "/v1/ebird",
    category: "Data",
    Icon: Bird,
    capabilities: [
      "Recent bird sightings near any location by species or all species",
      "Notable and rare bird sightings with observer details",
      "Top birding hotspots ranked by species diversity near a location",
      "Species checklists: range maps, seasonal occurrence, and taxonomy",
    ],
    examplePrompt: "Ask your AI to find the most recently spotted rare birds within 50km of a location",
  },
  {
    name: "Carbon Interface",
    description: "Calculate carbon emissions for flights, car trips, electricity usage, and shipping via the Carbon Interface API.",
    endpoint: "/v1/carbon",
    category: "Data",
    Icon: Leaf,
    capabilities: [
      "Flight emissions: carbon kg for any origin-destination pair and class",
      "Vehicle emissions: kg CO2 per trip by make, model, and distance",
      "Electricity consumption emissions by region or country grid factor",
      "Shipping emissions by weight, distance, and transport method",
    ],
    examplePrompt: "Ask your AI to calculate the carbon footprint of a return flight from Sydney to London",
  },
  {
    name: "Radio Browser",
    description: "Search and discover 50,000+ free internet radio stations from around the world. Filter by country, language, or genre. No API key required.",
    endpoint: "/v1/radio",
    category: "Media",
    Icon: Radio,
    capabilities: [
      "Search stations by name, country, language, or genre tag",
      "Browse top stations ranked by listener clicks or community votes",
      "Filter stations by genre: jazz, classical, news, talk, hip-hop, and more",
      "List all countries with station counts and browse by region",
    ],
    examplePrompt: "Ask your AI to find the top jazz radio stations in France",
  },
  {
    name: "GDELT",
    description: "Tap into the GDELT Project — real-time global news intelligence updated every 15 minutes. Search news from every country and language, analyse sentiment trends, and map where stories are breaking. No API key required.",
    endpoint: "/v1/gdelt",
    category: "Data",
    Icon: Globe2,
    capabilities: [
      "Search global news by keyword with optional date range, language, and country filters",
      "Tone analysis: track positive/negative sentiment for any topic across global media",
      "Geographic event mapping: see where in the world a story is covered most",
      "Trend detection: classify whether a topic is surging, stable, or fading in the news cycle",
    ],
    examplePrompt: "Ask your AI to analyse the tone of global news coverage about a company over the last week",
  },

  // ── Design ─────────────────────────────────────────────────────────────────
  {
    name: "Figma",
    description: "Read Figma file structure, export nodes as images, manage comments, and browse team projects and published components via the Figma REST API. Built for agents that need to inspect designs, generate assets, annotate screens, and surface design system components without opening the Figma desktop app.",
    endpoint: "/v1/figma",
    category: "Platform",
    Icon: PenSquare,
    capabilities: [
      "Read file structure: pages, frames, and component inventory",
      "Export any node as PNG, JPG, SVG, or PDF at configurable scale",
      "Get and post comments on files, optionally pinned to canvas coordinates",
      "List all projects in a team and published components in a file",
    ],
    examplePrompt: "Ask your AI to export all frames on the 'Mobile' page as PNGs and summarise the layout",
  },

  // ── Developer / Productivity ──────────────────────────────────────────────
  {
    name: "GitHub",
    description: "Search repos, manage issues and pull requests, look up users, browse gists, and search code across GitHub via the GitHub REST API. Requires a personal access token for write operations; public data is accessible without one.",
    endpoint: "/v1/github",
    category: "Platform",
    Icon: Github,
    capabilities: [
      "Search repositories by keyword, language, stars, or topic",
      "List and create issues on any repo you have access to",
      "List open and closed pull requests with status and review details",
      "Look up user profiles, list gists, and search code by pattern",
    ],
    examplePrompt: "Ask your AI to search GitHub for TypeScript repos with over 1,000 stars and list their top open issues",
  },
  {
    name: "GitLab",
    description: "Search projects, list issues and merge requests, and look up users via the GitLab REST API. Supports both GitLab.com and self-hosted instances. Requires a personal access token.",
    endpoint: "/v1/gitlab",
    category: "Platform",
    Icon: GitBranch,
    capabilities: [
      "Search projects by keyword with optional visibility filter",
      "List open and closed issues with label and state filtering",
      "List merge requests by state: opened, merged, or closed",
      "Look up any GitLab user by username or retrieve your own profile",
    ],
    examplePrompt: "Ask your AI to list all open merge requests in a GitLab project and summarise what is being changed",
  },
  {
    name: "ClickUp",
    description: "Manage tasks across your ClickUp workspaces: browse spaces, folders, and lists, retrieve and create tasks, and update task status and priority via the ClickUp API v2.",
    endpoint: "/v1/clickup",
    category: "Platform",
    Icon: CheckSquare,
    capabilities: [
      "List workspaces, spaces, and lists in your ClickUp account",
      "Retrieve tasks from any list with status and assignee filters",
      "Create new tasks with description, priority, due date, and tags",
      "Update task status, priority, assignees, and due dates",
    ],
    examplePrompt: "Ask your AI to list all overdue tasks across a ClickUp space and update their priorities",
  },
  {
    name: "Linear",
    description: "Manage engineering work in Linear: list and search issues, create new issues, browse team details, and retrieve project status via the Linear GraphQL API.",
    endpoint: "/v1/linear",
    category: "Platform",
    Icon: Target,
    capabilities: [
      "List issues with optional team and state filters",
      "Create issues with title, description, priority, assignee, and state",
      "Search issues by keyword across your entire Linear workspace",
      "List teams and retrieve project progress and target dates",
    ],
    examplePrompt: "Ask your AI to find all high-priority open issues assigned to your team in Linear and draft a status update",
  },
  {
    name: "Airtable",
    description: "Read and write Airtable records via the Airtable REST API. List bases, browse and filter table records, create and update records using Airtable formula syntax.",
    endpoint: "/v1/airtable",
    category: "Data",
    Icon: Table,
    capabilities: [
      "List all bases your token has access to",
      "List and paginate records from any table with view and field filters",
      "Search records using Airtable formula filter syntax",
      "Create and update records with arbitrary field values",
    ],
    examplePrompt: "Ask your AI to search an Airtable CRM base for contacts added this month and export their names and emails",
  },
  {
    name: "Trello",
    description: "Manage Trello boards, lists, and cards via the Trello REST API. Get board and list contents, create and update cards, and search cards across your account.",
    endpoint: "/v1/trello",
    category: "Platform",
    Icon: Kanban,
    capabilities: [
      "List all boards you have access to with open or archived filter",
      "Get lists on a board and cards within any list",
      "Create cards with name, description, due date, and label assignment",
      "Update cards: move between lists, archive, set due date, or mark complete",
    ],
    examplePrompt: "Ask your AI to list all overdue Trello cards across your boards and move them to a Review list",
  },
  {
    name: "Sentry",
    description: "Monitor application errors in Sentry: list projects and issues, inspect individual events, and resolve issues programmatically via the Sentry REST API.",
    endpoint: "/v1/sentry",
    category: "Platform",
    Icon: Bug,
    capabilities: [
      "List all projects in a Sentry organization",
      "List issues with keyword search and time window filters",
      "Get issue details: error type, first seen, count, and stack trace summary",
      "List recent events for any issue and mark issues as resolved",
    ],
    examplePrompt: "Ask your AI to list the top 10 unresolved Sentry issues by event count and summarise each error",
  },
  {
    name: "Postman",
    description: "Browse your Postman API collections, environments, and monitors via the Postman API. Retrieve full collection definitions for use in testing and documentation workflows.",
    endpoint: "/v1/postman",
    category: "Platform",
    Icon: Webhook,
    capabilities: [
      "List all API collections in your Postman account or workspace",
      "Retrieve a full collection definition including all requests and folders",
      "List environments with variable names and current values",
      "List monitors with schedule, status, and last run details",
    ],
    examplePrompt: "Ask your AI to retrieve a Postman collection and generate a markdown API reference from it",
  },
];

// Platform connectors: tools that require a one-time external account connection
const PLATFORM_CONNECTOR_SLUGS: Record<string, string> = {
  "Telegram":       "telegram",
  "Slack":          "slack",
  "Discord":        "discord",
  "Reddit":         "reddit",
  "Bluesky":        "bluesky",
  "Mastodon":       "mastodon",
  "LINE":           "line",
  "Figma":          "figma",
  "Shopify":        "shopify",
  "Amazon":         "amazon",
  "Xero":           "xero",
  "Vault":          "vault",
  "C-Suite Analyze":"csuite",
  "Notion":         "notion",
  "Vercel":         "vercel",
  "Resend":         "resend",
  "Email":          "email",
  "Monica":         "monica",
  "Clockify":       "clockify",
  "Toggl":          "toggl",
};

const PLATFORM_CONNECTOR_NAMES = new Set(Object.keys(PLATFORM_CONNECTOR_SLUGS));

const categories: Category[] = [
  "All", "Local", "Platform",
  "Utility", "Text", "Data", "Media", "Network", "Security", "Storage", "Social", "Commerce",
];

// Tools that require no API key — shown with a "No API key" badge
const NO_API_KEY_TOOLS = new Set([
  "Random", "UUID", "Cron", "Timestamp", "QR Code", "Units", "Weather", "Currency", "Notify",
  "Transform", "Regex", "Diff", "Encode", "Readability", "Markdown",
  "Hash", "DNS", "Headers", "Ping", "Whois", "Sitemap", "RSS",
  "Calculator", "Unit Converter", "Datetime", "Text Tool", "Color Convert", "Random Generator", "Meal Planner",
  "BoardGameGeek", "ESPN", "Sleeper", "Have I Been Pwned", "NVD",
  "Open Food Facts", "Deezer",
  "USGS", "OpenAQ", "eBird",
  "Trove", "TAB", "The Lott", "Toilets",
]);

// Intent-first quick-jump categories
const QUICK_LINKS: { label: string; category: Category }[] = [
  { label: "Weather", category: "Utility" },
  { label: "Security", category: "Security" },
  { label: "Gaming", category: "Data" },
  { label: "Social", category: "Social" },
  { label: "Australia", category: "Data" },
];

interface ToolsProps {
  searchQuery?: string;
}

const Tools = ({ searchQuery = "" }: ToolsProps) => {
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [localSearch, setLocalSearch] = useState("");
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [connectorStatus, setConnectorStatus] = useState<Record<string, "connected" | "not-connected">>({});

  useEffect(() => {
    const key = localStorage.getItem("unclick_api_key");
    setHasKey(Boolean(key));

    const onStorage = () => setHasKey(Boolean(localStorage.getItem("unclick_api_key")));
    window.addEventListener("storage", onStorage);

    if (key) {
      const slugs = Object.values(PLATFORM_CONNECTOR_SLUGS);
      Promise.all(
        slugs.map(async (slug) => {
          try {
            const res = await fetch(`/api/credentials?platform=${slug}`, {
              headers: { Authorization: `Bearer ${key}` },
            });
            return [slug, res.ok ? "connected" : "not-connected"] as const;
          } catch {
            return [slug, "not-connected"] as const;
          }
        })
      ).then((results) => {
        setConnectorStatus(Object.fromEntries(results));
      });
    }

    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const matchesSearch = (t: Tool) => {
    const q = (localSearch || searchQuery).trim().toLowerCase();
    return (
      q === "" ||
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    );
  };

  const getVisible = (): Tool[] => {
    if (activeCategory === "All")      return tools.filter(matchesSearch);
    if (activeCategory === "Local")    return tools.filter((t) => !PLATFORM_CONNECTOR_NAMES.has(t.name) && matchesSearch(t));
    if (activeCategory === "Platform") return tools.filter((t) => PLATFORM_CONNECTOR_NAMES.has(t.name) && matchesSearch(t));
    return tools.filter((t) => t.category === activeCategory && matchesSearch(t));
  };

  const visible      = getVisible();
  const visibleLocal = visible.filter((t) => !PLATFORM_CONNECTOR_NAMES.has(t.name));
  const visiblePlatform = visible.filter((t) => PLATFORM_CONNECTOR_NAMES.has(t.name));
  const useSections  = activeCategory === "All" || activeCategory === "Local" || activeCategory === "Platform";

  const handleGetStarted = () => {
    setSelectedTool(null);
    setTimeout(() => {
      document.getElementById("install")?.scrollIntoView({ behavior: "smooth" });
    }, 150);
  };

  return (
    <section id="tools" className="relative mx-auto max-w-7xl px-6 py-8">
      {/* ── Search + intent quick-links ────────────────────────────────────── */}
      <FadeIn>
        <div className="mb-6 space-y-3">
          <div className="relative max-w-md">
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search 110+ tools..."
              className="w-full rounded-xl border border-border/60 bg-card/50 px-4 py-2.5 pl-9 text-sm text-heading placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 backdrop-blur-sm"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <span>Jump to:</span>
            {QUICK_LINKS.map(({ label, category }) => (
              <button
                key={label}
                onClick={() => { setActiveCategory(category); setLocalSearch(label === "Australia" ? "" : ""); }}
                className="rounded-full border border-border/50 px-3 py-0.5 text-xs text-body hover:border-primary/40 hover:text-heading transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <FadeIn>
        <div className="flex flex-wrap gap-2 mb-8">
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

      {useSections ? (
        <>
          {/* ── Section 1: Local Tools ───────────────────────────────────── */}
          {activeCategory !== "Platform" && visibleLocal.length > 0 && (
            <div className="mb-12">
              <FadeIn>
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-1.5">
                    <h2 className="text-xl font-semibold text-heading">Works out of the box</h2>
                    <span className="rounded-full border border-border/50 bg-card/50 px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
                      {visibleLocal.length} tools
                    </span>
                  </div>
                  <p className="text-sm text-body max-w-2xl">
                    These tools run entirely inside the MCP server. No API keys, no accounts, no external setup. Just call and go.
                  </p>
                </div>
              </FadeIn>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {visibleLocal.map((tool, i) => (
                  <FadeIn key={tool.name} delay={Math.min(i * 0.03, 0.3)}>
                    <motion.button
                      onClick={() => setSelectedTool(tool)}
                      className="group relative w-full text-left flex flex-col rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm transition-all overflow-hidden hover:border-primary/40 hover:bg-card hover:shadow-[0_0_20px_2px_rgba(226,185,59,0.07)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      whileHover={{ y: -2 }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${categoryIconBg[tool.category]}`}>
                        <tool.Icon size={18} strokeWidth={1.75} />
                      </div>
                      <span className="text-sm font-semibold text-heading leading-snug">{tool.name}</span>
                      <p className="mt-1.5 text-xs text-body leading-relaxed line-clamp-2 flex-1">{tool.description}</p>
                      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${categoryColors[tool.category]}`}>
                          {tool.category}
                        </span>
                        {NO_API_KEY_TOOLS.has(tool.name) ? (
                          <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-400 border border-sky-500/20">
                            No API key
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                            No setup
                          </span>
                        )}
                      </div>
                    </motion.button>
                  </FadeIn>
                ))}
              </div>
            </div>
          )}

          {/* ── Divider (only in "All" mode with both sections visible) ─── */}
          {activeCategory === "All" && visibleLocal.length > 0 && visiblePlatform.length > 0 && (
            <div className="my-10 flex items-center gap-4">
              <div className="h-px flex-1 bg-border/30" />
              <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/60">
                Platform Connectors
              </span>
              <div className="h-px flex-1 bg-border/30" />
            </div>
          )}

          {/* ── Section 2: Platform Connectors ──────────────────────────── */}
          {activeCategory !== "Local" && visiblePlatform.length > 0 && (
            <div>
              <FadeIn>
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-1.5">
                    <h2 className="text-xl font-semibold text-heading">Connect once. Works forever.</h2>
                    <span className="rounded-full border border-border/50 bg-card/50 px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
                      {visiblePlatform.length} connectors
                    </span>
                  </div>
                  <p className="text-sm text-body max-w-2xl">
                    Connect your accounts one time. Your AI agent handles the rest, with no credentials needed on every call.
                  </p>
                </div>
              </FadeIn>
              <div className="rounded-2xl border border-border/30 bg-card/20 p-4 sm:p-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {visiblePlatform.map((tool, i) => {
                    const slug = PLATFORM_CONNECTOR_SLUGS[tool.name] ?? tool.name.toLowerCase();
                    const isConnected = connectorStatus[slug] === "connected";
                    return (
                      <FadeIn key={tool.name} delay={Math.min(i * 0.03, 0.3)}>
                        <motion.div
                          className="relative flex flex-col rounded-xl border border-border/50 bg-card/60 p-4 backdrop-blur-sm transition-all overflow-hidden hover:border-primary/40 hover:bg-card hover:shadow-[0_0_20px_2px_rgba(226,185,59,0.07)]"
                          whileHover={{ y: -2 }}
                          transition={{ duration: 0.15 }}
                        >
                          {/* Top row: icon + status badge */}
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${categoryIconBg[tool.category]}`}>
                              <tool.Icon size={18} strokeWidth={1.75} />
                            </div>
                            {isConnected ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400 shrink-0">
                                <CheckCircle2 size={9} />
                                Connected
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-muted/30 border border-border/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
                                Setup required
                              </span>
                            )}
                          </div>

                          {/* Name + description (clickable for modal) */}
                          <button
                            onClick={() => setSelectedTool(tool)}
                            className="text-left flex-1 focus:outline-none"
                          >
                            <span className="text-sm font-semibold text-heading leading-snug">{tool.name}</span>
                            <p className="mt-1.5 text-xs text-body leading-relaxed line-clamp-2">{tool.description}</p>
                          </button>

                          {/* Footer: category badge + connect CTA */}
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${categoryColors[tool.category]}`}>
                              {tool.category}
                            </span>
                            <a
                              href={`/connect/${slug}`}
                              className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors"
                            >
                              {isConnected ? "Manage" : "Connect"}
                            </a>
                          </div>
                        </motion.div>
                      </FadeIn>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* ── Flat grid for category-specific filters ─────────────────────── */
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {visible.map((tool, i) => {
            const isPlatform = PLATFORM_CONNECTOR_NAMES.has(tool.name);
            const slug = isPlatform ? (PLATFORM_CONNECTOR_SLUGS[tool.name] ?? tool.name.toLowerCase()) : null;
            const isConnected = slug ? connectorStatus[slug] === "connected" : false;

            return (
              <FadeIn key={tool.name} delay={Math.min(i * 0.03, 0.3)}>
                {isPlatform ? (
                  <motion.div
                    className="relative flex flex-col rounded-xl border border-border/50 bg-card/60 p-4 backdrop-blur-sm transition-all overflow-hidden hover:border-primary/40 hover:bg-card hover:shadow-[0_0_20px_2px_rgba(226,185,59,0.07)]"
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${categoryIconBg[tool.category]}`}>
                        <tool.Icon size={18} strokeWidth={1.75} />
                      </div>
                      {isConnected ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400 shrink-0">
                          <CheckCircle2 size={9} />
                          Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-muted/30 border border-border/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
                          Setup required
                        </span>
                      )}
                    </div>
                    <button onClick={() => setSelectedTool(tool)} className="text-left flex-1 focus:outline-none">
                      <span className="text-sm font-semibold text-heading leading-snug">{tool.name}</span>
                      <p className="mt-1.5 text-xs text-body leading-relaxed line-clamp-2">{tool.description}</p>
                    </button>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${categoryColors[tool.category]}`}>
                        {tool.category}
                      </span>
                      <a
                        href={`/connect/${slug}`}
                        className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors"
                      >
                        {isConnected ? "Manage" : "Connect"}
                      </a>
                    </div>
                  </motion.div>
                ) : (
                  <motion.button
                    onClick={() => setSelectedTool(tool)}
                    className="group relative w-full text-left flex flex-col rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm transition-all overflow-hidden hover:border-primary/40 hover:bg-card hover:shadow-[0_0_20px_2px_rgba(226,185,59,0.07)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${categoryIconBg[tool.category]}`}>
                      <tool.Icon size={18} strokeWidth={1.75} />
                    </div>
                    <span className="text-sm font-semibold text-heading leading-snug">{tool.name}</span>
                    <p className="mt-1.5 text-xs text-body leading-relaxed line-clamp-2 flex-1">{tool.description}</p>
                    <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${categoryColors[tool.category]}`}>
                        {tool.category}
                      </span>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                        No setup
                      </span>
                    </div>
                  </motion.button>
                )}
              </FadeIn>
            );
          })}
        </div>
      )}

      {visible.length === 0 && (
        <div className="mt-16 text-center text-sm text-muted-foreground">
          No tools match "{searchQuery}". Try a different search.
        </div>
      )}

      {/* ── Tool detail modal ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedTool && (() => {
          const isPlatform = PLATFORM_CONNECTOR_NAMES.has(selectedTool.name);
          const slug = isPlatform ? (PLATFORM_CONNECTOR_SLUGS[selectedTool.name] ?? selectedTool.name.toLowerCase()) : null;
          const isConnected = slug ? connectorStatus[slug] === "connected" : false;

          return (
            <>
              <motion.div
                className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedTool(null)}
              />
              <motion.div
                className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/60 bg-card shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2 }}
              >
                <button
                  onClick={() => setSelectedTool(null)}
                  className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-card hover:text-heading transition-colors"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>

                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${categoryIconBg[selectedTool.category]}`}>
                    <selectedTool.Icon size={22} strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-heading">{selectedTool.name}</h3>
                      {isPlatform ? (
                        isConnected ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                            <CheckCircle2 size={10} />
                            Connected
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-muted/30 border border-border/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Setup required
                          </span>
                        )
                      ) : hasKey ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                          <CheckCircle2 size={10} />
                          Connected
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${categoryColors[selectedTool.category]}`}>
                        {selectedTool.category}
                      </span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary border border-primary/20">
                        Free
                      </span>
                      {isPlatform && (
                        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400 border border-blue-500/20">
                          Platform Connector
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-sm text-body leading-relaxed">{selectedTool.description}</p>

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

                <div className="mt-4 rounded-lg border border-border/40 bg-background/60 px-4 py-3">
                  <span className="block font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">Example</span>
                  <p className="text-xs text-body leading-relaxed italic">"{selectedTool.examplePrompt}"</p>
                </div>

                <div className="mt-3 rounded-lg border border-border/40 bg-background/40 px-4 py-2.5 flex items-center gap-3">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest shrink-0">Endpoint</span>
                  <code className="font-mono text-xs text-primary">{selectedTool.endpoint}</code>
                </div>

                <div className="mt-5 flex gap-3">
                  {isPlatform ? (
                    <>
                      <a
                        href={`/connect/${slug}`}
                        className={`flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
                          isConnected
                            ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                            : "bg-primary text-primary-foreground hover:opacity-90"
                        }`}
                      >
                        {isConnected ? "Manage connection" : "Connect account"}
                      </a>
                      <a
                        href="/docs"
                        className="rounded-lg border border-border/60 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-heading hover:border-border transition-colors"
                      >
                        Docs
                      </a>
                    </>
                  ) : hasKey ? (
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
                        Get Started, free
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
          );
        })()}
      </AnimatePresence>
    </section>
  );
};

export default Tools;

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { CATALOG, TOOL_MAP, ENDPOINT_MAP, type ToolDef } from "./catalog.js";
import { createClient, type UnClickClient } from "./client.js";
import {
  countText,
  generateSlug,
  generateLorem,
  decodeJwt,
  lookupHttpStatus,
  searchEmoji,
  parseUserAgent,
  generateReadme,
  generateChangelog,
  getFaviconUrls,
} from "./local-tools.js";
import {
  markdownToHtml,
  htmlToMarkdown,
  jsonToYaml,
  yamlToJson,
  jsonToXml,
  xmlToJson,
  jsonToToml,
  tomlToJson,
  csvToJson,
  jsonToCsv,
  jsonFormat,
  jsonToJsonl,
  jsonlToJson,
} from "./converter-tools.js";
import { csuitAnalyze } from "./csuite-tool.js";
import { vaultAction } from "./vault-tool.js";

// ─── Search helper ──────────────────────────────────────────────────────────

function searchTools(query: string, category?: string): ToolDef[] {
  const q = query.toLowerCase();
  return CATALOG.filter((tool) => {
    const categoryMatch = !category || tool.category === category;
    if (!categoryMatch) return false;
    if (!q) return true;

    const inToolName = tool.name.toLowerCase().includes(q);
    const inToolDesc = tool.description.toLowerCase().includes(q);
    const inSlug = tool.slug.toLowerCase().includes(q);
    const inEndpoints = tool.endpoints.some(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q)
    );
    return inToolName || inToolDesc || inSlug || inEndpoints;
  });
}

function formatToolSummary(tool: ToolDef): string {
  return [
    `**${tool.name}** (slug: \`${tool.slug}\`, category: ${tool.category})`,
    tool.description,
    `Endpoints: ${tool.endpoints.map((e) => `\`${e.id}\``).join(", ")}`,
  ].join("\n");
}

// ─── MCP Tool definitions ───────────────────────────────────────────────────

const META_TOOLS = [
  {
    name: "unclick_search",
    description:
      "Search the UnClick tool marketplace by keyword or description. " +
      "Use this to discover which tools are available for a task. " +
      "Example: 'I need to resize an image' → returns the image tool with its endpoints.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search term - describe what you want to do",
        },
        category: {
          type: "string",
          enum: ["text", "data", "media", "time", "network", "generation", "storage", "platform"],
          description: "Optional: filter by category",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "unclick_browse",
    description:
      "Browse all available UnClick tools, optionally filtered by category. " +
      "Returns a list of tools with their slugs and descriptions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: ["text", "data", "media", "time", "network", "generation", "storage", "platform"],
          description: "Optional: filter to a specific category",
        },
      },
    },
  },
  {
    name: "unclick_tool_info",
    description:
      "Get detailed information about a specific UnClick tool including all its endpoints, " +
      "required parameters, and response shapes. Use this after unclick_search to understand " +
      "exactly how to call a tool.",
    inputSchema: {
      type: "object" as const,
      properties: {
        slug: {
          type: "string",
          description:
            "Tool slug, e.g. 'image', 'hash', 'csv', 'cron'. " +
            "Available slugs: " + CATALOG.map((t) => t.slug).join(", "),
        },
      },
      required: ["slug"],
    },
  },
  {
    name: "unclick_call",
    description:
      "Call any UnClick tool endpoint. Specify the endpoint ID and parameters. " +
      "Use unclick_search or unclick_tool_info to discover endpoint IDs and required params. " +
      "Example: endpoint_id='image.resize', params={image: '<base64>', width: 800, height: 600}",
    inputSchema: {
      type: "object" as const,
      properties: {
        endpoint_id: {
          type: "string",
          description:
            "Endpoint identifier, e.g. 'image.resize', 'hash.compute', 'csv.parse', 'cron.next'",
        },
        params: {
          type: "object",
          description: "Parameters for the endpoint. Use unclick_tool_info to see required params.",
        },
      },
      required: ["endpoint_id", "params"],
    },
  },
] as const;

const DIRECT_TOOLS = [
  {
    name: "unclick_shorten_url",
    description: "Shorten a URL using UnClick. Returns a short URL and its code.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "The URL to shorten" },
      },
      required: ["url"],
    },
  },
  {
    name: "unclick_generate_qr",
    description: "Generate a QR code from text or a URL. Returns base64-encoded PNG or SVG.",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "Text or URL to encode in the QR code" },
        format: { type: "string", enum: ["png", "svg"], default: "png" },
        size: { type: "number", description: "Image size in pixels (100–1000)", default: 300 },
      },
      required: ["text"],
    },
  },
  {
    name: "unclick_hash",
    description: "Compute a cryptographic hash (MD5, SHA1, SHA256, SHA512) of text.",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: { type: "string" },
        algorithm: {
          type: "string",
          enum: ["md5", "sha1", "sha256", "sha512"],
          default: "sha256",
        },
      },
      required: ["text", "algorithm"],
    },
  },
  {
    name: "unclick_transform_text",
    description:
      "Transform text case: upper, lower, title, sentence, camelCase, snake_case, kebab-case, PascalCase.",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: { type: "string" },
        to: {
          type: "string",
          enum: ["upper", "lower", "title", "sentence", "camel", "snake", "kebab", "pascal"],
        },
      },
      required: ["text", "to"],
    },
  },
  {
    name: "unclick_validate_email",
    description: "Validate an email address format.",
    inputSchema: {
      type: "object" as const,
      properties: {
        email: { type: "string" },
      },
      required: ["email"],
    },
  },
  {
    name: "unclick_validate_url",
    description: "Validate a URL format, optionally check if it's reachable.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string" },
        check_reachable: { type: "boolean", default: false },
      },
      required: ["url"],
    },
  },
  {
    name: "unclick_resize_image",
    description: "Resize an image (provided as base64) to specified dimensions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        image: { type: "string", description: "Base64-encoded image (with or without data: prefix)" },
        width: { type: "number" },
        height: { type: "number" },
        fit: {
          type: "string",
          enum: ["cover", "contain", "fill", "inside", "outside"],
          default: "cover",
        },
      },
      required: ["image", "width", "height"],
    },
  },
  {
    name: "unclick_parse_csv",
    description: "Parse a CSV string into a JSON array of rows.",
    inputSchema: {
      type: "object" as const,
      properties: {
        csv: { type: "string" },
        header: { type: "boolean", default: true },
        delimiter: { type: "string", default: "," },
      },
      required: ["csv"],
    },
  },
  {
    name: "unclick_encode",
    description: "Encode or decode text. Supports base64, URL, HTML, and hex.",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: { type: "string" },
        operation: {
          type: "string",
          enum: [
            "encode_base64", "decode_base64",
            "encode_url", "decode_url",
            "encode_html", "decode_html",
            "encode_hex", "decode_hex",
          ],
        },
      },
      required: ["text", "operation"],
    },
  },
  {
    name: "unclick_generate_uuid",
    description: "Generate one or more random UUIDs (v4).",
    inputSchema: {
      type: "object" as const,
      properties: {
        count: { type: "number", minimum: 1, maximum: 100, default: 1 },
      },
    },
  },
  {
    name: "unclick_random_password",
    description: "Generate a secure random password.",
    inputSchema: {
      type: "object" as const,
      properties: {
        length: { type: "number", minimum: 4, maximum: 512, default: 16 },
        uppercase: { type: "boolean", default: true },
        lowercase: { type: "boolean", default: true },
        numbers: { type: "boolean", default: true },
        symbols: { type: "boolean", default: true },
      },
    },
  },
  {
    name: "unclick_cron_parse",
    description: "Convert a cron expression to a human-readable description and get next occurrences.",
    inputSchema: {
      type: "object" as const,
      properties: {
        expression: { type: "string", description: "e.g. '0 9 * * 1-5' (weekdays at 9am)" },
        next_count: { type: "number", minimum: 1, maximum: 10, default: 5 },
      },
      required: ["expression"],
    },
  },
  {
    name: "unclick_ip_parse",
    description: "Parse an IP address - get decimal, binary, hex, and type (private/loopback/multicast).",
    inputSchema: {
      type: "object" as const,
      properties: {
        ip: { type: "string" },
      },
      required: ["ip"],
    },
  },
  {
    name: "unclick_color_convert",
    description: "Convert a color between hex, RGB, HSL, and HSV formats.",
    inputSchema: {
      type: "object" as const,
      properties: {
        color: {
          description: "Color as hex string (e.g. '#ff6b6b'), RGB object {r,g,b}, or HSL object {h,s,l}",
        },
      },
      required: ["color"],
    },
  },
  {
    name: "unclick_regex_test",
    description: "Test a regex pattern against text and get all matches with groups.",
    inputSchema: {
      type: "object" as const,
      properties: {
        pattern: { type: "string", description: "Regex pattern (no surrounding slashes)" },
        flags: { type: "string", description: "Flags like 'gi'", default: "" },
        input: { type: "string" },
      },
      required: ["pattern", "input"],
    },
  },
  {
    name: "unclick_timestamp_convert",
    description: "Convert a timestamp (ISO, Unix seconds, or Unix ms) to all common formats.",
    inputSchema: {
      type: "object" as const,
      properties: {
        timestamp: {
          description: "ISO string, Unix seconds (e.g. 1700000000), or Unix ms (e.g. 1700000000000)",
        },
      },
      required: ["timestamp"],
    },
  },
  {
    name: "unclick_diff_text",
    description: "Compare two strings and return a unified diff showing what changed.",
    inputSchema: {
      type: "object" as const,
      properties: {
        a: { type: "string", description: "Original text" },
        b: { type: "string", description: "New text" },
      },
      required: ["a", "b"],
    },
  },
  {
    name: "unclick_kv_set",
    description: "Store a value in the UnClick key-value store with optional TTL.",
    inputSchema: {
      type: "object" as const,
      properties: {
        key: { type: "string" },
        value: { description: "Any JSON-serializable value" },
        ttl: { type: "number", description: "Seconds until expiry (optional)" },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "unclick_kv_get",
    description: "Retrieve a value from the UnClick key-value store.",
    inputSchema: {
      type: "object" as const,
      properties: {
        key: { type: "string" },
      },
      required: ["key"],
    },
  },
  // ── Local tools (no API call required) ────────────────────────────────────
  {
    name: "unclick_count_text",
    description:
      "Count words, characters, sentences, lines, and paragraphs in any text.",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "Text to analyse" },
      },
      required: ["text"],
    },
  },
  {
    name: "unclick_slug",
    description:
      "Convert any string into a URL-friendly slug: lowercase, ASCII, words joined by a separator.",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "Text to slugify" },
        separator: { type: "string", default: "-", description: "Word separator (default: '-')" },
      },
      required: ["text"],
    },
  },
  {
    name: "unclick_lorem_ipsum",
    description:
      "Generate Lorem Ipsum placeholder text by words, sentences, or paragraphs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        count: { type: "number", minimum: 1, maximum: 100, default: 5 },
        unit: {
          type: "string",
          enum: ["words", "sentences", "paragraphs"],
          default: "sentences",
        },
        start_with_lorem: {
          type: "boolean",
          default: true,
          description: "Start output with 'Lorem ipsum...'",
        },
      },
    },
  },
  {
    name: "unclick_decode_jwt",
    description:
      "Decode a JWT token and inspect its header, payload, and expiry. " +
      "Does NOT verify the signature — for inspection only.",
    inputSchema: {
      type: "object" as const,
      properties: {
        token: { type: "string", description: "JWT string (three dot-separated parts)" },
      },
      required: ["token"],
    },
  },
  {
    name: "unclick_http_status",
    description:
      "Look up any HTTP status code: get its official phrase, category, and a plain-English description.",
    inputSchema: {
      type: "object" as const,
      properties: {
        code: { type: "number", description: "HTTP status code, e.g. 404, 200, 429" },
      },
      required: ["code"],
    },
  },
  {
    name: "unclick_emoji_search",
    description:
      "Find emoji by keyword. Returns matching emoji with names and keywords.",
    inputSchema: {
      type: "object" as const,
      properties: {
        keyword: { type: "string", description: "Search term, e.g. 'fire', 'happy', 'rocket'" },
        limit: { type: "number", minimum: 1, maximum: 30, default: 10 },
      },
      required: ["keyword"],
    },
  },
  {
    name: "unclick_parse_user_agent",
    description:
      "Parse a browser User-Agent string into browser, OS, device type, and rendering engine.",
    inputSchema: {
      type: "object" as const,
      properties: {
        user_agent: {
          type: "string",
          description: "Full User-Agent header value",
        },
      },
      required: ["user_agent"],
    },
  },
  {
    name: "unclick_readme_template",
    description:
      "Scaffold a README.md from project info: name, description, install command, usage snippet, license.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Project name" },
        description: { type: "string", description: "One-line project description" },
        install: { type: "string", description: "Install command (optional — auto-detected from language)" },
        usage: { type: "string", description: "Usage code snippet (optional)" },
        language: {
          type: "string",
          enum: ["javascript", "typescript", "python", "rust", "go", "other"],
          description: "Primary language — used to pick install command if not provided",
        },
        license: { type: "string", default: "MIT" },
        repo: { type: "string", description: "GitHub repo URL (optional, e.g. https://github.com/owner/repo)" },
        badges: { type: "boolean", default: true },
      },
      required: ["name", "description"],
    },
  },
  {
    name: "unclick_changelog_entry",
    description:
      "Format a Keep a Changelog-style entry for a release. " +
      "Provide the version and lists of added/changed/fixed/removed items.",
    inputSchema: {
      type: "object" as const,
      properties: {
        version: { type: "string", description: "Semantic version, e.g. '1.2.0'" },
        date: { type: "string", description: "ISO date (default: today)" },
        added: { type: "array", items: { type: "string" }, description: "New features" },
        changed: { type: "array", items: { type: "string" }, description: "Changes to existing functionality" },
        deprecated: { type: "array", items: { type: "string" } },
        removed: { type: "array", items: { type: "string" } },
        fixed: { type: "array", items: { type: "string" }, description: "Bug fixes" },
        security: { type: "array", items: { type: "string" }, description: "Security fixes" },
      },
      required: ["version"],
    },
  },
  {
    name: "unclick_favicon_url",
    description:
      "Get the favicon URLs for any website domain — returns the direct /favicon.ico URL plus " +
      "reliable fallback URLs via Google and DuckDuckGo favicon APIs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        domain: {
          type: "string",
          description: "Domain or URL, e.g. 'github.com' or 'https://github.com/owner/repo'",
        },
      },
      required: ["domain"],
    },
  },
  // ── Converter tools (pure-local, no API call) ─────────────────────────────
  {
    name: "unclick_markdown_to_html",
    description: "Convert Markdown text to HTML.",
    inputSchema: {
      type: "object" as const,
      properties: {
        markdown: { type: "string", description: "Markdown text to convert" },
      },
      required: ["markdown"],
    },
  },
  {
    name: "unclick_html_to_markdown",
    description: "Convert HTML to Markdown.",
    inputSchema: {
      type: "object" as const,
      properties: {
        html: { type: "string", description: "HTML string to convert" },
      },
      required: ["html"],
    },
  },
  {
    name: "unclick_json_to_yaml",
    description: "Convert a JSON string to YAML.",
    inputSchema: {
      type: "object" as const,
      properties: {
        json: { type: "string", description: "Valid JSON string" },
        indent: { type: "number", default: 2, description: "YAML indent width (default 2)" },
      },
      required: ["json"],
    },
  },
  {
    name: "unclick_yaml_to_json",
    description: "Convert a YAML string to JSON.",
    inputSchema: {
      type: "object" as const,
      properties: {
        yaml: { type: "string", description: "Valid YAML string" },
        indent: { type: "number", default: 2, description: "JSON indent width (default 2)" },
      },
      required: ["yaml"],
    },
  },
  {
    name: "unclick_json_to_xml",
    description: "Convert a JSON string to XML.",
    inputSchema: {
      type: "object" as const,
      properties: {
        json: { type: "string", description: "Valid JSON string" },
        root_key: { type: "string", default: "root", description: "Root element name when input is an array (default: 'root')" },
      },
      required: ["json"],
    },
  },
  {
    name: "unclick_xml_to_json",
    description: "Convert an XML string to JSON.",
    inputSchema: {
      type: "object" as const,
      properties: {
        xml: { type: "string", description: "Valid XML string" },
        indent: { type: "number", default: 2, description: "JSON indent width (default 2)" },
      },
      required: ["xml"],
    },
  },
  {
    name: "unclick_json_to_toml",
    description: "Convert a JSON object to TOML. Input must be a top-level object (not an array).",
    inputSchema: {
      type: "object" as const,
      properties: {
        json: { type: "string", description: "Valid JSON object string" },
      },
      required: ["json"],
    },
  },
  {
    name: "unclick_toml_to_json",
    description: "Convert a TOML string to JSON.",
    inputSchema: {
      type: "object" as const,
      properties: {
        toml: { type: "string", description: "Valid TOML string" },
        indent: { type: "number", default: 2, description: "JSON indent width (default 2)" },
      },
      required: ["toml"],
    },
  },
  {
    name: "unclick_csv_to_json",
    description: "Convert CSV text to a JSON array.",
    inputSchema: {
      type: "object" as const,
      properties: {
        csv: { type: "string", description: "CSV text to convert" },
        header: { type: "boolean", default: true, description: "First row is a header (default: true)" },
        delimiter: { type: "string", default: ",", description: "Column delimiter (default: ',')" },
      },
      required: ["csv"],
    },
  },
  {
    name: "unclick_json_to_csv",
    description: "Convert a JSON array to CSV text.",
    inputSchema: {
      type: "object" as const,
      properties: {
        json: { type: "string", description: "JSON array of objects to convert" },
        delimiter: { type: "string", default: ",", description: "Column delimiter (default: ',')" },
      },
      required: ["json"],
    },
  },
  {
    name: "unclick_json_format",
    description: "Pretty-print or minify a JSON string. Use indent=0 or 'minify' to minify.",
    inputSchema: {
      type: "object" as const,
      properties: {
        json: { type: "string", description: "Valid JSON string" },
        indent: {
          description: "Indent width: 2, 4, 'tab', or 'minify' (default: 2)",
          default: 2,
        },
      },
      required: ["json"],
    },
  },
  {
    name: "unclick_json_to_jsonl",
    description: "Convert a JSON array to newline-delimited JSON (JSONL), one item per line.",
    inputSchema: {
      type: "object" as const,
      properties: {
        json: { type: "string", description: "JSON array to convert" },
      },
      required: ["json"],
    },
  },
  {
    name: "unclick_jsonl_to_json",
    description: "Convert newline-delimited JSON (JSONL) to a JSON array.",
    inputSchema: {
      type: "object" as const,
      properties: {
        jsonl: { type: "string", description: "JSONL text (one JSON value per line)" },
        indent: { type: "number", default: 2, description: "JSON indent width (default 2)" },
      },
      required: ["jsonl"],
    },
  },
  // ── Number base converters ───────────────────────────────────────────────
  {
    name: "binary_to_decimal",
    description: "Convert a binary string (base 2) to a decimal number.",
    inputSchema: {
      type: "object" as const,
      properties: {
        binary: { type: "string", description: "Binary string, e.g. '1010'" },
      },
      required: ["binary"],
    },
  },
  {
    name: "decimal_to_binary",
    description: "Convert a decimal number to a binary string (base 2).",
    inputSchema: {
      type: "object" as const,
      properties: {
        decimal: { type: "number", description: "Decimal integer, e.g. 10" },
      },
      required: ["decimal"],
    },
  },
  {
    name: "hex_to_decimal",
    description: "Convert a hexadecimal string to a decimal number.",
    inputSchema: {
      type: "object" as const,
      properties: {
        hex: { type: "string", description: "Hex string (with or without 0x prefix), e.g. 'FF' or '0xff'" },
      },
      required: ["hex"],
    },
  },
  {
    name: "decimal_to_hex",
    description: "Convert a decimal number to a hexadecimal string.",
    inputSchema: {
      type: "object" as const,
      properties: {
        decimal: { type: "number", description: "Decimal integer, e.g. 255" },
      },
      required: ["decimal"],
    },
  },
  {
    name: "octal_to_decimal",
    description: "Convert an octal string (base 8) to a decimal number.",
    inputSchema: {
      type: "object" as const,
      properties: {
        octal: { type: "string", description: "Octal string, e.g. '17'" },
      },
      required: ["octal"],
    },
  },
  {
    name: "decimal_to_octal",
    description: "Convert a decimal number to an octal string (base 8).",
    inputSchema: {
      type: "object" as const,
      properties: {
        decimal: { type: "number", description: "Decimal integer, e.g. 15" },
      },
      required: ["decimal"],
    },
  },
  // ── Temperature converters ───────────────────────────────────────────────
  {
    name: "celsius_to_fahrenheit",
    description: "Convert a temperature from Celsius to Fahrenheit.",
    inputSchema: {
      type: "object" as const,
      properties: {
        celsius: { type: "number", description: "Temperature in Celsius, e.g. 100" },
      },
      required: ["celsius"],
    },
  },
  {
    name: "fahrenheit_to_celsius",
    description: "Convert a temperature from Fahrenheit to Celsius.",
    inputSchema: {
      type: "object" as const,
      properties: {
        fahrenheit: { type: "number", description: "Temperature in Fahrenheit, e.g. 212" },
      },
      required: ["fahrenheit"],
    },
  },
  // ── Byte size converters ─────────────────────────────────────────────────
  {
    name: "bytes_to_human",
    description: "Convert a byte count to a human-readable size string (e.g. 1048576 → '1 MB').",
    inputSchema: {
      type: "object" as const,
      properties: {
        bytes: { type: "number", description: "Number of bytes, e.g. 1048576" },
      },
      required: ["bytes"],
    },
  },
  {
    name: "human_to_bytes",
    description: "Convert a human-readable size string to bytes (e.g. '1.5 GB' → 1610612736).",
    inputSchema: {
      type: "object" as const,
      properties: {
        size: { type: "string", description: "Size string, e.g. '1.5 GB', '512 MB', '2 TB'" },
      },
      required: ["size"],
    },
  },
  {
    name: "report_bug",
    description:
      "Report a bug or unexpected behavior encountered while using an UnClick tool. " +
      "Call this whenever a tool returns an error, behaves unexpectedly, or fails silently. " +
      "Severity is auto-classified from the error message: 500/fatal → critical, " +
      "timeout/503 → high, 4xx/invalid → low, everything else → medium.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tool_name: {
          type: "string",
          description: "Name or slug of the UnClick tool that failed (e.g. 'image', 'hash', 'uuid')",
        },
        error_message: {
          type: "string",
          description: "The error message or unexpected output received",
        },
        request_payload: {
          type: "object",
          description: "The request parameters sent to the tool (optional)",
        },
        expected_behavior: {
          type: "string",
          description: "What the tool should have done instead (optional)",
        },
        agent_context: {
          type: "string",
          description: "Brief description of what the agent was trying to accomplish (optional)",
        },
      },
      required: ["tool_name", "error_message"],
    },
  },
  // ── C-Suite analysis (pure local, no API call) ────────────────────────────
  {
    name: "csuite_analyze",
    description:
      "Run a business decision, scenario, or question through multiple C-suite executive perspectives simultaneously. " +
      "Each 'hat' analyzes the scenario through its unique lens: strategy, operations, finance, technology, people, data, security, product, customer, and AI. " +
      "Returns structured analysis per perspective plus a consensus synthesis. " +
      "Use this to make richer, more well-rounded business decisions by surfacing angles that would otherwise be missed.",
    inputSchema: {
      type: "object" as const,
      properties: {
        scenario: {
          type: "string",
          description: "The business decision, scenario, or question to analyze. Be specific for better analysis.",
        },
        context: {
          type: "string",
          description: "Optional additional context: industry, company stage, size, constraints, current situation.",
        },
        perspectives: {
          type: "array",
          items: {
            type: "string",
            enum: ["CEO","COO","CTO","CFO","CMO","CIO","CHRO","CDO","CPO","CSO","CCO","CAIO"],
          },
          description:
            "Which C-suite roles to include. Defaults to all 12. " +
            "CEO=strategy/vision, COO=operations/scalability, CTO=tech/architecture, CFO=finance/ROI, " +
            "CMO=marketing/brand, CIO=information systems/integration, CHRO=people/culture, " +
            "CDO=data/governance, CPO=product/UX, CSO=security/compliance, CCO=customer/retention, " +
            "CAIO=AI/automation/ethics.",
        },
        depth: {
          type: "string",
          enum: ["quick", "standard", "deep"],
          default: "standard",
          description: "Analysis depth. quick=2-3 points per area, standard=4-5, deep=6-7 with sub-considerations.",
        },
        focus: {
          type: "string",
          description: "Optional aspect to emphasize across all perspectives, e.g. 'risk', 'growth', 'cost', 'speed'.",
        },
      },
      required: ["scenario"],
    },
  },
  // ── Encrypted credential vault (pure local, no API call) ─────────────────
  {
    name: "vault",
    description:
      "Secure encrypted credential vault. Store, retrieve, rotate, and audit API keys, " +
      "tokens, passwords, and secrets. All data is AES-256-GCM encrypted at rest using a " +
      "master password you control. Secrets are masked by default (****last4) unless reveal=true. " +
      "Vault lives at ~/.unclick/vault.enc. " +
      "Actions: vault_init, vault_store, vault_retrieve, vault_list, vault_delete, vault_rotate, vault_audit.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: [
            "vault_init",
            "vault_store",
            "vault_retrieve",
            "vault_list",
            "vault_delete",
            "vault_rotate",
            "vault_audit",
          ],
          description:
            "vault_init: create new vault. " +
            "vault_store: save a secret. " +
            "vault_retrieve: get a secret (masked unless reveal=true). " +
            "vault_list: list key names and metadata (never values). " +
            "vault_delete: remove a secret. " +
            "vault_rotate: replace a secret value with a new IV. " +
            "vault_audit: view access event log.",
        },
        master_password: {
          type: "string",
          description: "Master password used to encrypt/decrypt the vault.",
        },
        key: {
          type: "string",
          description: "Secret name/label (required for store, retrieve, delete, rotate).",
        },
        value: {
          type: "string",
          description: "Secret value to store (required for vault_store).",
        },
        new_value: {
          type: "string",
          description: "Replacement secret value (required for vault_rotate).",
        },
        reveal: {
          type: "boolean",
          default: false,
          description: "If true, returns the full decrypted value. Default false returns ****last4.",
        },
        metadata: {
          type: "object",
          description:
            "Optional tags/notes for vault_store: " +
            "{ service, tags, expires, notes } - any JSON object.",
        },
        limit: {
          type: "number",
          minimum: 1,
          maximum: 100,
          default: 20,
          description: "Max audit events to return (vault_audit only, default 20).",
        },
      },
      required: ["action", "master_password"],
    },
  },
] as const;

// ─── Handler map for direct tools ───────────────────────────────────────────

type DirectHandler = (
  client: UnClickClient,
  args: Record<string, unknown>
) => Promise<unknown>;

const DIRECT_HANDLERS: Record<string, DirectHandler> = {
  unclick_shorten_url: (c, a) => c.call("POST", "/v1/shorten", a as Record<string, unknown>),

  unclick_generate_qr: (c, a) => c.call("POST", "/v1/qr", a as Record<string, unknown>),

  unclick_hash: (c, a) => c.call("POST", "/v1/hash", a as Record<string, unknown>),

  unclick_transform_text: (c, a) =>
    c.call("POST", "/v1/transform/case", a as Record<string, unknown>),

  unclick_validate_email: (c, a) =>
    c.call("POST", "/v1/validate/email", a as Record<string, unknown>),

  unclick_validate_url: (c, a) =>
    c.call("POST", "/v1/validate/url", a as Record<string, unknown>),

  unclick_resize_image: (c, a) =>
    c.call("POST", "/v1/image/resize", a as Record<string, unknown>),

  unclick_parse_csv: (c, a) =>
    c.call("POST", "/v1/csv/parse", a as Record<string, unknown>),

  unclick_encode: async (c, a) => {
    const op = a.operation as string;
    const [action, format] = op.split("_") as [string, string];
    const path = `/${action}/${format}`.replace("_", "/");
    return c.call("POST", `/v1${path}`, { text: a.text });
  },

  unclick_generate_uuid: (c, a) =>
    c.call("POST", "/v1/uuid/v4", a as Record<string, unknown>),

  unclick_random_password: (c, a) =>
    c.call("POST", "/v1/random/password", a as Record<string, unknown>),

  unclick_cron_parse: async (c, a) => {
    const [parsed, next] = await Promise.all([
      c.call("POST", "/v1/cron/parse", { expression: a.expression }),
      c.call("POST", "/v1/cron/next", {
        expression: a.expression,
        count: a.next_count ?? 5,
      }),
    ]);
    return { ...parsed as object, ...(next as object) };
  },

  unclick_ip_parse: (c, a) =>
    c.call("POST", "/v1/ip/parse", a as Record<string, unknown>),

  unclick_color_convert: (c, a) =>
    c.call("POST", "/v1/color/convert", a as Record<string, unknown>),

  unclick_regex_test: (c, a) =>
    c.call("POST", "/v1/regex/test", a as Record<string, unknown>),

  unclick_timestamp_convert: (c, a) =>
    c.call("POST", "/v1/timestamp/convert", a as Record<string, unknown>),

  unclick_diff_text: (c, a) =>
    c.call("POST", "/v1/diff/lines", a as Record<string, unknown>),

  unclick_kv_set: (c, a) =>
    c.call("POST", "/v1/kv/set", a as Record<string, unknown>),

  unclick_kv_get: (c, a) =>
    c.call("POST", "/v1/kv/get", a as Record<string, unknown>),

  report_bug: (c, a) =>
    c.call("POST", "/v1/report-bug", a as Record<string, unknown>),

  csuite_analyze: async (_c, a) => {
    const scenario = String(a.scenario ?? "");
    if (!scenario.trim()) return { error: "scenario is required and cannot be empty." };
    return csuitAnalyze(scenario, {
      context: a.context ? String(a.context) : undefined,
      perspectives: Array.isArray(a.perspectives) ? a.perspectives.map(String) : undefined,
      depth: (a.depth as "quick" | "standard" | "deep") ?? "standard",
      focus: a.focus ? String(a.focus) : undefined,
    });
  },

  // ── Local handlers (pure computation, no API call) ────────────────────────

  unclick_count_text: async (_c, a) =>
    countText(String(a.text ?? "")),

  unclick_slug: async (_c, a) =>
    ({ slug: generateSlug(String(a.text ?? ""), String(a.separator ?? "-")) }),

  unclick_lorem_ipsum: async (_c, a) => {
    const count = Math.min(100, Math.max(1, Number(a.count ?? 5)));
    const unit = (a.unit as "words" | "sentences" | "paragraphs") ?? "sentences";
    const startWithLorem = a.start_with_lorem !== false;
    return { text: generateLorem(count, unit, startWithLorem), unit, count };
  },

  unclick_decode_jwt: async (_c, a) =>
    decodeJwt(String(a.token ?? "")),

  unclick_http_status: async (_c, a) =>
    lookupHttpStatus(Number(a.code)),

  unclick_emoji_search: async (_c, a) => {
    const limit = Math.min(30, Math.max(1, Number(a.limit ?? 10)));
    const results = searchEmoji(String(a.keyword ?? ""), limit);
    return {
      keyword: a.keyword,
      count: results.length,
      results: results.map((e) => ({ emoji: e.emoji, name: e.name, keywords: e.keywords })),
    };
  },

  unclick_parse_user_agent: async (_c, a) =>
    parseUserAgent(String(a.user_agent ?? "")),

  unclick_readme_template: async (_c, a) => {
    const md = generateReadme({
      name: String(a.name ?? ""),
      description: String(a.description ?? ""),
      install: a.install ? String(a.install) : undefined,
      usage: a.usage ? String(a.usage) : undefined,
      language: a.language ? String(a.language) : undefined,
      license: a.license ? String(a.license) : "MIT",
      repo: a.repo ? String(a.repo) : undefined,
      badges: a.badges !== false,
    });
    return { markdown: md };
  },

  unclick_changelog_entry: async (_c, a) => {
    const toStrArray = (v: unknown): string[] =>
      Array.isArray(v) ? v.map(String) : [];
    const md = generateChangelog({
      version: String(a.version ?? "0.0.0"),
      date: a.date ? String(a.date) : undefined,
      added: toStrArray(a.added),
      changed: toStrArray(a.changed),
      deprecated: toStrArray(a.deprecated),
      removed: toStrArray(a.removed),
      fixed: toStrArray(a.fixed),
      security: toStrArray(a.security),
    });
    return { markdown: md };
  },

  unclick_favicon_url: async (_c, a) =>
    getFaviconUrls(String(a.domain ?? "")),

  // ── Converter handlers ────────────────────────────────────────────────────

  unclick_markdown_to_html: async (_c, a) =>
    markdownToHtml(String(a.markdown ?? "")),

  unclick_html_to_markdown: async (_c, a) =>
    htmlToMarkdown(String(a.html ?? "")),

  unclick_json_to_yaml: async (_c, a) =>
    jsonToYaml(String(a.json ?? ""), Number(a.indent ?? 2)),

  unclick_yaml_to_json: async (_c, a) =>
    yamlToJson(String(a.yaml ?? ""), Number(a.indent ?? 2)),

  unclick_json_to_xml: async (_c, a) =>
    jsonToXml(String(a.json ?? ""), a.root_key ? String(a.root_key) : "root"),

  unclick_xml_to_json: async (_c, a) =>
    xmlToJson(String(a.xml ?? ""), Number(a.indent ?? 2)),

  unclick_json_to_toml: async (_c, a) =>
    jsonToToml(String(a.json ?? "")),

  unclick_toml_to_json: async (_c, a) =>
    tomlToJson(String(a.toml ?? ""), Number(a.indent ?? 2)),

  unclick_csv_to_json: async (_c, a) =>
    csvToJson(String(a.csv ?? ""), {
      header: a.header !== false,
      delimiter: a.delimiter ? String(a.delimiter) : ",",
    }),

  unclick_json_to_csv: async (_c, a) =>
    jsonToCsv(String(a.json ?? ""), {
      delimiter: a.delimiter ? String(a.delimiter) : ",",
    }),

  unclick_json_format: async (_c, a) => {
    const indent = a.indent === "tab" || a.indent === "minify"
      ? a.indent as "tab" | "minify"
      : Number(a.indent ?? 2);
    return jsonFormat(String(a.json ?? ""), indent);
  },

  unclick_json_to_jsonl: async (_c, a) =>
    jsonToJsonl(String(a.json ?? "")),

  unclick_jsonl_to_json: async (_c, a) =>
    jsonlToJson(String(a.jsonl ?? ""), Number(a.indent ?? 2)),

  // ── Encoding & utility converter handlers ─────────────────────────────────

  binary_to_decimal: async (_c, a) => {
    const bin = String(a.binary ?? "").trim().replace(/^0b/i, "");
    if (!/^[01]+$/.test(bin)) return { error: "Invalid binary string. Use only 0 and 1." };
    const decimal = parseInt(bin, 2);
    return { binary: bin, decimal, decimal_string: String(decimal) };
  },

  decimal_to_binary: async (_c, a) => {
    const n = Math.trunc(Number(a.decimal));
    if (!Number.isFinite(n)) return { error: "Invalid decimal number." };
    const binary = Math.abs(n).toString(2);
    return { decimal: n, binary: n < 0 ? `-${binary}` : binary };
  },

  hex_to_decimal: async (_c, a) => {
    const hex = String(a.hex ?? "").trim().replace(/^0x/i, "");
    if (!/^[0-9a-fA-F]+$/.test(hex)) return { error: "Invalid hex string." };
    const decimal = parseInt(hex, 16);
    return { hex: hex.toUpperCase(), decimal, decimal_string: String(decimal) };
  },

  decimal_to_hex: async (_c, a) => {
    const n = Math.trunc(Number(a.decimal));
    if (!Number.isFinite(n)) return { error: "Invalid decimal number." };
    const hex = Math.abs(n).toString(16).toUpperCase();
    return { decimal: n, hex: n < 0 ? `-${hex}` : hex, hex_prefixed: n < 0 ? `-0x${hex}` : `0x${hex}` };
  },

  octal_to_decimal: async (_c, a) => {
    const oct = String(a.octal ?? "").trim().replace(/^0o/i, "");
    if (!/^[0-7]+$/.test(oct)) return { error: "Invalid octal string. Use only digits 0–7." };
    const decimal = parseInt(oct, 8);
    return { octal: oct, decimal, decimal_string: String(decimal) };
  },

  decimal_to_octal: async (_c, a) => {
    const n = Math.trunc(Number(a.decimal));
    if (!Number.isFinite(n)) return { error: "Invalid decimal number." };
    const octal = Math.abs(n).toString(8);
    return { decimal: n, octal: n < 0 ? `-${octal}` : octal };
  },

  celsius_to_fahrenheit: async (_c, a) => {
    const c = Number(a.celsius);
    if (!Number.isFinite(c)) return { error: "Invalid Celsius value." };
    const f = (c * 9) / 5 + 32;
    return { celsius: c, fahrenheit: Math.round(f * 100) / 100 };
  },

  fahrenheit_to_celsius: async (_c, a) => {
    const f = Number(a.fahrenheit);
    if (!Number.isFinite(f)) return { error: "Invalid Fahrenheit value." };
    const c = ((f - 32) * 5) / 9;
    return { fahrenheit: f, celsius: Math.round(c * 100) / 100 };
  },

  bytes_to_human: async (_c, a) => {
    const bytes = Number(a.bytes);
    if (!Number.isFinite(bytes) || bytes < 0) return { error: "Invalid byte count." };
    const units = ["B", "KB", "MB", "GB", "TB", "PB"];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    const rounded = Math.round(value * 100) / 100;
    return { bytes, human: `${rounded} ${units[unitIndex]}`, value: rounded, unit: units[unitIndex] };
  },

  vault: async (_c, a) => {
    const action = String(a.action ?? "").trim();
    if (!action) return { error: "action is required." };
    return vaultAction(action, a);
  },

  human_to_bytes: async (_c, a) => {
    const raw = String(a.size ?? "").trim();
    const match = raw.match(/^([0-9]*\.?[0-9]+)\s*(B|KB|MB|GB|TB|PB)?$/i);
    if (!match) return { error: `Cannot parse size string: "${raw}". Expected format like '1.5 GB' or '512 MB'.` };
    const value = parseFloat(match[1]);
    const unitMap: Record<string, number> = {
      b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4, pb: 1024 ** 5,
    };
    const unit = (match[2] ?? "b").toLowerCase();
    const bytes = Math.round(value * (unitMap[unit] ?? 1));
    return { size: raw, bytes, unit: (match[2] ?? "B").toUpperCase() };
  },
};

// ─── Server factory ─────────────────────────────────────────────────────────

export function createServer(): Server {
  const server = new Server(
    {
      name: "@unclick/mcp-server",
      version: "0.1.0",
    },
    {
      capabilities: { tools: {} },
    }
  );

  // LIST TOOLS
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = [
      ...META_TOOLS,
      ...DIRECT_TOOLS,
    ];
    return { tools };
  });

  // CALL TOOL
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;
    const args = (rawArgs ?? {}) as Record<string, unknown>;

    try {
      // ── Meta tools ──────────────────────────────────────────────
      if (name === "unclick_search") {
        const results = searchTools(
          String(args.query ?? ""),
          args.category as string | undefined
        );
        if (results.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No tools found matching "${args.query}". Try unclick_browse to see all available tools.`,
              },
            ],
          };
        }
        const text = results.map(formatToolSummary).join("\n\n---\n\n");
        return {
          content: [
            {
              type: "text",
              text: `Found ${results.length} tool(s) matching "${args.query}":\n\n${text}`,
            },
          ],
        };
      }

      if (name === "unclick_browse") {
        const filtered = args.category
          ? CATALOG.filter((t) => t.category === args.category)
          : CATALOG;

        const byCategory = filtered.reduce<Record<string, ToolDef[]>>((acc, tool) => {
          (acc[tool.category] ??= []).push(tool);
          return acc;
        }, {});

        const lines: string[] = [];
        for (const [cat, tools] of Object.entries(byCategory)) {
          lines.push(`## ${cat.toUpperCase()}`);
          for (const tool of tools) {
            lines.push(`- **${tool.name}** (\`${tool.slug}\`) - ${tool.description}`);
          }
          lines.push("");
        }

        return {
          content: [
            {
              type: "text",
              text: `UnClick Tool Catalog (${filtered.length} tools)\n\n${lines.join("\n")}`,
            },
          ],
        };
      }

      if (name === "unclick_tool_info") {
        const slug = String(args.slug ?? "");
        const tool = TOOL_MAP.get(slug);
        if (!tool) {
          const available = CATALOG.map((t) => t.slug).join(", ");
          return {
            content: [
              {
                type: "text",
                text: `Tool "${slug}" not found. Available slugs: ${available}`,
              },
            ],
            isError: true,
          };
        }

        const lines: string[] = [
          `# ${tool.name}`,
          `**Slug:** ${tool.slug}  |  **Category:** ${tool.category}  |  **Scope:** ${tool.scope}`,
          "",
          tool.description,
          "",
          "## Endpoints",
        ];

        for (const ep of tool.endpoints) {
          lines.push(`### \`${ep.id}\` - ${ep.name}`);
          lines.push(ep.description);
          lines.push(`**Method:** ${ep.method}  |  **Path:** ${ep.path}`);
          lines.push(`**Input Schema:**`);
          lines.push("```json");
          lines.push(JSON.stringify(ep.inputSchema, null, 2));
          lines.push("```");
          lines.push("");
        }

        lines.push(
          `\n> Call any endpoint with: \`unclick_call\` → \`{ endpoint_id: "<id>", params: {...} }\``
        );

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      }

      if (name === "unclick_call") {
        const endpointId = String(args.endpoint_id ?? "");
        const params = (args.params ?? {}) as Record<string, unknown>;

        const entry = ENDPOINT_MAP.get(endpointId);
        if (!entry) {
          return {
            content: [
              {
                type: "text",
                text: `Endpoint "${endpointId}" not found. Use unclick_tool_info to see valid endpoint IDs.`,
              },
            ],
            isError: true,
          };
        }

        const client = createClient();
        const result = await client.call(entry.endpoint.method, entry.endpoint.path, params);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // ── Direct tools ─────────────────────────────────────────────
      const handler = DIRECT_HANDLERS[name];
      if (handler) {
        const client = createClient();
        const result = await handler(client, args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}

export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server is running - errors go to stderr so they don't corrupt the MCP stream
  process.stderr.write("UnClick MCP server running on stdio\n");
}

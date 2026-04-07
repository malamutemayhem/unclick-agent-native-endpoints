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
          description: "Search term — describe what you want to do",
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
    name: "unclick_json_format",
    description: "Format / pretty-print a JSON string.",
    inputSchema: {
      type: "object" as const,
      properties: {
        json: { type: "string" },
        indent: { description: "2, 4, or 'tab'", default: 2 },
      },
      required: ["json"],
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
    description: "Parse an IP address — get decimal, binary, hex, and type (private/loopback/multicast).",
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

  unclick_json_format: (c, a) =>
    c.call("POST", "/v1/json/format", a as Record<string, unknown>),

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
            lines.push(`- **${tool.name}** (\`${tool.slug}\`) — ${tool.description}`);
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
          lines.push(`### \`${ep.id}\` — ${ep.name}`);
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
  // Server is running — errors go to stderr so they don't corrupt the MCP stream
  process.stderr.write("UnClick MCP server running on stdio\n");
}

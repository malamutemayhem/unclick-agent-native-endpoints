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
import {
  telegramSend,
  telegramRead,
  telegramSearch,
  telegramSendMedia,
  telegramGetUpdates,
  telegramManageChat,
} from "./telegram-tool.js";
import { slackAction } from "./slack-tool.js";
import {
  discordSend,
  discordRead,
  discordThread,
  discordReact,
  discordChannels,
  discordMembers,
  discordSearch,
} from "./discord-tool.js";
import {
  redditRead,
  redditPost,
  redditComment,
  redditSearch,
  redditUser,
  redditVote,
  redditSubscribe,
} from "./reddit-tool.js";
import { blueskyAction } from "./bluesky-tool.js";
import { mastodonAction } from "./mastodon-tool.js";
import {
  amazonSearch,
  amazonProduct,
  amazonBrowse,
  amazonVariations,
} from "./amazon-tool.js";
import {
  xeroInvoices,
  xeroContacts,
  xeroAccounts,
  xeroPayments,
  xeroBankTransactions,
  xeroReports,
  xeroQuotes,
  xeroOrganisation,
} from "./xero-tool.js";
import {
  shopifyProducts,
  shopifyOrders,
  shopifyCustomers,
  shopifyInventory,
  shopifyCollections,
  shopifyShop,
  shopifyFulfillments,
} from "./shopify-tool.js";
import {
  guardianSearch,
  guardianSections,
  guardianArticle,
  guardianTags,
} from "./guardian-tool.js";
import {
  newsTopHeadlines,
  newsSearch,
  newsSources,
} from "./newsapi-tool.js";
import {
  tmdbSearchMovies,
  tmdbSearchTv,
  tmdbMovie,
  tmdbTv,
  tmdbTrending,
  tmdbNowPlaying,
  tmdbUpcoming,
  tmdbPopularTv,
} from "./tmdb-tool.js";
import {
  nasaApod,
  nasaAsteroids,
  nasaMarsPhotos,
  nasaEarthImagery,
  nasaEpic,
} from "./nasa-tool.js";
import {
  f1Sessions,
  f1Drivers,
  f1Positions,
  f1Laps,
  f1PitStops,
  f1CarData,
  f1TeamRadio,
  f1Weather,
} from "./openf1-tool.js";
import {
  fplBootstrap,
  fplPlayer,
  fplGameweek,
  fplFixtures,
  fplMyTeam,
  fplManager,
  fplLeaguesClassic,
} from "./fpl-tool.js";
import {
  chessPlayer,
  chessPlayerStats,
  chessPlayerGames,
  chessPuzzlesRandom,
  chessLeaderboards,
} from "./chessdotcom-tool.js";
import {
  lichessUser,
  lichessUserGames,
  lichessPuzzleDaily,
  lichessTopPlayers,
  lichessTournament,
} from "./lichess-tool.js";

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
  // ── Telegram Bot API tools ────────────────────────────────────────────────
  {
    name: "telegram_send",
    description:
      "Send a text message to a Telegram chat, group, or channel via your bot. " +
      "Supports plain text and Markdown/HTML formatting. " +
      "Get a bot token from @BotFather. The bot must be a member of the target chat.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_token: { type: "string", description: "Telegram bot token from @BotFather (e.g. 123456:ABC-DEF...)." },
        chat_id: { type: ["string", "number"], description: "Target chat ID or @username (e.g. -1001234567890 or @mychannel)." },
        text: { type: "string", description: "Message text to send (up to 4096 characters)." },
        parse_mode: { type: "string", enum: ["Markdown", "HTML", "MarkdownV2"], description: "Optional formatting mode. Default is plain text." },
        reply_to_message_id: { type: "number", description: "Optional message ID to reply to." },
        disable_notification: { type: "boolean", description: "Send silently without notification sound. Default false." },
      },
      required: ["bot_token", "chat_id", "text"],
    },
  },
  {
    name: "telegram_read",
    description:
      "Read recent messages received by your Telegram bot. " +
      "Returns messages the bot has received since the last getUpdates call (or from a given offset). " +
      "Filter by chat_id to see messages from a specific chat.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_token: { type: "string", description: "Telegram bot token from @BotFather." },
        chat_id: { type: ["string", "number"], description: "Optional chat ID to filter messages (e.g. -1001234567890)." },
        limit: { type: "number", minimum: 1, maximum: 100, default: 20, description: "Max number of recent messages to return. Default 20." },
        offset: { type: "number", description: "Update ID offset for pagination. Use next_offset from a previous response." },
      },
      required: ["bot_token"],
    },
  },
  {
    name: "telegram_search",
    description:
      "Search for messages containing a keyword in your bot's recent message history. " +
      "Searches across all updates the bot has received. Filter by chat_id for a specific chat.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_token: { type: "string", description: "Telegram bot token from @BotFather." },
        query: { type: "string", description: "Keyword or phrase to search for (case-insensitive)." },
        chat_id: { type: ["string", "number"], description: "Optional chat ID to narrow search to a specific chat." },
        limit: { type: "number", minimum: 1, maximum: 50, default: 10, description: "Max number of matching messages to return. Default 10." },
        offset: { type: "number", description: "Update ID offset to start from." },
      },
      required: ["bot_token", "query"],
    },
  },
  {
    name: "telegram_send_media",
    description:
      "Send a photo, document, audio, video, or animation to a Telegram chat via your bot. " +
      "The media must be accessible via a public URL. Supports optional captions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_token: { type: "string", description: "Telegram bot token from @BotFather." },
        chat_id: { type: ["string", "number"], description: "Target chat ID or @username." },
        media_type: { type: "string", enum: ["photo", "document", "audio", "video", "animation"], description: "Type of media to send." },
        media_url: { type: "string", description: "Public URL of the media file to send." },
        caption: { type: "string", description: "Optional caption for the media (up to 1024 characters)." },
        parse_mode: { type: "string", enum: ["Markdown", "HTML", "MarkdownV2"], description: "Formatting mode for the caption." },
        disable_notification: { type: "boolean", description: "Send silently without notification sound. Default false." },
      },
      required: ["bot_token", "chat_id", "media_type", "media_url"],
    },
  },
  {
    name: "telegram_get_updates",
    description:
      "Fetch pending updates (messages, edited messages, channel posts) from the Telegram Bot API. " +
      "Use offset to mark previous updates as processed and avoid seeing them again.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_token: { type: "string", description: "Telegram bot token from @BotFather." },
        limit: { type: "number", minimum: 1, maximum: 100, default: 20, description: "Max number of updates to return." },
        offset: { type: "number", description: "Update ID offset. Pass next_offset from previous response to mark updates as read." },
        timeout: { type: "number", minimum: 0, maximum: 30, default: 0, description: "Seconds to wait for long polling. 0 = return immediately." },
        allowed_updates: { type: "array", items: { type: "string" }, description: "List of update types to receive, e.g. ['message', 'channel_post']." },
      },
      required: ["bot_token"],
    },
  },
  {
    name: "telegram_manage_chat",
    description:
      "Manage a Telegram chat: get chat info, list admins, pin a message, or unpin a message. " +
      "The bot must be an admin with the appropriate permissions to pin/unpin.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_token: { type: "string", description: "Telegram bot token from @BotFather." },
        chat_id: { type: ["string", "number"], description: "Target chat ID or @username." },
        action: {
          type: "string",
          enum: ["info", "members", "pin", "unpin"],
          description: "info: get chat details. members: list admins. pin: pin a message (requires message_id). unpin: unpin a message (message_id optional).",
        },
        message_id: { type: "number", description: "Message ID to pin or unpin (required for pin, optional for unpin)." },
        disable_notification: { type: "boolean", description: "Pin without notification. Applies to pin action only. Default false." },
      },
      required: ["bot_token", "chat_id", "action"],
    },
  },
  // ── Slack Web API ─────────────────────────────────────────────────────────
  {
    name: "slack",
    description:
      "Send and receive Slack messages, search conversations, manage reactions, " +
      "upload files, and list channels via the official Slack Web API. " +
      "Requires a Bot Token (xoxb-...) with the appropriate OAuth scopes. " +
      "Actions: slack_send, slack_read, slack_search, slack_thread_reply, " +
      "slack_channels, slack_react, slack_upload.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["slack_send", "slack_read", "slack_search", "slack_thread_reply", "slack_channels", "slack_react", "slack_upload"],
          description:
            "slack_send: post a message to a channel or DM. " +
            "slack_read: fetch recent messages from a channel (conversation history). " +
            "slack_search: search messages across the workspace. " +
            "slack_thread_reply: reply to an existing message thread. " +
            "slack_channels: list channels the bot can access. " +
            "slack_react: add an emoji reaction to a message. " +
            "slack_upload: upload a text file to a channel.",
        },
        bot_token: { type: "string", description: "Slack Bot Token starting with xoxb-. Create one at api.slack.com/apps under 'OAuth and Permissions'." },
        channel: { type: "string", description: "Channel ID (e.g. C01234ABCDE) or name (e.g. #general). Used by: slack_send, slack_read, slack_thread_reply, slack_react, slack_upload." },
        text: { type: "string", description: "Message text (supports Slack mrkdwn). Required by slack_send and slack_thread_reply unless blocks is provided." },
        blocks: { description: "Slack Block Kit payload (array of block objects). Optional alternative/addition to text for rich messages." },
        thread_ts: { type: "string", description: "Parent message timestamp to reply in a thread. Required for slack_thread_reply. Optional for slack_send." },
        username: { type: "string", description: "Override the bot display name for this message (slack_send only)." },
        limit: { type: "number", minimum: 1, maximum: 200, default: 20, description: "Max messages to return (slack_read: 1-200; slack_channels: 1-1000)." },
        oldest: { type: "string", description: "Return messages after this Unix timestamp (slack_read only)." },
        latest: { type: "string", description: "Return messages before this Unix timestamp (slack_read only)." },
        query: { type: "string", description: "Search query string (slack_search only). Supports Slack search modifiers." },
        count: { type: "number", minimum: 1, maximum: 100, default: 20, description: "Max search results to return (slack_search only)." },
        sort: { type: "string", enum: ["score", "timestamp"], default: "timestamp", description: "Sort search results by relevance or recency (slack_search only)." },
        sort_dir: { type: "string", enum: ["asc", "desc"], default: "desc", description: "Sort direction for search results (slack_search only)." },
        types: { type: "string", default: "public_channel", description: "Comma-separated channel types to include (slack_channels only)." },
        exclude_archived: { type: "boolean", default: true, description: "Exclude archived channels from results (slack_channels only)." },
        timestamp: { type: "string", description: "Message timestamp (ts) to react to (slack_react only)." },
        emoji: { type: "string", description: "Emoji name without colons, e.g. 'thumbsup' or '+1' (slack_react only)." },
        filename: { type: "string", default: "file.txt", description: "Filename for the uploaded file (slack_upload only)." },
        content: { type: "string", description: "Text content of the file to upload (slack_upload only)." },
        channels: { type: "string", description: "Comma-separated channel IDs to share the file with (slack_upload only)." },
        initial_comment: { type: "string", description: "Optional message to post alongside the uploaded file (slack_upload only)." },
      },
      required: ["action", "bot_token"],
    },
  },
  // ── Discord REST API v10 ──────────────────────────────────────────────────
  {
    name: "discord_send",
    description: "Send a message to a Discord channel. Optionally reply to an existing message or enable TTS.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_token: { type: "string", description: "Discord bot token (starts with Bot ...)" },
        channel_id: { type: "string", description: "ID of the channel to send the message to" },
        content: { type: "string", description: "Message text (up to 2000 characters)" },
        reply_to: { type: "string", description: "Message ID to reply to (optional)" },
        tts: { type: "boolean", default: false, description: "Send as text-to-speech (optional)" },
      },
      required: ["bot_token", "channel_id", "content"],
    },
  },
  {
    name: "discord_read",
    description: "Read recent messages from a Discord channel.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_token: { type: "string", description: "Discord bot token" },
        channel_id: { type: "string", description: "ID of the channel to read" },
        limit: { type: "number", minimum: 1, maximum: 100, default: 50, description: "Number of messages to fetch (default 50, max 100)" },
        before: { type: "string", description: "Fetch messages before this message ID (optional)" },
        after: { type: "string", description: "Fetch messages after this message ID (optional)" },
      },
      required: ["bot_token", "channel_id"],
    },
  },
  {
    name: "discord_thread",
    description:
      "Create a thread from a message, create a standalone thread in a channel, or reply to an existing thread. " +
      "Provide thread_id to reply. Provide message_id to start a thread from that message. " +
      "Provide neither to create a standalone thread.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_token: { type: "string", description: "Discord bot token" },
        channel_id: { type: "string", description: "Channel to create the thread in" },
        name: { type: "string", description: "Thread name (required when creating a thread)" },
        content: { type: "string", description: "Initial or reply message content" },
        thread_id: { type: "string", description: "Existing thread ID to reply to (optional)" },
        message_id: { type: "string", description: "Message ID to start a thread from (optional)" },
        auto_archive_duration: { type: "number", enum: [60, 1440, 4320, 10080], description: "Minutes until the thread auto-archives: 60, 1440, 4320, or 10080 (optional)" },
      },
      required: ["bot_token", "channel_id"],
    },
  },
  {
    name: "discord_react",
    description: "Add an emoji reaction to a Discord message.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_token: { type: "string", description: "Discord bot token" },
        channel_id: { type: "string", description: "Channel containing the message" },
        message_id: { type: "string", description: "ID of the message to react to" },
        emoji: { type: "string", description: "Unicode emoji (e.g. '👍') or custom emoji in name:id format (e.g. 'thumbsup:123456789')" },
      },
      required: ["bot_token", "channel_id", "message_id", "emoji"],
    },
  },
  {
    name: "discord_channels",
    description: "List all channels in a Discord guild (server).",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_token: { type: "string", description: "Discord bot token" },
        guild_id: { type: "string", description: "Guild (server) ID" },
      },
      required: ["bot_token", "guild_id"],
    },
  },
  {
    name: "discord_members",
    description: "List members of a Discord guild. Requires the SERVER MEMBERS INTENT to be enabled on the bot.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_token: { type: "string", description: "Discord bot token" },
        guild_id: { type: "string", description: "Guild (server) ID" },
        limit: { type: "number", minimum: 1, maximum: 1000, default: 100, description: "Number of members to return (default 100, max 1000)" },
        after: { type: "string", description: "Return members after this user ID for pagination (optional)" },
      },
      required: ["bot_token", "guild_id"],
    },
  },
  {
    name: "discord_search",
    description: "Search messages in a Discord guild using Discord's search endpoint.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_token: { type: "string", description: "Discord bot token" },
        guild_id: { type: "string", description: "Guild (server) ID to search in" },
        query: { type: "string", description: "Text to search for in message content" },
        channel_id: { type: "string", description: "Restrict search to this channel (optional)" },
        author_id: { type: "string", description: "Restrict search to messages from this user ID (optional)" },
        has: { type: "string", enum: ["link", "embed", "file", "video", "image", "sound", "sticker"], description: "Filter by attachment type (optional)" },
        limit: { type: "number", minimum: 1, maximum: 25, default: 25, description: "Max results (default 25)" },
        offset: { type: "number", default: 0, description: "Pagination offset (optional)" },
      },
      required: ["bot_token", "guild_id", "query"],
    },
  },
  // ── Reddit OAuth2 API ─────────────────────────────────────────────────────
  {
    name: "reddit_read",
    description:
      "Read posts from a subreddit. Supports hot, new, top, and rising feeds. " +
      "Returns post titles, scores, authors, URLs, and comment counts. " +
      "Requires a Reddit OAuth2 bearer token with the 'read' scope.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string", description: "Reddit OAuth2 bearer token (scope: read)." },
        subreddit: { type: "string", description: "Subreddit name, e.g. 'programming' or 'r/programming'." },
        sort: { type: "string", enum: ["hot", "new", "top", "rising"], default: "hot", description: "Feed sort order (default: hot)." },
        limit: { type: "number", minimum: 1, maximum: 100, default: 25, description: "Number of posts to return (1-100, default 25)." },
        after: { type: "string", description: "Pagination cursor from a previous response (optional)." },
        t: { type: "string", enum: ["hour", "day", "week", "month", "year", "all"], description: "Time filter for 'top' sort (optional)." },
      },
      required: ["access_token", "subreddit"],
    },
  },
  {
    name: "reddit_post",
    description:
      "Submit a new post to a subreddit. Supports text (self) posts and link posts. " +
      "Requires a Reddit OAuth2 bearer token with the 'submit' scope.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string", description: "Reddit OAuth2 bearer token (scope: submit)." },
        subreddit: { type: "string", description: "Subreddit to post to, e.g. 'test' or 'r/test'." },
        title: { type: "string", description: "Post title (required)." },
        kind: { type: "string", enum: ["self", "link"], description: "'self' for text posts, 'link' for URL posts." },
        text: { type: "string", description: "Post body in Markdown (required when kind is 'self')." },
        url: { type: "string", description: "URL to submit (required when kind is 'link')." },
        nsfw: { type: "boolean", default: false, description: "Mark post as NSFW (default false)." },
        spoiler: { type: "boolean", default: false, description: "Mark post as spoiler (default false)." },
        flair_id: { type: "string", description: "Flair template ID (optional)." },
        flair_text: { type: "string", description: "Flair text (optional)." },
      },
      required: ["access_token", "subreddit", "title", "kind"],
    },
  },
  {
    name: "reddit_comment",
    description:
      "Post a comment on a Reddit post or reply to an existing comment. " +
      "Use the fullname of the parent (t3_ for posts, t1_ for comments). " +
      "Requires a Reddit OAuth2 bearer token with the 'submit' scope.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string", description: "Reddit OAuth2 bearer token (scope: submit)." },
        parent_id: { type: "string", description: "Fullname of the post or comment to reply to, e.g. 't3_abc123' or 't1_def456'." },
        text: { type: "string", description: "Comment body in Markdown." },
      },
      required: ["access_token", "parent_id", "text"],
    },
  },
  {
    name: "reddit_search",
    description:
      "Search posts across all of Reddit or within a specific subreddit. " +
      "Supports relevance, hot, top, new, and comments sort orders. " +
      "Requires a Reddit OAuth2 bearer token with the 'read' scope.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string", description: "Reddit OAuth2 bearer token (scope: read)." },
        query: { type: "string", description: "Search query string." },
        subreddit: { type: "string", description: "Restrict search to this subreddit (optional)." },
        sort: { type: "string", enum: ["relevance", "hot", "top", "new", "comments"], default: "relevance", description: "Result sort order (default: relevance)." },
        t: { type: "string", enum: ["hour", "day", "week", "month", "year", "all"], description: "Time filter for 'top' sort (optional)." },
        limit: { type: "number", minimum: 1, maximum: 100, default: 25, description: "Number of results to return (1-100, default 25)." },
        after: { type: "string", description: "Pagination cursor from a previous response (optional)." },
      },
      required: ["access_token", "query"],
    },
  },
  {
    name: "reddit_user",
    description:
      "Get a Reddit user's profile and recent activity (posts and comments). " +
      "Requires a Reddit OAuth2 bearer token with the 'read' scope.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string", description: "Reddit OAuth2 bearer token (scope: read)." },
        username: { type: "string", description: "Reddit username, e.g. 'spez' or 'u/spez'." },
        include_posts: { type: "boolean", default: true, description: "Include recent posts in the response (default true)." },
        include_comments: { type: "boolean", default: true, description: "Include recent comments in the response (default true)." },
        limit: { type: "number", minimum: 1, maximum: 100, default: 10, description: "Max recent posts/comments to return per type (default 10)." },
      },
      required: ["access_token", "username"],
    },
  },
  {
    name: "reddit_vote",
    description:
      "Upvote, downvote, or remove your vote on a Reddit post or comment. " +
      "Pass the fullname of the item (t3_ for posts, t1_ for comments). " +
      "Requires a Reddit OAuth2 bearer token with the 'vote' scope.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string", description: "Reddit OAuth2 bearer token (scope: vote)." },
        id: { type: "string", description: "Fullname of the post or comment, e.g. 't3_abc123' or 't1_def456'." },
        dir: { type: "number", enum: [1, 0, -1], description: "Vote direction: 1 = upvote, 0 = remove vote, -1 = downvote." },
      },
      required: ["access_token", "id", "dir"],
    },
  },
  {
    name: "reddit_subscribe",
    description:
      "Subscribe to or unsubscribe from a subreddit. " +
      "Requires a Reddit OAuth2 bearer token with the 'subscribe' scope.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string", description: "Reddit OAuth2 bearer token (scope: subscribe)." },
        subreddit: { type: "string", description: "Subreddit name, e.g. 'programming' or 'r/programming'." },
        action: { type: "string", enum: ["sub", "unsub"], description: "'sub' to subscribe, 'unsub' to unsubscribe." },
      },
      required: ["access_token", "subreddit", "action"],
    },
  },
  // ── Bluesky / AT Protocol ─────────────────────────────────────────────────
  {
    name: "bluesky",
    description:
      "Post, read, reply, like, repost, search, and follow on Bluesky social network via the AT Protocol. " +
      "Authenticates per-call with your Bluesky handle/email and app password. " +
      "Actions: bluesky_post, bluesky_read_feed, bluesky_reply, bluesky_like, bluesky_repost, " +
      "bluesky_search, bluesky_profile, bluesky_follow.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["bluesky_post", "bluesky_read_feed", "bluesky_reply", "bluesky_like", "bluesky_repost", "bluesky_search", "bluesky_profile", "bluesky_follow"],
          description:
            "bluesky_post: create a new post (up to 300 chars). " +
            "bluesky_read_feed: read home timeline or a user's posts. " +
            "bluesky_reply: reply to an existing post. " +
            "bluesky_like: like a post by URI. " +
            "bluesky_repost: repost/share a post by URI. " +
            "bluesky_search: search posts or users by keyword. " +
            "bluesky_profile: get a user's profile. " +
            "bluesky_follow: follow or unfollow a user.",
        },
        identifier: { type: "string", description: "Your Bluesky handle (e.g. alice.bsky.social) or email address." },
        password: { type: "string", description: "Your Bluesky app password. Create one at Settings > Privacy and Security > App Passwords." },
        text: { type: "string", description: "Post or reply text (max 300 characters). Required for bluesky_post and bluesky_reply." },
        langs: { type: "array", items: { type: "string" }, description: "BCP-47 language tags for the post, e.g. ['en']. Optional." },
        feed_type: { type: "string", enum: ["home", "user"], default: "home", description: "bluesky_read_feed: 'home' for your timeline, 'user' for a specific actor's posts." },
        actor: { type: "string", description: "Handle or DID of the target user. Required for bluesky_profile and bluesky_follow. Optional for bluesky_read_feed." },
        post_uri: { type: "string", description: "AT URI of the post to like or repost. Required for bluesky_like and bluesky_repost." },
        parent_uri: { type: "string", description: "AT URI of the post to reply to. Required for bluesky_reply." },
        root_uri: { type: "string", description: "AT URI of the root post in the thread. Optional for bluesky_reply (defaults to parent_uri)." },
        query: { type: "string", description: "Search query string. Required for bluesky_search." },
        type: { type: "string", enum: ["posts", "users"], default: "posts", description: "bluesky_search: search 'posts' (default) or 'users'." },
        unfollow: { type: "boolean", default: false, description: "bluesky_follow: set true to unfollow instead of follow." },
        limit: { type: "number", minimum: 1, maximum: 100, default: 20, description: "Max results to return for feed/search operations." },
        cursor: { type: "string", description: "Pagination cursor from a previous response." },
      },
      required: ["action", "identifier", "password"],
    },
  },
  // ── Mastodon (works with any Mastodon-compatible instance) ───────────────
  {
    name: "mastodon_post",
    description: "Create a new toot/status on Mastodon (or any compatible instance: Pleroma, Akkoma, Misskey). Supports visibility settings and content warnings.",
    inputSchema: {
      type: "object" as const,
      properties: {
        instance_url: { type: "string", description: "Your Mastodon instance URL, e.g. 'mastodon.social'" },
        access_token: { type: "string", description: "Your Mastodon access token" },
        status: { type: "string", description: "The text content of the toot" },
        visibility: { type: "string", enum: ["public", "unlisted", "private", "direct"], default: "public", description: "Who can see this post" },
        spoiler_text: { type: "string", description: "Content warning text shown before the post body" },
        sensitive: { type: "boolean", default: false, description: "Mark media as sensitive" },
        media_ids: { type: "array", items: { type: "string" }, description: "IDs of already-uploaded media attachments to attach (up to 4)" },
      },
      required: ["instance_url", "access_token", "status"],
    },
  },
  {
    name: "mastodon_read_timeline",
    description: "Read posts from a Mastodon timeline. home = accounts you follow, local = your instance only, public = federated (whole Fediverse).",
    inputSchema: {
      type: "object" as const,
      properties: {
        instance_url: { type: "string", description: "Your Mastodon instance URL" },
        access_token: { type: "string", description: "Your Mastodon access token" },
        timeline: { type: "string", enum: ["home", "local", "public"], default: "home", description: "Which timeline to read" },
        limit: { type: "number", minimum: 1, maximum: 40, default: 20, description: "Number of posts to return" },
        max_id: { type: "string", description: "Return posts older than this status ID (for pagination)" },
      },
      required: ["instance_url", "access_token"],
    },
  },
  {
    name: "mastodon_reply",
    description: "Reply to an existing Mastodon status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        instance_url: { type: "string", description: "Your Mastodon instance URL" },
        access_token: { type: "string", description: "Your Mastodon access token" },
        in_reply_to_id: { type: "string", description: "ID of the status to reply to" },
        status: { type: "string", description: "Text content of your reply" },
        visibility: { type: "string", enum: ["public", "unlisted", "private", "direct"], description: "Visibility of the reply (defaults to same as the original post)" },
        spoiler_text: { type: "string", description: "Optional content warning text" },
      },
      required: ["instance_url", "access_token", "in_reply_to_id", "status"],
    },
  },
  {
    name: "mastodon_boost",
    description: "Boost (reblog) a Mastodon status, or undo a boost.",
    inputSchema: {
      type: "object" as const,
      properties: {
        instance_url: { type: "string", description: "Your Mastodon instance URL" },
        access_token: { type: "string", description: "Your Mastodon access token" },
        status_id: { type: "string", description: "ID of the status to boost" },
        unboost: { type: "boolean", default: false, description: "If true, removes the boost instead" },
      },
      required: ["instance_url", "access_token", "status_id"],
    },
  },
  {
    name: "mastodon_favorite",
    description: "Favorite (like) a Mastodon status, or remove a favorite.",
    inputSchema: {
      type: "object" as const,
      properties: {
        instance_url: { type: "string", description: "Your Mastodon instance URL" },
        access_token: { type: "string", description: "Your Mastodon access token" },
        status_id: { type: "string", description: "ID of the status to favorite" },
        unfavorite: { type: "boolean", default: false, description: "If true, removes the favorite instead" },
      },
      required: ["instance_url", "access_token", "status_id"],
    },
  },
  {
    name: "mastodon_search",
    description: "Search Mastodon for posts, accounts, or hashtags. Omit 'type' to search all three categories at once.",
    inputSchema: {
      type: "object" as const,
      properties: {
        instance_url: { type: "string", description: "Your Mastodon instance URL" },
        access_token: { type: "string", description: "Your Mastodon access token" },
        query: { type: "string", description: "Search term, hashtag, or account handle" },
        type: { type: "string", enum: ["accounts", "statuses", "hashtags"], description: "Limit results to one category (optional)" },
        limit: { type: "number", minimum: 1, maximum: 40, default: 20 },
        resolve: { type: "boolean", default: true, description: "Resolve remote accounts/posts via WebFinger" },
      },
      required: ["instance_url", "access_token", "query"],
    },
  },
  {
    name: "mastodon_profile",
    description: "Get account information for a Mastodon user. Omit account_id and acct to return your own profile.",
    inputSchema: {
      type: "object" as const,
      properties: {
        instance_url: { type: "string", description: "Your Mastodon instance URL" },
        access_token: { type: "string", description: "Your Mastodon access token" },
        account_id: { type: "string", description: "Numeric account ID (takes priority over acct)" },
        acct: { type: "string", description: "Account handle, e.g. 'user@mastodon.social' or just 'user'" },
      },
      required: ["instance_url", "access_token"],
    },
  },
  {
    name: "mastodon_follow",
    description: "Follow or unfollow a Mastodon account. Returns the updated relationship.",
    inputSchema: {
      type: "object" as const,
      properties: {
        instance_url: { type: "string", description: "Your Mastodon instance URL" },
        access_token: { type: "string", description: "Your Mastodon access token" },
        account_id: { type: "string", description: "Numeric ID of the account to follow/unfollow" },
        unfollow: { type: "boolean", default: false, description: "If true, unfollows instead" },
      },
      required: ["instance_url", "access_token", "account_id"],
    },
  },
  {
    name: "mastodon_notifications",
    description: "Read your Mastodon notifications. Notification types: mention, status, reblog, follow, follow_request, favourite, poll, update.",
    inputSchema: {
      type: "object" as const,
      properties: {
        instance_url: { type: "string", description: "Your Mastodon instance URL" },
        access_token: { type: "string", description: "Your Mastodon access token" },
        limit: { type: "number", minimum: 1, maximum: 30, default: 15, description: "Number of notifications to return" },
        max_id: { type: "string", description: "Return notifications older than this ID (for pagination)" },
        types: { type: "array", items: { type: "string", enum: ["mention", "status", "reblog", "follow", "follow_request", "favourite", "poll", "update"] }, description: "Filter to specific notification types (optional)" },
      },
      required: ["instance_url", "access_token"],
    },
  },
  // ── Amazon Product Advertising API 5.0 ───────────────────────────────────
  {
    name: "amazon_search",
    description:
      "Search Amazon products by keyword, category (SearchIndex), browse node, or any combination. " +
      "Uses Amazon PA-API 5.0 SearchItems endpoint. Returns titles, prices, images, ratings, and direct product URLs. " +
      "Requires an Amazon Associates account: Access Key, Secret Key, and Partner Tag.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_key:     { type: "string", description: "Amazon PA-API access key ID" },
        secret_key:     { type: "string", description: "Amazon PA-API secret access key" },
        partner_tag:    { type: "string", description: "Amazon Associates partner/tracking tag (e.g. mytag-20)" },
        keywords:       { type: "string", description: "Search keywords (e.g. 'wireless headphones')" },
        search_index:   { type: "string", description: "Product category / SearchIndex (e.g. Electronics, Books, Apparel, All). Defaults to All." },
        browse_node_id: { type: "string", description: "Amazon browse node ID to filter results" },
        sort_by:        { type: "string", enum: ["AvgCustomerReviews", "Featured", "NewestArrivals", "Price:HighToLow", "Price:LowToHigh", "Relevance"], description: "Sort order for results" },
        min_price:      { type: "number", description: "Minimum price in cents (e.g. 1000 = $10.00)" },
        max_price:      { type: "number", description: "Maximum price in cents (e.g. 5000 = $50.00)" },
        item_count:     { type: "number", description: "Number of results to return (1-10, default 10)", default: 10 },
        item_page:      { type: "number", description: "Results page number (1-10)", default: 1 },
        marketplace:    { type: "string", enum: ["US","CA","MX","BR","UK","DE","FR","IT","ES","NL","SE","PL","BE","IN","JP","AU","SG","AE","SA","TR"], default: "US", description: "Amazon marketplace country code (default: US)" },
      },
      required: ["access_key", "secret_key", "partner_tag"],
    },
  },
  {
    name: "amazon_product",
    description:
      "Get detailed product information for one or more Amazon products by ASIN. " +
      "Uses Amazon PA-API 5.0 GetItems endpoint. Returns full details: title, price, features, images, ratings, brand, availability. " +
      "Requires an Amazon Associates account.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_key:  { type: "string", description: "Amazon PA-API access key ID" },
        secret_key:  { type: "string", description: "Amazon PA-API secret access key" },
        partner_tag: { type: "string", description: "Amazon Associates partner/tracking tag" },
        asin:        { type: "string", description: "Single product ASIN (e.g. B08N5WRWNW)" },
        asins:       { type: "array", items: { type: "string" }, description: "Array of ASINs for batch lookup (up to 10)" },
        marketplace: { type: "string", enum: ["US","CA","MX","BR","UK","DE","FR","IT","ES","NL","SE","PL","BE","IN","JP","AU","SG","AE","SA","TR"], default: "US", description: "Amazon marketplace country code (default: US)" },
      },
      required: ["access_key", "secret_key", "partner_tag"],
    },
  },
  {
    name: "amazon_browse",
    description:
      "Browse Amazon product categories by browse node ID. " +
      "Uses Amazon PA-API 5.0 GetBrowseNodes endpoint. Returns node name, parent ancestor, and child subcategories.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_key:      { type: "string", description: "Amazon PA-API access key ID" },
        secret_key:      { type: "string", description: "Amazon PA-API secret access key" },
        partner_tag:     { type: "string", description: "Amazon Associates partner/tracking tag" },
        browse_node_id:  { type: "string", description: "Single browse node ID (e.g. 172282 for Electronics)" },
        browse_node_ids: { type: "array", items: { type: "string" }, description: "Array of browse node IDs for batch lookup" },
        marketplace:     { type: "string", enum: ["US","CA","MX","BR","UK","DE","FR","IT","ES","NL","SE","PL","BE","IN","JP","AU","SG","AE","SA","TR"], default: "US", description: "Amazon marketplace country code (default: US)" },
      },
      required: ["access_key", "secret_key", "partner_tag"],
    },
  },
  {
    name: "amazon_variations",
    description:
      "Get all product variations for an Amazon parent ASIN (colors, sizes, styles, etc.). " +
      "Uses Amazon PA-API 5.0 GetVariations endpoint. Returns each variation with its own ASIN, price, and images.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_key:      { type: "string", description: "Amazon PA-API access key ID" },
        secret_key:      { type: "string", description: "Amazon PA-API secret access key" },
        partner_tag:     { type: "string", description: "Amazon Associates partner/tracking tag" },
        asin:            { type: "string", description: "Parent product ASIN whose variations to retrieve" },
        variation_count: { type: "number", description: "Number of variations to return (1-10, default 10)", default: 10 },
        variation_page:  { type: "number", description: "Variations page number (1-10)", default: 1 },
        marketplace:     { type: "string", enum: ["US","CA","MX","BR","UK","DE","FR","IT","ES","NL","SE","PL","BE","IN","JP","AU","SG","AE","SA","TR"], default: "US", description: "Amazon marketplace country code (default: US)" },
      },
      required: ["access_key", "secret_key", "partner_tag", "asin"],
    },
  },
  // ── Xero accounting (OAuth 2.0, Xero API v2) ─────────────────────────────
  {
    name: "xero_invoices",
    description: "List, get, or create invoices in Xero. Requires a valid OAuth 2.0 access_token and your Xero tenant_id.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string", description: "Xero OAuth 2.0 Bearer token" },
        tenant_id:    { type: "string", description: "Xero organisation tenant ID" },
        action:       { type: "string", enum: ["list", "get", "create"], default: "list", description: "Operation to perform" },
        invoice_id:   { type: "string", description: "Invoice ID or number (required for action='get')" },
        body:         { type: "object", description: "Invoice object to create (required for action='create'). Must include Type, Contact.ContactID, and LineItems." },
        where:        { type: "string", description: "OData-style filter, e.g. \"Status==\"DRAFT\"\"" },
        order:        { type: "string", description: "Sort field, e.g. \"DueDate DESC\"" },
        page:         { type: "number", description: "Page number (100 records per page)" },
        page_size:    { type: "number", description: "Records per page (max 1000)" },
        statuses:     { type: "string", description: "Comma-separated statuses, e.g. \"DRAFT,SUBMITTED\"" },
        contact_ids:  { type: "string", description: "Comma-separated ContactIDs to filter by" },
        ids:          { type: "string", description: "Comma-separated InvoiceIDs to fetch" },
      },
      required: ["access_token", "tenant_id"],
    },
  },
  {
    name: "xero_contacts",
    description: "List, get, or create contacts (customers and suppliers) in Xero. Requires access_token and tenant_id.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token:     { type: "string", description: "Xero OAuth 2.0 Bearer token" },
        tenant_id:        { type: "string", description: "Xero organisation tenant ID" },
        action:           { type: "string", enum: ["list", "get", "create"], default: "list" },
        contact_id:       { type: "string", description: "Contact ID (required for action='get')" },
        body:             { type: "object", description: "Contact object to create (required for action='create'). Must include Name." },
        where:            { type: "string", description: "OData-style filter" },
        order:            { type: "string", description: "Sort field" },
        page:             { type: "number", description: "Page number" },
        page_size:        { type: "number", description: "Records per page" },
        search_term:      { type: "string", description: "Search contacts by name, email, or account number" },
        ids:              { type: "string", description: "Comma-separated ContactIDs to fetch" },
        include_archived: { type: "boolean", description: "Include archived contacts (default false)" },
      },
      required: ["access_token", "tenant_id"],
    },
  },
  {
    name: "xero_accounts",
    description: "List the chart of accounts for a Xero organisation. Returns all accounts with their codes, types, and balances.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string", description: "Xero OAuth 2.0 Bearer token" },
        tenant_id:    { type: "string", description: "Xero organisation tenant ID" },
        where:        { type: "string", description: "OData-style filter, e.g. \"Type==\"BANK\"\"" },
        order:        { type: "string", description: "Sort field, e.g. \"Code ASC\"" },
      },
      required: ["access_token", "tenant_id"],
    },
  },
  {
    name: "xero_payments",
    description: "List or create payments in Xero. action='list' returns payments; action='create' records a payment against an invoice.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string", description: "Xero OAuth 2.0 Bearer token" },
        tenant_id:    { type: "string", description: "Xero organisation tenant ID" },
        action:       { type: "string", enum: ["list", "create"], default: "list" },
        body:         { type: "object", description: "Payment object (required for action='create'). Must include Invoice.InvoiceID, Account.AccountID, Date, and Amount." },
        where:        { type: "string", description: "OData-style filter" },
        order:        { type: "string", description: "Sort field" },
        page:         { type: "number", description: "Page number" },
      },
      required: ["access_token", "tenant_id"],
    },
  },
  {
    name: "xero_bank_transactions",
    description: "List bank transactions for a Xero organisation. Returns spend and receive money transactions from bank accounts.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string", description: "Xero OAuth 2.0 Bearer token" },
        tenant_id:    { type: "string", description: "Xero organisation tenant ID" },
        where:        { type: "string", description: "OData-style filter" },
        order:        { type: "string", description: "Sort field" },
        page:         { type: "number", description: "Page number (100 per page)" },
      },
      required: ["access_token", "tenant_id"],
    },
  },
  {
    name: "xero_reports",
    description:
      "Retrieve financial reports from Xero. " +
      "Common report IDs: ProfitAndLoss, BalanceSheet, CashSummary, ExecutiveSummary, TrialBalance, BankSummary, AgedReceivablesByContact, AgedPayablesByContact.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string", description: "Xero OAuth 2.0 Bearer token" },
        tenant_id:    { type: "string", description: "Xero organisation tenant ID" },
        report_id:    { type: "string", description: "Report identifier. Options: ProfitAndLoss, BalanceSheet, CashSummary, ExecutiveSummary, TrialBalance, BankSummary, AgedReceivablesByContact, AgedPayablesByContact." },
        from_date:    { type: "string", description: "Report start date, e.g. '2024-01-01'" },
        to_date:      { type: "string", description: "Report end date, e.g. '2024-12-31'" },
        date:         { type: "string", description: "As-at date for balance sheet reports" },
        periods:      { type: "number", description: "Number of periods to compare" },
        timeframe:    { type: "string", description: "Comparison period: MONTH, QUARTER, YEAR" },
        contact_id:   { type: "string", description: "ContactID for aged receivables/payables reports" },
        account_id:   { type: "string", description: "AccountID to filter by" },
      },
      required: ["access_token", "tenant_id", "report_id"],
    },
  },
  {
    name: "xero_quotes",
    description: "List, get, or create quotes (sales quotes) in Xero. Requires access_token and tenant_id.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string", description: "Xero OAuth 2.0 Bearer token" },
        tenant_id:    { type: "string", description: "Xero organisation tenant ID" },
        action:       { type: "string", enum: ["list", "get", "create"], default: "list" },
        quote_id:     { type: "string", description: "Quote ID (required for action='get')" },
        body:         { type: "object", description: "Quote object to create (required for action='create'). Must include Contact.ContactID and LineItems." },
        status:       { type: "string", description: "Filter by status: DRAFT, SENT, DECLINED, ACCEPTED, INVOICED, DELETED" },
        contact_id:   { type: "string", description: "Filter by ContactID" },
        date_from:    { type: "string", description: "Filter quotes from this date, e.g. '2024-01-01'" },
        date_to:      { type: "string", description: "Filter quotes to this date, e.g. '2024-12-31'" },
        page:         { type: "number", description: "Page number" },
      },
      required: ["access_token", "tenant_id"],
    },
  },
  {
    name: "xero_organisation",
    description: "Get organisation and tenant information from Xero. Returns legal name, organisation type, base currency, country, financial year end, and subscription status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string", description: "Xero OAuth 2.0 Bearer token" },
        tenant_id:    { type: "string", description: "Xero organisation tenant ID" },
      },
      required: ["access_token", "tenant_id"],
    },
  },
  // ── Shopify Admin API ─────────────────────────────────────────────────────
  {
    name: "shopify_products",
    description: "Manage Shopify products via the Admin REST API. List all products, get a single product by ID, create a new product, or update an existing one.",
    inputSchema: {
      type: "object" as const,
      properties: {
        store:            { type: "string", description: "Shopify store domain, e.g. 'mystore' or 'mystore.myshopify.com'." },
        access_token:     { type: "string", description: "Shopify Admin API access token (shpat_...)." },
        action:           { type: "string", enum: ["list", "get", "create", "update"], default: "list", description: "list: all products. get: one by ID. create: new product. update: edit existing." },
        id:               { type: "string", description: "Product ID (required for get and update)." },
        product:          { type: "object", description: "Product data for create or update. Keys: title, body_html, vendor, product_type, tags, variants, images, status." },
        limit:            { type: "number", minimum: 1, maximum: 250, default: 50 },
        page_info:        { type: "string", description: "Cursor for paginating through results (from _pagination.next)." },
        status:           { type: "string", enum: ["active", "archived", "draft"], description: "Filter by product status (list only)." },
        vendor:           { type: "string", description: "Filter by vendor (list only)." },
        product_type:     { type: "string", description: "Filter by product type (list only)." },
        published_status: { type: "string", enum: ["published", "unpublished", "any"], description: "Filter by published status (list only)." },
        title:            { type: "string", description: "Filter by title (list only)." },
        since_id:         { type: "string", description: "Return only products after this ID (list only)." },
        fields:           { type: "string", description: "Comma-separated list of fields to return." },
      },
      required: ["store", "access_token"],
    },
  },
  {
    name: "shopify_orders",
    description: "List or retrieve Shopify orders via the Admin REST API. Filter by status, financial status, fulfillment status, and date ranges.",
    inputSchema: {
      type: "object" as const,
      properties: {
        store:              { type: "string", description: "Shopify store domain." },
        access_token:       { type: "string", description: "Shopify Admin API access token." },
        action:             { type: "string", enum: ["list", "get"], default: "list", description: "list: all orders. get: one order by ID." },
        id:                 { type: "string", description: "Order ID (required for get)." },
        limit:              { type: "number", minimum: 1, maximum: 250, default: 50 },
        status:             { type: "string", enum: ["open", "closed", "cancelled", "any"], default: "any" },
        financial_status:   { type: "string", enum: ["authorized", "pending", "paid", "partially_paid", "refunded", "voided", "partially_refunded", "any"] },
        fulfillment_status: { type: "string", enum: ["shipped", "partial", "unshipped", "unfulfilled", "any"] },
        since_id:           { type: "string" },
        created_at_min:     { type: "string", description: "ISO 8601 datetime, e.g. '2024-01-01T00:00:00Z'." },
        created_at_max:     { type: "string", description: "ISO 8601 datetime." },
        page_info:          { type: "string", description: "Cursor for next/previous page." },
        fields:             { type: "string", description: "Comma-separated fields to return." },
      },
      required: ["store", "access_token"],
    },
  },
  {
    name: "shopify_customers",
    description: "List, retrieve, or search Shopify customers via the Admin REST API.",
    inputSchema: {
      type: "object" as const,
      properties: {
        store:          { type: "string", description: "Shopify store domain." },
        access_token:   { type: "string", description: "Shopify Admin API access token." },
        action:         { type: "string", enum: ["list", "get", "search"], default: "list", description: "list: all customers. get: one by ID. search: query by email/name/phone." },
        id:             { type: "string", description: "Customer ID (required for get)." },
        query:          { type: "string", description: "Search query (required for search), e.g. 'email:foo@bar.com' or 'Bob'." },
        limit:          { type: "number", minimum: 1, maximum: 250, default: 50 },
        since_id:       { type: "string" },
        created_at_min: { type: "string" },
        created_at_max: { type: "string" },
        updated_at_min: { type: "string" },
        page_info:      { type: "string" },
        fields:         { type: "string" },
      },
      required: ["store", "access_token"],
    },
  },
  {
    name: "shopify_inventory",
    description: "Get inventory levels for specific items or locations from Shopify. At least one of inventory_item_ids or location_ids must be provided.",
    inputSchema: {
      type: "object" as const,
      properties: {
        store:               { type: "string", description: "Shopify store domain." },
        access_token:        { type: "string", description: "Shopify Admin API access token." },
        inventory_item_ids:  { description: "One or more inventory item IDs (string or array of strings)." },
        location_ids:        { description: "One or more location IDs (string or array of strings)." },
        limit:               { type: "number", minimum: 1, maximum: 250, default: 50 },
      },
      required: ["store", "access_token"],
    },
  },
  {
    name: "shopify_collections",
    description: "List Shopify collections (custom and/or smart) via the Admin REST API.",
    inputSchema: {
      type: "object" as const,
      properties: {
        store:        { type: "string", description: "Shopify store domain." },
        access_token: { type: "string", description: "Shopify Admin API access token." },
        type:         { type: "string", enum: ["all", "custom", "smart"], default: "all", description: "Which collection type to fetch." },
        limit:        { type: "number", minimum: 1, maximum: 250, default: 50 },
        since_id:     { type: "string" },
        title:        { type: "string", description: "Filter by collection title." },
        fields:       { type: "string" },
      },
      required: ["store", "access_token"],
    },
  },
  {
    name: "shopify_shop",
    description: "Get store information for a Shopify shop: name, email, domain, currency, timezone, plan, and more.",
    inputSchema: {
      type: "object" as const,
      properties: {
        store:        { type: "string", description: "Shopify store domain." },
        access_token: { type: "string", description: "Shopify Admin API access token." },
      },
      required: ["store", "access_token"],
    },
  },
  {
    name: "shopify_fulfillments",
    description: "List or create fulfillments for a Shopify order via the Admin REST API.",
    inputSchema: {
      type: "object" as const,
      properties: {
        store:        { type: "string", description: "Shopify store domain." },
        access_token: { type: "string", description: "Shopify Admin API access token." },
        order_id:     { type: "string", description: "The order ID to list or create fulfillments for." },
        action:       { type: "string", enum: ["list", "create"], default: "list", description: "list: all fulfillments for the order. create: create a new fulfillment." },
        fulfillment:  { type: "object", description: "Fulfillment data for action='create'. Keys: location_id (required), tracking_number, tracking_company, tracking_url, notify_customer, line_items_by_fulfillment_order." },
        limit:        { type: "number", minimum: 1, maximum: 250, default: 50 },
        since_id:     { type: "string" },
        fields:       { type: "string" },
      },
      required: ["store", "access_token", "order_id"],
    },
  },
  // ── The Guardian ─────────────────────────────────────────────────────────────
  {
    name: "guardian_search",
    description: "Search The Guardian's full article archive by keyword. Returns headline, URL, date, section, and trail text. Requires a free Guardian API key.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key:   { type: "string", description: "Guardian API key. Get one free at https://open-platform.theguardian.com/access/" },
        query:     { type: "string", description: "Search query." },
        section:   { type: "string", description: "Filter by section slug, e.g. 'world', 'sport', 'technology'." },
        from_date: { type: "string", description: "Start date in YYYY-MM-DD format." },
        page_size: { type: "number", description: "Number of results to return (max 50, default 10).", default: 10 },
      },
      required: ["api_key", "query"],
    },
  },
  {
    name: "guardian_sections",
    description: "List all sections in The Guardian (e.g. world, sport, technology, culture). Use section IDs to filter guardian_search.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string", description: "Guardian API key." },
      },
      required: ["api_key"],
    },
  },
  {
    name: "guardian_article",
    description: "Fetch the full body text of a Guardian article by its path ID. Returns headline, byline, date, section, and complete HTML body.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string", description: "Guardian API key." },
        id:      { type: "string", description: "Article path ID from guardian_search, e.g. 'world/2024/jan/01/article-slug'." },
      },
      required: ["api_key", "id"],
    },
  },
  {
    name: "guardian_tags",
    description: "Search Guardian tags and topics by keyword. Returns tag IDs usable as section filters.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string", description: "Guardian API key." },
        query:   { type: "string", description: "Tag search query." },
      },
      required: ["api_key", "query"],
    },
  },
  // ── NewsAPI ───────────────────────────────────────────────────────────────────
  {
    name: "news_top_headlines",
    description: "Fetch top news headlines from 150,000+ sources worldwide. Filter by country, category, or keyword. Requires a NewsAPI key.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key:   { type: "string", description: "NewsAPI key. Get one free at https://newsapi.org/register" },
        country:   { type: "string", description: "2-letter ISO country code, e.g. 'us', 'gb', 'au'." },
        category:  { type: "string", enum: ["business", "entertainment", "general", "health", "science", "sports", "technology"], description: "News category." },
        query:     { type: "string", description: "Keywords to filter headlines." },
        page_size: { type: "number", description: "Number of results (max 100, default 20).", default: 20 },
      },
      required: ["api_key"],
    },
  },
  {
    name: "news_search",
    description: "Search across 150,000+ news sources and blogs for any topic. Returns full article metadata including title, source, URL, and publication date.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key:   { type: "string", description: "NewsAPI key." },
        query:     { type: "string", description: "Keywords to search for." },
        from_date: { type: "string", description: "Start date in ISO 8601 format, e.g. '2024-01-01'." },
        language:  { type: "string", description: "2-letter language code, e.g. 'en', 'fr', 'de'." },
        sort_by:   { type: "string", enum: ["relevancy", "popularity", "publishedAt"], default: "publishedAt", description: "Sort order." },
        page_size: { type: "number", description: "Number of results (max 100, default 20).", default: 20 },
      },
      required: ["api_key", "query"],
    },
  },
  {
    name: "news_sources",
    description: "List available news sources on NewsAPI. Filter by category, country, and language.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key:  { type: "string", description: "NewsAPI key." },
        category: { type: "string", description: "Filter by category." },
        country:  { type: "string", description: "Filter by 2-letter ISO country code." },
        language: { type: "string", description: "Filter by 2-letter language code." },
      },
      required: ["api_key"],
    },
  },
  // ── TMDB ─────────────────────────────────────────────────────────────────────
  {
    name: "tmdb_search_movies",
    description: "Search The Movie Database for movies by title. Returns title, release date, overview, rating, and poster. Requires a free TMDB API key.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string", description: "TMDB API key. Get one free at https://www.themoviedb.org/settings/api" },
        query:   { type: "string", description: "Movie title or keywords." },
        year:    { type: "number", description: "Filter by release year." },
      },
      required: ["api_key", "query"],
    },
  },
  {
    name: "tmdb_search_tv",
    description: "Search TMDB for TV shows by title. Returns name, first air date, overview, rating, and poster.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string", description: "TMDB API key." },
        query:   { type: "string", description: "TV show title or keywords." },
      },
      required: ["api_key", "query"],
    },
  },
  {
    name: "tmdb_movie",
    description: "Get full TMDB movie details including cast (top 10), runtime, budget, revenue, genres, and tagline.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string", description: "TMDB API key." },
        id:      { type: "string", description: "TMDB movie ID (from tmdb_search_movies)." },
      },
      required: ["api_key", "id"],
    },
  },
  {
    name: "tmdb_tv",
    description: "Get full TMDB TV show details including cast, seasons, episodes, and status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string", description: "TMDB API key." },
        id:      { type: "string", description: "TMDB TV show ID (from tmdb_search_tv)." },
      },
      required: ["api_key", "id"],
    },
  },
  {
    name: "tmdb_trending",
    description: "Get trending movies, TV shows, or both on TMDB for today or this week.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key:     { type: "string", description: "TMDB API key." },
        media_type:  { type: "string", enum: ["movie", "tv", "all"], default: "all", description: "Media type to fetch." },
        time_window: { type: "string", enum: ["day", "week"], default: "week", description: "Trending window: day or week." },
      },
      required: ["api_key"],
    },
  },
  {
    name: "tmdb_now_playing",
    description: "Get movies currently playing in theatres. Returns title, release date, overview, and rating.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string", description: "TMDB API key." },
      },
      required: ["api_key"],
    },
  },
  {
    name: "tmdb_upcoming",
    description: "Get upcoming movies releasing soon. Returns title, release date, overview, and rating.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string", description: "TMDB API key." },
      },
      required: ["api_key"],
    },
  },
  {
    name: "tmdb_popular_tv",
    description: "Get currently popular TV shows on TMDB. Returns name, first air date, overview, and rating.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string", description: "TMDB API key." },
      },
      required: ["api_key"],
    },
  },
  // ── NASA ──────────────────────────────────────────────────────────────────────
  {
    name: "nasa_apod",
    description: "Fetch NASA's Astronomy Picture of the Day with explanation text and image URL. Use DEMO_KEY for low-volume access or provide a NASA API key.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string", description: "NASA API key. Use 'DEMO_KEY' for limited free access or get a full key at https://api.nasa.gov/", default: "DEMO_KEY" },
        date:    { type: "string", description: "Date in YYYY-MM-DD format. Defaults to today." },
      },
    },
  },
  {
    name: "nasa_asteroids",
    description: "Get near-Earth objects (asteroids) for a date range. Returns hazard status, size estimates, and close approach distance.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key:    { type: "string", description: "NASA API key.", default: "DEMO_KEY" },
        start_date: { type: "string", description: "Start date in YYYY-MM-DD format." },
        end_date:   { type: "string", description: "End date in YYYY-MM-DD format (max 7-day window)." },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "nasa_mars_photos",
    description: "Browse Mars rover photos from Curiosity, Opportunity, Spirit, or Perseverance. Filter by sol (Martian day), Earth date, and camera.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key:    { type: "string", description: "NASA API key.", default: "DEMO_KEY" },
        rover:      { type: "string", enum: ["curiosity", "opportunity", "spirit", "perseverance"], default: "curiosity", description: "Rover name." },
        sol:        { type: "number", description: "Martian sol (day) number. Defaults to sol 1000 if neither sol nor earth_date is provided." },
        earth_date: { type: "string", description: "Earth date in YYYY-MM-DD format (alternative to sol)." },
        camera:     { type: "string", description: "Camera abbreviation, e.g. 'FHAZ', 'NAVCAM', 'MAST', 'CHEMCAM'." },
      },
      required: ["rover"],
    },
  },
  {
    name: "nasa_earth_imagery",
    description: "Retrieve NASA Landsat satellite imagery for any latitude/longitude coordinate and optional date.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string", description: "NASA API key.", default: "DEMO_KEY" },
        lat:     { type: "number", description: "Latitude in decimal degrees." },
        lon:     { type: "number", description: "Longitude in decimal degrees." },
        date:    { type: "string", description: "Date in YYYY-MM-DD format. Defaults to most recent available." },
      },
      required: ["lat", "lon"],
    },
  },
  {
    name: "nasa_epic",
    description: "Get NASA EPIC (Earth Polychromatic Imaging Camera) photos of Earth from the DSCOVR spacecraft. Returns image URLs and centroid coordinates.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string", description: "NASA API key.", default: "DEMO_KEY" },
        date:    { type: "string", description: "Date in YYYY-MM-DD format. Omit for the most recent available set." },
      },
    },
  },
  // ── OpenF1 ────────────────────────────────────────────────────────────────────
  {
    name: "f1_sessions",
    description: "List Formula 1 sessions (race, qualifying, practice) from the OpenF1 API. Filter by year, country, or session name. No API key required.",
    inputSchema: {
      type: "object" as const,
      properties: {
        year:         { type: "number", description: "Season year, e.g. 2024." },
        country:      { type: "string", description: "Country name, e.g. 'Monaco', 'Italy'." },
        session_name: { type: "string", description: "Session name, e.g. 'Race', 'Qualifying', 'Sprint'." },
      },
    },
  },
  {
    name: "f1_drivers",
    description: "Get driver information for an F1 session. Returns full name, team, country, and headshot URL.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_key: { type: "number", description: "Session key from f1_sessions." },
      },
    },
  },
  {
    name: "f1_positions",
    description: "Get real-time or historical position data for an F1 session. Returns driver position at each timestamp.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_key:   { type: "number", description: "Session key from f1_sessions." },
        driver_number: { type: "number", description: "Driver number to filter results." },
      },
      required: ["session_key"],
    },
  },
  {
    name: "f1_laps",
    description: "Get lap times and sector splits for an F1 session. Filter by driver and lap number.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_key:   { type: "number", description: "Session key from f1_sessions." },
        driver_number: { type: "number", description: "Driver number to filter results." },
        lap_number:    { type: "number", description: "Specific lap number." },
      },
      required: ["session_key"],
    },
  },
  {
    name: "f1_pit_stops",
    description: "Get pit stop data for an F1 session including lap number and pit stop duration.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_key:   { type: "number", description: "Session key from f1_sessions." },
        driver_number: { type: "number", description: "Driver number to filter results." },
      },
      required: ["session_key"],
    },
  },
  {
    name: "f1_car_data",
    description: "Get car telemetry data for an F1 session: speed, throttle, brake, DRS status, gear, and RPM.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_key:   { type: "number", description: "Session key from f1_sessions." },
        driver_number: { type: "number", description: "Driver number to filter results. Strongly recommended to avoid huge payloads." },
      },
      required: ["session_key"],
    },
  },
  {
    name: "f1_team_radio",
    description: "Get team radio messages for an F1 session. Returns timestamps and audio recording URLs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_key:   { type: "number", description: "Session key from f1_sessions." },
        driver_number: { type: "number", description: "Driver number to filter results." },
      },
      required: ["session_key"],
    },
  },
  {
    name: "f1_weather",
    description: "Get track weather conditions during an F1 session: air temperature, track temperature, humidity, wind, and rainfall.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_key: { type: "number", description: "Session key from f1_sessions." },
      },
      required: ["session_key"],
    },
  },
  // ── Fantasy Premier League ────────────────────────────────────────────────────
  {
    name: "fpl_bootstrap",
    description: "Fetch the full FPL static data: all players, teams, gameweek schedule, and top 20 scorers. No API key required.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "fpl_player",
    description: "Get detailed stats and upcoming fixtures for an FPL player by their element ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Player element ID from fpl_bootstrap." },
      },
      required: ["id"],
    },
  },
  {
    name: "fpl_gameweek",
    description: "Get live scores for all players in a specific FPL gameweek.",
    inputSchema: {
      type: "object" as const,
      properties: {
        gw: { type: "number", description: "Gameweek number (1-38)." },
      },
      required: ["gw"],
    },
  },
  {
    name: "fpl_fixtures",
    description: "Get FPL match fixtures for a specific gameweek or all remaining fixtures.",
    inputSchema: {
      type: "object" as const,
      properties: {
        gw: { type: "number", description: "Gameweek number. Omit to get all fixtures." },
      },
    },
  },
  {
    name: "fpl_my_team",
    description: "Get a manager's team picks for a specific FPL gameweek (public data).",
    inputSchema: {
      type: "object" as const,
      properties: {
        team_id: { type: "string", description: "FPL manager team ID." },
        gw:      { type: "number", description: "Gameweek number." },
      },
      required: ["team_id", "gw"],
    },
  },
  {
    name: "fpl_manager",
    description: "Get an FPL manager's profile: overall rank, total points, team value, and history.",
    inputSchema: {
      type: "object" as const,
      properties: {
        team_id: { type: "string", description: "FPL manager team ID." },
      },
      required: ["team_id"],
    },
  },
  {
    name: "fpl_leagues_classic",
    description: "Get standings for a classic FPL league by league ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        league_id: { type: "string", description: "FPL classic league ID." },
        page:      { type: "number", description: "Page number for standings (default 1).", default: 1 },
      },
      required: ["league_id"],
    },
  },
  // ── Chess.com ─────────────────────────────────────────────────────────────────
  {
    name: "chess_player",
    description: "Get a Chess.com player's public profile: title, country, followers, join date. No API key required.",
    inputSchema: {
      type: "object" as const,
      properties: {
        username: { type: "string", description: "Chess.com username." },
      },
      required: ["username"],
    },
  },
  {
    name: "chess_player_stats",
    description: "Get a Chess.com player's ratings across game types: rapid, blitz, bullet, and daily.",
    inputSchema: {
      type: "object" as const,
      properties: {
        username: { type: "string", description: "Chess.com username." },
      },
      required: ["username"],
    },
  },
  {
    name: "chess_player_games",
    description: "Get a Chess.com player's games for a specific month. Returns last 20 games with result, rating, and time control.",
    inputSchema: {
      type: "object" as const,
      properties: {
        username: { type: "string", description: "Chess.com username." },
        year:     { type: "number", description: "Year (e.g. 2024)." },
        month:    { type: "number", description: "Month (1-12)." },
      },
      required: ["username", "year", "month"],
    },
  },
  {
    name: "chess_puzzles_random",
    description: "Get a random Chess.com chess puzzle. Returns FEN position, PGN, and puzzle URL.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "chess_leaderboards",
    description: "Get Chess.com global leaderboards. Returns top players for rapid, blitz, bullet, and daily by default. Pass game_type for a full leaderboard.",
    inputSchema: {
      type: "object" as const,
      properties: {
        game_type: {
          type: "string",
          enum: [
            "live_rapid", "live_blitz", "live_bullet", "live_bughouse",
            "live_blitz960", "live_threecheck", "live_crazyhouse",
            "live_kingofthehill", "tactics", "lessons", "puzzle_rush",
            "daily", "daily960",
          ],
          description: "Game type for full leaderboard. Omit to get top 5 for major formats.",
        },
      },
    },
  },
  // ── Lichess ───────────────────────────────────────────────────────────────────
  {
    name: "lichess_user",
    description: "Get a Lichess user's profile: ratings by variant, game count, play time, and online status. No API key required.",
    inputSchema: {
      type: "object" as const,
      properties: {
        username: { type: "string", description: "Lichess username." },
      },
      required: ["username"],
    },
  },
  {
    name: "lichess_user_games",
    description: "Get recent games for a Lichess user. Returns result, rating, speed, opening, and players.",
    inputSchema: {
      type: "object" as const,
      properties: {
        username: { type: "string", description: "Lichess username." },
        max:      { type: "number", description: "Number of games to return (max 50, default 10).", default: 10 },
      },
      required: ["username"],
    },
  },
  {
    name: "lichess_puzzle_daily",
    description: "Get today's Lichess daily puzzle. Returns FEN, solution moves, themes, rating, and a link.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "lichess_top_players",
    description: "Get the top 10 Lichess players for a chess variant (bullet, blitz, rapid, etc.).",
    inputSchema: {
      type: "object" as const,
      properties: {
        perfType: {
          type: "string",
          enum: [
            "ultraBullet", "bullet", "blitz", "rapid", "classical",
            "chess960", "crazyhouse", "antichess", "atomic", "horde",
            "kingOfTheHill", "racingKings", "threeCheck",
          ],
          default: "bullet",
          description: "Chess variant / time control.",
        },
      },
    },
  },
  {
    name: "lichess_tournament",
    description: "Get details for a Lichess tournament by ID: name, status, player count, and podium.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Lichess tournament ID." },
      },
      required: ["id"],
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

  // ── Telegram handlers ─────────────────────────────────────────────────────

  telegram_send:        async (_c, a) => telegramSend(a),
  telegram_read:        async (_c, a) => telegramRead(a),
  telegram_search:      async (_c, a) => telegramSearch(a),
  telegram_send_media:  async (_c, a) => telegramSendMedia(a),
  telegram_get_updates: async (_c, a) => telegramGetUpdates(a),
  telegram_manage_chat: async (_c, a) => telegramManageChat(a),

  // ── Slack handler ─────────────────────────────────────────────────────────

  slack: async (_c, a) => {
    const action = String(a.action ?? "").trim();
    if (!action) return { error: "action is required." };
    return slackAction(action, a);
  },

  // ── Discord handlers ──────────────────────────────────────────────────────

  discord_send:     async (_c, a) => discordSend(a),
  discord_read:     async (_c, a) => discordRead(a),
  discord_thread:   async (_c, a) => discordThread(a),
  discord_react:    async (_c, a) => discordReact(a),
  discord_channels: async (_c, a) => discordChannels(a),
  discord_members:  async (_c, a) => discordMembers(a),
  discord_search:   async (_c, a) => discordSearch(a),

  // ── Reddit handlers ───────────────────────────────────────────────────────

  reddit_read: async (_c, a) =>
    redditRead({
      access_token: String(a.access_token ?? ""),
      subreddit:    String(a.subreddit ?? ""),
      sort:         a.sort  ? String(a.sort)  : undefined,
      limit:        a.limit ? Number(a.limit) : undefined,
      after:        a.after ? String(a.after) : undefined,
      t:            a.t     ? String(a.t)     : undefined,
    }),

  reddit_post: async (_c, a) =>
    redditPost({
      access_token: String(a.access_token ?? ""),
      subreddit:    String(a.subreddit ?? ""),
      title:        String(a.title ?? ""),
      kind:         String(a.kind ?? "self"),
      text:         a.text       ? String(a.text)       : undefined,
      url:          a.url        ? String(a.url)        : undefined,
      nsfw:         a.nsfw === true,
      spoiler:      a.spoiler === true,
      flair_id:     a.flair_id   ? String(a.flair_id)   : undefined,
      flair_text:   a.flair_text ? String(a.flair_text) : undefined,
    }),

  reddit_comment: async (_c, a) =>
    redditComment({
      access_token: String(a.access_token ?? ""),
      parent_id:    String(a.parent_id ?? ""),
      text:         String(a.text ?? ""),
    }),

  reddit_search: async (_c, a) =>
    redditSearch({
      access_token: String(a.access_token ?? ""),
      query:        String(a.query ?? ""),
      subreddit:    a.subreddit ? String(a.subreddit) : undefined,
      sort:         a.sort      ? String(a.sort)      : undefined,
      t:            a.t         ? String(a.t)         : undefined,
      limit:        a.limit     ? Number(a.limit)     : undefined,
      after:        a.after     ? String(a.after)     : undefined,
    }),

  reddit_user: async (_c, a) =>
    redditUser({
      access_token:     String(a.access_token ?? ""),
      username:         String(a.username ?? ""),
      include_posts:    a.include_posts !== false,
      include_comments: a.include_comments !== false,
      limit:            a.limit ? Number(a.limit) : undefined,
    }),

  reddit_vote: async (_c, a) =>
    redditVote({
      access_token: String(a.access_token ?? ""),
      id:           String(a.id ?? ""),
      dir:          Number(a.dir ?? 0),
    }),

  reddit_subscribe: async (_c, a) =>
    redditSubscribe({
      access_token: String(a.access_token ?? ""),
      subreddit:    String(a.subreddit ?? ""),
      action:       String(a.action ?? "sub"),
    }),

  // ── Bluesky handler ───────────────────────────────────────────────────────

  bluesky: async (_c, a) => {
    const action = String(a.action ?? "").trim();
    if (!action) return { error: "action is required." };
    return blueskyAction(action, a);
  },

  // ── Mastodon handlers ─────────────────────────────────────────────────────

  mastodon_post:          async (_c, a) => mastodonAction("mastodon_post", a),
  mastodon_read_timeline: async (_c, a) => mastodonAction("mastodon_read_timeline", a),
  mastodon_reply:         async (_c, a) => mastodonAction("mastodon_reply", a),
  mastodon_boost:         async (_c, a) => mastodonAction("mastodon_boost", a),
  mastodon_favorite:      async (_c, a) => mastodonAction("mastodon_favorite", a),
  mastodon_search:        async (_c, a) => mastodonAction("mastodon_search", a),
  mastodon_profile:       async (_c, a) => mastodonAction("mastodon_profile", a),
  mastodon_follow:        async (_c, a) => mastodonAction("mastodon_follow", a),
  mastodon_notifications: async (_c, a) => mastodonAction("mastodon_notifications", a),

  // ── Amazon handlers ───────────────────────────────────────────────────────

  amazon_search:     async (_c, a) => amazonSearch(a),
  amazon_product:    async (_c, a) => amazonProduct(a),
  amazon_browse:     async (_c, a) => amazonBrowse(a),
  amazon_variations: async (_c, a) => amazonVariations(a),

  // ── Xero handlers ─────────────────────────────────────────────────────────

  xero_invoices:          async (_c, a) => xeroInvoices(a),
  xero_contacts:          async (_c, a) => xeroContacts(a),
  xero_accounts:          async (_c, a) => xeroAccounts(a),
  xero_payments:          async (_c, a) => xeroPayments(a),
  xero_bank_transactions: async (_c, a) => xeroBankTransactions(a),
  xero_reports:           async (_c, a) => xeroReports(a),
  xero_quotes:            async (_c, a) => xeroQuotes(a),
  xero_organisation:      async (_c, a) => xeroOrganisation(a),

  // ── Shopify handlers ──────────────────────────────────────────────────────

  shopify_products:     async (_c, a) => shopifyProducts(a),
  shopify_orders:       async (_c, a) => shopifyOrders(a),
  shopify_customers:    async (_c, a) => shopifyCustomers(a),
  shopify_inventory:    async (_c, a) => shopifyInventory(a),
  shopify_collections:  async (_c, a) => shopifyCollections(a),
  shopify_shop:         async (_c, a) => shopifyShop(a),
  shopify_fulfillments: async (_c, a) => shopifyFulfillments(a),

  // ── Guardian handlers ─────────────────────────────────────────────────────

  guardian_search:   async (_c, a) => guardianSearch(a),
  guardian_sections: async (_c, a) => guardianSections(a),
  guardian_article:  async (_c, a) => guardianArticle(a),
  guardian_tags:     async (_c, a) => guardianTags(a),

  // ── NewsAPI handlers ──────────────────────────────────────────────────────

  news_top_headlines: async (_c, a) => newsTopHeadlines(a),
  news_search:        async (_c, a) => newsSearch(a),
  news_sources:       async (_c, a) => newsSources(a),

  // ── TMDB handlers ─────────────────────────────────────────────────────────

  tmdb_search_movies: async (_c, a) => tmdbSearchMovies(a),
  tmdb_search_tv:     async (_c, a) => tmdbSearchTv(a),
  tmdb_movie:         async (_c, a) => tmdbMovie(a),
  tmdb_tv:            async (_c, a) => tmdbTv(a),
  tmdb_trending:      async (_c, a) => tmdbTrending(a),
  tmdb_now_playing:   async (_c, a) => tmdbNowPlaying(a),
  tmdb_upcoming:      async (_c, a) => tmdbUpcoming(a),
  tmdb_popular_tv:    async (_c, a) => tmdbPopularTv(a),

  // ── NASA handlers ─────────────────────────────────────────────────────────

  nasa_apod:            async (_c, a) => nasaApod(a),
  nasa_asteroids:       async (_c, a) => nasaAsteroids(a),
  nasa_mars_photos:     async (_c, a) => nasaMarsPhotos(a),
  nasa_earth_imagery:   async (_c, a) => nasaEarthImagery(a),
  nasa_epic:            async (_c, a) => nasaEpic(a),

  // ── OpenF1 handlers ───────────────────────────────────────────────────────

  f1_sessions:   async (_c, a) => f1Sessions(a),
  f1_drivers:    async (_c, a) => f1Drivers(a),
  f1_positions:  async (_c, a) => f1Positions(a),
  f1_laps:       async (_c, a) => f1Laps(a),
  f1_pit_stops:  async (_c, a) => f1PitStops(a),
  f1_car_data:   async (_c, a) => f1CarData(a),
  f1_team_radio: async (_c, a) => f1TeamRadio(a),
  f1_weather:    async (_c, a) => f1Weather(a),

  // ── Fantasy Premier League handlers ───────────────────────────────────────

  fpl_bootstrap:       async (_c, a) => fplBootstrap(a),
  fpl_player:          async (_c, a) => fplPlayer(a),
  fpl_gameweek:        async (_c, a) => fplGameweek(a),
  fpl_fixtures:        async (_c, a) => fplFixtures(a),
  fpl_my_team:         async (_c, a) => fplMyTeam(a),
  fpl_manager:         async (_c, a) => fplManager(a),
  fpl_leagues_classic: async (_c, a) => fplLeaguesClassic(a),

  // ── Chess.com handlers ────────────────────────────────────────────────────

  chess_player:         async (_c, a) => chessPlayer(a),
  chess_player_stats:   async (_c, a) => chessPlayerStats(a),
  chess_player_games:   async (_c, a) => chessPlayerGames(a),
  chess_puzzles_random: async (_c, a) => chessPuzzlesRandom(a),
  chess_leaderboards:   async (_c, a) => chessLeaderboards(a),

  // ── Lichess handlers ──────────────────────────────────────────────────────

  lichess_user:          async (_c, a) => lichessUser(a),
  lichess_user_games:    async (_c, a) => lichessUserGames(a),
  lichess_puzzle_daily:  async (_c, a) => lichessPuzzleDaily(a),
  lichess_top_players:   async (_c, a) => lichessTopPlayers(a),
  lichess_tournament:    async (_c, a) => lichessTournament(a),
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

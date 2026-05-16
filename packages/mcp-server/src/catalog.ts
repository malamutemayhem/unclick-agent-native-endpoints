export interface EndpointDef {
  id: string;
  name: string;
  description: string;
  method: "GET" | "POST" | "DELETE" | "PATCH";
  path: string;
  requiresAuth: boolean;
  /** JSON Schema for request body parameters */
  inputSchema: Record<string, unknown>;
}

export interface ToolDef {
  slug: string;
  name: string;
  description: string;
  category: string;
  scope: string;
  endpoints: EndpointDef[];
}

export const CATEGORIES = [
  "text",
  "data",
  "media",
  "time",
  "network",
  "generation",
  "storage",
  "platform",
] as const;

export const CATALOG: ToolDef[] = [
  // ─── TEXT ──────────────────────────────────────────────────────────
  {
    slug: "transform",
    name: "Text Transform",
    description:
      "Transform text: change case (upper/lower/title/camel/snake/kebab/pascal), slugify, truncate, word/char count, strip HTML, reverse.",
    category: "text",
    scope: "transform:use",
    endpoints: [
      {
        id: "transform.case",
        name: "Change Case",
        description:
          "Convert text to upper, lower, title, sentence, camelCase, snake_case, kebab-case, or PascalCase.",
        method: "POST",
        path: "/v1/transform/case",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: "Input text" },
            to: {
              type: "string",
              enum: [
                "upper",
                "lower",
                "title",
                "sentence",
                "camel",
                "snake",
                "kebab",
                "pascal",
              ],
              description: "Target case format",
            },
          },
          required: ["text", "to"],
        },
      },
      {
        id: "transform.slug",
        name: "Slugify",
        description: "Convert text to a URL-friendly slug.",
        method: "POST",
        path: "/v1/transform/slug",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
        },
      },
      {
        id: "transform.truncate",
        name: "Truncate",
        description: "Truncate text to a maximum length with optional ellipsis.",
        method: "POST",
        path: "/v1/transform/truncate",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string" },
            length: { type: "number", description: "Max character length" },
            ellipsis: {
              type: "boolean",
              description: "Append '...' if truncated",
              default: true,
            },
          },
          required: ["text", "length"],
        },
      },
      {
        id: "transform.count",
        name: "Word & Character Count",
        description:
          "Count words, characters, sentences, paragraphs, and estimate reading time.",
        method: "POST",
        path: "/v1/transform/count",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string" },
            words_per_minute: {
              type: "number",
              default: 200,
              description: "Reading speed for time estimate",
            },
          },
          required: ["text"],
        },
      },
      {
        id: "transform.strip",
        name: "Strip HTML",
        description: "Strip HTML tags and decode entities to plain text.",
        method: "POST",
        path: "/v1/transform/strip",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
        },
      },
      {
        id: "transform.reverse",
        name: "Reverse",
        description: "Reverse a string (Unicode-safe).",
        method: "POST",
        path: "/v1/transform/reverse",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
        },
      },
    ],
  },
  {
    slug: "encode",
    name: "Encode / Decode",
    description:
      "Encode and decode text: Base64, URL encoding, HTML entities, hex.",
    category: "text",
    scope: "encode:use",
    endpoints: [
      {
        id: "encode.base64",
        name: "Base64 Encode",
        description: "Encode text to Base64.",
        method: "POST",
        path: "/v1/encode/base64",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
        },
      },
      {
        id: "decode.base64",
        name: "Base64 Decode",
        description: "Decode Base64 back to text.",
        method: "POST",
        path: "/v1/decode/base64",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
        },
      },
      {
        id: "encode.url",
        name: "URL Encode",
        description: "URL-encode text (encodeURIComponent).",
        method: "POST",
        path: "/v1/encode/url",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
        },
      },
      {
        id: "decode.url",
        name: "URL Decode",
        description: "URL-decode text (decodeURIComponent).",
        method: "POST",
        path: "/v1/decode/url",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
        },
      },
      {
        id: "encode.html",
        name: "HTML Encode",
        description: "Escape HTML special characters (<, >, &, quotes).",
        method: "POST",
        path: "/v1/encode/html",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
        },
      },
      {
        id: "decode.html",
        name: "HTML Decode",
        description: "Decode HTML entities back to characters.",
        method: "POST",
        path: "/v1/decode/html",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
        },
      },
      {
        id: "encode.hex",
        name: "Hex Encode",
        description: "Encode text to hex representation.",
        method: "POST",
        path: "/v1/encode/hex",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
        },
      },
      {
        id: "decode.hex",
        name: "Hex Decode",
        description: "Decode hex back to text.",
        method: "POST",
        path: "/v1/decode/hex",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
        },
      },
    ],
  },
  {
    slug: "hash",
    name: "Hash & HMAC",
    description:
      "Compute cryptographic hashes (MD5, SHA1, SHA256, SHA512), verify hashes, compute HMAC signatures.",
    category: "text",
    scope: "hash:use",
    endpoints: [
      {
        id: "hash.compute",
        name: "Hash",
        description: "Compute a hash of text using the specified algorithm.",
        method: "POST",
        path: "/v1/hash",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string" },
            algorithm: {
              type: "string",
              enum: ["md5", "sha1", "sha256", "sha512"],
            },
          },
          required: ["text", "algorithm"],
        },
      },
      {
        id: "hash.verify",
        name: "Verify Hash",
        description: "Verify that text matches a hash (constant-time comparison).",
        method: "POST",
        path: "/v1/hash/verify",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string" },
            hash: { type: "string" },
            algorithm: {
              type: "string",
              enum: ["md5", "sha1", "sha256", "sha512"],
            },
          },
          required: ["text", "hash", "algorithm"],
        },
      },
      {
        id: "hash.hmac",
        name: "HMAC",
        description: "Compute an HMAC signature.",
        method: "POST",
        path: "/v1/hash/hmac",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string" },
            key: { type: "string" },
            algorithm: {
              type: "string",
              enum: ["md5", "sha1", "sha256", "sha512"],
            },
          },
          required: ["text", "key", "algorithm"],
        },
      },
    ],
  },
  {
    slug: "regex",
    name: "Regex",
    description:
      "Test, extract, replace, split, and validate regular expressions against text.",
    category: "text",
    scope: "regex:use",
    endpoints: [
      {
        id: "regex.test",
        name: "Test / Match",
        description:
          "Find all matches with capture groups and indices.",
        method: "POST",
        path: "/v1/regex/test",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            pattern: { type: "string", description: "Regex pattern (without slashes)" },
            flags: { type: "string", description: "Regex flags, e.g. 'gi'", default: "" },
            input: { type: "string" },
          },
          required: ["pattern", "input"],
        },
      },
      {
        id: "regex.replace",
        name: "Replace",
        description: "Replace matches using backreferences ($1, $2).",
        method: "POST",
        path: "/v1/regex/replace",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            pattern: { type: "string" },
            flags: { type: "string", default: "" },
            input: { type: "string" },
            replacement: { type: "string" },
            global: { type: "boolean", default: true },
          },
          required: ["pattern", "input", "replacement"],
        },
      },
      {
        id: "regex.extract",
        name: "Extract",
        description: "Extract all matches as a flat array of strings.",
        method: "POST",
        path: "/v1/regex/extract",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            pattern: { type: "string" },
            flags: { type: "string", default: "" },
            input: { type: "string" },
          },
          required: ["pattern", "input"],
        },
      },
      {
        id: "regex.split",
        name: "Split",
        description: "Split a string by a regex delimiter.",
        method: "POST",
        path: "/v1/regex/split",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            pattern: { type: "string" },
            flags: { type: "string", default: "" },
            input: { type: "string" },
            limit: { type: "number" },
          },
          required: ["pattern", "input"],
        },
      },
      {
        id: "regex.validate",
        name: "Validate Pattern",
        description: "Check if a regex pattern is valid syntax.",
        method: "POST",
        path: "/v1/regex/validate",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            pattern: { type: "string" },
            flags: { type: "string", default: "" },
          },
          required: ["pattern"],
        },
      },
    ],
  },
  {
    slug: "markdown",
    name: "Markdown",
    description:
      "Convert Markdown to HTML or plain text, extract table of contents, lint for issues.",
    category: "text",
    scope: "markdown:use",
    endpoints: [
      {
        id: "markdown.to-html",
        name: "To HTML",
        description: "Convert Markdown to HTML.",
        method: "POST",
        path: "/v1/markdown/to-html",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { markdown: { type: "string" } },
          required: ["markdown"],
        },
      },
      {
        id: "markdown.to-text",
        name: "To Plain Text",
        description: "Strip Markdown formatting and return plain text.",
        method: "POST",
        path: "/v1/markdown/to-text",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { markdown: { type: "string" } },
          required: ["markdown"],
        },
      },
      {
        id: "markdown.toc",
        name: "Table of Contents",
        description: "Extract heading hierarchy as a table of contents.",
        method: "POST",
        path: "/v1/markdown/toc",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { markdown: { type: "string" } },
          required: ["markdown"],
        },
      },
      {
        id: "markdown.lint",
        name: "Lint",
        description: "Check Markdown for common issues (unclosed code blocks, broken links, etc.).",
        method: "POST",
        path: "/v1/markdown/lint",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { markdown: { type: "string" } },
          required: ["markdown"],
        },
      },
    ],
  },
  {
    slug: "diff",
    name: "Text Diff",
    description:
      "Compare two texts and produce unified diffs, line-by-line diffs, word diffs, or apply patches.",
    category: "text",
    scope: "diff:use",
    endpoints: [
      {
        id: "diff.text",
        name: "Unified Diff",
        description: "Generate a unified diff (patch) between two strings.",
        method: "POST",
        path: "/v1/diff/text",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            a: { type: "string", description: "Original text" },
            b: { type: "string", description: "New text" },
            filename_a: { type: "string" },
            filename_b: { type: "string" },
          },
          required: ["a", "b"],
        },
      },
      {
        id: "diff.lines",
        name: "Line-by-Line Diff",
        description: "Structured line-by-line diff with added/removed/unchanged markers.",
        method: "POST",
        path: "/v1/diff/lines",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            a: { type: "string" },
            b: { type: "string" },
          },
          required: ["a", "b"],
        },
      },
      {
        id: "diff.words",
        name: "Word Diff",
        description: "Word-level diff showing exactly which words changed.",
        method: "POST",
        path: "/v1/diff/words",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            a: { type: "string" },
            b: { type: "string" },
          },
          required: ["a", "b"],
        },
      },
      {
        id: "diff.patch",
        name: "Apply Patch",
        description: "Apply a unified diff patch to original text.",
        method: "POST",
        path: "/v1/diff/patch",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            original: { type: "string" },
            patch: { type: "string" },
          },
          required: ["original", "patch"],
        },
      },
    ],
  },

  // ─── DATA ──────────────────────────────────────────────────────────
  {
    slug: "json",
    name: "JSON Utilities",
    description:
      "Format, minify, query, flatten, unflatten, diff, merge, and generate JSON Schema.",
    category: "data",
    scope: "json:use",
    endpoints: [
      {
        id: "json.format",
        name: "Format / Pretty-Print",
        description: "Pretty-print JSON with configurable indentation.",
        method: "POST",
        path: "/v1/json/format",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            json: { type: "string", description: "JSON string to format" },
            indent: {
              description: "Indentation: 2, 4, or 'tab'",
              oneOf: [{ type: "number" }, { type: "string", enum: ["tab"] }],
              default: 2,
            },
          },
          required: ["json"],
        },
      },
      {
        id: "json.minify",
        name: "Minify",
        description: "Strip all whitespace from JSON.",
        method: "POST",
        path: "/v1/json/minify",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { json: { type: "string" } },
          required: ["json"],
        },
      },
      {
        id: "json.query",
        name: "Query (JSONPath)",
        description: "Query JSON using dot-notation or JSONPath expressions.",
        method: "POST",
        path: "/v1/json/query",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            json: { type: "string" },
            query: {
              type: "string",
              description: "e.g. 'user.name' or '$.users[0].email'",
            },
          },
          required: ["json", "query"],
        },
      },
      {
        id: "json.flatten",
        name: "Flatten",
        description: "Flatten nested JSON to dot-notation keys.",
        method: "POST",
        path: "/v1/json/flatten",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            json: { type: "string" },
            delimiter: { type: "string", default: "." },
          },
          required: ["json"],
        },
      },
      {
        id: "json.unflatten",
        name: "Unflatten",
        description: "Expand dot-notation keys back to nested JSON.",
        method: "POST",
        path: "/v1/json/unflatten",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            json: { type: "string" },
            delimiter: { type: "string", default: "." },
          },
          required: ["json"],
        },
      },
      {
        id: "json.diff",
        name: "JSON Diff",
        description: "Compare two JSON objects and show added, removed, and changed paths.",
        method: "POST",
        path: "/v1/json/diff",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            a: { type: "string", description: "First JSON string" },
            b: { type: "string", description: "Second JSON string" },
          },
          required: ["a", "b"],
        },
      },
      {
        id: "json.merge",
        name: "Deep Merge",
        description: "Deep-merge 2-10 JSON objects.",
        method: "POST",
        path: "/v1/json/merge",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            objects: {
              type: "array",
              items: { type: "string" },
              minItems: 2,
              maxItems: 10,
              description: "Array of JSON strings to merge",
            },
          },
          required: ["objects"],
        },
      },
      {
        id: "json.schema",
        name: "Generate Schema",
        description: "Infer a JSON Schema from a sample JSON value.",
        method: "POST",
        path: "/v1/json/schema",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { json: { type: "string", description: "Sample JSON" } },
          required: ["json"],
        },
      },
    ],
  },
  {
    slug: "csv",
    name: "CSV Processing",
    description:
      "Parse, generate, query, sort, inspect columns, and compute statistics on CSV data.",
    category: "data",
    scope: "csv:use",
    endpoints: [
      {
        id: "csv.parse",
        name: "Parse",
        description: "Parse a CSV string into a JSON array of rows.",
        method: "POST",
        path: "/v1/csv/parse",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            csv: { type: "string" },
            header: { type: "boolean", default: true, description: "First row is header" },
            delimiter: { type: "string", default: "," },
          },
          required: ["csv"],
        },
      },
      {
        id: "csv.generate",
        name: "Generate",
        description: "Convert a JSON array of objects to CSV.",
        method: "POST",
        path: "/v1/csv/generate",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            data: { type: "array", items: { type: "object" } },
            delimiter: { type: "string", default: "," },
          },
          required: ["data"],
        },
      },
      {
        id: "csv.query",
        name: "Query / Filter",
        description: "Filter CSV rows by conditions (equals, contains, gt, lt).",
        method: "POST",
        path: "/v1/csv/query",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            csv: { type: "string" },
            conditions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  column: { type: "string" },
                  operator: {
                    type: "string",
                    enum: ["equals", "contains", "gt", "lt"],
                  },
                  value: { type: "string" },
                },
                required: ["column", "operator", "value"],
              },
            },
          },
          required: ["csv", "conditions"],
        },
      },
      {
        id: "csv.sort",
        name: "Sort",
        description: "Sort CSV rows by one or more columns.",
        method: "POST",
        path: "/v1/csv/sort",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            csv: { type: "string" },
            columns: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  column: { type: "string" },
                  direction: { type: "string", enum: ["asc", "desc"] },
                },
                required: ["column", "direction"],
              },
            },
          },
          required: ["csv", "columns"],
        },
      },
      {
        id: "csv.columns",
        name: "Inspect Columns",
        description: "List column names and inferred data types.",
        method: "POST",
        path: "/v1/csv/columns",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { csv: { type: "string" } },
          required: ["csv"],
        },
      },
      {
        id: "csv.stats",
        name: "Statistics",
        description: "Compute min, max, mean, sum for numeric columns.",
        method: "POST",
        path: "/v1/csv/stats",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { csv: { type: "string" } },
          required: ["csv"],
        },
      },
    ],
  },
  {
    slug: "validate",
    name: "Input Validation",
    description:
      "Validate emails, URLs, phone numbers, JSON, credit cards, IP addresses, and color values.",
    category: "data",
    scope: "validate:use",
    endpoints: [
      {
        id: "validate.email",
        name: "Validate Email",
        description: "Check if an email address is syntactically valid.",
        method: "POST",
        path: "/v1/validate/email",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { email: { type: "string" } },
          required: ["email"],
        },
      },
      {
        id: "validate.url",
        name: "Validate URL",
        description: "Check if a URL is valid, optionally test if it's reachable.",
        method: "POST",
        path: "/v1/validate/url",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string" },
            check_reachable: {
              type: "boolean",
              default: false,
              description: "Also perform a live reachability check",
            },
          },
          required: ["url"],
        },
      },
      {
        id: "validate.phone",
        name: "Validate Phone",
        description: "Basic phone number format validation.",
        method: "POST",
        path: "/v1/validate/phone",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { phone: { type: "string" } },
          required: ["phone"],
        },
      },
      {
        id: "validate.json",
        name: "Validate JSON",
        description: "Check if a string is valid JSON and report its type.",
        method: "POST",
        path: "/v1/validate/json",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { json: { type: "string" } },
          required: ["json"],
        },
      },
      {
        id: "validate.credit-card",
        name: "Validate Credit Card",
        description: "Validate a credit card number using the Luhn algorithm.",
        method: "POST",
        path: "/v1/validate/credit-card",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            number: { type: "string", description: "Card number (digits only or formatted)" },
          },
          required: ["number"],
        },
      },
      {
        id: "validate.ip",
        name: "Validate IP",
        description: "Validate an IPv4 or IPv6 address.",
        method: "POST",
        path: "/v1/validate/ip",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { ip: { type: "string" } },
          required: ["ip"],
        },
      },
      {
        id: "validate.color",
        name: "Validate Color",
        description: "Validate a CSS color value (hex, rgb, rgba, hsl).",
        method: "POST",
        path: "/v1/validate/color",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { color: { type: "string" } },
          required: ["color"],
        },
      },
    ],
  },

  // ─── MEDIA ─────────────────────────────────────────────────────────
  {
    slug: "image",
    name: "Image Processing",
    description:
      "Resize, convert format, compress, crop, rotate, grayscale images. Input/output as base64.",
    category: "media",
    scope: "image:use",
    endpoints: [
      {
        id: "image.resize",
        name: "Resize",
        description: "Resize an image to specified dimensions.",
        method: "POST",
        path: "/v1/image/resize",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            image: { type: "string", description: "Base64-encoded image" },
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
        id: "image.convert",
        name: "Convert Format",
        description: "Convert image to JPEG, PNG, WebP, or AVIF.",
        method: "POST",
        path: "/v1/image/convert",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            image: { type: "string" },
            format: { type: "string", enum: ["jpeg", "png", "webp", "avif"] },
            quality: { type: "number", minimum: 1, maximum: 100, default: 80 },
          },
          required: ["image", "format"],
        },
      },
      {
        id: "image.compress",
        name: "Compress",
        description: "Compress an image at a given quality level.",
        method: "POST",
        path: "/v1/image/compress",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            image: { type: "string" },
            quality: { type: "number", minimum: 1, maximum: 100, default: 75 },
          },
          required: ["image"],
        },
      },
      {
        id: "image.metadata",
        name: "Metadata",
        description: "Extract image dimensions, format, color space, and other metadata.",
        method: "POST",
        path: "/v1/image/metadata",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { image: { type: "string" } },
          required: ["image"],
        },
      },
      {
        id: "image.crop",
        name: "Crop",
        description: "Crop an image to specified region.",
        method: "POST",
        path: "/v1/image/crop",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            image: { type: "string" },
            x: { type: "number" },
            y: { type: "number" },
            width: { type: "number" },
            height: { type: "number" },
          },
          required: ["image", "x", "y", "width", "height"],
        },
      },
      {
        id: "image.rotate",
        name: "Rotate",
        description: "Rotate an image by degrees.",
        method: "POST",
        path: "/v1/image/rotate",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            image: { type: "string" },
            degrees: { type: "number", minimum: -360, maximum: 360 },
          },
          required: ["image", "degrees"],
        },
      },
      {
        id: "image.grayscale",
        name: "Grayscale",
        description: "Convert an image to grayscale.",
        method: "POST",
        path: "/v1/image/grayscale",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { image: { type: "string" } },
          required: ["image"],
        },
      },
    ],
  },
  {
    slug: "qr",
    name: "QR Code",
    description: "Generate QR codes as PNG or SVG from any text or URL.",
    category: "media",
    scope: "qr:write",
    endpoints: [
      {
        id: "qr.generate",
        name: "Generate QR Code",
        description: "Generate a QR code image (PNG or SVG) from text or a URL.",
        method: "POST",
        path: "/v1/qr",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: "Content to encode in the QR code" },
            format: { type: "string", enum: ["png", "svg"], default: "png" },
            size: { type: "number", minimum: 100, maximum: 1000, default: 300 },
            margin: { type: "number", minimum: 0, maximum: 10, default: 4 },
          },
          required: ["text"],
        },
      },
    ],
  },
  {
    slug: "color",
    name: "Color Utilities",
    description:
      "Convert colors between hex/RGB/HSL/HSV, generate palettes, mix colors, check WCAG contrast, lighten/darken.",
    category: "media",
    scope: "color:use",
    endpoints: [
      {
        id: "color.convert",
        name: "Convert",
        description: "Convert a color between hex, RGB, HSL, and HSV formats.",
        method: "POST",
        path: "/v1/color/convert",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            color: {
              description: "Color as hex string, RGB object {r,g,b}, or HSL object {h,s,l}",
              oneOf: [
                { type: "string" },
                {
                  type: "object",
                  properties: {
                    r: { type: "number" },
                    g: { type: "number" },
                    b: { type: "number" },
                  },
                },
                {
                  type: "object",
                  properties: {
                    h: { type: "number" },
                    s: { type: "number" },
                    l: { type: "number" },
                  },
                },
              ],
            },
          },
          required: ["color"],
        },
      },
      {
        id: "color.palette",
        name: "Generate Palette",
        description: "Generate a color palette (complementary, analogous, triadic, etc.).",
        method: "POST",
        path: "/v1/color/palette",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            color: { type: "string", description: "Base color as hex" },
            type: {
              type: "string",
              enum: [
                "complementary",
                "analogous",
                "triadic",
                "tetradic",
                "split-complementary",
                "monochromatic",
              ],
            },
          },
          required: ["color", "type"],
        },
      },
      {
        id: "color.mix",
        name: "Mix Colors",
        description: "Blend two colors at a given weight (0.0-1.0).",
        method: "POST",
        path: "/v1/color/mix",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            color1: { type: "string" },
            color2: { type: "string" },
            weight: { type: "number", minimum: 0, maximum: 1, default: 0.5 },
          },
          required: ["color1", "color2"],
        },
      },
      {
        id: "color.contrast",
        name: "WCAG Contrast",
        description: "Check WCAG AA/AAA contrast ratio between two colors.",
        method: "POST",
        path: "/v1/color/contrast",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            color1: { type: "string" },
            color2: { type: "string" },
          },
          required: ["color1", "color2"],
        },
      },
      {
        id: "color.lighten",
        name: "Lighten",
        description: "Increase a color's lightness by a percentage (0-100).",
        method: "POST",
        path: "/v1/color/lighten",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            color: { type: "string" },
            amount: { type: "number", minimum: 0, maximum: 100 },
          },
          required: ["color", "amount"],
        },
      },
      {
        id: "color.darken",
        name: "Darken",
        description: "Decrease a color's lightness by a percentage (0-100).",
        method: "POST",
        path: "/v1/color/darken",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            color: { type: "string" },
            amount: { type: "number", minimum: 0, maximum: 100 },
          },
          required: ["color", "amount"],
        },
      },
    ],
  },

  // ─── TIME ──────────────────────────────────────────────────────────
  {
    slug: "timestamp",
    name: "Timestamp Utilities",
    description:
      "Get current time, convert between timestamp formats, diff timestamps, add durations, format timestamps.",
    category: "time",
    scope: "timestamp:use",
    endpoints: [
      {
        id: "timestamp.now",
        name: "Now",
        description: "Get the current time in ISO, Unix seconds, Unix ms, and UTC string.",
        method: "POST",
        path: "/v1/timestamp/now",
        requiresAuth: true,
        inputSchema: { type: "object", properties: {} },
      },
      {
        id: "timestamp.convert",
        name: "Convert",
        description: "Convert any timestamp (ISO, Unix seconds, Unix ms) to all formats.",
        method: "POST",
        path: "/v1/timestamp/convert",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            timestamp: {
              description: "ISO string, Unix seconds, or Unix milliseconds",
              oneOf: [{ type: "string" }, { type: "number" }],
            },
          },
          required: ["timestamp"],
        },
      },
      {
        id: "timestamp.diff",
        name: "Difference",
        description: "Calculate the difference between two timestamps.",
        method: "POST",
        path: "/v1/timestamp/diff",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            from: { description: "Start timestamp", oneOf: [{ type: "string" }, { type: "number" }] },
            to: { description: "End timestamp", oneOf: [{ type: "string" }, { type: "number" }] },
          },
          required: ["from", "to"],
        },
      },
      {
        id: "timestamp.add",
        name: "Add Duration",
        description: "Add years, months, weeks, days, hours, minutes, or seconds to a timestamp.",
        method: "POST",
        path: "/v1/timestamp/add",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            timestamp: { oneOf: [{ type: "string" }, { type: "number" }] },
            duration: {
              type: "object",
              properties: {
                years: { type: "number" },
                months: { type: "number" },
                weeks: { type: "number" },
                days: { type: "number" },
                hours: { type: "number" },
                minutes: { type: "number" },
                seconds: { type: "number" },
              },
            },
          },
          required: ["timestamp", "duration"],
        },
      },
      {
        id: "timestamp.format",
        name: "Format",
        description: "Format a timestamp using a custom pattern (YYYY-MM-DD HH:mm:ss etc.).",
        method: "POST",
        path: "/v1/timestamp/format",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            timestamp: { oneOf: [{ type: "string" }, { type: "number" }] },
            format: { type: "string", description: "e.g. 'YYYY-MM-DD HH:mm:ss'" },
          },
          required: ["timestamp", "format"],
        },
      },
    ],
  },
  {
    slug: "cron",
    name: "Cron",
    description:
      "Parse, validate, build, and preview next occurrences of cron expressions.",
    category: "time",
    scope: "cron:use",
    endpoints: [
      {
        id: "cron.parse",
        name: "Parse",
        description: "Convert a cron expression to a human-readable description.",
        method: "POST",
        path: "/v1/cron/parse",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            expression: { type: "string", description: "e.g. '0 9 * * 1-5'" },
          },
          required: ["expression"],
        },
      },
      {
        id: "cron.next",
        name: "Next Occurrences",
        description: "Get the next N scheduled dates for a cron expression.",
        method: "POST",
        path: "/v1/cron/next",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            expression: { type: "string" },
            count: { type: "number", minimum: 1, maximum: 50, default: 5 },
            after: { type: "string", description: "ISO8601 start date (defaults to now)" },
          },
          required: ["expression"],
        },
      },
      {
        id: "cron.validate",
        name: "Validate",
        description: "Check if a cron expression is valid and get field breakdown.",
        method: "POST",
        path: "/v1/cron/validate",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { expression: { type: "string" } },
          required: ["expression"],
        },
      },
      {
        id: "cron.build",
        name: "Build",
        description: "Build a cron expression from plain English parameters.",
        method: "POST",
        path: "/v1/cron/build",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            every: {
              type: "string",
              description: "Interval: 'day', 'hour', 'minute', 'week', 'month', or weekday name",
            },
            at: { type: "string", description: "Time of day as HH:MM, e.g. '09:00'" },
            on: { type: "string", description: "Day of month or weekday name" },
          },
          required: ["every"],
        },
      },
    ],
  },

  // ─── NETWORK ───────────────────────────────────────────────────────
  {
    slug: "ip",
    name: "IP Utilities",
    description:
      "Lookup caller IP, parse IP addresses, compute subnet math (CIDR), check range membership, convert formats.",
    category: "network",
    scope: "ip:use",
    endpoints: [
      {
        id: "ip.lookup",
        name: "My IP",
        description: "Return the caller's IP address.",
        method: "POST",
        path: "/v1/ip/lookup",
        requiresAuth: true,
        inputSchema: { type: "object", properties: {} },
      },
      {
        id: "ip.parse",
        name: "Parse IP",
        description: "Parse an IP address into decimal, binary, hex, and flag details.",
        method: "POST",
        path: "/v1/ip/parse",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { ip: { type: "string" } },
          required: ["ip"],
        },
      },
      {
        id: "ip.subnet",
        name: "Subnet / CIDR",
        description: "Compute subnet details from a CIDR notation (e.g. 192.168.1.0/24).",
        method: "POST",
        path: "/v1/ip/subnet",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            cidr: { type: "string", description: "e.g. '192.168.1.0/24'" },
          },
          required: ["cidr"],
        },
      },
      {
        id: "ip.range",
        name: "Range Check",
        description: "Check if an IP address is within a CIDR range.",
        method: "POST",
        path: "/v1/ip/range",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            ip: { type: "string" },
            cidr: { type: "string" },
          },
          required: ["ip", "cidr"],
        },
      },
      {
        id: "ip.convert",
        name: "Convert IP Format",
        description: "Convert an IPv4 address between dotted-decimal, decimal, binary, and hex.",
        method: "POST",
        path: "/v1/ip/convert",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            ip: { type: "string", description: "IP in any format (dotted, decimal, binary, hex)" },
          },
          required: ["ip"],
        },
      },
    ],
  },
  {
    slug: "shorten",
    name: "URL Shortener",
    description: "Shorten URLs and track click statistics.",
    category: "network",
    scope: "shorten:write",
    endpoints: [
      {
        id: "shorten.create",
        name: "Shorten URL",
        description: "Create a short URL.",
        method: "POST",
        path: "/v1/shorten",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "The URL to shorten" },
          },
          required: ["url"],
        },
      },
      {
        id: "shorten.stats",
        name: "URL Stats",
        description: "Get click count and details for a shortened URL.",
        method: "GET",
        path: "/v1/shorten/:code/stats",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            code: { type: "string", description: "The short URL code" },
          },
          required: ["code"],
        },
      },
    ],
  },

  // ─── GENERATION ────────────────────────────────────────────────────
  {
    slug: "uuid",
    name: "UUID",
    description: "Generate UUIDv4s, validate UUID strings, and parse UUID components.",
    category: "generation",
    scope: "uuid:use",
    endpoints: [
      {
        id: "uuid.v4",
        name: "Generate UUIDv4",
        description: "Generate one or more random UUIDs.",
        method: "POST",
        path: "/v1/uuid/v4",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            count: { type: "number", minimum: 1, maximum: 100, default: 1 },
          },
        },
      },
      {
        id: "uuid.validate",
        name: "Validate UUID",
        description: "Check if a string is a valid UUID and identify its version.",
        method: "POST",
        path: "/v1/uuid/validate",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { uuid: { type: "string" } },
          required: ["uuid"],
        },
      },
      {
        id: "uuid.parse",
        name: "Parse UUID",
        description: "Parse a UUID into its RFC 4122 component fields.",
        method: "POST",
        path: "/v1/uuid/parse",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { uuid: { type: "string" } },
          required: ["uuid"],
        },
      },
    ],
  },
  {
    slug: "random",
    name: "Random Generation",
    description:
      "Generate random numbers, strings, passwords, pick/shuffle array items, generate random colors.",
    category: "generation",
    scope: "random:use",
    endpoints: [
      {
        id: "random.number",
        name: "Random Number",
        description: "Generate random number(s) within a range.",
        method: "POST",
        path: "/v1/random/number",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            min: { type: "number" },
            max: { type: "number" },
            count: { type: "number", minimum: 1, maximum: 1000, default: 1 },
            decimals: { type: "number", minimum: 0, maximum: 10, default: 0 },
          },
          required: ["min", "max"],
        },
      },
      {
        id: "random.string",
        name: "Random String",
        description: "Generate random strings from various character sets.",
        method: "POST",
        path: "/v1/random/string",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            length: { type: "number", minimum: 1, maximum: 4096 },
            charset: {
              type: "string",
              enum: ["alpha", "numeric", "alphanumeric", "hex", "custom"],
              default: "alphanumeric",
            },
            custom_chars: { type: "string" },
            count: { type: "number", minimum: 1, maximum: 100, default: 1 },
          },
          required: ["length"],
        },
      },
      {
        id: "random.password",
        name: "Random Password",
        description: "Generate secure random passwords with configurable complexity.",
        method: "POST",
        path: "/v1/random/password",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            length: { type: "number", minimum: 4, maximum: 512, default: 16 },
            uppercase: { type: "boolean", default: true },
            lowercase: { type: "boolean", default: true },
            numbers: { type: "boolean", default: true },
            symbols: { type: "boolean", default: true },
            count: { type: "number", minimum: 1, maximum: 100, default: 1 },
          },
        },
      },
      {
        id: "random.pick",
        name: "Random Pick",
        description: "Pick one or more random items from an array.",
        method: "POST",
        path: "/v1/random/pick",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            items: { type: "array" },
            count: { type: "number", minimum: 1, default: 1 },
            unique: { type: "boolean", default: true },
          },
          required: ["items"],
        },
      },
      {
        id: "random.shuffle",
        name: "Shuffle",
        description: "Randomly shuffle an array (Fisher-Yates).",
        method: "POST",
        path: "/v1/random/shuffle",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { items: { type: "array" } },
          required: ["items"],
        },
      },
      {
        id: "random.color",
        name: "Random Color",
        description: "Generate random colors in hex, RGB, or HSL format.",
        method: "POST",
        path: "/v1/random/color",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            format: { type: "string", enum: ["hex", "rgb", "hsl"], default: "hex" },
            count: { type: "number", minimum: 1, maximum: 100, default: 1 },
          },
        },
      },
    ],
  },

  // ─── PLATFORM ──────────────────────────────────────────────────────
  {
    slug: "report-bug",
    name: "Bug Reporter",
    description:
      "Report bugs and errors directly from within an agent workflow. When you encounter an error using any UnClick tool, call this endpoint to automatically file a bug report. Severity is auto-detected from the error message (HTTP 500 → critical, timeout/bad response → high, validation errors → medium, other → low) or you can set it manually.",
    category: "platform",
    scope: "",
    endpoints: [
      {
        id: "report_bug.create",
        name: "Report Bug",
        description:
          "Submit a bug report when you encounter an error using an UnClick tool. Include the tool name, the error you received, what you sent, and optionally what you expected to happen.",
        method: "POST",
        path: "/v1/report-bug",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            tool_name: {
              type: "string",
              description: "Name of the UnClick tool that produced the error (e.g. 'hash', 'image', 'kv')",
            },
            error_message: {
              type: "string",
              description: "The full error message or description of what went wrong",
            },
            request_payload: {
              type: "object",
              description: "The exact request body you sent to the tool when the error occurred",
            },
            expected_behavior: {
              type: "string",
              description: "What you expected the tool to do (optional but helpful for triage)",
            },
            severity: {
              type: "string",
              enum: ["critical", "high", "medium", "low"],
              description: "Override auto-detected severity. Leave blank to let UnClick detect it.",
            },
            agent_context: {
              type: "object",
              description: "Any additional context about your agent, task, or environment",
            },
          },
          required: ["tool_name", "error_message"],
        },
      },
    ],
  },

  // ─── STORAGE ───────────────────────────────────────────────────────
  {
    slug: "kv",
    name: "Key-Value Store",
    description:
      "Persistent key-value storage with TTL support. Set, get, delete, list, and increment keys.",
    category: "storage",
    scope: "kv:write",
    endpoints: [
      {
        id: "kv.set",
        name: "Set",
        description: "Store a value at a key with optional TTL.",
        method: "POST",
        path: "/v1/kv/set",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            key: { type: "string" },
            value: { description: "Any JSON-serializable value" },
            ttl: { type: "number", description: "Time-to-live in seconds (max 1 year)" },
          },
          required: ["key", "value"],
        },
      },
      {
        id: "kv.get",
        name: "Get",
        description: "Retrieve a value by key.",
        method: "POST",
        path: "/v1/kv/get",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { key: { type: "string" } },
          required: ["key"],
        },
      },
      {
        id: "kv.delete",
        name: "Delete",
        description: "Delete a key (idempotent).",
        method: "POST",
        path: "/v1/kv/delete",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { key: { type: "string" } },
          required: ["key"],
        },
      },
      {
        id: "kv.list",
        name: "List Keys",
        description: "List all live keys, optionally filtered by prefix.",
        method: "POST",
        path: "/v1/kv/list",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            prefix: { type: "string" },
            page: { type: "number", default: 1 },
            limit: { type: "number", minimum: 1, maximum: 500, default: 50 },
          },
        },
      },
      {
        id: "kv.exists",
        name: "Exists",
        description: "Check if a key exists and has not expired.",
        method: "POST",
        path: "/v1/kv/exists",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { key: { type: "string" } },
          required: ["key"],
        },
      },
      {
        id: "kv.increment",
        name: "Increment",
        description: "Atomically increment a numeric key's value.",
        method: "POST",
        path: "/v1/kv/increment",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            key: { type: "string" },
            amount: { type: "number", default: 1 },
          },
          required: ["key"],
        },
      },
    ],
  },
  {
    slug: "webhook",
    name: "Webhook Bin",
    description:
      "Create temporary webhook URLs to capture and inspect HTTP requests (great for testing webhooks).",
    category: "storage",
    scope: "webhook:write",
    endpoints: [
      {
        id: "webhook.create",
        name: "Create Bin",
        description: "Create a temporary webhook bin URL that captures incoming requests for 24 hours.",
        method: "POST",
        path: "/v1/webhook/create",
        requiresAuth: true,
        inputSchema: { type: "object", properties: {} },
      },
      {
        id: "webhook.requests",
        name: "List Requests",
        description: "List all captured requests for a webhook bin.",
        method: "POST",
        path: "/v1/webhook/:id/requests",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Webhook bin ID" },
            limit: { type: "number", minimum: 1, maximum: 100, default: 20 },
            page: { type: "number", default: 1 },
          },
          required: ["id"],
        },
      },
      {
        id: "webhook.delete",
        name: "Delete Bin",
        description: "Delete a webhook bin.",
        method: "DELETE",
        path: "/v1/webhook/:id",
        requiresAuth: true,
        inputSchema: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
    ],
  },
  // ─── MEMORY (persistent cross-session memory) ────────────────────────
  // Handled by the local memory module - no HTTP call is made. The 5 most
  // important tools (get_startup_context, write_session_summary, add_fact,
  // search_memory, set_business_context) are also registered as direct
  // MCP tools so agents discover the session protocol.
  {
    slug: "memory",
    name: "UnClick Memory",
    description:
      "Persistent cross-session memory for AI agents. 6-layer architecture: business context, knowledge library, session summaries, extracted facts, conversation log, code dumps. Zero-config local mode or Supabase cloud sync.",
    category: "storage",
    scope: "memory:use",
    endpoints: [
      {
        id: "memory.get_startup_context",
        name: "Load Session Context",
        description: "Load Session Context - compact by default for strict clients. Loads business context, hot facts, and counts; call search_memory for detail.",
        method: "POST",
        path: "/v1/memory/startup",
        requiresAuth: false,
        inputSchema: {
          type: "object",
          properties: {
            num_sessions: { type: "number", minimum: 1, maximum: 20, default: 3 },
            lite: { type: "boolean", default: true },
            full_content: { type: "boolean", default: false },
          },
        },
      },
      {
        id: "memory.search_memory",
        name: "Search Conversations",
        description: "Search Conversations - search facts and sessions. Result text is capped by default; pass full_content=true for full rows.",
        method: "POST",
        path: "/v1/memory/search",
        requiresAuth: false,
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            max_results: { type: "number", minimum: 1, maximum: 50, default: 10 },
            full_content: { type: "boolean", default: false },
          },
          required: ["query"],
        },
      },
      {
        id: "memory.search_facts",
        name: "Search Facts",
        description: "Search Facts - Search active (non-superseded) extracted facts.",
        method: "POST",
        path: "/v1/memory/facts/search",
        requiresAuth: false,
        inputSchema: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
      },
      {
        id: "memory.search_typed_links",
        name: "Search Typed Links",
        description: "Search Typed Links - Search stored graph-style links extracted from facts and conversation turns.",
        method: "POST",
        path: "/v1/memory/typed-links/search",
        requiresAuth: false,
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            max_results: { type: "number", minimum: 1, maximum: 50, default: 10 },
          },
          required: ["query"],
        },
      },
      {
        id: "memory.search_library",
        name: "Search Knowledge Library",
        description: "Search Knowledge Library - Search versioned reference documents in the Knowledge Library.",
        method: "POST",
        path: "/v1/memory/library/search",
        requiresAuth: false,
        inputSchema: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
      },
      {
        id: "memory.get_library_doc",
        name: "Read Library Document",
        description: "Read Library Document - Get the full content of a library doc by slug.",
        method: "POST",
        path: "/v1/memory/library/get",
        requiresAuth: false,
        inputSchema: {
          type: "object",
          properties: { slug: { type: "string" } },
          required: ["slug"],
        },
      },
      {
        id: "memory.list_library",
        name: "List Library Documents",
        description: "List Library Documents - List all documents in the Knowledge Library.",
        method: "POST",
        path: "/v1/memory/library/list",
        requiresAuth: false,
        inputSchema: { type: "object", properties: {} },
      },
      {
        id: "memory.write_session_summary",
        name: "Save Session Summary",
        description: "Save Session Summary - Write an end-of-session summary. Call BEFORE session ends.",
        method: "POST",
        path: "/v1/memory/session/write",
        requiresAuth: false,
        inputSchema: {
          type: "object",
          properties: {
            session_id: { type: "string" },
            summary: { type: "string" },
            topics: { type: "array", items: { type: "string" } },
            open_loops: { type: "array", items: { type: "string" } },
            decisions: { type: "array", items: { type: "string" } },
            platform: { type: "string", default: "claude-code" },
            duration_minutes: { type: "number" },
          },
          required: ["session_id", "summary"],
        },
      },
      {
        id: "memory.add_fact",
        name: "Store New Fact",
        description: "Store New Fact - Add an atomic fact. One fact = one statement.",
        method: "POST",
        path: "/v1/memory/facts/add",
        requiresAuth: false,
        inputSchema: {
          type: "object",
          properties: {
            fact: { type: "string" },
            category: { type: "string", default: "general" },
            confidence: { type: "number", minimum: 0, maximum: 1, default: 0.9 },
            source_session_id: { type: "string" },
          },
          required: ["fact"],
        },
      },
      {
        id: "memory.supersede_fact",
        name: "Replace Existing Fact",
        description: "Replace Existing Fact - Replace an outdated fact with a new version (old one marked superseded, never deleted).",
        method: "POST",
        path: "/v1/memory/facts/supersede",
        requiresAuth: false,
        inputSchema: {
          type: "object",
          properties: {
            old_fact_id: { type: "string" },
            new_fact_text: { type: "string" },
            new_category: { type: "string" },
            new_confidence: { type: "number", minimum: 0, maximum: 1 },
          },
          required: ["old_fact_id", "new_fact_text"],
        },
      },
      {
        id: "memory.log_conversation",
        name: "Log Conversation",
        description: "Log Conversation - Log a conversation exchange for later search.",
        method: "POST",
        path: "/v1/memory/conversation/log",
        requiresAuth: false,
        inputSchema: {
          type: "object",
          properties: {
            session_id: { type: "string" },
            role: { type: "string", enum: ["user", "assistant", "system", "tool"] },
            content: { type: "string" },
            has_code: { type: "boolean", default: false },
          },
          required: ["session_id", "role", "content"],
        },
      },
      {
        id: "memory.get_conversation_detail",
        name: "View Conversation Detail",
        description: "View Conversation Detail - Retrieve the full conversation log for a session.",
        method: "POST",
        path: "/v1/memory/conversation/get",
        requiresAuth: false,
        inputSchema: {
          type: "object",
          properties: { session_id: { type: "string" } },
          required: ["session_id"],
        },
      },
      {
        id: "memory.store_code",
        name: "Store Code Snippet",
        description: "Store Code Snippet - Store a code block in the code dump layer.",
        method: "POST",
        path: "/v1/memory/code/store",
        requiresAuth: false,
        inputSchema: {
          type: "object",
          properties: {
            session_id: { type: "string" },
            language: { type: "string", default: "typescript" },
            filename: { type: "string" },
            code: { type: "string" },
            description: { type: "string" },
          },
          required: ["session_id", "code"],
        },
      },
      {
        id: "memory.get_business_context",
        name: "Get Business Context",
        description: "Get Business Context - Get all business context entries (standing rules).",
        method: "POST",
        path: "/v1/memory/context/get",
        requiresAuth: false,
        inputSchema: { type: "object", properties: {} },
      },
      {
        id: "memory.set_business_context",
        name: "Update Business Context",
        description: "Update Business Context - Add or update a business context entry (always loaded at session start).",
        method: "POST",
        path: "/v1/memory/context/set",
        requiresAuth: false,
        inputSchema: {
          type: "object",
          properties: {
            category: { type: "string" },
            key: { type: "string" },
            value: { type: "string" },
            priority: { type: "number" },
          },
          required: ["category", "key", "value"],
        },
      },
      {
        id: "memory.upsert_library_doc",
        name: "Save Library Document",
        description: "Save Library Document - Create or update a Knowledge Library document (auto-versioned).",
        method: "POST",
        path: "/v1/memory/library/upsert",
        requiresAuth: false,
        inputSchema: {
          type: "object",
          properties: {
            slug: { type: "string" },
            title: { type: "string" },
            category: { type: "string", default: "reference" },
            content: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
          },
          required: ["slug", "title", "content"],
        },
      },
      {
        id: "memory.manage_decay",
        name: "Run Memory Decay",
        description: "Run Memory Decay - Run the memory decay manager. Promotes/demotes items between hot/warm/cold tiers.",
        method: "POST",
        path: "/v1/memory/decay",
        requiresAuth: false,
        inputSchema: { type: "object", properties: {} },
      },
      {
        id: "memory.memory_status",
        name: "Check Memory Status",
        description: "Check Memory Status - Get memory usage stats: storage mode, counts per layer, decay tier distribution.",
        method: "POST",
        path: "/v1/memory/status",
        requiresAuth: false,
        inputSchema: { type: "object", properties: {} },
      },
    ],
  },
];

/** Flat map of all endpoints keyed by endpoint id */
export const ENDPOINT_MAP = new Map<string, { tool: ToolDef; endpoint: EndpointDef }>();
for (const tool of CATALOG) {
  for (const endpoint of tool.endpoints) {
    ENDPOINT_MAP.set(endpoint.id, { tool, endpoint });
  }
}

/** Map of tool slug → ToolDef */
export const TOOL_MAP = new Map<string, ToolDef>(
  CATALOG.map((t) => [t.slug, t])
);

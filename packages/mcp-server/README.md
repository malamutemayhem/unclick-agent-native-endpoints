# @unclick/mcp-server

**MCP server for the [UnClick](https://unclick.world) tool marketplace.**

One install gives any MCP-compatible AI agent (Claude, Cursor, etc.) access to:
- **450+ callable endpoints** across 60+ integrations (social, e-commerce, accounting, messaging, and more)
- **Persistent cross-session memory** — the agent remembers you across sessions, zero config

## Quick Start

### Claude Desktop / Claude Code

Add to your MCP config (Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json`, or run `claude mcp add` in Claude Code):

```json
{
  "mcpServers": {
    "unclick": {
      "command": "npx",
      "args": ["-y", "@unclick/mcp-server"],
      "env": {
        "UNCLICK_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

Get your API key at [unclick.world](https://unclick.world).

> **Install codes.** The `UNCLICK_API_KEY` can also be a short-lived install code like `unclick-ember-falcon-2847` (good for 24 hours). On first boot the server exchanges it for the real key and caches it at `~/.unclick/credentials.json`. This means install snippets shared in chat look like project slugs rather than credentials.

### Cursor

Same config snippet as above — Cursor uses the same MCP format.

### Local / Development

```bash
UNCLICK_API_KEY=unck_... npx @unclick/mcp-server
```

## Memory (built in, zero config)

Memory works out of the box. No setup needed — data is stored as JSON files in `~/.unclick/memory/`.

**Want cross-machine sync?** Add Supabase env vars to your config:

```json
"env": {
  "UNCLICK_API_KEY": "your_api_key_here",
  "SUPABASE_URL": "https://your-project.supabase.co",
  "SUPABASE_SERVICE_ROLE_KEY": "your_service_role_key"
}
```

Memory tools exposed at session level: `get_startup_context`, `write_session_summary`, `add_fact`, `search_memory`, `set_business_context`. Full 17 operations available via `unclick_call` with `endpoint_id: "memory.*"`.

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `UNCLICK_API_KEY` | *(required)* | Your UnClick API key |
| `UNCLICK_BASE_URL` | `https://api.unclick.world` | Override API base URL (for self-hosted) |

## Tools Exposed

### Discovery (Meta Tools)

These tools let agents explore the full marketplace dynamically.

| Tool | Description |
|---|---|
| `unclick_search` | Search for tools by keyword. "I need to resize an image" → returns the image tool with endpoints and schemas. |
| `unclick_browse` | Browse all tools, optionally filtered by category (text, data, media, time, network, generation, storage). |
| `unclick_tool_info` | Get full details on a specific tool: all endpoints, required params, and response shapes. |
| `unclick_call` | Universal caller — specify any `endpoint_id` and `params`, the server routes the call. |

**Discovery flow for an agent:**
1. `unclick_search` → "what tool handles X?"
2. `unclick_tool_info` → "what are the exact params for that tool?"
3. `unclick_call` → call it

### Direct Tools (Zero Friction)

The most-used tools are exposed as first-class MCP tools for immediate use without discovery:

| Tool | What it does |
|---|---|
| `unclick_shorten_url` | Shorten a URL |
| `unclick_generate_qr` | Generate a QR code (PNG/SVG) |
| `unclick_hash` | Hash text with MD5/SHA1/SHA256/SHA512 |
| `unclick_transform_text` | Change text case (camel, snake, kebab, title, etc.) |
| `unclick_validate_email` | Validate an email address |
| `unclick_validate_url` | Validate a URL (+ optional reachability check) |
| `unclick_resize_image` | Resize a base64-encoded image |
| `unclick_parse_csv` | Parse CSV to JSON |
| `unclick_json_format` | Pretty-print JSON |
| `unclick_encode` | Encode/decode base64, URL, HTML, or hex |
| `unclick_generate_uuid` | Generate UUIDs |
| `unclick_random_password` | Generate a secure password |
| `unclick_cron_parse` | Parse a cron expression + show next occurrences |
| `unclick_ip_parse` | Parse an IP address |
| `unclick_color_convert` | Convert color between hex/RGB/HSL/HSV |
| `unclick_regex_test` | Test a regex and get all matches |
| `unclick_timestamp_convert` | Convert timestamps between formats |
| `unclick_diff_text` | Line-by-line diff of two strings |
| `unclick_kv_set` | Store a value in the key-value store |
| `unclick_kv_get` | Retrieve a value from the key-value store |

## Full Tool Catalog

The marketplace currently includes 23 tool groups spanning:

- **Text** — transform (case, slug, count), encode/decode (base64, URL, HTML, hex), hash/HMAC, regex, markdown, diff
- **Data** — JSON utilities, CSV processing, input validation (email, URL, phone, credit card, IP, color)
- **Media** — image processing (resize, convert, crop, rotate, compress, grayscale), QR code generation, color utilities
- **Time** — timestamp conversion, cron parsing/building
- **Network** — URL shortening, IP utilities (parse, subnet, CIDR)
- **Generation** — UUID v4, random (numbers, strings, passwords, picks, shuffles, colors)
- **Storage** — key-value store (with TTL), webhook bins

All tools are accessible via `unclick_call` with the appropriate `endpoint_id`.

## Example Usage

**Agent discovers and uses a tool:**
```
Agent: I need to hash a password before storing it.

1. unclick_search({ query: "hash password" })
   → Returns: hash tool (slug: hash, endpoints: hash.compute, hash.verify, hash.hmac)

2. unclick_call({ endpoint_id: "hash.compute", params: { text: "my-secret", algorithm: "sha256" } })
   → { algorithm: "sha256", hash: "abc123...", length: 64 }
```

**Direct tool usage:**
```
Agent: unclick_generate_qr({ text: "https://example.com", format: "png", size: 400 })
→ { binary: true, content_type: "image/png", data: "<base64>" }
```

## Development

```bash
# Run locally with tsx (no build step)
UNCLICK_API_KEY=unck_... npm run dev

# Build
npm run build

# Run built output
npm start
```

## MCP Registry

This server is published to npm as `@unclick/mcp-server` and can be added to any MCP registry that supports npx-based servers.

## License

MIT

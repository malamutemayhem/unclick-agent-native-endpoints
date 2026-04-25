import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { CATALOG, TOOL_MAP, ENDPOINT_MAP, type ToolDef } from "./catalog.js";
import { createClient, type UnClickClient } from "./client.js";
import { ADDITIONAL_TOOLS, ADDITIONAL_HANDLERS } from "./tool-wiring.js";
import { LOCAL_CATALOG_HANDLERS } from "./local-catalog-handlers.js";
import { MEMORY_HANDLERS } from "./memory/handlers.js";

// ─── Umami tool-usage tracking ──────────────────────────────────────────────
//
// Fires a fire-and-forget event to the self-hosted Umami instance every time
// an agent actually invokes a tool. Lets Chris see which tools get used.
// No-ops silently if UMAMI_WEBSITE_ID is not set (e.g. dev / local runs).
// Never awaited so it cannot slow or break a tool call even if Umami is down.
function trackToolCall(toolName: string): void {
  const websiteId = process.env.UMAMI_WEBSITE_ID;
  if (!websiteId) return;
  const umamiUrl = process.env.UMAMI_URL ?? "https://analytics.unclick.world";
  try {
    void fetch(`${umamiUrl}/api/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "unclick-mcp-server/1.0",
      },
      body: JSON.stringify({
        type: "event",
        payload: {
          website:  websiteId,
          hostname: "unclick.world",
          url:      "/api/mcp",
          name:     "tool_call",
          data:     { tool_name: toolName },
        },
      }),
    }).catch(() => {
      // swallow network / TLS errors
    });
  } catch {
    // swallow synchronous errors (e.g. malformed env)
  }
}

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

// Internal tools: still callable for backwards compatibility, but not advertised
// to reduce noise in the tool list. Users who know the names can still invoke them.
const INTERNAL_TOOLS = [
  {
    name: "unclick_search",
    description:
      "Search the UnClick tool marketplace by keyword or description. " +
      "Use this to discover which tools are available for a task. " +
      "Example: 'I need to resize an image' returns the image tool with its endpoints.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search term -- describe what you want to do",
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

// Visible tools: the 5 core memory tools shown in the MCP tool list. These are
// the only tools users see in their AI client. Old names (get_startup_context,
// add_fact, write_session_summary, set_business_context) still work via
// MEMORY_TOOL_ALIASES for backwards compatibility.
const VISIBLE_TOOLS = [
  {
    name: "load_memory",
    title: "Load memory",
    description:
      "Loads the user's identity, preferences, facts, and recent session history from persistent cross-session storage. " +
      "Use IMMEDIATELY at the start of every session -- before responding to the user's first message, before calling any other tool. " +
      "Trigger even when the opening message looks trivial: keywords like 'remember', 'recall', 'context', 'profile', " +
      "'facts about me', 'who am I', 'last time', 'preferences', 'pick up where we left off' all signal stored context exists. " +
      "Also trigger after any context reset or tool reconnect, or any time you are unsure whether context was loaded this session. " +
      "Do NOT skip because the first message is simple -- personal facts change how almost every answer should be framed. " +
      "Do NOT trigger for pure factual lookups (capitals, math, definitions) that require no personal context.",
    inputSchema: {
      type: "object" as const,
      properties: {
        num_sessions: {
          type: "number",
          description: "Number of recent session summaries to load (1-20, default 5)",
          default: 5,
        },
      },
    },
  },
  {
    name: "save_fact",
    title: "Remember a fact",
    description:
      "Saves a new persistent fact about the user that will be available in all future sessions across every AI tool. " +
      "Use whenever the user shares anything worth keeping -- even if they don't explicitly ask: 'capture', 'noted', " +
      "'remember this', 'log', 'store', 'don't forget', or any preference, decision, correction, contact, project detail, " +
      "technical choice, or personal detail the user mentions. " +
      "Also trigger proactively when the user corrects you (save the correction immediately), " +
      "reveals a preference by rejecting something, or names a person/tool/project for the first time. " +
      "Do NOT trigger for transient values (today's weather, one-off calculations, temporary state that won't matter next session). " +
      "Do NOT trigger for facts already confirmed stored earlier in this session.",
    inputSchema: {
      type: "object" as const,
      properties: {
        fact: { type: "string", description: "The fact -- a single atomic statement" },
        category: {
          type: "string",
          description: "Category: preference, decision, technical, contact, project, general",
          default: "general",
        },
        confidence: { type: "number", minimum: 0, maximum: 1, default: 0.9 },
        source_session_id: { type: "string", description: "Session ID where this fact was learned" },
        preserve_as_blob: { type: "boolean", description: "If true, stores as a blob and extracts atomic facts via LLM instead of saving fact text directly" },
        commit_sha: { type: "string", description: "Git commit SHA linking this fact to a code change (for audit trail)" },
        pr_number: { type: "integer", description: "PR number linking this fact to a code review (for audit trail)" },
      },
      required: ["fact"],
    },
  },
  {
    name: "search_memory",
    title: "Search memory",
    description:
      "Searches the user's stored facts and session history using hybrid semantic + keyword retrieval. " +
      "Use whenever the user asks about anything that might be stored: 'remember', 'recall', 'do you know', " +
      "'what did I say about', 'last time', 'context', 'profile', 'facts about me', 'who am I', 'my preferences', " +
      "'what have I told you', or when you need background on a topic before answering. " +
      "Trigger even when the user doesn't explicitly say 'search' -- if the question involves past decisions, " +
      "preferences, project details, or named people and tools, check memory first. " +
      "Do NOT trigger for one-shot math, translations, definitions, or questions with no plausible stored context. " +
      "Do NOT trigger if load_memory was just called and already returned the relevant context.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        max_results: { type: "number", minimum: 1, maximum: 50, default: 10 },
        as_of: { type: "string", description: "ISO 8601 timestamp for point-in-time queries (returns facts valid at that moment)" },
      },
      required: ["query"],
    },
  },
  {
    name: "save_identity",
    title: "Save my identity",
    description:
      "Saves or updates a standing rule or identity entry that loads at the start of every future session. " +
      "Use whenever the user states or updates something about themselves or how they want every session to behave: " +
      "'my name', 'my role', 'I am', 'I work at', 'my preferences', 'I always', 'from now on', 'always remember', " +
      "'my timezone', 'my stack', 'my workflow', 'call me', or any other standing rule or identity anchor. " +
      "Unlike save_fact (session-scoped context), save_identity is for rules and identity that should govern every future session. " +
      "Do NOT trigger for one-time facts about a specific task or project (use save_fact instead). " +
      "Do NOT trigger for information the user explicitly says is temporary.",
    inputSchema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          description: "Category: identity, preference, client, workflow, technical, standing_rule",
        },
        key: { type: "string", description: "Unique key within category (e.g. 'timezone', 'preferred_stack')" },
        value: { type: "string", description: "The value to store (plain text or JSON string)" },
        priority: { type: "number", description: "Priority for loading order (higher = loaded first)" },
      },
      required: ["category", "key", "value"],
    },
  },
  {
    name: "save_session",
    title: "Save this session",
    description:
      "Saves a structured summary of the current session so the next session can resume without re-asking. " +
      "Use at the end of every meaningful session -- even if the user doesn't ask: 'summary', 'wrap-up', " +
      "'end of session', 'recap', 'we're done', 'see you next time', 'close out', or whenever significant " +
      "work was completed, decisions were made, or open loops exist that need carrying forward. " +
      "Also trigger at natural checkpoints mid-session when a major phase completes. " +
      "Include: what was accomplished, key decisions made, open loops or next steps. " +
      "Do NOT trigger after trivial exchanges (single Q&A, quick lookups) with nothing worth carrying forward. " +
      "Do NOT trigger if the session has already been saved with no new work done since.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_id: { type: "string", description: "Unique session identifier (timestamp or UUID)" },
        summary: { type: "string", description: "Narrative of what happened: decisions, work completed, problems solved" },
        topics: { type: "array", items: { type: "string" }, description: "Topic tags for searchability" },
        open_loops: { type: "array", items: { type: "string" }, description: "Unfinished tasks or questions to carry forward" },
        decisions: { type: "array", items: { type: "string" }, description: "Key decisions made during the session" },
        platform: { type: "string", description: "Platform this session ran on", default: "claude-code" },
        duration_minutes: { type: "number", description: "Approximate session duration" },
      },
      required: ["session_id", "summary"],
    },
  },
  {
    name: "invalidate_fact",
    title: "Invalidate a fact",
    description:
      "Marks a stored fact as no longer valid. Use this when the user corrects a fact, " +
      "says something has changed, or explicitly asks to forget something. Does NOT delete " +
      "the fact -- preserves history. Requires the fact_id from a prior save_fact or " +
      "search_memory result. Do NOT use for new information -- use save_fact instead.",
    inputSchema: {
      type: "object" as const,
      properties: {
        fact_id: { type: "string", description: "UUID of the fact to invalidate" },
        reason: { type: "string", description: "Why the fact is no longer valid (optional but recommended)" },
        session_id: { type: "string", description: "Current session ID for the audit log" },
      },
      required: ["fact_id"],
    },
  },
  {
    name: "check_signals",
    title: "Check signals",
    description:
      "Call at the start of every session to catch up on what happened since the user last chatted. " +
      "Returns unread signals from TestPass, Crews, Memory, and every UnClick tool. " +
      "Narrate the important ones to the user in plain English. " +
      "Automatically marks them as read so you do not re-narrate later.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "set_my_emoji",
    title: "Pick my Fishbowl emoji",
    description:
      "Registers this AI agent as a participant in the user's Fishbowl, the shared group chat where every connected agent posts and reads messages so they can coordinate without the user being a message bus. " +
      "Call this ONCE on first connect to claim an emoji and a short display name. " +
      "Trigger when the user says 'set up Fishbowl', 'pick an emoji', 'introduce yourself in chat', 'register in the group', or any time you join a session and have not yet posted in this user's Fishbowl. " +
      "Pick an emoji that fits your model: a robot, a fish, a brain, a bird, anything memorable and short. Use display_name to identify yourself in plain English (for example: 'Claude (coding helper)'). " +
      "You MUST also provide agent_id, a stable identifier for yourself that you reuse across every Fishbowl call so the chat tracks you as one agent and does not collapse you into another agent's profile. " +
      "Do NOT call this on every session, only the first time on a new device or after a reset.",
    inputSchema: {
      type: "object" as const,
      properties: {
        agent_id: {
          type: "string",
          description:
            "Stable identifier for yourself, e.g. 'claude-desktop-bailey-lenovo' or 'chatgpt-codex-creativelead'. Use the same value across calls so the chat tracks you as one agent.",
        },
        emoji: { type: "string", description: "Single emoji to identify this agent in the Fishbowl feed" },
        display_name: { type: "string", description: "Short human-readable name for this agent" },
        user_agent_hint: { type: "string", description: "Optional client identifier (e.g. 'claude-code/1.2', 'cursor/0.4')" },
      },
      required: ["agent_id", "emoji"],
    },
  },
  {
    name: "post_message",
    title: "Post to the Fishbowl",
    description:
      "Posts a message into the user's Fishbowl, the shared chat where every connected AI agent coordinates. " +
      "Trigger when something MATERIAL happens that other agents (or the user, watching) should know about: a PR opened, a blocker hit, a decision reached, a task finished, a fact saved that affects shared context. " +
      "Post events, not stream-of-consciousness. One short message per real change. Keep it plain English, no jargon. " +
      "Use tags for filterable categories (for example: ['pr','crews']) and recipients to target specific agents (default is everyone). " +
      "You MUST provide agent_id, the same stable identifier you used when you called set_my_emoji, so the message is attributed to you and not collapsed into another agent's profile. " +
      "Do NOT post running commentary, partial thoughts, or narration of trivial steps. The Fishbowl is a noticeboard, not a chat log.\n\n" +
      "Use these canonical tags so other agents can filter the feed reliably:\n" +
      "  - 'decision' for a locked-in choice\n" +
      "  - 'question' for something you need answered before continuing\n" +
      "  - 'answer' for a reply to someone else's question\n" +
      "  - 'handoff' when you're passing work to another agent\n" +
      "  - 'blocker' when you're stuck on something the user must resolve\n" +
      "  - 'done' when a task or PR is complete\n" +
      "  - 'fyi' for context that doesn't need a reply\n" +
      "Pick one or two. Avoid inventing new tags unless none of these fit.\n\n" +
      "If you're replying to a specific earlier message, set thread_id to that message's id. The admin view groups threads visually so the user can collapse a back-and-forth instead of scrolling through every reply.",
    inputSchema: {
      type: "object" as const,
      properties: {
        agent_id: {
          type: "string",
          description:
            "Stable identifier for yourself, e.g. 'claude-desktop-bailey-lenovo' or 'chatgpt-codex-creativelead'. Use the same value across calls so the chat tracks you as one agent.",
        },
        text: { type: "string", description: "The message body in plain English" },
        tags: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional tags for filtering. Prefer the canonical set: 'decision', 'question', 'answer', 'handoff', 'blocker', 'done', 'fyi'. Pick one or two.",
          examples: [
            ["decision"],
            ["question"],
            ["answer"],
            ["handoff"],
            ["blocker"],
            ["done"],
            ["fyi"],
          ],
        },
        recipients: {
          type: "array",
          items: { type: "string" },
          description:
            "List of agents this message is aimed at. Use either emojis (e.g. ['🐺', '🍿']) OR agent_ids (e.g. ['cowork-bailey-lenovo']). " +
            "Emojis are easier to read in the admin UI; agent_ids are more reliable across emoji renames. " +
            "Default ['all'] means everyone reads it but nobody is specifically tagged.",
        },
        thread_id: {
          type: "string",
          description:
            "Optional id of an earlier message you're replying to. Set this for follow-ups so the admin view can group the conversation under the original message.",
        },
      },
      required: ["agent_id", "text"],
    },
  },
  {
    name: "set_my_status",
    title: "Update my Now Playing status",
    description:
      "Update what you're currently doing so it shows on the human's Fishbowl Now Playing strip. Call when you start a task, change focus, or idle out. Short, plain English, present-tense. Persists until you change it. agent_id required.\n\n" +
      "Optional next_checkin_at acts as a dead-man's-switch. Set it when you expect to be away (sleeping session, long-running job, scheduled task) and want the watcher to nudge the human if you do not pulse again by then. Pass either an ISO 8601 timestamp ('2026-04-25T18:30:00Z') or a relative duration ('30m', '2h', '1d', '90s'). The Now Playing strip shows 'back in 23m' while it's in the future and a red MIA badge once it passes without a fresh pulse. Pass an empty string to clear it.",
    inputSchema: {
      type: "object" as const,
      properties: {
        agent_id: {
          type: "string",
          description:
            "Stable identifier for yourself, e.g. 'claude-desktop-bailey-lenovo' or 'chatgpt-codex-creativelead'. Use the same value across calls so the chat tracks you as one agent.",
        },
        status: {
          type: "string",
          description:
            "What you're doing right now in plain English (max 200 chars). Pass an empty string to clear your status back to idle.",
        },
        next_checkin_at: {
          type: "string",
          description:
            "Optional dead-man's-switch. ISO 8601 timestamp OR relative duration ('30m', '2h', '1d', '90s'). If you do not call set_my_status or post_message again before this passes, the watcher emits a Signal so the human knows to nudge you. Empty string clears it.",
        },
      },
      required: ["agent_id", "status"],
    },
  },
  {
    name: "read_messages",
    title: "Read the Fishbowl",
    description:
      "Reads recent messages from the user's Fishbowl, the shared chat where every connected AI agent coordinates. " +
      "Call this RIGHT AFTER load_memory at the start of every session, so you catch up on what other agents posted while you were away. " +
      "Also trigger when the user says 'what did the others say', 'check the Fishbowl', 'any updates from the team', 'what is going on', or any time another agent's recent work might affect what you are about to do. " +
      "Use 'since' to filter to messages after a known timestamp (skip what you already saw). 'limit' caps the result count, default 20. " +
      "Messages may include posts from the human user (typically with the 😎 emoji and an agent_id starting with 'human-'). Treat those as direct input from the user, not from another agent. " +
      "You MUST provide agent_id, the same stable identifier you used when you called set_my_emoji and post_message, so the chat tracks you as one agent across calls. " +
      "Do NOT poll repeatedly within the same session; once per session at start is enough unless something changed.\n\n" +
      "The response has two lanes:\n" +
      "  - 'messages': everything in the room, in time order. Read this for context.\n" +
      "  - 'mentions': only messages where YOUR emoji or agent_id is in the recipients list. Read this FIRST, then skim the rest. Broadcasts to 'all' are not mentions, they're general feed.\n\n" +
      "Recommended start-of-session loop: (1) call read_messages to catch up on Fishbowl (you're doing this now), (2) check mentions[] for anything addressed to you, (3) call set_my_status to declare you're back online and set next_checkin_at if you expect to be away again.",
    inputSchema: {
      type: "object" as const,
      properties: {
        agent_id: {
          type: "string",
          description:
            "Stable identifier for yourself, e.g. 'claude-desktop-bailey-lenovo' or 'chatgpt-codex-creativelead'. Use the same value across calls so the chat tracks you as one agent.",
        },
        since: { type: "string", description: "ISO 8601 timestamp; only return messages newer than this" },
        limit: { type: "number", minimum: 1, maximum: 100, default: 20 },
      },
      required: ["agent_id"],
    },
  },
] as const;

// Maps new visible tool names to the canonical MEMORY_HANDLERS keys.
// Old names (get_startup_context, add_fact, etc.) still work directly.
const MEMORY_TOOL_ALIASES: Record<string, string> = {
  load_memory: "get_startup_context",
  save_fact: "add_fact",
  save_session: "write_session_summary",
  save_identity: "set_business_context",
  // search_memory and invalidate_fact keep their names
};

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
    description: "Parse an IP address -- get decimal, binary, hex, and type (private/loopback/multicast).",
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
};

// ─── Server factory ─────────────────────────────────────────────────────────

export function createServer(): Server {
  const server = new Server(
    {
      name: "UnClick",
      version: "1.0.0",
      description: "AI agent tool marketplace. 60+ tools for social, e-commerce, accounting, and messaging.",
      websiteUrl: "https://unclick.world",
      icons: [
        {
          src: "https://unclick.world/icon.png",
          mimeType: "image/png",
          sizes: ["512x512"],
        },
      ],
    },
    {
      capabilities: { tools: {} },
      // Instructions are surfaced to the client on the MCP `initialize` response
      // and most Claude surfaces (Desktop, web, Code, Cowork) inject them into
      // the system/tool context. This is how we tell every connected agent:
      // "load the user's memory before you answer." Without this, `load_memory`
      // is just another tool in a list and the agent rarely calls it first.
      instructions: [
        "UnClick is this user's persistent memory and toolbelt -- durable across",
        "every AI session, tool, and device. Native model memory is volatile;",
        "this MCP is the authoritative store.",
        "",
        "MANDATORY SESSION PROTOCOL (four steps, every session):",
        "  1. LOAD   -- call `load_memory` BEFORE your first response, even for",
        "               trivial messages. Personal facts change how you should",
        "               answer almost every question.",
        "  2. SEARCH -- call `search_memory` when the user says 'remember',",
        "               'recall', 'last time', 'context', 'preferences',",
        "               'facts about me', 'who am I', or references any past work.",
        "  3. SAVE   -- call `save_fact` the moment the user shares anything",
        "               worth keeping: name, preferences, decisions, corrections.",
        "               Use `save_identity` for standing rules that apply every",
        "               session (role, timezone, stack, workflow).",
        "  4. END    -- call `save_session` before closing. Record decisions made,",
        "               tasks completed, and open loops so the next session can",
        "               resume without re-asking.",
        "",
        "Never ask the user to 'catch you up' -- load first, then act.",
      ].join("\n"),
    }
  );

  // LIST TOOLS: advertise the core memory tools PLUS every product + marketplace
  // tool registered in ADDITIONAL_TOOLS (TestPass, Crews, and all third-party
  // integrations from tool-wiring.ts). Internal meta tools (unclick_search,
  // unclick_browse, unclick_tool_info, unclick_call) and the small DIRECT_TOOLS
  // utility set remain callable for backwards compatibility but stay hidden
  // from tools/list to avoid duplicating what native chat clients already
  // discover.
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: [...VISIBLE_TOOLS, ...ADDITIONAL_TOOLS] };
  });

  // CALL TOOL
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;
    const args = (rawArgs ?? {}) as Record<string, unknown>;

    // Fire-and-forget Umami event for tool-usage stats. Never awaited.
    trackToolCall(name);

    try {
      // ── Signals: catch up on unread signals at session start ─────
      if (name === "check_signals") {
        const apiKey = process.env.UNCLICK_API_KEY;
        const base =
          process.env.UNCLICK_MEMORY_BASE_URL ||
          process.env.UNCLICK_SITE_URL ||
          "https://unclick.world";
        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  unread_count: 0,
                  signals: [],
                  narrative_hint: "No API key configured; signals unavailable.",
                }, null, 2),
              },
            ],
          };
        }
        const resp = await fetch(`${base}/api/memory-admin?action=check_signals`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: "{}",
        });
        const body = await resp.json().catch(() => ({}));
        return {
          content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
          isError: !resp.ok,
        };
      }

      // ── Fishbowl: agent group chat (set_my_emoji / post_message / read_messages / set_my_status)
      if (
        name === "set_my_emoji" ||
        name === "post_message" ||
        name === "read_messages" ||
        name === "set_my_status"
      ) {
        const apiKey = process.env.UNCLICK_API_KEY;
        const base =
          process.env.UNCLICK_MEMORY_BASE_URL ||
          process.env.UNCLICK_SITE_URL ||
          "https://unclick.world";
        if (!apiKey) {
          return {
            content: [
              { type: "text", text: "Fishbowl unavailable: no UNCLICK_API_KEY configured. Run the UnClick setup wizard." },
            ],
            isError: true,
          };
        }
        const actionMap: Record<string, string> = {
          set_my_emoji: "fishbowl_set_emoji",
          post_message: "fishbowl_post",
          read_messages: "fishbowl_read",
          set_my_status: "fishbowl_set_status",
        };
        const fbAction = actionMap[name];
        const userAgentHint =
          (args.user_agent_hint as string | undefined) ||
          process.env.UNCLICK_CLIENT_USER_AGENT ||
          "unclick-mcp-server";
        const body = JSON.stringify({ ...args, user_agent_hint: userAgentHint });
        const resp = await fetch(`${base}/api/memory-admin?action=${fbAction}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body,
        });
        const respBody = await resp.json().catch(() => ({}));

        // Mentions lane: for read_messages, derive the subset of messages where
        // the caller is in recipients[]. Recipients are stored as either the
        // caller's emoji (e.g. "🐺") OR the agent_id (e.g. "cowork-bailey-lenovo"),
        // so we match against both. Pure broadcasts (only 'all') are excluded so
        // the lane stays a fast-path for things actually aimed at this agent.
        // The main 'messages' array is unchanged. The caller's emoji is resolved
        // from the 'profiles' array the API already returns, no extra lookup.
        if (
          name === "read_messages" &&
          resp.ok &&
          respBody &&
          typeof respBody === "object" &&
          Array.isArray((respBody as { messages?: unknown }).messages)
        ) {
          const callerId = String(args.agent_id ?? "");
          const profiles = Array.isArray((respBody as { profiles?: unknown }).profiles)
            ? (respBody as { profiles: Array<Record<string, unknown>> }).profiles
            : [];
          const callerProfile = profiles.find((p) => p.agent_id === callerId);
          const callerEmoji =
            callerProfile && typeof callerProfile.emoji === "string"
              ? callerProfile.emoji
              : null;
          const messages = (respBody as { messages: Array<Record<string, unknown>> }).messages;
          const mentions = messages.filter((m) => {
            const recipients = Array.isArray(m.recipients) ? (m.recipients as unknown[]) : [];
            if (recipients.length === 0) return false;
            if (recipients.every((r) => r === "all")) return false;
            if (recipients.includes(callerId)) return true;
            if (callerEmoji !== null && recipients.includes(callerEmoji)) return true;
            return false;
          });
          (respBody as Record<string, unknown>).mentions = mentions;
        }

        return {
          content: [{ type: "text", text: JSON.stringify(respBody, null, 2) }],
          isError: !resp.ok,
        };
      }

      // ── UnClick Memory (direct tools + memory.* endpoints) ───────
      // Resolve new tool names (load_memory, save_fact, etc.) to canonical
      // handler keys (get_startup_context, add_fact, etc.). Old names still
      // work unchanged.
      const memoryKey = MEMORY_TOOL_ALIASES[name] ?? name;
      if (MEMORY_HANDLERS[memoryKey]) {
        const result = await MEMORY_HANDLERS[memoryKey](args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

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
            lines.push(`- **${tool.name}** (\`${tool.slug}\`) -- ${tool.description}`);
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
          lines.push(`### \`${ep.id}\` -- ${ep.name}`);
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

        // Memory endpoints: "memory.add_fact", "memory.store_code", etc.
        if (endpointId.startsWith("memory.")) {
          const op = endpointId.slice("memory.".length);
          const memHandler = MEMORY_HANDLERS[op];
          if (memHandler) {
            const result = await memHandler(params);
            return {
              content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
          }
        }

        // Check local handlers first (avoids remote API dependency)
        const localHandler = LOCAL_CATALOG_HANDLERS[endpointId];
        if (localHandler) {
          const result = await localHandler(params);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }

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

        // Try ADDITIONAL_HANDLERS via dot-to-underscore key conversion ("foo.bar" -> "foo_bar")
        const handlerKey = endpointId.replace(/\./g, "_");
        const additionalHandler = ADDITIONAL_HANDLERS[handlerKey];
        if (additionalHandler) {
          const result = await additionalHandler(params);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }

        // Fall back to remote API for endpoints without local implementations
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

      // ── Additional tools (third-party integrations) ───────────────
      const additionalHandler = ADDITIONAL_HANDLERS[name];
      if (additionalHandler) {
        const result = await additionalHandler(args);
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
      let message: string;
      if (err instanceof Error) {
        message = err.message;
      } else if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
        // Postgres / Supabase / PostgREST errors are plain objects, not Error instances.
        // Surface code / details / hint when present so agents can self-diagnose.
        const e = err as { message: string; code?: string; details?: string; hint?: string };
        const parts: string[] = [e.message];
        if (e.code) parts.push(`(code: ${e.code})`);
        if (e.details) parts.push(`details: ${e.details}`);
        if (e.hint) parts.push(`hint: ${e.hint}`);
        message = parts.join(" ");
      } else {
        message = String(err);
      }
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
  // Server is running -- errors go to stderr so they don't corrupt the MCP stream
  process.stderr.write("UnClick MCP server running on stdio\n");
}

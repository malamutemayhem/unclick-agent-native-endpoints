/**
 * UnClick Memory Admin - Vercel serverless function
 *
 * Route: GET|POST|DELETE /api/memory-admin?action=<action>&...
 *
 * Admin actions (read/write the 6 memory layers):
 *   - status: Returns counts per layer + decay tier distribution
 *   - business_context: Returns all business context entries
 *   - sessions: Returns recent session summaries (limit param)
 *   - facts: Returns extracted facts with optional search (query param)
 *   - library: Returns knowledge library index
 *   - library_doc: Returns full document by slug (slug param)
 *   - conversations: Returns conversation log for a session (session_id param)
 *   - code: Returns code dumps (session_id param optional)
 *   - search: Full-text search across conversation logs (query param)
 *   - delete_fact: Archive a fact by ID (fact_id, POST)
 *   - delete_session: DELETE a session summary by ID (session_id, POST)
 *   - update_business_context: Upsert a business context entry (POST)
 *   - admin_get_setup_guide: Returns client-specific onboarding instructions
 *                            for maximising memory auto-load (client param)
 *
 * BYOD / wizard actions (control plane, keyed by UnClick API key):
 *   - setup: POST with { api_key, service_role_key, supabase_url?, email? }
 *            Validates + JWT-decodes the URL, installs schema via exec_sql
 *            RPC, and stores encrypted creds
 *   - setup_status: GET ?api_key=... — returns whether cloud memory is on
 *   - disconnect: DELETE ?api_key=... — removes a user's memory config
 *   - config: GET with Bearer <api_key> — MCP fetches decrypted creds
 *   - device_check: POST with Bearer <api_key> + fingerprint — heartbeat
 *                   + nudge signal
 *   - list_devices: GET with Bearer <api_key>
 *   - remove_device: DELETE ?fingerprint=... with Bearer (or ?dismiss=1)
 *
 * Build Desk admin actions (Bearer <api_key>, tenant-scoped by sha256hex):
 *   - admin_build_tasks: method=list|get|create|update_status|soft_delete
 *   - admin_build_workers: method=list|register|update|delete|health_check
 *   - admin_build_dispatch: POST with task_id + worker_id (same tenant)
 *
 * Memory reliability instrumentation (Bearer <api_key>):
 *   - log_tool_event: POST from MCP server; inserts memory_load_events row,
 *                     sets was_first_call_in_session via 30-minute window
 *   - admin_memory_load_metrics: 7-day totals, get_startup_context compliance,
 *                                breakdown by client_type
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { streamText, convertToModelMessages, type UIMessage, type ModelMessage } from "ai";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ─── Crypto helpers (mirror /api/credentials) ──────────────────────────────

const PBKDF2_ITERATIONS = 100_000;
const KEY_BYTES = 32;
const IV_BYTES = 12;
const SALT_BYTES = 32;

function sha256hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function deriveKey(apiKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(apiKey, salt, PBKDF2_ITERATIONS, KEY_BYTES, "sha256");
}

function encryptString(plaintext: string, key: Buffer) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("hex"),
    authTag: cipher.getAuthTag().toString("hex"),
    ciphertext: enc.toString("hex"),
  };
}

function decryptString(iv: string, authTag: string, ciphertext: string, key: Buffer): string {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

/** Decode a Supabase service_role JWT and return the project ref. */
function decodeProjectRef(jwt: string): string | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as {
      ref?: string;
      role?: string;
    };
    if (payload.role !== "service_role") return null;
    return payload.ref ?? null;
  } catch {
    return null;
  }
}

/** Load the bundled memory schema SQL. */
function loadSchemaSql(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "..", "packages", "memory-mcp", "schema.sql"),
    path.join(here, "..", "..", "packages", "memory-mcp", "schema.sql"),
    path.join(process.cwd(), "packages", "memory-mcp", "schema.sql"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  }
  return "";
}

/** Try to install the memory schema via the user's Supabase exec_sql RPC. */
async function installSchema(supabaseUrl: string, serviceRoleKey: string): Promise<boolean> {
  const sql = loadSchemaSql();
  if (!sql) return false;
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Probe whether the schema is live. */
async function verifySchema(supabaseUrl: string, serviceRoleKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/business_context?select=id&limit=1`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

function bearerFrom(req: VercelRequest): string {
  return (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "").trim();
}

/**
 * Resolve a Supabase Auth session JWT to the underlying auth.users row.
 * Used by Phase 2 auth actions (claim_api_key, auth_device_*) which are
 * called from the browser with the active supabase-js session token.
 * Returns null if the token is missing, invalid, or expired.
 *
 * Distinct from bearerFrom() + api_keys lookup, which is the
 * api_key-based auth path used by BYOD and memory tooling.
 */
async function resolveSessionUser(
  req: VercelRequest,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<{ id: string; email: string | null } | null> {
  const token = bearerFrom(req);
  if (!token) return null;
  // Tokens that look like UnClick api_keys (uc_* / agt_*) are never
  // valid session JWTs. Reject early to avoid sending garbage to
  // supabase.auth.getUser.
  if (token.startsWith("uc_") || token.startsWith("agt_")) return null;

  try {
    // Use an anon client scoped to this token. getUser() verifies the
    // JWT against the project's Auth secret server-side.
    const scoped = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await scoped.auth.getUser(token);
    if (error || !data?.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  } catch {
    return null;
  }
}

// ─── AI chat helpers ───────────────────────────────────────────────────────

type ChatProvider = "google" | "openai" | "anthropic";

function deriveAiKeyEncryptionKey(): Buffer | null {
  const secret = process.env.AI_KEY_ENCRYPTION_SECRET;
  if (!secret) return null;
  return crypto.createHash("sha256").update(secret).digest();
}

function decryptAiApiKey(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const key = deriveAiKeyEncryptionKey();
  if (!key) return payload; // stored plaintext fallback
  try {
    const buf = Buffer.from(payload, "base64");
    if (buf.length < IV_BYTES + 16 + 1) return null;
    const iv = buf.subarray(0, IV_BYTES);
    const authTag = buf.subarray(buf.length - 16);
    const ciphertext = buf.subarray(IV_BYTES, buf.length - 16);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Resolve a session JWT all the way to the tenant's api_key_hash.
 * Used by Phase 3 admin_* actions so each surface can query mc_*
 * tables scoped to the authenticated user's tenant.
 *
 * Path: Bearer JWT -> auth.users row -> api_keys.user_id -> key_hash.
 * Handles both old-shape (api_key plaintext) and new-shape (key_hash)
 * api_keys rows.
 */
async function resolveSessionTenant(
  req: VercelRequest,
  supabaseUrl: string,
  serviceRoleKey: string,
  sb: ReturnType<typeof createClient>,
): Promise<{ userId: string; email: string | null; apiKeyHash: string; tier: string } | null> {
  const user = await resolveSessionUser(req, supabaseUrl, serviceRoleKey);
  if (!user) return null;

  // New shape: key_hash column from Phase 1 keychain_mvp migration
  const { data: newRow, error: newErr } = await sb
    .from("api_keys")
    .select("key_hash, tier")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!newErr && newRow?.key_hash) {
    return {
      userId: user.id,
      email: user.email,
      apiKeyHash: newRow.key_hash,
      tier: newRow.tier ?? "free",
    };
  }

  // Old shape fallback: api_key plaintext column, compute hash
  try {
    const { data: oldRow } = await sb
      .from("api_keys")
      .select("api_key, status")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (oldRow?.api_key) {
      return {
        userId: user.id,
        email: user.email,
        apiKeyHash: sha256hex(oldRow.api_key),
        tier: "free",
      };
    }
  } catch {
    // 42703 = column doesn't exist on fresh DB, treat as not found
  }

  return null;
}

// ─── Setup guide content ────────────────────────────────────────────────────
//
// Static, client-specific instructions for maximising memory auto-load
// reliability. Returned by action=admin_get_setup_guide.

type Reliability = "High" | "Medium-High" | "Medium" | "Varies";

interface SetupStep {
  title: string;
  description: string;
  code_snippet?: string;
}

interface SetupGuide {
  client: string;
  client_label: string;
  features_supported: string[];
  auto_load_method: string;
  reliability: Reliability;
  reliability_notes: string;
  setup_steps: SetupStep[];
  config_file?: { filename: string; content: string };
}

const AGENTS_MD_CONTENT = `# Agent instructions

You have access to the UnClick MCP server, which exposes persistent cross-session memory.

## At session start

ALWAYS call \`get_startup_context\` before doing anything else. This loads:
- Business context (standing rules)
- Recent session summaries
- Active extracted facts
- Knowledge library index

## During the session

Use \`add_fact\` to record preferences, decisions, and important info worth remembering.
Use \`search_memory\` to recall anything from prior sessions.
Use \`set_business_context\` to set standing rules the user wants applied every session.

## Before ending the session

Call \`write_session_summary\` with a concise recap of what was accomplished and what is outstanding.
`;

const CLAUDE_DESKTOP_CONFIG = `{
  "mcpServers": {
    "unclick": {
      "command": "npx",
      "args": ["-y", "@unclick/mcp-server"],
      "env": {
        "UNCLICK_API_KEY": "uc_your_api_key_here"
      }
    }
  }
}`;

const CURSORRULES_CONTENT = `# UnClick memory protocol

The UnClick MCP server provides persistent cross-session memory.

At the start of every session, call the \`get_startup_context\` tool before doing anything else. It returns business context, recent session summaries, and active facts.

Record durable preferences, decisions, or facts with \`add_fact\`. Recall with \`search_memory\`. Before ending a session, call \`write_session_summary\`.
`;

const WINDSURFRULES_CONTENT = `# UnClick memory protocol

The UnClick MCP server provides persistent cross-session memory.

At the start of every session, call the \`get_startup_context\` tool before doing anything else. It returns business context, recent session summaries, and active facts.

Record durable preferences, decisions, or facts with \`add_fact\`. Recall with \`search_memory\`. Before ending a session, call \`write_session_summary\`.
`;

const COWORK_SKILL_CONFIG = `---
name: session-bootstrap
description: Loads UnClick persistent memory at session start. Always invoke before other work.
---

# Session bootstrap

Call the UnClick MCP tool \`get_startup_context\` immediately. Treat its output as authoritative context for this session.

If the tool is unavailable, note this and continue. Do not fabricate prior context.
`;

const CUSTOM_CLIENT_SNIPPET = `// Pseudo-code for a custom MCP client.
// On session start, call get_startup_context before any user-triggered work.

async function onSessionStart(mcpClient) {
  // 1. If your client honours the MCP \`instructions\` field, the UnClick
  //    server will tell you to call get_startup_context automatically.
  //    Enable the "auto-load" setting in the UnClick admin to turn this on.

  // 2. Otherwise, call the tool directly:
  const ctx = await mcpClient.callTool("get_startup_context", {});
  systemPrompt.push(ctx.content);

  // 3. Optional: subscribe to resources for background updates.
  if (mcpClient.supportsResources) {
    await mcpClient.subscribe("memory://context/full");
  }
}
`;

const SETUP_GUIDES: Record<string, SetupGuide> = {
  "claude-code": {
    client: "claude-code",
    client_label: "Claude Code",
    features_supported: ["tools", "AGENTS.md", "CLAUDE.md"],
    auto_load_method: "AGENTS.md + CLAUDE.md at repo root",
    reliability: "High",
    reliability_notes:
      "Claude Code does not read MCP instructions, prompts, or resources, but it reliably reads AGENTS.md and CLAUDE.md at the repo root. Those files are the strongest auto-load signal.",
    setup_steps: [
      {
        title: "Confirm AGENTS.md exists in your repo",
        description:
          "Drop this content into AGENTS.md (or merge it with any existing file) at the root of each repo where you want memory to auto-load.",
        code_snippet: AGENTS_MD_CONTENT,
      },
      {
        title: "Verify get_startup_context is in the tool list",
        description:
          "Run /mcp inside Claude Code. You should see the UnClick server and the 5 direct memory tools, including get_startup_context.",
      },
      {
        title: "Test by starting a fresh session",
        description:
          "Start a new Claude Code session in the repo. The first turn should call get_startup_context and show context loaded before doing other work.",
      },
    ],
    config_file: { filename: "AGENTS.md", content: AGENTS_MD_CONTENT },
  },

  "claude-desktop": {
    client: "claude-desktop",
    client_label: "Claude Desktop",
    features_supported: ["tools", "prompts", "resources", "instructions (partial)"],
    auto_load_method: "MCP instructions field plus resources subscription",
    reliability: "Medium-High",
    reliability_notes:
      "Claude Desktop honours the MCP instructions field in most recent versions, which is enough to auto-call get_startup_context. Subscribing to memory://context/full as a resource is a belt-and-braces backup.",
    setup_steps: [
      {
        title: "Add UnClick to claude_desktop_config.json",
        description:
          "Open Claude Desktop settings and edit the MCP config. Restart Claude Desktop so the server registers.",
        code_snippet: CLAUDE_DESKTOP_CONFIG,
      },
      {
        title: "Enable auto-load in the UnClick admin",
        description:
          "Turn on auto-load so the server sends its instructions field. Claude Desktop will then call get_startup_context on session start.",
      },
      {
        title: "Optional: subscribe to the memory context resource",
        description:
          "In the MCP panel, subscribe to memory://context/full. Claude Desktop will surface updates if the server pushes them mid-session.",
      },
    ],
    config_file: { filename: "claude_desktop_config.json", content: CLAUDE_DESKTOP_CONFIG },
  },

  cursor: {
    client: "cursor",
    client_label: "Cursor",
    features_supported: ["tools", ".cursorrules"],
    auto_load_method: ".cursorrules file plus tool description reminders",
    reliability: "Medium",
    reliability_notes:
      "Cursor supports MCP tools but not prompts or resources. Auto-load relies on .cursorrules text telling the agent to call get_startup_context. Some sessions may skip the call if the rules file is terse.",
    setup_steps: [
      {
        title: "Add the UnClick MCP server to Cursor",
        description:
          "Open Cursor settings, go to MCP, add a new server pointing at @unclick/mcp-server with your UNCLICK_API_KEY in env.",
        code_snippet: CLAUDE_DESKTOP_CONFIG,
      },
      {
        title: "Create .cursorrules at the project root",
        description:
          "Cursor reads .cursorrules on every session. This is the main hook that persuades the agent to call get_startup_context.",
        code_snippet: CURSORRULES_CONTENT,
      },
      {
        title: "Verify the tool appears in Cursor's MCP panel",
        description:
          "Open the MCP panel and confirm get_startup_context, add_fact, search_memory, write_session_summary, and set_business_context are listed.",
      },
    ],
    config_file: { filename: ".cursorrules", content: CURSORRULES_CONTENT },
  },

  windsurf: {
    client: "windsurf",
    client_label: "Windsurf",
    features_supported: ["tools", ".windsurfrules"],
    auto_load_method: ".windsurfrules file plus tool description reminders",
    reliability: "Medium",
    reliability_notes:
      "Windsurf's MCP support is limited to tools. As with Cursor, the rules file is the main auto-load hook. Reliability improves when the rules file is short and explicit.",
    setup_steps: [
      {
        title: "Add the UnClick MCP server to Windsurf",
        description:
          "In Windsurf's MCP config, add a server running @unclick/mcp-server with your UNCLICK_API_KEY in env. Restart Windsurf.",
        code_snippet: CLAUDE_DESKTOP_CONFIG,
      },
      {
        title: "Create .windsurfrules at the project root",
        description:
          "This file is read at the start of every session. It is the most reliable way to get Windsurf to call get_startup_context.",
        code_snippet: WINDSURFRULES_CONTENT,
      },
      {
        title: "Verify the tool is active",
        description:
          "Start a fresh session and confirm the first action is a call to get_startup_context.",
      },
    ],
    config_file: { filename: ".windsurfrules", content: WINDSURFRULES_CONTENT },
  },

  cowork: {
    client: "cowork",
    client_label: "Cowork",
    features_supported: ["tools", "prompts", "skills"],
    auto_load_method: "Session-bootstrap skill plus MCP prompts",
    reliability: "Medium",
    reliability_notes:
      "Cowork's skills system can invoke MCP tools automatically at session start. The load-memory MCP prompt is a fallback if the skill is not triggered.",
    setup_steps: [
      {
        title: "Install the UnClick MCP server in Cowork",
        description:
          "Add @unclick/mcp-server through the Cowork MCP settings UI. Confirm the 5 direct memory tools show up.",
        code_snippet: CLAUDE_DESKTOP_CONFIG,
      },
      {
        title: "Create or update the session-bootstrap skill",
        description:
          "Save this skill so it runs first on every session. The skill calls get_startup_context before the user's first turn.",
        code_snippet: COWORK_SKILL_CONFIG,
      },
      {
        title: "Fallback: use the load-memory MCP prompt",
        description:
          "If the skill does not fire, ask Cowork to run the UnClick load-memory prompt. It calls get_startup_context and returns the context inline.",
      },
    ],
    config_file: { filename: "session-bootstrap.md", content: COWORK_SKILL_CONFIG },
  },

  custom: {
    client: "custom",
    client_label: "Custom MCP client",
    features_supported: ["depends on client"],
    auto_load_method: "Depends on what the client supports",
    reliability: "Varies",
    reliability_notes:
      "Reliability depends on how fully the client implements the MCP spec. Clients that honour the instructions field get auto-load for free. Others need to invoke get_startup_context from client code.",
    setup_steps: [
      {
        title: "Check whether your client honours the MCP instructions field",
        description:
          "If yes, enabling auto-load in the UnClick admin is enough. The server will send a systemPrompt asking the agent to call get_startup_context.",
      },
      {
        title: "If the instructions field is not honoured, call the tool yourself",
        description:
          "Invoke get_startup_context from client code on session start and feed its output into the system prompt or first message.",
        code_snippet: CUSTOM_CLIENT_SNIPPET,
      },
      {
        title: "Optional: subscribe to memory resources",
        description:
          "If your client supports MCP resources, subscribe to memory://context/full to receive updates when facts or business context change.",
      },
    ],
    config_file: { filename: "mcp-client-init.ts", content: CUSTOM_CLIENT_SNIPPET },
  },
};

function buildSetupGuide(client: string): SetupGuide | null {
  return SETUP_GUIDES[client] ?? null;
}

async function normaliseChatMessages(
  raw: unknown,
): Promise<ModelMessage[] | { error: string }> {
  if (!Array.isArray(raw)) return { error: "messages must be an array" };
  if (raw.length === 0) return { error: "messages cannot be empty" };

  // useChat v6 sends UIMessage[] with `parts`. Simple clients send `content`.
  const looksLikeUiMessages = raw.every(
    (m) => m && typeof m === "object" && Array.isArray((m as { parts?: unknown }).parts),
  );

  if (looksLikeUiMessages) {
    try {
      return await convertToModelMessages(raw as UIMessage[]);
    } catch (err) {
      return { error: `Invalid UI messages: ${(err as Error).message}` };
    }
  }

  const out: ModelMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") return { error: "Invalid message shape" };
    const role = (m as { role?: string }).role;
    const content = (m as { content?: string }).content;
    if (role !== "user" && role !== "assistant" && role !== "system") {
      return { error: `Invalid role: ${String(role)}` };
    }
    if (typeof content !== "string") return { error: "content must be a string" };
    out.push({ role, content } as ModelMessage);
  }
  return out;
}

// Use `any` here because the supabase-js SupabaseClient default-typed generics
// conflict with `ReturnType<typeof createClient>` between versions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildAiChatContext(supabase: any): Promise<{
  businessContext: unknown[];
  standingRules: unknown[];
  facts: unknown[];
  sessions: unknown[];
}> {
  const [bcRes, factsRes, sessionsRes] = await Promise.all([
    supabase.from("business_context").select("*").order("priority", { ascending: false }),
    supabase
      .from("extracted_facts")
      .select("id, fact, category, decay_tier, created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("session_summaries")
      .select("id, summary, topics, open_loops, decisions, platform, created_at")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const businessContext = (bcRes.data ?? []) as Array<{ category?: string }>;
  const standingRules = businessContext.filter((r) => r.category === "standing_rules");

  return {
    businessContext,
    standingRules,
    facts: (factsRes.data ?? []) as unknown[],
    sessions: (sessionsRes.data ?? []) as unknown[],
  };
}

async function resolveAiChatModel(opts: {
  provider: ChatProvider;
  model: string;
  userApiKey: string | null;
}) {
  const fallbackKey = process.env.AI_CHAT_DEFAULT_KEY ?? undefined;
  const apiKey = opts.userApiKey ?? fallbackKey;

  if (opts.provider === "google") {
    const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
    const g = createGoogleGenerativeAI({ apiKey });
    return g(opts.model);
  }
  if (opts.provider === "openai") {
    const { createOpenAI } = await import("@ai-sdk/openai");
    const o = createOpenAI({ apiKey });
    return o(opts.model);
  }
  if (opts.provider === "anthropic") {
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    const a = createAnthropic({ apiKey });
    return a(opts.model);
  }
  throw new Error(`Unsupported provider: ${opts.provider}`);
}

const DEFAULT_AI_CHAT_SYSTEM_PROMPT = `You are the UnClick AI Assistant for this workspace. You have access to this user's full business context and memory. Answer questions about their data, help them understand their setup, and suggest improvements.

You are NOT a general-purpose AI. You specifically help with:
- Answering questions about their business context, facts, and session history
- Explaining what UnClick Memory contains and how it is being used
- Suggesting improvements to their memory configuration
- Summarizing recent session activity
- Helping draft or refine standing rules and business context entries

RULES:
- Be concise. This is an admin tool, not a conversation.
- Reference specific facts, sessions, or context entries when answering.
- If you do not have enough context to answer, say so. Do not make things up.
- If the user asks about something outside their UnClick data, politely redirect.
- No em dashes. Use -- instead.`;

// ─── Handler ───────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Database service unavailable" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const action = (req.query.action as string) || "status";

  try {
    switch (action) {
      case "admin_get_setup_guide": {
        const client = String(req.query.client ?? "").trim().toLowerCase();
        const guide = buildSetupGuide(client);
        if (!guide) {
          return res.status(400).json({
            error: "Unknown client. Use one of: claude-code, claude-desktop, cursor, windsurf, cowork, custom.",
          });
        }
        return res.status(200).json(guide);
      }

      case "status": {
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const apiKeyHash = sha256hex(apiKey);

        const [bc, lib, sessions, facts, convos, code] = await Promise.all([
          supabase.from("mc_business_context").select("id", { count: "exact", head: true }).eq("api_key_hash", apiKeyHash),
          supabase.from("mc_knowledge_library").select("id", { count: "exact", head: true }).eq("api_key_hash", apiKeyHash),
          supabase.from("mc_session_summaries").select("id", { count: "exact", head: true }).eq("api_key_hash", apiKeyHash),
          supabase.from("mc_extracted_facts").select("id", { count: "exact", head: true }).eq("api_key_hash", apiKeyHash),
          supabase.from("mc_conversation_log").select("id", { count: "exact", head: true }).eq("api_key_hash", apiKeyHash),
          supabase.from("mc_code_dumps").select("id", { count: "exact", head: true }).eq("api_key_hash", apiKeyHash),
        ]);

        // Decay tier distribution from facts
        const { data: factsTiers } = await supabase
          .from("mc_extracted_facts")
          .select("decay_tier, status")
          .eq("api_key_hash", apiKeyHash);

        const tiers = { hot: 0, warm: 0, cold: 0 };
        const statuses = { active: 0, superseded: 0, archived: 0, disputed: 0 };
        for (const f of factsTiers ?? []) {
          if (f.decay_tier && tiers[f.decay_tier as keyof typeof tiers] !== undefined) {
            tiers[f.decay_tier as keyof typeof tiers]++;
          }
          if (f.status && statuses[f.status as keyof typeof statuses] !== undefined) {
            statuses[f.status as keyof typeof statuses]++;
          }
        }

        return res.status(200).json({
          mode: "supabase",
          layers: {
            business_context: bc.count ?? 0,
            knowledge_library: lib.count ?? 0,
            session_summaries: sessions.count ?? 0,
            extracted_facts: facts.count ?? 0,
            conversation_log: convos.count ?? 0,
            code_dumps: code.count ?? 0,
          },
          decay_tiers: tiers,
          fact_statuses: statuses,
        });
      }

      case "business_context": {
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const apiKeyHash = sha256hex(apiKey);

        const { data, error } = await supabase
          .from("mc_business_context")
          .select("*")
          .eq("api_key_hash", apiKeyHash)
          .order("category")
          .order("key");

        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      case "sessions": {
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const apiKeyHash = sha256hex(apiKey);
        const limit = parseInt(req.query.limit as string) || 20;

        const { data, error } = await supabase
          .from("mc_session_summaries")
          .select("*")
          .eq("api_key_hash", apiKeyHash)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      case "facts": {
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const apiKeyHash = sha256hex(apiKey);

        const query = req.query.query as string;
        const showAll = req.query.show_all === "true";
        let q = supabase
          .from("mc_extracted_facts")
          .select("*")
          .eq("api_key_hash", apiKeyHash)
          .order("created_at", { ascending: false })
          .limit(100);

        if (!showAll) {
          q = q.eq("status", "active");
        }

        const { data, error } = await q;
        if (error) throw error;

        let results = data ?? [];
        if (query) {
          const lower = query.toLowerCase();
          results = results.filter(
            (f: { fact: string; category: string }) =>
              f.fact.toLowerCase().includes(lower) || f.category.toLowerCase().includes(lower)
          );
        }

        return res.status(200).json({ data: results });
      }

      case "library": {
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const apiKeyHash = sha256hex(apiKey);

        const { data, error } = await supabase
          .from("mc_knowledge_library")
          .select("slug, title, category, tags, version, updated_at, created_at")
          .eq("api_key_hash", apiKeyHash)
          .order("category")
          .order("title");

        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      case "library_doc": {
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const apiKeyHash = sha256hex(apiKey);
        const slug = req.query.slug as string;
        if (!slug) return res.status(400).json({ error: "slug parameter required" });

        const { data, error } = await supabase
          .from("mc_knowledge_library")
          .select("*")
          .eq("api_key_hash", apiKeyHash)
          .eq("slug", slug)
          .single();

        if (error) throw error;

        const { data: history } = await supabase
          .from("mc_knowledge_library_history")
          .select("*")
          .eq("api_key_hash", apiKeyHash)
          .eq("slug", slug)
          .order("version", { ascending: false });

        return res.status(200).json({ doc: data, history: history ?? [] });
      }

      case "conversations": {
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const apiKeyHash = sha256hex(apiKey);
        const sessionId = req.query.session_id as string;

        if (!sessionId) {
          // Return distinct session IDs with message counts
          const { data, error } = await supabase
            .from("mc_conversation_log")
            .select("session_id, created_at")
            .eq("api_key_hash", apiKeyHash)
            .order("created_at", { ascending: false })
            .limit(500);

          if (error) throw error;

          const sessionMap = new Map<string, { count: number; last_message: string }>();
          for (const msg of data ?? []) {
            const existing = sessionMap.get(msg.session_id);
            if (existing) {
              existing.count++;
            } else {
              sessionMap.set(msg.session_id, { count: 1, last_message: msg.created_at });
            }
          }

          const sessions = Array.from(sessionMap.entries()).map(([id, info]) => ({
            session_id: id,
            message_count: info.count,
            last_message: info.last_message,
          }));

          return res.status(200).json({ data: sessions });
        }

        const { data, error } = await supabase
          .from("mc_conversation_log")
          .select("*")
          .eq("api_key_hash", apiKeyHash)
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      case "code": {
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const apiKeyHash = sha256hex(apiKey);
        const sessionId = req.query.session_id as string;

        let q = supabase
          .from("mc_code_dumps")
          .select("*")
          .eq("api_key_hash", apiKeyHash)
          .order("created_at", { ascending: false })
          .limit(50);

        if (sessionId) {
          q = q.eq("session_id", sessionId);
        }

        const { data, error } = await q;
        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      case "search": {
        const query = req.query.query as string;
        if (!query) return res.status(400).json({ error: "query parameter required" });

        const maxResults = parseInt(req.query.max_results as string) || 20;
        const { data, error } = await supabase.rpc("search_memory", {
          search_query: query,
          max_results: maxResults,
        });

        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      case "delete_fact": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const apiKeyHash = sha256hex(apiKey);
        const factId = req.body?.fact_id || req.query.fact_id;
        if (!factId) return res.status(400).json({ error: "fact_id required" });

        const { error } = await supabase
          .from("mc_extracted_facts")
          .update({ status: "archived" })
          .eq("id", factId)
          .eq("api_key_hash", apiKeyHash);

        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      case "delete_session": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const apiKeyHash = sha256hex(apiKey);
        const sessionId = req.body?.session_id || req.query.session_id;
        if (!sessionId) return res.status(400).json({ error: "session_id required" });

        const { error } = await supabase
          .from("mc_session_summaries")
          .delete()
          .eq("id", sessionId)
          .eq("api_key_hash", apiKeyHash);

        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      case "update_business_context": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const apiKeyHash = sha256hex(apiKey);
        const { category, key, value, priority } = req.body ?? {};
        if (!category || !key || value === undefined) {
          return res.status(400).json({ error: "category, key, and value required" });
        }

        const { error } = await supabase
          .from("mc_business_context")
          .upsert(
            {
              api_key_hash: apiKeyHash,
              category,
              key,
              value: typeof value === "string" ? value : JSON.stringify(value),
              priority: priority ?? 0,
              decay_tier: "hot",
              updated_at: new Date().toISOString(),
              last_accessed: new Date().toISOString(),
            },
            { onConflict: "category,key" }
          );

        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      // ── BYOD / wizard actions ────────────────────────────────────────
      case "setup_status": {
        const apiKey = String(req.query.api_key ?? "").trim();
        if (!apiKey) return res.status(400).json({ error: "api_key required" });
        const { data, error } = await supabase
          .from("memory_configs")
          .select("supabase_url,schema_installed,schema_installed_at,last_used_at,updated_at")
          .eq("api_key_hash", sha256hex(apiKey))
          .maybeSingle();
        if (error) throw error;
        if (!data) return res.status(200).json({ configured: false });
        return res.status(200).json({ configured: true, ...data });
      }

      case "setup": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const body = req.body as {
          api_key?: string;
          service_role_key?: string;
          supabase_url?: string;
          email?: string;
        };
        const apiKey = (body?.api_key ?? "").trim();
        const serviceRoleKey = (body?.service_role_key ?? "").trim();
        let userSupabaseUrl = (body?.supabase_url ?? "").trim();
        const email = body?.email?.trim().toLowerCase();

        if (!apiKey) return res.status(400).json({ error: "api_key required" });
        if (!apiKey.startsWith("uc_") && !apiKey.startsWith("agt_")) {
          return res.status(400).json({ error: "Invalid api_key format" });
        }
        if (!serviceRoleKey || serviceRoleKey.length < 40) {
          return res.status(400).json({ error: "service_role_key looks invalid" });
        }

        if (!userSupabaseUrl) {
          const ref = decodeProjectRef(serviceRoleKey);
          if (!ref) {
            return res.status(400).json({
              error: "Couldn't read project ref from key. Paste the Supabase URL too.",
              need_url: true,
            });
          }
          userSupabaseUrl = `https://${ref}.supabase.co`;
        }

        // Validate creds by pinging the project.
        const pingRes = await fetch(`${userSupabaseUrl}/rest/v1/`, {
          headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
        });
        if (!pingRes.ok && pingRes.status !== 404) {
          return res.status(400).json({
            error: `Supabase rejected that key (HTTP ${pingRes.status}). Double-check you copied service_role, not anon.`,
          });
        }

        const installed = await installSchema(userSupabaseUrl, serviceRoleKey);
        const schemaInstalled = installed || (await verifySchema(userSupabaseUrl, serviceRoleKey));

        const salt = crypto.randomBytes(SALT_BYTES);
        const encKey = deriveKey(apiKey, salt);
        const { iv, authTag, ciphertext } = encryptString(serviceRoleKey, encKey);

        const { error } = await supabase
          .from("memory_configs")
          .upsert(
            {
              api_key_hash: sha256hex(apiKey),
              email: email ?? null,
              supabase_url: userSupabaseUrl,
              encrypted_service_key: ciphertext,
              encryption_iv: iv,
              encryption_tag: authTag,
              encryption_salt: salt.toString("hex"),
              schema_installed: schemaInstalled,
              schema_installed_at: schemaInstalled ? new Date().toISOString() : null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "api_key_hash" }
          );
        if (error) throw error;

        return res.status(200).json({
          success: true,
          supabase_url: userSupabaseUrl,
          schema_installed: schemaInstalled,
          schema_sql: schemaInstalled ? undefined : loadSchemaSql(),
          message: schemaInstalled
            ? "Memory cloud sync is live. Restart your MCP client."
            : "Credentials saved. Run the included SQL in your Supabase SQL editor, then you're done.",
        });
      }

      case "disconnect": {
        if (req.method !== "DELETE") return res.status(405).json({ error: "DELETE required" });
        const apiKey = String(req.query.api_key ?? "").trim();
        if (!apiKey) return res.status(400).json({ error: "api_key required" });
        const { error } = await supabase
          .from("memory_configs")
          .delete()
          .eq("api_key_hash", sha256hex(apiKey));
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      case "config": {
        // MCP server calls this at startup.
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const { data, error } = await supabase
          .from("memory_configs")
          .select("*")
          .eq("api_key_hash", sha256hex(apiKey))
          .maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ configured: false, error: "No memory config" });

        try {
          const salt = Buffer.from(data.encryption_salt, "hex");
          const key = deriveKey(apiKey, salt);
          const serviceRoleKey = decryptString(
            data.encryption_iv,
            data.encryption_tag,
            data.encrypted_service_key,
            key
          );
          // Fire-and-forget last_used_at update
          supabase
            .from("memory_configs")
            .update({ last_used_at: new Date().toISOString() })
            .eq("api_key_hash", sha256hex(apiKey))
            .then(() => {});
          return res.status(200).json({
            configured: true,
            supabase_url: data.supabase_url,
            service_role_key: serviceRoleKey,
            schema_installed: data.schema_installed,
          });
        } catch {
          return res.status(500).json({
            error: "Failed to decrypt memory config. Your API key may have changed — rerun setup.",
          });
        }
      }

      case "device_check": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const body = req.body as {
          device_fingerprint?: string;
          label?: string;
          platform?: string;
          storage_mode?: "local" | "cloud";
        };
        const fp = (body?.device_fingerprint ?? "").trim();
        if (!fp) return res.status(400).json({ error: "device_fingerprint required" });
        const mode = body?.storage_mode === "cloud" ? "cloud" : "local";
        const apiKeyHash = sha256hex(apiKey);

        const { error: upErr } = await supabase
          .from("memory_devices")
          .upsert(
            {
              api_key_hash: apiKeyHash,
              device_fingerprint: fp,
              label: body?.label ?? null,
              platform: body?.platform ?? null,
              storage_mode: mode,
              last_seen: new Date().toISOString(),
            },
            { onConflict: "api_key_hash,device_fingerprint" }
          );
        if (upErr) throw upErr;

        const { data: rows } = await supabase
          .from("memory_devices")
          .select("storage_mode,nudge_dismissed")
          .eq("api_key_hash", apiKeyHash);

        const list = (rows ?? []) as Array<{ storage_mode: string; nudge_dismissed: boolean }>;
        const totalDevices = list.length;
        const localDevices = list.filter((r) => r.storage_mode === "local").length;
        const anyDismissed = list.some((r) => r.nudge_dismissed);
        const nudge = mode === "local" && totalDevices >= 2 && localDevices >= 1 && !anyDismissed;

        return res.status(200).json({
          success: true,
          total_devices: totalDevices,
          local_devices: localDevices,
          nudge,
          nudge_message: nudge
            ? `You're using UnClick memory on ${totalDevices} machines. Turn on cloud sync: https://unclick.world/memory/setup`
            : null,
        });
      }

      case "list_devices": {
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const { data, error } = await supabase
          .from("memory_devices")
          .select("*")
          .eq("api_key_hash", sha256hex(apiKey))
          .order("last_seen", { ascending: false });
        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      // ── Instrumentation: log a tool call from the MCP server ─────────
      case "log_tool_event": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const body = (req.body ?? {}) as {
          api_key_hash?: string | null;
          session_id?: string;
          client_name?: string | null;
          client_version?: string | null;
          first_tool?: string | null;
          context_loaded?: boolean;
          tools_called_before_context?: number;
          instructions_sent?: boolean;
          prompt_used?: boolean;
          resource_read?: boolean;
          autoload_method?: string | null;
        };

        const bearer = bearerFrom(req);
        const apiKeyHash = body.api_key_hash ?? (bearer ? sha256hex(bearer) : null);

        const { error } = await supabase.from("memory_load_events").insert({
          api_key_hash: apiKeyHash,
          session_id: body.session_id ?? null,
          client_name: body.client_name ?? null,
          client_version: body.client_version ?? null,
          first_tool: body.first_tool ?? null,
          context_loaded: Boolean(body.context_loaded),
          tools_called_before_context: body.tools_called_before_context ?? 0,
          instructions_sent: Boolean(body.instructions_sent),
          prompt_used: Boolean(body.prompt_used),
          resource_read: Boolean(body.resource_read),
          autoload_method: body.autoload_method ?? "none",
        });
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      // ── Admin: load metrics (rolling 7-day window + per-client / per-method
      //    breakdown + trend vs. prior week) ──────────────────────────────
      case "admin_memory_load_metrics": {
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const apiKeyHash = sha256hex(apiKey);

        const now = Date.now();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const windowStart = new Date(now - sevenDaysMs).toISOString();
        const prevWindowStart = new Date(now - 2 * sevenDaysMs).toISOString();

        const { data: recent, error } = await supabase
          .from("memory_load_events")
          .select(
            "created_at,client_name,client_version,first_tool,context_loaded," +
            "tools_called_before_context,instructions_sent,prompt_used,resource_read,autoload_method"
          )
          .eq("api_key_hash", apiKeyHash)
          .gte("created_at", prevWindowStart)
          .order("created_at", { ascending: false })
          .limit(5000);
        if (error) throw error;

        type Row = {
          created_at: string;
          client_name: string | null;
          client_version: string | null;
          first_tool: string | null;
          context_loaded: boolean | null;
          tools_called_before_context: number | null;
          instructions_sent: boolean | null;
          prompt_used: boolean | null;
          resource_read: boolean | null;
          autoload_method: string | null;
        };

        const rows = (recent ?? []) as Row[];
        const current = rows.filter((r) => r.created_at >= windowStart);
        const previous = rows.filter(
          (r) => r.created_at < windowStart && r.created_at >= prevWindowStart
        );

        const totalSessions = current.length;
        const loadedCount = current.filter((r) => r.context_loaded).length;
        const loadRate = totalSessions === 0 ? 0 : (loadedCount / totalSessions) * 100;

        const byMethod: Record<string, number> = {
          instructions: 0,
          prompt: 0,
          resource: 0,
          tool_description: 0,
          manual: 0,
          none: 0,
        };
        for (const r of current) {
          const m = r.autoload_method ?? "none";
          byMethod[m] = (byMethod[m] ?? 0) + 1;
        }

        const byClient: Record<
          string,
          { total: number; loaded: number; rate: number }
        > = {};
        for (const r of current) {
          const name = r.client_name ?? "unknown";
          const entry = (byClient[name] ??= { total: 0, loaded: 0, rate: 0 });
          entry.total += 1;
          if (r.context_loaded) entry.loaded += 1;
        }
        for (const entry of Object.values(byClient)) {
          entry.rate = entry.total === 0 ? 0 : (entry.loaded / entry.total) * 100;
        }

        const prevTotal = previous.length;
        let direction: "up" | "down" | "stable" = "stable";
        if (totalSessions > prevTotal) direction = "up";
        else if (totalSessions < prevTotal) direction = "down";

        const missing = current
          .filter((r) => !r.context_loaded)
          .slice(0, 5)
          .map((r) => ({
            created_at: r.created_at,
            client_name: r.client_name,
            client_version: r.client_version,
            first_tool: r.first_tool,
          }));

        return res.status(200).json({
          total_sessions_7d: totalSessions,
          context_loaded_count: loadedCount,
          load_rate_percent: Math.round(loadRate * 10) / 10,
          by_method: byMethod,
          by_client: byClient,
          trend: {
            current_week: totalSessions,
            previous_week: prevTotal,
            direction,
          },
          sessions_without_context: {
            count: totalSessions - loadedCount,
            recent: missing,
          },
        });
      }

      // ── Admin: sessions in the last 24h where context was never loaded
      //    before the first tool call ───────────────────────────────────
      case "admin_missed_context_alerts": {
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const apiKeyHash = sha256hex(apiKey);

        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data, error } = await supabase
          .from("memory_load_events")
          .select(
            "created_at,session_id,client_name,client_version,first_tool," +
            "tools_called_before_context,context_loaded,autoload_method"
          )
          .eq("api_key_hash", apiKeyHash)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(1000);
        if (error) throw error;

        type Row = {
          created_at: string;
          session_id: string | null;
          client_name: string | null;
          client_version: string | null;
          first_tool: string | null;
          tools_called_before_context: number | null;
          context_loaded: boolean | null;
          autoload_method: string | null;
        };

        const rows = (data ?? []) as Row[];
        const missed = rows.filter((r) => {
          if (!r.first_tool) return false;
          const neverLoaded = !r.context_loaded;
          const loadedLate = Boolean(r.context_loaded) && r.first_tool !== "get_startup_context";
          return neverLoaded || loadedLate;
        });

        const byClient: Record<
          string,
          {
            total: number;
            sessions: Array<{
              created_at: string;
              session_id: string | null;
              client_version: string | null;
              first_tool: string | null;
              tools_called_before_context: number;
              context_ever_loaded: boolean;
            }>;
          }
        > = {};

        for (const r of missed) {
          const name = r.client_name ?? "unknown";
          const entry = (byClient[name] ??= { total: 0, sessions: [] });
          entry.total += 1;
          entry.sessions.push({
            created_at: r.created_at,
            session_id: r.session_id,
            client_version: r.client_version,
            first_tool: r.first_tool,
            tools_called_before_context: r.tools_called_before_context ?? 0,
            context_ever_loaded: Boolean(r.context_loaded),
          });
        }

        return res.status(200).json({
          window_hours: 24,
          total_missed: missed.length,
          by_client: byClient,
        });
      }

      case "remove_device": {
        if (req.method !== "DELETE") return res.status(405).json({ error: "DELETE required" });
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const fp = String(req.query.fingerprint ?? "").trim();
        if (!fp) return res.status(400).json({ error: "fingerprint required" });
        const apiKeyHash = sha256hex(apiKey);

        if (req.query.dismiss === "1") {
          const { error } = await supabase
            .from("memory_devices")
            .update({ nudge_dismissed: true })
            .eq("api_key_hash", apiKeyHash)
            .eq("device_fingerprint", fp);
          if (error) throw error;
          return res.status(200).json({ success: true });
        }

        const { error } = await supabase
          .from("memory_devices")
          .delete()
          .eq("api_key_hash", apiKeyHash)
          .eq("device_fingerprint", fp);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      // ── Phase 4: Admin dashboard actions ───────────────────────────────

      case "admin_business_context": {
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const tenant = sha256hex(apiKey);
        const method = (req.body?.method ?? req.query.method ?? "list") as string;

        switch (method) {
          case "list": {
            const { data, error } = await supabase
              .from("mc_business_context")
              .select("*")
              .eq("api_key_hash", tenant)
              .order("priority", { ascending: true });
            if (error) throw error;
            return res.status(200).json({ data: data ?? [] });
          }
          case "create": {
            if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
            const { category, key, value } = req.body ?? {};
            if (!category || !key || value === undefined) {
              return res.status(400).json({ error: "category, key, and value required" });
            }
            // Auto-increment priority
            const { data: maxRow } = await supabase
              .from("mc_business_context")
              .select("priority")
              .eq("api_key_hash", tenant)
              .order("priority", { ascending: false })
              .limit(1);
            const nextPriority = ((maxRow?.[0]?.priority as number) ?? 0) + 1;
            const { data, error } = await supabase
              .from("mc_business_context")
              .insert({
                api_key_hash: tenant,
                category,
                key,
                value: typeof value === "string" ? value : JSON.stringify(value),
                priority: nextPriority,
                decay_tier: "hot",
                updated_at: new Date().toISOString(),
                last_accessed: new Date().toISOString(),
              })
              .select()
              .single();
            if (error) throw error;
            return res.status(200).json({ success: true, data });
          }
          case "update": {
            if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
            const { id, value: val, priority: pri, category: cat } = req.body ?? {};
            if (!id) return res.status(400).json({ error: "id required" });
            const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
            if (val !== undefined) updates.value = typeof val === "string" ? val : JSON.stringify(val);
            if (pri !== undefined) updates.priority = pri;
            if (cat !== undefined) updates.category = cat;
            const { error } = await supabase.from("mc_business_context").update(updates).eq("id", id).eq("api_key_hash", tenant);
            if (error) throw error;
            return res.status(200).json({ success: true });
          }
          case "delete": {
            if (req.method !== "POST" && req.method !== "DELETE") {
              return res.status(405).json({ error: "POST or DELETE required" });
            }
            const delId = req.body?.id ?? req.query.id;
            if (!delId) return res.status(400).json({ error: "id required" });
            const { error } = await supabase.from("mc_business_context").delete().eq("id", delId).eq("api_key_hash", tenant);
            if (error) throw error;
            return res.status(200).json({ success: true });
          }
          case "reorder": {
            if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
            const items = req.body?.items as Array<{ id: string; priority: number }>;
            if (!items?.length) return res.status(400).json({ error: "items array required" });
            for (const item of items) {
              await supabase
                .from("mc_business_context")
                .update({ priority: item.priority, updated_at: new Date().toISOString() })
                .eq("id", item.id)
                .eq("api_key_hash", tenant);
            }
            return res.status(200).json({ success: true });
          }
          default:
            return res.status(400).json({ error: `Unknown method: ${method}` });
        }
      }

      case "admin_sessions": {
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const apiKeyHash = sha256hex(apiKey);
        const method = (req.body?.method ?? req.query.method ?? "list") as string;

        if (method === "transcript") {
          const sessionId = req.body?.session_id ?? req.query.session_id;
          if (!sessionId) return res.status(400).json({ error: "session_id required" });
          const { data, error } = await supabase
            .from("mc_conversation_log")
            .select("*")
            .eq("api_key_hash", apiKeyHash)
            .eq("session_id", sessionId)
            .order("created_at", { ascending: true });
          if (error) throw error;
          return res.status(200).json({ data: data ?? [] });
        }

        // list
        const { data, error } = await supabase
          .from("mc_session_summaries")
          .select("*")
          .eq("api_key_hash", apiKeyHash)
          .order("created_at", { ascending: false })
          .limit(20);
        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      case "admin_library": {
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const apiKeyHash = sha256hex(apiKey);
        const method = (req.body?.method ?? req.query.method ?? "list") as string;

        if (method === "view") {
          const docId = req.body?.id ?? req.query.id;
          if (!docId) return res.status(400).json({ error: "id required" });
          const { data, error } = await supabase
            .from("mc_knowledge_library")
            .select("*")
            .eq("api_key_hash", apiKeyHash)
            .eq("id", docId)
            .single();
          if (error) throw error;
          return res.status(200).json({ data });
        }

        if (method === "history") {
          const slug = (req.body?.slug ?? req.query.slug) as string;
          if (!slug) return res.status(400).json({ error: "slug required" });
          const { data, error } = await supabase
            .from("mc_knowledge_library_history")
            .select("*")
            .eq("api_key_hash", apiKeyHash)
            .eq("slug", slug)
            .order("version", { ascending: false });
          if (error) throw error;
          return res.status(200).json({ data: data ?? [] });
        }

        // list
        const { data, error } = await supabase
          .from("mc_knowledge_library")
          .select("id, slug, title, updated_at, version, decay_tier, category, tags")
          .eq("api_key_hash", apiKeyHash)
          .order("updated_at", { ascending: false });
        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      case "admin_memory_activity": {
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const apiKeyHash = sha256hex(apiKey);

        // Facts by day (last 30 days)
        const { data: allFacts } = await supabase
          .from("mc_extracted_facts")
          .select("created_at")
          .eq("api_key_hash", apiKeyHash)
          .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
          .order("created_at", { ascending: true });

        const factsByDay: Record<string, number> = {};
        for (const f of allFacts ?? []) {
          const day = (f.created_at as string).slice(0, 10);
          factsByDay[day] = (factsByDay[day] ?? 0) + 1;
        }

        // Storage counts (reuse status logic)
        const [bc, lib, sessions, facts, convos, code] = await Promise.all([
          supabase.from("mc_business_context").select("id", { count: "exact", head: true }).eq("api_key_hash", apiKeyHash),
          supabase.from("mc_knowledge_library").select("id", { count: "exact", head: true }).eq("api_key_hash", apiKeyHash),
          supabase.from("mc_session_summaries").select("id", { count: "exact", head: true }).eq("api_key_hash", apiKeyHash),
          supabase.from("mc_extracted_facts").select("id", { count: "exact", head: true }).eq("api_key_hash", apiKeyHash),
          supabase.from("mc_conversation_log").select("id", { count: "exact", head: true }).eq("api_key_hash", apiKeyHash),
          supabase.from("mc_code_dumps").select("id", { count: "exact", head: true }).eq("api_key_hash", apiKeyHash),
        ]);

        // Recent decay transitions
        const { data: recentDecay } = await supabase
          .from("mc_extracted_facts")
          .select("id, fact, category, decay_tier, updated_at")
          .eq("api_key_hash", apiKeyHash)
          .neq("decay_tier", "hot")
          .order("updated_at", { ascending: false })
          .limit(20);

        // Most accessed facts
        const { data: topFacts } = await supabase
          .from("mc_extracted_facts")
          .select("id, fact, category, access_count, decay_tier")
          .eq("api_key_hash", apiKeyHash)
          .eq("status", "active")
          .order("access_count", { ascending: false })
          .limit(10);

        return res.status(200).json({
          facts_by_day: factsByDay,
          storage: {
            business_context: bc.count ?? 0,
            knowledge_library: lib.count ?? 0,
            session_summaries: sessions.count ?? 0,
            extracted_facts: facts.count ?? 0,
            conversation_log: convos.count ?? 0,
            code_dumps: code.count ?? 0,
            total: (bc.count ?? 0) + (lib.count ?? 0) + (sessions.count ?? 0) +
                   (facts.count ?? 0) + (convos.count ?? 0) + (code.count ?? 0),
          },
          recent_decay: recentDecay ?? [],
          top_facts: topFacts ?? [],
        });
      }

      case "admin_tools": {
        const tenant = await resolveSessionTenant(req, supabaseUrl, supabaseKey, supabase);
        if (!tenant) return res.status(401).json({ error: "Not signed in" });

        // Metering events grouped by operation
        const { data: metering } = await supabase
          .from("metering_events")
          .select("operation")
          .eq("key_hash", tenant.apiKeyHash);

        const meteringMap: Record<string, { count: number; last_used?: string }> = {};
        for (const m of metering ?? []) {
          const op = m.operation as string;
          if (!meteringMap[op]) meteringMap[op] = { count: 0 };
          meteringMap[op].count++;
        }

        // Platform connectors with user's credential status
        const { data: connectors } = await supabase
          .from("platform_connectors")
          .select("*");

        const { data: creds } = await supabase
          .from("platform_credentials")
          .select("platform, is_valid, last_tested_at")
          .eq("key_hash", tenant.apiKeyHash);

        const credMap = new Map<string, { is_valid: boolean; last_tested_at: string | null }>();
        for (const c of creds ?? []) {
          credMap.set(c.platform as string, {
            is_valid: c.is_valid as boolean,
            last_tested_at: c.last_tested_at as string | null,
          });
        }

        const enrichedConnectors = (connectors ?? []).map((pc) => ({
          ...pc,
          credential: credMap.get(pc.id as string) ?? null,
        }));

        return res.status(200).json({
          metering: meteringMap,
          connectors: enrichedConnectors,
        });
      }

      case "admin_update_fact": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const tenant = await resolveSessionTenant(req, supabaseUrl, supabaseKey, supabase);
        if (!tenant) return res.status(401).json({ error: "Not signed in or no linked API key" });

        const { fact_id: fId, fact: newText } = req.body ?? {};
        if (!fId || !newText) {
          return res.status(400).json({ error: "fact_id and fact required" });
        }

        const { error } = await supabase
          .from("mc_extracted_facts")
          .update({ fact: newText, updated_at: new Date().toISOString() })
          .eq("id", fId)
          .eq("api_key_hash", tenant.apiKeyHash);

        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      // ── Cron actions ────────────────────────────────────────────────────
      case "nightly_decay": {
        // Vercel cron sends Authorization: Bearer <CRON_SECRET>. Reject any
        // request that doesn't match. If CRON_SECRET is unset the endpoint
        // refuses to run at all (fail closed; never expose decay to anon).
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
          return res
            .status(503)
            .json({ error: "CRON_SECRET not configured on the server" });
        }
        const auth = bearerFrom(req);
        if (auth !== cronSecret) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        // Pull all active non-free api_keys. Decay is a Pro tier perk.
        const { data: keys, error: keysErr } = await supabase
          .from("api_keys")
          .select("key_hash, tier")
          .eq("is_active", true)
          .neq("tier", "free");
        if (keysErr) throw keysErr;

        const results: Array<{
          api_key_hash: string;
          tier: string | null;
          ok: boolean;
          error?: string;
          decayed?: unknown;
        }> = [];

        for (const row of keys ?? []) {
          const { data: decayed, error: decayErr } = await supabase.rpc(
            "mc_manage_decay",
            { p_api_key_hash: row.key_hash }
          );
          if (decayErr) {
            results.push({
              api_key_hash: row.key_hash,
              tier: row.tier,
              ok: false,
              error: decayErr.message,
            });
          } else {
            results.push({
              api_key_hash: row.key_hash,
              tier: row.tier,
              ok: true,
              decayed,
            });
          }
        }

        return res.status(200).json({
          ran_at: new Date().toISOString(),
          tenants_processed: results.length,
          results,
          note:
            "Nightly extraction (LLM fact distillation from conversation_log) " +
            "is not yet implemented. See docs/sessions for the open question " +
            "to Chris about model selection.",
        });
      }

      // ── Build Desk admin actions ─────────────────────────────────────
      case "admin_build_tasks": {
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const apiKeyHash = sha256hex(apiKey);
        const method = String(req.query.method ?? req.body?.method ?? "list").trim();

        switch (method) {
          case "list": {
            const { data, error } = await supabase
              .from("build_tasks")
              .select("*")
              .eq("api_key_hash", apiKeyHash)
              .order("created_at", { ascending: false });
            if (error) throw error;
            return res.status(200).json({ data: data ?? [] });
          }
          case "get": {
            const taskId = String(req.query.task_id ?? req.body?.task_id ?? "").trim();
            if (!taskId) return res.status(400).json({ error: "task_id required" });
            const { data, error } = await supabase
              .from("build_tasks")
              .select("*")
              .eq("api_key_hash", apiKeyHash)
              .eq("id", taskId)
              .maybeSingle();
            if (error) throw error;
            if (!data) return res.status(404).json({ error: "Task not found" });
            return res.status(200).json({ data });
          }
          case "create": {
            if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
            const {
              title,
              description,
              status,
              plan_json,
              acceptance_criteria_json,
              assigned_worker_id,
              parent_task_id,
            } = req.body ?? {};
            if (!title) return res.status(400).json({ error: "title required" });

            if (assigned_worker_id) {
              const { data: w, error: wErr } = await supabase
                .from("build_workers")
                .select("id")
                .eq("api_key_hash", apiKeyHash)
                .eq("id", assigned_worker_id)
                .maybeSingle();
              if (wErr) throw wErr;
              if (!w) return res.status(400).json({ error: "assigned_worker_id not found" });
            }
            if (parent_task_id) {
              const { data: p, error: pErr } = await supabase
                .from("build_tasks")
                .select("id")
                .eq("api_key_hash", apiKeyHash)
                .eq("id", parent_task_id)
                .maybeSingle();
              if (pErr) throw pErr;
              if (!p) return res.status(400).json({ error: "parent_task_id not found" });
            }

            const { data, error } = await supabase
              .from("build_tasks")
              .insert({
                api_key_hash: apiKeyHash,
                title,
                description: description ?? null,
                status: status ?? "draft",
                plan_json: plan_json ?? null,
                acceptance_criteria_json: acceptance_criteria_json ?? null,
                assigned_worker_id: assigned_worker_id ?? null,
                parent_task_id: parent_task_id ?? null,
              })
              .select()
              .single();
            if (error) throw error;
            return res.status(200).json({ data });
          }
          case "update_status": {
            if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
            const { task_id, status } = req.body ?? {};
            if (!task_id || !status) {
              return res.status(400).json({ error: "task_id and status required" });
            }
            const { data, error } = await supabase
              .from("build_tasks")
              .update({ status, updated_at: new Date().toISOString() })
              .eq("api_key_hash", apiKeyHash)
              .eq("id", task_id)
              .select()
              .maybeSingle();
            if (error) throw error;
            if (!data) return res.status(404).json({ error: "Task not found" });
            return res.status(200).json({ data });
          }
          case "soft_delete": {
            if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
            const { task_id } = req.body ?? {};
            if (!task_id) return res.status(400).json({ error: "task_id required" });
            const { data, error } = await supabase
              .from("build_tasks")
              .update({ status: "failed", updated_at: new Date().toISOString() })
              .eq("api_key_hash", apiKeyHash)
              .eq("id", task_id)
              .select()
              .maybeSingle();
            if (error) throw error;
            if (!data) return res.status(404).json({ error: "Task not found" });
            return res.status(200).json({ success: true });
          }
          default:
            return res.status(400).json({ error: `Unknown method: ${method}` });
        }
      }

      case "admin_build_workers": {
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const apiKeyHash = sha256hex(apiKey);
        const method = String(req.query.method ?? req.body?.method ?? "list").trim();

        switch (method) {
          case "list": {
            const { data, error } = await supabase
              .from("build_workers")
              .select("*")
              .eq("api_key_hash", apiKeyHash)
              .order("created_at", { ascending: false });
            if (error) throw error;
            return res.status(200).json({ data: data ?? [] });
          }
          case "register": {
            if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
            const { name, worker_type, connection_config_json, status } = req.body ?? {};
            if (!name || !worker_type) {
              return res.status(400).json({ error: "name and worker_type required" });
            }
            const { data, error } = await supabase
              .from("build_workers")
              .insert({
                api_key_hash: apiKeyHash,
                name,
                worker_type,
                connection_config_json: connection_config_json ?? null,
                status: status ?? "offline",
              })
              .select()
              .single();
            if (error) throw error;
            return res.status(200).json({ data });
          }
          case "update": {
            if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
            const { worker_id, name, worker_type, connection_config_json, status } = req.body ?? {};
            if (!worker_id) return res.status(400).json({ error: "worker_id required" });
            const updates: Record<string, unknown> = {};
            if (name !== undefined) updates.name = name;
            if (worker_type !== undefined) updates.worker_type = worker_type;
            if (connection_config_json !== undefined) {
              updates.connection_config_json = connection_config_json;
            }
            if (status !== undefined) updates.status = status;
            if (Object.keys(updates).length === 0) {
              return res.status(400).json({ error: "No fields to update" });
            }
            const { data, error } = await supabase
              .from("build_workers")
              .update(updates)
              .eq("api_key_hash", apiKeyHash)
              .eq("id", worker_id)
              .select()
              .maybeSingle();
            if (error) throw error;
            if (!data) return res.status(404).json({ error: "Worker not found" });
            return res.status(200).json({ data });
          }
          case "delete": {
            if (req.method !== "POST" && req.method !== "DELETE") {
              return res.status(405).json({ error: "POST or DELETE required" });
            }
            const workerId = String(
              req.body?.worker_id ?? req.query.worker_id ?? ""
            ).trim();
            if (!workerId) return res.status(400).json({ error: "worker_id required" });
            const { error } = await supabase
              .from("build_workers")
              .delete()
              .eq("api_key_hash", apiKeyHash)
              .eq("id", workerId);
            if (error) throw error;
            return res.status(200).json({ success: true });
          }
          case "health_check": {
            if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
            const { worker_id, status } = req.body ?? {};
            if (!worker_id) return res.status(400).json({ error: "worker_id required" });
            const updates: Record<string, unknown> = {
              last_health_check_at: new Date().toISOString(),
            };
            if (status !== undefined) updates.status = status;
            const { data, error } = await supabase
              .from("build_workers")
              .update(updates)
              .eq("api_key_hash", apiKeyHash)
              .eq("id", worker_id)
              .select()
              .maybeSingle();
            if (error) throw error;
            if (!data) return res.status(404).json({ error: "Worker not found" });
            return res.status(200).json({ data });
          }
          default:
            return res.status(400).json({ error: `Unknown method: ${method}` });
        }
      }

      case "admin_build_dispatch": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const apiKeyHash = sha256hex(apiKey);
        const { task_id, worker_id, payload_json } = req.body ?? {};
        if (!task_id || !worker_id) {
          return res.status(400).json({ error: "task_id and worker_id required" });
        }

        const [taskRes, workerRes] = await Promise.all([
          supabase
            .from("build_tasks")
            .select("id")
            .eq("api_key_hash", apiKeyHash)
            .eq("id", task_id)
            .maybeSingle(),
          supabase
            .from("build_workers")
            .select("id")
            .eq("api_key_hash", apiKeyHash)
            .eq("id", worker_id)
            .maybeSingle(),
        ]);
        if (taskRes.error) throw taskRes.error;
        if (workerRes.error) throw workerRes.error;
        if (!taskRes.data) return res.status(404).json({ error: "task_id not found" });
        if (!workerRes.data) return res.status(404).json({ error: "worker_id not found" });

        const { data: eventData, error: eventErr } = await supabase
          .from("build_dispatch_events")
          .insert({
            api_key_hash: apiKeyHash,
            task_id,
            worker_id,
            event_type: "dispatched",
            payload_json: payload_json ?? null,
          })
          .select()
          .single();
        if (eventErr) throw eventErr;

        const { error: updErr } = await supabase
          .from("build_tasks")
          .update({
            status: "dispatched",
            assigned_worker_id: worker_id,
            updated_at: new Date().toISOString(),
          })
          .eq("api_key_hash", apiKeyHash)
          .eq("id", task_id);
        if (updErr) throw updErr;

        return res.status(200).json({ data: eventData });
      }

      // ── Tenant auto-load settings ───────────────────────────────────
      case "admin_get_autoload_settings": {
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const apiKeyHash = sha256hex(apiKey);

        const { data, error } = await supabase
          .from("tenant_settings")
          .select("autoload_enabled, prompt_enabled, resources_enabled, autoload_instructions")
          .eq("api_key_hash", apiKeyHash)
          .maybeSingle();
        if (error) throw error;

        return res.status(200).json({
          settings: data ?? {
            autoload_enabled: true,
            prompt_enabled: true,
            resources_enabled: true,
            autoload_instructions: null,
          },
        });
      }

      // ── Tenant settings (AI chat feature flags) ─────────────────────
      case "tenant_settings": {
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const hash = sha256hex(apiKey);
        const envEnabled = process.env.AI_CHAT_ENABLED === "true";

        if (req.method === "POST") {
          if (!envEnabled) return res.status(404).end();
          const body = req.body as {
            ai_chat_enabled?: boolean;
            ai_chat_provider?: ChatProvider;
            ai_chat_model?: string;
            ai_chat_api_key?: string | null;
            ai_chat_system_prompt?: string | null;
            ai_chat_max_turns?: number;
          };

          const update: Record<string, unknown> = {
            api_key_hash: hash,
            updated_at: new Date().toISOString(),
          };
          if (typeof body.ai_chat_enabled === "boolean")
            update.ai_chat_enabled = body.ai_chat_enabled;
          if (body.ai_chat_provider) update.ai_chat_provider = body.ai_chat_provider;
          if (body.ai_chat_model) update.ai_chat_model = body.ai_chat_model;
          if (typeof body.ai_chat_system_prompt === "string")
            update.ai_chat_system_prompt = body.ai_chat_system_prompt;
          if (typeof body.ai_chat_max_turns === "number")
            update.ai_chat_max_turns = body.ai_chat_max_turns;

          if (body.ai_chat_api_key === null) {
            update.ai_chat_api_key_encrypted = null;
          } else if (typeof body.ai_chat_api_key === "string" && body.ai_chat_api_key.length > 0) {
            const key = deriveAiKeyEncryptionKey();
            if (!key) {
              console.warn(
                "[memory-admin] AI_KEY_ENCRYPTION_SECRET not set -- storing AI key in plaintext (MVP)",
              );
              update.ai_chat_api_key_encrypted = body.ai_chat_api_key;
            } else {
              const iv = crypto.randomBytes(IV_BYTES);
              const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
              const enc = Buffer.concat([
                cipher.update(body.ai_chat_api_key, "utf8"),
                cipher.final(),
              ]);
              const tag = cipher.getAuthTag();
              update.ai_chat_api_key_encrypted = Buffer.concat([iv, enc, tag]).toString("base64");
            }
          }

          const { error } = await supabase
            .from("tenant_settings")
            .upsert(update, { onConflict: "api_key_hash" });
          if (error) throw error;
          return res.status(200).json({ success: true });
        }

        const { data, error } = await supabase
          .from("tenant_settings")
          .select(
            "ai_chat_enabled, ai_chat_provider, ai_chat_model, ai_chat_system_prompt, ai_chat_max_turns, ai_chat_api_key_encrypted",
          )
          .eq("api_key_hash", hash)
          .maybeSingle();
        if (error) throw error;

        const row = data as
          | {
              ai_chat_enabled: boolean;
              ai_chat_provider: string;
              ai_chat_model: string;
              ai_chat_system_prompt: string | null;
              ai_chat_max_turns: number;
              ai_chat_api_key_encrypted: string | null;
            }
          | null;

        return res.status(200).json({
          env_enabled: envEnabled,
          settings: {
            ai_chat_enabled: row?.ai_chat_enabled ?? false,
            ai_chat_provider: row?.ai_chat_provider ?? "google",
            ai_chat_model: row?.ai_chat_model ?? "gemini-2.0-flash",
            ai_chat_system_prompt: row?.ai_chat_system_prompt ?? null,
            ai_chat_max_turns: row?.ai_chat_max_turns ?? 20,
            has_api_key: Boolean(row?.ai_chat_api_key_encrypted),
          },
        });
      }

      case "admin_update_autoload_settings": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const apiKeyHash = sha256hex(apiKey);

        const body = req.body ?? {};
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

        for (const field of ["autoload_enabled", "prompt_enabled", "resources_enabled"]) {
          if (body[field] !== undefined) {
            if (typeof body[field] !== "boolean") {
              return res.status(400).json({ error: `${field} must be boolean` });
            }
            updates[field] = body[field];
          }
        }

        if (body.autoload_instructions !== undefined) {
          const instr = body.autoload_instructions;
          if (instr !== null && typeof instr !== "string") {
            return res.status(400).json({ error: "autoload_instructions must be string or null" });
          }
          if (typeof instr === "string" && instr.length > 2000) {
            return res.status(400).json({ error: "autoload_instructions max 2000 characters" });
          }
          updates.autoload_instructions = instr;
        }

        const { data, error } = await supabase
          .from("tenant_settings")
          .upsert(
            { api_key_hash: apiKeyHash, ...updates },
            { onConflict: "api_key_hash" }
          )
          .select("autoload_enabled, prompt_enabled, resources_enabled, autoload_instructions")
          .single();
        if (error) throw error;

        return res.status(200).json({ settings: data });
      }

      // ── Admin AI chat (streaming LLM with user's memory as context) ─
      case "admin_ai_chat": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });

        // Level 1: environment kill switch.
        if (process.env.AI_CHAT_ENABLED !== "true") return res.status(404).end();

        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });

        // Level 2: tenant kill switch.
        const { data: tenantRow, error: tenantErr } = await supabase
          .from("tenant_settings")
          .select(
            "ai_chat_enabled, ai_chat_provider, ai_chat_model, ai_chat_system_prompt, ai_chat_api_key_encrypted",
          )
          .eq("api_key_hash", sha256hex(apiKey))
          .maybeSingle();
        if (tenantErr) throw tenantErr;

        const tenant = tenantRow as
          | {
              ai_chat_enabled: boolean;
              ai_chat_provider: ChatProvider;
              ai_chat_model: string;
              ai_chat_system_prompt: string | null;
              ai_chat_api_key_encrypted: string | null;
            }
          | null;
        if (!tenant?.ai_chat_enabled) return res.status(404).end();

        const messagesInput = (req.body as { messages?: unknown })?.messages;
        const modelMessages = await normaliseChatMessages(messagesInput);
        if (!Array.isArray(modelMessages)) {
          return res.status(400).json({ error: modelMessages.error });
        }

        // Load the user's context (business_context, facts, sessions).
        const ctx = await buildAiChatContext(supabase);
        const factCount = ctx.facts.length;
        const sessionCount = ctx.sessions.length;

        const baseSystemPrompt = tenant.ai_chat_system_prompt?.trim() || DEFAULT_AI_CHAT_SYSTEM_PROMPT;
        const systemPrompt = `${baseSystemPrompt}

CONTEXT (fact_count=${factCount}, session_count=${sessionCount}):
${JSON.stringify(
  {
    business_context: ctx.businessContext,
    standing_rules: ctx.standingRules,
    active_facts: ctx.facts,
    recent_sessions: ctx.sessions,
  },
  null,
  2,
)}`;

        const provider: ChatProvider = tenant.ai_chat_provider ?? "google";
        const model = tenant.ai_chat_model ?? "gemini-2.0-flash";
        const userApiKey = decryptAiApiKey(tenant.ai_chat_api_key_encrypted);

        try {
          const languageModel = await resolveAiChatModel({
            provider,
            model,
            userApiKey,
          });

          const result = streamText({
            model: languageModel,
            system: systemPrompt,
            messages: modelMessages,
          });

          result.pipeUIMessageStreamToResponse(res);
          return;
        } catch (err) {
          console.error("[admin_ai_chat] stream failed:", (err as Error).message);
          return res
            .status(500)
            .json({ error: `AI chat failed: ${(err as Error).message}` });
        }
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err: unknown) {
    console.error(`Memory admin error (${action}):`, (err as Error).message);
    return res.status(500).json({ error: `Failed to execute ${action}: ${(err as Error).message}` });
  }
}

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
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
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
        const [bc, lib, sessions, facts, convos, code] = await Promise.all([
          supabase.from("business_context").select("id", { count: "exact", head: true }),
          supabase.from("knowledge_library").select("id", { count: "exact", head: true }),
          supabase.from("session_summaries").select("id", { count: "exact", head: true }),
          supabase.from("extracted_facts").select("id", { count: "exact", head: true }),
          supabase.from("conversation_log").select("id", { count: "exact", head: true }),
          supabase.from("code_dumps").select("id", { count: "exact", head: true }),
        ]);

        // Decay tier distribution from facts
        const { data: factsTiers } = await supabase
          .from("extracted_facts")
          .select("decay_tier, status");

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
        const { data, error } = await supabase
          .from("business_context")
          .select("*")
          .order("category")
          .order("key");

        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      case "sessions": {
        const limit = parseInt(req.query.limit as string) || 20;
        const { data, error } = await supabase
          .from("session_summaries")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      case "facts": {
        const query = req.query.query as string;
        const showAll = req.query.show_all === "true";
        let q = supabase
          .from("extracted_facts")
          .select("*")
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
        const { data, error } = await supabase
          .from("knowledge_library")
          .select("slug, title, category, tags, version, updated_at, created_at")
          .order("category")
          .order("title");

        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      case "library_doc": {
        const slug = req.query.slug as string;
        if (!slug) return res.status(400).json({ error: "slug parameter required" });

        const { data, error } = await supabase
          .from("knowledge_library")
          .select("*")
          .eq("slug", slug)
          .single();

        if (error) throw error;

        const { data: history } = await supabase
          .from("knowledge_library_history")
          .select("*")
          .eq("slug", slug)
          .order("version", { ascending: false });

        return res.status(200).json({ doc: data, history: history ?? [] });
      }

      case "conversations": {
        const sessionId = req.query.session_id as string;
        if (!sessionId) {
          // Return distinct session IDs with message counts
          const { data, error } = await supabase
            .from("conversation_log")
            .select("session_id, created_at")
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
          .from("conversation_log")
          .select("*")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      case "code": {
        const sessionId = req.query.session_id as string;
        let q = supabase
          .from("code_dumps")
          .select("*")
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
        const factId = req.body?.fact_id || req.query.fact_id;
        if (!factId) return res.status(400).json({ error: "fact_id required" });

        const { error } = await supabase
          .from("extracted_facts")
          .update({ status: "archived" })
          .eq("id", factId);

        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      case "delete_session": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const sessionId = req.body?.session_id || req.query.session_id;
        if (!sessionId) return res.status(400).json({ error: "session_id required" });

        const { error } = await supabase
          .from("session_summaries")
          .delete()
          .eq("id", sessionId);

        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      case "update_business_context": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const { category, key, value, priority } = req.body ?? {};
        if (!category || !key || value === undefined) {
          return res.status(400).json({ error: "category, key, and value required" });
        }

        const { error } = await supabase
          .from("business_context")
          .upsert(
            {
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

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err: unknown) {
    console.error(`Memory admin error (${action}):`, (err as Error).message);
    return res.status(500).json({ error: `Failed to execute ${action}: ${(err as Error).message}` });
  }
}

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
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { streamText, tool, stepCountIs, convertToModelMessages, type UIMessage } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
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

// ─── Admin AI chat helpers ─────────────────────────────────────────────────

function isAdminChatEnabled(): boolean {
  const flag = (process.env.AI_CHAT_ENABLED ?? "").toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

function buildAdminChatTools(supabase: SupabaseClient, apiKeyHash: string | null) {
  const requireKey = () =>
    apiKeyHash
      ? null
      : {
          success: false,
          error:
            "No api_key was provided with the chat request. Pass it in the request body as 'api_key'.",
        };

  return {
    search_memory: tool({
      description:
        "Search the user's UnClick Memory for facts or session history matching a query. Returns matching extracted_facts and session_summaries.",
      inputSchema: z.object({
        query: z.string().describe("Text to search for in facts and session summaries"),
        limit: z.number().int().positive().max(25).optional().describe("Max results per table"),
      }),
      execute: async ({ query, limit = 10 }) => {
        const pattern = `%${query.replace(/[%_]/g, (m) => `\\${m}`)}%`;
        const [factsRes, sessionsRes] = await Promise.all([
          supabase
            .from("extracted_facts")
            .select("id, fact, category, confidence, status, created_at")
            .eq("status", "active")
            .ilike("fact", pattern)
            .order("confidence", { ascending: false })
            .limit(limit),
          supabase
            .from("session_summaries")
            .select("id, session_id, platform, summary, topics, created_at")
            .ilike("summary", pattern)
            .order("created_at", { ascending: false })
            .limit(limit),
        ]);
        return {
          query,
          facts: factsRes.data ?? [],
          sessions: sessionsRes.data ?? [],
          error: factsRes.error?.message ?? sessionsRes.error?.message ?? null,
        };
      },
    }),

    add_fact: tool({
      description:
        "Store a new fact in the user's UnClick Memory (extracted_facts). Use this when the user tells you something worth remembering across sessions.",
      inputSchema: z.object({
        category: z.string().describe("Fact category, e.g. 'preferences', 'technical', 'clients'"),
        key: z.string().optional().describe("Short key/label for the fact (stored as a topic tag)"),
        value: z.string().describe("The fact itself, stated atomically"),
        tier: z.enum(["hot", "warm", "cold"]).optional().describe("Decay tier, default 'hot'"),
      }),
      execute: async ({ category, value, tier = "hot" }) => {
        const { data, error } = await supabase
          .from("extracted_facts")
          .insert({
            fact: value,
            category,
            decay_tier: tier,
            source_type: "admin_chat",
            confidence: 1.0,
            status: "active",
          })
          .select("id")
          .single();
        if (error) return { success: false, error: error.message };
        return { success: true, fact_id: data.id };
      },
    }),

    update_business_context: tool({
      description:
        "Upsert a business_context entry (standing rule, preference, client profile). Always loaded at session startup.",
      inputSchema: z.object({
        category: z.string().describe("e.g. 'standing_rules', 'clients', 'brand'"),
        key: z.string().describe("Unique key within the category"),
        value: z.string().describe("The context value as a JSON-encoded string or plain text"),
      }),
      execute: async ({ category, key, value }) => {
        let stored: unknown = value;
        try {
          stored = JSON.parse(value);
        } catch {
          stored = value;
        }
        const { error } = await supabase
          .from("business_context")
          .upsert(
            {
              category,
              key,
              value: stored,
              priority: 50,
              decay_tier: "hot",
              updated_at: new Date().toISOString(),
              last_accessed: new Date().toISOString(),
            },
            { onConflict: "category,key" }
          );
        if (error) return { success: false, error: error.message };
        return { success: true, category, key };
      },
    }),

    get_memory_stats: tool({
      description:
        "Get current memory usage statistics: layer counts, decay tier distribution, and fact status breakdown.",
      inputSchema: z.object({}),
      execute: async () => {
        const [bc, lib, sessions, facts, convos, code] = await Promise.all([
          supabase.from("business_context").select("id", { count: "exact", head: true }),
          supabase.from("knowledge_library").select("id", { count: "exact", head: true }),
          supabase.from("session_summaries").select("id", { count: "exact", head: true }),
          supabase.from("extracted_facts").select("id", { count: "exact", head: true }),
          supabase.from("conversation_log").select("id", { count: "exact", head: true }),
          supabase.from("code_dumps").select("id", { count: "exact", head: true }),
        ]);
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
        return {
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
        };
      },
    }),

    list_recent_sessions: tool({
      description: "List recent work session summaries, ordered by most recent first.",
      inputSchema: z.object({
        limit: z.number().int().positive().max(25).optional(),
      }),
      execute: async ({ limit = 10 }) => {
        const { data, error } = await supabase
          .from("session_summaries")
          .select("id, session_id, platform, summary, topics, decisions, open_loops, created_at")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) return { sessions: [], error: error.message };
        return { sessions: data ?? [] };
      },
    }),

    write_session_summary: tool({
      description:
        "Write a summary of the current conversation as a session_summaries record. Use this at the end of a session, or when the user asks to save a recap.",
      inputSchema: z.object({
        summary: z.string().describe("Narrative summary of the conversation"),
        decisions: z.array(z.string()).optional().describe("Decisions made in this session"),
        open_loops: z.array(z.string()).optional().describe("Unfinished threads or follow-ups"),
        topics: z.array(z.string()).optional().describe("Topic tags for searchability"),
      }),
      execute: async ({ summary, decisions, open_loops, topics }) => {
        const { data, error } = await supabase
          .from("session_summaries")
          .insert({
            session_id: `admin-chat-${Date.now()}`,
            platform: "admin-chat",
            summary,
            decisions: decisions ?? [],
            open_loops: open_loops ?? [],
            topics: topics ?? [],
          })
          .select("id")
          .single();
        if (error) return { success: false, error: error.message };
        return { success: true, summary_id: data.id };
      },
    }),

    create_build_task: tool({
      description:
        "Create a new build task with a title, description, and acceptance criteria. Tasks can later be dispatched to AI coding workers. Always confirm with the user before creating.",
      inputSchema: z.object({
        title: z.string().min(1).describe("Imperative, specific title, e.g. 'Fix login timeout bug'"),
        description: z.string().describe("Enough detail that a developer could execute independently"),
        acceptance_criteria: z
          .array(z.string())
          .optional()
          .describe("Concrete checklist items defining done"),
        priority: z.enum(["low", "medium", "high"]).optional().describe("Default 'medium'"),
      }),
      execute: async ({ title, description, acceptance_criteria, priority }) => {
        const missing = requireKey();
        if (missing) return missing;
        const { data, error } = await supabase
          .from("build_tasks")
          .insert({
            api_key_hash: apiKeyHash,
            title,
            description,
            acceptance_criteria: acceptance_criteria ?? [],
            priority: priority ?? "medium",
            status: "pending",
          })
          .select("id, title, status, priority, created_at")
          .single();
        if (error) return { success: false, error: error.message };
        return { success: true, task: data };
      },
    }),

    list_build_tasks: tool({
      description:
        "List current build tasks and their status for this user. Use when the user asks 'what's on my plate?' or similar.",
      inputSchema: z.object({
        status: z
          .enum(["pending", "in_progress", "completed", "cancelled", "all"])
          .optional()
          .describe("Filter by status, or 'all' for everything. Default 'pending'."),
        limit: z.number().int().positive().max(50).optional(),
      }),
      execute: async ({ status, limit = 10 }) => {
        const missing = requireKey();
        if (missing) return { tasks: [], ...missing };
        let q = supabase
          .from("build_tasks")
          .select("id, title, description, status, priority, acceptance_criteria, created_at, updated_at")
          .eq("api_key_hash", apiKeyHash)
          .order("created_at", { ascending: false })
          .limit(limit);
        const effective = status ?? "pending";
        if (effective !== "all") {
          q = q.eq("status", effective);
        }
        const { data, error } = await q;
        if (error) return { tasks: [], error: error.message };
        return { tasks: data ?? [], filter: effective };
      },
    }),

    update_build_task: tool({
      description:
        "Update a build task's status, title, description, or acceptance criteria. Only updates tasks owned by the current user.",
      inputSchema: z.object({
        task_id: z.string().uuid().describe("UUID of the task to update"),
        status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        acceptance_criteria: z.array(z.string()).optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
      }),
      execute: async ({ task_id, status, title, description, acceptance_criteria, priority }) => {
        const missing = requireKey();
        if (missing) return missing;
        const patch: Record<string, unknown> = {};
        if (status !== undefined) patch.status = status;
        if (title !== undefined) patch.title = title;
        if (description !== undefined) patch.description = description;
        if (acceptance_criteria !== undefined) patch.acceptance_criteria = acceptance_criteria;
        if (priority !== undefined) patch.priority = priority;
        if (Object.keys(patch).length === 0) {
          return { success: false, error: "No fields to update were provided." };
        }
        const { data, error } = await supabase
          .from("build_tasks")
          .update(patch)
          .eq("id", task_id)
          .eq("api_key_hash", apiKeyHash)
          .select("id, title, status, priority, updated_at")
          .maybeSingle();
        if (error) return { success: false, error: error.message };
        if (!data) {
          return {
            success: false,
            error: "No task with that ID exists for this user.",
          };
        }
        return { success: true, task: data };
      },
    }),
  };
}

async function buildAdminChatSystemPrompt(supabase: SupabaseClient): Promise<string> {
  const [bcRes, sessRes, factsRes] = await Promise.all([
    supabase
      .from("business_context")
      .select("category, key, value, priority")
      .in("decay_tier", ["hot", "warm"])
      .order("priority", { ascending: false })
      .limit(40),
    supabase
      .from("session_summaries")
      .select("session_id, platform, summary, topics, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("extracted_facts")
      .select("fact, category, confidence")
      .eq("status", "active")
      .in("decay_tier", ["hot", "warm"])
      .order("confidence", { ascending: false })
      .limit(30),
  ]);

  const bc = bcRes.data ?? [];
  const sessions = sessRes.data ?? [];
  const facts = factsRes.data ?? [];

  const ctxBlock = bc.length
    ? bc
        .map((r) => {
          const v = typeof r.value === "string" ? r.value : JSON.stringify(r.value);
          return `- [${r.category}/${r.key}] ${v}`;
        })
        .join("\n")
    : "(none yet)";

  const factsBlock = facts.length
    ? facts.map((f) => `- (${f.category}) ${f.fact}`).join("\n")
    : "(none yet)";

  const sessionsBlock = sessions.length
    ? sessions
        .map((s) => {
          const when = s.created_at ? new Date(s.created_at).toISOString().slice(0, 10) : "unknown";
          const topics = Array.isArray(s.topics) && s.topics.length ? ` [${s.topics.join(", ")}]` : "";
          return `- ${when} (${s.platform ?? "unknown"})${topics}: ${s.summary}`;
        })
        .join("\n")
    : "(none yet)";

  return [
    "You are the UnClick Memory admin assistant. You help the user inspect and curate their persistent memory.",
    "",
    "You have tools available to interact with this user's UnClick Memory. Use them when appropriate:",
    "- search_memory: Find specific facts or session history",
    "- add_fact: Store new information the user tells you",
    "- update_business_context: Update their business identity or settings",
    "- get_memory_stats: Check memory health and load rates",
    "- list_recent_sessions: Review what happened in recent sessions",
    "- write_session_summary: Save a summary of this conversation",
    "",
    "You can also manage build tasks. When the user describes work that needs to be done (features to build, bugs to fix, refactoring), offer to create a build task. Use create_build_task with:",
    "- Clear specific title (imperative: 'Fix login timeout bug', not 'Login issue')",
    "- Enough detail that a developer or AI worker could execute independently",
    "- Acceptance criteria as a concrete checklist",
    "- Reference relevant facts from memory in the description",
    "",
    "When the user gives a vague multi-part request like 'fix the homepage and add pricing', suggest breaking it into separate tasks. Show them the proposed tasks and ask for confirmation before creating.",
    "",
    "When they ask 'what's on my plate?' or similar, use list_build_tasks to show pending work.",
    "",
    "When the user tells you something worth remembering, proactively use add_fact to store it. When they ask about past work, use list_recent_sessions or search_memory. Be helpful and proactive with tools, but always tell the user what you did.",
    "",
    "Style: concise, direct, no fluff. Use Markdown sparingly. Do not use em dashes; use a regular dash or restructure.",
    "",
    "CURRENT MEMORY SNAPSHOT",
    "",
    "Business context (standing rules + preferences):",
    ctxBlock,
    "",
    "Recent sessions:",
    sessionsBlock,
    "",
    "Active facts (highest confidence):",
    factsBlock,
  ].join("\n");
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

      case "admin_ai_chat": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        if (!isAdminChatEnabled()) {
          return res.status(503).json({
            error: "Admin AI chat is disabled. Set AI_CHAT_ENABLED=true to turn it on.",
          });
        }
        if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
          return res.status(503).json({
            error: "GOOGLE_GENERATIVE_AI_API_KEY is not configured on the server.",
          });
        }

        const body = req.body as
          | { messages?: UIMessage[]; api_key?: string }
          | undefined;
        const messages = Array.isArray(body?.messages) ? body!.messages! : [];
        if (messages.length === 0) {
          return res.status(400).json({ error: "messages array is required" });
        }

        const rawApiKey = (body?.api_key ?? bearerFrom(req)).trim();
        const apiKeyHash = rawApiKey ? sha256hex(rawApiKey) : null;

        const systemPrompt = await buildAdminChatSystemPrompt(supabase);
        const tools = buildAdminChatTools(supabase, apiKeyHash);

        const modelMessages = await convertToModelMessages(messages);
        const result = streamText({
          model: google("gemini-2.0-flash"),
          system: systemPrompt,
          messages: modelMessages,
          tools,
          stopWhen: stepCountIs(5),
          onError({ error }) {
            console.error("admin_ai_chat stream error:", error);
          },
        });

        result.pipeUIMessageStreamToResponse(res);
        return;
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err: unknown) {
    console.error(`Memory admin error (${action}):`, (err as Error).message);
    return res.status(500).json({ error: `Failed to execute ${action}: ${(err as Error).message}` });
  }
}

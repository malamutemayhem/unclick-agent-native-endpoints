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

      case "admin_check_connection": {
        // Lightweight check used by the Connect page to verify that Claude Code
        // (or any MCP client) has handshaken with this user's API key recently.
        // Returns whether the api key resolves to a configured account, fact
        // count, and last activity timestamp.
        const apiKey = String(req.query.api_key ?? "").trim() || bearerFrom(req);
        if (!apiKey) return res.status(400).json({ error: "api_key required" });
        const apiKeyHash = sha256hex(apiKey);

        const { data: cfg } = await supabase
          .from("memory_configs")
          .select("supabase_url,schema_installed,last_used_at,updated_at")
          .eq("api_key_hash", apiKeyHash)
          .maybeSingle();

        const [bcRes, factsRes, sessionRes] = await Promise.all([
          supabase.from("business_context").select("id", { count: "exact", head: true }),
          supabase.from("extracted_facts").select("id", { count: "exact", head: true }).eq("status", "active"),
          supabase
            .from("session_summaries")
            .select("created_at,platform")
            .order("created_at", { ascending: false })
            .limit(1),
        ]);

        const factCount = factsRes.count ?? 0;
        const contextCount = bcRes.count ?? 0;
        const lastSession = sessionRes.data?.[0]?.created_at ?? null;
        const lastSessionPlatform = sessionRes.data?.[0]?.platform ?? null;
        const lastUsedAt = cfg?.last_used_at ?? null;

        // "Connected" means we've seen a successful MCP handshake (last_used_at)
        // OR there's session activity. If neither, the user has set up cloud
        // memory but no client has spoken to it yet.
        const connected = Boolean(lastUsedAt || lastSession);

        return res.status(200).json({
          connected,
          configured: Boolean(cfg),
          has_context: contextCount > 0,
          context_count: contextCount,
          fact_count: factCount,
          last_session: lastSession,
          last_session_platform: lastSessionPlatform,
          last_used_at: lastUsedAt,
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

      // ── Memory reliability instrumentation ───────────────────────────
      case "log_tool_event": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const apiKeyHash = sha256hex(apiKey);

        const toolName = String(req.body?.tool_name ?? "").trim();
        if (!toolName) return res.status(400).json({ error: "tool_name required" });
        const sessionIdentifier = req.body?.session_identifier
          ? String(req.body.session_identifier)
          : null;
        const clientType = req.body?.client_type ? String(req.body.client_type) : null;

        // 30-minute window governs session detection. Scope by session_identifier
        // when present, else by tenant alone.
        const windowStart = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        let probe = supabase
          .from("memory_load_events")
          .select("id", { count: "exact", head: true })
          .eq("api_key_hash", apiKeyHash)
          .gte("created_at", windowStart);
        if (sessionIdentifier) {
          probe = probe.eq("session_identifier", sessionIdentifier);
        }
        const probeRes = await probe;
        if (probeRes.error) throw probeRes.error;
        const wasFirst = (probeRes.count ?? 0) === 0;

        const { data, error } = await supabase
          .from("memory_load_events")
          .insert({
            api_key_hash: apiKeyHash,
            tool_name: toolName,
            session_identifier: sessionIdentifier,
            client_type: clientType,
            was_first_call_in_session: wasFirst,
          })
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json({ data });
      }

      case "admin_memory_load_metrics": {
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const apiKeyHash = sha256hex(apiKey);

        const windowStart = new Date(
          Date.now() - 7 * 24 * 60 * 60 * 1000
        ).toISOString();
        const { data, error } = await supabase
          .from("memory_load_events")
          .select("tool_name, client_type, was_first_call_in_session")
          .eq("api_key_hash", apiKeyHash)
          .gte("created_at", windowStart);
        if (error) throw error;

        const rows = (data ?? []) as Array<{
          tool_name: string;
          client_type: string | null;
          was_first_call_in_session: boolean;
        }>;

        const totalEvents = rows.length;
        const firstCalls = rows.filter((r) => r.was_first_call_in_session);
        const totalSessions = firstCalls.length;
        const compliantSessions = firstCalls.filter(
          (r) => r.tool_name === "get_startup_context"
        ).length;
        const compliancePct =
          totalSessions === 0
            ? 0
            : Math.round((compliantSessions / totalSessions) * 1000) / 10;

        const byClientType: Record<string, number> = {};
        for (const r of rows) {
          const key = r.client_type ?? "unknown";
          byClientType[key] = (byClientType[key] ?? 0) + 1;
        }

        return res.status(200).json({
          window: "7d",
          total_events: totalEvents,
          total_sessions: totalSessions,
          compliant_sessions: compliantSessions,
          get_startup_context_compliance_pct: compliancePct,
          by_client_type: byClientType,
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

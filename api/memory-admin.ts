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
 *   - setup_status: GET ?api_key=... - returns whether cloud memory is on
 *   - disconnect: DELETE ?api_key=... - removes a user's memory config
 *   - config: GET with Bearer <api_key> - MCP fetches decrypted creds
 *   - device_check: POST with Bearer <api_key> + fingerprint - heartbeat
 *                   + nudge signal
 *   - list_devices: GET with Bearer <api_key>
 *   - remove_device: DELETE ?fingerprint=... with Bearer (or ?dismiss=1)
 *
 * Build Desk admin actions (Bearer <api_key>, tenant-scoped by sha256hex):
 *   - admin_build_tasks: method=list|get|create|update_status|soft_delete
 *   - admin_build_workers: method=list|register|update|delete|health_check
 *   - admin_build_dispatch: POST with task_id + worker_id (same tenant) and optional idempotency_key
 *   - admin_unclick_connect_dry_run: POST tether intent -> route packet -> assignment/HOLD/BLOCKER, no writes
 *   - admin_unclick_connect_commit: POST experiment-only route packet -> mc_agent_dispatches row
 *   - reliability_dispatches: method=list|get|upsert|claim|release
 *   - reliability_heartbeats: method=list|publish
 *   - reliability_reclaim_stale: POST with optional { limit, dry_run }
 *
 * Memory reliability instrumentation (Bearer <api_key>):
 *   - log_tool_event: POST from MCP server; inserts memory_load_events row,
 *                     sets was_first_call_in_session via 30-minute window
 *   - admin_memory_load_metrics: 7-day totals, get_startup_context compliance,
 *                                breakdown by client_type
 *
 * Channels orchestrator actions (route admin chat via local Claude Code):
 *   - admin_channel_send: POST with Bearer <api_key>, body { session_id, content }
 *                         Inserts a pending user message into chat_messages.
 *   - admin_channel_poll: GET with Bearer <api_key>, ?session_id=&after=<iso>
 *                         Returns messages after the given timestamp (Realtime fallback).
 *   - admin_channel_status: GET with Bearer <api_key>
 *                           Reports whether a Channel plugin has checked in recently.
 *   - admin_channel_heartbeat: POST with Bearer <api_key>, body { client_info }
 *                              Bumps the channel_status.last_seen timestamp.
 *   - admin_ai_chat: POST with Bearer <api_key>, body { session_id, content }
 *                    Gemini fallback used when no Channel plugin is active.
 *   - admin_conversation_turn_ingest: POST with Bearer <api_key>,
 *                    body { session_id, role, content, source_app?, client_session_id? }
 *                    Saves a safe subscription/tether turn for Orchestrator continuity.
 *
 * Admin spotlight + bug visibility:
 *   - admin_search: GET with Bearer <api_key>, ?query=&limit=
 *                   Searches facts/sessions/business context via ilike.
 *   - admin_bug_reports: GET with Bearer <api_key>, ?limit=
 *                        Recent bug reports scoped to this api_key_hash.
 *
 * Memory management actions:
 *   - admin_update_fact: POST, updates fact text, category, and/or confidence.
 *   - admin_fact_add: POST, inserts a new manually-authored fact.
 *   - admin_context_apply_template: POST, seeds business_context from a
 *                                   built-in starter template (freelancer,
 *                                   developer, founder, creator).
 *   - admin_session_preview: GET, returns a dry-run of get_startup_context
 *                            for the admin UI to show what will load.
 *   - admin_export_all: GET, returns the user's entire memory snapshot as JSON
 *                       for self-hosted export / portability.
 *   - admin_clear_all: POST with body.confirm === "DELETE", deletes every
 *                      memory row scoped to the user's api_key_hash.
 *   - orchestrator_context_read: GET/POST read-only compact cross-seat state
 *                                from Memory, Boardroom, dispatches, signals.
 *
 * Conflict detection actions (competing memory tools):
 *   - conflict_detect: POST with Bearer + { tool, platform? } -- log detection,
 *                      returns { should_warn, detection_count }. Throttled 24h.
 *   - conflict_check:  GET ?api_key=... -- list active (unresolved) conflicts
 *   - conflict_dismiss: POST with Bearer + { tool, type } ("temporary" | "permanent")
 *   - conflict_resolve: POST with Bearer + { tool } -- user removed the conflict
 *   - check_duplicates: GET ?threshold=0.6 -- returns near-duplicate fact pairs
 *   - health_summary:  GET ?api_key=... -- full health status for the user
 *
 * Tool awareness actions:
 *   - tool_detect: POST with Bearer + { detections: [...] }
 *                   Upserts detections and returns which tools are currently
 *                   nudge-eligible (not dismissed, not nudged in the last 7d)
 *   - admin_tool_scan: GET with Bearer - groups detections for the admin UI
 *   - dismiss_tool_nudge: POST with Bearer + { tool_name, dismissed } - sets
 *                   nudge_dismissed for the "Keep it" button
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { evaluateFishbowlCompletionPolicy } from "./lib/fishbowl-completion-policy.js";
import { inferFishbowlJobPipeline } from "./lib/fishbowl-job-pipeline.js";
import { statusFromFishbowlPost } from "./lib/fishbowl-status.js";
import {
  buildOrchestratorContext,
  mergeOrchestratorTodoRows,
  redactSensitive,
  type OrchestratorBusinessContextRow,
  type OrchestratorCommentRow,
  type OrchestratorConversationTurnRow,
  type OrchestratorDispatchRow,
  type OrchestratorLibraryRow,
  type OrchestratorMessageRow,
  type OrchestratorProfileRow,
  type OrchestratorSessionRow,
  type OrchestratorSignalRow,
  type OrchestratorTodoRow,
} from "./lib/orchestrator-context.js";
import {
  createDispatchThroughputMetrics,
  decorateThroughputDispatch,
  shouldIncludeThroughputMetrics,
} from "./lib/throughput-observability.js";
import {
  attachBuildDeskIdempotencyKey,
  findBuildDeskRowByIdempotencyKey,
  parseBuildDeskIdempotencyKey,
} from "./lib/build-desk-idempotency.js";
import {
  buildFishbowlMessageHandoffDispatchRow,
  planFishbowlMessageHandoffs,
} from "./lib/fishbowl-message-handoff.js";
import {
  buildFishbowlIdeaCouncilDispatchRow,
  planFishbowlIdeaCouncilHandoffs,
} from "./lib/fishbowl-idea-council.js";
import {
  buildFishbowlTodoHandoffDispatchRow,
  planFishbowlTodoHandoff,
} from "./lib/fishbowl-todo-handoff.js";
import {
  planFishbowlPostLedgerEvent,
  planTodoLedgerEvents,
  recordAutopilotEvent,
  recordAutopilotEvents,
} from "./lib/autopilot-control-ledger.js";
import {
  buildTodoLaneTokens,
  evaluateLaneClaim,
  type WorkerLaneRow,
} from "./lib/worker-lanes.js";
import {
  pickScopePackFromComments,
  type ScopePackCommentRow,
} from "./lib/scope-pack-comments.js";
import { runRoutePacketConsumerDryRun, type VisibleWorker } from "./lib/route-packet-consumer.js";
import { buildUnClickConnectDispatchRow } from "./lib/route-packet-dispatch.js";
import { buildTetherRoutePacket } from "./lib/tether-route-packet.js";
import { decideMemoryAdminAiChatProviderCall } from "./lib/ai-provider-inventory.js";
import {
  buildWorkersToVisibleWorkers,
  fishbowlProfilesToVisibleWorkers,
  type BuildWorkerDiscoveryRow,
  type FishbowlProfileDiscoveryRow,
} from "./lib/unclick-connect-worker-discovery.js";
import { buildCard, type ConversationalCard } from "../packages/mcp-server/src/cards/card.js";
import {
  createDispatchId,
  createHeartbeat,
  parseHeartbeatEtaMinutes,
  parseOptionalFilterToken,
  parseRequiredToken,
  createReclaimSignal,
  createTimeBucket,
  decideStaleLease,
} from "../packages/mcp-server/src/reliability.js";
import { emitSignal } from "../packages/mcp-server/src/signals/emit.js";
import {
  effectiveMemoryTier,
  isMemoryQuotaExemptEmail,
} from "../packages/mcp-server/src/memory/quota-policy.js";
import { streamText, tool, stepCountIs, convertToModelMessages, type UIMessage, type ModelMessage } from "ai";
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

function normalizeFishbowlText(input: string): string {
  return input.replace(/[\u2013\u2014]/g, "-");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

type OperatorTimeSource = "browser" | "manual";

interface OperatorTimeContextValue {
  timezone: string;
  source: OperatorTimeSource;
  detected_at?: string | null;
  manual_override_at?: string | null;
  updated_at: string;
  privacy: "timezone-only";
}

const OPERATOR_TIME_CATEGORY = "preference";
const OPERATOR_TIME_KEY = "operator_timezone";

function isValidTimeZoneName(timezone: string): boolean {
  if (!timezone || timezone.length > 80) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function parseOperatorTimeValue(value: unknown, updatedAt?: string | null): OperatorTimeContextValue | null {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!isRecord(parsed)) return null;
  const timezone = typeof parsed.timezone === "string" ? parsed.timezone.trim() : "";
  if (!isValidTimeZoneName(timezone)) return null;
  const source = parsed.source === "manual" || parsed.source === "browser" ? parsed.source : "browser";
  return {
    timezone,
    source,
    detected_at: typeof parsed.detected_at === "string" ? parsed.detected_at : null,
    manual_override_at: typeof parsed.manual_override_at === "string" ? parsed.manual_override_at : null,
    updated_at: typeof parsed.updated_at === "string" ? parsed.updated_at : updatedAt ?? new Date().toISOString(),
    privacy: "timezone-only",
  };
}

async function readOperatorTimeContext(
  supabase: SupabaseClient,
  apiKeyHash: string,
): Promise<OperatorTimeContextValue | null> {
  const { data, error } = await supabase
    .from("mc_business_context")
    .select("value, updated_at")
    .eq("api_key_hash", apiKeyHash)
    .eq("category", OPERATOR_TIME_CATEGORY)
    .eq("key", OPERATOR_TIME_KEY)
    .maybeSingle();
  if (error) throw error;
  return data ? parseOperatorTimeValue(data.value, data.updated_at as string | null) : null;
}

const RELIABILITY_SOURCES = [
  "fishbowl",
  "connectors",
  "wakepass",
  "testpass",
  "uxpass",
  "flowpass",
  "securitypass",
  "manual",
] as const;

const RELIABILITY_STATUSES = [
  "queued",
  "leased",
  "completed",
  "failed",
  "stale",
  "cancelled",
] as const;

const RELIABILITY_HEARTBEAT_STATES = [
  "idle",
  "received",
  "accepted",
  "working",
  "blocked",
  "completed",
] as const;

type ReliabilitySource = (typeof RELIABILITY_SOURCES)[number];
type ReliabilityStatus = (typeof RELIABILITY_STATUSES)[number];
type ReliabilityHeartbeatState = (typeof RELIABILITY_HEARTBEAT_STATES)[number];

type ReliabilityDispatchRow = {
  id: string;
  api_key_hash: string;
  dispatch_id: string;
  source: ReliabilitySource;
  target_agent_id: string;
  task_ref: string | null;
  status: ReliabilityStatus;
  lease_owner: string | null;
  lease_expires_at: string | null;
  last_real_action_at: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function isReliabilitySource(value: unknown): value is ReliabilitySource {
  return typeof value === "string" && RELIABILITY_SOURCES.includes(value as ReliabilitySource);
}

function isReliabilityStatus(value: unknown): value is ReliabilityStatus {
  return typeof value === "string" && RELIABILITY_STATUSES.includes(value as ReliabilityStatus);
}

function isReliabilityHeartbeatState(value: unknown): value is ReliabilityHeartbeatState {
  return (
    typeof value === "string" &&
    RELIABILITY_HEARTBEAT_STATES.includes(value as ReliabilityHeartbeatState)
  );
}

function getClampedLimit(value: unknown, fallback = 50, max = 200): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

const BACKGROUND_RECALL_CATEGORIES = new Set(["identity", "preference", "standing_rule"]);
const BACKGROUND_RECALL_PATTERNS = [
  /^chris('s)?\s/i,
  /^user\s/i,
  /should always/i,
  /never use/i,
  /operator timezone/i,
  /standing rule/i,
  /profile/i,
  /preference/i,
];

function annotateRecallFact<T extends { category?: string | null; fact?: string | null; access_count?: number | null }>(fact: T) {
  const category = String(fact.category ?? "").toLowerCase();
  const text = String(fact.fact ?? "");
  const accessCount = Number(fact.access_count ?? 0);
  const looksStatic = BACKGROUND_RECALL_CATEGORIES.has(category) || BACKGROUND_RECALL_PATTERNS.some((pattern) => pattern.test(text));
  const isBackgroundHeavy = accessCount >= 100 && looksStatic;

  return {
    ...fact,
    recall_signal: isBackgroundHeavy ? "background-heavy" : "top-of-mind",
    recall_note: isBackgroundHeavy ? "Startup or heartbeat reads" : "Human-facing recall",
  };
}

function getRequestBaseUrl(req: VercelRequest): string | null {
  const explicit = process.env.EMBED_API_URL?.replace(/\/$/, "");
  if (explicit) return explicit;

  const vercelUrl = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (vercelUrl) return `https://${vercelUrl}`;

  const host = typeof req.headers.host === "string" ? req.headers.host : "";
  if (!host) return null;

  const protoHeader = req.headers["x-forwarded-proto"];
  const proto = typeof protoHeader === "string" ? protoHeader : host.includes("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

function shouldSkipMemoryEmbedding(text: string): boolean {
  const value = text.trim();
  if (!value) return true;

  const lower = value.toLowerCase();
  if (lower.length < 24) return true;
  if (lower.startsWith("heartbeat_last_state:")) return true;
  if (lower.includes("<heartbeat") || lower.includes("</heartbeat>")) return true;

  return [
    "dont_notify",
    "unclick healthy",
    "no new signals",
    "user is caught up",
    "memory self-echo",
    "fact saved: heartbeat_last_state",
    "only memory self-echo signals",
    "top queue unchanged",
  ].some((needle) => lower.includes(needle));
}

function queueMemoryEmbedding(req: VercelRequest, table: string, id: string, text: string): void {
  const secret = process.env.ADMIN_EMBED_SECRET;
  const baseUrl = getRequestBaseUrl(req);
  if (!secret || !baseUrl || shouldSkipMemoryEmbedding(text)) return;

  void fetch(`${baseUrl}/api/memory/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-embed-secret": secret,
    },
    body: JSON.stringify({ table, id, text }),
  }).catch((err) => {
    console.error("[memory_embed] queued embedding failed", err);
  });
}

const STARTER_CREW_DEFS = [
  {
    name: "Business Council",
    description:
      "CEO, CFO, CMO, CTO, and Creative Director deliberate your business decision together. Each brings their own lens. The Chairman synthesises.",
    template: "council",
    agentSlugs: ["ceo", "cfo", "cmo", "cto", "cco-creative"],
  },
  {
    name: "Launch Stress Test",
    description:
      "A Contrarian, Security Engineer, Growth Hacker, and Customer Success Manager attack and defend your launch plan. Red attacks, blue defends, white scores.",
    template: "red_blue",
    agentSlugs: ["contrarian", "security-engineer", "growth-hacker", "csm"],
  },
  {
    name: "Creative Studio",
    description:
      "Creative Director, Copywriter, Art Director, and Brand Strategist collaborate on your brief. Draft, shape, verify, stress-test.",
    template: "editorial",
    agentSlugs: ["creative-director", "copywriter", "art-director", "brand-strategist"],
  },
  {
    name: "Decision Desk",
    description:
      "First Principles Thinker, Pragmatist, Outsider, Executor, and Chairman reason through your decision from five independent angles.",
    template: "council",
    agentSlugs: ["first-principles", "pragmatist", "outsider", "executor", "chairman"],
  },
] as const;

async function ensureStarterCrews(
  supabase: SupabaseClient,
  apiKeyHash: string,
): Promise<void> {
  const { data: existingRows, error: existingError } = await supabase
    .from("mc_crews")
    .select("name,template")
    .eq("api_key_hash", apiKeyHash);
  if (existingError) throw existingError;

  const existing = new Set(
    ((existingRows ?? []) as Array<{ name: string; template: string }>).map(
      (row) => `${row.name}::${row.template}`,
    ),
  );
  const missingDefs = STARTER_CREW_DEFS.filter(
    (crew) => !existing.has(`${crew.name}::${crew.template}`),
  );
  if (missingDefs.length === 0) return;

  const slugs = Array.from(new Set(missingDefs.flatMap((crew) => crew.agentSlugs)));
  const [systemAgents, tenantAgents] = await Promise.all([
    supabase.from("mc_agents").select("id,slug").is("api_key_hash", null).in("slug", slugs),
    supabase.from("mc_agents").select("id,slug").eq("api_key_hash", apiKeyHash).in("slug", slugs),
  ]);
  if (systemAgents.error) throw systemAgents.error;
  if (tenantAgents.error) throw tenantAgents.error;

  const bySlug = new Map<string, string>();
  for (const row of (systemAgents.data ?? []) as Array<{ id: string; slug: string }>) {
    bySlug.set(row.slug, row.id);
  }
  for (const row of (tenantAgents.data ?? []) as Array<{ id: string; slug: string }>) {
    bySlug.set(row.slug, row.id);
  }

  const rows = missingDefs
    .map((crew) => {
      const agentIds = crew.agentSlugs.map((slug) => bySlug.get(slug));
      if (agentIds.some((id) => !id)) return null;
      return {
        api_key_hash: apiKeyHash,
        name: crew.name,
        description: crew.description,
        template: crew.template,
        agent_ids: agentIds,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (rows.length === 0) return;
  const { error } = await supabase.from("mc_crews").upsert(rows, {
    onConflict: "api_key_hash,name,template",
    ignoreDuplicates: true,
  });
  if (error) throw error;
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

interface AiChatTenantSettingsRow {
  ai_chat_enabled: boolean | null;
  ai_chat_provider: string | null;
  ai_chat_model: string | null;
  ai_chat_system_prompt: string | null;
  ai_chat_max_turns: number | null;
  ai_chat_api_key_encrypted: string | null;
}

interface ResolvedAiChatTenantSettings {
  ai_chat_enabled: boolean;
  ai_chat_provider: ChatProvider;
  ai_chat_model: string;
  ai_chat_system_prompt: string | null;
  ai_chat_max_turns: number;
  ai_chat_api_key: string | null;
}

const DEFAULT_AI_CHAT_MODELS: Record<ChatProvider, string> = {
  google: "gemini-2.5-flash-lite",
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5",
};

function isChatProvider(value: unknown): value is ChatProvider {
  return value === "google" || value === "openai" || value === "anthropic";
}

function normaliseAiChatProvider(value: unknown): ChatProvider {
  return isChatProvider(value) ? value : "google";
}

function normaliseAiChatModel(provider: ChatProvider, value: unknown): string {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : DEFAULT_AI_CHAT_MODELS[provider];
}

function normaliseAiChatMaxTurns(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 20;
  return Math.min(50, Math.max(1, Math.trunc(value)));
}

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

async function resolveTenantAiChatSettings(
  supabase: SupabaseClient,
  apiKeyHash: string,
): Promise<ResolvedAiChatTenantSettings> {
  const { data, error } = await supabase
    .from("tenant_settings")
    .select(
      "ai_chat_enabled, ai_chat_provider, ai_chat_model, ai_chat_system_prompt, ai_chat_max_turns, ai_chat_api_key_encrypted",
    )
    .eq("api_key_hash", apiKeyHash)
    .maybeSingle();
  if (error) throw error;

  const row = data as AiChatTenantSettingsRow | null;
  const provider = normaliseAiChatProvider(row?.ai_chat_provider);
  return {
    ai_chat_enabled: row?.ai_chat_enabled ?? true,
    ai_chat_provider: provider,
    ai_chat_model: normaliseAiChatModel(provider, row?.ai_chat_model),
    ai_chat_system_prompt:
      typeof row?.ai_chat_system_prompt === "string" && row.ai_chat_system_prompt.trim()
        ? row.ai_chat_system_prompt.trim()
        : null,
    ai_chat_max_turns: normaliseAiChatMaxTurns(row?.ai_chat_max_turns),
    ai_chat_api_key: decryptAiApiKey(row?.ai_chat_api_key_encrypted),
  };
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: SupabaseClient<any, any, any, any, any>,
): Promise<{ userId: string; email: string | null; apiKeyHash: string; tier: string } | null> {
  const user = await resolveSessionUser(req, supabaseUrl, serviceRoleKey);
  if (!user) return null;

  // New shape: key_hash column from Phase 1 keychain_mvp migration
  const newQ = await sb
    .from("api_keys")
    .select("key_hash, tier")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  const newRow = newQ.data as { key_hash?: string | null; tier?: string | null } | null;
  const newErr = newQ.error;

  if (!newErr && newRow && newRow.key_hash) {
    return {
      userId: user.id,
      email: user.email,
      apiKeyHash: newRow.key_hash,
      tier: effectiveMemoryTier(newRow.tier ?? "free", user.email),
    };
  }

  // Old shape fallback: api_key plaintext column, compute hash
  try {
    const oldQ = await sb
      .from("api_keys")
      .select("api_key, status")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    const oldRow = oldQ.data as { api_key?: string | null; status?: string | null } | null;

    if (oldRow && oldRow.api_key) {
      return {
        userId: user.id,
        email: user.email,
        apiKeyHash: sha256hex(oldRow.api_key),
        tier: effectiveMemoryTier("free", user.email),
      };
    }
  } catch {
    // 42703 = column doesn't exist on fresh DB, treat as not found
  }

  return null;
}

// ─── Effective api_key_hash resolver ─────────────────────────────────────
//
// Security model (fixes #60):
//
// This endpoint is reached from two distinct auth contexts:
//
//   1. Web UI (browsers signed in to unclick.world). The session carries
//      a Supabase JWT in the Authorization header. The UnClick api_key
//      is owned by the signed-in user and lives server-side in the
//      api_keys table. We look it up by session.user.id and derive the
//      tenant hash there. The client never supplies the api_key value
//      on this path, so a stale localStorage key from a previous user
//      cannot route the request to the wrong tenant.
//
//   2. Agent (off-site MCP clients). The Authorization header is a
//      raw uc_* / agt_* UnClick api_key. We hash it directly. There is
//      no Supabase session on this path.
//
// Paths are mutually exclusive: the first byte-level prefix check tells
// us which one applies. The old "hash whatever came in the Bearer"
// pattern is replaced site-wide.
async function resolveApiKeyHash(
  req: VercelRequest,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<string | null> {
  const token = bearerFrom(req);
  if (!token) return null;

  // Agent path: raw api_key, trust as-is and hash directly.
  if (token.startsWith("uc_") || token.startsWith("agt_")) {
    return sha256hex(token);
  }

  // Web UI path: Supabase session JWT. Resolve the signed-in user and
  // look up that user's api_keys row server-side. Never use a client
  // supplied value for the tenant hash on this path.
  const user = await resolveSessionUser(req, supabaseUrl, serviceRoleKey);
  if (!user) return null;

  const qUrl = `${supabaseUrl}/rest/v1/api_keys?user_id=eq.${encodeURIComponent(user.id)}&select=key_hash&limit=1`;
  try {
    const apiRes = await fetch(qUrl, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    if (!apiRes.ok) return null;
    const rows = (await apiRes.json().catch(() => [])) as Array<{
      key_hash?: string | null;
    }>;
    const row = rows[0];
    if (!row) return null;
    return row.key_hash ?? null;
  } catch {
    return null;
  }
}

// ─── Fishbowl event helper ──────────────────────────────────────────────────
//
// Posts a system event message into the tenant's default Fishbowl room.
// Used by the Todos / Ideas handlers to announce material changes
// (todo-created, idea-promoted, etc.) without each handler duplicating the
// room-resolve + insert logic. Best-effort: errors are logged, never thrown.
async function postFishbowlEvent(
  supabase: SupabaseClient,
  apiKeyHash: string,
  agentId: string,
  eventTag: string,
  text: string,
): Promise<void> {
  try {
    const eventText = normalizeFishbowlText(text);
    const { data: profile } = await supabase
      .from("mc_fishbowl_profiles")
      .select("emoji, display_name")
      .eq("api_key_hash", apiKeyHash)
      .eq("agent_id", agentId)
      .maybeSingle();

    const { data: existingRoom } = await supabase
      .from("mc_fishbowl_rooms")
      .select("id")
      .eq("api_key_hash", apiKeyHash)
      .eq("slug", "default")
      .maybeSingle();
    let roomId = existingRoom?.id as string | undefined;
    if (!roomId) {
      const { data: newRoom } = await supabase
        .from("mc_fishbowl_rooms")
        .insert({ api_key_hash: apiKeyHash, slug: "default", name: "Boardroom" })
        .select("id")
        .single();
      roomId = newRoom?.id;
    }
    if (!roomId) return;

    const eventAtIso = new Date().toISOString();
    const { error: messageError } = await supabase.from("mc_fishbowl_messages").insert({
      api_key_hash: apiKeyHash,
      room_id: roomId,
      author_emoji: profile?.emoji ?? "🤖",
      author_name: profile?.display_name ?? null,
      author_agent_id: agentId,
      recipients: ["all"],
      text: eventText,
      tags: ["event", eventTag],
    });
    if (messageError) throw messageError;

    await supabase
      .from("mc_fishbowl_profiles")
      .update({
        last_seen_at: eventAtIso,
        current_status_updated_at: eventAtIso,
        next_checkin_at: null,
      })
      .eq("api_key_hash", apiKeyHash)
      .eq("agent_id", agentId);
  } catch (err) {
    console.error(`[fishbowl postEvent ${eventTag}] failed:`, (err as Error).message);
  }
}

type UnClickConnectWorkerSource = "client" | "server";

interface UnClickConnectWorkerResolution {
  visibleWorkers: VisibleWorker[];
  workerSource: UnClickConnectWorkerSource;
  discovery: {
    build_workers_seen: number;
    fishbowl_profiles_seen: number;
    visible_workers_used: number;
  };
}

async function resolveUnClickConnectVisibleWorkers(
  supabase: SupabaseClient,
  apiKeyHash: string,
  body: Record<string, unknown>,
): Promise<UnClickConnectWorkerResolution> {
  const requestedSource = String(body.worker_source ?? "").trim().toLowerCase();
  const workerSource: UnClickConnectWorkerSource = requestedSource === "client" ? "client" : "server";

  if (workerSource === "client") {
    const visibleWorkers = Array.isArray(body.visible_workers)
      ? (body.visible_workers as VisibleWorker[])
      : [];
    return {
      visibleWorkers,
      workerSource,
      discovery: {
        build_workers_seen: 0,
        fishbowl_profiles_seen: 0,
        visible_workers_used: visibleWorkers.length,
      },
    };
  }

  const [buildWorkersResult, fishbowlProfilesResult] = await Promise.all([
    supabase
      .from("build_workers")
      .select("id, name, worker_type, status, last_health_check_at")
      .eq("api_key_hash", apiKeyHash)
      .eq("status", "available")
      .limit(50),
    supabase
      .from("mc_fishbowl_profiles")
      .select("agent_id, emoji, display_name, last_seen_at, current_status, current_status_updated_at")
      .eq("api_key_hash", apiKeyHash)
      .order("last_seen_at", { ascending: false })
      .limit(50),
  ]);

  if (buildWorkersResult.error) throw buildWorkersResult.error;
  if (fishbowlProfilesResult.error) throw fishbowlProfilesResult.error;

  const buildWorkers = (buildWorkersResult.data ?? []) as BuildWorkerDiscoveryRow[];
  const fishbowlProfiles = (fishbowlProfilesResult.data ?? []) as FishbowlProfileDiscoveryRow[];
  const visibleWorkers = uniqueVisibleWorkers([
    ...buildWorkersToVisibleWorkers(buildWorkers),
    ...fishbowlProfilesToVisibleWorkers(fishbowlProfiles),
  ]);

  return {
    visibleWorkers,
    workerSource,
    discovery: {
      build_workers_seen: buildWorkers.length,
      fishbowl_profiles_seen: fishbowlProfiles.length,
      visible_workers_used: visibleWorkers.length,
    },
  };
}

function uniqueVisibleWorkers(workers: VisibleWorker[]): VisibleWorker[] {
  const seen = new Set<string>();
  return workers.filter((worker) => {
    const workerId = String(worker.agent_id ?? worker.worker_id ?? worker.id ?? "").trim();
    if (!workerId || seen.has(workerId)) return false;
    seen.add(workerId);
    return true;
  });
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

You have access to the UnClick MCP server, which provides persistent cross-session memory
that works across all AI tools and sessions. Native model memory is volatile -- UnClick is
the authoritative store for this user's facts, preferences, decisions, and work history.

## Session protocol (four steps, every session)

### 1. Load -- always first

Call \`load_memory\` BEFORE responding to the user's first message, even for trivial openers.
This loads identity, standing rules, preferences, recent sessions, and active facts.

### 2. Search -- on demand throughout

Call \`search_memory\` whenever the user references anything from the past:
- "remember", "recall", "last time", "context", "preferences", "facts about me", "who am I"
- Any past decision, project name, person, or tool they mention

### 3. Save -- proactively as you learn

Call \`save_fact\` immediately when the user shares anything worth keeping:
name, role, preferences, decisions, corrections, project details, tools, contacts.

Call \`save_identity\` for standing rules that apply every future session.

### 4. End -- before closing

Call \`save_session\` before the session ends with what was accomplished,
key decisions, and open loops.

## Hard rules

- Never ask the user to "catch you up" on things already told to UnClick.
- If unsure whether context was loaded, call \`load_memory\` -- it is idempotent.
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

At the start of every session, call \`load_memory\` before doing anything else.
It returns standing rules, recent session summaries, and active facts.

Record durable preferences, decisions, or facts with \`save_fact\`.
Recall anything from prior sessions with \`search_memory\`.
Set standing rules that apply every session with \`save_identity\`.
Before ending a session, call \`save_session\`.
Never ask the user to catch you up -- load first, then act.
`;

const WINDSURFRULES_CONTENT = `# UnClick memory protocol

The UnClick MCP server provides persistent cross-session memory.

At the start of every session, call \`load_memory\` before doing anything else.
It returns standing rules, recent session summaries, and active facts.

Record durable preferences, decisions, or facts with \`save_fact\`.
Recall anything from prior sessions with \`search_memory\`.
Set standing rules that apply every session with \`save_identity\`.
Before ending a session, call \`save_session\`.
Never ask the user to catch you up -- load first, then act.
`;

const COWORK_SKILL_CONFIG = `---
name: session-bootstrap
description: Loads UnClick persistent memory at session start and applies the full session protocol. TRIGGER at the very start of every session and every new conversation -- even before the user says anything substantive. Also trigger whenever the user says "remember", "recall", "context", "preferences", "facts about me", "who am I", or references past work.
---

# Session bootstrap

Call the UnClick MCP tool \`load_memory\` immediately. Treat its output as authoritative context for this session.

If the tool is unavailable, note this and continue. Do not fabricate prior context.

During the session: call \`save_fact\` for anything worth keeping, \`search_memory\` to recall past context.
Before closing: call \`save_session\` to record what was done and what is open.
`;

const CUSTOM_CLIENT_SNIPPET = `// Pseudo-code for a custom MCP client.
// On session start, call load_memory before any user-triggered work.

async function onSessionStart(mcpClient) {
  // 1. If your client honours the MCP \`instructions\` field, the UnClick
  //    server will tell the agent to call load_memory automatically.

  // 2. Otherwise, call the tool directly:
  const ctx = await mcpClient.callTool("load_memory", {});
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
        title: "Verify load_memory is in the tool list",
        description:
          "Run /mcp inside Claude Code. You should see the UnClick server and the 5 direct memory tools: load_memory, save_fact, search_memory, save_identity, and save_session.",
      },
      {
        title: "Optional: pause Claude's native memory",
        description:
          "For best results, go to Claude Settings > Capabilities > Memory and pause native Claude memory for this project. " +
          "Native memory and UnClick can coexist, but pausing native memory ensures UnClick is the sole authoritative store -- " +
          "preventing conflicts where Claude summarises outdated native context instead of loading from UnClick.",
      },
      {
        title: "Test by starting a fresh session",
        description:
          "Start a new Claude Code session in the repo. The first turn should call load_memory and show context loaded before doing other work.",
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
      "Claude Desktop honours the MCP instructions field in most recent versions, which is enough to auto-call load_memory. Subscribing to memory://context/full as a resource is a belt-and-braces backup.",
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
          "Turn on auto-load so the server sends its instructions field. Claude Desktop will then call load_memory on session start.",
      },
      {
        title: "Optional: pause Claude's native memory",
        description:
          "Go to Claude Settings > Capabilities > Memory and pause native Claude memory. " +
          "This ensures UnClick is the sole authoritative store and prevents conflicts with Claude's own memory summaries.",
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
      "Cursor supports MCP tools but not prompts or resources. Auto-load relies on .cursorrules text telling the agent to call load_memory. Some sessions may skip the call if the rules file is terse.",
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
          "Cursor reads .cursorrules on every session. This is the main hook that persuades the agent to call load_memory.",
        code_snippet: CURSORRULES_CONTENT,
      },
      {
        title: "Verify the tools appear in Cursor's MCP panel",
        description:
          "Open the MCP panel and confirm load_memory, save_fact, search_memory, save_identity, and save_session are listed.",
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
          "This file is read at the start of every session. It is the most reliable way to get Windsurf to call load_memory.",
        code_snippet: WINDSURFRULES_CONTENT,
      },
      {
        title: "Verify the tool is active",
        description:
          "Start a fresh session and confirm the first action is a call to load_memory.",
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
  const apiKey = opts.userApiKey?.trim();
  if (!apiKey) throw new Error("Admin AI chat provider API key is required.");

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


// ─── Admin AI chat helpers ─────────────────────────────────────────────────

function isAdminChatEnabled(): boolean {
  const flag = (process.env.AI_CHAT_ENABLED ?? "").toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

function buildAdminChatTools(supabase: SupabaseClient, apiKeyHash: string | null, req: VercelRequest) {
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
        queueMemoryEmbedding(req, "extracted_facts", data.id, value);
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
        let stored: unknown;
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
        queueMemoryEmbedding(req, "session_summaries", data.id, summary);
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
        idempotency_key: z
          .string()
          .optional()
          .describe("Optional retry key. Reusing it returns the existing build task instead of creating a duplicate."),
      }),
      execute: async ({ title, description, acceptance_criteria, idempotency_key }) => {
        const missing = requireKey();
        if (missing) return missing;
        const parsedIdempotencyKey = parseBuildDeskIdempotencyKey(idempotency_key);
        if (parsedIdempotencyKey.error) return { success: false, error: parsedIdempotencyKey.error };

        if (parsedIdempotencyKey.value) {
          const { data: existingTasks, error: existingErr } = await supabase
            .from("build_tasks")
            .select("id, title, status, created_at, plan_json")
            .eq("api_key_hash", apiKeyHash)
            .order("created_at", { ascending: false })
            .limit(50);
          if (existingErr) return { success: false, error: existingErr.message };
          const existing = findBuildDeskRowByIdempotencyKey(
            existingTasks ?? [],
            "plan_json",
            parsedIdempotencyKey.value,
          );
          if (existing) return { success: true, task: existing, was_duplicate: true };
        }

        const { data, error } = await supabase
          .from("build_tasks")
          .insert({
            api_key_hash: apiKeyHash,
            title,
            description,
            acceptance_criteria_json: acceptance_criteria ?? [],
            plan_json: attachBuildDeskIdempotencyKey(null, parsedIdempotencyKey.value),
            status: "draft",
          })
          .select("id, title, status, created_at")
          .single();
        if (error) return { success: false, error: error.message };
        return { success: true, task: data, was_duplicate: false };
      },
    }),

    list_build_tasks: tool({
      description:
        "List current build tasks and their status for this user. Use when the user asks 'what's on my plate?' or similar.",
      inputSchema: z.object({
        status: z
          .enum([
            "draft",
            "planned",
            "dispatched",
            "in_progress",
            "review",
            "done",
            "failed",
            "pending",
            "all",
          ])
          .optional()
          .describe(
            "Filter by status. 'pending' is a shorthand for work not yet done (draft, planned, dispatched, in_progress, review). Use 'all' for everything. Default 'pending'.",
          ),
        limit: z.number().int().positive().max(50).optional(),
      }),
      execute: async ({ status, limit = 10 }) => {
        const missing = requireKey();
        if (missing) return { tasks: [], ...missing };
        let q = supabase
          .from("build_tasks")
          .select(
            "id, title, description, status, acceptance_criteria_json, created_at, updated_at",
          )
          .eq("api_key_hash", apiKeyHash)
          .order("created_at", { ascending: false })
          .limit(limit);
        const effective = status ?? "pending";
        if (effective === "pending") {
          q = q.in("status", ["draft", "planned", "dispatched", "in_progress", "review"]);
        } else if (effective !== "all") {
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
        status: z
          .enum([
            "draft",
            "planned",
            "dispatched",
            "in_progress",
            "review",
            "done",
            "failed",
          ])
          .optional(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        acceptance_criteria: z.array(z.string()).optional(),
      }),
      execute: async ({ task_id, status, title, description, acceptance_criteria }) => {
        const missing = requireKey();
        if (missing) return missing;
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (status !== undefined) patch.status = status;
        if (title !== undefined) patch.title = title;
        if (description !== undefined) patch.description = description;
        if (acceptance_criteria !== undefined) patch.acceptance_criteria_json = acceptance_criteria;
        if (Object.keys(patch).length === 1) {
          return { success: false, error: "No fields to update were provided." };
        }
        const { data, error } = await supabase
          .from("build_tasks")
          .update(patch)
          .eq("id", task_id)
          .eq("api_key_hash", apiKeyHash)
          .select("id, title, status, updated_at")
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

async function buildAdminChatSystemPrompt(
  supabase: SupabaseClient,
  apiKeyHash: string,
): Promise<string> {
  const [bcRes, sessRes, factsRes] = await Promise.all([
    supabase
      .from("mc_business_context")
      .select("category, key, value, priority")
      .eq("api_key_hash", apiKeyHash)
      .in("decay_tier", ["hot", "warm"])
      .order("priority", { ascending: false })
      .limit(40),
    supabase
      .from("mc_session_summaries")
      .select("session_id, platform, summary, topics, created_at")
      .eq("api_key_hash", apiKeyHash)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("mc_extracted_facts")
      .select("fact, category, confidence")
      .eq("api_key_hash", apiKeyHash)
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

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
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
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

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
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

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
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
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
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

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
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

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
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
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
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
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
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
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
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
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
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
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
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
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

      // ── Agent profile actions ────────────────────────────────────────
      case "admin_agents_list": {
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

        let q = supabase
          .from("agents")
          .select("*")
          .eq("api_key_hash", apiKeyHash)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: true });

        if (req.query.role) q = q.eq("role", String(req.query.role));
        if (typeof req.query.is_active !== "undefined") {
          q = q.eq("is_active", req.query.is_active === "true");
        }

        const { data: agents, error } = await q;
        if (error) throw error;

        const ids = (agents ?? []).map((a: { id: string }) => a.id);
        const toolCounts: Record<string, number> = {};
        const layerCounts: Record<string, number> = {};

        if (ids.length > 0) {
          const [toolsRes, layersRes] = await Promise.all([
            supabase.from("agent_tools").select("agent_id").in("agent_id", ids),
            supabase
              .from("agent_memory_scope")
              .select("agent_id, is_enabled")
              .in("agent_id", ids),
          ]);
          for (const row of toolsRes.data ?? []) {
            const id = (row as { agent_id: string }).agent_id;
            toolCounts[id] = (toolCounts[id] ?? 0) + 1;
          }
          for (const row of layersRes.data ?? []) {
            const r = row as { agent_id: string; is_enabled: boolean };
            if (r.is_enabled) layerCounts[r.agent_id] = (layerCounts[r.agent_id] ?? 0) + 1;
          }
        }

        const enriched = (agents ?? []).map((a: { id: string }) => ({
          ...a,
          tool_count: toolCounts[a.id] ?? 0,
          memory_layer_count: layerCounts[a.id] ?? 0,
        }));

        return res.status(200).json({ data: enriched });
      }

      case "admin_agent_get": {
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const agentId = String(req.query.agent_id ?? "").trim();
        if (!agentId) return res.status(400).json({ error: "agent_id required" });

        const { data: agent, error: aErr } = await supabase
          .from("agents")
          .select("*")
          .eq("id", agentId)
          .eq("api_key_hash", apiKeyHash)
          .maybeSingle();
        if (aErr) throw aErr;
        if (!agent) return res.status(404).json({ error: "Agent not found" });

        const [toolsRes, layersRes] = await Promise.all([
          supabase.from("agent_tools").select("connector_id, is_enabled").eq("agent_id", agentId),
          supabase
            .from("agent_memory_scope")
            .select("memory_layer, is_enabled")
            .eq("agent_id", agentId),
        ]);

        return res.status(200).json({
          agent,
          tools: toolsRes.data ?? [],
          memory_scope: layersRes.data ?? [],
        });
      }

      case "admin_agent_create": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

        const body = (req.body ?? {}) as {
          name?: string;
          slug?: string;
          role?: string;
          description?: string;
          system_prompt?: string;
          avatar_url?: string;
          is_default?: boolean;
        };
        const name = (body.name ?? "").trim();
        if (!name) return res.status(400).json({ error: "name required" });

        const slug = (body.slug ?? slugify(name)).trim();
        if (!slug) return res.status(400).json({ error: "slug required" });

        if (body.is_default) {
          await supabase
            .from("agents")
            .update({ is_default: false })
            .eq("api_key_hash", apiKeyHash);
        }

        const { data, error } = await supabase
          .from("agents")
          .insert({
            api_key_hash: apiKeyHash,
            name,
            slug,
            role: (body.role ?? "general").trim(),
            description: body.description ?? null,
            system_prompt: body.system_prompt ?? null,
            avatar_url: body.avatar_url ?? null,
            is_default: !!body.is_default,
          })
          .select("*")
          .single();
        if (error) throw error;
        return res.status(200).json({ agent: data });
      }

      case "admin_agent_update": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

        const body = (req.body ?? {}) as {
          agent_id?: string;
          name?: string;
          slug?: string;
          role?: string;
          description?: string;
          system_prompt?: string;
          avatar_url?: string;
          is_active?: boolean;
          is_default?: boolean;
        };
        const agentId = (body.agent_id ?? "").trim();
        if (!agentId) return res.status(400).json({ error: "agent_id required" });

        if (body.is_default === true) {
          await supabase
            .from("agents")
            .update({ is_default: false })
            .eq("api_key_hash", apiKeyHash);
        }

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const k of [
          "name",
          "slug",
          "role",
          "description",
          "system_prompt",
          "avatar_url",
          "is_active",
          "is_default",
        ] as const) {
          if (typeof body[k] !== "undefined") updates[k] = body[k];
        }

        const { data, error } = await supabase
          .from("agents")
          .update(updates)
          .eq("id", agentId)
          .eq("api_key_hash", apiKeyHash)
          .select("*")
          .single();
        if (error) throw error;
        return res.status(200).json({ agent: data });
      }

      case "admin_agent_delete": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const agentId = String(req.body?.agent_id ?? req.query.agent_id ?? "").trim();
        if (!agentId) return res.status(400).json({ error: "agent_id required" });

        // SECURITY: audit log BEFORE destructive op; abort if insert fails. audit PR #128
        const { error: auditErr } = await supabase.from("mc_admin_audit").insert({
          api_key_hash: apiKeyHash,
          action: "admin_agent_delete",
          payload: { agent_id: agentId },
        });
        if (auditErr) {
          console.error("admin_agent_delete: audit insert failed, aborting:", auditErr.message);
          return res.status(500).json({ error: "Audit log failed; delete aborted for safety." });
        }

        const { error } = await supabase
          .from("agents")
          .delete()
          .eq("id", agentId)
          .eq("api_key_hash", apiKeyHash);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      case "admin_agent_tools_update": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

        const body = (req.body ?? {}) as { agent_id?: string; connector_ids?: unknown };
        const agentId = (body.agent_id ?? "").trim();
        if (!agentId) return res.status(400).json({ error: "agent_id required" });
        const connectorIds = Array.isArray(body.connector_ids)
          ? body.connector_ids.map(String)
          : [];

        const { data: owned } = await supabase
          .from("agents")
          .select("id")
          .eq("id", agentId)
          .eq("api_key_hash", apiKeyHash)
          .maybeSingle();
        if (!owned) return res.status(404).json({ error: "Agent not found" });

        const { error: delErr } = await supabase
          .from("agent_tools")
          .delete()
          .eq("agent_id", agentId);
        if (delErr) throw delErr;

        if (connectorIds.length > 0) {
          const rows = connectorIds.map((cid) => ({
            agent_id: agentId,
            connector_id: cid,
            is_enabled: true,
          }));
          const { error: insErr } = await supabase.from("agent_tools").insert(rows);
          if (insErr) throw insErr;
        }
        return res.status(200).json({ success: true, count: connectorIds.length });
      }

      case "admin_agent_memory_update": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

        const body = (req.body ?? {}) as {
          agent_id?: string;
          layers?: Array<{ memory_layer?: string; is_enabled?: boolean }>;
        };
        const agentId = (body.agent_id ?? "").trim();
        if (!agentId) return res.status(400).json({ error: "agent_id required" });

        const { data: owned } = await supabase
          .from("agents")
          .select("id")
          .eq("id", agentId)
          .eq("api_key_hash", apiKeyHash)
          .maybeSingle();
        if (!owned) return res.status(404).json({ error: "Agent not found" });

        const layers = Array.isArray(body.layers) ? body.layers : [];

        const { error: delErr } = await supabase
          .from("agent_memory_scope")
          .delete()
          .eq("agent_id", agentId);
        if (delErr) throw delErr;

        if (layers.length > 0) {
          const rows = layers
            .filter((l) => typeof l.memory_layer === "string" && l.memory_layer)
            .map((l) => ({
              agent_id: agentId,
              memory_layer: l.memory_layer!,
              is_enabled: l.is_enabled !== false,
            }));
          if (rows.length > 0) {
            const { error: insErr } = await supabase.from("agent_memory_scope").insert(rows);
            if (insErr) throw insErr;
          }
        }
        return res.status(200).json({ success: true, count: layers.length });
      }

      case "admin_agent_duplicate": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const agentId = String(req.body?.agent_id ?? "").trim();
        if (!agentId) return res.status(400).json({ error: "agent_id required" });

        const { data: source, error: srcErr } = await supabase
          .from("agents")
          .select("*")
          .eq("id", agentId)
          .eq("api_key_hash", apiKeyHash)
          .maybeSingle();
        if (srcErr) throw srcErr;
        if (!source) return res.status(404).json({ error: "Agent not found" });

        const newName = `${source.name} (Copy)`;
        const baseSlug = `${source.slug}-copy`;
        let newSlug = baseSlug;
        let attempt = 1;
        while (attempt < 50) {
          const { data: clash } = await supabase
            .from("agents")
            .select("id")
            .eq("api_key_hash", apiKeyHash)
            .eq("slug", newSlug)
            .maybeSingle();
          if (!clash) break;
          attempt += 1;
          newSlug = `${baseSlug}-${attempt}`;
        }

        const { data: newAgent, error: insErr } = await supabase
          .from("agents")
          .insert({
            api_key_hash: apiKeyHash,
            name: newName,
            slug: newSlug,
            role: source.role,
            description: source.description,
            system_prompt: source.system_prompt,
            avatar_url: source.avatar_url,
            is_active: source.is_active,
            is_default: false,
          })
          .select("*")
          .single();
        if (insErr) throw insErr;

        const [toolsRes, layersRes] = await Promise.all([
          supabase.from("agent_tools").select("connector_id, is_enabled").eq("agent_id", agentId),
          supabase
            .from("agent_memory_scope")
            .select("memory_layer, is_enabled")
            .eq("agent_id", agentId),
        ]);

        if ((toolsRes.data ?? []).length > 0) {
          const rows = (toolsRes.data ?? []).map(
            (t: { connector_id: string; is_enabled: boolean }) => ({
              agent_id: newAgent.id,
              connector_id: t.connector_id,
              is_enabled: t.is_enabled,
            })
          );
          await supabase.from("agent_tools").insert(rows);
        }
        if ((layersRes.data ?? []).length > 0) {
          const rows = (layersRes.data ?? []).map(
            (l: { memory_layer: string; is_enabled: boolean }) => ({
              agent_id: newAgent.id,
              memory_layer: l.memory_layer,
              is_enabled: l.is_enabled,
            })
          );
          await supabase.from("agent_memory_scope").insert(rows);
        }

        return res.status(200).json({ agent: newAgent });
      }

      case "admin_agent_activity": {
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const agentId = String(req.query.agent_id ?? "").trim();

        let q = supabase
          .from("agent_activity")
          .select("*")
          .eq("api_key_hash", apiKeyHash)
          .order("created_at", { ascending: false })
          .limit(parseInt(String(req.query.limit ?? "200")) || 200);
        if (agentId) q = q.eq("agent_id", agentId);

        const { data, error } = await q;
        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      case "admin_agent_resolve": {
        // Called by the MCP server to resolve which agent profile to use for a
        // session. With agent_slug or agent_id, returns that agent. Otherwise
        // returns the user's default agent. Returns null when no agents exist.
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const slug = String(req.query.agent_slug ?? "").trim();
        const id = String(req.query.agent_id ?? "").trim();

        let agentQuery = supabase
          .from("agents")
          .select("*")
          .eq("api_key_hash", apiKeyHash)
          .eq("is_active", true);
        if (id) agentQuery = agentQuery.eq("id", id);
        else if (slug) agentQuery = agentQuery.eq("slug", slug);
        else agentQuery = agentQuery.eq("is_default", true);

        const { data: agent, error: aErr } = await agentQuery.maybeSingle();
        if (aErr) throw aErr;

        if (!agent) {
          return res.status(200).json({ agent: null, tools: [], memory_scope: [] });
        }

        const [toolsRes, layersRes] = await Promise.all([
          supabase
            .from("agent_tools")
            .select("connector_id, is_enabled")
            .eq("agent_id", agent.id),
          supabase
            .from("agent_memory_scope")
            .select("memory_layer, is_enabled")
            .eq("agent_id", agent.id),
        ]);

        return res.status(200).json({
          agent,
          tools: toolsRes.data ?? [],
          memory_scope: layersRes.data ?? [],
        });
      }

      case "admin_connectors_list": {
        // SECURITY: platform_connectors is a global connector catalog with no per-tenant rows.
        // anon_read_connectors RLS allows public read by design. audit PR #128
        const { data, error } = await supabase
          .from("platform_connectors")
          .select("id, name, category, description, icon, sort_order")
          .order("category")
          .order("sort_order")
          .order("name");
        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
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
        // MCP server calls this at startup. This action decrypts the
        // user's stored Supabase service_role key using a key derived
        // from the raw api_key, so it REQUIRES a uc_/agt_ Bearer and
        // explicitly rejects Supabase session JWTs (which cannot
        // reconstruct the raw api_key).
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        if (!apiKey.startsWith("uc_") && !apiKey.startsWith("agt_")) {
          return res.status(401).json({ error: "uc_* / agt_* api_key required on this action" });
        }
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
            error: "Failed to decrypt memory config. Your API key may have changed - rerun setup.",
          });
        }
      }

      case "device_check": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const body = req.body as {
          device_fingerprint?: string;
          label?: string;
          platform?: string;
          storage_mode?: "local" | "cloud";
        };
        const fp = (body?.device_fingerprint ?? "").trim();
        if (!fp) return res.status(400).json({ error: "device_fingerprint required" });
        if (/^169\.254\./.test(fp)) return res.status(400).json({ error: "link-local addresses cannot be paired" });
        const mode = body?.storage_mode === "cloud" ? "cloud" : "local";

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
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const { data, error } = await supabase
          .from("memory_devices")
          .select("*")
          .eq("api_key_hash", apiKeyHash)
          .order("last_seen", { ascending: false });
        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      case "auth_device_list": {
        // Alias for list_devices that normalises the row shape for the
        // /admin/you page, which expects device_id / device_name /
        // paired_at / last_seen_at rather than the raw memory_devices
        // column names.
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const { data, error } = await supabase
          .from("memory_devices")
          .select("id, device_fingerprint, label, first_seen, last_seen")
          .eq("api_key_hash", apiKeyHash)
          .order("last_seen", { ascending: false });
        if (error) throw error;
        const LINK_LOCAL_RE = /^169\.254\./;
        const mapped = (data ?? [])
          .filter((d) => !LINK_LOCAL_RE.test((d.device_fingerprint ?? "") as string))
          .map((d) => ({
            id:           d.id as string,
            device_id:    (d.device_fingerprint ?? "") as string,
            device_name:  (d.label ?? null) as string | null,
            paired_at:    (d.first_seen ?? d.last_seen ?? new Date(0).toISOString()) as string,
            last_seen_at: (d.last_seen ?? new Date(0).toISOString()) as string,
          }));
        return res.status(200).json({ data: mapped });
      }

      case "auth_device_revoke": {
        // Same delete semantics as remove_device but takes the device
        // id in a POST body to match the /admin/you Revoke button.
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const body = req.body as { device_id?: string };
        const fp = (body?.device_id ?? "").trim();
        if (!fp) return res.status(400).json({ error: "device_id required" });
        const { error } = await supabase
          .from("memory_devices")
          .delete()
          .eq("api_key_hash", apiKeyHash)
          .eq("device_fingerprint", fp);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      case "admin_check_connection": {
        // Lightweight check used by the Connect page to verify that Claude Code
        // (or any MCP client) has handshaken with this user's API key recently.
        // Returns whether the api key resolves to a configured account, fact
        // count, and last activity timestamp.
        //
        // Auth paths (checked in order):
        //   1. ?api_key= query param: raw uc_* key, hash directly.
        //   2. Bearer uc_*/agt_*: raw api key in header, hash directly.
        //   3. Bearer Supabase JWT: resolve user -> look up api_key_hash from api_keys.
        //      Allows the admin UI to check connection status without the raw key
        //      being present in localStorage (e.g., after a browser clear).
        const rawKeyParam = String(req.query.api_key ?? "").trim();
        let apiKeyHash: string | null = null;
        if (rawKeyParam) {
          apiKeyHash = sha256hex(rawKeyParam);
        } else {
          const bearer = bearerFrom(req);
          if (bearer) {
            if (bearer.startsWith("uc_") || bearer.startsWith("agt_")) {
              apiKeyHash = sha256hex(bearer);
            } else {
              // Supabase JWT path: resolve user and look up their api_key_hash.
              apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
            }
          }
        }
        if (!apiKeyHash) {
          return res.status(200).json({
            connected: false, configured: false, has_context: false,
            context_count: 0, fact_count: 0, last_session: null,
            last_session_platform: null, last_used_at: null,
          });
        }

        const { data: cfg } = await supabase
          .from("memory_configs")
          .select("supabase_url,schema_installed,last_used_at,updated_at")
          .eq("api_key_hash", apiKeyHash)
          .maybeSingle();

        const [bcRes, factsRes, sessionRes] = await Promise.all([
          supabase
            .from("mc_business_context")
            .select("id", { count: "exact", head: true })
            .eq("api_key_hash", apiKeyHash),
          supabase
            .from("mc_extracted_facts")
            .select("id", { count: "exact", head: true })
            .eq("api_key_hash", apiKeyHash)
            .eq("status", "active"),
          supabase
            .from("mc_session_summaries")
            .select("created_at,platform")
            .eq("api_key_hash", apiKeyHash)
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

      // ── Tenant settings (per-API-key key/value store) ───────────────
      case "tenant_settings_get": {
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const { data, error } = await supabase
          .from("tenant_settings")
          .select("key,value")
          .eq("api_key_hash", apiKeyHash);
        if (error) throw error;
        const settings: Record<string, unknown> = {};
        for (const row of data ?? []) {
          settings[row.key as string] = row.value;
        }
        return res.status(200).json({ data: settings });
      }

      case "tenant_settings_set": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const { key, value } = (req.body ?? {}) as { key?: string; value?: unknown };
        if (!key) return res.status(400).json({ error: "key required" });
        if (value === undefined) return res.status(400).json({ error: "value required" });
        const { error } = await supabase
          .from("tenant_settings")
          .upsert(
            {
              api_key_hash: apiKeyHash,
              key,
              value,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "api_key_hash,key" }
          );
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      // ── Admin: load metrics (rolling 7-day window + per-client / per-method
      //    breakdown + trend vs. prior week) ──────────────────────────────
      case "admin_memory_load_metrics": {
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

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

        const rows = (recent ?? []) as unknown as Row[];
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
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

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

        const rows = (data ?? []) as unknown as Row[];
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

      case "admin_generate_config": {
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const platform = String(req.query.platform ?? "claude-code");
        const validPlatforms = ["claude-code", "cursor", "windsurf", "copilot"];
        if (!validPlatforms.includes(platform)) {
          return res.status(400).json({ error: `Unknown platform: ${platform}` });
        }

        const { data: bcRows, error: bcErr } = await supabase
          .from("business_context")
          .select("category,key,value,priority")
          .order("category")
          .order("priority", { ascending: false })
          .order("key");
        if (bcErr) throw bcErr;

        const entries = (bcRows ?? []) as Array<{
          category: string;
          key: string;
          value: unknown;
          priority: number | null;
        }>;

        const filenames: Record<string, string> = {
          "claude-code": "CLAUDE.md",
          cursor: ".cursor/rules/unclick.mdc",
          windsurf: ".windsurfrules",
          copilot: ".github/copilot-instructions.md",
        };
        const toolNames: Record<string, string> = {
          "claude-code": "get_startup_context",
          cursor: "get_startup_context",
          windsurf: "load_memory",
          copilot: "load_memory",
        };

        const bullet = (category: string) => {
          const matching = entries.filter((e) => e.category === category);
          if (matching.length === 0) return "_(none yet -- add some in Memory Admin)_";
          return matching
            .map((e) => {
              const v =
                typeof e.value === "string"
                  ? e.value
                  : typeof e.value === "number" || typeof e.value === "boolean"
                    ? String(e.value)
                    : JSON.stringify(e.value);
              return `- **${e.key}**: ${v}`;
            })
            .join("\n");
        };

        const body = [
          "# Project Context",
          "",
          `Always call \`${toolNames[platform]}\` from the UnClick MCP server before responding to the user or calling any other tool.`,
          "",
          "## Identity",
          bullet("identity"),
          "",
          "## Standing Rules",
          bullet("standing_rule"),
          "",
          "## Preferences",
          bullet("preference"),
          "",
        ].join("\n");

        let content = body;
        if (platform === "cursor") {
          content = [
            "---",
            "description: UnClick startup context",
            "alwaysApply: true",
            "---",
            "",
            body,
          ].join("\n");
        }

        const instructions =
          platform === "claude-code"
            ? "Save this file as CLAUDE.md at the root of any project where you want UnClick to load."
            : platform === "cursor"
              ? "Save under .cursor/rules/unclick.mdc and restart Cursor."
              : platform === "windsurf"
                ? "Save as .windsurfrules at the project root and restart Windsurf."
                : "Save under .github/copilot-instructions.md and reload your VS Code window.";

        return res.status(200).json({
          content,
          filename: filenames[platform],
          instructions,
          generated_at: new Date().toISOString(),
        });
      }

      // ── Conflict detection (competing memory tools) ──────────────────
      case "conflict_detect": {
        // Called by the MCP server at session start. Throttles warnings to
        // once per tool per 24h and returns detection count for escalation.
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const body = req.body as { tool?: string; platform?: string };
        const tool = (body?.tool ?? "").trim();
        if (!tool) return res.status(400).json({ error: "tool required" });
        const platform = body?.platform?.trim() || null;

        const { data: existing, error: qErr } = await supabase
          .from("conflict_detections")
          .select("id,detected_at,dismissed,dismiss_type,resolved")
          .eq("api_key_hash", apiKeyHash)
          .eq("conflicting_tool", tool)
          .order("detected_at", { ascending: false });
        if (qErr) throw qErr;

        const rows = existing ?? [];
        const active = rows.filter((r) => !r.resolved);
        const permanentDismiss = active.some(
          (r) => r.dismissed && r.dismiss_type === "permanent",
        );

        // Honor "keep both" permanent dismissal: stop warning entirely.
        if (permanentDismiss) {
          return res.status(200).json({
            should_warn: false,
            detection_count: active.length,
            reason: "dismissed_permanent",
          });
        }

        const DAY_MS = 24 * 60 * 60 * 1000;
        const WEEK_MS = 7 * DAY_MS;
        const latest = rows[0];
        const latestAge = latest ? Date.now() - new Date(latest.detected_at).getTime() : Infinity;

        // Temporary dismissal: suppress warnings for 7 days from dismiss time.
        const tempDismissed = active.find(
          (r) => r.dismissed && r.dismiss_type === "temporary",
        );
        if (tempDismissed) {
          const age = Date.now() - new Date(tempDismissed.detected_at).getTime();
          if (age < WEEK_MS) {
            // Still log the detection silently for admin history.
            await supabase.from("conflict_detections").insert({
              api_key_hash: apiKeyHash,
              conflicting_tool: tool,
              platform,
            });
            return res.status(200).json({
              should_warn: false,
              detection_count: active.length,
              reason: "dismissed_temporary",
            });
          }
        }

        // Log the new detection.
        const { error: iErr } = await supabase.from("conflict_detections").insert({
          api_key_hash: apiKeyHash,
          conflicting_tool: tool,
          platform,
        });
        if (iErr) throw iErr;

        // Throttle: only warn if the most recent detection is more than 24h old
        // (or there are no prior detections).
        const shouldWarn = latestAge >= DAY_MS;

        return res.status(200).json({
          should_warn: shouldWarn,
          detection_count: active.length + 1,
        });
      }

      case "conflict_check": {
        const apiKey = String(req.query.api_key ?? bearerFrom(req)).trim();
        if (!apiKey) return res.status(401).json({ error: "api_key required" });
        const apiKeyHash = sha256hex(apiKey);

        const { data, error } = await supabase
          .from("conflict_detections")
          .select("conflicting_tool,detected_at,dismissed,dismiss_type,resolved")
          .eq("api_key_hash", apiKeyHash)
          .order("detected_at", { ascending: false });
        if (error) throw error;

        const groups = new Map<
          string,
          {
            tool: string;
            last_detected: string;
            count: number;
            dismissed: boolean;
            dismiss_type: string | null;
            resolved: boolean;
          }
        >();

        for (const row of data ?? []) {
          const existing = groups.get(row.conflicting_tool);
          if (existing) {
            existing.count++;
            // dismissed / resolved flags reflect the MOST RECENT entry
            // (array is sorted desc by detected_at)
            continue;
          }
          groups.set(row.conflicting_tool, {
            tool: row.conflicting_tool,
            last_detected: row.detected_at,
            count: 1,
            dismissed: !!row.dismissed,
            dismiss_type: row.dismiss_type ?? null,
            resolved: !!row.resolved,
          });
        }

        const active = Array.from(groups.values()).filter((g) => !g.resolved);
        return res.status(200).json({ conflicts: active });
      }

      case "conflict_dismiss": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKey = bearerFrom(req) || String(req.body?.api_key ?? "").trim();
        if (!apiKey) return res.status(401).json({ error: "api_key required" });
        const tool = String(req.body?.tool ?? "").trim();
        const type = req.body?.type === "permanent" ? "permanent" : "temporary";
        if (!tool) return res.status(400).json({ error: "tool required" });

        const { error } = await supabase
          .from("conflict_detections")
          .update({
            dismissed: true,
            dismissed_at: new Date().toISOString(),
            dismiss_type: type,
          })
          .eq("api_key_hash", sha256hex(apiKey))
          .eq("conflicting_tool", tool)
          .eq("resolved", false);
        if (error) throw error;
        return res.status(200).json({ success: true, dismiss_type: type });
      }

      case "conflict_resolve": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKey = bearerFrom(req) || String(req.body?.api_key ?? "").trim();
        if (!apiKey) return res.status(401).json({ error: "api_key required" });
        const tool = String(req.body?.tool ?? "").trim();
        if (!tool) return res.status(400).json({ error: "tool required" });

        const { error } = await supabase
          .from("conflict_detections")
          .update({
            resolved: true,
            resolved_at: new Date().toISOString(),
          })
          .eq("api_key_hash", sha256hex(apiKey))
          .eq("conflicting_tool", tool);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      case "check_duplicates": {
        const threshold = parseFloat((req.query.threshold as string) ?? "0.6");
        const { data, error } = await supabase
          .from("extracted_facts")
          .select("id,fact")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw error;

        const facts = (data ?? []) as Array<{ id: string; fact: string }>;
        const tokenize = (s: string): Set<string> =>
          new Set(
            s
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, " ")
              .split(/\s+/)
              .filter((w) => w.length > 2),
          );

        const tokens = facts.map((f) => ({ id: f.id, fact: f.fact, tokens: tokenize(f.fact) }));

        const pairs: Array<{
          facts: Array<{ id: string; text: string }>;
          similarity: number;
        }> = [];

        for (let i = 0; i < tokens.length; i++) {
          for (let j = i + 1; j < tokens.length; j++) {
            const a = tokens[i].tokens;
            const b = tokens[j].tokens;
            if (a.size === 0 || b.size === 0) continue;
            let overlap = 0;
            for (const t of a) if (b.has(t)) overlap++;
            const similarity = overlap / Math.max(a.size, b.size);
            if (similarity >= threshold) {
              pairs.push({
                facts: [
                  { id: tokens[i].id, text: tokens[i].fact },
                  { id: tokens[j].id, text: tokens[j].fact },
                ],
                similarity,
              });
            }
          }
        }

        return res.status(200).json({ duplicate_groups: pairs });
      }

      case "health_summary": {
        const apiKey = String(req.query.api_key ?? bearerFrom(req)).trim();
        if (!apiKey) return res.status(401).json({ error: "api_key required" });
        const apiKeyHash = sha256hex(apiKey);

        const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const [factsRes, sessionsRes, bcRes, recentSessionsRes, conflictsRes] = await Promise.all([
          supabase.from("extracted_facts").select("id", { count: "exact", head: true }).eq("status", "active"),
          supabase.from("session_summaries").select("id,created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(10),
          supabase.from("business_context").select("id", { count: "exact", head: true }),
          supabase.from("session_summaries").select("id").gte("created_at", since7d),
          supabase
            .from("conflict_detections")
            .select("conflicting_tool,detected_at,dismissed,resolved")
            .eq("api_key_hash", apiKeyHash)
            .eq("resolved", false)
            .order("detected_at", { ascending: false }),
        ]);

        const factCount = factsRes.count ?? 0;
        const sessionCount = sessionsRes.count ?? 0;
        const identityCount = bcRes.count ?? 0;
        const recentSessions = recentSessionsRes.data ?? [];
        const lastSession = sessionsRes.data?.[0]?.created_at ?? null;

        const conflicts = (conflictsRes.data ?? []) as Array<{
          conflicting_tool: string;
          detected_at: string;
          dismissed: boolean;
        }>;
        const activeConflictTools = Array.from(
          new Set(conflicts.filter((c) => !c.dismissed).map((c) => c.conflicting_tool)),
        );

        // Duplicate count: reuse the similarity check but cap at light sample.
        let duplicateCount = 0;
        try {
          const { data: sample } = await supabase
            .from("extracted_facts")
            .select("id,fact")
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(100);
          const rows = (sample ?? []) as Array<{ id: string; fact: string }>;
          const tok = rows.map((r) =>
            new Set(
              r.fact
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, " ")
                .split(/\s+/)
                .filter((w) => w.length > 2),
            ),
          );
          for (let i = 0; i < tok.length; i++) {
            for (let j = i + 1; j < tok.length; j++) {
              if (tok[i].size === 0 || tok[j].size === 0) continue;
              let overlap = 0;
              for (const t of tok[i]) if (tok[j].has(t)) overlap++;
              const sim = overlap / Math.max(tok[i].size, tok[j].size);
              if (sim >= 0.6) duplicateCount++;
            }
          }
        } catch {
          /* ignore */
        }

        const memoryLoadRate = 1; // Placeholder: we don't track load_memory calls yet.

        let status: "healthy" | "has_conflicts" | "inactive" | "not_configured" = "healthy";
        if (factCount === 0 && sessionCount === 0) status = "not_configured";
        else if (recentSessions.length === 0) status = "inactive";
        else if (activeConflictTools.length > 0) status = "has_conflicts";

        return res.status(200).json({
          fact_count: factCount,
          session_count: sessionCount,
          identity_entries: identityCount,
          active_conflicts: activeConflictTools,
          memory_load_rate: memoryLoadRate,
          duplicate_count: duplicateCount,
          last_session_date: lastSession,
          sessions_last_7d: recentSessions.length,
          status,
        });
      }

      case "remove_device": {
        if (req.method !== "DELETE") return res.status(405).json({ error: "DELETE required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const fp = String(req.query.fingerprint ?? "").trim();
        if (!fp) return res.status(400).json({ error: "fingerprint required" });

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
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const tenant = apiKeyHash;
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
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
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
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
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
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

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

        const topFactsLimit = getClampedLimit(req.query.top_facts_limit, 10, 110);

        // Most accessed facts
        const { data: topFacts } = await supabase
          .from("mc_extracted_facts")
          .select("id, fact, category, access_count, decay_tier")
          .eq("api_key_hash", apiKeyHash)
          .eq("status", "active")
          .order("access_count", { ascending: false })
          .limit(topFactsLimit);
        const annotatedTopFacts = (topFacts ?? []).map(annotateRecallFact);
        const topOfMindFacts = annotatedTopFacts
          .filter((fact) => fact.recall_signal === "top-of-mind")
          .slice(0, 10);
        const backgroundHeavyCount = annotatedTopFacts.filter((fact) => fact.recall_signal === "background-heavy").length;

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
          top_facts_limit: topFactsLimit,
          recall_diagnostics: {
            inspected_top_facts: annotatedTopFacts.length,
            background_heavy_count: backgroundHeavyCount,
          },
          recent_decay: recentDecay ?? [],
          top_of_mind_facts: topOfMindFacts,
          top_facts: annotatedTopFacts,
        });
      }

      case "admin_profile": {
        // Resolve the signed-in user via their Supabase session JWT. Unlike
        // resolveSessionTenant, this does not require an existing api_keys
        // row - we may be creating the first one right now.
        const user = await resolveSessionUser(req, supabaseUrl, supabaseKey);
        if (!user) return res.status(401).json({ error: "Unauthorized" });

        // Look up an existing api_keys row for this user.
        let keyRow = (await supabase
          .from("api_keys")
          .select("id, key_hash, key_prefix, label, tier, is_active, usage_count, last_used_at, created_at")
          .eq("user_id", user.id)
          .maybeSingle()).data as
          | {
              id: string;
              key_hash: string | null;
              key_prefix: string | null;
              label: string | null;
              tier: string | null;
              is_active: boolean | null;
              usage_count: number | null;
              last_used_at: string | null;
              created_at: string;
            }
          | null;

        // Auto-provision on first access. The signed-in email proves
        // ownership (Supabase verified it via magic-link / OAuth), so
        // we mint a uc_* key and link it to user.id the first time
        // /admin/you loads. The raw key is returned exactly once, under
        // `generated_api_key`, so the frontend can surface it behind
        // the reveal UI. Subsequent calls only return the prefix.
        let generatedApiKey: string | null = null;
        const provisionTier = effectiveMemoryTier("free", user.email);
        if (!keyRow) {
          const rawKey = `uc_${crypto.randomBytes(16).toString("hex")}`;
          const keyHash = sha256hex(rawKey);
          const keyPrefix = rawKey.slice(0, 8);
          const insertRes = await supabase
            .from("api_keys")
            .insert({
              user_id:   user.id,
              key_hash:  keyHash,
              key_prefix: keyPrefix,
              label:     "auto-provisioned",
              tier:      provisionTier,
              is_active: true,
              usage_count: 0,
            })
            .select("id, key_hash, key_prefix, label, tier, is_active, usage_count, last_used_at, created_at")
            .maybeSingle();

          if (insertRes.error) {
            // If a concurrent request created the row (unique conflict on
            // user_id), re-read instead of failing.
            const retry = await supabase
              .from("api_keys")
              .select("id, key_hash, key_prefix, label, tier, is_active, usage_count, last_used_at, created_at")
              .eq("user_id", user.id)
              .maybeSingle();
            keyRow = retry.data as typeof keyRow;
          } else {
            keyRow = insertRes.data as typeof keyRow;
            generatedApiKey = rawKey;
          }
        }

        const apiKey = keyRow
          ? {
              id: keyRow.id,
              prefix: keyRow.key_prefix ?? "",
              label:  keyRow.label ?? "",
              tier:   effectiveMemoryTier(keyRow.tier ?? "free", user.email),
              is_active: Boolean(keyRow.is_active),
              usage_count: Number(keyRow.usage_count ?? 0),
              last_used_at: keyRow.last_used_at ?? null,
              created_at: keyRow.created_at,
            }
          : null;

        // Derive is_admin from the ADMIN_EMAILS env var. Comma-separated
        // list, case-insensitive trim-equal. Fixes the 401 console noise
        // on /admin/memory for non-admin signers by giving the frontend
        // a clean role flag to gate admin-only surfaces behind.
        const adminEmailsRaw = process.env.ADMIN_EMAILS ?? "";
        const adminEmails = adminEmailsRaw
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        const isAdmin = user.email
          ? adminEmails.includes(user.email.toLowerCase())
          : false;
        const operatorTime = keyRow?.key_hash
          ? await readOperatorTimeContext(supabase, keyRow.key_hash)
          : null;

        return res.status(200).json({
          user_id: user.id,
          email:   user.email,
          tier:    apiKey ? apiKey.tier : effectiveMemoryTier("free", user.email),
          needs_key: !apiKey,
          api_key: apiKey,
          generated_api_key: generatedApiKey,
          is_admin: isAdmin,
          memory_quota_exempt: isMemoryQuotaExemptEmail(user.email),
          operator_time: operatorTime,
        });
      }

      case "operator_timezone_update": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const user = await resolveSessionUser(req, supabaseUrl, supabaseKey);
        if (!user) return res.status(401).json({ error: "Unauthorized" });

        const keyRow = (await supabase
          .from("api_keys")
          .select("key_hash")
          .eq("user_id", user.id)
          .maybeSingle()).data as { key_hash: string | null } | null;
        if (!keyRow?.key_hash) {
          return res.status(404).json({ error: "No active UnClick key found for this user" });
        }

        const timezone = String(req.body?.timezone ?? "").trim();
        if (!isValidTimeZoneName(timezone)) {
          return res.status(400).json({ error: "timezone must be a valid IANA timezone" });
        }
        const source: OperatorTimeSource = req.body?.source === "manual" ? "manual" : "browser";
        const nowIso = new Date().toISOString();
        const existing = await readOperatorTimeContext(supabase, keyRow.key_hash);
        if (existing?.source === "manual" && source === "browser") {
          return res.status(200).json({ success: true, operator_time: existing, manual_override_preserved: true });
        }

        const value: OperatorTimeContextValue = {
          timezone,
          source,
          detected_at: source === "browser" ? nowIso : existing?.detected_at ?? null,
          manual_override_at: source === "manual" ? nowIso : existing?.manual_override_at ?? null,
          updated_at: nowIso,
          privacy: "timezone-only",
        };

        const { error } = await supabase
          .from("mc_business_context")
          .upsert(
            {
              api_key_hash: keyRow.key_hash,
              category: OPERATOR_TIME_CATEGORY,
              key: OPERATOR_TIME_KEY,
              value,
              priority: 98,
              decay_tier: "hot",
              updated_at: nowIso,
              last_accessed: nowIso,
            },
            { onConflict: "api_key_hash,category,key" },
          );
        if (error) throw error;
        return res.status(200).json({ success: true, operator_time: value });
      }

      case "generate_api_key": {
        // Explicit on-demand provisioning. Idempotent: if the signed-in
        // user already has an api_keys row, return the existing prefix
        // without regenerating. If not, mint a uc_* key and link to the
        // user. Returns the raw key exactly once on creation.
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const user = await resolveSessionUser(req, supabaseUrl, supabaseKey);
        if (!user) return res.status(401).json({ error: "Unauthorized" });

        const existing = (await supabase
          .from("api_keys")
          .select("id, key_prefix, tier")
          .eq("user_id", user.id)
          .maybeSingle()).data as { id: string; key_prefix: string | null; tier: string | null } | null;

        if (existing) {
          return res.status(200).json({
            api_key: null,
            prefix:  existing.key_prefix ?? "",
            tier:    effectiveMemoryTier(existing.tier ?? "free", user.email),
            already_provisioned: true,
          });
        }

        const rawKey = `uc_${crypto.randomBytes(16).toString("hex")}`;
        const { error } = await supabase.from("api_keys").insert({
          user_id:   user.id,
          key_hash:  sha256hex(rawKey),
          key_prefix: rawKey.slice(0, 8),
          label:     "default",
          tier:      effectiveMemoryTier("free", user.email),
          is_active: true,
          usage_count: 0,
        });
        if (error) return res.status(500).json({ error: error.message });

        return res.status(200).json({
          api_key: rawKey,
          prefix:  rawKey.slice(0, 8),
          tier:    effectiveMemoryTier("free", user.email),
          already_provisioned: false,
        });
      }

      case "reset_api_key": {
        // Re-issue a new uc_* key for the signed-in user. Invalidates
        // the old key immediately (hash replaced). BackstagePass
        // encrypted credentials become unreadable until re-saved.
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const user = await resolveSessionUser(req, supabaseUrl, supabaseKey);
        if (!user) return res.status(401).json({ error: "Unauthorized" });

        const existing = (await supabase
          .from("api_keys")
          .select("id, tier")
          .eq("user_id", user.id)
          .maybeSingle()).data as { id: string; tier: string | null } | null;

        if (!existing) return res.status(404).json({ error: "No API key to reset" });

        // SECURITY: audit log BEFORE key rotation; abort if insert fails. audit PR #128
        const existingKeyHash = (await supabase
          .from("api_keys")
          .select("key_hash")
          .eq("id", existing.id)
          .maybeSingle()).data?.key_hash as string | null;
        const { error: auditErr } = await supabase.from("mc_admin_audit").insert({
          api_key_hash: existingKeyHash ?? "unknown",
          action: "reset_api_key",
          payload: { key_id: existing.id, tier: existing.tier },
        });
        if (auditErr) {
          console.error("reset_api_key: audit insert failed, aborting:", auditErr.message);
          return res.status(500).json({ error: "Audit log failed; reset aborted for safety." });
        }

        const rawKey = `uc_${crypto.randomBytes(16).toString("hex")}`;
        const { error: updateError } = await supabase
          .from("api_keys")
          .update({
            key_hash:    sha256hex(rawKey),
            key_prefix:  rawKey.slice(0, 8),
            usage_count: 0,
          })
          .eq("id", existing.id);
        if (updateError) return res.status(500).json({ error: updateError.message });

        return res.status(200).json({
          api_key: rawKey,
          prefix:  rawKey.slice(0, 8),
          tier:    effectiveMemoryTier(existing.tier ?? "free", user.email),
        });
      }

      case "delete_account": {
        // Self-serve account deletion. The signed-in user is the ONLY
        // user that can trigger this - no admin-impersonation path,
        // no body/query param targeting another user.
        //
        // Order of operations:
        //   1. Resolve user + api_key_hash (idempotency: return 200 if
        //      already deleted).
        //   2. Write to account_deletions_audit BEFORE any destructive
        //      step so partial failures leave a trail.
        //   3. Delete all api_key_hash-scoped rows in dependency order
        //      (children before parents). Collect per-table row counts
        //      and errors rather than silently swallowing.
        //   4. Call auth.admin.deleteUser() to remove the auth.users row
        //      and cascade to FK-linked tables (ON DELETE CASCADE).
        //   5. Clean up the now-orphaned api_keys row (user_id FK is
        //      ON DELETE SET NULL so it survives step 4).
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const user = await resolveSessionUser(req, supabaseUrl, supabaseKey);
        if (!user) return res.status(401).json({ error: "Unauthorized" });

        const keyRow = (await supabase
          .from("api_keys")
          .select("key_hash")
          .eq("user_id", user.id)
          .maybeSingle()).data as { key_hash?: string | null } | null;
        const apiKeyHash = keyRow?.key_hash ?? null;

        // Idempotency: if a previous deletion removed the api_keys link
        // already, return a benign response without re-attempting.
        if (!keyRow && !apiKeyHash) {
          const { error: idempotentAuthErr } = await supabase.auth.admin.deleteUser(user.id);
          if (idempotentAuthErr && idempotentAuthErr.message?.toLowerCase().includes("not found")) {
            return res.status(200).json({ success: true, already_deleted: true });
          }
        }

        // Pre-deletion audit record (captured before any delete fires).
        try {
          await supabase.from("account_deletions_audit").insert({
            api_key_hash:  apiKeyHash,
            email:         user.email,
            reason:        "user_self_delete",
            tables_affected: [],
            rows_deleted:  {},
          });
        } catch { /* audit failure must not block deletion */ }

        // Also write to backstagepass_audit for backward compatibility.
        try {
          await supabase.from("backstagepass_audit").insert({
            api_key_hash: apiKeyHash,
            action:       "delete_account",
            success:      true,
            ip:           clientIp(req),
            user_agent:   clientUa(req),
            metadata:     { user_id: user.id, email: user.email },
          });
        } catch { /* swallow */ }

        // Per-step tracking. Errors are collected, not thrown, so we
        // always reach auth.admin.deleteUser regardless of table errors.
        const rowsDeleted: Record<string, number> = {};
        const stepErrors: Record<string, string>  = {};

        async function delByHash(table: string, col = "api_key_hash") {
          if (!apiKeyHash) return;
          try {
            const { count, error } = await supabase
              .from(table)
              .delete({ count: "exact" })
              .eq(col, apiKeyHash);
            rowsDeleted[table] = count ?? 0;
            if (error) stepErrors[table] = error.message;
          } catch (e) {
            stepErrors[table] = String(e);
            rowsDeleted[table] = 0;
          }
        }

        if (apiKeyHash) {
          // Delete children before parents to respect FK order.
          // mc_run_messages -> mc_crew_runs -> mc_crews
          await delByHash("mc_run_messages");
          await delByHash("mc_crew_runs");
          await delByHash("mc_crews");
          // mc_facts_audit cascades from mc_extracted_facts (ON DELETE CASCADE),
          // but delete explicitly for clear row accounting.
          await delByHash("mc_facts_audit");
          await delByHash("mc_extracted_facts");
          await delByHash("mc_session_summaries");
          await delByHash("mc_conversation_log");
          await delByHash("mc_code_dumps");
          await delByHash("mc_business_context");
          await delByHash("mc_knowledge_library");
          await delByHash("mc_knowledge_library_history");
          await delByHash("mc_canonical_docs");
          // User-specific agents only (is_system = false). System agents are
          // shared across tenants and must not be deleted here.
          try {
            const { count, error } = await supabase
              .from("mc_agents")
              .delete({ count: "exact" })
              .eq("api_key_hash", apiKeyHash)
              .eq("is_system", false);
            rowsDeleted["mc_agents"] = count ?? 0;
            if (error) stepErrors["mc_agents"] = error.message;
          } catch (e) {
            stepErrors["mc_agents"] = String(e);
            rowsDeleted["mc_agents"] = 0;
          }
          // Config / credential layer.
          await delByHash("memory_configs");
          await delByHash("memory_devices");
          await delByHash("tenant_settings");
          await delByHash("tool_detections");
          await delByHash("tool_usage_events");
          await delByHash("user_credentials");
          await delByHash("platform_credentials");
          await delByHash("agent_trace");
          // metering_events uses "key_hash", not "api_key_hash".
          await delByHash("metering_events", "key_hash");
        }

        // Remove the auth.users row. auth.admin.deleteUser requires the
        // service_role key (SUPABASE_SERVICE_ROLE_KEY must be set).
        const { error: authErr } = await supabase.auth.admin.deleteUser(user.id);
        if (authErr) {
          return res.status(500).json({
            error:        `auth.users delete failed: ${authErr.message}`,
            step:         "auth_user",
            step_errors:  stepErrors,
            rows_deleted: rowsDeleted,
          });
        }

        // api_keys.user_id has ON DELETE SET NULL so the row survives
        // auth deletion. Clean it up now that the cascade is done.
        if (apiKeyHash) {
          try {
            await supabase.from("api_keys").delete().eq("key_hash", apiKeyHash);
          } catch { /* best effort */ }
        }

        const hasPartialErrors = Object.keys(stepErrors).length > 0;
        return res.status(200).json({
          success:      true,
          rows_deleted: rowsDeleted,
          ...(hasPartialErrors && { partial: true, step_errors: stepErrors }),
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

        // SECURITY: platform_connectors is a global connector catalog with no per-tenant rows.
        // anon_read_connectors RLS allows public read by design. audit PR #128
        const { data: connectors } = await supabase
          .from("platform_connectors")
          .select("*");

        // SECURITY: tenant scope required, audit PR #128
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

        const body = req.body ?? {};
        const fId = body.fact_id;
        if (!fId) return res.status(400).json({ error: "fact_id required" });

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (typeof body.fact === "string" && body.fact.trim().length > 0) {
          updates.fact = body.fact.trim();
        }
        if (typeof body.category === "string" && body.category.trim().length > 0) {
          updates.category = body.category.trim();
        }
        if (body.confidence !== undefined) {
          const c = Number(body.confidence);
          if (!Number.isFinite(c) || c < 0 || c > 1) {
            return res.status(400).json({ error: "confidence must be a number between 0 and 1" });
          }
          updates.confidence = c;
        }
        if (Object.keys(updates).length === 1) {
          return res.status(400).json({ error: "no fields to update" });
        }

        const { error } = await supabase
          .from("mc_extracted_facts")
          .update(updates)
          .eq("id", fId)
          .eq("api_key_hash", tenant.apiKeyHash);

        if (error) throw error;
        if (typeof updates.fact === "string") {
          queueMemoryEmbedding(req, "mc_extracted_facts", String(fId), updates.fact);
        }
        return res.status(200).json({ success: true });
      }

      // ── Tool awareness ───────────────────────────────────────────────
      case "tool_detect": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

        const body = req.body as {
          detections?: Array<{
            tool_name?: string;
            tool_category?: string;
            classification?: string;
          }>;
        };
        const incoming = Array.isArray(body?.detections) ? body!.detections! : [];
        if (incoming.length === 0) {
          return res.status(200).json({ success: true, nudgeable: [] });
        }

        const valid = incoming
          .map((d) => ({
            tool_name: String(d.tool_name ?? "").trim(),
            tool_category: String(d.tool_category ?? "").trim(),
            classification: String(d.classification ?? "").trim(),
          }))
          .filter(
            (d) =>
              d.tool_name &&
              d.tool_category &&
              ["replaceable", "conflicting", "compatible"].includes(d.classification)
          );

        const nowIso = new Date().toISOString();
        const toolNames = valid.map((d) => d.tool_name);

        // Load existing rows once so we can respect last_nudged_at + nudge_dismissed
        const { data: existing } = await supabase
          .from("tool_detections")
          .select("tool_name,last_nudged_at,nudge_dismissed,classification")
          .eq("api_key_hash", apiKeyHash)
          .in("tool_name", toolNames);

        const existingMap = new Map<
          string,
          { last_nudged_at: string | null; nudge_dismissed: boolean; classification: string }
        >();
        for (const row of (existing ?? []) as Array<{
          tool_name: string;
          last_nudged_at: string | null;
          nudge_dismissed: boolean;
          classification: string;
        }>) {
          existingMap.set(row.tool_name, {
            last_nudged_at: row.last_nudged_at,
            nudge_dismissed: row.nudge_dismissed,
            classification: row.classification,
          });
        }

        // Upsert each detection (update last_detected_at, keep first_detected_at)
        const rows = valid.map((d) => ({
          api_key_hash: apiKeyHash,
          tool_name: d.tool_name,
          tool_category: d.tool_category,
          classification: d.classification,
          last_detected_at: nowIso,
        }));

        const { error: upErr } = await supabase
          .from("tool_detections")
          .upsert(rows, { onConflict: "api_key_hash,tool_name" });
        if (upErr) throw upErr;

        // Determine which tools are nudge-eligible (not dismissed, not nudged in 7d)
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
        const nudgeable: string[] = [];
        const toMarkNudged: string[] = [];
        for (const d of valid) {
          if (d.classification === "compatible") continue;
          const existingRow = existingMap.get(d.tool_name);
          if (existingRow?.nudge_dismissed) continue;
          const lastNudged = existingRow?.last_nudged_at
            ? new Date(existingRow.last_nudged_at).getTime()
            : 0;
          const sinceLast = Date.now() - lastNudged;
          if (!lastNudged || sinceLast > SEVEN_DAYS_MS) {
            nudgeable.push(d.tool_name);
            toMarkNudged.push(d.tool_name);
          }
        }

        // Stamp last_nudged_at so we don't re-nudge within 7 days.
        if (toMarkNudged.length > 0) {
          await supabase
            .from("tool_detections")
            .update({ last_nudged_at: nowIso })
            .eq("api_key_hash", apiKeyHash)
            .in("tool_name", toMarkNudged);
        }

        return res.status(200).json({ success: true, nudgeable });
      }

      case "admin_tool_scan": {
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const { data, error } = await supabase
          .from("tool_detections")
          .select("tool_name,tool_category,classification,last_detected_at,first_detected_at,nudge_dismissed,last_nudged_at")
          .eq("api_key_hash", apiKeyHash)
          .order("last_detected_at", { ascending: false });
        if (error) throw error;

        const rows = (data ?? []) as Array<{
          tool_name: string;
          tool_category: string;
          classification: "replaceable" | "conflicting" | "compatible";
          last_detected_at: string;
          first_detected_at: string;
          nudge_dismissed: boolean;
          last_nudged_at: string | null;
        }>;

        const replaceable = rows.filter((r) => r.classification === "replaceable");
        const conflicting = rows.filter((r) => r.classification === "conflicting");
        const compatible = rows.filter((r) => r.classification === "compatible");

        return res.status(200).json({
          replaceable,
          conflicting,
          compatible,
          summary: {
            replaceable: replaceable.length,
            conflicting: conflicting.length,
            compatible: compatible.length,
          },
        });
      }

      case "dismiss_tool_nudge": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const body = req.body as { tool_name?: string; dismissed?: boolean };
        const toolName = String(body?.tool_name ?? "").trim();
        if (!toolName) return res.status(400).json({ error: "tool_name required" });
        const dismissed = body?.dismissed !== false; // default true
        const { error } = await supabase
          .from("tool_detections")
          .update({ nudge_dismissed: dismissed })
          .eq("api_key_hash", apiKeyHash)
          .eq("tool_name", toolName);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      case "admin_fact_add": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

        const body = req.body ?? {};
        const fact = typeof body.fact === "string" ? body.fact.trim() : "";
        if (!fact) return res.status(400).json({ error: "fact required" });
        const category = typeof body.category === "string" && body.category.trim().length > 0
          ? body.category.trim()
          : "general";
        let confidence = 1.0;
        if (body.confidence !== undefined) {
          const c = Number(body.confidence);
          if (!Number.isFinite(c) || c < 0 || c > 1) {
            return res.status(400).json({ error: "confidence must be a number between 0 and 1" });
          }
          confidence = c;
        }

        const { data, error } = await supabase
          .from("mc_extracted_facts")
          .insert({
            api_key_hash: apiKeyHash,
            fact,
            category,
            confidence,
            source_type: "manual",
            status: "active",
            decay_tier: "hot",
          })
          .select("id, fact, category, confidence, status, decay_tier, created_at")
          .single();

        if (error) throw error;
        queueMemoryEmbedding(req, "mc_extracted_facts", data.id, fact);
        return res.status(200).json({ success: true, data });
      }

      case "admin_context_apply_template": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

        const template = String(req.body?.template ?? "").trim().toLowerCase();
        const templates: Record<string, Array<{ category: string; key: string; value: string }>> = {
          freelancer: [
            { category: "identity", key: "role", value: "Independent freelancer" },
            { category: "preference", key: "working_hours", value: "Weekdays, deep work 9am-1pm" },
            { category: "preference", key: "communication", value: "Short, direct, no filler" },
            { category: "workflow", key: "delivery_cadence", value: "Weekly demo, daily short updates" },
            { category: "standing_rule", key: "estimates", value: "Always quote a range, never a single number" },
          ],
          developer: [
            { category: "identity", key: "role", value: "Software engineer" },
            { category: "preference", key: "preferred_stack", value: "TypeScript, React, Node, Postgres" },
            { category: "preference", key: "code_style", value: "Prefer small pure functions, avoid unnecessary abstractions" },
            { category: "standing_rule", key: "testing", value: "Write a failing test first for any non-trivial change" },
            { category: "workflow", key: "pr_review", value: "Explain the why in PR descriptions, not the what" },
          ],
          founder: [
            { category: "identity", key: "role", value: "Founder / CEO" },
            { category: "preference", key: "communication", value: "High signal, decisions over discussion" },
            { category: "workflow", key: "weekly_rhythm", value: "Mondays plan, Fridays review, ship often" },
            { category: "standing_rule", key: "focus", value: "Default no to anything that is not the top priority this week" },
            { category: "technical", key: "reporting", value: "Numbers first, narrative second" },
          ],
          creator: [
            { category: "identity", key: "role", value: "Content creator" },
            { category: "preference", key: "platforms", value: "Primary: YouTube. Secondary: X, LinkedIn." },
            { category: "preference", key: "voice", value: "Friendly, concrete, no hype" },
            { category: "workflow", key: "publishing", value: "Two long-form per week, daily short-form" },
            { category: "standing_rule", key: "hooks", value: "Always lead with the payoff, not the setup" },
          ],
        };

        const entries = templates[template];
        if (!entries) {
          return res.status(400).json({
            error: "Unknown template. Use one of: freelancer, developer, founder, creator.",
          });
        }

        const { data: existing } = await supabase
          .from("mc_business_context")
          .select("category, key, priority")
          .eq("api_key_hash", apiKeyHash);
        const seenKeys = new Set((existing ?? []).map((r) => `${r.category}/${r.key}`));
        let maxPriority = 0;
        for (const row of existing ?? []) {
          if ((row.priority ?? 0) > maxPriority) maxPriority = row.priority ?? 0;
        }

        const toInsert = entries
          .filter((e) => !seenKeys.has(`${e.category}/${e.key}`))
          .map((e, i) => ({
            api_key_hash: apiKeyHash,
            category: e.category,
            key: e.key,
            value: e.value,
            priority: maxPriority + i + 1,
            decay_tier: "hot",
            updated_at: new Date().toISOString(),
            last_accessed: new Date().toISOString(),
          }));

        if (toInsert.length === 0) {
          return res.status(200).json({ success: true, inserted: 0, skipped: entries.length });
        }

        const { error } = await supabase.from("mc_business_context").insert(toInsert);
        if (error) throw error;
        return res.status(200).json({
          success: true,
          inserted: toInsert.length,
          skipped: entries.length - toInsert.length,
        });
      }

      case "admin_session_preview": {
        // Dry-run of get_startup_context so the admin UI can show users what
        // their AI actually sees at the start of every session.
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

        const [ctxRes, factsRes, sessionsRes] = await Promise.all([
          supabase
            .from("mc_business_context")
            .select("category, key, value, priority")
            .eq("api_key_hash", apiKeyHash)
            .order("priority", { ascending: true }),
          supabase
            .from("mc_extracted_facts")
            .select("id, fact, category, confidence, decay_tier, created_at")
            .eq("api_key_hash", apiKeyHash)
            .eq("status", "active")
            .eq("decay_tier", "hot")
            .order("confidence", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("mc_session_summaries")
            .select("id, summary, topics, created_at, platform")
            .eq("api_key_hash", apiKeyHash)
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

        return res.status(200).json({
          identity: ctxRes.data ?? [],
          hot_facts: factsRes.data ?? [],
          recent_sessions: sessionsRes.data ?? [],
        });
      }

      case "admin_clear_all": {
        // Nuclear option: delete every memory row scoped to this api_key_hash.
        // Guard with a body.confirm === "DELETE" phrase so a typo or a
        // mis-fired fetch cannot wipe a user's data.
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

        const confirm = String(req.body?.confirm ?? "").trim();
        if (confirm !== "DELETE") {
          return res.status(400).json({
            error: "To confirm, send body.confirm = \"DELETE\".",
          });
        }

        const tables = [
          "mc_extracted_facts",
          "mc_business_context",
          "mc_session_summaries",
          "mc_conversation_log",
          "mc_code_dumps",
          "mc_knowledge_library",
          "mc_knowledge_library_history",
        ];

        // SECURITY: audit log BEFORE destructive op; abort if insert fails. audit PR #128
        const { error: auditErr } = await supabase.from("mc_admin_audit").insert({
          api_key_hash: apiKeyHash,
          action: "admin_clear_all",
          payload: { tables_affected: tables },
        });
        if (auditErr) {
          console.error("admin_clear_all: audit insert failed, aborting:", auditErr.message);
          return res.status(500).json({ error: "Audit log failed; delete aborted for safety." });
        }

        const deleted: Record<string, number | null> = {};
        for (const t of tables) {
          const { count, error } = await supabase
            .from(t)
            .delete({ count: "exact" })
            .eq("api_key_hash", apiKeyHash);
          if (error) {
            console.error(`admin_clear_all: failed on ${t}:`, error.message);
          }
          deleted[t] = count ?? 0;
        }

        return res.status(200).json({ success: true, deleted });
      }

      case "admin_export_all": {
        // Full portable snapshot of the user's memory. Users can download this
        // and move to another memory backend if they ever want to leave.
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

        const [ctx, facts, sessions, library] = await Promise.all([
          supabase
            .from("mc_business_context")
            .select("category, key, value, priority, decay_tier, created_at, updated_at")
            .eq("api_key_hash", apiKeyHash)
            .order("priority", { ascending: true }),
          supabase
            .from("mc_extracted_facts")
            .select("fact, category, confidence, status, decay_tier, source_type, created_at, updated_at")
            .eq("api_key_hash", apiKeyHash)
            .order("created_at", { ascending: false }),
          supabase
            .from("mc_session_summaries")
            .select("session_id, summary, topics, decisions, open_loops, platform, duration_minutes, created_at")
            .eq("api_key_hash", apiKeyHash)
            .order("created_at", { ascending: false }),
          supabase
            .from("mc_knowledge_library")
            .select("slug, title, category, tags, content, version, updated_at")
            .eq("api_key_hash", apiKeyHash)
            .order("updated_at", { ascending: false }),
        ]);

        const payload = {
          exported_at: new Date().toISOString(),
          schema_version: 1,
          business_context: ctx.data ?? [],
          extracted_facts: facts.data ?? [],
          session_summaries: sessions.data ?? [],
          knowledge_library: library.data ?? [],
        };

        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="unclick-memory-${new Date().toISOString().slice(0, 10)}.json"`
        );
        return res.status(200).send(JSON.stringify(payload, null, 2));
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
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
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
              idempotency_key,
            } = req.body ?? {};
            if (!title) return res.status(400).json({ error: "title required" });
            const parsedIdempotencyKey = parseBuildDeskIdempotencyKey(
              idempotency_key ?? (isRecord(plan_json) ? plan_json.idempotency_key : undefined),
            );
            if (parsedIdempotencyKey.error) {
              return res.status(400).json({ error: parsedIdempotencyKey.error });
            }

            if (parsedIdempotencyKey.value) {
              const { data: existingTasks, error: existingErr } = await supabase
                .from("build_tasks")
                .select("*")
                .eq("api_key_hash", apiKeyHash)
                .order("created_at", { ascending: false })
                .limit(50);
              if (existingErr) throw existingErr;
              const existing = findBuildDeskRowByIdempotencyKey(
                existingTasks ?? [],
                "plan_json",
                parsedIdempotencyKey.value,
              );
              if (existing) return res.status(200).json({ data: existing, was_duplicate: true });
            }

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
                plan_json: attachBuildDeskIdempotencyKey(plan_json, parsedIdempotencyKey.value),
                acceptance_criteria_json: acceptance_criteria_json ?? null,
                assigned_worker_id: assigned_worker_id ?? null,
                parent_task_id: parent_task_id ?? null,
              })
              .select()
              .single();
            if (error) throw error;
            return res.status(200).json({ data, was_duplicate: false });
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
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
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
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const { task_id, worker_id, payload_json } = req.body ?? {};
        if (!task_id || !worker_id) {
          return res.status(400).json({ error: "task_id and worker_id required" });
        }
        const parsedIdempotencyKey = parseBuildDeskIdempotencyKey(
          req.body?.idempotency_key ?? (isRecord(payload_json) ? payload_json.idempotency_key : undefined),
        );
        if (parsedIdempotencyKey.error) {
          return res.status(400).json({ error: parsedIdempotencyKey.error });
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

        if (parsedIdempotencyKey.value) {
          const { data: existingEvents, error: existingErr } = await supabase
            .from("build_dispatch_events")
            .select()
            .eq("api_key_hash", apiKeyHash)
            .eq("task_id", task_id)
            .eq("worker_id", worker_id)
            .eq("event_type", "dispatched")
            .order("created_at", { ascending: false })
            .limit(50);
          if (existingErr) throw existingErr;
          const existingEvent = findBuildDeskRowByIdempotencyKey(
            existingEvents ?? [],
            "payload_json",
            parsedIdempotencyKey.value,
          );
          if (existingEvent) {
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
            return res.status(200).json({ data: existingEvent, was_duplicate: true });
          }
        }

        const { data: eventData, error: eventErr } = await supabase
          .from("build_dispatch_events")
          .insert({
            api_key_hash: apiKeyHash,
            task_id,
            worker_id,
            event_type: "dispatched",
            payload_json: attachBuildDeskIdempotencyKey(payload_json, parsedIdempotencyKey.value),
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

        return res.status(200).json({ data: eventData, was_duplicate: false });
      }

      case "admin_unclick_connect_dry_run": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

        const body = (req.body ?? {}) as Record<string, unknown>;
        const intent = isRecord(body.intent) ? body.intent : body;
        const packet = buildTetherRoutePacket(intent);
        const workerResolution = await resolveUnClickConnectVisibleWorkers(supabase, apiKeyHash, body);
        const result = runRoutePacketConsumerDryRun({
          packet,
          visibleWorkers: workerResolution.visibleWorkers,
        });

        return res.status(200).json({
          ...result,
          tenant_scoped: true,
          worker_source: workerResolution.workerSource,
          discovery: workerResolution.discovery,
        });
      }

      case "admin_unclick_connect_commit": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

        const body = (req.body ?? {}) as Record<string, unknown>;
        const commitMode = String(body.commit_mode ?? body.mode ?? "").trim().toLowerCase();
        const intent = isRecord(body.intent) ? body.intent : body;
        const packet = buildTetherRoutePacket(intent);
        if (commitMode !== "experiment" || !packet.experiment) {
          return res.status(400).json({
            error: "admin_unclick_connect_commit is experiment-only",
          });
        }

        const workerResolution = await resolveUnClickConnectVisibleWorkers(supabase, apiKeyHash, body);
        const idempotencyKey =
          typeof body.idempotency_key === "string" && body.idempotency_key.trim()
            ? body.idempotency_key.trim()
            : packet.idempotency_key;
        const row = buildUnClickConnectDispatchRow({
          apiKeyHash,
          packet,
          visibleWorkers: workerResolution.visibleWorkers,
          idempotencyKey,
        });

        const { data, error } = await supabase
          .from("mc_agent_dispatches")
          .insert(row)
          .select(
            "id, api_key_hash, dispatch_id, source, target_agent_id, task_ref, status, lease_owner, lease_expires_at, last_real_action_at, payload, created_at, updated_at",
          )
          .single();

        if (error) {
          if ((error as { code?: string }).code === "23505") {
            const existing = await supabase
              .from("mc_agent_dispatches")
              .select(
                "id, api_key_hash, dispatch_id, source, target_agent_id, task_ref, status, lease_owner, lease_expires_at, last_real_action_at, payload, created_at, updated_at",
              )
              .eq("api_key_hash", apiKeyHash)
              .eq("dispatch_id", row.dispatch_id)
              .maybeSingle();
            if (existing.error) throw existing.error;
            return res.status(200).json({
              data: existing.data,
              was_duplicate: true,
              tenant_scoped: true,
              worker_source: workerResolution.workerSource,
              discovery: workerResolution.discovery,
            });
          }
          throw error;
        }

        return res.status(200).json({
          data,
          was_duplicate: false,
          tenant_scoped: true,
          worker_source: workerResolution.workerSource,
          discovery: workerResolution.discovery,
        });
      }

      case "reliability_dispatches": {
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const method = String(req.query.method ?? req.body?.method ?? "list").trim().toLowerCase();

        switch (method) {
          case "list": {
            const limit = getClampedLimit(req.query.limit ?? req.body?.limit, 50, 200);
            const status = String(req.query.status ?? req.body?.status ?? "").trim();
            const source = String(req.query.source ?? req.body?.source ?? "").trim();
            const includeMetrics = shouldIncludeThroughputMetrics(
              req.query.include_metrics ?? req.body?.include_metrics,
            );
            const targetAgentIdFilter = parseOptionalFilterToken(
              req.query.target_agent_id ?? req.body?.target_agent_id,
              "target_agent_id",
              128,
            );
            if (targetAgentIdFilter.error) {
              return res.status(400).json({ error: targetAgentIdFilter.error });
            }
            const leaseOwnerFilter = parseOptionalFilterToken(
              req.query.lease_owner ?? req.body?.lease_owner,
              "lease_owner",
              128,
            );
            if (leaseOwnerFilter.error) {
              return res.status(400).json({ error: leaseOwnerFilter.error });
            }

            let query = supabase
              .from("mc_agent_dispatches")
              .select(
                "id, api_key_hash, dispatch_id, source, target_agent_id, task_ref, status, lease_owner, lease_expires_at, last_real_action_at, payload, created_at, updated_at",
              )
              .eq("api_key_hash", apiKeyHash)
              .order("created_at", { ascending: false })
              .limit(limit);

            if (status) query = query.eq("status", status);
            if (source) query = query.eq("source", source);
            if (targetAgentIdFilter.value) {
              query = query.eq("target_agent_id", targetAgentIdFilter.value);
            }
            if (leaseOwnerFilter.value) query = query.eq("lease_owner", leaseOwnerFilter.value);

            const { data, error } = await query;
            if (error) throw error;
            const dispatchRows = (data ?? []) as ReliabilityDispatchRow[];
            return res.status(200).json({
              dispatches: includeMetrics
                ? dispatchRows.map((row) => decorateThroughputDispatch(row))
                : dispatchRows,
              ...(includeMetrics
                ? { throughput: createDispatchThroughputMetrics(dispatchRows) }
                : {}),
            });
          }

          case "get": {
            const dispatchIdResult = parseRequiredToken(
              req.query.dispatch_id ?? req.body?.dispatch_id,
              "dispatch_id",
              256,
            );
            if (dispatchIdResult.error) {
              return res.status(400).json({ error: dispatchIdResult.error });
            }
            const dispatchId = dispatchIdResult.value!;

            const { data, error } = await supabase
              .from("mc_agent_dispatches")
              .select(
                "id, api_key_hash, dispatch_id, source, target_agent_id, task_ref, status, lease_owner, lease_expires_at, last_real_action_at, payload, created_at, updated_at",
              )
              .eq("api_key_hash", apiKeyHash)
              .eq("dispatch_id", dispatchId)
              .maybeSingle();
            if (error) throw error;
            if (!data) return res.status(404).json({ error: "dispatch not found" });
            return res.status(200).json({ data });
          }

          case "upsert": {
            if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
            const body = (req.body ?? {}) as Record<string, unknown>;
            const source = body.source;
            const targetAgentIdResult = parseRequiredToken(
              body.target_agent_id,
              "target_agent_id",
              128,
            );
            if (!isReliabilitySource(source)) {
              return res.status(400).json({ error: "valid source required" });
            }
            if (targetAgentIdResult.error) {
              return res.status(400).json({ error: targetAgentIdResult.error });
            }
            const targetAgentId = targetAgentIdResult.value!;

            const taskRef = String(body.task_ref ?? "").trim() || undefined;
            const promptHash = String(body.prompt_hash ?? "").trim() || undefined;
            const bucketSeconds = getClampedLimit(body.time_bucket_seconds, 60, 3600);
            const timeBucket =
              String(body.time_bucket ?? "").trim() ||
              createTimeBucket(new Date(), bucketSeconds);
            const payload =
              isRecord(body.payload) ? body.payload : isRecord(body.payload_json) ? body.payload_json : {};
            const explicitDispatchIdResult = parseOptionalFilterToken(
              body.dispatch_id,
              "dispatch_id",
              256,
            );
            if (explicitDispatchIdResult.error) {
              return res.status(400).json({ error: explicitDispatchIdResult.error });
            }
            const explicitDispatchId = explicitDispatchIdResult.value;
            const dispatchId =
              explicitDispatchId ??
              createDispatchId({
                source,
                targetAgentId,
                taskRef,
                promptHash,
                timeBucket,
                payload,
              });

            const row = {
              api_key_hash: apiKeyHash,
              dispatch_id: dispatchId,
              source,
              target_agent_id: targetAgentId,
              task_ref: taskRef ?? null,
              status: "queued",
              payload,
            };

            const { data, error } = await supabase
              .from("mc_agent_dispatches")
              .insert(row)
              .select(
                "id, api_key_hash, dispatch_id, source, target_agent_id, task_ref, status, lease_owner, lease_expires_at, last_real_action_at, payload, created_at, updated_at",
              )
              .single();

            if (error) {
              if ((error as { code?: string }).code === "23505") {
                const existing = await supabase
                  .from("mc_agent_dispatches")
                  .select(
                    "id, api_key_hash, dispatch_id, source, target_agent_id, task_ref, status, lease_owner, lease_expires_at, last_real_action_at, payload, created_at, updated_at",
                  )
                  .eq("api_key_hash", apiKeyHash)
                  .eq("dispatch_id", dispatchId)
                  .maybeSingle();
                if (existing.error) throw existing.error;
                return res.status(200).json({ data: existing.data, was_duplicate: true });
              }
              throw error;
            }

            return res.status(200).json({ data, was_duplicate: false });
          }

          case "claim": {
            if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
            const body = (req.body ?? {}) as Record<string, unknown>;
            const dispatchIdResult = parseRequiredToken(body.dispatch_id, "dispatch_id", 256);
            if (dispatchIdResult.error) return res.status(400).json({ error: dispatchIdResult.error });
            const dispatchId = dispatchIdResult.value!;
            const agentIdResult = parseRequiredToken(body.agent_id, "agent_id", 128);
            if (agentIdResult.error) return res.status(400).json({ error: agentIdResult.error });
            const agentId = agentIdResult.value!;

            const leaseSeconds = getClampedLimit(body.lease_seconds, 60, 86400);
            const { data, error } = await supabase
              .from("mc_agent_dispatches")
              .select(
                "id, api_key_hash, dispatch_id, source, target_agent_id, task_ref, status, lease_owner, lease_expires_at, last_real_action_at, payload, created_at, updated_at",
              )
              .eq("api_key_hash", apiKeyHash)
              .eq("dispatch_id", dispatchId)
              .maybeSingle();
            if (error) throw error;
            if (!data) return res.status(404).json({ error: "dispatch not found" });

            const dispatch = data as ReliabilityDispatchRow;
            const staleDecision = decideStaleLease(
              {
                status: dispatch.status,
                leaseExpiresAt: dispatch.lease_expires_at,
                lastRealActionAt: dispatch.last_real_action_at,
              },
              new Date(),
            );

            if (
              dispatch.status === "completed" ||
              dispatch.status === "failed" ||
              dispatch.status === "cancelled"
            ) {
              return res.status(409).json({ error: `dispatch is already ${dispatch.status}` });
            }

            if (
              dispatch.status === "leased" &&
              dispatch.lease_owner &&
              dispatch.lease_owner !== agentId &&
              !staleDecision.isStale
            ) {
              return res.status(409).json({
                error: "dispatch is already actively leased",
                lease_owner: dispatch.lease_owner,
                lease_expires_at: dispatch.lease_expires_at,
              });
            }

            const now = new Date();
            const leaseExpiresAt = new Date(now.getTime() + leaseSeconds * 1000).toISOString();
            let claimQuery = supabase
              .from("mc_agent_dispatches")
              .update({
                status: "leased",
                lease_owner: agentId,
                lease_expires_at: leaseExpiresAt,
                updated_at: now.toISOString(),
              })
              .eq("api_key_hash", apiKeyHash)
              .eq("dispatch_id", dispatchId)
              .eq("status", dispatch.status)
              .eq("updated_at", dispatch.updated_at);

            if (dispatch.lease_owner) {
              claimQuery = claimQuery.eq("lease_owner", dispatch.lease_owner);
            } else {
              claimQuery = claimQuery.is("lease_owner", null);
            }
            if (dispatch.lease_expires_at) {
              claimQuery = claimQuery.eq("lease_expires_at", dispatch.lease_expires_at);
            } else {
              claimQuery = claimQuery.is("lease_expires_at", null);
            }

            const { data: claimed, error: claimError } = await claimQuery
              .select(
                "id, api_key_hash, dispatch_id, source, target_agent_id, task_ref, status, lease_owner, lease_expires_at, last_real_action_at, payload, created_at, updated_at",
              )
              .maybeSingle();
            if (claimError) throw claimError;
            if (!claimed) {
              const latest = await supabase
                .from("mc_agent_dispatches")
                .select(
                  "status, lease_owner, lease_expires_at, updated_at",
                )
                .eq("api_key_hash", apiKeyHash)
                .eq("dispatch_id", dispatchId)
                .maybeSingle();
              if (latest.error) throw latest.error;
              return res.status(409).json({
                error: "dispatch claim lost race",
                latest: latest.data ?? null,
              });
            }

            return res.status(200).json({
              data: claimed,
              reclaimed_stale_lease: staleDecision.isStale,
            });
          }

          case "release": {
            if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
            const body = (req.body ?? {}) as Record<string, unknown>;
            const dispatchIdResult = parseRequiredToken(body.dispatch_id, "dispatch_id", 256);
            if (dispatchIdResult.error) return res.status(400).json({ error: dispatchIdResult.error });
            const dispatchId = dispatchIdResult.value!;
            const agentIdResult = parseRequiredToken(body.agent_id, "agent_id", 128);
            if (agentIdResult.error) return res.status(400).json({ error: agentIdResult.error });
            const agentId = agentIdResult.value!;
            const nextStatusRaw = body.status;
            if (nextStatusRaw !== undefined && !isReliabilityStatus(nextStatusRaw)) {
              return res.status(400).json({ error: "invalid status" });
            }
            if (nextStatusRaw === "leased") {
              return res.status(400).json({ error: "release cannot keep status leased" });
            }

            const { data, error } = await supabase
              .from("mc_agent_dispatches")
              .select(
                "id, api_key_hash, dispatch_id, source, target_agent_id, task_ref, status, lease_owner, lease_expires_at, last_real_action_at, payload, created_at, updated_at",
              )
              .eq("api_key_hash", apiKeyHash)
              .eq("dispatch_id", dispatchId)
              .maybeSingle();
            if (error) throw error;
            if (!data) return res.status(404).json({ error: "dispatch not found" });

            const dispatch = data as ReliabilityDispatchRow;
            if (dispatch.lease_owner && dispatch.lease_owner !== agentId) {
              return res.status(409).json({
                error: "dispatch is leased by another agent",
                lease_owner: dispatch.lease_owner,
              });
            }

            const nextStatus = (nextStatusRaw as ReliabilityStatus | undefined) ?? "queued";
            const now = new Date().toISOString();
            const { data: released, error: releaseError } = await supabase
              .from("mc_agent_dispatches")
              .update({
                status: nextStatus,
                lease_owner: null,
                lease_expires_at: null,
                last_real_action_at:
                  nextStatus === "completed" || nextStatus === "failed" ? now : dispatch.last_real_action_at,
                updated_at: now,
              })
              .eq("api_key_hash", apiKeyHash)
              .eq("dispatch_id", dispatchId)
              .select(
                "id, api_key_hash, dispatch_id, source, target_agent_id, task_ref, status, lease_owner, lease_expires_at, last_real_action_at, payload, created_at, updated_at",
              )
              .maybeSingle();
            if (releaseError) throw releaseError;
            if (!released) return res.status(404).json({ error: "dispatch not found" });

            return res.status(200).json({ data: released });
          }

          default:
            return res.status(400).json({ error: `Unknown method: ${method}` });
        }
      }

      case "reliability_heartbeats": {
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const method = String(req.query.method ?? req.body?.method ?? "list").trim().toLowerCase();

        switch (method) {
          case "list": {
            const limit = getClampedLimit(req.query.limit ?? req.body?.limit, 50, 200);
            const agentIdFilter = parseOptionalFilterToken(
              req.query.agent_id ?? req.body?.agent_id,
              "agent_id",
              128,
            );
            if (agentIdFilter.error) {
              return res.status(400).json({ error: agentIdFilter.error });
            }

            const dispatchIdFilter = parseOptionalFilterToken(
              req.query.dispatch_id ?? req.body?.dispatch_id,
              "dispatch_id",
              256,
            );
            if (dispatchIdFilter.error) {
              return res.status(400).json({ error: dispatchIdFilter.error });
            }
            let query = supabase
              .from("mc_agent_heartbeats")
              .select(
                "id, api_key_hash, agent_id, dispatch_id, state, current_task, next_action, eta_minutes, blocker, last_real_action_at, created_at",
              )
              .eq("api_key_hash", apiKeyHash)
              .order("created_at", { ascending: false })
              .limit(limit);

            if (agentIdFilter.value) query = query.eq("agent_id", agentIdFilter.value);
            if (dispatchIdFilter.value) query = query.eq("dispatch_id", dispatchIdFilter.value);

            const { data, error } = await query;
            if (error) throw error;
            return res.status(200).json({ heartbeats: data ?? [] });
          }

          case "publish": {
            if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
            const body = (req.body ?? {}) as Record<string, unknown>;
            const state = body.state;
            const agentIdResult = parseRequiredToken(body.agent_id, "agent_id", 128);
            if (agentIdResult.error) return res.status(400).json({ error: agentIdResult.error });
            const agentId = agentIdResult.value!;
            if (!isReliabilityHeartbeatState(state)) {
              return res.status(400).json({ error: "valid state required" });
            }

            const dispatchIdResult = parseOptionalFilterToken(body.dispatch_id, "dispatch_id", 256);
            if (dispatchIdResult.error) {
              return res.status(400).json({ error: dispatchIdResult.error });
            }
            const dispatchId = dispatchIdResult.value;
            let dispatchForHeartbeat: ReliabilityDispatchRow | null = null;
            if (dispatchId) {
              const { data: dispatchData, error: dispatchError } = await supabase
                .from("mc_agent_dispatches")
                .select(
                  "id, api_key_hash, dispatch_id, source, target_agent_id, task_ref, status, lease_owner, lease_expires_at, last_real_action_at, payload, created_at, updated_at",
                )
                .eq("api_key_hash", apiKeyHash)
                .eq("dispatch_id", dispatchId)
                .maybeSingle();
              if (dispatchError) throw dispatchError;
              if (!dispatchData) {
                return res.status(404).json({ error: "dispatch not found" });
              }
              dispatchForHeartbeat = dispatchData as ReliabilityDispatchRow;

              if (
                dispatchForHeartbeat.status === "leased" &&
                dispatchForHeartbeat.lease_owner &&
                dispatchForHeartbeat.lease_owner !== agentId
              ) {
                return res.status(409).json({
                  error: "dispatch is actively leased by another agent",
                  lease_owner: dispatchForHeartbeat.lease_owner,
                  lease_expires_at: dispatchForHeartbeat.lease_expires_at,
                });
              }
            }
            const etaMinutes = parseHeartbeatEtaMinutes(body.eta_minutes);
            const lastRealActionAt = body.last_real_action_at
              ? new Date(String(body.last_real_action_at))
              : new Date();
            const heartbeat = createHeartbeat({
              apiKeyHash,
              agentId,
              dispatchId,
              state,
              currentTask: String(body.current_task ?? "").trim() || undefined,
              nextAction: String(body.next_action ?? "").trim() || undefined,
              etaMinutes,
              blocker: String(body.blocker ?? "").trim() || undefined,
              lastRealActionAt:
                Number.isNaN(lastRealActionAt.getTime()) ? undefined : lastRealActionAt,
            });

            if (dispatchId) {
              const dispatchPatch: Record<string, unknown> = {
                last_real_action_at: heartbeat.lastRealActionAt ?? heartbeat.createdAt,
                updated_at: new Date().toISOString(),
              };
              if (state === "completed") {
                dispatchPatch.status = "completed";
                dispatchPatch.lease_owner = null;
                dispatchPatch.lease_expires_at = null;
              }
              let dispatchUpdateQuery = supabase
                .from("mc_agent_dispatches")
                .update(dispatchPatch)
                .eq("api_key_hash", apiKeyHash)
                .eq("dispatch_id", dispatchId)
                .eq("updated_at", dispatchForHeartbeat?.updated_at ?? "");

              if (dispatchForHeartbeat?.lease_owner) {
                dispatchUpdateQuery = dispatchUpdateQuery.eq(
                  "lease_owner",
                  dispatchForHeartbeat.lease_owner,
                );
              } else {
                dispatchUpdateQuery = dispatchUpdateQuery.is("lease_owner", null);
              }

              const { data: updatedDispatch, error: dispatchUpdateError } =
                await dispatchUpdateQuery
                  .select("dispatch_id, status, lease_owner, updated_at")
                  .maybeSingle();
              if (dispatchUpdateError) throw dispatchUpdateError;
              if (!updatedDispatch) {
                const latest = await supabase
                  .from("mc_agent_dispatches")
                  .select("dispatch_id, status, lease_owner, lease_expires_at, updated_at")
                  .eq("api_key_hash", apiKeyHash)
                  .eq("dispatch_id", dispatchId)
                  .maybeSingle();
                if (latest.error) throw latest.error;
                return res.status(409).json({
                  error: "dispatch changed before heartbeat update applied",
                  latest: latest.data ?? null,
                });
              }
            }

            const { data, error } = await supabase
              .from("mc_agent_heartbeats")
              .insert({
                api_key_hash: heartbeat.apiKeyHash,
                agent_id: heartbeat.agentId,
                dispatch_id: heartbeat.dispatchId ?? null,
                state: heartbeat.state,
                current_task: heartbeat.currentTask ?? null,
                next_action: heartbeat.nextAction ?? null,
                eta_minutes: heartbeat.etaMinutes ?? null,
                blocker: heartbeat.blocker ?? null,
                last_real_action_at: heartbeat.lastRealActionAt ?? null,
                created_at: heartbeat.createdAt,
              })
              .select(
                "id, api_key_hash, agent_id, dispatch_id, state, current_task, next_action, eta_minutes, blocker, last_real_action_at, created_at",
              )
              .single();
            if (error) throw error;

            return res.status(200).json({ data });
          }

          default:
            return res.status(400).json({ error: `Unknown method: ${method}` });
        }
      }

      case "reliability_reclaim_stale": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

        const body = (req.body ?? {}) as Record<string, unknown>;
        const limit = getClampedLimit(body.limit ?? req.query.limit, 25, 200);
        const dryRun = body.dry_run === true || req.query.dry_run === "1";
        const now = new Date();
        const { data, error } = await supabase
          .from("mc_agent_dispatches")
          .select(
            "id, api_key_hash, dispatch_id, source, target_agent_id, task_ref, status, lease_owner, lease_expires_at, last_real_action_at, payload, created_at, updated_at",
          )
          .eq("api_key_hash", apiKeyHash)
          .eq("status", "leased")
          .not("lease_expires_at", "is", null)
          .order("lease_expires_at", { ascending: true })
          .limit(limit);
        if (error) throw error;

        const reclaimed: Array<Record<string, unknown>> = [];
        for (const row of (data ?? []) as ReliabilityDispatchRow[]) {
          const decision = decideStaleLease(
            {
              status: row.status,
              leaseExpiresAt: row.lease_expires_at,
              lastRealActionAt: row.last_real_action_at,
            },
            now,
          );
          if (!decision.isStale) continue;

          const signal = createReclaimSignal(row, decision.staleSeconds);
          if (!dryRun) {
            const { error: reclaimError } = await supabase
              .from("mc_agent_dispatches")
              .update({
                status: "stale",
                lease_owner: null,
                lease_expires_at: null,
                updated_at: now.toISOString(),
              })
              .eq("api_key_hash", apiKeyHash)
              .eq("dispatch_id", row.dispatch_id);
            if (reclaimError) throw reclaimError;

            await emitSignal({
              apiKeyHash,
              tool: "wakepass",
              action: signal.action,
              severity: signal.action === "handoff_ack_missing" ? "action_needed" : "info",
              summary: signal.summary,
              payload: signal.payload,
            });
          }

          reclaimed.push({
            dispatch_id: row.dispatch_id,
            target_agent_id: row.target_agent_id,
            source: row.source,
            stale_seconds: decision.staleSeconds,
            action: signal.action,
            dry_run: dryRun,
          });
        }

        return res.status(200).json({
          reclaimed_count: reclaimed.length,
          reclaimed,
          dry_run: dryRun,
        });
      }

      // ── Tenant auto-load settings ───────────────────────────────────
      case "admin_get_autoload_settings": {
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

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
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const hash = apiKeyHash;
        const envEnabled = isAdminChatEnabled();

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
          if (body.ai_chat_provider !== undefined) {
            if (!isChatProvider(body.ai_chat_provider)) {
              return res.status(400).json({ error: "ai_chat_provider must be google, openai, or anthropic" });
            }
            update.ai_chat_provider = body.ai_chat_provider;
          }
          if (body.ai_chat_model !== undefined) {
            if (typeof body.ai_chat_model !== "string" || !body.ai_chat_model.trim()) {
              return res.status(400).json({ error: "ai_chat_model must be a non-empty string" });
            }
            update.ai_chat_model = body.ai_chat_model.trim();
          }
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
            ai_chat_enabled: row?.ai_chat_enabled ?? true,
            ai_chat_provider: normaliseAiChatProvider(row?.ai_chat_provider),
            ai_chat_model: normaliseAiChatModel(
              normaliseAiChatProvider(row?.ai_chat_provider),
              row?.ai_chat_model,
            ),
            ai_chat_system_prompt: row?.ai_chat_system_prompt ?? null,
            ai_chat_max_turns: normaliseAiChatMaxTurns(row?.ai_chat_max_turns),
            has_api_key: Boolean(row?.ai_chat_api_key_encrypted),
          },
        });
      }

      case "admin_update_autoload_settings": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

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
        const envEnabled = isAdminChatEnabled();
        if (!envEnabled) {
          return res.status(503).json({
            error: "Admin AI chat is disabled. Set AI_CHAT_ENABLED=true to turn it on.",
          });
        }

        const body = req.body as
          | { messages?: unknown[]; api_key?: string }
          | undefined;
        const messages = Array.isArray(body?.messages) ? body!.messages! : [];
        if (messages.length === 0) {
          return res.status(400).json({ error: "messages array is required" });
        }

        const rawApiKey = (body?.api_key ?? "").trim();
        const apiKeyHash =
          (await resolveApiKeyHash(req, supabaseUrl, supabaseKey)) ||
          (rawApiKey ? sha256hex(rawApiKey) : null);
        if (!apiKeyHash) {
          return res.status(401).json({ error: "Authorization header required" });
        }

        const tenantSettings = await resolveTenantAiChatSettings(supabase, apiKeyHash);
        if (!tenantSettings.ai_chat_enabled) {
          return res.status(403).json({
            error: "Admin AI chat is turned off in tenant settings.",
          });
        }

        const providerDecision = decideMemoryAdminAiChatProviderCall({
          provider: tenantSettings.ai_chat_provider,
          model: tenantSettings.ai_chat_model,
          allow_paid: envEnabled && tenantSettings.ai_chat_enabled && Boolean(tenantSettings.ai_chat_api_key),
        });
        if (!providerDecision.allowed) {
          return res.status(503).json({
            error:
              "Admin AI chat provider is not configured. Add a tenant API key in Settings before making paid provider calls.",
            provider: providerDecision.provider,
            model: providerDecision.model,
            cost_tier: providerDecision.cost_tier,
            allow_paid_flag: providerDecision.allow_paid_flag,
          });
        }

        const systemPromptBase = await buildAdminChatSystemPrompt(supabase, apiKeyHash);
        const systemPrompt = tenantSettings.ai_chat_system_prompt
          ? [
              systemPromptBase,
              "",
              "Tenant custom instructions:",
              tenantSettings.ai_chat_system_prompt,
            ].join("\n")
          : systemPromptBase;
        const tools = buildAdminChatTools(supabase, apiKeyHash, req);

        const recentMessages = messages.slice(-tenantSettings.ai_chat_max_turns);
        const modelMessages = await normaliseChatMessages(recentMessages);
        if ("error" in modelMessages) {
          return res.status(400).json({ error: modelMessages.error });
        }
        const model = await resolveAiChatModel({
          provider: tenantSettings.ai_chat_provider,
          model: tenantSettings.ai_chat_model,
          userApiKey: tenantSettings.ai_chat_api_key,
        });
        const result = streamText({
          model,
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

      // ── Channels orchestrator ─────────────────────────────────────────
      case "admin_channel_send": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const body = req.body as { session_id?: string; content?: string };
        const sessionId = (body?.session_id ?? "").trim();
        const content = (body?.content ?? "").toString();
        if (!sessionId) return res.status(400).json({ error: "session_id required" });
        if (!content.trim()) return res.status(400).json({ error: "content required" });

        const { data, error } = await supabase
          .from("chat_messages")
          .insert({
            api_key_hash: apiKeyHash,
            session_id: sessionId,
            role: "user",
            content,
            status: "pending",
          })
          .select("id, session_id, created_at")
          .single();
        if (error) throw error;

        return res.status(200).json({
          message_id: data.id,
          session_id: data.session_id,
          created_at: data.created_at,
        });
      }

      case "admin_channel_poll": {
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const sessionId = String(req.query.session_id ?? "").trim();
        const after = String(req.query.after ?? "").trim();
        if (!sessionId) return res.status(400).json({ error: "session_id required" });

        let q = supabase
          .from("chat_messages")
          .select("*")
          .eq("api_key_hash", apiKeyHash)
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true })
          .limit(200);

        if (after) q = q.gt("created_at", after);

        const { data, error } = await q;
        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      case "admin_conversation_turn_ingest": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

        const body = (req.body ?? {}) as {
          session_id?: string;
          role?: string;
          content?: string;
          source_app?: string;
          client_session_id?: string;
        };
        const sessionId = String(body.session_id ?? "").trim();
        const role = String(body.role ?? "").trim();
        const content = String(body.content ?? "");
        const sourceApp = String(body.source_app ?? "subscription-tether").trim().slice(0, 80);
        const clientSessionId = String(body.client_session_id ?? "").trim().slice(0, 200);

        if (!sessionId) return res.status(400).json({ error: "session_id required" });
        if (!["user", "assistant", "system"].includes(role)) {
          return res.status(400).json({ error: "role must be user, assistant, or system" });
        }
        if (!content.trim()) return res.status(400).json({ error: "content required" });
        if (content.length > 12_000) return res.status(413).json({ error: "content must be 12000 characters or less" });

        const safeContent = redactSensitive(content);
        const { data, error } = await supabase
          .from("chat_messages")
          .insert({
            api_key_hash: apiKeyHash,
            session_id: sessionId,
            role,
            content: safeContent,
            status: "completed",
            metadata: {
              source_app: sourceApp || "subscription-tether",
              client_session_id: clientSessionId || null,
              ingest_source: "subscription_turn",
              ingested_at: new Date().toISOString(),
            },
          })
          .select("id, session_id, role, created_at")
          .single();
        if (error) throw error;

        return res.status(200).json({
          turn_id: data.id,
          session_id: data.session_id,
          role: data.role,
          created_at: data.created_at,
          redacted: safeContent !== content,
        });
      }

      case "admin_channel_status": {
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const { data, error } = await supabase
          .from("channel_status")
          .select("last_seen, client_info")
          .eq("api_key_hash", apiKeyHash)
          .maybeSingle();
        if (error) throw error;

        const lastSeen = data?.last_seen ?? null;
        const ageMs = lastSeen ? Date.now() - new Date(lastSeen).getTime() : Infinity;
        const active = ageMs < 90_000; // 90s grace window for 30s heartbeats

        return res.status(200).json({
          channel_active: active,
          last_seen: lastSeen,
          client_info: data?.client_info ?? null,
        });
      }

      case "admin_channel_heartbeat": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const body = req.body as { client_info?: string };
        const clientInfo = (body?.client_info ?? "").toString().slice(0, 500);

        const { error } = await supabase
          .from("channel_status")
          .upsert(
            {
              api_key_hash: apiKeyHash,
              client_info: clientInfo || null,
              last_seen: new Date().toISOString(),
            },
            { onConflict: "api_key_hash" }
          );
        if (error) throw error;

        return res.status(200).json({ success: true });
      }

      // ── Global admin spotlight search across facts/sessions/context ──
      case "admin_search": {
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

        const query = String(req.query.query ?? "").trim();
        if (!query) return res.status(200).json({ data: [] });
        const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 8, 1), 25);

        const escaped = query.replace(/[%_\\]/g, (c) => `\\${c}`);
        const pattern = `%${escaped}%`;

        const [factsRes, sessionsRes, contextRes] = await Promise.all([
          supabase
            .from("mc_extracted_facts")
            .select("id, fact, created_at")
            .eq("api_key_hash", apiKeyHash)
            .eq("status", "active")
            .ilike("fact", pattern)
            .order("created_at", { ascending: false })
            .limit(limit),
          supabase
            .from("mc_session_summaries")
            .select("id, summary, created_at")
            .eq("api_key_hash", apiKeyHash)
            .ilike("summary", pattern)
            .order("created_at", { ascending: false })
            .limit(limit),
          supabase
            .from("mc_business_context")
            .select("id, category, key, value, updated_at")
            .eq("api_key_hash", apiKeyHash)
            .or(`key.ilike.${pattern},value::text.ilike.${pattern}`)
            .order("updated_at", { ascending: false })
            .limit(limit),
        ]);

        type Hit = {
          type: "fact" | "session" | "context";
          id: string;
          preview: string;
          created_at: string;
        };
        const truncate = (s: string, n = 140) =>
          s.length > n ? `${s.slice(0, n - 1).trimEnd()}...` : s;

        const results: Hit[] = [];
        for (const row of factsRes.data ?? []) {
          results.push({
            type: "fact",
            id: String(row.id),
            preview: truncate(String(row.fact ?? "")),
            created_at: String(row.created_at ?? ""),
          });
        }
        for (const row of sessionsRes.data ?? []) {
          results.push({
            type: "session",
            id: String(row.id),
            preview: truncate(String(row.summary ?? "")),
            created_at: String(row.created_at ?? ""),
          });
        }
        for (const row of contextRes.data ?? []) {
          const valText =
            typeof row.value === "string" ? row.value : JSON.stringify(row.value ?? "");
          results.push({
            type: "context",
            id: String(row.id),
            preview: truncate(`${row.category}/${row.key}: ${valText}`),
            created_at: String(row.updated_at ?? ""),
          });
        }

        results.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

        return res.status(200).json({ data: results.slice(0, limit * 2) });
      }

      // ── Bug reports visible to the submitting api_key_hash ──────────
      case "admin_bug_reports": {
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);

        const { data, error } = await supabase
          .from("bug_reports")
          .select("id, tool_name, error_message, severity, status, created_at, updated_at")
          .eq("api_key_hash", apiKeyHash)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      // ── Crews Phase B actions ────────────────────────────────────────────

      case "list_agents": {
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

        // Inject tenant into session so RLS works (service_role bypasses RLS, so we
        // filter manually instead).
        await supabase.rpc("set_config", {
          setting: "request.jwt.claims",
          value: JSON.stringify({ api_key_hash: apiKeyHash }),
          is_local: true,
        }).catch(() => null);

        const category = typeof req.query.category === "string" ? req.query.category : null;
        const search = typeof req.query.search === "string" ? req.query.search.trim() : null;

        let q = supabase
          .from("mc_agents")
          .select("id,slug,name,category,hook,description,tool_tags,icon,colour_token,is_system,source_agent_id,api_key_hash")
          .or(`is_system.eq.true,api_key_hash.eq.${apiKeyHash}`)
          .order("is_system", { ascending: false })
          .order("name");

        if (category) q = q.eq("category", category);
        if (search) q = q.or(`name.ilike.%${search}%,hook.ilike.%${search}%`);

        const { data, error } = await q;
        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      case "clone_agent": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

        const { slug } = req.body ?? {};
        if (!slug) return res.status(400).json({ error: "slug required" });

        const { data: src, error: srcErr } = await supabase
          .from("mc_agents")
          .select("*")
          .eq("slug", slug)
          .eq("is_system", true)
          .maybeSingle();
        if (srcErr) throw srcErr;
        if (!src) return res.status(404).json({ error: "System agent not found" });

        const cloneSlug = `${slug}-${apiKeyHash.slice(0, 8)}`;
        const { data: clone, error: insertErr } = await supabase
          .from("mc_agents")
          .insert({
            slug: cloneSlug,
            api_key_hash: apiKeyHash,
            name: src.name,
            category: src.category,
            hook: src.hook,
            description: src.description,
            tool_tags: src.tool_tags,
            icon: src.icon,
            colour_token: src.colour_token,
            seed_prompt: src.seed_prompt,
            memory_scope_shared: src.memory_scope_shared,
            memory_scope_private: src.memory_scope_private,
            subspecialty_tags: src.subspecialty_tags,
            disclaimer: src.disclaimer,
            is_system: false,
            source_agent_id: src.id,
          })
          .select()
          .single();
        if (insertErr) throw insertErr;
        return res.status(201).json({ data: clone });
      }

      case "update_agent": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

        const { id, ...patch } = req.body ?? {};
        if (!id) return res.status(400).json({ error: "id required" });

        const allowed = ["name","category","hook","description","tool_tags","icon","colour_token","seed_prompt","memory_scope_shared","memory_scope_private","subspecialty_tags","disclaimer"];
        const filtered: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const k of allowed) {
          if (k in patch) filtered[k] = patch[k];
        }

        const { data, error } = await supabase
          .from("mc_agents")
          .update(filtered)
          .eq("id", id)
          .eq("api_key_hash", apiKeyHash)
          .select()
          .maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: "Agent not found or not owned by you" });
        return res.status(200).json({ data });
      }

      case "create_agent": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

        const { slug, name, category, hook, description, tool_tags, icon, colour_token, seed_prompt, memory_scope_shared, memory_scope_private, subspecialty_tags, disclaimer } = req.body ?? {};
        if (!slug || !name || !category) return res.status(400).json({ error: "slug, name, category required" });

        const { data, error } = await supabase
          .from("mc_agents")
          .insert({
            slug,
            api_key_hash: apiKeyHash,
            name,
            category,
            hook: hook ?? "",
            description: description ?? "",
            tool_tags: tool_tags ?? [],
            icon: icon ?? "",
            colour_token: colour_token ?? "",
            seed_prompt: seed_prompt ?? null,
            memory_scope_shared: memory_scope_shared ?? [],
            memory_scope_private: memory_scope_private ?? [],
            subspecialty_tags: subspecialty_tags ?? [],
            disclaimer: disclaimer ?? null,
            is_system: false,
          })
          .select()
          .single();
        if (error) throw error;
        return res.status(201).json({ data });
      }

      case "list_crews": {
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

        await ensureStarterCrews(supabase, apiKeyHash);

        const { data, error } = await supabase
          .from("mc_crews")
          .select("id,name,description,template,agent_ids,created_at,updated_at")
          .eq("api_key_hash", apiKeyHash)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      case "create_crew": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

        const { name, description, template, agent_ids } = req.body ?? {};
        if (!name || !template) return res.status(400).json({ error: "name and template required" });

        const { data, error } = await supabase
          .from("mc_crews")
          .insert({
            api_key_hash: apiKeyHash,
            name,
            description: description ?? "",
            template,
            agent_ids: agent_ids ?? [],
          })
          .select()
          .single();
        if (error) throw error;
        return res.status(201).json({ data });
      }

      case "update_crew": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

        const { id: crewId, ...crewPatch } = req.body ?? {};
        if (!crewId) return res.status(400).json({ error: "id required" });

        const crewAllowed = ["name","description","template","agent_ids"];
        const crewFiltered: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const k of crewAllowed) {
          if (k in crewPatch) crewFiltered[k] = crewPatch[k];
        }

        const { data: crewData, error: crewErr } = await supabase
          .from("mc_crews")
          .update(crewFiltered)
          .eq("id", crewId)
          .eq("api_key_hash", apiKeyHash)
          .select()
          .maybeSingle();
        if (crewErr) throw crewErr;
        if (!crewData) return res.status(404).json({ error: "Crew not found or not owned by you" });
        return res.status(200).json({ data: crewData });
      }

      case "delete_crew": {
        if (req.method !== "POST" && req.method !== "DELETE") return res.status(405).json({ error: "POST or DELETE required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

        const deleteId = (req.body?.id ?? req.query.id) as string;
        if (!deleteId) return res.status(400).json({ error: "id required" });

        const { error: deleteErr, count } = await supabase
          .from("mc_crews")
          .delete({ count: "exact" })
          .eq("id", deleteId)
          .eq("api_key_hash", apiKeyHash);
        if (deleteErr) throw deleteErr;
        if (!count) return res.status(404).json({ error: "Crew not found or not owned by you" });
        return res.status(200).json({ success: true });
      }

      // ─── Phase C: Crew run actions ─────────────────────────────────────────

      case "start_crew_run": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        await ensureStarterCrews(supabase, apiKeyHash);
        const { crew_id, task_prompt, token_budget, task_id } = (req.body ?? {}) as {
          crew_id?: string;
          task_prompt?: string;
          token_budget?: number;
          task_id?: string;
        };
        if (!crew_id || !task_prompt?.trim()) {
          return res.status(400).json({ error: "crew_id and task_prompt required" });
        }
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        let normalizedTaskId: string | undefined;
        if (task_id !== undefined && task_id !== null && task_id !== "") {
          if (typeof task_id !== "string" || !UUID_RE.test(task_id)) {
            return res.status(400).json({ error: "task_id must be a UUID (v1-v5, recommended v5)" });
          }
          normalizedTaskId = task_id.toLowerCase();
        }
        const { data: crewRow, error: crewErr } = await supabase
          .from("mc_crews")
          .select("id")
          .eq("id", crew_id)
          .eq("api_key_hash", apiKeyHash)
          .maybeSingle();
        if (crewErr) throw crewErr;
        if (!crewRow) {
          return res.status(404).json({ error: "crew_id not found for tenant" });
        }
        // User-facing runs now route LLM traffic through MCP sampling. The HTTP
        // path cannot do bidirectional sampling, so we create the run row for
        // bookkeeping and return a card asking the caller to re-run via MCP.
        const insertPayload: Record<string, unknown> = {
          api_key_hash: apiKeyHash,
          crew_id,
          task_prompt: task_prompt.trim(),
          token_budget: token_budget ?? 150000,
          status: "failed",
          result_artifact: {
            error: "SAMPLING_NOT_SUPPORTED",
            message:
              "Orchestrator does not support sampling. Use Claude Desktop or another sampling-capable client.",
          },
          completed_at: new Date().toISOString(),
        };
        if (normalizedTaskId) insertPayload.task_id = normalizedTaskId;
        const { data: runRow, error: runErr } = await supabase
          .from("mc_crew_runs")
          .insert(insertPayload)
          .select()
          .single();
        // 23505 = unique_violation against (api_key_hash, task_id) partial index.
        // Look up the original row, return it with was_duplicate=true so the
        // caller can short-circuit duplicate dispatch (MCP SEP-1686).
        let resolvedRunId: string;
        let wasDuplicate = false;
        if (runErr) {
          const errCode = (runErr as { code?: string }).code;
          if (normalizedTaskId && errCode === "23505") {
            // STALE_RUN check intentionally omitted — relies on synchronous handler invariant.
            // If a runner is ever made async, add a `last_heartbeat`-based stale-run gate here
            // before returning was_duplicate=true on a still-running task_id.
            const { data: existing } = await supabase
              .from("mc_crew_runs")
              .select("id")
              .eq("api_key_hash", apiKeyHash)
              .eq("task_id", normalizedTaskId)
              .maybeSingle();
            if (existing?.id) {
              console.log(
                `[duplicate_dispatch_avoided] table=mc_crew_runs task_id=${normalizedTaskId} run_id=${existing.id}`,
              );
              resolvedRunId = existing.id;
              wasDuplicate = true;
            } else {
              throw runErr;
            }
          } else {
            throw runErr;
          }
        } else {
          resolvedRunId = runRow.id;
        }
        const card: ConversationalCard = buildCard({
          headline: wasDuplicate
            ? "Crews Council run already created"
            : "Crews Council run needs MCP sampling",
          summary: wasDuplicate
            ? "A run with this task_id already exists for your tenant. Returning the original run_id; no new row was created."
            : "This HTTP endpoint cannot run a Council round because LLM traffic now flows through MCP sampling. Start the run from a sampling-capable client (e.g. Claude Desktop) using the start_crew_run MCP tool.",
          keyFacts: [
            `run_id: ${resolvedRunId}`,
            `crew_id: ${crew_id}`,
            ...(wasDuplicate
              ? ["was_duplicate: true"]
              : ["status: failed (SAMPLING_NOT_SUPPORTED)"]),
          ],
          nextActions: wasDuplicate
            ? ["Call get_run with the run_id to inspect the original run"]
            : [
                "Install the UnClick MCP server in a sampling-capable client",
                "Call the start_crew_run MCP tool with the same crew_id and task_prompt",
              ],
          deepLink: `/admin/crews/runs/${resolvedRunId}`,
        });
        return res.status(wasDuplicate ? 200 : 409).json({
          error: wasDuplicate ? undefined : "SAMPLING_NOT_SUPPORTED",
          run_id: resolvedRunId,
          was_duplicate: wasDuplicate,
          task_id: normalizedTaskId ?? null,
          card,
        });
      }

      case "get_run": {
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const runId = String(
          req.query.run_id ?? (req.body as { run_id?: string })?.run_id ?? ""
        ).trim();
        if (!runId) return res.status(400).json({ error: "run_id required" });
        const [runRes, msgsRes] = await Promise.all([
          supabase
            .from("mc_crew_runs")
            .select("*")
            .eq("id", runId)
            .eq("api_key_hash", apiKeyHash)
            .maybeSingle(),
          supabase
            .from("mc_run_messages")
            .select("*")
            .eq("run_id", runId)
            .eq("api_key_hash", apiKeyHash)
            .order("created_at"),
        ]);
        if (runRes.error) throw runRes.error;
        if (!runRes.data) return res.status(404).json({ error: "Run not found" });
        const run = runRes.data as {
          id: string;
          status: string;
          task_prompt: string;
          tokens_used: number | null;
          result_artifact: Record<string, unknown> | null;
          started_at: string | null;
          completed_at: string | null;
          crew_id?: string;
        };
        const messages = (msgsRes.data ?? []) as Array<{ stage?: string }>;
        const stageCounts = messages.reduce<Record<string, number>>((acc, m) => {
          const s = m.stage ?? "unknown";
          acc[s] = (acc[s] ?? 0) + 1;
          return acc;
        }, {});
        const stageSummary = Object.entries(stageCounts)
          .map(([s, n]) => `${s}: ${n}`)
          .join(", ") || "none";
        const errArtifact = run.result_artifact as { error?: string; message?: string } | null;
        const errorLine = errArtifact?.error
          ? `error: ${errArtifact.error}${errArtifact.message ? ` (${errArtifact.message})` : ""}`
          : null;
        let agents: unknown[] = [];
        if (run.crew_id) {
          const crewRes = await supabase
            .from("mc_crews")
            .select("agent_ids")
            .eq("id", run.crew_id)
            .eq("api_key_hash", apiKeyHash)
            .maybeSingle();
          const agentIds: string[] = (crewRes.data as { agent_ids?: string[] } | null)?.agent_ids ?? [];
          if (agentIds.length > 0) {
            const { data: agentRows } = await supabase
              .from("mc_agents")
              .select("id,slug,name,category,colour_token")
              .in("id", agentIds);
            agents = agentRows ?? [];
          }
          const hasChairman = (agents as { slug?: string }[]).some((a) => a.slug === "chairman");
          if (!hasChairman) {
            const { data: chairRow } = await supabase
              .from("mc_agents")
              .select("id,slug,name,category,colour_token")
              .eq("slug", "chairman")
              .eq("is_system", true)
              .maybeSingle();
            if (chairRow) agents = [...agents, chairRow];
          }
        }
        const agentNames = (agents as { name?: string }[]).map((a) => a.name).filter(Boolean).join(", ");
        const card: ConversationalCard = buildCard({
          headline: `Crews run ${run.status}`,
          summary: run.task_prompt.slice(0, 240),
          keyFacts: [
            `run_id: ${run.id}`,
            `status: ${run.status}`,
            `tokens_used: ${run.tokens_used ?? 0}`,
            `stages: ${stageSummary}`,
            ...(agentNames ? [`agents: ${agentNames}`] : []),
            ...(errorLine ? [errorLine] : []),
          ],
          nextActions:
            run.status === "complete"
              ? ["Open the admin run page to review the synthesis"]
              : run.status === "failed"
                ? ["Inspect result_artifact for the failure reason", "Start a new run via MCP sampling"]
                : ["Poll get_run until status is complete or failed"],
          deepLink: `/admin/crews/runs/${run.id}`,
        });
        return res.status(200).json({
          run: runRes.data,
          messages: msgsRes.data ?? [],
          agents,
          card,
        });
      }

      case "list_runs": {
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const crewId =
          String(req.query.crew_id ?? (req.body as { crew_id?: string })?.crew_id ?? "").trim() ||
          null;
        const limit = Math.min(
          Number(req.query.limit ?? (req.body as { limit?: number })?.limit ?? 50),
          100
        );
        let q = supabase
          .from("mc_crew_runs")
          .select(
            "id,crew_id,task_prompt,status,tokens_used,result_artifact,started_at,completed_at,created_at"
          )
          .eq("api_key_hash", apiKeyHash)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (crewId) q = q.eq("crew_id", crewId);
        const { data, error } = await q;
        if (error) throw error;
        const rows = (data ?? []) as Array<{
          id: string;
          crew_id: string;
          status: string;
          task_prompt: string;
        }>;
        const recent = rows.slice(0, 3).map((r) => {
          const preview = r.task_prompt.length > 40
            ? r.task_prompt.slice(0, 40) + "..."
            : r.task_prompt;
          return `${r.id} (${r.status}): ${preview}`;
        });
        const card: ConversationalCard = buildCard({
          headline: `Found ${rows.length} Crews run${rows.length === 1 ? "" : "s"}`,
          summary: crewId
            ? `Runs for crew ${crewId}, newest first.`
            : "All runs for this API key, newest first.",
          keyFacts: [
            `total: ${rows.length}`,
            ...(recent.length > 0 ? recent : ["no runs yet"]),
          ],
          nextActions:
            rows.length === 0
              ? ["Call start_crew_run via MCP to kick off your first run"]
              : [
                  "Call get_run with a run_id to inspect a specific run",
                  "Call start_crew_run via MCP to start a new one",
                ],
          deepLink: "/admin/crews/runs",
        });
        return res.status(200).json({ data: rows, card });
      }

      // ─── TestPass run management (Phase 9A visual UI) ─────────────────────

      case "list_testpass_runs": {
        const user = await resolveSessionUser(req, supabaseUrl, supabaseKey);
        if (!user) return res.status(401).json({ error: "Authorization header required" });
        const limit = Math.min(Number(req.query.limit ?? req.body?.limit ?? 50), 100);
        const targetFilter = (req.query.target ?? req.body?.target ?? "") as string;
        let q = supabase
          .from("testpass_runs")
          .select("id, pack_id, pack_name, target, profile, started_at, completed_at, status, verdict_summary")
          .eq("actor_user_id", user.id)
          .order("started_at", { ascending: false })
          .limit(limit);
        if (targetFilter) q = q.ilike("target->>url", `%${targetFilter}%`);
        const { data, error } = await q;
        if (error) throw error;
        return res.status(200).json({ runs: data ?? [] });
      }

      case "list_testpass_packs": {
        const user = await resolveSessionUser(req, supabaseUrl, supabaseKey);
        if (!user) return res.status(401).json({ error: "Authorization header required" });
        const { data, error } = await supabase
          .from("testpass_packs")
          .select("id, slug, name, version, description, yaml")
          .or(`owner_user_id.is.null,owner_user_id.eq.${user.id}`)
          .order("created_at", { ascending: true });
        if (error) throw error;
        const packs = (data ?? []).map((p) => {
          const yamlData = (p.yaml ?? {}) as Record<string, unknown>;
          const items = Array.isArray(yamlData.items) ? yamlData.items : [];
          const category = (yamlData.category as string | undefined) ?? "general";
          return {
            id: p.id,
            slug: p.slug,
            name: p.name,
            description: p.description,
            check_count: items.length,
            category,
            is_system: !p.yaml || Object.keys(p.yaml as object).length === 0,
          };
        });
        return res.status(200).json({ packs });
      }

      case "get_testpass_run": {
        const user = await resolveSessionUser(req, supabaseUrl, supabaseKey);
        if (!user) return res.status(401).json({ error: "Authorization header required" });
        const runId = (req.query.run_id ?? req.body?.run_id ?? "") as string;
        if (!runId) return res.status(400).json({ error: "run_id required" });
        const [runRes, itemsRes] = await Promise.all([
          supabase
            .from("testpass_runs")
            .select("*")
            .eq("id", runId)
            .eq("actor_user_id", user.id)
            .maybeSingle(),
          supabase
            .from("testpass_items")
            .select("*")
            .eq("run_id", runId)
            .order("created_at", { ascending: true }),
        ]);
        if (runRes.error) throw runRes.error;
        if (!runRes.data) return res.status(404).json({ error: "Run not found" });
        if (itemsRes.error) throw itemsRes.error;
        return res.status(200).json({ run: runRes.data, items: itemsRes.data ?? [] });
      }

      case "start_testpass_run": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const user = await resolveSessionUser(req, supabaseUrl, supabaseKey);
        if (!user) return res.status(401).json({ error: "Authorization header required" });
        const { pack_id, target, depth } = (req.body ?? {}) as {
          pack_id?: string;
          target?: string;
          depth?: string;
        };
        if (!pack_id) return res.status(400).json({ error: "pack_id required" });
        if (!target) return res.status(400).json({ error: "target required" });
        const profile = (["smoke", "standard", "deep"].includes(depth ?? "") ? depth : "standard") as string;
        const { data: pack } = await supabase
          .from("testpass_packs")
          .select("slug, name")
          .eq("id", pack_id)
          .maybeSingle();
        if (!pack) return res.status(404).json({ error: "Pack not found" });

        // Resolve api_key_hash for report linking (two-layer: raw key or session JWT)
        const tpApiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);

        // Find or create open report for this (api_key_hash, target, pack_id)
        let reportId: string | null = null;
        if (tpApiKeyHash) {
          const { data: existingReport } = await supabase
            .from("mc_testpass_reports")
            .select("id, run_sequence")
            .eq("api_key_hash", tpApiKeyHash)
            .eq("target", target)
            .eq("pack_id", pack_id)
            .eq("status", "open")
            .maybeSingle();
          if (existingReport) {
            reportId = existingReport.id as string;
          } else {
            const { data: newReport } = await supabase
              .from("mc_testpass_reports")
              .insert({
                api_key_hash: tpApiKeyHash,
                target,
                pack_id,
                status: "open",
                run_sequence: [],
              })
              .select("id")
              .maybeSingle();
            if (newReport) reportId = newReport.id as string;
          }
        }

        const host = req.headers.host ?? "localhost:3000";
        const proto = host.includes("localhost") ? "http" : "https";
        const engineRes = await fetch(`${proto}://${host}/api/testpass?action=run`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: req.headers.authorization ?? "",
          },
          body: JSON.stringify({
            action: "run",
            target_url: target,
            profile,
            pack_slug: pack.slug,
            pack_id,
            pack_name: pack.name,
          }),
        });
        const engineBody = (await engineRes.json().catch(() => ({}))) as Record<string, unknown>;
        if (!engineRes.ok) return res.status(engineRes.status).json(engineBody);

        const runId = engineBody.run_id as string | undefined;

        // Link run to report and append to run_sequence
        if (runId && reportId && tpApiKeyHash) {
          await supabase
            .from("testpass_runs")
            .update({ report_id: reportId })
            .eq("id", runId);

          // Append run to report's sequence via array append
          const { data: currentReport } = await supabase
            .from("mc_testpass_reports")
            .select("run_sequence")
            .eq("id", reportId)
            .maybeSingle();
          const currentSeq = (currentReport?.run_sequence as string[] | null) ?? [];
          await supabase
            .from("mc_testpass_reports")
            .update({ run_sequence: [...currentSeq, runId] })
            .eq("id", reportId);

          // Check if all items in this run are Pass or N/A - if so, close the report
          const summary = engineBody.summary as Record<string, number> | undefined;
          if (summary) {
            const failCount = summary.fail ?? 0;
            const pendingCount = summary.pending ?? 0;
            if (failCount === 0 && pendingCount === 0) {
              const closedAt = new Date().toISOString();
              await supabase
                .from("mc_testpass_reports")
                .update({ status: "complete", closed_at: closedAt })
                .eq("id", reportId);
              void emitSignal({
                apiKeyHash: tpApiKeyHash,
                tool: "testpass",
                action: "report_closed",
                severity: "info",
                summary: "All checks cleared. Report closed.",
                deepLink: `/admin/testpass/reports/${reportId}`,
              });
            } else {
              void emitSignal({
                apiKeyHash: tpApiKeyHash,
                tool: "testpass",
                action: "report_stalled",
                severity: "action_needed",
                summary: `Report has ${failCount} failing check${failCount === 1 ? "" : "s"}. Run again after fixes.`,
                deepLink: `/admin/testpass/reports/${reportId}`,
              });
            }
          }

          void emitSignal({
            apiKeyHash: tpApiKeyHash,
            tool: "testpass",
            action: "run_complete",
            severity: "info",
            summary: `TestPass run completed for ${target}`,
            deepLink: `/admin/testpass/runs/${runId}`,
          });
        }

        return res.status(200).json({ run_id: runId, report_id: reportId });
      }

      // ─── TestPass Phase 9B: report actions ────────────────────────────────

      case "get_report": {
        const tpUser = await resolveSessionUser(req, supabaseUrl, supabaseKey);
        if (!tpUser) return res.status(401).json({ error: "Authorization header required" });
        const grApiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!grApiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const reportId = (req.body?.report_id ?? req.query.report_id ?? "") as string;
        if (!reportId) return res.status(400).json({ error: "report_id required" });
        const [reportRes, runsRes] = await Promise.all([
          supabase
            .from("mc_testpass_reports")
            .select("*")
            .eq("id", reportId)
            .eq("api_key_hash", grApiKeyHash)
            .maybeSingle(),
          supabase
            .from("testpass_runs")
            .select("id, status, verdict_summary, started_at, completed_at, pack_name, target, profile")
            .eq("report_id", reportId)
            .order("started_at", { ascending: true }),
        ]);
        if (reportRes.error) throw reportRes.error;
        if (!reportRes.data) return res.status(404).json({ error: "Report not found" });
        if (runsRes.error) throw runsRes.error;
        const runsRaw = runsRes.data ?? [];
        type VerdictSummary = { check?: number; fail?: number; na?: number; other?: number; pending?: number };
        const runsWithMeta = runsRaw.map((r, idx) => {
          const vs = (r.verdict_summary ?? {}) as VerdictSummary;
          const pass = vs.check ?? 0;
          const fail = vs.fail ?? 0;
          const na = vs.na ?? 0;
          let delta: { fixed: number; new_fails: number } | null = null;
          if (idx > 0) {
            const prev = (runsRaw[idx - 1].verdict_summary ?? {}) as VerdictSummary;
            delta = {
              fixed: Math.max(0, (prev.fail ?? 0) - fail),
              new_fails: Math.max(0, fail - (prev.fail ?? 0)),
            };
          }
          return { ...r, run_number: idx + 1, pass, fail, na, delta };
        });
        return res.status(200).json({ report: reportRes.data, runs: runsWithMeta });
      }

      case "list_reports": {
        const lrUser = await resolveSessionUser(req, supabaseUrl, supabaseKey);
        if (!lrUser) return res.status(401).json({ error: "Authorization header required" });
        const lrApiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!lrApiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const lrBody = (req.body ?? {}) as { status?: string; target?: string; limit?: number };
        const lrLimit = Math.min(Number(lrBody.limit ?? req.query.limit ?? 50), 200);
        const lrStatus = (lrBody.status ?? req.query.status ?? "") as string;
        const lrTarget = (lrBody.target ?? req.query.target ?? "") as string;
        let lrQ = supabase
          .from("mc_testpass_reports")
          .select("*")
          .eq("api_key_hash", lrApiKeyHash)
          .order("created_at", { ascending: false })
          .limit(lrLimit);
        if (lrStatus) lrQ = lrQ.eq("status", lrStatus);
        if (lrTarget) lrQ = lrQ.ilike("target", `%${lrTarget}%`);
        const { data: reports, error: lrErr } = await lrQ;
        if (lrErr) throw lrErr;
        const reportsWithMeta = await Promise.all(
          (reports ?? []).map(async (rpt) => {
            const runSeq = (rpt.run_sequence as string[] | null) ?? [];
            const runCount = runSeq.length;
            let latestRun: Record<string, unknown> | null = null;
            if (runCount > 0) {
              const lastRunId = runSeq[runCount - 1];
              const { data: lr } = await supabase
                .from("testpass_runs")
                .select("id, status, verdict_summary, started_at, completed_at")
                .eq("id", lastRunId)
                .maybeSingle();
              latestRun = lr as Record<string, unknown> | null;
            }
            return { report: rpt, latest_run: latestRun, run_count: runCount };
          })
        );
        return res.status(200).json({ reports: reportsWithMeta });
      }

      case "abandon_report": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const arUser = await resolveSessionUser(req, supabaseUrl, supabaseKey);
        if (!arUser) return res.status(401).json({ error: "Authorization header required" });
        const arApiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!arApiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const arReportId = (req.body?.report_id ?? "") as string;
        if (!arReportId) return res.status(400).json({ error: "report_id required" });
        const { data: arData, error: arErr } = await supabase
          .from("mc_testpass_reports")
          .update({ status: "abandoned", closed_at: new Date().toISOString() })
          .eq("id", arReportId)
          .eq("api_key_hash", arApiKeyHash)
          .select("*")
          .maybeSingle();
        if (arErr) throw arErr;
        if (!arData) return res.status(404).json({ error: "Report not found" });
        return res.status(200).json({ report: arData });
      }

      // ─── Signals Phase 1: notifications hub ───────────────────────────────

      case "list_signals": {
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const body = (req.body ?? {}) as { limit?: number; tool?: string; unread_only?: boolean };
        const limit = Math.min(Number(body.limit ?? req.query.limit ?? 50), 200);
        const unreadOnly = body.unread_only === true || req.query.unread_only === "1";
        const toolFilter = (body.tool ?? req.query.tool ?? "") as string;
        let q = supabase
          .from("mc_signals")
          .select("id, tool, action, severity, summary, deep_link, payload, created_at, read_at, read_via, read_by_agent_id")
          .eq("api_key_hash", apiKeyHash)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (toolFilter) q = q.eq("tool", toolFilter);
        if (unreadOnly) q = q.is("read_at", null);
        const { data, error } = await q;
        if (error) throw error;
        const signals = (data ?? []).map((signal) => {
          const payload = (signal.payload ?? {}) as Record<string, unknown>;
          const policyLabel =
            signal.tool === "fishbowl" && payload.policy_label === "warning"
              ? "warning"
              : signal.severity;
          return {
            ...signal,
            policy_label: policyLabel,
            display_severity: policyLabel,
          };
        });
        return res.status(200).json({ signals });
      }

      case "mark_signal_read": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const { signal_id, read_via, read_by_agent_id } = (req.body ?? {}) as {
          signal_id?: string;
          read_via?: string;
          read_by_agent_id?: string;
        };
        if (!signal_id) return res.status(400).json({ error: "signal_id required" });
        const patch: Record<string, string> = {
          read_at: new Date().toISOString(),
          read_via: read_via ?? "ui",
        };
        if (typeof read_by_agent_id === "string" && read_by_agent_id.length > 0) {
          patch.read_by_agent_id = read_by_agent_id;
        }
        const { error } = await supabase
          .from("mc_signals")
          .update(patch)
          .eq("id", signal_id)
          .eq("api_key_hash", apiKeyHash);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      case "mark_many_signals_read": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const { signal_ids, read_via, read_by_agent_id } = (req.body ?? {}) as {
          signal_ids?: string[];
          read_via?: string;
          read_by_agent_id?: string;
        };
        const ids = Array.isArray(signal_ids)
          ? signal_ids.filter((id): id is string => typeof id === "string" && id.length > 0)
          : [];
        if (ids.length === 0) return res.status(400).json({ error: "signal_ids required" });
        const patch: Record<string, string> = {
          read_at: new Date().toISOString(),
          read_via: read_via ?? "agent",
        };
        if (typeof read_by_agent_id === "string" && read_by_agent_id.length > 0) {
          patch.read_by_agent_id = read_by_agent_id;
        }
        const { data, error } = await supabase
          .from("mc_signals")
          .update(patch)
          .eq("api_key_hash", apiKeyHash)
          .is("read_at", null)
          .in("id", ids)
          .select("id");
        if (error) throw error;
        return res.status(200).json({
          success: true,
          updated_count: data?.length ?? 0,
          signal_ids: data?.map((row) => row.id) ?? [],
        });
      }

      case "mark_all_read": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const { read_via, read_by_agent_id } = (req.body ?? {}) as {
          read_via?: string;
          read_by_agent_id?: string;
        };
        const patch: Record<string, string> = {
          read_at: new Date().toISOString(),
          read_via: read_via ?? "dismiss",
        };
        if (typeof read_by_agent_id === "string" && read_by_agent_id.length > 0) {
          patch.read_by_agent_id = read_by_agent_id;
        }
        const { data, error } = await supabase
          .from("mc_signals")
          .update(patch)
          .eq("api_key_hash", apiKeyHash)
          .is("read_at", null)
          .select("id");
        if (error) throw error;
        return res.status(200).json({ updated: data?.length ?? 0 });
      }

      case "get_signal_preferences": {
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const { data, error } = await supabase
          .from("mc_signal_preferences")
          .select("*")
          .eq("api_key_hash", apiKeyHash)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          return res.status(200).json({
            preferences: {
              api_key_hash: apiKeyHash,
              email_enabled: false,
              email_address: null,
              phone_push_enabled: true,
              telegram_enabled: false,
              telegram_chat_id: null,
              quiet_hours_start: null,
              quiet_hours_end: null,
              min_severity: "info",
              per_tool_overrides: {},
            },
          });
        }
        return res.status(200).json({ preferences: data });
      }

      case "update_signal_preferences": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });
        const body = (req.body ?? {}) as Record<string, unknown>;
        const allowed = [
          "email_enabled",
          "email_address",
          "phone_push_enabled",
          "telegram_enabled",
          "telegram_chat_id",
          "quiet_hours_start",
          "quiet_hours_end",
          "min_severity",
          "per_tool_overrides",
        ];
        const patch: Record<string, unknown> = {
          api_key_hash: apiKeyHash,
          updated_at: new Date().toISOString(),
        };
        for (const k of allowed) {
          if (k in body) patch[k] = body[k];
        }
        const { data, error } = await supabase
          .from("mc_signal_preferences")
          .upsert(patch, { onConflict: "api_key_hash" })
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json({ preferences: data });
      }

      case "check_signals": {
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

        const { count: totalUnread } = await supabase
          .from("mc_signals")
          .select("id", { count: "exact", head: true })
          .eq("api_key_hash", apiKeyHash)
          .is("read_at", null);

        const { data: rows, error: fetchErr } = await supabase
          .from("mc_signals")
          .select("id, tool, action, severity, summary, deep_link, payload, created_at")
          .eq("api_key_hash", apiKeyHash)
          .is("read_at", null)
          .order("created_at", { ascending: false })
          .limit(10);
        if (fetchErr) throw fetchErr;

        const signals = (rows ?? []).map((signal) => {
          const payload = (signal.payload ?? {}) as Record<string, unknown>;
          const policyLabel =
            signal.tool === "fishbowl" && payload.policy_label === "warning"
              ? "warning"
              : signal.severity;
          return {
            ...signal,
            policy_label: policyLabel,
            display_severity: policyLabel,
          };
        });

        const bySeverity: Record<string, number> = { critical: 0, action_needed: 0, warning: 0, info: 0 };
        const byTool: Record<string, number> = {};
        for (const s of signals) {
          if (s.display_severity in bySeverity) bySeverity[s.display_severity]++;
          byTool[s.tool] = (byTool[s.tool] ?? 0) + 1;
        }
        const parts: string[] = [];
        if (bySeverity.critical > 0) parts.push(`${bySeverity.critical} critical`);
        if (bySeverity.action_needed > 0) parts.push(`${bySeverity.action_needed} needing action`);
        if (bySeverity.warning > 0) parts.push(`${bySeverity.warning} warning`);
        if (bySeverity.info > 0) parts.push(`${bySeverity.info} info`);
        const toolList = Object.entries(byTool)
          .map(([t, c]) => `${c} from ${t}`)
          .join(", ");
        const narrative_hint =
          signals.length === 0
            ? "No new signals. User is caught up."
            : `${signals.length} new signal${signals.length === 1 ? "" : "s"}${parts.length ? ` (${parts.join(", ")})` : ""}${toolList ? `: ${toolList}` : ""}.`;

        return res.status(200).json({
          unread_count: totalUnread ?? signals.length,
          signals,
          narrative_hint,
        });
      }

      // ─── Fishbowl Phase 1: agent group chat ───────────────────────────────

      case "fishbowl_admin_claim": {
        // Web-UI-only action. Auto-creates (or refreshes) a profile for the
        // signed-in human admin so they can post into the Fishbowl as
        // themselves rather than just listening in. Requires a Supabase
        // session JWT, never accepts a raw api_key. The admin profile is
        // marked with user_agent_hint='admin-ui' so AI agents cannot
        // impersonate the human posting path (see fishbowl_post).
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });

        const sessionUser = await resolveSessionUser(req, supabaseUrl, supabaseKey);
        if (!sessionUser) {
          return res.status(401).json({
            error: "Sign in required",
            how_to_fix: "This endpoint requires the Supabase session JWT used by the UnClick admin UI. AI agents should use set_my_emoji instead.",
          });
        }
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) {
          return res.status(401).json({
            error: "No API key provisioned for this user",
            how_to_fix: "Create your UnClick API key first via the setup wizard.",
          });
        }

        const body = (req.body ?? {}) as { emoji?: string | null; display_name?: string | null };
        const emoji = (body.emoji ?? "😎").toString().trim() || "😎";
        if (Array.from(emoji).length > 8) return res.status(400).json({ error: "emoji must be at most 8 characters" });

        // Default display name: the email's local part if available, else 'You'.
        let displayName: string;
        if (body.display_name != null) {
          const dn = String(body.display_name).trim();
          if (dn.length < 1) return res.status(400).json({ error: "display_name must be at least 1 character" });
          if (dn.length > 64) return res.status(400).json({ error: "display_name must be at most 64 characters" });
          displayName = dn;
        } else if (sessionUser.email) {
          const local = sessionUser.email.split("@")[0] ?? "You";
          displayName = local.length > 0 && local.length <= 64 ? local : "You";
        } else {
          displayName = "You";
        }

        const agentId = `human-${sessionUser.id}`;
        const nowIso = new Date().toISOString();
        const { data, error } = await supabase
          .from("mc_fishbowl_profiles")
          .upsert(
            {
              api_key_hash: apiKeyHash,
              agent_id: agentId,
              emoji,
              display_name: displayName,
              user_agent_hint: "admin-ui",
              last_seen_at: nowIso,
            },
            { onConflict: "api_key_hash,agent_id" },
          )
          .select("id, agent_id, emoji, display_name, user_agent_hint, created_at, last_seen_at, current_status, current_status_updated_at, next_checkin_at")
          .single();
        if (error) throw error;
        return res.status(200).json({ profile: data });
      }

      case "fishbowl_set_emoji": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) {
          return res.status(401).json({
            error: "Authorization header required",
            how_to_fix: "Pass your UnClick API key as 'Authorization: Bearer <api_key>'. Run the UnClick setup wizard if you do not have one.",
          });
        }
        const body = (req.body ?? {}) as {
          emoji?: string;
          display_name?: string | null;
          user_agent_hint?: string | null;
          agent_id?: string | null;
        };

        const agentId = (body.agent_id ?? "").toString().trim();
        if (!agentId) {
          return res.status(400).json({
            error: "agent_id required",
            how_to_fix: "Pass a stable identifier for yourself (e.g. 'claude-desktop-bailey-lenovo'). Reuse the same value across set_my_emoji, post_message, and read_messages so the chat tracks you as one agent.",
          });
        }
        if (agentId.length > 128) return res.status(400).json({ error: "agent_id must be at most 128 characters" });

        const emoji = (body.emoji ?? "").toString().trim();
        if (!emoji) return res.status(400).json({ error: "emoji required" });
        if (Array.from(emoji).length > 8) return res.status(400).json({ error: "emoji must be at most 8 characters" });

        let displayName: string | null = null;
        if (body.display_name != null) {
          const dn = String(body.display_name);
          if (dn.length < 1) return res.status(400).json({ error: "display_name must be at least 1 character" });
          if (dn.length > 64) return res.status(400).json({ error: "display_name must be at most 64 characters" });
          displayName = dn;
        }

        const userAgentHint = (body.user_agent_hint ?? "").toString().trim() || null;
        if (userAgentHint !== null && userAgentHint.length > 128) {
          return res.status(400).json({ error: "user_agent_hint must be at most 128 characters" });
        }

        const nowIso = new Date().toISOString();
        const { data, error } = await supabase
          .from("mc_fishbowl_profiles")
          .upsert(
            {
              api_key_hash: apiKeyHash,
              agent_id: agentId,
              emoji,
              display_name: displayName,
              user_agent_hint: userAgentHint,
              last_seen_at: nowIso,
            },
            { onConflict: "api_key_hash,agent_id" },
          )
          .select("id, agent_id, emoji, display_name, user_agent_hint, created_at, last_seen_at, current_status, current_status_updated_at, next_checkin_at")
          .single();
        if (error) throw error;
        return res.status(200).json({ profile: data });
      }

      case "fishbowl_set_status": {
        // Updates the agent's free-form Now Playing line. The row must already
        // exist (set_my_emoji creates it). An empty string clears the status
        // back to idle. Always bumps last_seen_at so the status timestamp and
        // the activity timestamp stay coherent. A status pulse also clears any
        // prior dead-man timer unless the caller sets next_checkin_at again.
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) {
          return res.status(401).json({
            error: "Authorization header required",
            how_to_fix: "Pass your UnClick API key as 'Authorization: Bearer <api_key>'. Run the UnClick setup wizard if you do not have one.",
          });
        }
        const body = (req.body ?? {}) as {
          agent_id?: string | null;
          status?: string | null;
          next_checkin_at?: string | null;
        };

        const agentId = (body.agent_id ?? "").toString().trim();
        if (!agentId) {
          return res.status(400).json({
            error: "agent_id required",
            how_to_fix: "Pass the same stable identifier you used for set_my_emoji so the status updates the right profile.",
          });
        }
        if (agentId.length > 128) return res.status(400).json({ error: "agent_id must be at most 128 characters" });

        // Status is required by the schema but an empty string is a valid
        // "clear me" value, so we only validate length and reject non-strings.
        if (body.status == null || typeof body.status !== "string") {
          return res.status(400).json({ error: "status required (string; empty string clears)" });
        }
        const statusRaw = body.status;
        if (statusRaw.length > 200) return res.status(400).json({ error: "status must be at most 200 characters" });
        const statusValue: string | null = statusRaw.trim().length === 0 ? null : statusRaw;

        // next_checkin_at (optional): ISO 8601 timestamp OR a relative
        // duration like '30m', '2h', '1d', '90s'. Empty string or null clears
        // the field. Stored as an absolute timestamp so the watcher can
        // compare directly against last_seen_at.
        const RELATIVE_RE = /^(\d+)\s*([smhd])$/i;
        const MAX_FUTURE_MS = 30 * 86_400_000;
        const nextCheckinProvided = Object.prototype.hasOwnProperty.call(body, "next_checkin_at");
        let nextCheckinUpdate: { apply: boolean; iso: string | null } = { apply: false, iso: null };
        if (nextCheckinProvided) {
          const raw = body.next_checkin_at;
          if (raw == null || (typeof raw === "string" && raw.trim() === "")) {
            nextCheckinUpdate = { apply: true, iso: null };
          } else if (typeof raw !== "string") {
            return res.status(400).json({
              error: "next_checkin_at must be a string (ISO 8601 timestamp or relative duration like '30m', '2h')",
            });
          } else {
            const trimmed = raw.trim();
            const m = trimmed.match(RELATIVE_RE);
            if (m) {
              const qty = parseInt(m[1], 10);
              const unit = m[2].toLowerCase();
              const factor = unit === "s" ? 1000 : unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
              const ms = qty * factor;
              if (!Number.isFinite(ms) || ms <= 0 || ms > MAX_FUTURE_MS) {
                return res.status(400).json({ error: "next_checkin_at duration must be > 0 and <= 30d" });
              }
              nextCheckinUpdate = { apply: true, iso: new Date(Date.now() + ms).toISOString() };
            } else {
              const t = Date.parse(trimmed);
              if (Number.isNaN(t)) {
                return res.status(400).json({
                  error: "next_checkin_at must be ISO 8601 timestamp or relative duration like '30m', '2h'",
                });
              }
              nextCheckinUpdate = { apply: true, iso: new Date(t).toISOString() };
            }
          }
        }

        const now = new Date();
        const nowIso = now.toISOString();
        const updatePayload: Record<string, unknown> = {
          current_status: statusValue,
          current_status_updated_at: nowIso,
          last_seen_at: nowIso,
        };
        updatePayload.next_checkin_at = nextCheckinUpdate.apply ? nextCheckinUpdate.iso : null;
        const { data, error } = await supabase
          .from("mc_fishbowl_profiles")
          .update(updatePayload)
          .eq("api_key_hash", apiKeyHash)
          .eq("agent_id", agentId)
          .select("id, agent_id, emoji, display_name, user_agent_hint, created_at, last_seen_at, current_status, current_status_updated_at, next_checkin_at")
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          return res.status(404).json({
            error: "profile not found",
            how_to_fix: "Call set_my_emoji first to register this agent before setting a status.",
          });
        }
        return res.status(200).json({ profile: data });
      }

      case "autopilot_record_event": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) {
          return res.status(401).json({
            error: "Authorization header required",
            how_to_fix: "Pass your UnClick API key as 'Authorization: Bearer <api_key>'.",
          });
        }
        const body = (req.body ?? {}) as {
          event_type?: string | null;
          actor_agent_id?: string | null;
          ref_kind?: string | null;
          ref_id?: string | null;
          payload?: Record<string, unknown> | null;
        };
        const actorAgentId = String(body.actor_agent_id ?? "").trim();
        const refId = String(body.ref_id ?? "").trim();
        if (!actorAgentId) return res.status(400).json({ error: "actor_agent_id required" });
        if (!refId) return res.status(400).json({ error: "ref_id required" });
        if (actorAgentId.length > 128) return res.status(400).json({ error: "actor_agent_id must be at most 128 characters" });
        if (refId.length > 160) return res.status(400).json({ error: "ref_id must be at most 160 characters" });
        if (body.payload != null && !isRecord(body.payload)) {
          return res.status(400).json({ error: "payload must be an object" });
        }

        const result = await recordAutopilotEvent(supabase, {
          apiKeyHash,
          eventType: String(body.event_type ?? ""),
          actorAgentId,
          refKind: String(body.ref_kind ?? ""),
          refId,
          payload: body.payload ?? {},
        });
        if (!result.ok) return res.status(400).json({ error: result.error });
        return res.status(200).json({ ok: true });
      }

      case "fishbowl_post": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) {
          return res.status(401).json({
            error: "Authorization header required",
            how_to_fix: "Pass your UnClick API key as 'Authorization: Bearer <api_key>'. Run the UnClick setup wizard if you do not have one.",
          });
        }
        const body = (req.body ?? {}) as {
          text?: string;
          tags?: string[] | null;
          recipients?: string[] | null;
          user_agent_hint?: string | null;
          agent_id?: string | null;
          thread_id?: string | null;
        };

        const agentId = (body.agent_id ?? "").toString().trim();
        if (!agentId) {
          return res.status(400).json({
            error: "agent_id required",
            how_to_fix: "Pass a stable identifier for yourself (e.g. 'claude-desktop-bailey-lenovo'). Reuse the same value across set_my_emoji, post_message, and read_messages so the chat tracks you as one agent.",
          });
        }
        if (agentId.length > 128) return res.status(400).json({ error: "agent_id must be at most 128 characters" });

        const text = normalizeFishbowlText((body.text ?? "").toString().trim());
        if (!text) return res.status(400).json({ error: "text required" });
        if (text.length > 2000) return res.status(400).json({ error: "text must be at most 2000 characters" });

        // thread_id (optional): must be a uuid of an existing message in this
        // tenant's fishbowl. We resolve the existence check below, after we
        // know the tenant (apiKeyHash) is valid.
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        let threadId: string | null = null;
        if (body.thread_id != null && body.thread_id !== "") {
          const candidate = String(body.thread_id).trim();
          if (!UUID_RE.test(candidate)) {
            return res.status(400).json({
              error: "thread_id must be a valid uuid of an existing message in your fishbowl",
            });
          }
          const { data: parent } = await supabase
            .from("mc_fishbowl_messages")
            .select("id")
            .eq("api_key_hash", apiKeyHash)
            .eq("id", candidate)
            .maybeSingle();
          if (!parent) {
            return res.status(400).json({
              error: "thread_id must be a valid uuid of an existing message in your fishbowl",
            });
          }
          threadId = candidate;
        }

        const userAgentHint = (body.user_agent_hint ?? "").toString().trim() || null;
        if (userAgentHint !== null && userAgentHint.length > 128) {
          return res.status(400).json({ error: "user_agent_hint must be at most 128 characters" });
        }

        let tags: string[] | null = null;
        if (body.tags != null) {
          if (!Array.isArray(body.tags)) return res.status(400).json({ error: "tags must be an array of strings" });
          if (body.tags.length > 10) return res.status(400).json({ error: "tags must be at most 10 items" });
          for (const t of body.tags) {
            if (typeof t !== "string" || t.length < 1 || t.length > 32) {
              return res.status(400).json({ error: "each tag must be 1 to 32 characters" });
            }
          }
          tags = body.tags;
        }

        let recipients: string[] = ["all"];
        if (body.recipients != null) {
          if (!Array.isArray(body.recipients)) return res.status(400).json({ error: "recipients must be an array of strings" });
          if (body.recipients.length > 10) return res.status(400).json({ error: "recipients must be at most 10 items" });
          for (const r of body.recipients) {
            if (typeof r !== "string") return res.status(400).json({ error: "each recipient must be a string" });
            const rLen = Array.from(r).length;
            if (rLen < 1 || rLen > 8) return res.status(400).json({ error: "each recipient must be 1 to 8 characters" });
          }
          if (body.recipients.length > 0) recipients = body.recipients;
        }

        // Look up the agent's profile so we can decorate the message with its
        // emoji and display name. Posting without registering first still
        // works, but the message will show a placeholder emoji.
        const { data: profile } = await supabase
          .from("mc_fishbowl_profiles")
          .select("emoji, display_name, user_agent_hint")
          .eq("api_key_hash", apiKeyHash)
          .eq("agent_id", agentId)
          .maybeSingle();

        // Guard against an AI agent impersonating the human admin by
        // posting under a 'human-*' agent_id. The human profile is only
        // ever created by fishbowl_admin_claim, which sets
        // user_agent_hint='admin-ui'. If a 'human-*' post arrives without
        // a matching admin-ui profile, reject it.
        if (agentId.startsWith("human-") && profile?.user_agent_hint !== "admin-ui") {
          return res.status(403).json({
            error: "human-* agent_id is reserved for the admin UI",
            how_to_fix: "AI agents should pick a different agent_id (for example 'claude-desktop-bailey-lenovo'). The human posting path is only available to the signed-in admin in the UnClick web UI.",
          });
        }

        // Get-or-create the default room for this tenant.
        const { data: existingRoom } = await supabase
          .from("mc_fishbowl_rooms")
          .select("id")
          .eq("api_key_hash", apiKeyHash)
          .eq("slug", "default")
          .maybeSingle();
        let roomId = existingRoom?.id as string | undefined;
        if (!roomId) {
          const { data: newRoom, error: roomErr } = await supabase
            .from("mc_fishbowl_rooms")
            .insert({ api_key_hash: apiKeyHash, slug: "default", name: "Boardroom" })
            .select("id")
            .single();
          if (roomErr) throw roomErr;
          roomId = newRoom.id;
        }

        const { data: inserted, error: insertErr } = await supabase
          .from("mc_fishbowl_messages")
          .insert({
            api_key_hash: apiKeyHash,
            room_id: roomId,
            author_emoji: profile?.emoji ?? "🤖",
            author_name: profile?.display_name ?? null,
            author_agent_id: agentId,
            recipients,
            text,
            tags,
            thread_id: threadId,
          })
          .select("id, author_emoji, author_name, author_agent_id, recipients, text, tags, thread_id, created_at")
          .single();
        if (insertErr) throw insertErr;

        const ledgerEvent = planFishbowlPostLedgerEvent({
          actorAgentId: agentId,
          messageId: inserted.id,
          threadId,
          text,
          tags,
          recipients,
        });
        if (ledgerEvent) {
          const ledgerResult = await recordAutopilotEvent(supabase, {
            ...ledgerEvent,
            apiKeyHash,
          });
          if (!ledgerResult.ok) {
            console.warn("[fishbowl_post] autopilot ledger write skipped:", ledgerResult.error);
          }
        }

        // Bump post-side presence so active authors do not look stale on Now Playing.
        // Posting is a live pulse, so it refreshes status and clears any prior
        // dead-man timer even when the worker skipped a separate set_status call.
        const postedAtIso = new Date().toISOString();
        const statusFromPost = statusFromFishbowlPost(text);
        const profileUpdate: Record<string, unknown> = {
          last_seen_at: postedAtIso,
          current_status_updated_at: postedAtIso,
          next_checkin_at: null,
        };
        if (statusFromPost !== null) profileUpdate.current_status = statusFromPost;
        await supabase
          .from("mc_fishbowl_profiles")
          .update(profileUpdate)
          .eq("api_key_hash", apiKeyHash)
          .eq("agent_id", agentId);

        // Wake-up plumbing: publish a Signal so existing dispatch (phone push,
        // email, telegram per mc_signal_preferences) can wake the human if a
        // message warrants it. Fire-and-forget so a Signals failure never
        // blocks the post response.
        void (async () => {
          try {
            const recipientList = inserted.recipients ?? [];
            const tagList = inserted.tags ?? [];
            const tagSet = new Set(tagList);
            const isBlocker = tagSet.has("blocker") || tagSet.has("tripwire");
            const needsDoing = tagSet.has("needs-doing");
            const broadcastsAll = recipientList.includes("all");

            // Discover this tenant's human admin profiles so we can match
            // recipients against the human's actual emoji and agent_id, not
            // just the canonical 😎 fallback.
            const { data: profileRows } = await supabase
              .from("mc_fishbowl_profiles")
              .select("agent_id, emoji, user_agent_hint")
              .eq("api_key_hash", apiKeyHash);
            const humanEmojis = new Set<string>(["😎"]);
            const humanAgentIds = new Set<string>();
            for (const profileRow of profileRows ?? []) {
              if (profileRow?.user_agent_hint !== "admin-ui") continue;
              if (profileRow?.emoji) humanEmojis.add(profileRow.emoji);
              if (profileRow?.agent_id) humanAgentIds.add(profileRow.agent_id);
            }

            const targetsHuman = recipientList.some(
              (r: string) =>
                humanEmojis.has(r) ||
                humanAgentIds.has(r) ||
                (typeof r === "string" && r.startsWith("human-")),
            );

            let severity: "info" | "action_needed" | "critical" = "info";
            if (targetsHuman) severity = "action_needed";
            else if (needsDoing) severity = "action_needed";
            else if (broadcastsAll && isBlocker) severity = "action_needed";
            else if (isBlocker) severity = "action_needed";

            const summarySource = inserted.text ?? text;
            const summary =
              summarySource.length > 200 ? `${summarySource.slice(0, 197)}...` : summarySource;

            const handoffPlans = planFishbowlMessageHandoffs({
              messageId: inserted.id,
              text: summarySource,
              tags: tagList,
              recipients: recipientList,
              authorAgentId: agentId,
              recipientProfiles: (profileRows ?? []).map((profileRow) => ({
                agentId: profileRow.agent_id,
                emoji: profileRow.emoji,
                userAgentHint: profileRow.user_agent_hint,
              })),
            });
            for (const handoffPlan of handoffPlans) {
              const dispatchId = createDispatchId({
                source: handoffPlan.source,
                targetAgentId: handoffPlan.targetAgentId,
                taskRef: handoffPlan.taskRef,
              });
              const now = new Date();
              const { data: dispatchRows, error: upsertErr } = await supabase
                .from("mc_agent_dispatches")
                .upsert(
                  buildFishbowlMessageHandoffDispatchRow({
                    apiKeyHash,
                    dispatchId,
                    plan: handoffPlan,
                    now,
                  }),
                  { onConflict: "api_key_hash,dispatch_id" },
                )
                .select("dispatch_id,status,lease_owner,lease_expires_at");
              if (upsertErr) throw upsertErr;

              const dispatchRow = dispatchRows?.[0];
              if (
                !dispatchRow ||
                dispatchRow.status !== "leased" ||
                dispatchRow.lease_owner !== handoffPlan.targetAgentId ||
                !dispatchRow.lease_expires_at
              ) {
                throw new Error("message handoff dispatch lease was not persisted");
              }
            }

            await supabase.from("mc_signals").insert({
              api_key_hash: apiKeyHash,
              tool: "fishbowl",
              action: "message_posted",
              severity,
              summary,
              deep_link: `/admin/boardroom#msg-${inserted.id}`,
              payload: {
                author_emoji: inserted.author_emoji,
                author_agent_id: inserted.author_agent_id,
                recipients: recipientList,
                tags: tagList,
                message_id: inserted.id,
                policy_label: needsDoing ? "warning" : severity,
              },
            });
          } catch (publishErr) {
            console.error(
              "[fishbowl_post] async wake plumbing failed:",
              (publishErr as Error).message,
            );
          }
        })();

        return res.status(200).json({ message: inserted });
      }

      case "fishbowl_read": {
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) {
          return res.status(401).json({
            error: "Authorization header required",
            how_to_fix: "Pass your UnClick API key as 'Authorization: Bearer <api_key>'. Run the UnClick setup wizard if you do not have one.",
          });
        }
        const body = (req.body ?? {}) as { since?: string; limit?: number; agent_id?: string | null };

        // Read is a passive listen: posting and emoji-claim still require
        // agent_id for attribution, but the human admin viewer in the web UI
        // (and any tool that just wants to scan the chat) has no agent to
        // identify as. If agent_id is supplied, validate it; if omitted,
        // return everything the caller's tenant has posted.
        const agentId = (body.agent_id ?? req.query.agent_id ?? "").toString().trim();
        if (agentId && agentId.length > 128) {
          return res.status(400).json({ error: "agent_id must be at most 128 characters" });
        }

        const sinceParam = (body.since ?? req.query.since ?? "") as string;
        const limit = Math.min(Math.max(Number(body.limit ?? req.query.limit ?? 20) || 20, 1), 100);

        const { data: room } = await supabase
          .from("mc_fishbowl_rooms")
          .select("id, slug, name")
          .eq("api_key_hash", apiKeyHash)
          .eq("slug", "default")
          .maybeSingle();

        if (!room) {
          // No room yet means no posts yet. Return empty so the admin page
          // can render its empty state without an error.
          return res.status(200).json({ room: null, messages: [], profiles: [] });
        }

        let q = supabase
          .from("mc_fishbowl_messages")
          .select("id, author_emoji, author_name, author_agent_id, recipients, text, tags, thread_id, created_at")
          .eq("api_key_hash", apiKeyHash)
          .eq("room_id", room.id)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (sinceParam) q = q.gt("created_at", sinceParam);

        const [{ data: messages, error: msgErr }, { data: profiles, error: profErr }] = await Promise.all([
          q,
          supabase
            .from("mc_fishbowl_profiles")
            .select("agent_id, emoji, display_name, user_agent_hint, created_at, last_seen_at, current_status, current_status_updated_at, next_checkin_at")
            .eq("api_key_hash", apiKeyHash)
            .order("last_seen_at", { ascending: false, nullsFirst: false }),
        ]);
        if (msgErr) throw msgErr;
        if (profErr) throw profErr;

        // Auto-touch the caller's last_seen_at so a polling agent stays "active"
        // on the Now Playing strip without needing to post. Best-effort: skipped
        // when no agent_id is supplied (e.g. the human admin viewer), and never
        // surfaced as an error if the row does not exist yet.
        if (agentId) {
          await supabase
            .from("mc_fishbowl_profiles")
            .update({ last_seen_at: new Date().toISOString() })
            .eq("api_key_hash", apiKeyHash)
            .eq("agent_id", agentId);
        }

        return res.status(200).json({
          room,
          messages: messages ?? [],
          profiles: profiles ?? [],
        });
      }

      case "orchestrator_context_read": {
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) {
          return res.status(401).json({
            error: "Authorization header required",
            how_to_fix: "Pass your UnClick API key as 'Authorization: Bearer <api_key>'. Run the UnClick setup wizard if you do not have one.",
          });
        }

        const body = (req.body ?? {}) as {
          compact?: boolean | string;
          include_raw?: boolean | string;
          includeRaw?: boolean | string;
          limit?: number;
          max_summaries?: number;
          maxSummaries?: number;
          q?: string;
        };
        const parseBooleanParam = (value: unknown, fallback: boolean): boolean => {
          if (typeof value === "boolean") return value;
          if (typeof value === "string") {
            const clean = value.trim().toLowerCase();
            if (clean === "true") return true;
            if (clean === "false") return false;
          }
          return fallback;
        };
        const rawSearch =
          typeof body.q === "string"
            ? body.q
            : typeof req.query.q === "string"
              ? req.query.q
              : "";
        const searchQuery = rawSearch.replace(/\s+/g, " ").trim().slice(0, 100);
        const compact = parseBooleanParam(body.compact ?? req.query.compact, true);
        const includeRaw = parseBooleanParam(body.include_raw ?? body.includeRaw ?? req.query.include_raw ?? req.query.includeRaw, false);
        const rawMaxSummaries = body.max_summaries ?? body.maxSummaries ?? req.query.max_summaries ?? req.query.maxSummaries;
        const requestedMaxSummaries = Number(rawMaxSummaries ?? (compact ? 20 : 36));
        const maxSummaries = Math.min(
          Math.max(Number.isFinite(requestedMaxSummaries) ? Math.floor(requestedMaxSummaries) : compact ? 20 : 36, 1),
          500,
        );
        const searchPattern = searchQuery ? `%${searchQuery.replace(/[%_\\]/g, "\\$&")}%` : "";
        const searchUuid = searchQuery.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? null;
        const turnSearchFilter = searchPattern
          ? [
              `content.ilike.${searchPattern}`,
              `session_id.ilike.${searchPattern}`,
              ...(searchUuid ? [`id.eq.${searchUuid}`] : []),
            ].join(",")
          : "";
        const defaultLimit = compact ? Math.max(maxSummaries, 20) : 80;
        const limit = Math.min(Math.max(Number(body.limit ?? req.query.limit ?? defaultLimit) || defaultLimit, 20), 500);
        const smallerLimit = searchQuery ? limit : Math.min(limit, 300);
        const todoSelect =
          "id, title, description, status, priority, created_by_agent_id, assigned_to_agent_id, source_idea_id, created_at, updated_at, completed_at";

        let messagesQuery = supabase
          .from("mc_fishbowl_messages")
          .select("id, author_emoji, author_name, author_agent_id, recipients, text, tags, thread_id, created_at")
          .eq("api_key_hash", apiKeyHash)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (searchPattern) messagesQuery = messagesQuery.ilike("text", searchPattern);

        let todosQuery = supabase
          .from("mc_fishbowl_todos")
          .select(todoSelect)
          .eq("api_key_hash", apiKeyHash)
          .neq("status", "dropped")
          .order("updated_at", { ascending: false })
          .limit(smallerLimit);
        if (searchPattern) {
          todosQuery = todosQuery.or(`title.ilike.${searchPattern},description.ilike.${searchPattern}`);
        }
        const activeTodosQuery = supabase
          .from("mc_fishbowl_todos")
          .select(todoSelect)
          .eq("api_key_hash", apiKeyHash)
          .in("status", ["open", "in_progress"])
          .order("updated_at", { ascending: false })
          .limit(300);

        let commentsQuery = supabase
          .from("mc_fishbowl_comments")
          .select("id, target_kind, target_id, author_agent_id, text, created_at")
          .eq("api_key_hash", apiKeyHash)
          .order("created_at", { ascending: false })
          .limit(smallerLimit);
        if (searchPattern) commentsQuery = commentsQuery.ilike("text", searchPattern);

        let signalsQuery = supabase
          .from("mc_signals")
          .select("id, tool, action, severity, summary, deep_link, payload, created_at, read_at")
          .eq("api_key_hash", apiKeyHash)
          .order("created_at", { ascending: false })
          .limit(smallerLimit);
        if (searchPattern) signalsQuery = signalsQuery.ilike("summary", searchPattern);

        let sessionsQuery = supabase
          .from("mc_session_summaries")
          .select("id, session_id, platform, summary, decisions, open_loops, topics, created_at")
          .eq("api_key_hash", apiKeyHash)
          .order("created_at", { ascending: false })
          .limit(searchQuery ? 40 : 24);
        if (searchPattern) sessionsQuery = sessionsQuery.ilike("summary", searchPattern);

        let conversationTurnsQuery = supabase
          .from("mc_conversation_log")
          .select("id, session_id, role, content, created_at")
          .eq("api_key_hash", apiKeyHash)
          .order("created_at", { ascending: false })
          .limit(smallerLimit);
        if (turnSearchFilter) conversationTurnsQuery = conversationTurnsQuery.or(turnSearchFilter);

        let chatMessagesQuery = supabase
          .from("chat_messages")
          .select("id, session_id, role, content, created_at")
          .eq("api_key_hash", apiKeyHash)
          .order("created_at", { ascending: false })
          .limit(smallerLimit);
        if (turnSearchFilter) chatMessagesQuery = chatMessagesQuery.or(turnSearchFilter);

        const [
          profilesResult,
          messagesResult,
          todosResult,
          activeTodosResult,
          commentsResult,
          dispatchesResult,
          signalsResult,
          sessionsResult,
          libraryResult,
          businessContextResult,
          conversationTurnsResult,
          chatMessagesResult,
        ] = await Promise.all([
          supabase
            .from("mc_fishbowl_profiles")
            .select("agent_id, emoji, display_name, user_agent_hint, created_at, last_seen_at, current_status, current_status_updated_at, next_checkin_at")
            .eq("api_key_hash", apiKeyHash)
            .order("last_seen_at", { ascending: false, nullsFirst: false })
            .limit(smallerLimit),
          messagesQuery,
          todosQuery,
          activeTodosQuery,
          commentsQuery,
          supabase
            .from("mc_agent_dispatches")
            .select("dispatch_id, source, target_agent_id, task_ref, status, lease_owner, lease_expires_at, last_real_action_at, payload, created_at, updated_at")
            .eq("api_key_hash", apiKeyHash)
            .order("updated_at", { ascending: false })
            .limit(smallerLimit),
          signalsQuery,
          sessionsQuery,
          supabase
            .from("mc_knowledge_library")
            .select("slug, title, category, tags, version, updated_at, created_at")
            .eq("api_key_hash", apiKeyHash)
            .order("updated_at", { ascending: false })
            .limit(16),
          supabase
            .from("mc_business_context")
            .select("id, category, key, value, priority, updated_at")
            .eq("api_key_hash", apiKeyHash)
            .order("priority", { ascending: false })
            .limit(16),
          conversationTurnsQuery,
          chatMessagesQuery,
        ]);

        const errors = [
          profilesResult.error,
          messagesResult.error,
          todosResult.error,
          activeTodosResult.error,
          commentsResult.error,
          dispatchesResult.error,
          signalsResult.error,
          sessionsResult.error,
          libraryResult.error,
          businessContextResult.error,
          conversationTurnsResult.error,
          chatMessagesResult.error,
        ].filter(Boolean);
        if (errors.length > 0) throw errors[0];

        const directChatTurns = (
          (chatMessagesResult.data ?? []) as Array<{
            id: string;
            session_id: string;
            role: string;
            content: string;
            created_at: string;
          }>
        )
          .filter((row) => row.content.trim().length > 0)
          .map(
            (row): OrchestratorConversationTurnRow => ({
              id: `chat_message:${row.id}`,
              session_id: row.session_id,
              role: row.role,
              content: row.content,
              created_at: row.created_at,
            }),
          );
        const conversationTurns = [
          ...((conversationTurnsResult.data ?? []) as OrchestratorConversationTurnRow[]),
          ...directChatTurns,
        ]
          .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
          .slice(0, smallerLimit);
        const todos = mergeOrchestratorTodoRows(
          (todosResult.data ?? []) as OrchestratorTodoRow[],
          (activeTodosResult.data ?? []) as OrchestratorTodoRow[],
        );

        return res.status(200).json({
          context: buildOrchestratorContext({
            generatedAt: new Date().toISOString(),
            continuityLimit: limit,
            compact,
            maxSummaries,
            includeRaw,
            profiles: (profilesResult.data ?? []) as OrchestratorProfileRow[],
            messages: (messagesResult.data ?? []) as OrchestratorMessageRow[],
            todos,
            comments: (commentsResult.data ?? []) as OrchestratorCommentRow[],
            dispatches: (dispatchesResult.data ?? []) as OrchestratorDispatchRow[],
            signals: (signalsResult.data ?? []) as OrchestratorSignalRow[],
            sessions: (sessionsResult.data ?? []) as OrchestratorSessionRow[],
            library: (libraryResult.data ?? []) as OrchestratorLibraryRow[],
            businessContext: (businessContextResult.data ?? []) as OrchestratorBusinessContextRow[],
            conversationTurns,
          }),
        });
      }

      // ─── Fishbowl Todos + Ideas v1 ────────────────────────────────────────
      //
      // All thirteen handlers below share the same shape:
      //   1. Require POST.
      //   2. Resolve api_key_hash.
      //   3. Validate agent_id (<= 128 chars).
      //   4. Anti-spoof human-* agent_ids (must match a profile with
      //      user_agent_hint='admin-ui').
      //   5. Validate inputs.
      //   6. Mutate or read.
      //   7. For material changes (todo-created, todo-completed, idea-created,
      //      idea-promoted), post a tagged event into the Fishbowl feed.
      //
      // Tables: mc_fishbowl_todos, mc_fishbowl_ideas, mc_fishbowl_idea_votes,
      // mc_fishbowl_comments. Service-role-only RLS. See migration
      // 20260425120000_fishbowl_todos_ideas.sql.

      case "fishbowl_create_todo":
      case "fishbowl_update_todo":
      case "fishbowl_complete_todo":
      case "fishbowl_drop_todo":
      case "fishbowl_delete_todo":
      case "fishbowl_list_todos":
      case "fishbowl_list_actionable_todos":
      case "fishbowl_create_idea":
      case "fishbowl_update_idea":
      case "fishbowl_vote_on_idea":
      case "fishbowl_list_ideas":
      case "fishbowl_promote_idea_to_todo":
      case "fishbowl_comment_on":
      case "fishbowl_list_comments": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
        if (!apiKeyHash) {
          return res.status(401).json({
            error: "Authorization header required",
            how_to_fix: "Pass your UnClick API key as 'Authorization: Bearer <api_key>'.",
          });
        }
        const body = (req.body ?? {}) as Record<string, unknown>;

        const agentId = String(body.agent_id ?? "").trim();
        if (!agentId) {
          return res.status(400).json({
            error: "agent_id required",
            how_to_fix: "Pass the same stable identifier you used for set_my_emoji so writes attribute to your profile.",
          });
        }
        if (agentId.length > 128) return res.status(400).json({ error: "agent_id must be at most 128 characters" });

        // Anti-spoof on human-<userid>: only allow if a profile exists with
        // user_agent_hint='admin-ui' for that exact agent_id. AI agents must
        // pick a non-human identifier.
        let isAdminCaller = false;
        if (agentId.startsWith("human-")) {
          const { data: humanProfile } = await supabase
            .from("mc_fishbowl_profiles")
            .select("user_agent_hint")
            .eq("api_key_hash", apiKeyHash)
            .eq("agent_id", agentId)
            .maybeSingle();
          if (humanProfile?.user_agent_hint !== "admin-ui") {
            return res.status(403).json({
              error: "human-* agent_id is reserved for the admin UI",
              how_to_fix: "AI agents should pick a different agent_id.",
            });
          }
          isAdminCaller = true;
        }

        const validateTitle = (raw: unknown): string | { error: string } => {
          const t = typeof raw === "string" ? raw.trim() : "";
          if (!t) return { error: "title required" };
          if (t.length > 200) return { error: "title must be at most 200 characters" };
          return t;
        };
        const validateDescription = (raw: unknown): string | null | { error: string } => {
          if (raw == null || raw === "") return null;
          if (typeof raw !== "string") return { error: "description must be a string" };
          if (raw.length > 4000) return { error: "description must be at most 4000 characters" };
          return raw;
        };
        const validateUuid = (raw: unknown, field: string): string | { error: string } => {
          const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const t = typeof raw === "string" ? raw.trim() : "";
          if (!t) return { error: `${field} required` };
          if (!UUID_RE.test(t)) return { error: `${field} must be a uuid` };
          return t;
        };
        const todoPriorityRank: Record<string, number> = {
          urgent: 3,
          high: 2,
          normal: 1,
          low: 0,
        };
        const DONE_TODO_ARCHIVE_WINDOW_MS = 12 * 60 * 60 * 1000;

        // ── Todos ──────────────────────────────────────────────────────────

        if (action === "fishbowl_create_todo") {
          const titleRes = validateTitle(body.title);
          if (typeof titleRes !== "string") return res.status(400).json(titleRes);
          const descRes = validateDescription(body.description);
          if (descRes && typeof descRes === "object") return res.status(400).json(descRes);

          const priority = String(body.priority ?? "normal");
          if (!["low", "normal", "high", "urgent"].includes(priority)) {
            return res.status(400).json({ error: "priority must be low|normal|high|urgent" });
          }

          let assignee: string | null = null;
          if (body.assigned_to_agent_id != null && body.assigned_to_agent_id !== "") {
            const a = String(body.assigned_to_agent_id).trim();
            if (a.length > 128) return res.status(400).json({ error: "assigned_to_agent_id must be at most 128 characters" });
            assignee = a;
          }

          const { data, error } = await supabase
            .from("mc_fishbowl_todos")
            .insert({
              api_key_hash: apiKeyHash,
              title: titleRes,
              description: descRes,
              priority,
              status: "open",
              created_by_agent_id: agentId,
              assigned_to_agent_id: assignee,
            })
            .select("*")
            .single();
          if (error) throw error;

          await recordAutopilotEvents(
            supabase,
            apiKeyHash,
            planTodoLedgerEvents({
              todoId: data.id,
              actorAgentId: agentId,
              before: null,
              after: data,
            }),
          );

          void postFishbowlEvent(
            supabase,
            apiKeyHash,
            agentId,
            "todo-created",
            `New todo: ${titleRes}`,
          );

          // Universal ACK Handoff: assigning a todo to a different worker is an
          // action-needed handoff, so register an ACK-required dispatch with a
          // 10-min lease. Self-assignment / unassigned stays silent.
          const handoffPlan = planFishbowlTodoHandoff({
            todoId: data.id,
            title: titleRes,
            priority,
            assignedToAgentId: assignee,
            createdByAgentId: agentId,
          });
          if (handoffPlan) {
            try {
              const dispatchId = createDispatchId({
                source: handoffPlan.source,
                targetAgentId: handoffPlan.targetAgentId,
                taskRef: handoffPlan.taskRef,
              });
              const now = new Date();
              const { data: dispatchRows, error: upsertErr } = await supabase
                .from("mc_agent_dispatches")
                .upsert(
                  buildFishbowlTodoHandoffDispatchRow({
                    apiKeyHash,
                    dispatchId,
                    plan: handoffPlan,
                    now,
                  }),
                  { onConflict: "api_key_hash,dispatch_id" },
                )
                .select("dispatch_id,status,lease_owner,lease_expires_at");
              if (upsertErr) {
                throw upsertErr;
              }
              const dispatchRow = dispatchRows?.[0];
              if (
                !dispatchRow ||
                dispatchRow.status !== "leased" ||
                dispatchRow.lease_owner !== handoffPlan.targetAgentId ||
                !dispatchRow.lease_expires_at
              ) {
                throw new Error("handoff dispatch lease was not persisted");
              }
            } catch (err) {
              console.warn("[fishbowl_create_todo] dispatch wrapping failed:", err);
            }
          }

          return res.status(200).json({ todo: data });
        }

        if (action === "fishbowl_update_todo") {
          const idRes = validateUuid(body.todo_id, "todo_id");
          if (typeof idRes !== "string") return res.status(400).json(idRes);

          const { data: beforeTodo, error: beforeErr } = await supabase
            .from("mc_fishbowl_todos")
            .select("id,title,description,status,created_by_agent_id,assigned_to_agent_id,priority")
            .eq("api_key_hash", apiKeyHash)
            .eq("id", idRes)
            .maybeSingle();
          if (beforeErr) throw beforeErr;

          const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (body.title != null) {
            const titleRes = validateTitle(body.title);
            if (typeof titleRes !== "string") return res.status(400).json(titleRes);
            update.title = titleRes;
          }
          if (body.description !== undefined) {
            const descRes = validateDescription(body.description);
            if (descRes && typeof descRes === "object") return res.status(400).json(descRes);
            update.description = descRes;
          }
          if (body.status != null) {
            const s = String(body.status);
            if (!["open", "in_progress", "done", "dropped"].includes(s)) {
              return res.status(400).json({ error: "status must be open|in_progress|done|dropped" });
            }
            update.status = s;
            if (s === "done") update.completed_at = new Date().toISOString();
            if (s !== "done") update.completed_at = null;
          }
          if (body.priority != null) {
            const p = String(body.priority);
            if (!["low", "normal", "high", "urgent"].includes(p)) {
              return res.status(400).json({ error: "priority must be low|normal|high|urgent" });
            }
            update.priority = p;
          }
          if (body.assigned_to_agent_id !== undefined) {
            const a = String(body.assigned_to_agent_id ?? "").trim();
            if (a.length > 128) return res.status(400).json({ error: "assigned_to_agent_id must be at most 128 characters" });
            update.assigned_to_agent_id = a.length === 0 ? null : a;
          }

          if (update.status === "done" && beforeTodo) {
            const { data: proofComments, error: proofErr } = await supabase
              .from("mc_fishbowl_comments")
              .select("author_agent_id,text")
              .eq("api_key_hash", apiKeyHash)
              .eq("target_kind", "todo")
              .eq("target_id", idRes);
            if (proofErr) throw proofErr;

            const completionGate = evaluateFishbowlCompletionPolicy({
              todo: {
                id: String(beforeTodo.id),
                title: typeof update.title === "string" ? update.title : String(beforeTodo.title ?? ""),
                description:
                  typeof update.description === "string"
                    ? update.description
                    : typeof beforeTodo.description === "string"
                      ? beforeTodo.description
                      : null,
                created_by_agent_id:
                  typeof beforeTodo.created_by_agent_id === "string" ? beforeTodo.created_by_agent_id : null,
              },
              comments: (proofComments ?? []).map((comment) => ({
                author_agent_id:
                  typeof comment.author_agent_id === "string" ? comment.author_agent_id : null,
                text: typeof comment.text === "string" ? comment.text : null,
              })),
              closerAgentId: agentId,
            });
            if (!completionGate.allowed) {
              return res.status(409).json({
                error: completionGate.reason,
                code: completionGate.code,
                how_to_fix: completionGate.how_to_fix,
              });
            }
          }

          let laneCheck: {
            decision: "allow" | "warn" | "reject";
            reason: string;
            matched_token?: string;
          } | null = null;
          const nextAssignee = typeof update.assigned_to_agent_id === "string" ? update.assigned_to_agent_id : null;
          if (nextAssignee && beforeTodo) {
            const { data: laneRow, error: laneErr } = await supabase
              .from("worker_lanes")
              .select("api_key_hash, agent_id, role, scope_allowlist, scope_denylist, enforce_mode")
              .eq("api_key_hash", apiKeyHash)
              .eq("agent_id", nextAssignee)
              .maybeSingle();
            if (laneErr) throw laneErr;

            const lane = laneRow as WorkerLaneRow | null;
            const tokens = buildTodoLaneTokens({
              title: update.title ?? beforeTodo.title,
              priority: update.priority ?? beforeTodo.priority,
              status: update.status ?? beforeTodo.status,
            });
            laneCheck = evaluateLaneClaim(lane, tokens);
            await recordAutopilotEvents(supabase, apiKeyHash, [
              {
                apiKeyHash,
                eventType: "lane_check",
                actorAgentId: agentId,
                refKind: "todo",
                refId: idRes,
                payload: {
                  target_agent_id: nextAssignee,
                  role: lane?.role ?? "unregistered",
                  decision: laneCheck.decision,
                  reason: laneCheck.reason,
                  matched_token: laneCheck.matched_token ?? null,
                  tokens,
                },
              },
              ...(laneCheck.decision === "allow"
                ? []
                : [
                    {
                      apiKeyHash,
                      eventType: "lane_violation",
                      actorAgentId: agentId,
                      refKind: "todo",
                      refId: idRes,
                      payload: {
                        target_agent_id: nextAssignee,
                        role: lane?.role ?? "unregistered",
                        decision: laneCheck.decision,
                        reason: laneCheck.reason,
                        matched_token: laneCheck.matched_token ?? null,
                      },
                    },
                  ]),
            ]);

            if (laneCheck.decision === "reject") {
              return res.status(409).json({
                error: "claim rejected by worker lane",
                how_to_fix: "Choose a seat whose lane matches this job, or switch the lane to warn mode while tuning routing.",
                lane_check: laneCheck,
              });
            }
          }

          const { data, error } = await supabase
            .from("mc_fishbowl_todos")
            .update(update)
            .eq("api_key_hash", apiKeyHash)
            .eq("id", idRes)
            .select("*")
            .maybeSingle();
          if (error) throw error;
          if (!data) return res.status(404).json({ error: "todo not found" });

          await recordAutopilotEvents(
            supabase,
            apiKeyHash,
            planTodoLedgerEvents({
              todoId: data.id,
              actorAgentId: agentId,
              before: beforeTodo,
              after: data,
            }),
          );
          return res.status(200).json({ todo: data, lane_check: laneCheck });
        }

        if (action === "fishbowl_complete_todo") {
          const idRes = validateUuid(body.todo_id, "todo_id");
          if (typeof idRes !== "string") return res.status(400).json(idRes);
          const { data: beforeTodo, error: beforeErr } = await supabase
            .from("mc_fishbowl_todos")
            .select("id,title,description,status,created_by_agent_id,assigned_to_agent_id,priority")
            .eq("api_key_hash", apiKeyHash)
            .eq("id", idRes)
            .maybeSingle();
          if (beforeErr) throw beforeErr;
          if (beforeTodo) {
            const { data: proofComments, error: proofErr } = await supabase
              .from("mc_fishbowl_comments")
              .select("author_agent_id,text")
              .eq("api_key_hash", apiKeyHash)
              .eq("target_kind", "todo")
              .eq("target_id", idRes);
            if (proofErr) throw proofErr;

            const completionGate = evaluateFishbowlCompletionPolicy({
              todo: {
                id: String(beforeTodo.id),
                title: typeof beforeTodo.title === "string" ? beforeTodo.title : null,
                description: typeof beforeTodo.description === "string" ? beforeTodo.description : null,
                created_by_agent_id:
                  typeof beforeTodo.created_by_agent_id === "string" ? beforeTodo.created_by_agent_id : null,
              },
              comments: (proofComments ?? []).map((comment) => ({
                author_agent_id:
                  typeof comment.author_agent_id === "string" ? comment.author_agent_id : null,
                text: typeof comment.text === "string" ? comment.text : null,
              })),
              closerAgentId: agentId,
            });
            if (!completionGate.allowed) {
              return res.status(409).json({
                error: completionGate.reason,
                code: completionGate.code,
                how_to_fix: completionGate.how_to_fix,
              });
            }
          }
          const nowIso = new Date().toISOString();
          const { data, error } = await supabase
            .from("mc_fishbowl_todos")
            .update({ status: "done", completed_at: nowIso, updated_at: nowIso })
            .eq("api_key_hash", apiKeyHash)
            .eq("id", idRes)
            .select("*")
            .maybeSingle();
          if (error) throw error;
          if (!data) return res.status(404).json({ error: "todo not found" });

          await recordAutopilotEvents(
            supabase,
            apiKeyHash,
            planTodoLedgerEvents({
              todoId: data.id,
              actorAgentId: agentId,
              before: beforeTodo,
              after: data,
            }),
          );

          void postFishbowlEvent(
            supabase,
            apiKeyHash,
            agentId,
            "todo-completed",
            `Todo done: ${data.title}`,
          );
          return res.status(200).json({ todo: data });
        }

        if (action === "fishbowl_drop_todo") {
          const idRes = validateUuid(body.todo_id, "todo_id");
          if (typeof idRes !== "string") return res.status(400).json(idRes);
          const { data: beforeTodo, error: beforeErr } = await supabase
            .from("mc_fishbowl_todos")
            .select("id,title,status,assigned_to_agent_id,priority")
            .eq("api_key_hash", apiKeyHash)
            .eq("id", idRes)
            .maybeSingle();
          if (beforeErr) throw beforeErr;
          const { data, error } = await supabase
            .from("mc_fishbowl_todos")
            .update({ status: "dropped", updated_at: new Date().toISOString() })
            .eq("api_key_hash", apiKeyHash)
            .eq("id", idRes)
            .select("*")
            .maybeSingle();
          if (error) throw error;
          if (!data) return res.status(404).json({ error: "todo not found" });

          await recordAutopilotEvents(
            supabase,
            apiKeyHash,
            planTodoLedgerEvents({
              todoId: data.id,
              actorAgentId: agentId,
              before: beforeTodo,
              after: data,
            }),
          );
          return res.status(200).json({ todo: data });
        }

        if (action === "fishbowl_delete_todo") {
          const idRes = validateUuid(body.todo_id, "todo_id");
          if (typeof idRes !== "string") return res.status(400).json(idRes);
          // Cascade comments manually since target_id is polymorphic (no FK).
          await supabase
            .from("mc_fishbowl_comments")
            .delete()
            .eq("api_key_hash", apiKeyHash)
            .eq("target_kind", "todo")
            .eq("target_id", idRes);
          const { data, error } = await supabase
            .from("mc_fishbowl_todos")
            .delete()
            .eq("api_key_hash", apiKeyHash)
            .eq("id", idRes)
            .select("id")
            .maybeSingle();
          if (error) throw error;
          if (!data) return res.status(404).json({ error: "todo not found" });
          return res.status(200).json({ deleted: true, id: idRes });
        }

        if (action === "fishbowl_list_todos") {
          const limit = Math.min(Math.max(Number(body.limit ?? 50) || 50, 1), 200);
          const includeDescription = body.include_description === true || body.full_content === true;
          const includeArchivedDone =
            body.include_archived_done === true ||
            body.include_archived === true ||
            body.show_archived === true;
          const doneArchiveCutoff = new Date(Date.now() - DONE_TODO_ARCHIVE_WINDOW_MS).toISOString();
          let q = supabase
            .from("mc_fishbowl_todos")
            .select("*")
            .eq("api_key_hash", apiKeyHash)
            .order("created_at", { ascending: false })
            .limit(limit);
          if (body.status != null) {
            const s = String(body.status);
            if (!["open", "in_progress", "done", "dropped"].includes(s)) {
              return res.status(400).json({ error: "status filter must be open|in_progress|done|dropped" });
            }
            q = q.eq("status", s);
          }
          if (body.assigned_to_agent_id != null) {
            const a = String(body.assigned_to_agent_id);
            q = q.eq("assigned_to_agent_id", a);
          }
          if (!includeArchivedDone && body.status == null) {
            q = q.or(`status.neq.done,completed_at.is.null,completed_at.gte.${doneArchiveCutoff}`);
          }
          const { data, error } = await q;
          if (error) throw error;

          const countTodosByStatus = async (status: "open" | "in_progress" | "done" | "dropped") => {
            const { count, error: countError } = await supabase
              .from("mc_fishbowl_todos")
              .select("id", { count: "exact", head: true })
              .eq("api_key_hash", apiKeyHash)
              .eq("status", status);
            if (countError) throw countError;
            return count ?? 0;
          };
          const [openBacklogCount, activeCount, doneCount, droppedCount] = await Promise.all([
            countTodosByStatus("open"),
            countTodosByStatus("in_progress"),
            countTodosByStatus("done"),
            countTodosByStatus("dropped"),
          ]);

          // Decorate with comment_count and stage evidence for the jobs board.
          const todos = data ?? [];
          let countMap: Record<string, number> = {};
          let textMap: Record<string, Array<{ text: string; created_at: string | null }>> = {};
          if (todos.length > 0) {
            const ids = todos.map((t) => t.id);
            const { data: comments } = await supabase
              .from("mc_fishbowl_comments")
              .select("target_id,text,created_at")
              .eq("api_key_hash", apiKeyHash)
              .eq("target_kind", "todo")
              .in("target_id", ids)
              .order("created_at", { ascending: true });
            const commentRows = comments ?? [];
            countMap = commentRows.reduce<Record<string, number>>((acc, c) => {
              const k = c.target_id as string;
              acc[k] = (acc[k] ?? 0) + 1;
              return acc;
            }, {});
            textMap = commentRows.reduce<Record<string, Array<{ text: string; created_at: string | null }>>>((acc, c) => {
              const k = c.target_id as string;
              const text = typeof c.text === "string" ? c.text : "";
              const createdAt = typeof c.created_at === "string" ? c.created_at : null;
              if (text) acc[k] = [...(acc[k] ?? []), { text, created_at: createdAt }];
              return acc;
            }, {});
          }
          const decorated = todos.map((t) => {
            const id = t.id as string;
            return {
              ...t,
              comment_count: countMap[id] ?? 0,
              ...inferFishbowlJobPipeline(t, textMap[id] ?? []),
            };
          });
          const compactTodos = decorated.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            assigned_to_agent_id: t.assigned_to_agent_id,
            created_by_agent_id: t.created_by_agent_id,
            created_at: t.created_at,
            updated_at: t.updated_at,
            completed_at: t.completed_at,
            comment_count: t.comment_count,
            pipeline_stage_count: t.pipeline_stage_count,
            pipeline_progress: t.pipeline_progress,
            pipeline_source: t.pipeline_source,
            pipeline_evidence: t.pipeline_evidence,
          }));
          return res.status(200).json({
            todos: includeDescription ? decorated : compactTodos,
            queue_metrics: {
              active: activeCount,
              open_backlog: openBacklogCount,
              done: doneCount,
              dropped: droppedCount,
              legacy_queued_equals: "open_backlog",
              note: "Open backlog is not the runnable queue; active is in_progress work.",
            },
            response_bounds: {
              compact: !includeDescription,
              descriptions_included: includeDescription,
              archived_done_hidden: !includeArchivedDone && body.status == null,
              done_archive_cutoff: !includeArchivedDone && body.status == null ? doneArchiveCutoff : null,
              todos_returned: decorated.length,
            },
          });
        }

        if (action === "fishbowl_list_actionable_todos") {
          const limit = Math.min(Math.max(Number(body.limit ?? 10) || 10, 1), 50);
          const includeDescription = body.include_description === true || body.includeDescription === true;
          const nowMs = Date.now();
          const staleOpenAssignedMs = 6 * 60 * 60 * 1000;
          const staleInProgressMs = 6 * 60 * 60 * 1000;
          const liveOwnerMs = 60 * 60 * 1000;
          const roleAssignees = new Set([
            "master",
            "coordinator",
            "builder",
            "reviewer",
            "watcher",
            "planner",
            "tester",
            "safety",
            "messenger",
            "pinballwake-job-runner",
          ]);
          const isRoleAssignee = (raw: unknown): boolean => {
            const value = String(raw ?? "").trim().toLowerCase();
            return (
              roleAssignees.has(value) ||
              value.startsWith("codex-forge-") ||
              value.startsWith("claude-pc-tether-") ||
              value.startsWith("claude-code-pc-tether-")
            );
          };
          const ageMs = (raw: unknown): number => {
            const ms = Date.parse(String(raw ?? ""));
            return Number.isFinite(ms) ? Math.max(0, nowMs - ms) : Number.POSITIVE_INFINITY;
          };

          const { data, error } = await supabase
            .from("mc_fishbowl_todos")
            .select("*")
            .eq("api_key_hash", apiKeyHash)
            .in("status", ["open", "in_progress"])
            .order("created_at", { ascending: true })
            .limit(500);
          if (error) throw error;

          const { data: callerLaneRow, error: callerLaneErr } = await supabase
            .from("worker_lanes")
            .select("api_key_hash, agent_id, role, scope_allowlist, scope_denylist, enforce_mode")
            .eq("api_key_hash", apiKeyHash)
            .eq("agent_id", agentId)
            .maybeSingle();
          if (callerLaneErr) throw callerLaneErr;
          const callerLane = callerLaneRow as WorkerLaneRow | null;

          const assigneeIds = Array.from(
            new Set(
              (data ?? [])
                .map((t) => String(t.assigned_to_agent_id ?? "").trim())
                .filter(Boolean),
            ),
          );
          const lastSeenByAgent = new Map<string, string | null>();
          if (assigneeIds.length > 0) {
            const { data: profileRows, error: profileErr } = await supabase
              .from("mc_fishbowl_profiles")
              .select("agent_id,last_seen_at")
              .eq("api_key_hash", apiKeyHash)
              .in("agent_id", assigneeIds);
            if (profileErr) throw profileErr;
            for (const profile of profileRows ?? []) {
              lastSeenByAgent.set(String(profile.agent_id), profile.last_seen_at ?? null);
            }
          }

          const actionabilityFor = (todo: Record<string, unknown>): string | null => {
            const status = String(todo.status ?? "");
            const assignee = String(todo.assigned_to_agent_id ?? "").trim();
            const todoAge = ageMs(todo.updated_at ?? todo.created_at);
            const ownerLastSeen = assignee ? lastSeenByAgent.get(assignee) ?? null : null;
            const ownerAge = ownerLastSeen ? ageMs(ownerLastSeen) : Number.POSITIVE_INFINITY;
            const ownerLooksDormant = !assignee || isRoleAssignee(assignee) || ownerAge > liveOwnerMs;

            if (status === "open" && !assignee) return "unassigned_open";
            if (status === "open" && isRoleAssignee(assignee)) return "role_assigned_open";
            if (status === "open" && todoAge > staleOpenAssignedMs && ownerLooksDormant) return "stale_assigned_open";
            if (status === "in_progress" && todoAge > staleInProgressMs && ownerLooksDormant) return "stale_in_progress";

            return null;
          };

          const actionable = (data ?? [])
            .map((todo) => {
              const tokens = buildTodoLaneTokens({
                title: todo.title,
                description: todo.description,
                priority: todo.priority,
                status: todo.status,
              });
              const laneCheck = evaluateLaneClaim(callerLane, tokens);
              return {
                todo,
                actionability_reason: actionabilityFor(todo),
                lane_check: callerLane
                  ? {
                      decision: laneCheck.decision,
                      reason: laneCheck.reason,
                      matched_token: laneCheck.matched_token ?? null,
                    }
                  : null,
              };
            })
            .filter((item) => item.actionability_reason)
            .filter((item) => item.lane_check?.decision !== "reject")
            .sort((a, b) => {
              const todoA = a.todo;
              const todoB = b.todo;
              const priorityDelta =
                (todoPriorityRank[String(todoB.priority ?? "normal")] ?? 1) -
                (todoPriorityRank[String(todoA.priority ?? "normal")] ?? 1);
              if (priorityDelta !== 0) return priorityDelta;

              const reasonRank: Record<string, number> = {
                stale_in_progress: 4,
                role_assigned_open: 3,
                unassigned_open: 2,
                stale_assigned_open: 1,
              };
              const reasonDelta =
                (reasonRank[b.actionability_reason ?? ""] ?? 0) -
                (reasonRank[a.actionability_reason ?? ""] ?? 0);
              if (reasonDelta !== 0) return reasonDelta;

              const createdA = Date.parse(String(todoA.created_at ?? "")) || 0;
              const createdB = Date.parse(String(todoB.created_at ?? "")) || 0;
              if (createdA !== createdB) return createdA - createdB;

              return String(todoA.id).localeCompare(String(todoB.id));
            })
            .slice(0, limit);

          let countMap: Record<string, number> = {};
          let commentMap: Record<string, ScopePackCommentRow[]> = {};
          if (actionable.length > 0) {
            const ids = actionable.map((item) => item.todo.id);
            const { data: comments } = await supabase
              .from("mc_fishbowl_comments")
              .select("id,target_id,text,created_at")
              .eq("api_key_hash", apiKeyHash)
              .eq("target_kind", "todo")
              .in("target_id", ids);
            countMap = (comments ?? []).reduce<Record<string, number>>((acc, c) => {
              const k = c.target_id as string;
              acc[k] = (acc[k] ?? 0) + 1;
              return acc;
            }, {});
            commentMap = (comments ?? []).reduce<Record<string, ScopePackCommentRow[]>>((acc, c) => {
              const k = c.target_id as string;
              acc[k] = [
                ...(acc[k] ?? []),
                {
                  id: typeof c.id === "string" ? c.id : null,
                  text: typeof c.text === "string" ? c.text : null,
                  created_at: typeof c.created_at === "string" ? c.created_at : null,
                },
              ];
              return acc;
            }, {});
          }

          const decorated = actionable.map(({ todo: t, actionability_reason, lane_check }, index) => {
            const fieldScopePack =
              t.scope_pack ??
              t.scopePack ??
              t.runner_scope ??
              t.runnerScope ??
              t.autonomous_scope ??
              t.autonomousScope ??
              t.coding_room_scope ??
              t.codingRoomScope ??
              null;
            const commentScopePack = fieldScopePack
              ? null
              : pickScopePackFromComments(commentMap[t.id as string] ?? []);

            return {
              id: t.id,
              title: t.title,
              ...(includeDescription ? { description: t.description } : {}),
              status: t.status,
              priority: t.priority,
              assigned_to_agent_id: t.assigned_to_agent_id,
              created_by_agent_id: t.created_by_agent_id,
              created_at: t.created_at,
              updated_at: t.updated_at,
              completed_at: t.completed_at,
              comment_count: countMap[t.id as string] ?? 0,
              actionable_rank: index + 1,
              actionability_reason,
              owner_last_seen_at: t.assigned_to_agent_id
                ? lastSeenByAgent.get(String(t.assigned_to_agent_id)) ?? null
                : null,
              scope_pack: fieldScopePack ?? commentScopePack?.scope_pack ?? null,
              scope_pack_source: fieldScopePack ? "field" : commentScopePack?.source ?? null,
              scope_pack_comment_id: commentScopePack?.comment_id ?? null,
              ...(lane_check ? { lane_check } : {}),
            };
          });
          return res.status(200).json({
            todos: decorated,
            response_bounds: {
              compact: true,
              descriptions_included: includeDescription,
              todos_returned: decorated.length,
            },
          });
        }

        // ── Ideas ──────────────────────────────────────────────────────────

        if (action === "fishbowl_create_idea") {
          const titleRes = validateTitle(body.title);
          if (typeof titleRes !== "string") return res.status(400).json(titleRes);
          const descRes = validateDescription(body.description);
          if (descRes && typeof descRes === "object") return res.status(400).json(descRes);

          const { data, error } = await supabase
            .from("mc_fishbowl_ideas")
            .insert({
              api_key_hash: apiKeyHash,
              title: titleRes,
              description: descRes,
              status: "proposed",
              created_by_agent_id: agentId,
            })
            .select("*")
            .single();
          if (error) throw error;

          void postFishbowlEvent(
            supabase,
            apiKeyHash,
            agentId,
            "idea-created",
            `New idea: ${titleRes}`,
          );

          // Ideas Council: a fresh idea should invite a small worker quorum to
          // comment/vote. Register ACK-required dispatches so stale participation
          // becomes visible without waking humans or the idea author.
          try {
            const { data: profileRows, error: profileErr } = await supabase
              .from("mc_fishbowl_profiles")
              .select("agent_id, emoji, display_name, user_agent_hint, last_seen_at, current_status_updated_at")
              .eq("api_key_hash", apiKeyHash);
            if (profileErr) throw profileErr;

            const councilPlans = planFishbowlIdeaCouncilHandoffs({
              ideaId: data.id,
              title: titleRes,
              description: descRes,
              createdByAgentId: agentId,
              profiles: (profileRows ?? []).map((profileRow) => ({
                agentId: profileRow.agent_id,
                emoji: profileRow.emoji,
                displayName: profileRow.display_name,
                userAgentHint: profileRow.user_agent_hint,
                lastSeenAt: profileRow.last_seen_at,
                currentStatusUpdatedAt: profileRow.current_status_updated_at,
              })),
            });

            for (const councilPlan of councilPlans) {
              const dispatchId = createDispatchId({
                source: councilPlan.source,
                targetAgentId: councilPlan.targetAgentId,
                taskRef: councilPlan.taskRef,
              });
              const now = new Date();
              const { data: dispatchRows, error: upsertErr } = await supabase
                .from("mc_agent_dispatches")
                .upsert(
                  buildFishbowlIdeaCouncilDispatchRow({
                    apiKeyHash,
                    dispatchId,
                    plan: councilPlan,
                    now,
                  }),
                  { onConflict: "api_key_hash,dispatch_id" },
                )
                .select("dispatch_id,status,lease_owner,lease_expires_at");
              if (upsertErr) throw upsertErr;

              const dispatchRow = dispatchRows?.[0];
              if (
                !dispatchRow ||
                dispatchRow.status !== "leased" ||
                dispatchRow.lease_owner !== councilPlan.targetAgentId ||
                !dispatchRow.lease_expires_at
              ) {
                throw new Error("idea council dispatch lease was not persisted");
              }
            }
          } catch (err) {
            console.warn("[fishbowl_create_idea] council dispatch wrapping failed:", err);
          }

          return res.status(200).json({ idea: data });
        }

        if (action === "fishbowl_update_idea") {
          const idRes = validateUuid(body.idea_id, "idea_id");
          if (typeof idRes !== "string") return res.status(400).json(idRes);
          const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (body.title != null) {
            const titleRes = validateTitle(body.title);
            if (typeof titleRes !== "string") return res.status(400).json(titleRes);
            update.title = titleRes;
          }
          if (body.description !== undefined) {
            const descRes = validateDescription(body.description);
            if (descRes && typeof descRes === "object") return res.status(400).json(descRes);
            update.description = descRes;
          }
          if (body.status != null) {
            const s = String(body.status);
            if (!["proposed", "voting", "locked", "parked", "rejected"].includes(s)) {
              return res.status(400).json({ error: "status must be proposed|voting|locked|parked|rejected" });
            }
            update.status = s;
          }
          const { data, error } = await supabase
            .from("mc_fishbowl_ideas")
            .update(update)
            .eq("api_key_hash", apiKeyHash)
            .eq("id", idRes)
            .select("*")
            .maybeSingle();
          if (error) throw error;
          if (!data) return res.status(404).json({ error: "idea not found" });
          return res.status(200).json({ idea: data });
        }

        if (action === "fishbowl_vote_on_idea") {
          const idRes = validateUuid(body.idea_id, "idea_id");
          if (typeof idRes !== "string") return res.status(400).json(idRes);
          const vote = String(body.vote ?? "");
          if (vote !== "up" && vote !== "down") {
            return res.status(400).json({ error: "vote must be 'up' or 'down'" });
          }

          // Verify the idea exists in this tenant.
          const { data: existing } = await supabase
            .from("mc_fishbowl_ideas")
            .select("id, upvotes, downvotes")
            .eq("api_key_hash", apiKeyHash)
            .eq("id", idRes)
            .maybeSingle();
          if (!existing) return res.status(404).json({ error: "idea not found" });

          // What was the previous vote, if any? Needed to adjust counters.
          const { data: prior } = await supabase
            .from("mc_fishbowl_idea_votes")
            .select("vote")
            .eq("api_key_hash", apiKeyHash)
            .eq("idea_id", idRes)
            .eq("voter_agent_id", agentId)
            .maybeSingle();

          const { error: voteErr } = await supabase
            .from("mc_fishbowl_idea_votes")
            .upsert(
              {
                api_key_hash: apiKeyHash,
                idea_id: idRes,
                voter_agent_id: agentId,
                vote,
                created_at: new Date().toISOString(),
              },
              { onConflict: "api_key_hash,idea_id,voter_agent_id" },
            );
          if (voteErr) throw voteErr;

          // Recompute aggregate counters from the source of truth (the votes
          // table). Cheaper to derive than to keep deltas in sync, and avoids
          // skew if a vote ever lands twice.
          const { data: voteRows, error: aggErr } = await supabase
            .from("mc_fishbowl_idea_votes")
            .select("vote")
            .eq("api_key_hash", apiKeyHash)
            .eq("idea_id", idRes);
          if (aggErr) throw aggErr;
          let up = 0;
          let down = 0;
          for (const row of voteRows ?? []) {
            if (row.vote === "up") up++;
            else if (row.vote === "down") down++;
          }
          const { data: updated, error: updErr } = await supabase
            .from("mc_fishbowl_ideas")
            .update({ upvotes: up, downvotes: down, updated_at: new Date().toISOString() })
            .eq("api_key_hash", apiKeyHash)
            .eq("id", idRes)
            .select("*")
            .maybeSingle();
          if (updErr) throw updErr;

          // Rate-limited vote event: only post if the most recent
          // 'idea-voted' message for this idea is older than 5 minutes.
          // Keeps the feed quiet during a flurry.
          const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
          const { data: recentVoteEvents } = await supabase
            .from("mc_fishbowl_messages")
            .select("id, created_at, text")
            .eq("api_key_hash", apiKeyHash)
            .contains("tags", ["event", "idea-voted"])
            .gte("created_at", fiveMinAgo)
            .ilike("text", `%${idRes}%`)
            .limit(1);
          if (!recentVoteEvents || recentVoteEvents.length === 0) {
            void postFishbowlEvent(
              supabase,
              apiKeyHash,
              agentId,
              "idea-voted",
              `Vote on idea ${idRes}: ${up} up, ${down} down`,
            );
          }

          return res.status(200).json({
            idea: updated,
            previous_vote: prior?.vote ?? null,
          });
        }

        if (action === "fishbowl_list_ideas") {
          const limit = Math.min(Math.max(Number(body.limit ?? 50) || 50, 1), 200);
          let q = supabase
            .from("mc_fishbowl_ideas")
            .select("*")
            .eq("api_key_hash", apiKeyHash)
            .order("score", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(limit);
          if (body.status != null) {
            const s = String(body.status);
            if (!["proposed", "voting", "locked", "parked", "rejected"].includes(s)) {
              return res.status(400).json({ error: "status filter invalid" });
            }
            q = q.eq("status", s);
          }
          const { data, error } = await q;
          if (error) throw error;
          const ideas = data ?? [];

          // Decorate with the caller's own vote and comment_count so the UI
          // can render highlighted vote buttons and a comment badge.
          let myVoteMap: Record<string, "up" | "down"> = {};
          let countMap: Record<string, number> = {};
          if (ideas.length > 0) {
            const ids = ideas.map((i) => i.id);
            const [{ data: myVotes }, { data: comments }] = await Promise.all([
              supabase
                .from("mc_fishbowl_idea_votes")
                .select("idea_id, vote")
                .eq("api_key_hash", apiKeyHash)
                .eq("voter_agent_id", agentId)
                .in("idea_id", ids),
              supabase
                .from("mc_fishbowl_comments")
                .select("target_id")
                .eq("api_key_hash", apiKeyHash)
                .eq("target_kind", "idea")
                .in("target_id", ids),
            ]);
            myVoteMap = (myVotes ?? []).reduce<Record<string, "up" | "down">>((acc, v) => {
              acc[v.idea_id as string] = v.vote as "up" | "down";
              return acc;
            }, {});
            countMap = (comments ?? []).reduce<Record<string, number>>((acc, c) => {
              const k = c.target_id as string;
              acc[k] = (acc[k] ?? 0) + 1;
              return acc;
            }, {});
          }
          const decorated = ideas.map((i) => ({
            ...i,
            my_vote: myVoteMap[i.id as string] ?? null,
            comment_count: countMap[i.id as string] ?? 0,
          }));
          return res.status(200).json({ ideas: decorated });
        }

        if (action === "fishbowl_promote_idea_to_todo") {
          const idRes = validateUuid(body.idea_id, "idea_id");
          if (typeof idRes !== "string") return res.status(400).json(idRes);

          const { data: idea } = await supabase
            .from("mc_fishbowl_ideas")
            .select("*")
            .eq("api_key_hash", apiKeyHash)
            .eq("id", idRes)
            .maybeSingle();
          if (!idea) return res.status(404).json({ error: "idea not found" });
          if (idea.promoted_to_todo_id) {
            return res.status(409).json({
              error: "idea already promoted",
              promoted_to_todo_id: idea.promoted_to_todo_id,
            });
          }

          const netUp = (idea.upvotes ?? 0) - (idea.downvotes ?? 0);
          if (!isAdminCaller && netUp < 1) {
            return res.status(403).json({
              error: "idea needs net upvotes >= 1 (or admin caller) to promote",
              how_to_fix: "Vote it up first, or have the human admin promote it from the Boardroom admin UI.",
            });
          }

          const priority = String(body.priority ?? "normal");
          if (!["low", "normal", "high", "urgent"].includes(priority)) {
            return res.status(400).json({ error: "priority must be low|normal|high|urgent" });
          }
          let assignee: string | null = null;
          if (body.assigned_to_agent_id != null && body.assigned_to_agent_id !== "") {
            const a = String(body.assigned_to_agent_id).trim();
            if (a.length > 128) return res.status(400).json({ error: "assigned_to_agent_id must be at most 128 characters" });
            assignee = a;
          }

          const { data: newTodo, error: todoErr } = await supabase
            .from("mc_fishbowl_todos")
            .insert({
              api_key_hash: apiKeyHash,
              title: idea.title,
              description: idea.description,
              status: "open",
              priority,
              created_by_agent_id: agentId,
              assigned_to_agent_id: assignee,
              source_idea_id: idea.id,
            })
            .select("*")
            .single();
          if (todoErr) throw todoErr;

          const { data: lockedIdea, error: ideaErr } = await supabase
            .from("mc_fishbowl_ideas")
            .update({
              status: "locked",
              promoted_to_todo_id: newTodo.id,
              updated_at: new Date().toISOString(),
            })
            .eq("api_key_hash", apiKeyHash)
            .eq("id", idea.id)
            .select("*")
            .single();
          if (ideaErr) throw ideaErr;

          void postFishbowlEvent(
            supabase,
            apiKeyHash,
            agentId,
            "idea-promoted",
            `Idea promoted to todo: ${idea.title}`,
          );
          return res.status(200).json({ todo: newTodo, idea: lockedIdea });
        }

        // ── Comments (polymorphic) ─────────────────────────────────────────

        if (action === "fishbowl_comment_on") {
          const targetKind = String(body.target_kind ?? "");
          if (targetKind !== "todo" && targetKind !== "idea") {
            return res.status(400).json({ error: "target_kind must be 'todo' or 'idea'" });
          }
          const idRes = validateUuid(body.target_id, "target_id");
          if (typeof idRes !== "string") return res.status(400).json(idRes);
          const text = typeof body.text === "string" ? body.text.trim() : "";
          if (!text) return res.status(400).json({ error: "text required" });
          if (text.length > 4000) return res.status(400).json({ error: "text must be at most 4000 characters" });

          // Verify the target exists in this tenant before letting an orphan
          // comment land.
          const targetTable = targetKind === "todo" ? "mc_fishbowl_todos" : "mc_fishbowl_ideas";
          const { data: target } = await supabase
            .from(targetTable)
            .select("id")
            .eq("api_key_hash", apiKeyHash)
            .eq("id", idRes)
            .maybeSingle();
          if (!target) return res.status(404).json({ error: `${targetKind} not found` });

          const { data, error } = await supabase
            .from("mc_fishbowl_comments")
            .insert({
              api_key_hash: apiKeyHash,
              target_kind: targetKind,
              target_id: idRes,
              author_agent_id: agentId,
              text,
            })
            .select("*")
            .single();
          if (error) throw error;
          return res.status(200).json({ comment: data });
        }

        if (action === "fishbowl_list_comments") {
          const targetKind = String(body.target_kind ?? "");
          if (targetKind !== "todo" && targetKind !== "idea") {
            return res.status(400).json({ error: "target_kind must be 'todo' or 'idea'" });
          }
          const idRes = validateUuid(body.target_id, "target_id");
          if (typeof idRes !== "string") return res.status(400).json(idRes);
          const limit = Math.min(Math.max(Number(body.limit ?? 100) || 100, 1), 200);
          const { data, error } = await supabase
            .from("mc_fishbowl_comments")
            .select("*")
            .eq("api_key_hash", apiKeyHash)
            .eq("target_kind", targetKind)
            .eq("target_id", idRes)
            .order("created_at", { ascending: true })
            .limit(limit);
          if (error) throw error;
          return res.status(200).json({ comments: data ?? [] });
        }

        return res.status(400).json({ error: `Unhandled fishbowl action: ${action}` });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err: unknown) {
    console.error(`Memory admin error (${action}):`, (err as Error).message);
    return res.status(500).json({ error: `Failed to execute ${action}: ${(err as Error).message}` });
  }
}

/**
 * Memory operation handlers for @unclick/mcp-server.
 *
 * Wraps the 18 memory operations (get_startup_context, search_memory, add_fact,
 * write_session_summary, etc.) as plain async functions that take a single
 * params object. Used by both direct MCP tools and the unclick_call meta-tool.
 */

import { getBackend } from "./db.js";
import {
  buildToolGuidance,
  classifyTools,
  reportToolDetections,
} from "./tool-awareness.js";
import { resolveAgent, filterContextByLayers } from "./agent.js";
import { emitSignal } from "../signals/emit.js";
import { buildSearchMemoryCard } from "../cards/search-memory-card.js";
import type {
  MemoryProfileCard,
  MemoryProfileCardReceipt,
  MemoryProfileCardSourceKind,
} from "./types.js";

function currentApiKeyHash(): string | null {
  return process.env.UNCLICK_API_KEY_HASH ?? null;
}

type Args = Record<string, unknown>;

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

function bool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function capText(text: string, max: number): string {
  return text.length > max
    ? `${text.slice(0, max)}...[truncated, call search_memory for full]`
    : text;
}

function compactJsonValue(value: unknown, max = 500): unknown {
  if (typeof value === "string") return capText(value, max);
  if (value === null || typeof value !== "object") return value;
  const serialized = JSON.stringify(value);
  return serialized.length > max ? capText(serialized, max) : value;
}

function compactStringArray(value: unknown, limit = 5, max = 120): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.slice(0, limit).map((item) => capText(String(item), max));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function hasInvalidatedAtSet(value: unknown): boolean {
  const row = asRecord(value);
  if (!row || !("invalidated_at" in row)) return false;
  return row.invalidated_at !== null && row.invalidated_at !== undefined && row.invalidated_at !== "";
}

function factTimestamp(value: unknown): number {
  const row = asRecord(value);
  if (!row || typeof row.created_at !== "string") return 0;
  const parsed = Date.parse(row.created_at);
  return Number.isFinite(parsed) ? parsed : 0;
}

function factConfidence(value: unknown): number {
  const row = asRecord(value);
  return row && typeof row.confidence === "number" && Number.isFinite(row.confidence)
    ? row.confidence
    : 0;
}

function textMatchesOperationalSelfReport(text: string): boolean {
  const normalized = text.toLowerCase();
  const exactSignals = [
    "no fishbowl write tools",
    "testpass_cron_user_id",
    "heartbeat",
    "self-report",
    "self report",
  ];
  if (exactSignals.some((signal) => normalized.includes(signal))) return true;
  if (normalized.includes("cron") && normalized.includes("resolved")) return true;
  if (normalized.includes("signal") && normalized.includes("blocked")) return true;
  return false;
}

function activeFactPenalty(value: unknown): number {
  const row = asRecord(value);
  if (!row) return 0;

  // Startup payloads still strip most provenance, so rank-time demotion needs
  // to honor explicit markers when present and fall back to content heuristics.
  if (typeof row.startup_fact_kind === "string") {
    if (row.startup_fact_kind === "durable") return 0;
    if (row.startup_fact_kind === "operational" || row.startup_fact_kind === "excluded") return 1;
  }

  if (typeof row.source_type === "string") {
    const sourceType = row.source_type.toLowerCase();
    if (
      sourceType.includes("heartbeat") ||
      sourceType.includes("self_report") ||
      sourceType.includes("self-report") ||
      sourceType.includes("cron") ||
      sourceType.includes("system")
    ) {
      return 1;
    }
  }

  if (typeof row.fact === "string" && textMatchesOperationalSelfReport(row.fact)) return 1;
  if (typeof row.category === "string" && textMatchesOperationalSelfReport(row.category)) return 1;
  return 0;
}

const PROFILE_CARD_SOURCE_PATHS: Record<MemoryProfileCardSourceKind, string> = {
  business_context: "/admin/memory?tab=business-context",
  fact: "/admin/memory?tab=facts",
  session_summary: "/admin/memory?tab=sessions",
};

const SENSITIVE_MEMORY_PATTERN = /\b(secret|token|password|credential|private key|api[_ -]?key|plaintext)\b/i;
const GUARDRAIL_PATTERN = /\b(do not|don't|never|avoid|blocked|blocker|owner auth|human decision|no secrets|no billing|no dns|no production deploy)\b/i;
const CURRENT_WORK_PATTERN = /\b(active|current|now|todo|job|pr|blocker|blocked|next|in progress|priority|scope)\b/i;

function stringifyForProfile(value: unknown, max = 120): string {
  if (typeof value === "string") return capText(value, max);
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return capText(String(value), max);
  try {
    return capText(JSON.stringify(value), max);
  } catch {
    return "";
  }
}

function hasSensitiveMemorySignal(...values: unknown[]): boolean {
  return values.some((value) => SENSITIVE_MEMORY_PATTERN.test(stringifyForProfile(value, 300)));
}

function compactProfileLine(line: string, max = 160): string {
  return capText(line.replace(/\s+/g, " ").trim(), max);
}

function profileRowId(
  row: Record<string, unknown>,
  sourceKind: MemoryProfileCardSourceKind,
  index: number
): string {
  const rawId =
    str(row.id) ||
    str(row.fact_id) ||
    str(row.session_id) ||
    str(row.slug) ||
    str(row.key) ||
    `${sourceKind}-${index}`;
  return compactProfileLine(`${sourceKind}:${rawId}`, 100);
}

function profileReceipt(
  row: Record<string, unknown>,
  sourceKind: MemoryProfileCardSourceKind,
  index: number
): MemoryProfileCardReceipt {
  const memoryId = profileRowId(row, sourceKind, index);
  const receipt: MemoryProfileCardReceipt = {
    memory_id: memoryId,
    source_kind: sourceKind,
    source_uri: PROFILE_CARD_SOURCE_PATHS[sourceKind],
  };
  const lastVerified = str(row.last_verified_at) || str(row.updated_at) || str(row.created_at);
  if (lastVerified) receipt.last_verified_at = lastVerified;
  if (typeof row.confidence === "number" && Number.isFinite(row.confidence)) {
    receipt.confidence = row.confidence;
  }
  return receipt;
}

function businessProfileScore(row: Record<string, unknown>): number {
  const category = str(row.category).toLowerCase();
  const key = str(row.key).toLowerCase();
  const priority = num(row.priority, 0);
  let score = priority;
  if (category.includes("identity") || key.includes("identity")) score += 8;
  if (category.includes("preference") || key.includes("preference")) score += 6;
  if (category.includes("workflow") || key.includes("workflow")) score += 6;
  if (category.includes("rule") || key.includes("rule")) score += 5;
  if (category.includes("context") || key.includes("context")) score += 3;
  if (category.includes("timezone") || key.includes("timezone")) score -= 2;
  return score;
}

function businessProfileLine(row: Record<string, unknown>): string | null {
  if (hasSensitiveMemorySignal(row.category, row.key, row.value)) return null;
  const category = str(row.category, "context");
  const key = str(row.key, "item");
  const value = stringifyForProfile(row.value, 60);
  return compactProfileLine(value ? `${category}/${key}: ${value}` : `${category}/${key}`, 110);
}

function factProfileLine(row: Record<string, unknown>): string | null {
  if (typeof row.fact !== "string" || hasSensitiveMemorySignal(row.fact, row.category)) return null;
  const category = str(row.category);
  const prefix = category ? `${category}: ` : "";
  return compactProfileLine(`${prefix}${row.fact}`, 110);
}

function timezoneRowScore(row: Record<string, unknown>): number {
  const valueText = stringifyForProfile(row.value, 400).toLowerCase();
  const key = str(row.key).toLowerCase();
  const category = str(row.category).toLowerCase();
  const haystack = `${category} ${key} ${valueText}`;
  if (!/(timezone|time zone|utc|gmt|operator_timezone|australia\/sydney)/i.test(haystack)) return -1;

  let score = 1;
  if (key === "operator_timezone") score += 10;
  if (key.includes("timezone") || category.includes("timezone")) score += 4;
  const value = asRecord(row.value);
  if (value) {
    if (str(value.source).toLowerCase() === "manual") score += 8;
    if (str(value.timezone) || str(value.tz)) score += 3;
    if (str(value.utc_offset) || str(value.offset)) score += 2;
  }
  return score;
}

function buildTimezoneContext(business: unknown[]): string | undefined {
  const rows = business
    .map((row, index) => ({ row: asRecord(row), index }))
    .filter((item): item is { row: Record<string, unknown>; index: number } => item.row !== null)
    .map((item) => ({ ...item, score: timezoneRowScore(item.row) }))
    .filter((item) => item.score >= 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);

  const chosen = rows[0]?.row;
  if (!chosen || hasSensitiveMemorySignal(chosen.key, chosen.value)) return undefined;

  const value = asRecord(chosen.value);
  if (value) {
    const timezone = str(value.timezone) || str(value.tz);
    const offset = str(value.utc_offset) || str(value.offset);
    const privacy = str(value.privacy) || str(value.privacy_level);
    const source = str(value.source);
    const parts = [
      timezone || stringifyForProfile(chosen.value, 80),
      offset ? `(${offset})` : "",
      privacy ? `privacy ${privacy}` : "",
      source ? `${source} source` : "",
    ].filter(Boolean);
    if (parts.length > 0) return compactProfileLine(`Operator timezone: ${parts.join(", ")}`, 140);
  }

  const label = businessProfileLine(chosen);
  return label ? compactProfileLine(`Operator timezone: ${label}`, 140) : undefined;
}

function uniqueProfileItems<T extends { line: string | null | undefined }>(
  items: T[],
  limit: number
): Array<T & { line: string }> {
  const seen = new Set<string>();
  const out: Array<T & { line: string }> = [];
  for (const item of items) {
    const line = item.line;
    if (!line || seen.has(line)) continue;
    seen.add(line);
    out.push({ ...item, line });
    if (out.length >= limit) break;
  }
  return out;
}

function buildMemoryProfileCard(params: {
  business: unknown[];
  facts: unknown[];
  sessions: unknown[];
  includeSessionSummaries: boolean;
}): MemoryProfileCard {
  const businessRows = params.business
    .map((row, index) => ({ row: asRecord(row), index }))
    .filter((item): item is { row: Record<string, unknown>; index: number } => item.row !== null);
  const factRows = params.facts
    .map((row, index) => ({ row: asRecord(row), index }))
    .filter((item): item is { row: Record<string, unknown>; index: number } => item.row !== null);
  const sessionRows = params.sessions
    .map((row, index) => ({ row: asRecord(row), index }))
    .filter((item): item is { row: Record<string, unknown>; index: number } => item.row !== null);

  const profileSummaryItems = uniqueProfileItems(
    businessRows
      .slice()
      .sort((left, right) => businessProfileScore(right.row) - businessProfileScore(left.row) || left.index - right.index)
      .map((item) => ({
        ...item,
        sourceKind: "business_context" as const,
        line: businessProfileLine(item.row),
      })),
    3
  );
  const profileSummary = profileSummaryItems.map((item) => item.line);

  const factLineItems = factRows.map((item) => ({
    ...item,
    sourceKind: "fact" as const,
    line: factProfileLine(item.row),
  }));
  const currentFactItems = factLineItems.filter((item) => item.line && CURRENT_WORK_PATTERN.test(item.line));
  const workingItems = uniqueProfileItems([...currentFactItems, ...factLineItems], 3);
  const workingNow = workingItems.map((item) => item.line);

  const guardrailItems = uniqueProfileItems(
    [
      ...businessRows.map((item) => ({
        ...item,
        sourceKind: "business_context" as const,
        line: businessProfileLine(item.row),
      })),
      ...factLineItems,
    ].filter((item) => item.line && GUARDRAIL_PATTERN.test(item.line)),
    3
  );
  const doNotRepeat = guardrailItems.map((item) => item.line);

  const sourceReceipts: MemoryProfileCardReceipt[] = [];
  const receiptIds = new Set<string>();
  for (const item of [...profileSummaryItems.slice(0, 2), ...workingItems.slice(0, 2), ...guardrailItems.slice(0, 1)]) {
    const receipt = profileReceipt(item.row, item.sourceKind, item.index);
    if (receiptIds.has(receipt.memory_id)) continue;
    receiptIds.add(receipt.memory_id);
    sourceReceipts.push(receipt);
    if (sourceReceipts.length >= 4) break;
  }
  if (params.includeSessionSummaries && sourceReceipts.length < 5) {
    const session = sessionRows[0];
    if (session) sourceReceipts.push(profileReceipt(session.row, "session_summary", session.index));
  }

  const sessionHealth = params.includeSessionSummaries
    ? `${Math.min(params.sessions.length, 3)} of ${params.sessions.length} recent session summaries returned`
    : "Recent session bodies omitted in lite mode";

  return {
    profile_summary: profileSummary,
    working_now: workingNow,
    do_not_repeat: doNotRepeat,
    timezone_context: buildTimezoneContext(params.business),
    memory_health: [
      `${Math.min(params.business.length, 6)} of ${params.business.length} business context rows returned`,
      `${Math.min(params.facts.length, 12)} of ${params.facts.length} active facts returned`,
      sessionHealth,
    ],
    source_receipts: sourceReceipts,
  };
}

export function normalizeActiveFactsForLoadMemory(value: unknown): unknown {
  const context = asRecord(value);
  if (!context || !Array.isArray(context.active_facts)) return value;
  const originalFacts = context.active_facts as unknown[];

  const activeFacts = originalFacts
    .filter((row) => !hasInvalidatedAtSet(row))
    .slice()
    .sort((left, right) => {
      const penaltyDelta = activeFactPenalty(left) - activeFactPenalty(right);
      if (penaltyDelta !== 0) return penaltyDelta;

      const confidenceDelta = factConfidence(right) - factConfidence(left);
      if (confidenceDelta !== 0) return confidenceDelta;

      return factTimestamp(right) - factTimestamp(left);
    });

  const unchanged =
    activeFacts.length === originalFacts.length &&
    activeFacts.every((row, index) => row === originalFacts[index]);
  if (unchanged) return value;
  return { ...context, active_facts: activeFacts };
}

export function compactStartupContextForStrictClients(
  value: unknown,
  includeSessionSummaries = false
): unknown {
  const context = asRecord(normalizeActiveFactsForLoadMemory(value));
  if (!context) return value;

  const out: Record<string, unknown> = { ...context };
  const business = Array.isArray(context.business_context) ? context.business_context : [];
  const library = Array.isArray(context.knowledge_library_index) ? context.knowledge_library_index : [];
  const sessions = Array.isArray(context.recent_sessions) ? context.recent_sessions : [];
  const facts = Array.isArray(context.active_facts) ? context.active_facts : [];

  out.business_context = business.slice(0, 6).map((row) => {
    const r = asRecord(row) ?? {};
    return { category: r.category, key: r.key, value: compactJsonValue(r.value, 150), priority: r.priority };
  });
  out.knowledge_library_index = library.slice(0, 6).map((row) => {
    const r = asRecord(row) ?? {};
    return { slug: r.slug, title: typeof r.title === "string" ? capText(r.title, 90) : r.title, category: r.category, tags: compactStringArray(r.tags, 3, 32), updated_at: r.updated_at };
  });
  out.recent_sessions = includeSessionSummaries
    ? sessions.slice(0, 3).map((row) => {
        const r = asRecord(row) ?? {};
        return {
          session_id: r.session_id,
          platform: r.platform,
          summary: typeof r.summary === "string" ? capText(r.summary, 350) : r.summary,
          decisions: compactStringArray(r.decisions),
          open_loops: compactStringArray(r.open_loops),
          topics: compactStringArray(r.topics),
          created_at: r.created_at,
        };
      })
    : [];
  out.active_facts = facts.slice(0, 12).map((row) => {
    const r = asRecord(row) ?? {};
    return { fact: typeof r.fact === "string" ? capText(r.fact, 80) : r.fact, category: r.category, confidence: r.confidence, created_at: r.created_at };
  });
  out.profile_card = buildMemoryProfileCard({ business, facts, sessions, includeSessionSummaries });
  out.response_bounds = {
    compact: true,
    business_context_returned: Math.min(business.length, 6),
    knowledge_library_returned: Math.min(library.length, 6),
    recent_sessions_returned: includeSessionSummaries ? Math.min(sessions.length, 3) : 0,
    recent_sessions_available_in_loaded_window: sessions.length,
    active_facts_returned: Math.min(facts.length, 12),
    active_facts_available_in_loaded_window: facts.length,
  };
  return out;
}

export function compactSearchMemoryForStrictClients(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((row) => {
    const r = asRecord(row);
    if (!r) return row;
    const out = { ...r };
    for (const key of ["content", "summary", "fact"]) {
      if (typeof out[key] === "string") out[key] = capText(out[key] as string, 800);
    }
    return out;
  });
}

export const MEMORY_HANDLERS: Record<string, (args: Args) => Promise<unknown>> = {
  async get_startup_context(args) {
    const db = await getBackend();
    const slug = typeof args.agent_slug === "string" ? args.agent_slug : undefined;
    const id = typeof args.agent_id === "string" ? args.agent_id : undefined;
    const fullContent = bool(args.full_content, false);
    const lite = bool(args.lite, true);
    const sessionCount = fullContent ? num(args.num_sessions, 5) : Math.min(num(args.num_sessions, 3), 3);

    const [baseContext, resolved] = await Promise.all([
      db.getStartupContext(sessionCount),
      resolveAgent({ agent_slug: slug, agent_id: id }),
    ]);
    const safeBaseContext = normalizeActiveFactsForLoadMemory(baseContext);
    const boundedContext = fullContent
      ? safeBaseContext
      : compactStartupContextForStrictClients(safeBaseContext, !lite);

    // Optional: if the client passed the list of other tools in this session,
    // classify them and attach tool_guidance so the agent can nudge the user.
    const sessionTools = Array.isArray(args.session_tools)
      ? args.session_tools.map(String).filter(Boolean)
      : [];

    let tool_guidance: unknown = undefined;
    if (sessionTools.length > 0) {
      const detections = classifyTools(sessionTools);
      const nudgeable = await reportToolDetections(detections);
      tool_guidance = buildToolGuidance(detections, nudgeable);
    }

    if (!resolved) {
      if (tool_guidance === undefined) return boundedContext;
      return { ...(boundedContext as Record<string, unknown>), tool_guidance };
    }

    const scoped = filterContextByLayers(boundedContext, resolved.enabled_memory_layers);
    const result: Record<string, unknown> = {
      agent: {
        id: resolved.agent.id,
        slug: resolved.agent.slug,
        name: resolved.agent.name,
        role: resolved.agent.role,
        description: resolved.agent.description,
        system_prompt: fullContent ? resolved.agent.system_prompt : capText(resolved.agent.system_prompt ?? "", 1000),
        is_default: resolved.agent.is_default,
      },
      enabled_tools: resolved.enabled_tools,
      enabled_memory_layers: resolved.enabled_memory_layers,
      memory:
        scoped && typeof scoped === "object" ? scoped : { _raw: baseContext },
    };
    if (tool_guidance !== undefined) result.tool_guidance = tool_guidance;
    return result;
  },

  async search_memory(args) {
    const db = await getBackend();
    const asOf = typeof args.as_of === "string" ? args.as_of : undefined;
    const query = str(args.query);
    const results = await db.searchMemory(query, num(args.max_results, 10), asOf);
    const boundedResults = bool(args.full_content, false)
      ? results
      : compactSearchMemoryForStrictClients(results);
    // Phase 1 Wizard wrap: opt-in card alongside the existing array payload.
    // Defaults off to keep backward compatibility for current consumers.
    if (bool(args.include_card, false)) {
      return { results: boundedResults, card: buildSearchMemoryCard(query, boundedResults) };
    }
    return boundedResults;
  },

  async search_facts(args) {
    const db = await getBackend();
    return db.searchFacts(str(args.query));
  },

  async search_library(args) {
    const db = await getBackend();
    return db.searchLibrary(str(args.query));
  },

  async get_library_doc(args) {
    const db = await getBackend();
    return db.getLibraryDoc(str(args.slug));
  },

  async list_library() {
    const db = await getBackend();
    return db.listLibrary();
  },

  async write_session_summary(args) {
    const db = await getBackend();
    const result = await db.writeSessionSummary({
      session_id: str(args.session_id),
      summary: str(args.summary),
      topics: arr(args.topics),
      open_loops: arr(args.open_loops),
      decisions: arr(args.decisions),
      platform: str(args.platform, "claude-code"),
      duration_minutes: typeof args.duration_minutes === "number" ? args.duration_minutes : undefined,
    });
    const hash = currentApiKeyHash();
    if (hash) {
      void emitSignal({
        apiKeyHash: hash,
        tool: "memory",
        action: "session_saved",
        severity: "info",
        summary: "Session summary saved to memory",
        deepLink: "/admin/memory?tab=sessions",
      });
    }
    return result;
  },

  async add_fact(args) {
    const db = await getBackend();
    const result = await db.addFact({
      fact: str(args.fact),
      category: str(args.category, "general"),
      confidence: num(args.confidence, 0.9),
      source_session_id: typeof args.source_session_id === "string" ? args.source_session_id : undefined,
      valid_from: typeof args.valid_from === "string" ? args.valid_from : undefined,
      extractor_id: typeof args.extractor_id === "string" ? args.extractor_id : undefined,
      prompt_version: typeof args.prompt_version === "string" ? args.prompt_version : undefined,
      model_id: typeof args.model_id === "string" ? args.model_id : undefined,
      preserve_as_blob: typeof args.preserve_as_blob === "boolean" ? args.preserve_as_blob : false,
      commit_sha: typeof args.commit_sha === "string" ? args.commit_sha : undefined,
      pr_number: typeof args.pr_number === "number" ? Math.floor(args.pr_number) : undefined,
    });
    const hash = currentApiKeyHash();
    if (hash) {
      const preview = str(args.fact).slice(0, 80);
      void emitSignal({
        apiKeyHash: hash,
        tool: "memory",
        action: "fact_saved",
        severity: "info",
        summary: preview ? `Fact saved: ${preview}` : "Fact saved to memory",
        deepLink: "/admin/memory?tab=facts",
      });
    }
    return result;
  },

  async supersede_fact(args) {
    const db = await getBackend();
    const newId = await db.supersedeFact(
      str(args.old_fact_id),
      str(args.new_fact_text),
      typeof args.new_category === "string" ? args.new_category : undefined,
      typeof args.new_confidence === "number" ? args.new_confidence : undefined,
    );
    return { new_fact_id: newId };
  },

  async log_conversation(args) {
    const db = await getBackend();
    const receipt = await db.logConversation({
      session_id: str(args.session_id),
      role: str(args.role),
      content: str(args.content),
      has_code: bool(args.has_code),
    });
    return receipt;
  },

  async get_conversation_detail(args) {
    const db = await getBackend();
    return db.getConversationDetail(str(args.session_id));
  },

  async store_code(args) {
    const db = await getBackend();
    return db.storeCode({
      session_id: str(args.session_id),
      language: str(args.language, "typescript"),
      filename: typeof args.filename === "string" ? args.filename : undefined,
      content: str(args.code || args.content),
      description: typeof args.description === "string" ? args.description : undefined,
    });
  },

  async get_business_context() {
    const db = await getBackend();
    return db.getBusinessContext();
  },

  async set_business_context(args) {
    const db = await getBackend();
    await db.setBusinessContext(
      str(args.category),
      str(args.key),
      args.value,
      typeof args.priority === "number" ? args.priority : undefined,
    );
    return { set: true, category: str(args.category), key: str(args.key) };
  },

  async upsert_library_doc(args) {
    const db = await getBackend();
    const msg = await db.upsertLibraryDoc({
      slug: str(args.slug),
      title: str(args.title),
      category: str(args.category, "reference"),
      content: str(args.content),
      tags: arr(args.tags),
    });
    return { message: msg };
  },

  async refresh_taxonomy_snapshots(args) {
    const db = await getBackend();
    return db.refreshTaxonomySnapshots({
      dry_run: bool(args.dry_run, false),
      max_sources: num(args.max_sources, 80),
      max_snapshots: num(args.max_snapshots, 12),
      max_sources_per_snapshot: num(args.max_sources_per_snapshot, 8),
    });
  },

  async embedding_state() {
    const { getEmbeddingState } = await import("./embeddings.js");
    return getEmbeddingState();
  },

  async manage_decay() {
    const db = await getBackend();
    return db.manageDecay();
  },

  async memory_status() {
    const db = await getBackend();
    return db.getMemoryStatus();
  },

  async invalidate_fact(args) {
    const db = await getBackend();
    return db.invalidateFact({
      fact_id: str(args.fact_id),
      reason: typeof args.reason === "string" ? args.reason : undefined,
      session_id: typeof args.session_id === "string" ? args.session_id : undefined,
    });
  },
};

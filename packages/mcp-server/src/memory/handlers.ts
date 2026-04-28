/**
 * Memory operation handlers for @unclick/mcp-server.
 *
 * Wraps the 17 memory operations (get_startup_context, search_memory, add_fact,
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

export function compactStartupContextForStrictClients(
  value: unknown,
  includeSessionSummaries = false
): unknown {
  const context = asRecord(value);
  if (!context) return value;

  const out: Record<string, unknown> = { ...context };
  const business = Array.isArray(context.business_context) ? context.business_context : [];
  const library = Array.isArray(context.knowledge_library_index) ? context.knowledge_library_index : [];
  const sessions = Array.isArray(context.recent_sessions) ? context.recent_sessions : [];
  const facts = Array.isArray(context.active_facts) ? context.active_facts : [];

  out.business_context = business.slice(0, 6).map((row) => {
    const r = asRecord(row) ?? {};
    return { category: r.category, key: r.key, value: compactJsonValue(r.value, 250), priority: r.priority };
  });
  out.knowledge_library_index = library.slice(0, 6).map((row) => {
    const r = asRecord(row) ?? {};
    return { slug: r.slug, title: typeof r.title === "string" ? capText(r.title, 120) : r.title, category: r.category, tags: compactStringArray(r.tags, 4, 50), updated_at: r.updated_at };
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
    return { fact: typeof r.fact === "string" ? capText(r.fact, 140) : r.fact, category: r.category, confidence: r.confidence, created_at: r.created_at };
  });
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
    const boundedContext = fullContent
      ? baseContext
      : compactStartupContextForStrictClients(baseContext, !lite);

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
    await db.logConversation({
      session_id: str(args.session_id),
      role: str(args.role),
      content: str(args.content),
      has_code: bool(args.has_code),
    });
    return { logged: true };
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

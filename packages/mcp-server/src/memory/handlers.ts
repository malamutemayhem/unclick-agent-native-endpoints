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

export const MEMORY_HANDLERS: Record<string, (args: Args) => Promise<unknown>> = {
  async get_startup_context(args) {
    const db = await getBackend();
    const slug = typeof args.agent_slug === "string" ? args.agent_slug : undefined;
    const id = typeof args.agent_id === "string" ? args.agent_id : undefined;

    const [baseContext, resolved] = await Promise.all([
      db.getStartupContext(num(args.num_sessions, 5)),
      resolveAgent({ agent_slug: slug, agent_id: id }),
    ]);

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
      if (tool_guidance === undefined) return baseContext;
      return { ...(baseContext as Record<string, unknown>), tool_guidance };
    }

    const scoped = filterContextByLayers(baseContext, resolved.enabled_memory_layers);
    const result: Record<string, unknown> = {
      agent: {
        id: resolved.agent.id,
        slug: resolved.agent.slug,
        name: resolved.agent.name,
        role: resolved.agent.role,
        description: resolved.agent.description,
        system_prompt: resolved.agent.system_prompt,
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
    return db.searchMemory(str(args.query), num(args.max_results, 10), asOf);
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
    return db.writeSessionSummary({
      session_id: str(args.session_id),
      summary: str(args.summary),
      topics: arr(args.topics),
      open_loops: arr(args.open_loops),
      decisions: arr(args.decisions),
      platform: str(args.platform, "claude-code"),
      duration_minutes: typeof args.duration_minutes === "number" ? args.duration_minutes : undefined,
    });
  },

  async add_fact(args) {
    const db = await getBackend();
    return db.addFact({
      fact: str(args.fact),
      category: str(args.category, "general"),
      confidence: num(args.confidence, 0.9),
      source_session_id: typeof args.source_session_id === "string" ? args.source_session_id : undefined,
      valid_from: typeof args.valid_from === "string" ? args.valid_from : undefined,
      extractor_id: typeof args.extractor_id === "string" ? args.extractor_id : undefined,
      prompt_version: typeof args.prompt_version === "string" ? args.prompt_version : undefined,
      model_id: typeof args.model_id === "string" ? args.model_id : undefined,
      preserve_as_blob: typeof args.preserve_as_blob === "boolean" ? args.preserve_as_blob : false,
    });
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

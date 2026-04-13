/**
 * Memory operation handlers for @unclick/mcp-server.
 *
 * Wraps the 17 memory operations (get_startup_context, search_memory, add_fact,
 * write_session_summary, etc.) as plain async functions that take a single
 * params object. Used by both direct MCP tools and the unclick_call meta-tool.
 */

import { getBackend } from "./db.js";

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
    return db.getStartupContext(num(args.num_sessions, 5));
  },

  async search_memory(args) {
    const db = await getBackend();
    return db.searchMemory(str(args.query), num(args.max_results, 10));
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
};

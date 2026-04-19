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

/**
 * Format any business_context entries with category="repository" as a clear
 * Repository Context block so the agent reads them as first-class project
 * knowledge rather than opaque JSON.
 */
function formatRepositoryContext(baseContext: unknown): string | null {
  if (!baseContext || typeof baseContext !== "object") return null;
  const bc = (baseContext as Record<string, unknown>).business_context;
  if (!Array.isArray(bc)) return null;
  const repoRows = bc.filter(
    (row): row is Record<string, unknown> =>
      typeof row === "object" && row !== null && (row as Record<string, unknown>).category === "repository",
  );
  if (repoRows.length === 0) return null;

  const lines = ["## Repository Context"];
  for (const row of repoRows) {
    const key = String(row.key ?? "");
    const raw = row.value;
    const value = typeof raw === "string" ? raw : JSON.stringify(raw);
    lines.push(`- ${key}: ${value}`);
  }
  return lines.join("\n");
}

const REPO_MAP_KEYS = [
  "stack",
  "deploy_branch",
  "deploy_process",
  "file_structure",
  "constraints",
  "gotchas",
  "conventions",
  "testing",
] as const;

export const MEMORY_HANDLERS: Record<string, (args: Args) => Promise<unknown>> = {
  async get_startup_context(args) {
    const db = await getBackend();
    const slug = typeof args.agent_slug === "string" ? args.agent_slug : undefined;
    const id = typeof args.agent_id === "string" ? args.agent_id : undefined;
    const projectSlug = str(args.project) || undefined;

    const [baseContext, resolved] = await Promise.all([
      db.getStartupContext(num(args.num_sessions, 5), projectSlug),
      resolveAgent({ agent_slug: slug, agent_id: id }),
    ]);

    const repoBlock = formatRepositoryContext(baseContext);

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
      const out: Record<string, unknown> = { ...(baseContext as Record<string, unknown>) };
      if (repoBlock) out.repository_context = repoBlock;
      if (tool_guidance !== undefined) out.tool_guidance = tool_guidance;
      return out;
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
    if (repoBlock) result.repository_context = repoBlock;
    if (tool_guidance !== undefined) result.tool_guidance = tool_guidance;
    return result;
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
      project: str(args.project) || undefined,
    });
  },

  async add_fact(args) {
    const db = await getBackend();
    return db.addFact({
      fact: str(args.fact),
      category: str(args.category, "general"),
      confidence: num(args.confidence, 0.9),
      source_session_id: typeof args.source_session_id === "string" ? args.source_session_id : undefined,
      project: str(args.project) || undefined,
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
      str(args.project) || undefined,
    );
    return { set: true, category: str(args.category), key: str(args.key) };
  },

  async save_repo_map(args) {
    const db = await getBackend();
    const projectSlug = str(args.project) || undefined;
    const written: string[] = [];
    for (const key of REPO_MAP_KEYS) {
      const raw = args[key];
      if (typeof raw !== "string" || raw.trim().length === 0) continue;
      await db.setBusinessContext("repository", key, raw, undefined, projectSlug);
      written.push(key);
    }
    return { written, project: projectSlug ?? null };
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

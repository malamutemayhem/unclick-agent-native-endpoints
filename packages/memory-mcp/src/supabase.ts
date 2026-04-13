/**
 * Supabase backend for UnClick Memory.
 *
 * Cloud mode: data lives in the user's own Supabase project (BYOD).
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type {
  MemoryBackend,
  SessionSummaryInput,
  FactInput,
  ConversationInput,
  CodeInput,
  LibraryDocInput,
} from "./types.js";

let client: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) environment variables. " +
      "Set these in your MCP config's env block."
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return client;
}

async function rpc<T = unknown>(fn: string, params: Record<string, unknown> = {}): Promise<T> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc(fn, params);
  if (error) throw new Error(`rpc(${fn}) failed: ${error.message}`);
  return data as T;
}

function now(): string {
  return new Date().toISOString();
}

function truncate(s: string, max = 8000): string {
  return s.length > max ? s.slice(0, max) + "\n...[truncated]" : s;
}

export class SupabaseBackend implements MemoryBackend {
  constructor() {
    // Verify connection on creation
    getSupabase();
    console.error("UnClick Memory: Supabase cloud mode");
  }

  async getStartupContext(numSessions: number): Promise<unknown> {
    return rpc<Record<string, unknown>>("get_startup_context", { num_sessions: numSessions });
  }

  async searchMemory(query: string, maxResults: number): Promise<unknown> {
    return rpc("search_memory", { search_query: query, max_results: maxResults });
  }

  async searchFacts(query: string): Promise<unknown> {
    return rpc("search_facts", { search_query: query });
  }

  async searchLibrary(query: string): Promise<unknown> {
    return rpc("search_library", { search_query: query });
  }

  async getLibraryDoc(slug: string): Promise<unknown> {
    return rpc("get_library_doc", { doc_slug: slug });
  }

  async listLibrary(): Promise<unknown> {
    return rpc("list_library");
  }

  async writeSessionSummary(data: SessionSummaryInput): Promise<{ id: string }> {
    const sb = getSupabase();
    const { data: row, error } = await sb.from("session_summaries").insert({
      session_id: data.session_id,
      summary: data.summary,
      topics: data.topics,
      open_loops: data.open_loops,
      decisions: data.decisions,
      platform: data.platform,
      duration_minutes: data.duration_minutes,
    }).select().single();
    if (error) throw error;
    return { id: row.id };
  }

  async addFact(data: FactInput): Promise<{ id: string }> {
    const sb = getSupabase();
    const { data: row, error } = await sb.from("extracted_facts").insert({
      fact: data.fact,
      category: data.category,
      confidence: data.confidence,
      source_session_id: data.source_session_id ?? null,
      source_type: "manual",
      status: "active",
      decay_tier: "hot",
      last_accessed: now(),
    }).select().single();
    if (error) throw error;
    return { id: row.id };
  }

  async supersedeFact(oldId: string, newText: string, category?: string, confidence?: number): Promise<string> {
    const params: Record<string, unknown> = { old_fact_id: oldId, new_fact_text: newText };
    if (category !== undefined) params.new_category = category;
    if (confidence !== undefined) params.new_confidence = confidence;
    const data = await rpc("supersede_fact", params);
    return String(data);
  }

  async logConversation(data: ConversationInput): Promise<void> {
    const sb = getSupabase();
    const { error } = await sb.from("conversation_log").insert({
      session_id: data.session_id,
      role: data.role,
      content: truncate(data.content),
      has_code: data.has_code,
    });
    if (error) throw error;
  }

  async getConversationDetail(sessionId: string): Promise<unknown> {
    return rpc("get_conversation_detail", { sid: sessionId });
  }

  async storeCode(data: CodeInput): Promise<{ id: string }> {
    const sb = getSupabase();
    const { data: row, error } = await sb.from("code_dumps").insert({
      session_id: data.session_id,
      language: data.language,
      filename: data.filename ?? null,
      content: truncate(data.content, 50000),
      description: data.description ?? null,
    }).select().single();
    if (error) throw error;
    return { id: row.id };
  }

  async getBusinessContext(): Promise<unknown[]> {
    const sb = getSupabase();
    const { data, error } = await sb.from("business_context").select("*").order("category").order("key");
    if (error) throw error;
    return data ?? [];
  }

  async setBusinessContext(category: string, key: string, value: unknown, priority?: number): Promise<void> {
    const sb = getSupabase();
    const row: Record<string, unknown> = {
      category,
      key,
      value: typeof value === "string" ? (() => { try { return JSON.parse(value); } catch { return value; } })() : value,
      last_accessed: now(),
      decay_tier: "hot",
    };
    if (priority !== undefined) row.priority = priority;
    const { error } = await sb.from("business_context")
      .upsert(row, { onConflict: "category,key" })
      .select().single();
    if (error) throw error;
  }

  async upsertLibraryDoc(data: LibraryDocInput): Promise<string> {
    const sb = getSupabase();
    const { data: existing } = await sb.from("knowledge_library")
      .select("id, version").eq("slug", data.slug).single();

    if (existing) {
      // DB trigger auto-archives old content and bumps version
      const { error } = await sb.from("knowledge_library").update({
        title: data.title,
        category: data.category,
        content: data.content,
        tags: data.tags,
        last_accessed: now(),
        decay_tier: "hot",
      }).eq("id", existing.id);
      if (error) throw error;
      return `Library doc updated: "${data.title}" (v${existing.version + 1})`;
    } else {
      const { error } = await sb.from("knowledge_library").insert({
        slug: data.slug,
        title: data.title,
        category: data.category,
        content: data.content,
        tags: data.tags,
        version: 1,
        decay_tier: "hot",
        last_accessed: now(),
      });
      if (error) throw error;
      return `Library doc created: "${data.title}" (v1)`;
    }
  }

  async manageDecay(): Promise<unknown> {
    return rpc("manage_decay");
  }

  async getMemoryStatus(): Promise<unknown> {
    const sb = getSupabase();
    const tables = ["business_context", "knowledge_library", "session_summaries", "extracted_facts", "conversation_log", "code_dumps"];
    const counts: Record<string, unknown> = {};
    for (const table of tables) {
      const { count } = await sb.from(table).select("*", { count: "exact", head: true });
      counts[table] = count;
    }
    const { data: factTiers } = await sb.from("extracted_facts").select("decay_tier").eq("status", "active");
    const tiers = { hot: 0, warm: 0, cold: 0 };
    for (const row of factTiers ?? []) {
      tiers[row.decay_tier as keyof typeof tiers]++;
    }
    return { mode: "supabase", table_counts: counts, fact_decay_tiers: tiers };
  }
}

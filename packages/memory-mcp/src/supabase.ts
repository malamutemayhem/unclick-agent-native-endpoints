/**
 * Supabase backend for UnClick Memory.
 *
 * Two tenancy modes:
 *
 *   BYOD     - data lives in the user's own Supabase project. Single-tenant
 *              tables (extracted_facts, session_summaries, ...) and the
 *              original RPC names. This is the default.
 *
 *   managed  - data lives in UnClick's central Supabase. Multi-tenant
 *              tables (mc_extracted_facts, mc_session_summaries, ...) where
 *              every row is tagged with api_key_hash. RPCs are mc_-prefixed
 *              and take p_api_key_hash as their first parameter.
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

function now(): string {
  return new Date().toISOString();
}

function truncate(s: string, max = 8000): string {
  return s.length > max ? s.slice(0, max) + "\n...[truncated]" : s;
}

export type Tenancy =
  | { mode: "byod" }
  | { mode: "managed"; apiKeyHash: string };

export interface SupabaseBackendConfig {
  url?: string;
  serviceRoleKey?: string;
  tenancy?: Tenancy;
}

interface TableNames {
  extracted_facts: string;
  session_summaries: string;
}

const BYOD_TABLES: TableNames = {
  extracted_facts: "extracted_facts",
  session_summaries: "session_summaries",
};

const MANAGED_TABLES: TableNames = {
  extracted_facts: "mc_extracted_facts",
  session_summaries: "mc_session_summaries",
};

export class SupabaseBackend implements MemoryBackend {
  private sb: SupabaseClient;
  private tenancy: Tenancy;
  private tables: TableNames;

  constructor(config?: SupabaseBackendConfig) {
    if (config?.url && config?.serviceRoleKey) {
      this.sb = createClient(config.url, config.serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    } else {
      this.sb = getSupabase();
    }
    this.tenancy = config?.tenancy ?? { mode: "byod" };
    this.tables = this.tenancy.mode === "managed" ? MANAGED_TABLES : BYOD_TABLES;
    console.error(
      `UnClick Memory: Supabase ${this.tenancy.mode === "managed" ? "managed cloud" : "BYOD"} mode`
    );
  }

  /** Adds api_key_hash to a row in managed mode; passes through in BYOD. */
  private withTenancy<T extends Record<string, unknown>>(row: T): T {
    if (this.tenancy.mode === "managed") {
      return { ...row, api_key_hash: this.tenancy.apiKeyHash };
    }
    return row;
  }

  private async rpc<T = unknown>(fn: string, params: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await this.sb.rpc(fn, params);
    if (error) throw new Error(`rpc(${fn}) failed: ${error.message}`);
    return data as T;
  }

  async getStartupContext(numSessions: number): Promise<unknown> {
    return this.rpc<Record<string, unknown>>("get_startup_context", { num_sessions: numSessions });
  }

  async searchMemory(query: string, maxResults: number): Promise<unknown> {
    // Hybrid lane: BM25 + pgvector RRF over extracted_facts and
    // session_summaries. Two well-known failure modes turn this into a
    // black hole and force a fallback:
    //
    //   1. Per-row embeddings are NULL (legacy facts, BYOD installs without
    //      backfill, or facts written before embedding wiring) so the vector
    //      lane drops them.
    //   2. plainto_tsquery('english', ...) tokenizes proper nouns and short
    //      identifiers ("Chris", "Bailey", "UnClick") in ways that don't
    //      align with the matching to_tsvector lexemes, so the keyword lane
    //      misses too. Both branches fail, hybrid returns [].
    //
    // To stop returning [] when matching content exists, we run a robust
    // ILIKE keyword fallback over the same tables whenever the hybrid call
    // throws OR returns an empty result.
    try {
      const { embedText } = await import("./embeddings.js");
      const embedding = await embedText(query);
      if (embedding) {
        const fn = this.tenancy.mode === "managed" ? "mc_search_memory_hybrid" : "search_memory_hybrid";
        const params: Record<string, unknown> = this.tenancy.mode === "managed"
          ? { p_api_key_hash: this.tenancy.apiKeyHash, p_search_query: query, p_query_embedding: embedding, p_max_results: maxResults }
          : { search_query: query, query_embedding: embedding, max_results: maxResults };
        const results = await this.rpc<unknown>(fn, params);
        if (Array.isArray(results) && results.length > 0) return results;
      }
    } catch (err) {
      console.error("[search_memory] hybrid search failed, falling back to keyword:", err);
    }
    return this.keywordFallback(query, maxResults);
  }

  /**
   * ILIKE-based keyword fallback over extracted_facts + session_summaries.
   * Used when hybrid retrieval returns []. Returns rows shaped to mirror
   * search_memory_hybrid so callers don't branch. Never widens RLS: tenant
   * scoping via api_key_hash is preserved when in managed mode.
   *
   * Phrase support: the query is tokenized on whitespace. Tokens shorter
   * than 2 chars or containing PostgREST .or() metacharacters are dropped.
   * We try AND-of-tokens first (every token must appear, in any order); if
   * that returns nothing we degrade to OR-of-tokens and rank rows by how
   * many tokens they contain so partial matches at least surface something.
   */
  private async keywordFallback(query: string, maxResults: number): Promise<unknown[]> {
    const tokens = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !/[,():]/.test(t));
    if (tokens.length === 0) return [];
    const patterns = tokens.map((t) => `%${t.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    const score = (text: string): number => {
      const lower = text.toLowerCase();
      let n = 0;
      for (const t of tokens) if (lower.includes(t)) n++;
      return n;
    };

    const runScan = async (mode: "and" | "or"): Promise<unknown[]> => {
      let factQ = this.sb
        .from(this.tables.extracted_facts)
        .select("id, fact, category, confidence, created_at")
        .eq("status", "active");
      let sessQ = this.sb
        .from(this.tables.session_summaries)
        .select("id, summary, created_at");

      if (mode === "and") {
        for (const p of patterns) {
          factQ = factQ.ilike("fact", p);
          sessQ = sessQ.ilike("summary", p);
        }
      } else {
        factQ = factQ.or(patterns.map((p) => `fact.ilike.${p}`).join(","));
        sessQ = sessQ.or(patterns.map((p) => `summary.ilike.${p}`).join(","));
      }
      if (this.tenancy.mode === "managed") {
        factQ = factQ.eq("api_key_hash", this.tenancy.apiKeyHash);
        sessQ = sessQ.eq("api_key_hash", this.tenancy.apiKeyHash);
      }
      factQ = factQ
        .order("confidence", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(maxResults);
      sessQ = sessQ.order("created_at", { ascending: false }).limit(maxResults);

      const [factsRes, sessRes] = await Promise.all([factQ, sessQ]);
      type FactRow = { id: string; fact: string; category: string; confidence: number; created_at: string };
      type SessRow = { id: string; summary: string; created_at: string };
      const facts = ((factsRes.data ?? []) as FactRow[]).map((r) => {
        const s = score(r.fact);
        return {
          id: r.id,
          source: "fact",
          content: r.fact,
          category: r.category,
          confidence: r.confidence,
          created_at: r.created_at,
          final_score: (s / tokens.length) * (r.confidence ?? 0),
          rrf_score: 0,
          kw_score: s,
          cosine_score: 0,
        };
      });
      const sessions = ((sessRes.data ?? []) as SessRow[]).map((r) => {
        const s = score(r.summary);
        return {
          id: r.id,
          source: "session",
          content: r.summary,
          category: "session",
          confidence: 1,
          created_at: r.created_at,
          final_score: (s / tokens.length) * 0.5,
          rrf_score: 0,
          kw_score: s,
          cosine_score: 0,
        };
      });
      return [...facts, ...sessions]
        .sort((a, b) => {
          const d = (b.final_score ?? 0) - (a.final_score ?? 0);
          return d !== 0 ? d : (b.created_at ?? "").localeCompare(a.created_at ?? "");
        })
        .slice(0, maxResults);
    };

    const andResults = await runScan("and");
    if (andResults.length > 0 || tokens.length < 2) return andResults;
    return runScan("or");
  }

  async searchFacts(query: string): Promise<unknown> {
    return this.rpc("search_facts", { search_query: query });
  }

  async searchLibrary(query: string): Promise<unknown> {
    return this.rpc("search_library", { search_query: query });
  }

  async getLibraryDoc(slug: string): Promise<unknown> {
    return this.rpc("get_library_doc", { doc_slug: slug });
  }

  async listLibrary(): Promise<unknown> {
    return this.rpc("list_library");
  }

  async writeSessionSummary(data: SessionSummaryInput): Promise<{ id: string }> {
    const { data: row, error } = await this.sb
      .from(this.tables.session_summaries)
      .insert(
        this.withTenancy({
          session_id: data.session_id,
          summary: data.summary,
          topics: data.topics,
          open_loops: data.open_loops,
          decisions: data.decisions,
          platform: data.platform,
          duration_minutes: data.duration_minutes,
        })
      )
      .select()
      .single();
    if (error) throw error;
    // Embed the summary so it joins the vector lane immediately. Without
    // this, every newly inserted row has NULL embedding and only the
    // keyword lane can find it. Fire-and-forget so embedding latency /
    // OpenAI outages never block the primary insert.
    this.embedAndStore(this.tables.session_summaries, row.id, data.summary).catch(() => {});
    return { id: row.id };
  }

  async addFact(data: FactInput): Promise<{ id: string }> {
    const { data: row, error } = await this.sb
      .from(this.tables.extracted_facts)
      .insert(
        this.withTenancy({
          fact: data.fact,
          category: data.category,
          confidence: data.confidence,
          source_session_id: data.source_session_id ?? null,
          source_type: "manual",
          status: "active",
          decay_tier: "hot",
          last_accessed: now(),
        })
      )
      .select()
      .single();
    if (error) throw error;
    // Embed the fact so it joins the vector lane immediately. Same
    // motivation as writeSessionSummary above. Fire-and-forget.
    this.embedAndStore(this.tables.extracted_facts, row.id, data.fact).catch(() => {});
    return { id: row.id };
  }

  private async embedAndStore(table: string, id: string, text: string): Promise<void> {
    const { embedText, EMBEDDING_MODEL } = await import("./embeddings.js");
    const vec = await embedText(text);
    if (!vec) return;
    await this.sb
      .from(table)
      .update({
        embedding: JSON.stringify(vec),
        embedding_model: EMBEDDING_MODEL,
        embedding_created_at: now(),
      })
      .eq("id", id);
  }

  async supersedeFact(oldId: string, newText: string, category?: string, confidence?: number): Promise<string> {
    const params: Record<string, unknown> = { old_fact_id: oldId, new_fact_text: newText };
    if (category !== undefined) params.new_category = category;
    if (confidence !== undefined) params.new_confidence = confidence;
    const data = await this.rpc("supersede_fact", params);
    return String(data);
  }

  async logConversation(data: ConversationInput): Promise<void> {
    const { error } = await this.sb.from("conversation_log").insert({
      session_id: data.session_id,
      role: data.role,
      content: truncate(data.content),
      has_code: data.has_code,
    });
    if (error) throw error;
  }

  async getConversationDetail(sessionId: string): Promise<unknown> {
    return this.rpc("get_conversation_detail", { sid: sessionId });
  }

  async storeCode(data: CodeInput): Promise<{ id: string }> {
    const { data: row, error } = await this.sb.from("code_dumps").insert({
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
    const { data, error } = await this.sb.from("business_context").select("*").order("category").order("key");
    if (error) throw error;
    return data ?? [];
  }

  async setBusinessContext(category: string, key: string, value: unknown, priority?: number): Promise<void> {
    const row: Record<string, unknown> = {
      category,
      key,
      value: typeof value === "string" ? (() => { try { return JSON.parse(value); } catch { return value; } })() : value,
      last_accessed: now(),
      decay_tier: "hot",
    };
    if (priority !== undefined) row.priority = priority;
    const { error } = await this.sb.from("business_context")
      .upsert(row, { onConflict: "category,key" })
      .select().single();
    if (error) throw error;
  }

  async upsertLibraryDoc(data: LibraryDocInput): Promise<string> {
    const { data: existing } = await this.sb.from("knowledge_library")
      .select("id, version").eq("slug", data.slug).single();

    if (existing) {
      // DB trigger auto-archives old content and bumps version
      const { error } = await this.sb.from("knowledge_library").update({
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
      const { error } = await this.sb.from("knowledge_library").insert({
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
    return this.rpc("manage_decay");
  }

  async getMemoryStatus(): Promise<unknown> {
    const tables = ["business_context", "knowledge_library", "session_summaries", "extracted_facts", "conversation_log", "code_dumps"];
    const counts: Record<string, unknown> = {};
    for (const table of tables) {
      const { count } = await this.sb.from(table).select("*", { count: "exact", head: true });
      counts[table] = count;
    }
    const { data: factTiers } = await this.sb.from("extracted_facts").select("decay_tier").eq("status", "active");
    const tiers = { hot: 0, warm: 0, cold: 0 };
    for (const row of factTiers ?? []) {
      tiers[row.decay_tier as keyof typeof tiers]++;
    }
    return { mode: this.tenancy.mode === "managed" ? "supabase-managed" : "supabase-byod", table_counts: counts, fact_decay_tiers: tiers };
  }
}

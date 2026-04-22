/**
 * Supabase backend for UnClick Memory.
 *
 * Two tenancy modes:
 *
 *   BYOD     - data lives in the user's own Supabase project. Single-tenant
 *              tables (business_context, extracted_facts, ...) and the
 *              original RPC names. This is what the wizard (memory-admin
 *              setup) installs into a user's Supabase.
 *
 *   managed  - data lives in UnClick's central Supabase. Multi-tenant
 *              tables (mc_business_context, mc_extracted_facts, ...) where
 *              every row is tagged with api_key_hash. RPCs are mc_-prefixed
 *              and take p_api_key_hash as their first parameter. The backend
 *              is responsible for filtering / inserting api_key_hash on
 *              every operation.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import type {
  MemoryBackend,
  SessionSummaryInput,
  FactInput,
  InvalidateFactInput,
  ConversationInput,
  CodeInput,
  LibraryDocInput,
} from "./types.js";

function contentHash(text: string): string {
  return createHash("sha256").update(text.toLowerCase().trim(), "utf8").digest("hex");
}

async function extractAtomicFacts(text: string): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [text];
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              'Extract 3-10 atomic facts from the following text. Each fact must be a single, self-contained statement. Return ONLY a JSON object: {"facts": ["fact1", "fact2", ...]}',
          },
          { role: "user", content: text.slice(0, 4000) },
        ],
        response_format: { type: "json_object" },
        max_tokens: 600,
      }),
    });
    if (!res.ok) return [text];
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { facts?: unknown[] };
    if (Array.isArray(parsed.facts) && parsed.facts.length > 0) {
      return (parsed.facts as unknown[]).map(String).filter(Boolean);
    }
    return [text];
  } catch {
    return [text];
  }
}

export type Tenancy =
  | { mode: "byod" }
  | { mode: "managed"; apiKeyHash: string };

export interface SupabaseBackendConfig {
  url: string;
  serviceRoleKey: string;
  tenancy: Tenancy;
}

interface TableNames {
  business_context: string;
  knowledge_library: string;
  knowledge_library_history: string;
  session_summaries: string;
  extracted_facts: string;
  conversation_log: string;
  code_dumps: string;
}

const BYOD_TABLES: TableNames = {
  business_context: "business_context",
  knowledge_library: "knowledge_library",
  knowledge_library_history: "knowledge_library_history",
  session_summaries: "session_summaries",
  extracted_facts: "extracted_facts",
  conversation_log: "conversation_log",
  code_dumps: "code_dumps",
};

const MANAGED_TABLES: TableNames = {
  business_context: "mc_business_context",
  knowledge_library: "mc_knowledge_library",
  knowledge_library_history: "mc_knowledge_library_history",
  session_summaries: "mc_session_summaries",
  extracted_facts: "mc_extracted_facts",
  conversation_log: "mc_conversation_log",
  code_dumps: "mc_code_dumps",
};

function now(): string {
  return new Date().toISOString();
}

function truncate(s: string, max = 8000): string {
  return s.length > max ? s.slice(0, max) + "\n...[truncated]" : s;
}

// ─── Free-tier caps ──────────────────────────────────────────────────────
// Starting values from the v2 build plan. Adjust with real data later.
// Pro tier removes all caps. Caps only apply in managed cloud mode (BYOD
// users own their database, so they manage their own quota).
export const FREE_TIER_CAPS = {
  storage_bytes: 50 * 1024 * 1024, // 50 MB
  facts: 5000,
} as const;

/**
 * Thrown when a free-tier user tries to write past their cap. The MCP
 * handlers surface the message verbatim back to the agent so the user
 * sees an actionable upgrade path.
 */
export class CapExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapExceededError";
  }
}

export class SupabaseBackend implements MemoryBackend {
  private client: SupabaseClient;
  private tenancy: Tenancy;
  private tables: TableNames;

  constructor(config: SupabaseBackendConfig) {
    if (!config.url || !config.serviceRoleKey) {
      throw new Error("SupabaseBackend requires url and serviceRoleKey");
    }
    this.client = createClient(config.url, config.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    this.tenancy = config.tenancy;
    this.tables = config.tenancy.mode === "managed" ? MANAGED_TABLES : BYOD_TABLES;
    console.error(
      `UnClick Memory: Supabase ${
        config.tenancy.mode === "managed" ? "managed cloud" : "BYOD"
      } mode`
    );
  }

  // ─── Tenancy helpers ─────────────────────────────────────────────────────

  /** Adds api_key_hash to a row in managed mode; passes through in BYOD. */
  private withTenancy<T extends Record<string, unknown>>(row: T): T {
    if (this.tenancy.mode === "managed") {
      return { ...row, api_key_hash: this.tenancy.apiKeyHash };
    }
    return row;
  }

  /**
   * Enforce free-tier caps on writes. Only runs in managed cloud mode.
   * BYOD users own their database, so caps don't apply. Pro tier (or any
   * non-free tier) skips the check.
   *
   * `kind` selects which cap to check first. Storage is always verified;
   * `kind: "fact"` additionally verifies the fact-count cap because
   * extracted_facts has a separate row count limit.
   */
  private async enforceCaps(kind: "fact" | "general"): Promise<void> {
    if (this.tenancy.mode !== "managed") return;
    const tier = (process.env.UNCLICK_TIER || "free").toLowerCase();
    if (tier !== "free") return;

    if (kind === "fact") {
      const { data, error } = await this.client.rpc("mc_get_fact_count", {
        p_api_key_hash: this.tenancy.apiKeyHash,
      });
      if (error) {
        // Fail open on counter errors so a transient DB hiccup doesn't
        // break legitimate writes. Log to stderr for observability.
        console.error("[memory] mc_get_fact_count failed:", error.message);
      } else if (typeof data === "number" && data >= FREE_TIER_CAPS.facts) {
        throw new CapExceededError(
          `Free tier limit reached: ${FREE_TIER_CAPS.facts.toLocaleString()} active ` +
            `facts. Upgrade to Pro for unlimited facts, or prune old facts ` +
            `via the Memory surface. Current count: ${data}.`
        );
      }
    }

    const { data: bytes, error: bytesErr } = await this.client.rpc(
      "mc_get_storage_bytes",
      { p_api_key_hash: this.tenancy.apiKeyHash }
    );
    if (bytesErr) {
      console.error("[memory] mc_get_storage_bytes failed:", bytesErr.message);
      return;
    }
    if (typeof bytes === "number" && bytes >= FREE_TIER_CAPS.storage_bytes) {
      const usedMb = (bytes / (1024 * 1024)).toFixed(1);
      throw new CapExceededError(
        `Free tier limit reached: ${usedMb} MB used of ` +
          `${FREE_TIER_CAPS.storage_bytes / (1024 * 1024)} MB. ` +
          `Upgrade to Pro for unlimited storage, or prune memory via ` +
          `the Memory surface.`
      );
    }
  }

  /** Calls an RPC, choosing the BYOD or managed name based on tenancy. */
  private async rpc<T = unknown>(
    byodName: string,
    byodParams: Record<string, unknown>,
    managedName: string,
    managedParams: Record<string, unknown>
  ): Promise<T> {
    const fn = this.tenancy.mode === "managed" ? managedName : byodName;
    const params =
      this.tenancy.mode === "managed"
        ? { p_api_key_hash: this.tenancy.apiKeyHash, ...managedParams }
        : byodParams;
    const { data, error } = await this.client.rpc(fn, params);
    if (error) throw new Error(`rpc(${fn}) failed: ${error.message}`);
    return data as T;
  }

  // ─── Memory operations ───────────────────────────────────────────────────

  async getStartupContext(numSessions: number): Promise<unknown> {
    const data = await this.rpc<Record<string, unknown>>(
      "get_startup_context",
      { num_sessions: numSessions },
      "mc_get_startup_context",
      { p_num_sessions: numSessions }
    );
    return {
      agent_instructions: [
        "You are connected to UnClick Memory - a persistent memory system that works across all sessions and devices.",
        "ALWAYS use this memory as your primary knowledge source. It has the user's rules, preferences, projects, and history.",
        "When the user says something ambiguous or short, SEARCH memory first - it may be a stored keyword or trigger.",
        "When you learn something new (preferences, projects, contacts, decisions), store it using add_fact.",
        "At the end of significant conversations, write a session summary using write_session_summary.",
        "Business context entries (loaded below) are standing rules. Follow them as if the user said them right now.",
        "Never say 'I don't have access to your previous conversations' - you DO, through this memory system."
      ].join("\n"),
      ...data,
    };
  }

  async searchMemory(query: string, maxResults: number, asOf?: string): Promise<unknown> {
    // Attempt hybrid RRF search (keyword + vector) with bi-temporal filter.
    // Falls back to keyword-only when OPENAI_API_KEY absent or RPC not deployed.
    try {
      const { embedText } = await import("./embeddings.js");
      const embedding = await embedText(query);
      if (embedding) {
        const results = await this.rpc(
          "search_memory_hybrid",
          { search_query: query, query_embedding: embedding, max_results: maxResults, as_of: asOf ?? null },
          "mc_search_memory_hybrid",
          { p_search_query: query, p_query_embedding: embedding, p_max_results: maxResults, p_as_of: asOf ?? null }
        );
        return results;
      }
    } catch (err) {
      console.error("[search_memory] hybrid search failed, falling back to keyword:", err);
    }

    return this.rpc(
      "search_memory",
      { search_query: query, max_results: maxResults },
      "mc_search_memory",
      { p_search_query: query, p_max_results: maxResults }
    );
  }

  async searchFacts(query: string): Promise<unknown> {
    return this.rpc(
      "search_facts",
      { search_query: query },
      "mc_search_facts",
      { p_search_query: query }
    );
  }

  async searchLibrary(query: string): Promise<unknown> {
    return this.rpc(
      "search_library",
      { search_query: query },
      "mc_search_library",
      { p_search_query: query }
    );
  }

  async getLibraryDoc(slug: string): Promise<unknown> {
    return this.rpc(
      "get_library_doc",
      { doc_slug: slug },
      "mc_get_library_doc",
      { p_doc_slug: slug }
    );
  }

  async listLibrary(): Promise<unknown> {
    return this.rpc("list_library", {}, "mc_list_library", {});
  }

  async writeSessionSummary(data: SessionSummaryInput): Promise<{ id: string }> {
    await this.enforceCaps("general");
    const { data: row, error } = await this.client
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
    return { id: row.id };
  }

  async addFact(data: FactInput): Promise<{ id: string }> {
    // preserve_as_blob: write raw body to canonical_docs, then extract+store atomic facts
    if (data.preserve_as_blob) {
      return this.saveBlob(data);
    }

    await this.enforceCaps("fact");

    const hash = contentHash(data.fact);

    // Exact-hash dedup: if a live fact with this hash already exists, return it
    const dupTable = this.tables.extracted_facts;
    let dupQuery = this.client
      .from(dupTable)
      .select("id")
      .eq("content_hash", hash)
      .is("invalidated_at", null)
      .limit(1);
    if (this.tenancy.mode === "managed") {
      dupQuery = dupQuery.eq("api_key_hash", this.tenancy.apiKeyHash);
    }
    const { data: existing } = await dupQuery.maybeSingle();
    if (existing) return { id: (existing as { id: string }).id };

    const { data: row, error } = await this.client
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
          content_hash: hash,
          valid_from: data.valid_from ?? now(),
          recorded_at: now(),
          extractor_id: data.extractor_id ?? "manual",
          prompt_version: data.prompt_version ?? null,
          model_id: data.model_id ?? null,
        })
      )
      .select()
      .single();
    if (error) throw error;

    // Append audit row (fire-and-forget; never blocks the main insert)
    this.writeFactAudit(row.id, "insert", { category: data.category }).catch(() => {});

    return { id: row.id };
  }

  private async saveBlob(data: FactInput): Promise<{ id: string; fact_ids?: string[] }> {
    await this.enforceCaps("general");

    const hash = contentHash(data.fact);
    const docTable = this.tenancy.mode === "managed" ? "mc_canonical_docs" : "canonical_docs";

    // Upsert canonical_doc (idempotent by content_hash)
    let docId: string;
    {
      let q = this.client.from(docTable).select("id").eq("content_hash", hash).limit(1);
      if (this.tenancy.mode === "managed") {
        q = q.eq("api_key_hash", this.tenancy.apiKeyHash);
      }
      const { data: existing } = await q.maybeSingle();
      if (existing) {
        docId = (existing as { id: string }).id;
      } else {
        const insertRow =
          this.tenancy.mode === "managed"
            ? { api_key_hash: this.tenancy.apiKeyHash, title: data.category, body: data.fact, content_hash: hash }
            : { title: data.category, body: data.fact, content_hash: hash };
        const { data: doc, error } = await this.client.from(docTable).insert(insertRow).select().single();
        if (error) throw error;
        docId = (doc as { id: string }).id;
      }
    }

    // Extract atomic facts (minimal extractor; Chunk 4 replaces with full pipeline)
    const atomicFacts = await extractAtomicFacts(data.fact);
    const factIds: string[] = [];

    for (const factText of atomicFacts) {
      const factHash = contentHash(factText);

      // Skip if already live
      let dupQ = this.client
        .from(this.tables.extracted_facts)
        .select("id")
        .eq("content_hash", factHash)
        .is("invalidated_at", null)
        .limit(1);
      if (this.tenancy.mode === "managed") {
        dupQ = dupQ.eq("api_key_hash", this.tenancy.apiKeyHash);
      }
      const { data: dup } = await dupQ.maybeSingle();
      if (dup) {
        factIds.push((dup as { id: string }).id);
        continue;
      }

      const { data: frow, error: ferr } = await this.client
        .from(this.tables.extracted_facts)
        .insert(
          this.withTenancy({
            fact: factText,
            category: data.category,
            confidence: Math.max(0, data.confidence - 0.05), // slight confidence discount
            source_session_id: data.source_session_id ?? null,
            source_type: "auto_extract",
            status: "active",
            decay_tier: "hot",
            last_accessed: now(),
            content_hash: factHash,
            valid_from: now(),
            recorded_at: now(),
            extractor_id: "auto-extract-v1",
            derived_from_doc_id: docId,
          })
        )
        .select()
        .single();
      if (ferr && (ferr as { code?: string }).code !== "23505") throw ferr;
      if (!ferr && frow) factIds.push((frow as { id: string }).id);
    }

    return { id: docId, fact_ids: factIds };
  }

  private async writeFactAudit(
    factId: string,
    op: "insert" | "update" | "invalidate",
    payload: Record<string, unknown>
  ): Promise<void> {
    const auditTable = this.tenancy.mode === "managed" ? "mc_facts_audit" : "facts_audit";
    await this.client.from(auditTable).insert({ fact_id: factId, op, payload, actor: "agent", at: now() });
  }

  async invalidateFact(input: InvalidateFactInput): Promise<{ invalidated_at: string }> {
    const result = await this.rpc<Array<{ invalidated_at: string }>>(
      "invalidate_fact",
      { p_fact_id: input.fact_id, p_reason: input.reason ?? null, p_session_id: input.session_id ?? null },
      "mc_invalidate_fact",
      { p_fact_id: input.fact_id, p_reason: input.reason ?? null, p_session_id: input.session_id ?? null }
    );
    const row = Array.isArray(result) ? result[0] : (result as { invalidated_at: string });
    return { invalidated_at: row.invalidated_at };
  }

  async supersedeFact(
    oldId: string,
    newText: string,
    category?: string,
    confidence?: number
  ): Promise<string> {
    if (this.tenancy.mode === "managed") {
      const params: Record<string, unknown> = {
        p_api_key_hash: this.tenancy.apiKeyHash,
        p_old_fact_id: oldId,
        p_new_fact_text: newText,
      };
      if (category !== undefined) params.p_new_category = category;
      if (confidence !== undefined) params.p_new_confidence = confidence;
      const { data, error } = await this.client.rpc("mc_supersede_fact", params);
      if (error) throw new Error(`rpc(mc_supersede_fact) failed: ${error.message}`);
      return String(data);
    }
    const params: Record<string, unknown> = {
      old_fact_id: oldId,
      new_fact_text: newText,
    };
    if (category !== undefined) params.new_category = category;
    if (confidence !== undefined) params.new_confidence = confidence;
    const { data, error } = await this.client.rpc("supersede_fact", params);
    if (error) throw new Error(`rpc(supersede_fact) failed: ${error.message}`);
    return String(data);
  }

  async logConversation(data: ConversationInput): Promise<void> {
    await this.enforceCaps("general");
    const { error } = await this.client
      .from(this.tables.conversation_log)
      .insert(
        this.withTenancy({
          session_id: data.session_id,
          role: data.role,
          content: truncate(data.content),
          has_code: data.has_code,
        })
      );
    if (error) throw error;
  }

  async getConversationDetail(sessionId: string): Promise<unknown> {
    return this.rpc(
      "get_conversation_detail",
      { sid: sessionId },
      "mc_get_conversation_detail",
      { p_session_id: sessionId }
    );
  }

  async storeCode(data: CodeInput): Promise<{ id: string }> {
    await this.enforceCaps("general");
    const { data: row, error } = await this.client
      .from(this.tables.code_dumps)
      .insert(
        this.withTenancy({
          session_id: data.session_id,
          language: data.language,
          filename: data.filename ?? null,
          content: truncate(data.content, 50000),
          description: data.description ?? null,
        })
      )
      .select()
      .single();
    if (error) throw error;
    return { id: row.id };
  }

  async getBusinessContext(): Promise<unknown[]> {
    let query = this.client
      .from(this.tables.business_context)
      .select("*")
      .order("category")
      .order("key");
    if (this.tenancy.mode === "managed") {
      query = query.eq("api_key_hash", this.tenancy.apiKeyHash);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async setBusinessContext(
    category: string,
    key: string,
    value: unknown,
    priority?: number
  ): Promise<void> {
    await this.enforceCaps("general");
    const row: Record<string, unknown> = {
      category,
      key,
      value:
        typeof value === "string"
          ? (() => {
              try {
                return JSON.parse(value);
              } catch {
                return value;
              }
            })()
          : value,
      last_accessed: now(),
      decay_tier: "hot",
    };
    if (priority !== undefined) row.priority = priority;

    const onConflict =
      this.tenancy.mode === "managed" ? "api_key_hash,category,key" : "category,key";

    const { error } = await this.client
      .from(this.tables.business_context)
      .upsert(this.withTenancy(row), { onConflict })
      .select()
      .single();
    if (error) throw error;
  }

  async upsertLibraryDoc(data: LibraryDocInput): Promise<string> {
    await this.enforceCaps("general");
    let existingQuery = this.client
      .from(this.tables.knowledge_library)
      .select("id, version")
      .eq("slug", data.slug);
    if (this.tenancy.mode === "managed") {
      existingQuery = existingQuery.eq("api_key_hash", this.tenancy.apiKeyHash);
    }
    const { data: existing } = await existingQuery.maybeSingle();

    if (existing) {
      // DB trigger auto-archives old content and bumps version
      const { error } = await this.client
        .from(this.tables.knowledge_library)
        .update({
          title: data.title,
          category: data.category,
          content: data.content,
          tags: data.tags,
          last_accessed: now(),
          decay_tier: "hot",
        })
        .eq("id", existing.id);
      if (error) throw error;
      return `Library doc updated: "${data.title}" (v${existing.version + 1})`;
    } else {
      const { error } = await this.client
        .from(this.tables.knowledge_library)
        .insert(
          this.withTenancy({
            slug: data.slug,
            title: data.title,
            category: data.category,
            content: data.content,
            tags: data.tags,
            version: 1,
            decay_tier: "hot",
            last_accessed: now(),
          })
        );
      if (error) throw error;
      return `Library doc created: "${data.title}" (v1)`;
    }
  }

  async manageDecay(): Promise<unknown> {
    return this.rpc("manage_decay", {}, "mc_manage_decay", {});
  }

  async getMemoryStatus(): Promise<unknown> {
    const tableKeys: Array<keyof TableNames> = [
      "business_context",
      "knowledge_library",
      "session_summaries",
      "extracted_facts",
      "conversation_log",
      "code_dumps",
    ];
    const counts: Record<string, unknown> = {};
    for (const tk of tableKeys) {
      let q = this.client.from(this.tables[tk]).select("*", { count: "exact", head: true });
      if (this.tenancy.mode === "managed") {
        q = q.eq("api_key_hash", this.tenancy.apiKeyHash);
      }
      const { count } = await q;
      counts[tk] = count;
    }

    let factTiersQuery = this.client
      .from(this.tables.extracted_facts)
      .select("decay_tier")
      .eq("status", "active");
    if (this.tenancy.mode === "managed") {
      factTiersQuery = factTiersQuery.eq("api_key_hash", this.tenancy.apiKeyHash);
    }
    const { data: factTiers } = await factTiersQuery;

    const tiers = { hot: 0, warm: 0, cold: 0 };
    for (const row of factTiers ?? []) {
      tiers[row.decay_tier as keyof typeof tiers]++;
    }
    return {
      mode: this.tenancy.mode === "managed" ? "supabase-managed" : "supabase-byod",
      table_counts: counts,
      fact_decay_tiers: tiers,
    };
  }
}

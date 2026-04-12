#!/usr/bin/env node

/**
 * @unclick/memory-mcp
 *
 * Persistent cross-session memory for AI agents.
 * MCP server exposing a 6-layer memory architecture backed by your own Supabase.
 *
 * Layers:
 *   1. Business Context   – standing rules, always loaded
 *   2. Knowledge Library   – versioned reference docs
 *   3. Session Summaries   – one per session, decisions + open loops
 *   4. Extracted Facts      – atomic searchable knowledge
 *   5. Conversation Log     – full verbatim history
 *   6. Code Dumps           – language-tagged code blocks
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getSupabase, rpc } from "./supabase.js";

// ─── Helpers ─────────────────────────────────────────

function truncate(s: string, max = 8000): string {
  return s.length > max ? s.slice(0, max) + "\n…[truncated]" : s;
}

function now(): string {
  return new Date().toISOString();
}

// ─── Server Setup ────────────────────────────────────

const server = new McpServer({
  name: "unclick-memory",
  version: "0.1.0",
});

// Tool: get_startup_context
server.tool(
  "get_startup_context",
  "Load persistent memory at session start. Returns business context (standing rules), recent session summaries, and hot extracted facts. Call this FIRST in every new session.",
  {
    num_sessions: z.number().int().min(1).max(20).default(5).describe("Number of recent session summaries to load (default 5)"),
  },
  async ({ num_sessions }) => {
    try {
      const data = await rpc<Record<string, unknown>>("get_startup_context", { num_sessions: num_sessions ?? 5 });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error loading startup context: ${(err as Error).message}` }], isError: true };
    }
  }
);

// Tool: search_memory
server.tool(
  "search_memory",
  "Search across ALL memory layers (session summaries, facts, conversation log, code dumps) using full-text search. Returns matching results ranked by relevance.",
  {
    query: z.string().min(1).describe("Search query"),
    max_results: z.number().int().min(1).max(50).default(10).describe("Maximum results to return"),
  },
  async ({ query, max_results }) => {
    try {
      const data = await rpc("search_memory", { query, max_results: max_results ?? 10 });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

// Tool: search_facts
server.tool(
  "search_facts",
  "Search extracted facts (Layer 4). Facts are atomic pieces of knowledge distilled from conversations. Only returns active (non-superseded) facts.",
  { query: z.string().min(1).describe("Search query") },
  async ({ query }) => {
    try {
      const data = await rpc("search_facts", { query });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

// Tool: search_library
server.tool(
  "search_library",
  "Search the Knowledge Library (Layer 2) for versioned reference documents like vendor profiles, client briefs, specs, and CVs.",
  { query: z.string().min(1).describe("Search query") },
  async ({ query }) => {
    try {
      const data = await rpc("search_library", { query });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

// Tool: get_library_doc
server.tool(
  "get_library_doc",
  "Get the full content of a Knowledge Library document by its slug. Returns the latest version.",
  { slug: z.string().min(1).describe("Document slug (e.g. 'vendor-acme-profile')") },
  async ({ slug }) => {
    try {
      const data = await rpc("get_library_doc", { doc_slug: slug });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

// Tool: list_library
server.tool(
  "list_library",
  "List all documents in the Knowledge Library. Returns slug, title, category, and last updated date for each.",
  {},
  async () => {
    try {
      const data = await rpc("list_library");
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

// Tool: write_session_summary
server.tool(
  "write_session_summary",
  "Write a session summary at the end of a session. Critical for cross-session continuity. Include key decisions, open loops, topics discussed, and action items.",
  {
    session_id: z.string().describe("Unique session identifier"),
    summary: z.string().min(10).describe("Narrative summary: decisions made, open loops, topics covered"),
    topics: z.array(z.string()).default([]).describe("Array of topic tags"),
    open_loops: z.array(z.string()).default([]).describe("Unfinished tasks or questions to carry forward"),
    platform: z.string().default("claude-code").describe("Platform this session ran on"),
  },
  async ({ session_id, summary, topics, open_loops, platform }) => {
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("session_summaries").insert({
        session_id, summary, topics: topics ?? [], open_loops: open_loops ?? [],
        platform: platform ?? "claude-code", decay_tier: "hot", last_accessed: now(),
      }).select().single();
      if (error) throw error;
      return { content: [{ type: "text" as const, text: `Session summary saved. ID: ${data.id}` }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error saving session summary: ${(err as Error).message}` }], isError: true };
    }
  }
);

// Tool: add_fact
server.tool(
  "add_fact",
  "Add a new extracted fact to memory. Facts are atomic, searchable pieces of knowledge. Examples: 'Chris prefers Tailwind over CSS modules', 'The Supabase project ref is xmooqsylqlknuksiddca'.",
  {
    fact: z.string().min(5).describe("The fact text — a single atomic statement"),
    category: z.string().default("general").describe("Category: preference, decision, technical, contact, project, general"),
    confidence: z.number().min(0).max(1).default(0.9).describe("Confidence score 0-1"),
    source_session: z.string().optional().describe("Session ID where this fact was learned"),
  },
  async ({ fact, category, confidence, source_session }) => {
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("extracted_facts").insert({
        fact, category: category ?? "general", confidence: confidence ?? 0.9,
        source_session: source_session ?? null, status: "active", decay_tier: "hot", last_accessed: now(),
      }).select().single();
      if (error) throw error;
      return { content: [{ type: "text" as const, text: `Fact saved. ID: ${data.id}` }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

// Tool: supersede_fact
server.tool(
  "supersede_fact",
  "Replace an outdated fact with a new version. The old fact is marked 'superseded' (never deleted). Use when information changes.",
  {
    old_fact_id: z.string().uuid().describe("UUID of the fact to supersede"),
    new_fact_text: z.string().min(5).describe("The updated fact text"),
  },
  async ({ old_fact_id, new_fact_text }) => {
    try {
      const data = await rpc("supersede_fact", { old_id: old_fact_id, new_text: new_fact_text });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

// Tool: log_conversation
server.tool(
  "log_conversation",
  "Log a conversation exchange to the persistent conversation log (Layer 5). Use for important exchanges you want to be able to search later.",
  {
    session_id: z.string().describe("Session identifier"),
    role: z.enum(["user", "assistant", "system"]).describe("Who said it"),
    content: z.string().min(1).describe("The message content"),
    platform: z.string().default("claude-code").describe("Platform"),
  },
  async ({ session_id, role, content: msgContent, platform }) => {
    try {
      const sb = getSupabase();
      const { error } = await sb.from("conversation_log").insert({
        session_id, role, content: truncate(msgContent),
        platform: platform ?? "claude-code", decay_tier: "warm", last_accessed: now(),
      });
      if (error) throw error;
      return { content: [{ type: "text" as const, text: "Conversation logged." }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

// Tool: store_code
server.tool(
  "store_code",
  "Store a code block in the code dump layer (Layer 6). Code is stored separately from conversations to keep search fast. Only loaded on demand.",
  {
    session_id: z.string().describe("Session identifier"),
    language: z.string().default("typescript").describe("Programming language"),
    filename: z.string().optional().describe("Original filename if known"),
    code: z.string().min(1).describe("The code content"),
    description: z.string().optional().describe("Brief description of what this code does"),
  },
  async ({ session_id, language, filename, code, description }) => {
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("code_dumps").insert({
        session_id, language: language ?? "typescript", filename: filename ?? null,
        code: truncate(code, 50000), description: description ?? null,
        decay_tier: "warm", last_accessed: now(),
      }).select().single();
      if (error) throw error;
      return { content: [{ type: "text" as const, text: `Code stored. ID: ${data.id}` }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

// Tool: get_business_context
server.tool(
  "get_business_context",
  "Get all business context entries (Layer 1). These are standing rules, client info, and preferences that are always relevant.",
  {},
  async () => {
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("business_context").select("*").order("category").order("key");
      if (error) throw error;
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

// Tool: set_business_context
server.tool(
  "set_business_context",
  "Add or update a business context entry (Layer 1). Business context is always loaded at session start. Use for standing rules, preferences, and important reference info.",
  {
    category: z.string().describe("Category: identity, preference, client, workflow, technical, standing_rule"),
    key: z.string().describe("Unique key within category (e.g. 'timezone', 'preferred_stack')"),
    value: z.string().describe("The value to store"),
  },
  async ({ category, key, value }) => {
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("business_context")
        .upsert({ category, key, value, last_accessed: now(), decay_tier: "hot" as const }, { onConflict: "category,key" })
        .select().single();
      if (error) throw error;
      return { content: [{ type: "text" as const, text: `Business context set: ${category}/${key}` }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

// Tool: upsert_library_doc
server.tool(
  "upsert_library_doc",
  "Create or update a Knowledge Library document (Layer 2). Documents are auto-versioned. Use for vendor profiles, client briefs, specs, CVs, etc.",
  {
    slug: z.string().describe("URL-friendly identifier"),
    title: z.string().describe("Human-readable title"),
    category: z.string().default("reference").describe("Category: reference, vendor, client, spec, cv, template"),
    content: z.string().min(1).describe("Full document content (Markdown recommended)"),
  },
  async ({ slug, title, category, content: docContent }) => {
    try {
      const sb = getSupabase();
      const { data: existing } = await sb.from("knowledge_library").select("id, version, content").eq("slug", slug).single();
      if (existing) {
        await sb.from("knowledge_library_history").insert({
          library_id: existing.id, version: existing.version, content: existing.content, changed_at: now(),
        });
        const { error } = await sb.from("knowledge_library").update({
          title, category: category ?? "reference", content: docContent,
          version: existing.version + 1, last_accessed: now(), decay_tier: "hot",
        }).eq("id", existing.id);
        if (error) throw error;
        return { content: [{ type: "text" as const, text: `Library doc updated: "${title}" (v${existing.version + 1})` }] };
      } else {
        const { error } = await sb.from("knowledge_library").insert({
          slug, title, category: category ?? "reference", content: docContent,
          version: 1, decay_tier: "hot", last_accessed: now(),
        });
        if (error) throw error;
        return { content: [{ type: "text" as const, text: `Library doc created: "${title}" (v1)` }] };
      }
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

// Tool: manage_decay
server.tool(
  "manage_decay",
  "Run the memory decay manager. Promotes/demotes items between hot/warm/cold tiers based on access patterns.",
  {},
  async () => {
    try {
      const data = await rpc("manage_decay");
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

// Tool: get_conversation_detail
server.tool(
  "get_conversation_detail",
  "Retrieve the full conversation log for a specific session. Includes all messages and associated code dumps.",
  { session_id: z.string().describe("Session ID to retrieve") },
  async ({ session_id }) => {
    try {
      const data = await rpc("get_conversation_detail", { sid: session_id });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

// Tool: memory_status
server.tool(
  "memory_status",
  "Get a quick overview of memory usage: counts per layer, decay tier distribution, and storage stats.",
  {},
  async () => {
    try {
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
      return { content: [{ type: "text" as const, text: JSON.stringify({ table_counts: counts, fact_decay_tiers: tiers }, null, 2) }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

// ─── Start ───────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("UnClick Memory MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

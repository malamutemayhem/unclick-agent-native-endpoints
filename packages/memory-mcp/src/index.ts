#!/usr/bin/env node

/**
 * @unclick/memory-mcp
 *
 * Persistent cross-session memory for AI agents.
 * MCP server exposing a 6-layer memory architecture.
 *
 * Zero-config: works locally out of the box (no database needed).
 * Cloud mode:  set SUPABASE_URL + key for cross-machine sync.
 *
 * Layers:
 *   1. Business Context   - standing rules, always loaded
 *   2. Knowledge Library   - versioned reference docs
 *   3. Session Summaries   - one per session, decisions + open loops
 *   4. Extracted Facts     - atomic searchable knowledge
 *   5. Conversation Log    - full verbatim history
 *   6. Code Dumps          - language-tagged code blocks
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getBackend } from "./db.js";

const server = new McpServer({
  name: "unclick-memory",
  version: "0.2.0",
});

// --- Tools ---

server.tool(
  "get_startup_context",
  "Load persistent memory at session start. Returns business context (standing rules), recent session summaries, and hot extracted facts. Call this FIRST in every new session.",
  {
    num_sessions: z.number().int().min(1).max(20).default(5).describe("Number of recent session summaries to load (default 5)"),
  },
  async ({ num_sessions }) => {
    try {
      const db = await getBackend();
      const data = await db.getStartupContext(num_sessions ?? 5);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error loading startup context: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "search_memory",
  "Full-text search across conversation logs. Returns matching results ranked by relevance.",
  {
    query: z.string().min(1).describe("Search query"),
    max_results: z.number().int().min(1).max(50).default(10).describe("Maximum results to return"),
  },
  async ({ query, max_results }) => {
    try {
      const db = await getBackend();
      const data = await db.searchMemory(query, max_results ?? 10);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "search_facts",
  "Search extracted facts (Layer 4). Only returns active (non-superseded) facts.",
  { query: z.string().min(1).describe("Search query") },
  async ({ query }) => {
    try {
      const db = await getBackend();
      const data = await db.searchFacts(query);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "search_library",
  "Search the Knowledge Library (Layer 2) for versioned reference documents.",
  { query: z.string().min(1).describe("Search query") },
  async ({ query }) => {
    try {
      const db = await getBackend();
      const data = await db.searchLibrary(query);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "get_library_doc",
  "Get the full content of a Knowledge Library document by its slug. Returns the latest version.",
  { slug: z.string().min(1).describe("Document slug (e.g. 'vendor-acme-profile')") },
  async ({ slug }) => {
    try {
      const db = await getBackend();
      const data = await db.getLibraryDoc(slug);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "list_library",
  "List all documents in the Knowledge Library. Returns slug, title, category, and last updated date for each.",
  {},
  async () => {
    try {
      const db = await getBackend();
      const data = await db.listLibrary();
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "write_session_summary",
  "Write a session summary at the end of a session. Critical for cross-session continuity. Include key decisions, open loops, and topics discussed.",
  {
    session_id: z.string().describe("Unique session identifier"),
    summary: z.string().min(10).describe("Narrative summary: decisions made, work completed, problems solved"),
    topics: z.array(z.string()).default([]).describe("Array of topic tags for searchability"),
    open_loops: z.array(z.string()).default([]).describe("Unfinished tasks or questions to carry forward"),
    decisions: z.array(z.string()).default([]).describe("Key decisions made during the session"),
    platform: z.string().default("claude-code").describe("Platform this session ran on"),
    duration_minutes: z.number().optional().describe("Approximate session duration in minutes"),
  },
  async ({ session_id, summary, topics, open_loops, decisions, platform, duration_minutes }) => {
    try {
      const db = await getBackend();
      const result = await db.writeSessionSummary({
        session_id, summary,
        topics: topics ?? [], open_loops: open_loops ?? [],
        decisions: decisions ?? [], platform: platform ?? "claude-code",
        duration_minutes,
      });
      return { content: [{ type: "text" as const, text: `Session summary saved. ID: ${result.id}` }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error saving session summary: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "add_fact",
  "Add a new extracted fact to memory. Facts are atomic, searchable pieces of knowledge. Examples: 'Team prefers Tailwind over CSS modules', 'Deploy target is Vercel for frontend'.",
  {
    fact: z.string().min(5).describe("The fact text - a single atomic statement"),
    category: z.string().default("general").describe("Category: preference, decision, technical, contact, project, general"),
    confidence: z.number().min(0).max(1).default(0.9).describe("Confidence score 0-1"),
    source_session_id: z.string().optional().describe("Session ID where this fact was learned"),
  },
  async ({ fact, category, confidence, source_session_id }) => {
    try {
      const db = await getBackend();
      const result = await db.addFact({
        fact, category: category ?? "general",
        confidence: confidence ?? 0.9, source_session_id,
      });
      return { content: [{ type: "text" as const, text: `Fact saved. ID: ${result.id}` }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "supersede_fact",
  "Replace an outdated fact with a new version. The old fact is marked 'superseded' (never deleted). Use when information changes.",
  {
    old_fact_id: z.string().uuid().describe("UUID of the fact to supersede"),
    new_fact_text: z.string().min(5).describe("The updated fact text"),
    new_category: z.string().optional().describe("New category (defaults to the old fact's category)"),
    new_confidence: z.number().min(0).max(1).optional().describe("Confidence for the new fact (default 1.0)"),
  },
  async ({ old_fact_id, new_fact_text, new_category, new_confidence }) => {
    try {
      const db = await getBackend();
      const newId = await db.supersedeFact(old_fact_id, new_fact_text, new_category, new_confidence);
      return { content: [{ type: "text" as const, text: `Fact superseded. New fact ID: ${newId}` }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "log_conversation",
  "Log a conversation exchange to the persistent conversation log (Layer 5). Use for important exchanges you want to be able to search later.",
  {
    session_id: z.string().describe("Session identifier"),
    role: z.enum(["user", "assistant", "system", "tool"]).describe("Who said it"),
    content: z.string().min(1).describe("The message content"),
    has_code: z.boolean().default(false).describe("Whether this message contains code blocks"),
  },
  async ({ session_id, role, content, has_code }) => {
    try {
      const db = await getBackend();
      await db.logConversation({ session_id, role, content, has_code: has_code ?? false });
      return { content: [{ type: "text" as const, text: "Conversation logged." }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

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
      const db = await getBackend();
      const result = await db.storeCode({
        session_id, language: language ?? "typescript",
        filename, content: code, description,
      });
      return { content: [{ type: "text" as const, text: `Code stored. ID: ${result.id}` }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "get_business_context",
  "Get all business context entries (Layer 1). These are standing rules, client info, and preferences that are always relevant.",
  {},
  async () => {
    try {
      const db = await getBackend();
      const data = await db.getBusinessContext();
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "set_business_context",
  "Add or update a business context entry (Layer 1). Business context is always loaded at session start. Use for standing rules, preferences, and important reference info.",
  {
    category: z.string().describe("Category: identity, preference, client, workflow, technical, standing_rule"),
    key: z.string().describe("Unique key within category (e.g. 'timezone', 'preferred_stack')"),
    value: z.string().describe("The value to store (plain text or JSON string)"),
    priority: z.number().int().optional().describe("Priority for loading order (higher = loaded first)"),
  },
  async ({ category, key, value, priority }) => {
    try {
      const db = await getBackend();
      await db.setBusinessContext(category, key, value, priority);
      return { content: [{ type: "text" as const, text: `Business context set: ${category}/${key}` }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "upsert_library_doc",
  "Create or update a Knowledge Library document (Layer 2). Documents are auto-versioned on update. Use for vendor profiles, client briefs, specs, CVs, etc.",
  {
    slug: z.string().describe("URL-friendly identifier"),
    title: z.string().describe("Human-readable title"),
    category: z.string().default("reference").describe("Category: reference, vendor, client, spec, cv, template"),
    content: z.string().min(1).describe("Full document content (Markdown recommended)"),
    tags: z.array(z.string()).default([]).describe("Searchable tags"),
  },
  async ({ slug, title, category, content, tags }) => {
    try {
      const db = await getBackend();
      const msg = await db.upsertLibraryDoc({
        slug, title, category: category ?? "reference",
        content, tags: tags ?? [],
      });
      return { content: [{ type: "text" as const, text: msg }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "manage_decay",
  "Run the memory decay manager. Promotes/demotes items between hot/warm/cold tiers based on access patterns. Run nightly or on-demand.",
  {},
  async () => {
    try {
      const db = await getBackend();
      const data = await db.manageDecay();
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "get_conversation_detail",
  "Retrieve the full conversation log for a specific session. Includes all messages in chronological order.",
  { session_id: z.string().describe("Session ID to retrieve") },
  async ({ session_id }) => {
    try {
      const db = await getBackend();
      const data = await db.getConversationDetail(session_id);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "memory_status",
  "Get a quick overview of memory usage: storage mode (local/supabase), counts per layer, decay tier distribution.",
  {},
  async () => {
    try {
      const db = await getBackend();
      const data = await db.getMemoryStatus();
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

// --- Start ---

async function main() {
  // Initialize backend early to show mode in logs
  await getBackend();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("UnClick Memory MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

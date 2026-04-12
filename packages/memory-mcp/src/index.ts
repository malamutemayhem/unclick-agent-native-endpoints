#!/usr/bin/env node

/**
 * UnClick Memory MCP Server
 *
 * Persistent cloud memory for AI agents.
 * 6-layer architecture backed by Supabase (BYOD â Bring Your Own Database).
 *
 * Session bridge pattern:
 *   1. get_startup_context() â called at conversation start
 *   2. [conversation happens, facts/knowledge stored as you go]
 *   3. write_session_summary() â called at conversation end
 *
 * Usage in mcp.json:
 * {
 *   "unclick-memory": {
 *     "command": "npx",
 *     "args": ["-y", "@unclick/memory-mcp"],
 *     "env": {
 *       "SUPABASE_URL": "https://your-project.supabase.co",
 *       "SUPABASE_KEY": "your-service-role-key"
 *     }
 *   }
 * }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  getStartupContext,
  writeSessionSummary,
  storeFact,
  getFacts,
  storeKnowledge,
  getKnowledge,
  searchKnowledge,
  upsertBusinessContext,
  getBusinessContext,
  logConversation,
  getConversationLog,
  storeCodeDump,
  getRecentCodeDumps,
  searchAllLayers,
  getRecentSessions,
} from "./supabase.js";

/* ------------------------------------------------------------------ */
/*  Server                                                             */
/* ------------------------------------------------------------------ */

const server = new McpServer({
  name: "unclick-memory",
  version: "0.1.0",
});

/* ------------------------------------------------------------------ */
/*  Tool: get_startup_context                                          */
/*  THE key tool â call this at the start of every conversation        */
/* ------------------------------------------------------------------ */

server.tool(
  "get_startup_context",
  "Retrieve full startup context for a new conversation. Returns business context, recent session summaries, key facts, and open threads. Call this FIRST in every new conversation.",
  {},
  async () => {
    try {
      const context = await getStartupContext();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(context, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

/* ------------------------------------------------------------------ */
/*  Tool: write_session_summary                                        */
/*  Call this at the END of every conversation                         */
/* ------------------------------------------------------------------ */

server.tool(
  "write_session_summary",
  "Store a summary of the current conversation session. Call this at the END of every conversation to preserve context for next time. Include key decisions, open threads, tools used, and files modified.",
  {
    session_id: z.string().describe("Unique session identifier"),
    summary: z.string().describe("Concise summary of what happened in this session"),
    key_decisions: z.array(z.string()).describe("Important decisions made during the session"),
    open_threads: z.array(z.string()).describe("Unfinished tasks or topics to pick up next time"),
    tools_used: z.array(z.string()).optional().describe("MCP tools that were used"),
    files_modified: z.array(z.string()).optional().describe("Files that were created or modified"),
    duration_minutes: z.number().optional().describe("Approximate session duration in minutes"),
  },
  async (params) => {
    try {
      const result = await writeSessionSummary({
        session_id: params.session_id,
        summary: params.summary,
        key_decisions: params.key_decisions,
        open_threads: params.open_threads,
        tools_used: params.tools_used ?? [],
        files_modified: params.files_modified ?? [],
        duration_minutes: params.duration_minutes,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Session summary saved (id: ${result.id}). ${params.open_threads.length} open thread(s) recorded.`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

/* ------------------------------------------------------------------ */
/*  Tool: store_fact                                                   */
/* ------------------------------------------------------------------ */

server.tool(
  "store_fact",
  "Store an extracted fact from the current conversation. Facts are discrete pieces of information (preferences, decisions, technical details) that should persist across sessions.",
  {
    fact: z.string().describe("The fact to store"),
    category: z
      .string()
      .describe("Category: preference, decision, technical, contact, project, process, credential, or custom"),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .describe("Confidence score 0-1 (1 = explicitly stated, 0.5 = inferred)"),
    source_session_id: z.string().optional().describe("Session ID where this fact was extracted"),
  },
  async (params) => {
    try {
      const result = await storeFact(
        params.fact,
        params.category,
        params.confidence,
        params.source_session_id
      );
      return {
        content: [
          {
            type: "text" as const,
            text: `Fact stored (id: ${result.id}, category: ${params.category}, confidence: ${params.confidence})`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

/* ------------------------------------------------------------------ */
/*  Tool: get_facts                                                    */
/* ------------------------------------------------------------------ */

server.tool(
  "get_facts",
  "Retrieve stored facts, optionally filtered by category. Returns facts sorted by confidence then recency.",
  {
    category: z.string().optional().describe("Filter by category"),
    limit: z.number().optional().describe("Max results (default 30)"),
  },
  async (params) => {
    try {
      const facts = await getFacts(params.category, params.limit ?? 30);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(facts, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

/* ------------------------------------------------------------------ */
/*  Tool: store_knowledge                                              */
/* ------------------------------------------------------------------ */

server.tool(
  "store_knowledge",
  "Store a knowledge entry in the library. Use for longer-form information: documentation, guides, architecture decisions, meeting notes, research.",
  {
    title: z.string().describe("Title of the knowledge entry"),
    content: z.string().describe("The knowledge content"),
    category: z
      .string()
      .describe("Category: architecture, documentation, research, meeting_notes, guide, reference, or custom"),
    tags: z.array(z.string()).describe("Searchable tags"),
    source: z.string().optional().describe("Where this knowledge came from"),
  },
  async (params) => {
    try {
      const result = await storeKnowledge({
        title: params.title,
        content: params.content,
        category: params.category,
        tags: params.tags,
        source: params.source,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Knowledge stored: "${params.title}" (id: ${result.id}, category: ${params.category})`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

/* ------------------------------------------------------------------ */
/*  Tool: get_knowledge                                                */
/* ------------------------------------------------------------------ */

server.tool(
  "get_knowledge",
  "Retrieve knowledge entries from the library, optionally filtered by category.",
  {
    category: z.string().optional().describe("Filter by category"),
    limit: z.number().optional().describe("Max results (default 20)"),
  },
  async (params) => {
    try {
      const entries = await getKnowledge(params.category, params.limit ?? 20);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(entries, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

/* ------------------------------------------------------------------ */
/*  Tool: store_business_context                                       */
/* ------------------------------------------------------------------ */

server.tool(
  "store_business_context",
  "Store or update a business context entry. Use for high-level, rarely-changing information: company name, tech stack, team members, project goals, coding standards.",
  {
    key: z.string().describe("Unique key (e.g. 'tech_stack', 'company_name', 'team_lead')"),
    value: z.string().describe("The value to store"),
    category: z
      .string()
      .describe("Category: company, project, team, standards, infrastructure, or custom"),
  },
  async (params) => {
    try {
      const result = await upsertBusinessContext(params.key, params.value, params.category);
      return {
        content: [
          {
            type: "text" as const,
            text: `Business context saved: ${params.key} = "${params.value.substring(0, 100)}${params.value.length > 100 ? "..." : ""}"`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

/* ------------------------------------------------------------------ */
/*  Tool: get_business_context                                         */
/* ------------------------------------------------------------------ */

server.tool(
  "get_business_context",
  "Retrieve business context entries, optionally filtered by category.",
  {
    category: z.string().optional().describe("Filter by category"),
  },
  async (params) => {
    try {
      const entries = await getBusinessContext(params.category);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(entries, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

/* ------------------------------------------------------------------ */
/*  Tool: search_memory                                                */
/* ------------------------------------------------------------------ */

server.tool(
  "search_memory",
  "Search across ALL memory layers (business context, knowledge, sessions, facts, code). Use when you need to find something but don't know which layer it's in.",
  {
    query: z.string().describe("Search query"),
    limit: z.number().optional().describe("Max results (default 15)"),
  },
  async (params) => {
    try {
      const results = await searchAllLayers(params.query, params.limit ?? 15);
      if (results.length === 0) {
        return {
          content: [
            { type: "text" as const, text: `No results found for "${params.query}"` },
          ],
        };
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

/* ------------------------------------------------------------------ */
/*  Tool: log_conversation                                             */
/* ------------------------------------------------------------------ */

server.tool(
  "log_conversation",
  "Log a conversation message (user, assistant, or system) to the conversation log for the current session.",
  {
    session_id: z.string().describe("Current session ID"),
    role: z.enum(["user", "assistant", "system"]).describe("Message role"),
    content: z.string().describe("Message content"),
    tool_calls: z
      .array(z.record(z.unknown()))
      .optional()
      .describe("Tool calls made in this message"),
  },
  async (params) => {
    try {
      await logConversation({
        session_id: params.session_id,
        role: params.role,
        content: params.content,
        tool_calls: params.tool_calls,
      });
      return {
        content: [{ type: "text" as const, text: `Logged ${params.role} message to session ${params.session_id}` }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

/* ------------------------------------------------------------------ */
/*  Tool: store_code                                                   */
/* ------------------------------------------------------------------ */

server.tool(
  "store_code",
  "Store a code snippet or file for future reference. Use when significant code is generated or modified during a session.",
  {
    session_id: z.string().describe("Current session ID"),
    filename: z.string().describe("Filename (e.g. 'src/App.tsx')"),
    language: z.string().describe("Programming language"),
    content: z.string().describe("The code content"),
    description: z.string().optional().describe("What this code does"),
  },
  async (params) => {
    try {
      const result = await storeCodeDump({
        session_id: params.session_id,
        filename: params.filename,
        language: params.language,
        content: params.content,
        description: params.description,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Code stored: ${params.filename} (${params.language}, ${params.content.length} chars, id: ${result.id})`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

/* ------------------------------------------------------------------ */
/*  Tool: get_recent_code                                              */
/* ------------------------------------------------------------------ */

server.tool(
  "get_recent_code",
  "Retrieve recently stored code snippets.",
  {
    limit: z.number().optional().describe("Max results (default 10)"),
  },
  async (params) => {
    try {
      const dumps = await getRecentCodeDumps(params.limit ?? 10);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(dumps, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

/* ------------------------------------------------------------------ */
/*  Tool: get_recent_sessions                                          */
/* ------------------------------------------------------------------ */

server.tool(
  "get_recent_sessions",
  "Retrieve recent session summaries. Useful for understanding what happened in previous conversations.",
  {
    limit: z.number().optional().describe("Max results (default 5)"),
  },
  async (params) => {
    try {
      const sessions = await getRecentSessions(params.limit ?? 5);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(sessions, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

/* ------------------------------------------------------------------ */
/*  Tool: bulk_import                                                  */
/*  Ingest raw text and auto-distribute across memory layers           */
/* ------------------------------------------------------------------ */

server.tool(
  "bulk_import",
  "Import bulk text content and auto-organise it across memory layers. Feed it text files, notes, documentation, meeting transcripts â the server will parse and categorise the content into the appropriate memory layers (business_context, knowledge_library, extracted_facts). Great for initial setup or importing existing notes.",
  {
    content: z.string().describe("The raw text content to import"),
    source: z.string().optional().describe("Where this content came from (e.g. 'meeting-notes-2024.txt')"),
    hint: z
      .enum(["auto", "knowledge", "facts", "business_context", "mixed"])
      .optional()
      .describe("Hint for categorisation: 'auto' (default) analyses content, or force a specific layer"),
    session_id: z.string().optional().describe("Session ID to associate with imported content"),
  },
  async (params) => {
    try {
      const hint = params.hint ?? "auto";
      const source = params.source ?? "bulk_import";
      const content = params.content.trim();
      const results: string[] = [];

      if (hint === "knowledge" || hint === "auto") {
        // If content is long-form (>500 chars) or hint is knowledge, store as knowledge
        if (hint === "knowledge" || content.length > 500) {
          // Split into sections if there are clear headers (lines starting with # or ALL CAPS followed by content)
          const sections = splitIntoSections(content);

          for (const section of sections) {
            if (section.content.trim().length < 20) continue; // skip tiny fragments
            await storeKnowledge({
              title: section.title || `Import from ${source}`,
              content: section.content,
              category: "reference",
              tags: ["imported", source.replace(/[^a-zA-Z0-9]/g, "_")],
              source,
            });
            results.push(`Knowledge: "${section.title || "untitled"}" (${section.content.length} chars)`);
          }
        }
      }

      if (hint === "facts" || hint === "auto" || hint === "mixed") {
        // Extract fact-like sentences (short, declarative)
        const lines = content.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 10 && l.length < 300);
        let factCount = 0;

        for (const line of lines) {
          // Skip headers, code blocks, and obvious non-facts
          if (line.startsWith("#") || line.startsWith("```") || line.startsWith("//")) continue;
          if (line.startsWith("-") || line.startsWith("*")) {
            // Bullet points are often facts
            const cleanLine = line.replace(/^[-*]\s*/, "");
            if (cleanLine.length > 15) {
              const category = guessFactCategory(cleanLine);
              await storeFact(cleanLine, category, 0.7, params.session_id);
              factCount++;
            }
          } else if (looksLikeFact(line) && hint !== "knowledge") {
            const category = guessFactCategory(line);
            await storeFact(line, category, 0.6, params.session_id);
            factCount++;
          }
        }
        if (factCount > 0) {
          results.push(`Facts: ${factCount} extracted`);
        }
      }

      if (hint === "business_context" || hint === "mixed") {
        // Look for key-value-like patterns
        const kvLines = content.split(/\n+/).filter((l) => l.includes(":") && l.trim().length < 200);
        let kvCount = 0;

        for (const line of kvLines) {
          const colonIdx = line.indexOf(":");
          const key = line.substring(0, colonIdx).trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
          const value = line.substring(colonIdx + 1).trim();
          if (key.length > 2 && key.length < 50 && value.length > 2) {
            await upsertBusinessContext(key, value, "imported");
            kvCount++;
          }
        }
        if (kvCount > 0) {
          results.push(`Business context: ${kvCount} key-value pairs`);
        }
      }

      // If nothing was imported (very short content, no clear structure)
      if (results.length === 0) {
        await storeKnowledge({
          title: `Import from ${source}`,
          content,
          category: "reference",
          tags: ["imported", source.replace(/[^a-zA-Z0-9]/g, "_")],
          source,
        });
        results.push(`Knowledge: stored as single entry (${content.length} chars)`);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Bulk import complete from "${source}":\n${results.map((r) => `  â¢ ${r}`).join("\n")}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

/* ------------------------------------------------------------------ */
/*  Tool: memory_stats                                                 */
/* ------------------------------------------------------------------ */

server.tool(
  "memory_stats",
  "Get statistics about what's stored in memory â counts per layer, most recent entries, storage health.",
  {},
  async () => {
    try {
      const sb = await import("./supabase.js");
      const supabase = sb.getSupabase();

      const layers = [
        "business_context",
        "knowledge_library",
        "session_summaries",
        "extracted_facts",
        "conversation_log",
        "code_dumps",
      ];

      const stats: Record<string, { count: number; latest?: string }> = {};

      for (const layer of layers) {
        const { count, error } = await supabase
          .from(layer)
          .select("*", { count: "exact", head: true });

        const { data: latest } = await supabase
          .from(layer)
          .select("created_at")
          .order("created_at", { ascending: false })
          .limit(1);

        stats[layer] = {
          count: count ?? 0,
          latest: latest?.[0]?.created_at,
        };
      }

      const totalEntries = Object.values(stats).reduce((sum, s) => sum + s.count, 0);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ total_entries: totalEntries, layers: stats }, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

/* ------------------------------------------------------------------ */
/*  Helper functions for bulk_import                                   */
/* ------------------------------------------------------------------ */

interface Section {
  title: string;
  content: string;
}

function splitIntoSections(text: string): Section[] {
  const lines = text.split("\n");
  const sections: Section[] = [];
  let currentTitle = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    // Detect headers: markdown (#, ##) or ALL CAPS lines
    const isHeader =
      /^#{1,3}\s+/.test(line) ||
      (/^[A-Z][A-Z\s]{3,}$/.test(line.trim()) && line.trim().length < 80);

    if (isHeader) {
      // Save previous section
      if (currentContent.length > 0) {
        sections.push({
          title: currentTitle || "Untitled",
          content: currentContent.join("\n").trim(),
        });
      }
      currentTitle = line.replace(/^#+\s*/, "").trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentContent.length > 0) {
    sections.push({
      title: currentTitle || "Untitled",
      content: currentContent.join("\n").trim(),
    });
  }

  // If no sections were found, return the whole thing as one
  if (sections.length === 0) {
    sections.push({ title: "Imported content", content: text.trim() });
  }

  return sections;
}

function looksLikeFact(line: string): boolean {
  // Heuristic: short declarative sentences are likely facts
  const words = line.split(/\s+/).length;
  if (words < 4 || words > 40) return false;
  // Contains "is", "are", "uses", "prefers", "was", "has", "runs", "works"
  if (/\b(is|are|uses?|prefers?|was|has|have|runs?|works?|needs?|wants?|likes?|requires?)\b/i.test(line)) return true;
  // Contains ":" suggesting a key-value
  if (/^[^:]{3,30}:/.test(line)) return true;
  return false;
}

function guessFactCategory(text: string): string {
  const lower = text.toLowerCase();
  if (/prefer|like|want|favorite|favourite|always|never/i.test(lower)) return "preference";
  if (/decided|agreed|chose|will use|going with|switched to/i.test(lower)) return "decision";
  if (/version|api|sdk|library|framework|database|server|port|url|endpoint/i.test(lower)) return "technical";
  if (/email|phone|name|contact|team|person|role/i.test(lower)) return "contact";
  if (/project|repo|sprint|milestone|deadline|roadmap/i.test(lower)) return "project";
  if (/step|process|workflow|deploy|build|test|ci|cd/i.test(lower)) return "process";
  return "general";
}

/* ------------------------------------------------------------------ */
/*  Start                                                              */
/* ------------------------------------------------------------------ */

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("UnClick Memory MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
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

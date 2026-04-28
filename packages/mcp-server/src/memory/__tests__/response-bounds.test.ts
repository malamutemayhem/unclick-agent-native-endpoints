import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  compactSearchMemoryForStrictClients,
  compactStartupContextForStrictClients,
} from "../handlers.js";

const long = (prefix: string, size: number) => `${prefix} ${"x".repeat(size)}`;

describe("strict-client memory response bounds", () => {
  test("load_memory compact mode skips session bodies and keeps payload small", () => {
    const raw = {
      business_context: Array.from({ length: 20 }, (_, i) => ({
        category: "rule",
        key: `rule-${i}`,
        value: long("business", 2000),
        priority: i,
      })),
      knowledge_library_index: Array.from({ length: 20 }, (_, i) => ({
        slug: `doc-${i}`,
        title: long("title", 300),
        category: "docs",
        tags: ["alpha", "beta", long("tag", 500)],
        content: long("body", 5000),
        updated_at: "2026-04-28T00:00:00Z",
      })),
      recent_sessions: Array.from({ length: 5 }, (_, i) => ({
        session_id: `s-${i}`,
        platform: "chatgpt",
        summary: long("summary", 4000),
        decisions: [long("decision", 500)],
        open_loops: [long("loop", 500)],
        topics: [long("topic", 500)],
        created_at: "2026-04-28T00:00:00Z",
      })),
      active_facts: Array.from({ length: 50 }, (_, i) => ({
        fact: long(`fact-${i}`, 1000),
        category: "general",
        confidence: 1,
        created_at: "2026-04-28T00:00:00Z",
      })),
    };

    const compact = compactStartupContextForStrictClients(raw);
    const text = JSON.stringify(compact);
    assert.ok(text.length < 8000, `payload was ${text.length} chars`);
    assert.equal((compact as { recent_sessions: unknown[] }).recent_sessions.length, 0);
  });

  test("load_memory non-lite mode returns truncated session summaries", () => {
    const compact = compactStartupContextForStrictClients({
      recent_sessions: [{ session_id: "s-1", summary: long("summary", 4000) }],
    }, true) as { recent_sessions: Array<{ summary: string }> };

    assert.equal(compact.recent_sessions.length, 1);
    assert.ok(compact.recent_sessions[0].summary.length < 500);
    assert.match(compact.recent_sessions[0].summary, /truncated/);
  });

  test("search_memory caps content previews by default", () => {
    const compact = compactSearchMemoryForStrictClients(
      Array.from({ length: 10 }, (_, i) => ({
        id: `r-${i}`,
        source: "session",
        content: long("content", 5000),
      }))
    );

    const text = JSON.stringify(compact);
    assert.ok(text.length < 12000, `payload was ${text.length} chars`);
    assert.match((compact as Array<{ content: string }>)[0].content, /truncated/);
  });
});

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  compactSearchMemoryForStrictClients,
  compactStartupContextForStrictClients,
  normalizeActiveFactsForLoadMemory,
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

    const profileCard = (compact as { profile_card: { source_receipts: Array<{ redaction_state?: string }> } }).profile_card;
    assert.ok(profileCard);
    assert.ok(profileCard.source_receipts.length > 0);
    assert.ok(profileCard.source_receipts.every((receipt) => receipt.redaction_state === "clean"));
    assert.equal(JSON.stringify(profileCard).includes(long("summary", 1000)), false);
  });

  test("load_memory non-lite mode returns truncated session summaries", () => {
    const compact = compactStartupContextForStrictClients({
      recent_sessions: [{ session_id: "s-1", summary: long("summary", 4000) }],
    }, true) as { recent_sessions: Array<{ summary: string }> };

    assert.equal(compact.recent_sessions.length, 1);
    assert.ok(compact.recent_sessions[0].summary.length < 500);
    assert.match(compact.recent_sessions[0].summary, /truncated/);
  });

  test("load_memory compact mode adds profile card with safe receipts", () => {
    const compact = compactStartupContextForStrictClients({
      business_context: [
        {
          id: "auto-tz",
          category: "timezone",
          key: "detected_timezone",
          value: { timezone: "America/New_York", source: "automatic" },
          priority: 100,
        },
        {
          id: "manual-tz",
          category: "preference",
          key: "operator_timezone",
          value: {
            timezone: "Australia/Sydney",
            utc_offset: "UTC+10",
            privacy: "timezone-only",
            source: "manual",
          },
          priority: 1,
        },
        {
          id: "guardrail",
          category: "workflow",
          key: "user_decision_rule",
          value: "Do not ask Chris unless there is a real access decision.",
          priority: 2,
        },
      ],
      recent_sessions: [
        {
          session_id: "s-private",
          summary: "Session body should stay hidden in lite mode.",
          created_at: "2026-04-28T00:00:00Z",
        },
      ],
      active_facts: [
        {
          id: "fact-stale",
          fact: "stale active job",
          category: "job",
          confidence: 1,
          created_at: "2026-04-28T00:00:00Z",
          invalidated_at: "2026-04-29T00:00:00Z",
        },
        {
          id: "fact-live",
          fact: "Current Memory Profile Card job is active.",
          category: "job",
          confidence: 0.91,
          created_at: "2026-04-30T00:00:00Z",
          invalidated_at: null,
        },
        {
          id: "fact-sensitive",
          fact: "api key token should not be surfaced",
          category: "secret",
          confidence: 0.95,
          created_at: "2026-04-30T00:01:00Z",
          invalidated_at: null,
        },
      ],
    }) as {
      profile_card: {
        timezone_context?: string;
        working_now: string[];
        do_not_repeat: string[];
        source_receipts: Array<{ memory_id: string; source_kind: string; redaction_state?: string }>;
      };
    };

    const profileCard = compact.profile_card;
    assert.match(profileCard.timezone_context ?? "", /Australia\/Sydney/);
    assert.doesNotMatch(profileCard.timezone_context ?? "", /America\/New_York/);
    assert.ok(profileCard.working_now.some((line) => line.includes("Memory Profile Card job")));
    assert.ok(profileCard.do_not_repeat.some((line) => line.includes("Do not ask Chris")));

    const profileText = JSON.stringify(profileCard);
    assert.doesNotMatch(profileText, /stale active job/);
    assert.doesNotMatch(profileText, /api key token/);
    assert.doesNotMatch(profileText, /Session body should stay hidden/);
    assert.ok(profileCard.source_receipts.some((receipt) => receipt.memory_id === "fact:fact-live"));
    assert.ok(profileCard.source_receipts.every((receipt) => receipt.redaction_state === "clean"));
    assert.equal(profileCard.source_receipts.some((receipt) => receipt.memory_id === "fact:fact-stale"), false);
    assert.equal(profileCard.source_receipts.some((receipt) => receipt.source_kind === "session_summary"), false);
  });

  test("load_memory filters invalidated active facts before compact ranking", () => {
    const compact = compactStartupContextForStrictClients({
      active_facts: [
        {
          fact: "invalidated-high-rank",
          category: "general",
          confidence: 1,
          created_at: "2026-04-28T00:00:00Z",
          invalidated_at: "2026-04-29T00:00:00Z",
        },
        ...Array.from({ length: 12 }, (_, i) => ({
          fact: `live-${i}`,
          category: "general",
          confidence: 0.9,
          created_at: "2026-04-28T00:00:00Z",
          invalidated_at: null,
        })),
      ],
    }) as { active_facts: Array<{ fact: string }>; response_bounds: { active_facts_available_in_loaded_window: number } };

    const facts = compact.active_facts.map((row) => row.fact);
    assert.equal(facts.includes("invalidated-high-rank"), false);
    assert.equal(facts.length, 12);
    assert.equal(compact.response_bounds.active_facts_available_in_loaded_window, 12);
  });

  test("load_memory full-content path filters invalidated active facts", () => {
    const filtered = normalizeActiveFactsForLoadMemory({
      active_facts: [
        { fact: "live", invalidated_at: null, extra: "kept" },
        { fact: "stale", invalidated_at: "2026-04-29T00:00:00Z" },
      ],
    }) as { active_facts: Array<{ fact: string; invalidated_at: string | null; extra?: string }> };

    assert.deepEqual(filtered.active_facts, [{ fact: "live", invalidated_at: null, extra: "kept" }]);
  });

  test("load_memory demotes operational self-report rows behind durable user facts", () => {
    const compact = compactStartupContextForStrictClients({
      active_facts: [
        {
          fact: "No Fishbowl write tools were available in this environment.",
          category: "memory",
          confidence: 0.99,
          created_at: "2026-04-27T10:00:00Z",
        },
        {
          fact: "TESTPASS_CRON_USER_ID cron blocker resolved after redeploy.",
          category: "ops",
          confidence: 0.98,
          created_at: "2026-04-27T10:01:00Z",
        },
        ...Array.from({ length: 12 }, (_, i) => ({
          fact: `durable-user-fact-${i}`,
          category: "user",
          confidence: 0.9 - i * 0.01,
          created_at: `2026-04-29T00:${String(i).padStart(2, "0")}:00Z`,
        })),
      ],
    }) as { active_facts: Array<{ fact: string }> };

    const facts = compact.active_facts.map((row) => row.fact);
    assert.equal(facts.length, 12);
    assert.equal(facts.includes("No Fishbowl write tools were available in this environment."), false);
    assert.equal(facts.includes("TESTPASS_CRON_USER_ID cron blocker resolved after redeploy."), false);
    assert.deepEqual(
      facts.slice(0, 3),
      ["durable-user-fact-0", "durable-user-fact-1", "durable-user-fact-2"]
    );
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

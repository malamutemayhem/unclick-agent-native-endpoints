import { describe, expect, it } from "vitest";

import { ENDPOINT_MAP } from "../catalog.js";
import { validateToolArgumentsForRuntime } from "../server.js";

describe("runtime tool schema validation", () => {
  const probes: Array<{ name: string; args: Record<string, unknown> }> = [
    { name: "load_memory", args: { num_sessions: 1, bogus_field: "should reject" } },
    { name: "search_memory", args: { query: "strict schema probe", bogus_field: "should reject" } },
    { name: "search_typed_links", args: { query: "PR #890", bogus_field: "should reject" } },
    { name: "refresh_taxonomy_snapshots", args: { dry_run: true, bogus_field: "should reject" } },
    {
      name: "save_conversation_turn",
      args: {
        session_id: "strict-probe-session",
        role: "user",
        content: "strict schema probe",
        bogus_field: "should reject",
      },
    },
    { name: "check_signals", args: { agent_id: "strict-probe", bogus_field: "should reject" } },
    { name: "read_orchestrator_context", args: { q: "strict schema probe", bogus_field: "should reject" } },
    { name: "heartbeat_protocol", args: { bogus_field: "should reject" } },
    { name: "commonsensepass_protocol", args: { bogus_field: "should reject" } },
    {
      name: "ack_handoff",
      args: {
        agent_id: "strict-probe",
        thread_id: "11111111-1111-4111-8111-111111111111",
        current_chip: "Build B probe",
        next_action: "ack the handoff",
        eta: "next cycle",
        bogus_field: "should reject",
      },
    },
    { name: "stripe_customers", args: { secret_key: "sk_test_dummy", action: "X", bogus_field: "should reject" } },
    { name: "stripe_charges", args: { secret_key: "sk_test_dummy", action: "X", bogus_field: "should reject" } },
    {
      name: "paypal_orders",
      args: {
        client_id: "dummy",
        client_secret: "dummy",
        action: "X",
        order_id: "ORDER",
        bogus_field: "should reject",
      },
    },
    { name: "square_payments", args: { access_token: "dummy", action: "X", bogus_field: "should reject" } },
    {
      name: "unclick_call",
      args: {
        endpoint_id: "memory.search_memory",
        params: { query: "strict schema probe" },
        bogus_field: "should reject",
      },
    },
    { name: "unclick_generate_uuid", args: { count: 1, bogus_field: "should reject" } },
    { name: "unclick_random_password", args: { length: 8, bogus_field: "should reject" } },
  ];

  it("rejects extra fields before handlers can run", () => {
    for (const probe of probes) {
      const result = validateToolArgumentsForRuntime(probe.name, probe.args);
      expect(result, probe.name).not.toBeNull();
      expect(result?.code).toBe("validation_error");
      expect(result?.details.some((detail) => detail.keyword === "additionalProperties")).toBe(true);
      expect(JSON.stringify(result)).toContain("bogus_field");
    }
  });

  it("allows valid arguments for the same tool family", () => {
    expect(validateToolArgumentsForRuntime("load_memory", { num_sessions: 1 })).toBeNull();
    expect(validateToolArgumentsForRuntime("save_fact", {
      fact: "Issue: Claude tool-result submission fails in Brave. Solution: disable Brave Shields for claude.ai.",
      category: "troubleshooting",
    })).toBeNull();
    expect(validateToolArgumentsForRuntime("save_conversation_turn", {
      session_id: "strict-probe-session",
      role: "user",
      content: "strict schema probe",
    })).toBeNull();
    expect(validateToolArgumentsForRuntime("unclick_generate_uuid", { count: 1 })).toBeNull();
    expect(validateToolArgumentsForRuntime("check_signals", {
      agent_id: "strict-probe",
    })).toBeNull();
    expect(validateToolArgumentsForRuntime("read_orchestrator_context", {
      q: "strict schema probe",
      limit: 40,
    })).toBeNull();
    expect(validateToolArgumentsForRuntime("heartbeat_protocol", {})).toBeNull();
    expect(validateToolArgumentsForRuntime("commonsensepass_protocol", {})).toBeNull();
    expect(validateToolArgumentsForRuntime("ack_handoff", {
      agent_id: "strict-probe",
      thread_id: "11111111-1111-4111-8111-111111111111",
      current_chip: "Build B probe",
      next_action: "ack the handoff",
      eta: "next cycle",
      blocker: "none",
    })).toBeNull();
    expect(validateToolArgumentsForRuntime("unclick_call", {
      endpoint_id: "memory.search_memory",
      params: { query: "strict schema probe" },
    })).toBeNull();
    expect(validateToolArgumentsForRuntime("search_typed_links", {
      query: "PR #890",
      max_results: 5,
    })).toBeNull();
    expect(validateToolArgumentsForRuntime("refresh_taxonomy_snapshots", {
      dry_run: true,
      max_sources: 12,
      max_snapshots: 4,
      max_sources_per_snapshot: 3,
    })).toBeNull();
  });

  it("exposes Memory taxonomy snapshot refresh as a dry-run-first catalog endpoint", () => {
    const entry = ENDPOINT_MAP.get("memory.refresh_taxonomy_snapshots");

    expect(entry?.tool.slug).toBe("memory");
    expect(entry?.endpoint.path).toBe("/v1/memory/taxonomy/refresh");
    expect(entry?.endpoint.inputSchema).toMatchObject({
      type: "object",
      properties: {
        dry_run: { type: "boolean", default: true },
        max_sources: { type: "number", minimum: 1, maximum: 250, default: 80 },
        max_snapshots: { type: "number", minimum: 1, maximum: 12, default: 12 },
        max_sources_per_snapshot: { type: "number", minimum: 1, maximum: 12, default: 8 },
      },
    });
  });
});

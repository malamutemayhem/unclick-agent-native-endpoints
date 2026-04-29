import { describe, expect, it } from "vitest";

import { validateToolArgumentsForRuntime } from "../server.js";

describe("runtime tool schema validation", () => {
  const probes: Array<{ name: string; args: Record<string, unknown> }> = [
    { name: "load_memory", args: { num_sessions: 1, bogus_field: "should reject" } },
    { name: "search_memory", args: { query: "strict schema probe", bogus_field: "should reject" } },
    { name: "check_signals", args: { agent_id: "strict-probe", bogus_field: "should reject" } },
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
    expect(validateToolArgumentsForRuntime("unclick_generate_uuid", { count: 1 })).toBeNull();
    expect(validateToolArgumentsForRuntime("unclick_call", {
      endpoint_id: "memory.search_memory",
      params: { query: "strict schema probe" },
    })).toBeNull();
  });
});

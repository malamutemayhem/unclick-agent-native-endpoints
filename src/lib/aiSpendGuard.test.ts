// src/lib/aiSpendGuard.test.ts

import { describe, test, expect } from "vitest";
import {
  createSpendState,
  evaluateGuard,
  findRegistryEntry,
  getDefaultRegistry,
  summariseSpend,
  withSpendGuard,
  SpendGuardError,
  __testing__,
  type ProviderEntry,
} from "./aiSpendGuard";

const TEST_REGISTRY: ProviderEntry[] = [
  { provider: "openai", label: "openai/chat", cost_class: "metered", default_enabled: false, enable_env: "TEST_OPENAI_ON" },
  { provider: "local",  label: "local/ollama", cost_class: "free", default_enabled: true, enable_env: null },
];

describe("registry helpers", () => {
  test("getDefaultRegistry returns a copy (mutation-safe)", () => {
    const a = getDefaultRegistry();
    a[0].label = "mutated";
    const b = getDefaultRegistry();
    expect(b[0].label).not.toBe("mutated");
  });

  test("findRegistryEntry matches by label first", () => {
    const entry = findRegistryEntry(TEST_REGISTRY, { label: "openai/chat" });
    expect(entry?.provider).toBe("openai");
  });

  test("findRegistryEntry falls back to provider when no label given", () => {
    const entry = findRegistryEntry(TEST_REGISTRY, { provider: "local" });
    expect(entry?.label).toBe("local/ollama");
  });

  test("findRegistryEntry returns null when nothing matches", () => {
    expect(findRegistryEntry(TEST_REGISTRY, { provider: "cohere" })).toBeNull();
  });
});

describe("evaluateGuard", () => {
  test("free + default_enabled -> allowed", () => {
    const d = evaluateGuard({ label: "local/ollama" }, { registry: TEST_REGISTRY, env: {} });
    expect(d.allowed).toBe(true);
    expect(d.reason).toBe("default_enabled");
  });

  test("metered + no env opt-in -> blocked", () => {
    const d = evaluateGuard({ label: "openai/chat" }, { registry: TEST_REGISTRY, env: {} });
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/^requires_env_TEST_OPENAI_ON/);
  });

  test("metered + env=1 -> allowed", () => {
    const d = evaluateGuard({ label: "openai/chat" }, { registry: TEST_REGISTRY, env: { TEST_OPENAI_ON: "1" } });
    expect(d.allowed).toBe(true);
    expect(d.reason).toBe("env_opt_in");
  });

  test("metered + env=0 -> blocked", () => {
    const d = evaluateGuard({ label: "openai/chat" }, { registry: TEST_REGISTRY, env: { TEST_OPENAI_ON: "0" } });
    expect(d.allowed).toBe(false);
  });

  test("unknown call site -> blocked (default-deny)", () => {
    const d = evaluateGuard({ label: "made-up-provider" }, { registry: TEST_REGISTRY, env: {} });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("no_registry_entry");
  });

  test("force_allow always wins", () => {
    const d = evaluateGuard({ label: "made-up-provider" }, { registry: TEST_REGISTRY, env: {}, force_allow: true });
    expect(d.allowed).toBe(true);
    expect(d.reason).toBe("force_allow");
  });
});

describe("withSpendGuard", () => {
  test("invokes fn when allowed and records event", async () => {
    const state = createSpendState();
    let invoked = false;
    const out = await withSpendGuard(
      { label: "local/ollama" },
      async () => { invoked = true; return "ok"; },
      { registry: TEST_REGISTRY, env: {}, state },
    );
    expect(invoked).toBe(true);
    expect(out).toBe("ok");
    expect(state.events.length).toBe(1);
    expect(state.events[0].allowed).toBe(true);
    expect(state.counts.free).toBe(1);
  });

  test("throws SpendGuardError when blocked and does NOT invoke fn", async () => {
    const state = createSpendState();
    let invoked = false;
    try {
      await withSpendGuard(
        { label: "openai/chat" },
        async () => { invoked = true; return "should not run"; },
        { registry: TEST_REGISTRY, env: {}, state },
      );
      expect.fail("expected SpendGuardError");
    } catch (err) {
      expect(err).toBeInstanceOf(SpendGuardError);
      expect((err as SpendGuardError).code).toMatch(/^requires_env_/);
      expect((err as SpendGuardError).event.allowed).toBe(false);
    }
    expect(invoked).toBe(false);
    expect(state.events.length).toBe(1);
    expect(state.events[0].allowed).toBe(false);
    expect(state.counts.metered).toBe(0);
  });

  test("force_allow lets a normally-blocked call through", async () => {
    const state = createSpendState();
    const out = await withSpendGuard(
      { label: "openai/chat" },
      async () => "yes",
      { registry: TEST_REGISTRY, env: {}, state, force_allow: true },
    );
    expect(out).toBe("yes");
    expect(state.events[0].allowed).toBe(true);
  });

  test("unknown call site -> blocked, fn not invoked", async () => {
    let invoked = false;
    try {
      await withSpendGuard(
        { label: "what-is-this" },
        async () => { invoked = true; return "x"; },
        { registry: TEST_REGISTRY, env: {} },
      );
      expect.fail("expected SpendGuardError");
    } catch (err) {
      expect((err as SpendGuardError).code).toBe("no_registry_entry");
    }
    expect(invoked).toBe(false);
  });
});

describe("summariseSpend", () => {
  test("counts allowed vs blocked and groups by provider", async () => {
    const state = createSpendState();
    await withSpendGuard({ label: "local/ollama" }, async () => 1, { registry: TEST_REGISTRY, env: {}, state });
    await withSpendGuard({ label: "local/ollama" }, async () => 1, { registry: TEST_REGISTRY, env: {}, state });
    try {
      await withSpendGuard({ label: "openai/chat" }, async () => 1, { registry: TEST_REGISTRY, env: {}, state });
    } catch { /* expected block */ }
    const s = summariseSpend(state);
    expect(s.total_calls).toBe(3);
    expect(s.allowed).toBe(2);
    expect(s.blocked).toBe(1);
    expect(s.by_provider.local).toBe(2);
    expect(s.recent_blocked.length).toBe(1);
  });

  test("limits recent_blocked to recentBlockedLimit", async () => {
    const state = createSpendState();
    for (let i = 0; i < 15; i += 1) {
      try {
        await withSpendGuard(
          { label: "openai/chat", call_id: `c-${i}` },
          async () => 1,
          { registry: TEST_REGISTRY, env: {}, state },
        );
      } catch { /* expected block */ }
    }
    const s = summariseSpend(state, 5);
    expect(s.blocked).toBe(15);
    expect(s.recent_blocked.length).toBe(5);
  });
});

describe("DEFAULT_REGISTRY shape", () => {
  test("includes anthropic and openai entries", () => {
    const r = __testing__.DEFAULT_REGISTRY;
    expect(r.some((e) => e.provider === "anthropic")).toBe(true);
    expect(r.some((e) => e.provider === "openai" && e.label.includes("chat"))).toBe(true);
  });

  test("local provider is the only one default-enabled", () => {
    const r = __testing__.DEFAULT_REGISTRY;
    const enabled = r.filter((e) => e.default_enabled);
    expect(enabled.length).toBeGreaterThanOrEqual(1);
    for (const e of enabled) {
      expect(e.cost_class).not.toBe("metered");
    }
  });

  test("every metered entry has an enable_env", () => {
    const r = __testing__.DEFAULT_REGISTRY;
    for (const e of r.filter((e) => e.cost_class === "metered")) {
      expect(e.enable_env).toMatch(/^UNCLICK_AISPEND_/);
    }
  });
});

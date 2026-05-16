import { describe, expect, it } from "vitest";
import {
  decideAiProviderCall,
  getAiProviderInventoryEntry,
  listAiProviderInventory,
  publicAiProviderCostLabels,
} from "./lib/ai-provider-inventory";

describe("ai provider inventory", () => {
  it("lists known provider paths with cost labels and default allowance", () => {
    const inventory = listAiProviderInventory();

    expect(inventory.some((entry) => entry.id === "nudgeonly.openrouter.free-default")).toBe(true);
    expect(inventory.some((entry) => entry.id === "memory.mcp.openai.embeddings")).toBe(true);
    expect(inventory.every((entry) => ["free", "paid", "paid_or_unknown"].includes(entry.cost_tier))).toBe(true);
    expect(inventory.filter((entry) => entry.default_allowed).map((entry) => entry.cost_tier)).toEqual(["free"]);
  });

  it("allows explicitly labelled free default paths", () => {
    expect(decideAiProviderCall({ path_id: "nudgeonly.openrouter.free-default" })).toMatchObject({
      allowed: true,
      cost_tier: "free",
      reason: "free_default_allowed",
      default_allowed: true,
    });
  });

  it("blocks paid paths by default and records the required opt-in flag", () => {
    expect(decideAiProviderCall({ path_id: "memory.mcp.openai.embeddings" })).toMatchObject({
      allowed: false,
      provider: "OpenAI",
      model: "text-embedding-3-small",
      cost_tier: "paid",
      reason: "paid_or_unknown_blocked",
      allow_paid_flag: "MEMORY_OPENAI_EMBEDDINGS_ENABLED",
    });
  });

  it("allows paid paths only when an explicit allow-paid decision is present", () => {
    expect(decideAiProviderCall({
      path_id: "memory.mcp.openai.embeddings",
      allow_paid: true,
    })).toMatchObject({
      allowed: true,
      cost_tier: "paid",
      reason: "explicit_paid_allowed",
    });
  });

  it("fails closed for unknown provider or model costs", () => {
    expect(decideAiProviderCall({
      path_id: "new.experimental.provider",
      model: "surprise-premium-model",
    })).toMatchObject({
      allowed: false,
      provider: "unknown",
      model: "surprise-premium-model",
      cost_tier: "paid_or_unknown",
      reason: "paid_or_unknown_blocked",
    });
  });

  it("keeps public cost-label output free of secret values", () => {
    const labels = publicAiProviderCostLabels();

    expect(labels[0]).not.toHaveProperty("notes");
    expect(JSON.stringify(labels)).not.toMatch(/sk-|secret-value|Bearer\s/i);
    expect(getAiProviderInventoryEntry("arena.anthropic.bot-solve")).toMatchObject({
      provider: "Anthropic",
      cost_tier: "paid",
      default_allowed: false,
    });
  });
});

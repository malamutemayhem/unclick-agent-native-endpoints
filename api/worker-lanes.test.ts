import { describe, expect, it } from "vitest";

import {
  buildTodoLaneTokens,
  evaluateLaneClaim,
  normalizeScopeTokens,
  normalizeWorkerLane,
} from "./lib/worker-lanes";

describe("worker lane helpers", () => {
  it("normalizes scope tokens from public-safe labels", () => {
    expect(normalizeScopeTokens(["Builder", "review ready", "PR:green", "Builder"])).toEqual([
      "builder",
      "review-ready",
      "pr:green",
    ]);
  });

  it("defaults registered lanes to warn mode", () => {
    const lane = normalizeWorkerLane({
      apiKeyHash: "hash_123",
      agentId: "seat-1",
      role: "Builder",
      scopeAllowlist: ["build", "code"],
    });

    expect(lane).toMatchObject({
      api_key_hash: "hash_123",
      agent_id: "seat-1",
      role: "builder",
      scope_allowlist: ["build", "code"],
      scope_denylist: [],
      enforce_mode: "warn",
    });
  });

  it("allows unregistered seats so legacy flows keep working", () => {
    expect(evaluateLaneClaim(null, ["build"])).toEqual({
      decision: "allow",
      reason: "unregistered_lane_legacy_allow",
    });
  });

  it("allows matching allowlist tokens", () => {
    const lane = normalizeWorkerLane({
      apiKeyHash: "hash_123",
      agentId: "builder-seat",
      role: "Builder",
      scopeAllowlist: ["build"],
      enforceMode: "enforce",
    });

    expect(evaluateLaneClaim(lane, ["build", "urgent"])).toEqual({
      decision: "allow",
      reason: "scope_allowlist_match",
      matched_token: "build",
    });
  });

  it("builds public-safe todo tokens for claim checks", () => {
    expect(
      buildTodoLaneTokens({
        title: "Build F: Standing auto-merge bot + PR risk score",
        description: "ScopePack: safe code lane only",
        priority: "urgent",
        status: "open",
      }),
    ).toEqual([
      "urgent",
      "open",
      "build",
      "f:",
      "standing",
      "auto-merge",
      "bot",
      "pr",
      "risk",
      "score",
      "scopepack:",
      "safe",
      "code",
      "lane",
      "only",
    ]);
  });

  it("warns before enforcing allowlist misses", () => {
    const lane = normalizeWorkerLane({
      apiKeyHash: "hash_123",
      agentId: "watcher-seat",
      role: "Watcher",
      scopeAllowlist: ["watch"],
      enforceMode: "warn",
    });

    expect(evaluateLaneClaim(lane, ["build"])).toEqual({
      decision: "warn",
      reason: "scope_allowlist_miss",
    });
  });

  it("rejects denylist matches only when enforce mode is active", () => {
    const lane = normalizeWorkerLane({
      apiKeyHash: "hash_123",
      agentId: "watcher-seat",
      role: "Watcher",
      scopeAllowlist: ["watch"],
      scopeDenylist: ["build"],
      enforceMode: "enforce",
    });

    expect(evaluateLaneClaim(lane, ["build"])).toEqual({
      decision: "reject",
      reason: "scope_denylist_match",
      matched_token: "build",
    });
  });
});


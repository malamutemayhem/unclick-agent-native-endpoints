import { describe, it, expect } from "vitest";
import {
  clusterProfiles,
  clusterKey,
  findDuplicateProfileAgentIds,
  CLUSTER_FRESH_THRESHOLD_MS,
  type FishbowlProfileForCluster,
} from "./clusterProfiles";

const NOW = new Date("2026-04-27T12:00:00Z").getTime();

function profile(
  agent_id: string,
  emoji: string,
  display_name: string | null,
  ageMs: number,
): FishbowlProfileForCluster {
  return {
    agent_id,
    emoji,
    display_name,
    last_seen_at: new Date(NOW - ageMs).toISOString(),
  };
}

describe("clusterProfiles", () => {
  it("(a) 1 fresh + 0 stale: single primary, no aliases", () => {
    const profiles = [profile("a1", "🐠", "Fishy", 30_000)];
    const clusters = clusterProfiles(profiles, NOW);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].primaries).toHaveLength(1);
    expect(clusters[0].primaries[0].agent_id).toBe("a1");
    expect(clusters[0].staleAliasCount).toBe(0);
  });

  it("(b) 1 fresh + 2 stale: collapses stale into staleAliasCount=2", () => {
    const profiles = [
      profile("fresh-1", "🐠", "Fishy", 60_000),
      profile("old-1", "🐠", "Fishy", CLUSTER_FRESH_THRESHOLD_MS + 60_000),
      profile("old-2", "🐠", "Fishy", CLUSTER_FRESH_THRESHOLD_MS + 120_000),
    ];
    const clusters = clusterProfiles(profiles, NOW);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].primaries).toHaveLength(1);
    expect(clusters[0].primaries[0].agent_id).toBe("fresh-1");
    expect(clusters[0].staleAliasCount).toBe(2);
  });

  it("(c) 2 fresh: both end up as primaries (caller renders agent_id chips)", () => {
    const profiles = [
      profile("fresh-1", "🦊", "Foxy", 30_000),
      profile("fresh-2", "🦊", "Foxy", 60_000),
    ];
    const clusters = clusterProfiles(profiles, NOW);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].primaries).toHaveLength(2);
    expect(clusters[0].primaries.map((p) => p.agent_id).sort()).toEqual([
      "fresh-1",
      "fresh-2",
    ]);
    expect(clusters[0].staleAliasCount).toBe(0);
  });

  it("(d) cluster key matches on (emoji, display_name) only - agent_id and last_seen_at do not split clusters", () => {
    expect(clusterKey("🐠", "Fishy")).toBe(clusterKey("🐠", "Fishy"));
    expect(clusterKey("🐠", "Fishy")).not.toBe(clusterKey("🦊", "Fishy"));
    expect(clusterKey("🐠", "Fishy")).not.toBe(clusterKey("🐠", "OtherName"));
    expect(clusterKey("🐠", null)).not.toBe(clusterKey("🐠", "Fishy"));

    const profiles = [
      profile("a", "🐠", "Fishy", 30_000),
      profile("b", "🐠", "Fishy", 60_000),
      profile("c", "🦊", "Fishy", 30_000),
      profile("d", "🐠", "Other", 30_000),
    ];
    const clusters = clusterProfiles(profiles, NOW);
    expect(clusters).toHaveLength(3);
    const fishyEmoji = clusters.find((c) => c.emoji === "🐠" && c.display_name === "Fishy");
    expect(fishyEmoji?.primaries).toHaveLength(2);
  });

  it("falls back to stale-only cluster when no profiles are fresh", () => {
    const profiles = [
      profile("old-1", "🐠", "Fishy", CLUSTER_FRESH_THRESHOLD_MS + 1_000),
      profile("old-2", "🐠", "Fishy", CLUSTER_FRESH_THRESHOLD_MS + 2_000),
    ];
    const clusters = clusterProfiles(profiles, NOW);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].primaries).toHaveLength(2);
    expect(clusters[0].staleAliasCount).toBe(0);
  });

  it("treats null last_seen_at as stale", () => {
    const profiles: FishbowlProfileForCluster[] = [
      { agent_id: "fresh-1", emoji: "🐠", display_name: "Fishy", last_seen_at: new Date(NOW - 1_000).toISOString() },
      { agent_id: "never-seen", emoji: "🐠", display_name: "Fishy", last_seen_at: null },
    ];
    const clusters = clusterProfiles(profiles, NOW);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].primaries).toHaveLength(1);
    expect(clusters[0].primaries[0].agent_id).toBe("fresh-1");
    expect(clusters[0].staleAliasCount).toBe(1);
  });

  it("finds duplicate profile ids by emoji and display name", () => {
    const duplicates = findDuplicateProfileAgentIds([
      profile("fresh-1", "🐠", "Fishy", 60_000),
      profile("old-1", "🐠", "Fishy", CLUSTER_FRESH_THRESHOLD_MS + 60_000),
      profile("different-emoji", "🦊", "Fishy", 60_000),
      profile("different-name", "🐠", "Other", 60_000),
    ]);

    expect([...duplicates].sort()).toEqual(["fresh-1", "old-1"]);
  });

  it("treats null display names as their own duplicate group", () => {
    const duplicates = findDuplicateProfileAgentIds([
      { agent_id: "null-name-1", emoji: "🐠", display_name: null, last_seen_at: null },
      { agent_id: "null-name-2", emoji: "🐠", display_name: null, last_seen_at: null },
      { agent_id: "named", emoji: "🐠", display_name: "Fishy", last_seen_at: null },
    ]);

    expect([...duplicates].sort()).toEqual(["null-name-1", "null-name-2"]);
  });
});

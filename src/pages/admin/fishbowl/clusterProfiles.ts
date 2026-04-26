export interface FishbowlProfileForCluster {
  agent_id: string;
  emoji: string;
  display_name: string | null;
  last_seen_at: string | null;
}

export interface ProfileCluster<P extends FishbowlProfileForCluster = FishbowlProfileForCluster> {
  key: string;
  emoji: string;
  display_name: string | null;
  primaries: P[];
  staleAliasCount: number;
}

export const CLUSTER_FRESH_THRESHOLD_MS = 10 * 60 * 1000;

export function clusterKey(emoji: string, display_name: string | null): string {
  return `${emoji}${display_name ?? ""}`;
}

export function isClusterFresh(p: FishbowlProfileForCluster, nowMs: number): boolean {
  if (!p.last_seen_at) return false;
  return nowMs - new Date(p.last_seen_at).getTime() < CLUSTER_FRESH_THRESHOLD_MS;
}

export function clusterProfiles<P extends FishbowlProfileForCluster>(
  profiles: P[],
  nowMs: number,
): ProfileCluster<P>[] {
  const buckets = new Map<string, { fresh: P[]; stale: P[] }>();
  for (const p of profiles) {
    const k = clusterKey(p.emoji, p.display_name);
    let bucket = buckets.get(k);
    if (!bucket) {
      bucket = { fresh: [], stale: [] };
      buckets.set(k, bucket);
    }
    if (isClusterFresh(p, nowMs)) bucket.fresh.push(p);
    else bucket.stale.push(p);
  }
  const result: ProfileCluster<P>[] = [];
  for (const [key, bucket] of buckets) {
    const sample = bucket.fresh[0] ?? bucket.stale[0];
    if (!sample) continue;
    if (bucket.fresh.length > 0) {
      result.push({
        key,
        emoji: sample.emoji,
        display_name: sample.display_name,
        primaries: bucket.fresh,
        staleAliasCount: bucket.stale.length,
      });
    } else {
      result.push({
        key,
        emoji: sample.emoji,
        display_name: sample.display_name,
        primaries: bucket.stale,
        staleAliasCount: 0,
      });
    }
  }
  return result;
}

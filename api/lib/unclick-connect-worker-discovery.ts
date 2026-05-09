import { type RoutePacketLane, type VisibleWorker } from "./route-packet-consumer.js";

export interface BuildWorkerDiscoveryRow {
  id: string;
  name?: string | null;
  worker_type?: string | null;
  status?: string | null;
  last_health_check_at?: string | null;
}

export interface FishbowlProfileDiscoveryRow {
  agent_id: string;
  emoji?: string | null;
  display_name?: string | null;
  last_seen_at?: string | null;
  current_status?: string | null;
  current_status_updated_at?: string | null;
}

export const UNCLICK_CONNECT_WORKER_FRESH_MS = 2 * 60 * 60 * 1000;

export function buildWorkersToVisibleWorkers(
  rows: BuildWorkerDiscoveryRow[],
): VisibleWorker[] {
  return rows
    .filter((row) => String(row.status ?? "").trim().toLowerCase() === "available")
    .map((row) => ({
      worker_id: row.id,
      lane: inferLaneFromText(`${row.name ?? ""} ${row.worker_type ?? ""}`) ?? "Builder",
      status: "available",
      live: true,
    }));
}

export function fishbowlProfilesToVisibleWorkers(
  rows: FishbowlProfileDiscoveryRow[],
  now = new Date(),
): VisibleWorker[] {
  return rows
    .filter((row) => isFreshProfile(row, now))
    .flatMap((row) => {
      const lane = inferLaneFromText(
        `${row.emoji ?? ""} ${row.display_name ?? ""} ${row.agent_id ?? ""} ${row.current_status ?? ""}`,
      );
      if (!lane) return [];
      return [
        {
          agent_id: row.agent_id,
          lane,
          status: "active",
          live: true,
        },
      ];
    });
}

function isFreshProfile(row: FishbowlProfileDiscoveryRow, now: Date): boolean {
  const lastSeenAtMs = Date.parse(String(row.last_seen_at ?? ""));
  if (!Number.isFinite(lastSeenAtMs)) return false;
  if (now.getTime() - lastSeenAtMs > UNCLICK_CONNECT_WORKER_FRESH_MS) return false;

  const status = String(row.current_status ?? "").trim().toLowerCase();
  if (status.includes("blocked") || status.includes("hold") || status.includes("offline")) {
    return false;
  }

  return true;
}

function inferLaneFromText(text: string): RoutePacketLane | null {
  const value = text.toLowerCase();
  if (value.includes("🛠") || value.includes("builder") || value.includes("build") || value.includes("forge")) {
    return "Builder";
  }
  if (value.includes("proof") || value.includes("prove")) {
    return "Proof";
  }
  if (value.includes("🍿") || value.includes("review") || value.includes("qc") || value.includes("tester")) {
    return "Reviewer";
  }
  if (value.includes("🛡") || value.includes("safety") || value.includes("gatekeeper")) {
    return "Safety";
  }
  if (value.includes("coordinator") || value.includes("master")) {
    return "Coordinator";
  }
  if (value.includes("watcher") || value.includes("relay")) {
    return "Watcher";
  }
  return null;
}

import { describe, expect, it } from "vitest";
import {
  buildWorkersToVisibleWorkers,
  fishbowlProfilesToVisibleWorkers,
} from "./unclick-connect-worker-discovery";

describe("UnClick Connect worker discovery", () => {
  it("maps available Build Desk workers into live visible workers", () => {
    const workers = buildWorkersToVisibleWorkers([
      {
        id: "build-worker-1",
        name: "Forge Builder",
        worker_type: "builder",
        status: "available",
      },
      {
        id: "offline-worker",
        name: "Offline Builder",
        worker_type: "builder",
        status: "offline",
      },
    ]);

    expect(workers).toEqual([
      {
        worker_id: "build-worker-1",
        lane: "Builder",
        status: "available",
        live: true,
      },
    ]);
  });

  it("maps fresh Builder-shaped Fishbowl profiles into live visible workers", () => {
    const workers = fishbowlProfilesToVisibleWorkers(
      [
        {
          agent_id: "scheduled-builder-tether",
          emoji: "🛠️",
          display_name: "Scheduled Builder Tether",
          current_status: "ready for builder work",
          last_seen_at: "2026-05-09T00:10:00.000Z",
        },
      ],
      new Date("2026-05-09T00:30:00.000Z"),
    );

    expect(workers).toEqual([
      {
        agent_id: "scheduled-builder-tether",
        lane: "Builder",
        status: "active",
        live: true,
      },
    ]);
  });

  it("does not treat unknown, stale, or blocked profiles as production workers", () => {
    const workers = fishbowlProfilesToVisibleWorkers(
      [
        {
          agent_id: "unknown-live-profile",
          display_name: "General Profile",
          last_seen_at: "2026-05-09T00:29:00.000Z",
        },
        {
          agent_id: "stale-builder-profile",
          display_name: "Builder",
          last_seen_at: "2026-05-08T21:00:00.000Z",
        },
        {
          agent_id: "blocked-builder-profile",
          display_name: "Builder",
          current_status: "blocked on setup",
          last_seen_at: "2026-05-09T00:29:00.000Z",
        },
      ],
      new Date("2026-05-09T00:30:00.000Z"),
    );

    expect(workers).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import {
  activeOrchestrator,
  hasSplitBrain,
  LAUNCHPAD_ORCHESTRATORS,
  LAUNCHPAD_ROOM_COVERAGE,
  LAUNCHPAD_SEATS,
  summarizeLaunchpadSeats,
} from "./pinballwakeLaunchpad";

describe("PinballWake Launchpad admin model", () => {
  it("has one active orchestrator and standby control surfaces", () => {
    expect(activeOrchestrator()?.id).toBe("lenovo-master");
    expect(hasSplitBrain()).toBe(false);
    expect(LAUNCHPAD_ORCHESTRATORS.some((orchestrator) => orchestrator.role === "standby")).toBe(true);
  });

  it("summarizes worker seats as account capacity", () => {
    const summary = summarizeLaunchpadSeats();

    expect(summary.total).toBe(LAUNCHPAD_SEATS.length);
    expect(summary.available).toBeGreaterThanOrEqual(3);
    expect(summary.codeSeats).toBeGreaterThanOrEqual(2);
    expect(summary.byProvider.ChatGPT).toBeGreaterThanOrEqual(2);
    expect(summary.byProvider.Claude).toBeGreaterThanOrEqual(2);
  });

  it("keeps critical rooms covered or visibly thin", () => {
    const build = LAUNCHPAD_ROOM_COVERAGE.find((room) => room.room === "Build Room");
    const merge = LAUNCHPAD_ROOM_COVERAGE.find((room) => room.room === "Merge Room");
    const safety = LAUNCHPAD_ROOM_COVERAGE.find((room) => room.room === "Safety Room");

    expect(build?.status).toBe("covered");
    expect(merge?.primarySeat).toBe("Lenovo Master");
    expect(safety?.status).toBe("thin");
  });

  it("detects split brain if two orchestrators are marked active", () => {
    expect(
      hasSplitBrain([
        { ...LAUNCHPAD_ORCHESTRATORS[0], role: "active" },
        { ...LAUNCHPAD_ORCHESTRATORS[1], role: "active" },
      ]),
    ).toBe(true);
  });
});

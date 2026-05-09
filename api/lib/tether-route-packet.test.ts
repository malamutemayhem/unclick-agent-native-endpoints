import { describe, expect, it } from "vitest";
import { buildTetherRoutePacket } from "./tether-route-packet";

describe("buildTetherRoutePacket", () => {
  it("turns public-safe tether intent into an experiment route packet", () => {
    const packet = buildTetherRoutePacket(
      {
        item_id: "todo-123",
        item_title: "One live item is waiting",
        lane: "builder",
        needed_action: "Make the smallest useful change.",
        visible_blocker: "Needs Builder help",
        expected_receipt: "proof,HOLD,BLOCKER",
        idempotency_key: "retry-1",
      },
      new Date("2026-05-09T00:10:00.000Z"),
    );

    expect(packet).toMatchObject({
      experiment: true,
      lane: "Builder",
      item: {
        id: "todo-123",
        title: "One live item is waiting",
      },
      needed_action: "Make the smallest useful change.",
      visible_blocker: "Needs Builder help",
      expected_receipt: ["proof", "HOLD", "BLOCKER"],
      created_at: "2026-05-09T00:10:00.000Z",
      ttl_seconds: 1200,
      idempotency_key: "retry-1",
    });
  });

  it("keeps tether defaults generic and public-safe", () => {
    const packet = buildTetherRoutePacket({}, new Date("2026-05-09T00:10:00.000Z"));

    expect(packet.lane).toBe("Builder");
    expect(packet.item.title).toBe("UnClick Connect experiment");
    expect(packet.expected_receipt).toEqual(["proof", "HOLD", "BLOCKER"]);
  });
});

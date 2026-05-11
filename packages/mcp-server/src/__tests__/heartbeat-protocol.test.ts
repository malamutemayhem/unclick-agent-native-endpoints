import { describe, expect, it } from "vitest";

import {
  formatHeartbeatProtocolVersion,
  getHeartbeatProtocol,
  heartbeatProtocolContentFingerprint,
  type HeartbeatProtocol,
} from "../heartbeat-protocol.js";

describe("heartbeat_protocol payload", () => {
  it("returns the same read-only playbook across cycles", () => {
    const first = getHeartbeatProtocol();
    const second = getHeartbeatProtocol();

    expect(first).toEqual(second);
    first.procedure[0] = "mutated by caller";
    expect(getHeartbeatProtocol().procedure[0]).toContain("full heartbeat policy");
    expect(getHeartbeatProtocol().procedure[4]).toContain("save_conversation_turn");
    expect(getHeartbeatProtocol().procedure[5]).toContain("nudgeonly_receipt_bridge");
    expect(getHeartbeatProtocol().procedure[8]).toContain("igniteonly_receipt_consumer");
    expect(getHeartbeatProtocol().procedure[9]).toContain("admin_conversation_turn_ingest");
  });

  it("keeps the public payload schema stable", () => {
    const protocol = getHeartbeatProtocol();

    expect(Object.keys(protocol)).toEqual([
      "version",
      "procedure",
      "alert_format",
      "throttle_rules",
      "watch_state_key",
    ]);
    expect(protocol.version).toMatch(/^\d{4}-\d{2}-\d{2}\.v\d+$/);
    expect(protocol.procedure).toHaveLength(16);
    expect(protocol.procedure[0]).toContain("full heartbeat policy");
    expect(protocol.procedure[1]).toContain("continuity receipts");
    expect(protocol.procedure[2]).toContain("unclick-heartbeat-seat");
    expect(protocol.procedure[3]).toContain("check_signals");
    expect(protocol.procedure[4]).toContain("After check_signals");
    expect(protocol.procedure[5]).toContain("compact public fields");
    expect(protocol.procedure[6]).toContain("smallest safe source text");
    expect(protocol.procedure[7]).toContain("receipt_line");
    expect(protocol.procedure[8]).toContain("ignite_id");
    expect(protocol.procedure[9]).toContain("read UI");
    expect(protocol.procedure[14]).toContain("missing capability");
    expect(protocol.alert_format).toEqual({
      heading: "UnClick alert",
      line_template: "owner -- target -- status -- next safe action",
      max_items: 3,
      max_line_chars: 140,
      style: ["no prose", "no bullets", "no bold"],
      content_source: "UnClick",
    });
    expect(protocol.throttle_rules).toMatchObject({
      idle_after: "24h without signals",
      idle_cadence: "daily 9am",
      active_cadence: "10 minutes",
    });
    expect(protocol.watch_state_key).toBe("heartbeat_last_state");
  });

  it("guards the version when the playbook content changes", () => {
    const protocol = getHeartbeatProtocol();
    const changed: HeartbeatProtocol = {
      ...protocol,
      procedure: [...protocol.procedure, "new instruction"],
    };

    expect(formatHeartbeatProtocolVersion(8)).toBe("2026-05-07.v8");
    expect(protocol.version).toBe("2026-05-07.v7");
    expect(heartbeatProtocolContentFingerprint(protocol)).toBe("fcb381a2d3052ee5");
    expect(heartbeatProtocolContentFingerprint(changed)).not.toBe(
      heartbeatProtocolContentFingerprint(protocol),
    );
  });

  it("does not return secrets or execution permissions", () => {
    const serialized = JSON.stringify(getHeartbeatProtocol()).toLowerCase();

    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("execute mode enabled");
  });
});

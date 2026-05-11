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
    expect(getHeartbeatProtocol().procedure[6]).toContain("save_conversation_turn");
    expect(getHeartbeatProtocol().procedure[7]).toContain("nudgeonly_receipt_bridge");
    expect(getHeartbeatProtocol().procedure[10]).toContain("igniteonly_receipt_consumer");
    expect(getHeartbeatProtocol().procedure[10]).toContain("pushonly_wake_pusher");
    expect(getHeartbeatProtocol().procedure[11]).toContain("admin_conversation_turn_ingest");
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
    expect(protocol.procedure).toHaveLength(18);
    expect(protocol.procedure[0]).toContain("full heartbeat policy");
    expect(protocol.procedure[1]).toContain("continuity receipts");
    expect(protocol.procedure[2]).toContain("unclick-heartbeat-seat");
    expect(protocol.procedure[3]).toContain("job hunt");
    expect(protocol.procedure[4]).toContain("0 active jobs");
    expect(protocol.procedure[4]).toContain("queue hydration failure");
    expect(protocol.procedure[5]).toContain("PinballWake JobHunt Mirror");
    expect(protocol.procedure[5]).toContain("Job Worker");
    expect(protocol.procedure[5]).toContain("free API classifiers may only classify or nudge");
    expect(protocol.procedure[5]).toContain("PushOnly");
    expect(protocol.procedure[5]).toContain("must not create duplicate jobs");
    expect(protocol.procedure[6]).toContain("After check_signals");
    expect(protocol.procedure[7]).toContain("compact public fields");
    expect(protocol.procedure[8]).toContain("smallest safe source text");
    expect(protocol.procedure[9]).toContain("receipt_line");
    expect(protocol.procedure[10]).toContain("ignite_id");
    expect(protocol.procedure[10]).toContain("push_id");
    expect(protocol.procedure[11]).toContain("read UI");
    expect(protocol.procedure[16]).toContain("missing capability");
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

    expect(formatHeartbeatProtocolVersion(9)).toBe("2026-05-07.v9");
    expect(protocol.version).toBe("2026-05-07.v9");
    expect(heartbeatProtocolContentFingerprint(protocol)).toBe("2fffabe70d5b31e2");
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

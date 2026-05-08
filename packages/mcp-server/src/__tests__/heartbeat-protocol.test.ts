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
    expect(getHeartbeatProtocol().procedure[0]).toContain("check_signals");
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
    expect(protocol.procedure).toHaveLength(5);
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

    expect(formatHeartbeatProtocolVersion(3)).toBe("2026-05-07.v3");
    expect(protocol.version).toBe("2026-05-07.v2");
    expect(heartbeatProtocolContentFingerprint(protocol)).toBe("2004d11c449534bc");
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

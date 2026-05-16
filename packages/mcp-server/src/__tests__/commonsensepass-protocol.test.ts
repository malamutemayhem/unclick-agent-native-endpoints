import { describe, expect, it } from "vitest";

import {
  commonSensePassProtocolContentFingerprint,
  formatCommonSensePassProtocolVersion,
  getCommonSensePassProtocol,
  type CommonSensePassProtocol,
} from "../commonsensepass-protocol.js";

describe("commonsensepass_protocol payload", () => {
  it("returns the same read-only playbook across cycles", () => {
    const first = getCommonSensePassProtocol();
    const second = getCommonSensePassProtocol();

    expect(first).toEqual(second);
    first.procedure[0] = "mutated by caller";
    expect(getCommonSensePassProtocol().procedure[0]).toContain("compact evidence packet");
  });

  it("keeps the public payload schema stable", () => {
    const protocol = getCommonSensePassProtocol();

    expect(Object.keys(protocol)).toEqual([
      "version",
      "purpose",
      "when_to_run",
      "tool_contract",
      "verdicts",
      "procedure",
      "receipt_template",
      "guardrails",
      "watch_state_key",
    ]);
    expect(protocol.version).toMatch(/^\d{4}-\d{2}-\d{2}\.v\d+$/);
    expect(protocol.purpose).toContain("read-only sanity gate");
    expect(protocol.when_to_run).toContain("Before saying there is no work.");
    expect(protocol.tool_contract).toMatchObject({
      package_name: "@unclick/commonsensepass",
      function_name: "commonsensepassCheck",
    });
    expect(protocol.verdicts.PASS).toContain("Continue");
    expect(protocol.verdicts.BLOCKER).toContain("Stop");
    expect(protocol.verdicts.HOLD).toContain("missing proof");
    expect(protocol.verdicts.SUPPRESS).toContain("quiet");
    expect(protocol.verdicts.ROUTE).toContain("another worker");
    expect(protocol.procedure).toHaveLength(10);
    expect(protocol.procedure[2]).toContain("deterministic evidence");
    expect(protocol.procedure[8]).toContain("queue hydration failed");
    expect(protocol.receipt_template.required_fields).toEqual([
      "verdict",
      "rule_id",
      "reason",
      "evidence",
      "next_action",
    ]);
    expect(protocol.guardrails[0]).toContain("Verdict-only");
    expect(protocol.watch_state_key).toBe("commonsensepass_last_state");
  });

  it("guards the version when the playbook content changes", () => {
    const protocol = getCommonSensePassProtocol();
    const changed: CommonSensePassProtocol = {
      ...protocol,
      procedure: [...protocol.procedure, "new instruction"],
    };

    expect(formatCommonSensePassProtocolVersion(1)).toBe("2026-05-17.v1");
    expect(protocol.version).toBe("2026-05-17.v1");
    expect(commonSensePassProtocolContentFingerprint(protocol)).toBe("a5836dc10b023004");
    expect(commonSensePassProtocolContentFingerprint(changed)).not.toBe(
      commonSensePassProtocolContentFingerprint(protocol),
    );
  });

  it("does not return secrets or execution permissions", () => {
    const serialized = JSON.stringify(getCommonSensePassProtocol()).toLowerCase();

    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("execute mode enabled");
  });
});

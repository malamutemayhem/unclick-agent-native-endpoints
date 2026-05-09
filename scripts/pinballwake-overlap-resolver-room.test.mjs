import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findOverlaps,
  resolveOverlapRoom,
  scoreOverlapCandidate,
} from "./pinballwake-overlap-resolver-room.mjs";

function pr(number, input = {}) {
  return {
    number,
    title: `PR ${number}`,
    files: [],
    statusCheckRollup: [
      { name: "CI", status: "COMPLETED", conclusion: "SUCCESS" },
      { name: "TestPass", status: "COMPLETED", conclusion: "SUCCESS" },
    ],
    ...input,
  };
}

describe("PinballWake overlap resolver room", () => {
  it("detects shared files between PRs", () => {
    const overlaps = findOverlaps([
      pr(486, { files: ["src/a.ts", "src/b.ts"] }),
      pr(508, { files: ["src/b.ts", "src/c.ts"] }),
    ]);

    assert.deepEqual(overlaps, [{ left: 486, right: 508, files: ["src/b.ts"] }]);
  });

  it("chooses the security/redaction lane over a smaller copy lane", () => {
    const result = resolveOverlapRoom({
      prs: [
        pr(486, {
          title: "RotatePass: harden metadata key redaction guard",
          files: ["src/pages/admin/systemCredentialInventory.ts", "src/pages/admin/systemCredentialInventory.test.ts"],
          proof_status: "PASS",
          targeted_proof_passed: true,
        }),
        pr(508, {
          title: "RotatePass: keep no-probe fallback explicitly untested",
          files: ["src/pages/admin/systemCredentialInventory.ts", "src/pages/admin/systemCredentialInventory.test.ts"],
          proof_status: "PASS",
        }),
      ],
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "decision");
    assert.equal(result.survivor_pr, 486);
    assert.equal(result.decisions[0].action, "survivor_first");
    assert.equal(result.decisions[1].action, "hold_rebase_after_survivor");
  });

  it("honors an explicit preferred PR override", () => {
    const result = resolveOverlapRoom({
      preferredPr: 508,
      prs: [
        pr(486, {
          title: "security redaction guard",
          files: ["src/a.ts"],
          proof_status: "PASS",
        }),
        pr(508, {
          title: "copy update",
          files: ["src/a.ts"],
          proof_status: "PASS",
        }),
      ],
    });

    assert.equal(result.survivor_pr, 508);
  });

  it("returns no_overlap when PRs do not share files", () => {
    const result = resolveOverlapRoom({
      prs: [
        pr(1, { files: ["a.ts"] }),
        pr(2, { files: ["b.ts"] }),
      ],
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "no_overlap");
  });

  it("scores green proof and security higher than stale draft copy", () => {
    const score = scoreOverlapCandidate(
      pr(486, {
        title: "credential token redaction security fix",
        proof_status: "PASS",
        targeted_proof_passed: true,
        files: ["src/credential.ts"],
      }),
    );

    assert.equal(score.security_weight > 0, true);
    assert.equal(score.proof_weight > 0, true);
  });
});

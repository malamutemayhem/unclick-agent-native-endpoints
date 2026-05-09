import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createResearchRoomBrief, validateResearchRoomReport } from "./pinballwake-research-room.mjs";

function job(input = {}) {
  return {
    id: "research-room:test",
    title: "Add a new third-party connector pattern",
    context: "Explore current practice and feasibility before Planning Room writes a ScopePack.",
    files: ["connectors/example/index.ts"],
    third_party: true,
    shared_surface: true,
    estimated_lines: 180,
    ...input,
  };
}

describe("PinballWake Research Room", () => {
  it("skips tiny direct-to-coding work", () => {
    const result = createResearchRoomBrief({
      title: "Tiny docs fix",
      files: ["docs/copy.md"],
      tests: ["node --test scripts/pinballwake-research-room.test.mjs"],
      estimated_lines: 8,
    });

    assert.equal(result.ok, false);
    assert.equal(result.action, "skip");
    assert.equal(result.reason, "research_not_required_for_route");
  });

  it("creates a ScoutPass brief for novel medium work", () => {
    const result = createResearchRoomBrief(job(), { now: "20260505" });

    assert.equal(result.ok, true);
    assert.equal(result.brief.depth, "scout");
    assert.equal(result.brief.ack_required, false);
    assert.equal(result.brief.research_id, "research:research-room:test:20260505");
    assert.ok(result.brief.question_bank.some((question) => question.includes("80/20")));
  });

  it("creates a DeepDive brief with ACK for protected surfaces", () => {
    const result = createResearchRoomBrief(
      job({
        title: "Credentials and redaction routing",
        context: "Mentions credentials, tokens, secrets, payments, security, redaction, and sanitization.",
        files: ["docs/copy.md"],
        third_party: false,
      }),
    );

    assert.equal(result.ok, true);
    assert.equal(result.brief.depth, "deep");
    assert.equal(result.brief.ack_required, true);
    assert.match(result.route.reason, /auth_or_keys/);
    assert.ok(result.brief.protected_reasons.includes("security_sensitive"));
    assert.ok(result.brief.question_bank.some((question) => question.includes("protected-surface")));
  });

  it("honors explicit research-only requests", () => {
    const result = createResearchRoomBrief({
      title: "Compare agent job routers #research-only",
      context: "Research only, do not plan yet.",
      tags: ["research-only"],
    });

    assert.equal(result.ok, true);
    assert.equal(result.route.route, "research-only");
    assert.equal(result.brief.depth, "standard");
  });

  it("uses caller-provided research questions when supplied", () => {
    const result = createResearchRoomBrief(
      job({
        research_questions: ["Can we fork an existing job runner?", "What is the safest first slice?"],
      }),
    );

    assert.deepEqual(result.brief.question_bank, ["Can we fork an existing job runner?", "What is the safest first slice?"]);
  });

  it("validates complete research reports", () => {
    const result = validateResearchRoomReport({
      depth: "scout",
      verdict: "proceed_to_planning",
      summary: "A small existing pattern exists.",
      recommendation: "Proceed with a narrow ScopePack.",
      risks: ["Overbuilding."],
      alternatives_considered: ["Do nothing.", "Build full service."],
      scopepack_constraints: ["Owned files only."],
      proof_recommendations: ["Run focused node tests."],
      stop_conditions: ["Protected surface appears."],
    });

    assert.equal(result.ok, true);
    assert.equal(result.report.verdict, "proceed_to_planning");
  });

  it("rejects incomplete reports", () => {
    const result = validateResearchRoomReport({
      verdict: "proceed_to_planning",
      summary: "Thin report.",
      recommendation: "Proceed.",
      risks: [],
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, "missing_report_list");
  });

  it("requires ACK on deep reports", () => {
    const result = validateResearchRoomReport({
      depth: "deep",
      ack_required: true,
      verdict: "proceed_to_planning",
      summary: "Protected surface is safe with constraints.",
      recommendation: "Proceed only after ACK.",
      risks: ["Security-sensitive context."],
      alternatives_considered: ["Defer."],
      scopepack_constraints: ["No auth changes."],
      proof_recommendations: ["Run safety tests."],
      stop_conditions: ["Missing ACK."],
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, "deep_report_ack_not_complete");
  });

  it("accepts deep reports only after explicit ACK completion", () => {
    const result = validateResearchRoomReport({
      depth: "deep",
      ack_required: true,
      ack_status: "PASS",
      verdict: "proceed_to_planning",
      summary: "Protected surface is safe with constraints.",
      recommendation: "Proceed only after ACK.",
      risks: ["Security-sensitive context."],
      alternatives_considered: ["Defer."],
      scopepack_constraints: ["No auth changes."],
      proof_recommendations: ["Run safety tests."],
      stop_conditions: ["Missing ACK."],
    });

    assert.equal(result.ok, true);
    assert.equal(result.report.ack_status, "PASS");
  });
});

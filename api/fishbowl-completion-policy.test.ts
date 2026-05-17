import { describe, expect, it } from "vitest";
import { evaluateFishbowlCompletionPolicy } from "./lib/fishbowl-completion-policy";

const baseTodo = {
  id: "todo-1",
  title: "Memory Recall Check pollution fix",
  description: "Fix the repeated Most Accessed Facts list.",
  created_by_agent_id: "builder-seat",
};

describe("evaluateFishbowlCompletionPolicy", () => {
  it("blocks done when no proof comment exists", () => {
    const result = evaluateFishbowlCompletionPolicy({
      todo: baseTodo,
      comments: [],
      closerAgentId: "reviewer-seat",
    });

    expect(result).toMatchObject({ allowed: false, code: "missing_proof" });
  });

  it("blocks self-created and self-closed jobs without independent proof", () => {
    const result = evaluateFishbowlCompletionPolicy({
      todo: baseTodo,
      comments: [{ author_agent_id: "builder-seat", text: "PASS: tests passed; proof: npm test." }],
      closerAgentId: "builder-seat",
    });

    expect(result).toMatchObject({ allowed: false, code: "independent_verifier_required" });
  });

  it("allows non-UI work with independent commit or test proof", () => {
    const result = evaluateFishbowlCompletionPolicy({
      todo: baseTodo,
      comments: [{ author_agent_id: "reviewer-seat", text: "PASS: tests passed; proof: commit abc1234." }],
      closerAgentId: "builder-seat",
    });

    expect(result).toMatchObject({ allowed: true, code: "allowed" });
  });

  it("blocks coding work when proof only cites tests", () => {
    const result = evaluateFishbowlCompletionPolicy({
      todo: {
        ...baseTodo,
        title: "TestPass API package-boundary cleanup v1",
        description: "Stop API routes from importing TestPass internals by relative source path.",
      },
      comments: [{ author_agent_id: "reviewer-seat", text: "PASS: tests passed; proof: npm test." }],
      closerAgentId: "builder-seat",
    });

    expect(result).toMatchObject({ allowed: false, code: "git_proof_required" });
  });

  it("blocks coding work with screenshot proof but no Git or deploy proof", () => {
    const result = evaluateFishbowlCompletionPolicy({
      todo: {
        ...baseTodo,
        title: "Architecture QC: Tools component split v1",
        description: "Build component split for the Tools UI.",
      },
      comments: [
        {
          author_agent_id: "reviewer-seat",
          text: "PASS: before/after screenshot proof captured at C:\\G\\Screenshots\\tools-after.png.",
        },
      ],
      closerAgentId: "builder-seat",
    });

    expect(result).toMatchObject({ allowed: false, code: "git_proof_required" });
  });

  it("allows explicit no-code proof for non-code closure work", () => {
    const result = evaluateFishbowlCompletionPolicy({
      todo: {
        ...baseTodo,
        title: "Automation playbook rank trigger methods",
        description: "Policy and routing update only.",
      },
      comments: [
        {
          author_agent_id: "reviewer-seat",
          text: "PASS: NO_CODE_NEEDED, Boardroom policy comment posted and no repository files changed.",
        },
      ],
      closerAgentId: "builder-seat",
    });

    expect(result).toMatchObject({ allowed: true, code: "allowed" });
  });

  it("blocks UI work when proof lacks screenshots", () => {
    const result = evaluateFishbowlCompletionPolicy({
      todo: {
        ...baseTodo,
        title: "UXPass visual polish gate",
        description: "UI overhaul for the Jobs page.",
      },
      comments: [{ author_agent_id: "reviewer-seat", text: "PASS: tests passed; proof: npm test." }],
      closerAgentId: "builder-seat",
    });

    expect(result).toMatchObject({ allowed: false, code: "ui_screenshot_required" });
  });

  it("allows UI work when independent screenshot proof exists", () => {
    const result = evaluateFishbowlCompletionPolicy({
      todo: {
        ...baseTodo,
        title: "UXPass visual polish gate",
        description: "UI overhaul for the Jobs page.",
      },
      comments: [
        {
          author_agent_id: "reviewer-seat",
          text: "PASS: PR #913 and before/after screenshot proof captured at C:\\G\\Screenshots\\uxpass-after.png.",
        },
      ],
      closerAgentId: "builder-seat",
    });

    expect(result).toMatchObject({ allowed: true, code: "allowed" });
  });
});

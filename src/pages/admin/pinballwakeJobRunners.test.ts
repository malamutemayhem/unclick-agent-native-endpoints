import { describe, expect, it } from "vitest";
import {
  choosePinballWakeJobRunner,
  PINBALLWAKE_JOB_RUNNERS,
  runnerCanAcceptJob,
  summarizePinballWakeJobRunners,
} from "./pinballwakeJobRunners";

describe("PinballWake job runners", () => {
  it("does not treat chat-only workers as code execution seats", () => {
    const tester = PINBALLWAKE_JOB_RUNNERS.find((runner) => runner.id === "tester-product-context");
    const safetyChecker = PINBALLWAKE_JOB_RUNNERS.find((runner) => runner.id === "safety-checker");

    expect(tester).toBeTruthy();
    expect(safetyChecker).toBeTruthy();
    expect(
      runnerCanAcceptJob(tester!, {
        kind: "implementation",
        lane: "rotatepass",
        title: "Fix RotatePass overlap",
        requiresCode: true,
      }),
    ).toBe(false);
    expect(
      runnerCanAcceptJob(safetyChecker!, {
        kind: "implementation",
        lane: "wakepass",
        title: "Patch watcher",
        requiresCode: true,
      }),
    ).toBe(false);
  });

  it("routes implementation work to proven builders instead of context workers", () => {
    const runner = choosePinballWakeJobRunner({
      kind: "implementation",
      lane: "rotatepass",
      title: "Fix stale RotatePass branch",
      requiresCode: true,
    });

    expect(runner?.id).toBe("builder-codex");
    expect(runner?.readiness).toBe("builder_ready");
  });

  it("keeps owner-decision work available to product/context lanes", () => {
    const runner = choosePinballWakeJobRunner({
      kind: "owner_decision",
      lane: "rotatepass owner decision",
      title: "Decide which overlapping PR survives",
      requiresCode: false,
    });

    expect(runner?.id).toBe("tester-product-context");
  });

  it("routes Jobs queue cleanup to the Jobs Worker before builders", () => {
    const runner = choosePinballWakeJobRunner({
      kind: "queue_management",
      lane: "jobs stale queue scopepack",
      title: "Prepare stale Jobs for PinballWake",
      requiresCode: false,
    });

    expect(runner?.id).toBe("jobs-worker");
    expect(runner?.capabilities).toContain("queue_management");
    expect(runner?.notFor).toContain("product code");
  });

  it("summarizes runnable hands separately from probes", () => {
    const summary = summarizePinballWakeJobRunners();

    expect(summary.total).toBe(PINBALLWAKE_JOB_RUNNERS.length);
    expect(summary.codeHands).toBeGreaterThanOrEqual(1);
    expect(summary.needsProbe).toBeGreaterThanOrEqual(1);
    expect(summary.byReadiness.context_only).toBeGreaterThanOrEqual(1);
  });
});

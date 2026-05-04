import { describe, expect, it } from "vitest";
import {
  choosePinballWakeJobRunner,
  PINBALLWAKE_JOB_RUNNERS,
  runnerCanAcceptJob,
  summarizePinballWakeJobRunners,
} from "./pinballwakeJobRunners";

describe("PinballWake job runners", () => {
  it("does not treat chat-only workers as code execution seats", () => {
    const xpass = PINBALLWAKE_JOB_RUNNERS.find((runner) => runner.id === "xpass-product-context");
    const gatekeeper = PINBALLWAKE_JOB_RUNNERS.find((runner) => runner.id === "gatekeeper-safety");

    expect(xpass).toBeTruthy();
    expect(gatekeeper).toBeTruthy();
    expect(
      runnerCanAcceptJob(xpass!, {
        kind: "implementation",
        lane: "rotatepass",
        title: "Fix RotatePass overlap",
        requiresCode: true,
      }),
    ).toBe(false);
    expect(
      runnerCanAcceptJob(gatekeeper!, {
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

    expect(runner?.id).toBe("forge-codex-builder");
    expect(runner?.readiness).toBe("builder_ready");
  });

  it("keeps owner-decision work available to product/context lanes", () => {
    const runner = choosePinballWakeJobRunner({
      kind: "owner_decision",
      lane: "rotatepass owner decision",
      title: "Decide which overlapping PR survives",
      requiresCode: false,
    });

    expect(runner?.id).toBe("xpass-product-context");
  });

  it("summarizes runnable hands separately from probes", () => {
    const summary = summarizePinballWakeJobRunners();

    expect(summary.total).toBe(PINBALLWAKE_JOB_RUNNERS.length);
    expect(summary.codeHands).toBeGreaterThanOrEqual(2);
    expect(summary.needsProbe).toBeGreaterThanOrEqual(1);
    expect(summary.byReadiness.context_only).toBeGreaterThanOrEqual(1);
  });
});

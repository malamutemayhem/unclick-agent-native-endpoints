import { describe, expect, it } from "vitest";
import {
  chooseBenchCallUp,
  choosePinballWakeJobRunner,
  classifyBenchReadiness,
  describeBenchReadiness,
  PINBALLWAKE_JOB_RUNNERS,
  type PinballWakeJobRunner,
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

  it("classifies bench readiness from runner metadata", () => {
    const builder = PINBALLWAKE_JOB_RUNNERS.find((runner) => runner.id === "builder-codex");
    const reviewer = PINBALLWAKE_JOB_RUNNERS.find((runner) => runner.id === "safety-checker");
    const repairer = PINBALLWAKE_JOB_RUNNERS.find((runner) => runner.id === "repairer-plex-unproven");

    expect(builder).toBeTruthy();
    expect(reviewer).toBeTruthy();
    expect(repairer).toBeTruthy();
    expect(classifyBenchReadiness(builder!)).toBe("ready");
    expect(classifyBenchReadiness(reviewer!)).toBe("review_only");
    expect(classifyBenchReadiness(repairer!)).toBe("needs_probe");
    expect(describeBenchReadiness(builder!).canImplement).toBe(true);
  });

  it("uses the bench call-up gate for implementation packets", () => {
    const decision = chooseBenchCallUp({
      kind: "implementation",
      lane: "wakepass tests",
      title: "Patch WakePass tests",
      requiresCode: true,
    });

    expect(decision.status).toBe("PASS");
    expect(decision.runner?.id).toBe("builder-codex");
    expect(decision.readiness).toBe("ready");
  });

  it("uses review specialists for qc review packets", () => {
    const decision = chooseBenchCallUp({
      kind: "qc_review",
      lane: "release safety hold review",
      title: "Review safe merge",
      requiresCode: false,
    });

    expect(decision.status).toBe("PASS");
    expect(decision.runner?.id).toBe("safety-checker");
    expect(decision.readiness).toBe("review_only");
  });

  it("routes XPass status relay work to context-ready pass lanes", () => {
    const decision = chooseBenchCallUp({
      kind: "status_relay",
      lane: "xpass dogfood proof",
      title: "Collect XPass proof",
      requiresCode: false,
    });

    expect(decision.status).toBe("PASS");
    expect(decision.runner?.id).toBe("tester-product-context");
    expect(decision.readiness).toBe("context_only");
  });

  it("routes queue-management and owner-decision packets to Jobs Worker first", () => {
    const queueDecision = chooseBenchCallUp({
      kind: "queue_management",
      lane: "jobs stale queue scopepack",
      title: "Prepare stale job",
      requiresCode: false,
    });
    const ownerDecision = chooseBenchCallUp({
      kind: "owner_decision",
      lane: "rotatepass owner decision",
      title: "Hold or reroute",
      requiresCode: false,
    });

    expect(queueDecision.status).toBe("PASS");
    expect(ownerDecision.status).toBe("PASS");
    expect(queueDecision.runner?.id).toBe("jobs-worker");
    expect(ownerDecision.runner?.id).toBe("jobs-worker");
  });

  it("returns a blocker when the best specialist still needs a probe", () => {
    const repairer = PINBALLWAKE_JOB_RUNNERS.find((runner) => runner.id === "repairer-plex-unproven");

    const decision = chooseBenchCallUp(
      {
        kind: "implementation",
        lane: "small implementation after probe",
        title: "Try a code packet",
        requiresCode: true,
      },
      [repairer!],
    );

    expect(decision.status).toBe("BLOCKER");
    expect(decision.runner?.id).toBe("repairer-plex-unproven");
    expect(decision.reason).toContain("needs_probe");
  });

  it("returns a blocker when no eligible specialist exists", () => {
    const offlineRunner: PinballWakeJobRunner = {
      id: "offline-builder",
      emoji: "🛠️",
      name: "Offline Builder",
      kind: "local-runner",
      host: "bench",
      readiness: "offline",
      capabilities: ["implementation"],
      safeFor: ["bench"],
      notFor: ["everything until online"],
      proof: "No pulse.",
      nextProbe: "Wake and verify repo access.",
    };

    const decision = chooseBenchCallUp(
      {
        kind: "implementation",
        lane: "bench",
        title: "Patch code",
        requiresCode: true,
      },
      [offlineRunner],
    );

    expect(decision.status).toBe("BLOCKER");
    expect(decision.runner?.id).toBe("offline-builder");
    expect(decision.reason).toContain("offline");
  });
});

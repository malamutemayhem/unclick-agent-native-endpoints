import {
  FlowPassGeoPassAdapterSchema,
  FlowPassReportSchema,
  type FlowPassGeoPassAdapter,
  type FlowPassReport,
  type FlowPassStepId,
  type FlowPassStepResult,
} from "./schema.js";
import { createFlowPassPlan } from "./flow-plan.js";

export type FlowPassVerdictPack = ReturnType<typeof createFlowPassPlan> & {
  scannerSource: FlowPassGeoPassAdapter;
};

function defaultScannerSource(targetUrl: string): FlowPassGeoPassAdapter {
  return {
    source: "geopass",
    target_url: targetUrl,
    mode: "plan-only",
    shared_check_ids: ["aggregate-ai-engine-readiness"],
  };
}

export function createFlowPassVerdictPack(input: {
  targetUrl: string;
  journeyId?: string;
  journeyName?: string;
  journeyKind?: "signup" | "auth" | "checkout" | "onboarding" | "support" | "custom";
  steps?: FlowPassStepId[];
  scannerSource?: FlowPassGeoPassAdapter;
}): FlowPassVerdictPack {
  const plan = createFlowPassPlan(input);

  return {
    ...plan,
    scannerSource: FlowPassGeoPassAdapterSchema.parse(
      input.scannerSource ?? defaultScannerSource(plan.targetUrl),
    ),
  };
}

export function createPlanOnlyFlowPassReport(input: {
  targetUrl: string;
  generatedAt?: string;
  journeyId?: string;
  journeyName?: string;
  journeyKind?: "signup" | "auth" | "checkout" | "onboarding" | "support" | "custom";
  steps?: FlowPassStepId[];
  scannerSource?: FlowPassGeoPassAdapter;
  notes?: string[];
}): FlowPassReport {
  const verdictPack = createFlowPassVerdictPack(input);
  const stepResults: FlowPassStepResult[] = verdictPack.steps.map((step) => ({
    step_id: step.id,
    label: step.label,
    score: 0,
    verdict: "unknown",
    findings: [],
    comments: [
      "Plan-only placeholder: run fixture-driven checks in a later chip.",
    ],
  }));

  return FlowPassReportSchema.parse({
    target_url: verdictPack.targetUrl,
    generated_at: input.generatedAt ?? new Date(0).toISOString(),
    mode: "plan-only",
    journey: verdictPack.journey,
    journey_readiness_score: 0,
    verdict: "unknown",
    steps: stepResults,
    scanner_source: {
      kind: "geopass-plan",
      mode: verdictPack.scannerSource.mode ?? "plan-only",
      target_url: verdictPack.scannerSource.target_url,
      shared_check_ids: verdictPack.scannerSource.shared_check_ids,
    },
    notes: input.notes ?? [
      "FlowPass is fixture-driven and does not execute live auth, checkout, billing, email, or destructive flows in this chip.",
    ],
  });
}

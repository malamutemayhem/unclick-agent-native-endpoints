import {
  FlowPassJourneyKindSchema,
  FlowPassStepIdSchema,
  type FlowPassJourneyKind,
  type FlowPassStep,
  type FlowPassStepId,
} from "./schema.js";

export type FlowPassPlan = {
  targetUrl: string;
  mode: "plan-only";
  journey: {
    id: string;
    name: string;
    kind: FlowPassJourneyKind;
  };
  steps: FlowPassStep[];
  disallowedActions: string[];
};

export const DEFAULT_FLOWPASS_STEPS: FlowPassStep[] = [
  {
    id: "entry-route",
    label: "Entry route loads",
    route: "/",
    required: true,
    fixtures: ["public route fixture"],
    evidence_kinds: ["route", "fixture"],
  },
  {
    id: "primary-cta",
    label: "Primary CTA is reachable",
    required: true,
    fixtures: ["cta text fixture", "link target fixture"],
    evidence_kinds: ["link", "fixture"],
  },
  {
    id: "form-readiness",
    label: "Form is ready for fixture input",
    required: true,
    fixtures: ["valid fixture input", "required field fixture"],
    evidence_kinds: ["form", "fixture"],
  },
  {
    id: "success-state",
    label: "Success state is represented",
    required: true,
    fixtures: ["success copy fixture", "receipt fixture"],
    evidence_kinds: ["route", "manual-note"],
  },
  {
    id: "failure-state",
    label: "Failure state is represented",
    required: true,
    fixtures: ["validation error fixture", "recoverable error fixture"],
    evidence_kinds: ["form", "console-log", "manual-note"],
  },
  {
    id: "navigation-continuity",
    label: "Navigation continuity is preserved",
    required: true,
    fixtures: ["back link fixture", "next route fixture"],
    evidence_kinds: ["link", "route"],
  },
  {
    id: "handoff-proof",
    label: "Handoff proof is available",
    required: true,
    fixtures: ["receipt fixture", "state handoff fixture"],
    evidence_kinds: ["fixture", "manual-note"],
  },
];

const DISALLOWED_ACTIONS = [
  "live signup execution",
  "live auth execution",
  "live checkout or billing execution",
  "email delivery",
  "credential access",
  "production database writes",
  "destructive form submission",
];

export function createFlowPassPlan(input: {
  targetUrl: string;
  journeyId?: string;
  journeyName?: string;
  journeyKind?: FlowPassJourneyKind;
  steps?: FlowPassStepId[];
}): FlowPassPlan {
  const selectedSteps = new Set(
    (input.steps ?? DEFAULT_FLOWPASS_STEPS.map((step) => step.id)).map((step) =>
      FlowPassStepIdSchema.parse(step),
    ),
  );

  return {
    targetUrl: new URL(input.targetUrl).toString(),
    mode: "plan-only",
    journey: {
      id: input.journeyId ?? "primary-journey",
      name: input.journeyName ?? "Primary product journey",
      kind: FlowPassJourneyKindSchema.parse(input.journeyKind ?? "custom"),
    },
    steps: DEFAULT_FLOWPASS_STEPS.filter((step) => selectedSteps.has(step.id)),
    disallowedActions: DISALLOWED_ACTIONS,
  };
}

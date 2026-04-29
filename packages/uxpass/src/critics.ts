import { HAT_IDS } from "./schema.js";
import type { CheckEvaluation, CriticBreakdown, UXScoreBreakdown } from "./types.js";

import type { CriticExecutionMode } from "./types.js";

export interface CriticDefinition {
  id: string;
  label: string;
  score_component: keyof UXScoreBreakdown;
  mode: CriticExecutionMode;
  role: string;
}

export const UXPASS_CRITICS: CriticDefinition[] = [
  {
    id: "graphic-designer",
    label: "Graphic Designer",
    score_component: "aesthetic_coherence",
    mode: "llm",
    role: "Checks visual hierarchy, composition, polish, and aesthetic fit.",
  },
  {
    id: "ux-specialist",
    label: "UX Specialist",
    score_component: "first_run_quality",
    mode: "llm",
    role: "Checks task flow, friction, orientation, and completion confidence.",
  },
  {
    id: "frontend",
    label: "Frontend",
    score_component: "first_run_quality",
    mode: "deterministic",
    role: "Checks basic HTML health and route correctness.",
  },
  {
    id: "accessibility",
    label: "Accessibility",
    score_component: "first_run_quality",
    mode: "deterministic",
    role: "Checks semantic and assistive-technology foundations.",
  },
  {
    id: "brand-steward",
    label: "Brand Steward",
    score_component: "aesthetic_coherence",
    mode: "llm",
    role: "Checks voice, promise, consistency, and brand trust.",
  },
  {
    id: "motion",
    label: "Motion",
    score_component: "motion_quality",
    mode: "llm",
    role: "Checks animation purpose, pacing, restraint, and accessibility impact.",
  },
  {
    id: "conversion",
    label: "Conversion",
    score_component: "first_run_quality",
    mode: "llm",
    role: "Checks calls to action, decision clarity, and funnel confidence.",
  },
  {
    id: "information-architect",
    label: "Information Architect",
    score_component: "first_run_quality",
    mode: "llm",
    role: "Checks navigation, grouping, hierarchy, and findability.",
  },
  {
    id: "performance",
    label: "Performance",
    score_component: "first_run_quality",
    mode: "deterministic",
    role: "Checks response timing and payload size guardrails.",
  },
  {
    id: "mobile",
    label: "Mobile",
    score_component: "first_run_quality",
    mode: "deterministic",
    role: "Checks mobile viewport foundations.",
  },
  {
    id: "i18n",
    label: "Internationalization",
    score_component: "first_run_quality",
    mode: "llm",
    role: "Checks localisation readiness, language assumptions, and format bias.",
  },
  {
    id: "privacy-trust",
    label: "Privacy and Trust",
    score_component: "dark_pattern_cleanliness",
    mode: "deterministic",
    role: "Checks trust, transport security, and privacy-facing cues.",
  },
  {
    id: "onboarding",
    label: "Onboarding",
    score_component: "first_run_quality",
    mode: "llm",
    role: "Checks first-run clarity, setup burden, and activation moments.",
  },
  {
    id: "content",
    label: "Content",
    score_component: "first_run_quality",
    mode: "llm",
    role: "Checks copy clarity, tone, scanning, and terminology.",
  },
  {
    id: "visual-designer",
    label: "Visual Designer",
    score_component: "aesthetic_coherence",
    mode: "deterministic",
    role: "Checks baseline visual metadata and polish signals.",
  },
  {
    id: "cognitive-load",
    label: "Cognitive Load",
    score_component: "first_run_quality",
    mode: "llm",
    role: "Checks mental effort, choice overload, and progressive disclosure.",
  },
  {
    id: "agent-readability",
    label: "Agent Readability",
    score_component: "agent_readability",
    mode: "deterministic",
    role: "Checks how clearly agents can inspect and understand the page.",
  },
  {
    id: "dark-pattern-detector",
    label: "Dark Pattern Detector",
    score_component: "dark_pattern_cleanliness",
    mode: "llm",
    role: "Checks manipulation, hidden costs, forced continuity, and consent traps.",
  },
];

const canonicalIds = new Set<string>(HAT_IDS);

export function criticIds(): string[] {
  return UXPASS_CRITICS.map((critic) => critic.id);
}

export function criticDefinitionsById(): Record<string, CriticDefinition> {
  return Object.fromEntries(UXPASS_CRITICS.map((critic) => [critic.id, critic]));
}

export function validateCriticRoster(): boolean {
  return UXPASS_CRITICS.length === HAT_IDS.length
    && UXPASS_CRITICS.every((critic) => canonicalIds.has(critic.id));
}

export function buildCriticBreakdown(evaluations: CheckEvaluation[]): CriticBreakdown[] {
  const byHat: Record<string, { pass: number; fail: number; na: number }> = {};
  for (const evaluation of evaluations) {
    if (!byHat[evaluation.hat]) byHat[evaluation.hat] = { pass: 0, fail: 0, na: 0 };
    byHat[evaluation.hat][evaluation.verdict]++;
  }

  return UXPASS_CRITICS.map((critic) => {
    const stats = byHat[critic.id] ?? { pass: 0, fail: 0, na: 0 };
    return {
      id: critic.id,
      label: critic.label,
      score_component: critic.score_component,
      mode: critic.mode,
      status: byHat[critic.id] ? "ran" : "queued",
      pass: stats.pass,
      fail: stats.fail,
      na: stats.na,
    };
  });
}

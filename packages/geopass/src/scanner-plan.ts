import {
  GeoPassBotIdSchema,
  GeoPassCheckIdSchema,
  GeoPassEngineIdSchema,
  type GeoPassBotId,
  type GeoPassCheckId,
  type GeoPassEngineId,
} from "./schema.js";

export type GeoPassScannerMode = "plan-only";

export type GeoPassScannerStep = {
  id: GeoPassCheckId;
  label: string;
  purpose: string;
  evidenceKinds: string[];
  sharedWith: Array<"seopass" | "flowpass" | "legalpass" | "sloppass" | "uxpass">;
};

export type GeoPassScannerPlan = {
  targetUrl: string;
  mode: GeoPassScannerMode;
  engines: GeoPassEngineId[];
  bots: GeoPassBotId[];
  steps: GeoPassScannerStep[];
  disallowedActions: string[];
};

export const DEFAULT_GEOPASS_ENGINES: GeoPassEngineId[] = [
  "chatgpt",
  "claude",
  "perplexity",
  "gemini",
  "copilot",
  "grok",
  "meta-ai",
];

export const DEFAULT_GEOPASS_BOTS: GeoPassBotId[] = [
  "GPTBot",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
  "Bingbot",
  "Twitterbot",
  "FacebookBot",
];

export const DEFAULT_GEOPASS_SCANNER_STEPS: GeoPassScannerStep[] = [
  {
    id: "ai-bot-crawlability",
    label: "AI bot crawlability matrix",
    purpose:
      "Plan robots.txt and public bot access checks for major generative engines.",
    evidenceKinds: ["robots-txt", "manual-note"],
    sharedWith: ["seopass"],
  },
  {
    id: "llms-txt",
    label: "llms.txt presence and quality",
    purpose:
      "Check whether the site publishes a useful llms.txt guide for AI readers.",
    evidenceKinds: ["llms-txt"],
    sharedWith: ["seopass", "sloppass"],
  },
  {
    id: "schema-org-citation-grade",
    label: "schema.org citation-grade validation",
    purpose:
      "Plan structured data checks that make public facts easier to cite accurately.",
    evidenceKinds: ["schema-org"],
    sharedWith: ["seopass", "legalpass"],
  },
  {
    id: "brand-mention-readiness",
    label: "Brand mention readiness",
    purpose:
      "Plan public-safe brand query fixtures without paid API calls or live prompts.",
    evidenceKinds: ["brand-query"],
    sharedWith: ["seopass", "uxpass"],
  },
  {
    id: "wikidata-presence",
    label: "Wikidata presence",
    purpose:
      "Plan public entity presence checks for citation context and disambiguation.",
    evidenceKinds: ["wikidata"],
    sharedWith: ["seopass"],
  },
  {
    id: "common-crawl-presence",
    label: "Common Crawl presence",
    purpose:
      "Plan public web corpus presence checks without fetching private content.",
    evidenceKinds: ["common-crawl"],
    sharedWith: ["seopass"],
  },
  {
    id: "aggregate-ai-engine-readiness",
    label: "Aggregate AI engine readiness score",
    purpose:
      "Combine public diagnostics into one readiness score and shared pass signals.",
    evidenceKinds: ["lighthouse", "manual-note"],
    sharedWith: ["seopass", "flowpass", "legalpass", "sloppass", "uxpass"],
  },
];

const DISALLOWED_ACTIONS = [
  "live crawler execution",
  "paid API calls",
  "credential access",
  "production database writes",
  "citation guarantees",
];

export function createGeoPassScannerPlan(input: {
  targetUrl: string;
  engines?: GeoPassEngineId[];
  bots?: GeoPassBotId[];
  checks?: GeoPassCheckId[];
}): GeoPassScannerPlan {
  const engines = (input.engines ?? DEFAULT_GEOPASS_ENGINES).map((engine) =>
    GeoPassEngineIdSchema.parse(engine),
  );
  const bots = (input.bots ?? DEFAULT_GEOPASS_BOTS).map((bot) =>
    GeoPassBotIdSchema.parse(bot),
  );
  const checks = new Set(
    (input.checks ?? DEFAULT_GEOPASS_SCANNER_STEPS.map((step) => step.id)).map(
      (check) => GeoPassCheckIdSchema.parse(check),
    ),
  );

  return {
    targetUrl: new URL(input.targetUrl).toString(),
    mode: "plan-only",
    engines,
    bots,
    steps: DEFAULT_GEOPASS_SCANNER_STEPS.filter((step) => checks.has(step.id)),
    disallowedActions: DISALLOWED_ACTIONS,
  };
}

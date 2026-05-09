import {
  SeoPassCheckIdSchema,
  SeoPassGeoPassAdapterSchema,
  SeoPassReportSchema,
  type SeoPassCheckId,
  type SeoPassCheckResult,
  type SeoPassGeoPassAdapter,
  type SeoPassReport,
} from "./schema.js";

export type SeoPassVerdictCheck = {
  id: SeoPassCheckId;
  label: string;
  purpose: string;
  evidenceKinds: string[];
  sharedGeoPassCheckIds: string[];
};

export type SeoPassVerdictPack = {
  targetUrl: string;
  mode: "plan-only";
  scannerSource: SeoPassGeoPassAdapter;
  checks: SeoPassVerdictCheck[];
  disallowedActions: string[];
};

export const DEFAULT_SEOPASS_VERDICT_CHECKS: SeoPassVerdictCheck[] = [
  {
    id: "indexability",
    label: "Indexability",
    purpose:
      "Plan public robots, sitemap, and noindex checks before any search readiness verdict.",
    evidenceKinds: ["robots-txt", "sitemap", "manual-note"],
    sharedGeoPassCheckIds: ["ai-bot-crawlability", "common-crawl-presence"],
  },
  {
    id: "metadata",
    label: "Metadata",
    purpose:
      "Plan title, description, Open Graph, and search snippet checks from public HTML.",
    evidenceKinds: ["html-head"],
    sharedGeoPassCheckIds: ["brand-mention-readiness"],
  },
  {
    id: "canonical-signals",
    label: "Canonical signals",
    purpose:
      "Plan canonical URL, redirects, and alternate URL consistency checks.",
    evidenceKinds: ["canonical", "html-head"],
    sharedGeoPassCheckIds: [],
  },
  {
    id: "structured-data",
    label: "Structured data",
    purpose:
      "Plan schema.org presence checks that can also feed citation-grade AI answers.",
    evidenceKinds: ["structured-data"],
    sharedGeoPassCheckIds: ["schema-org-citation-grade"],
  },
  {
    id: "internal-links",
    label: "Internal links",
    purpose:
      "Plan basic public link graph checks without crawling private routes or forms.",
    evidenceKinds: ["internal-link"],
    sharedGeoPassCheckIds: [],
  },
  {
    id: "core-web-vitals",
    label: "Core Web Vitals placeholder",
    purpose:
      "Reserve the Lighthouse and field-data slot without executing a live crawler in this chip.",
    evidenceKinds: ["lighthouse", "manual-note"],
    sharedGeoPassCheckIds: ["aggregate-ai-engine-readiness"],
  },
];

const DISALLOWED_ACTIONS = [
  "live crawler execution",
  "paid search API calls",
  "credential access",
  "production database writes",
  "ranking guarantees",
];

function defaultScannerSource(targetUrl: string): SeoPassGeoPassAdapter {
  return {
    source: "geopass",
    target_url: targetUrl,
    mode: "plan-only",
    shared_check_ids: [
      "ai-bot-crawlability",
      "schema-org-citation-grade",
      "brand-mention-readiness",
      "common-crawl-presence",
      "aggregate-ai-engine-readiness",
    ],
  };
}

export function createSeoPassVerdictPack(input: {
  targetUrl: string;
  checks?: SeoPassCheckId[];
  scannerSource?: SeoPassGeoPassAdapter;
}): SeoPassVerdictPack {
  const targetUrl = new URL(input.targetUrl).toString();
  const selectedChecks = new Set(
    (input.checks ?? DEFAULT_SEOPASS_VERDICT_CHECKS.map((check) => check.id)).map(
      (check) => SeoPassCheckIdSchema.parse(check),
    ),
  );

  return {
    targetUrl,
    mode: "plan-only",
    scannerSource: SeoPassGeoPassAdapterSchema.parse(
      input.scannerSource ?? defaultScannerSource(targetUrl),
    ),
    checks: DEFAULT_SEOPASS_VERDICT_CHECKS.filter((check) =>
      selectedChecks.has(check.id),
    ),
    disallowedActions: DISALLOWED_ACTIONS,
  };
}

export function createPlanOnlySeoPassReport(input: {
  targetUrl: string;
  generatedAt?: string;
  checks?: SeoPassCheckId[];
  scannerSource?: SeoPassGeoPassAdapter;
  notes?: string[];
}): SeoPassReport {
  const verdictPack = createSeoPassVerdictPack(input);
  const checkResults: SeoPassCheckResult[] = verdictPack.checks.map((check) => ({
    check_id: check.id,
    label: check.label,
    score: 0,
    verdict: "unknown",
    findings: [],
    comments: [
      "Plan-only placeholder: execute read-only evidence collection in a later chip.",
    ],
  }));

  return SeoPassReportSchema.parse({
    target_url: verdictPack.targetUrl,
    generated_at: input.generatedAt ?? new Date(0).toISOString(),
    mode: "plan-only",
    search_engine_readiness_score: 0,
    verdict: "unknown",
    checks: checkResults,
    scanner_source: {
      kind: "geopass-plan",
      mode: verdictPack.scannerSource.mode ?? "plan-only",
      target_url: verdictPack.scannerSource.target_url,
      shared_check_ids: verdictPack.scannerSource.shared_check_ids,
    },
    notes: input.notes ?? [
      "SEOPass verdict-pack consumes the shared GEOPass scanner contract through this adapter seam.",
    ],
  });
}

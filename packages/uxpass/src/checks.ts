/**
 * Deterministic check catalogue for the uxpass-core profile.
 *
 * Each check inspects the captured CheckContext (one HTTP fetch of the
 * target URL plus an optional /llms.txt fetch) and returns a Verdict plus
 * evidence. No browser, no LLM, no DOM library; all checks operate on the
 * raw HTML body, headers, and timings. This keeps the runner edge-friendly
 * and bounded at roughly 1 to 2 seconds per run.
 *
 * Heavier capture (Playwright, viewport sweeps, axe-core) and LLM hats land
 * in later chunks. The check ids are namespaced by hat so future LLM-backed
 * hats can extend the same hat without renumbering.
 */

import type { RuntimeFinding, Verdict } from "./types.js";

type FindingSeverity = RuntimeFinding["severity"];

export interface CheckContext {
  url: string;
  status: number;
  headers: Record<string, string>;
  responseTimeMs: number;
  bodyText: string;
  bodySize: number;
  llmsTxtStatus: number | null;
}

export interface CheckResult {
  verdict: Verdict;
  evidence?: Record<string, unknown>;
}

export interface CheckSpec {
  id: string;
  hat: string;
  category: string;
  severity: FindingSeverity;
  title: string;
  remediation: string;
  evaluate: (ctx: CheckContext) => CheckResult;
}

const lower = (s: string): string => s.toLowerCase();

function hasTag(body: string, tagPattern: RegExp): boolean {
  return tagPattern.test(body);
}

function countMatches(body: string, pattern: RegExp): number {
  const m = body.match(pattern);
  return m ? m.length : 0;
}

export const CORE_CHECKS: CheckSpec[] = [
  // ── frontend ─────────────────────────────────────────────────────────────
  {
    id: "FE-001",
    hat: "frontend",
    category: "html",
    severity: "high",
    title: "Page returns HTTP 200",
    remediation: "Fix the route or upstream so the URL responds with 200.",
    evaluate: (ctx) => ({
      verdict: ctx.status === 200 ? "pass" : "fail",
      evidence: { status: ctx.status },
    }),
  },
  {
    id: "FE-002",
    hat: "frontend",
    category: "html",
    severity: "high",
    title: "<title> is present and non-empty",
    remediation: "Add a descriptive <title> tag in the document head.",
    evaluate: (ctx) => {
      const m = ctx.bodyText.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = m?.[1]?.trim() ?? "";
      return {
        verdict: title.length > 0 ? "pass" : "fail",
        evidence: { title },
      };
    },
  },
  {
    id: "FE-003",
    hat: "frontend",
    category: "html",
    severity: "medium",
    title: "<meta charset> is declared",
    remediation: "Add <meta charset=\"utf-8\"> as the first child of <head>.",
    evaluate: (ctx) => ({
      verdict: hasTag(ctx.bodyText, /<meta[^>]+charset\s*=/i) ? "pass" : "fail",
    }),
  },
  {
    id: "FE-004",
    hat: "frontend",
    category: "html",
    severity: "medium",
    title: "<meta name=\"description\"> is present",
    remediation: "Add a description meta tag for SEO and link previews.",
    evaluate: (ctx) => ({
      verdict: hasTag(ctx.bodyText, /<meta[^>]+name\s*=\s*["']description["']/i) ? "pass" : "fail",
    }),
  },

  // ── accessibility ────────────────────────────────────────────────────────
  {
    id: "A11Y-001",
    hat: "accessibility",
    category: "a11y",
    severity: "high",
    title: "<html> declares lang attribute",
    remediation: "Add lang=\"en\" (or the appropriate ISO code) to the <html> tag.",
    evaluate: (ctx) => ({
      verdict: hasTag(ctx.bodyText, /<html[^>]+\blang\s*=/i) ? "pass" : "fail",
    }),
  },
  {
    id: "A11Y-002",
    hat: "accessibility",
    category: "a11y",
    severity: "high",
    title: "Page has at least one <h1>",
    remediation: "Add a single <h1> headline summarising the page.",
    evaluate: (ctx) => {
      const count = countMatches(ctx.bodyText, /<h1[\s>]/gi);
      return {
        verdict: count >= 1 ? "pass" : "fail",
        evidence: { h1_count: count },
      };
    },
  },
  {
    id: "A11Y-003",
    hat: "accessibility",
    category: "a11y",
    severity: "medium",
    title: "All <img> tags declare an alt attribute",
    remediation: "Add alt=\"...\" to every <img>; use empty alt=\"\" for decorative images.",
    evaluate: (ctx) => {
      const imgs = ctx.bodyText.match(/<img\b[^>]*>/gi) ?? [];
      const missing = imgs.filter((tag) => !/\balt\s*=/i.test(tag));
      return {
        verdict: imgs.length === 0 || missing.length === 0 ? "pass" : "fail",
        evidence: { img_count: imgs.length, missing_alt: missing.length },
      };
    },
  },

  // ── mobile ───────────────────────────────────────────────────────────────
  {
    id: "MOB-001",
    hat: "mobile",
    category: "mobile",
    severity: "high",
    title: "<meta name=\"viewport\"> is declared",
    remediation: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">.",
    evaluate: (ctx) => ({
      verdict: hasTag(ctx.bodyText, /<meta[^>]+name\s*=\s*["']viewport["']/i) ? "pass" : "fail",
    }),
  },

  // ── agent-readability ────────────────────────────────────────────────────
  {
    id: "AR-001",
    hat: "agent-readability",
    category: "agent",
    severity: "medium",
    title: "/llms.txt is reachable",
    remediation: "Publish an llms.txt file at the site root describing the product for LLM agents.",
    evaluate: (ctx) => ({
      verdict: ctx.llmsTxtStatus === 200 ? "pass" : "fail",
      evidence: { llms_txt_status: ctx.llmsTxtStatus },
    }),
  },
  {
    id: "AR-002",
    hat: "agent-readability",
    category: "agent",
    severity: "medium",
    title: "Page exposes JSON-LD structured data",
    remediation: "Add a <script type=\"application/ld+json\"> block describing the page (Schema.org).",
    evaluate: (ctx) => ({
      verdict: hasTag(ctx.bodyText, /<script[^>]+type\s*=\s*["']application\/ld\+json["']/i)
        ? "pass"
        : "fail",
    }),
  },
  {
    id: "AR-003",
    hat: "agent-readability",
    category: "agent",
    severity: "low",
    title: "Page uses semantic landmark elements",
    remediation: "Wrap content in <main>, <header>, <nav>, or <footer> instead of generic <div>s.",
    evaluate: (ctx) => {
      const landmarks = ["<main", "<header", "<nav", "<footer", "<article", "<section"];
      const present = landmarks.filter((l) => lower(ctx.bodyText).includes(l));
      return {
        verdict: present.length >= 2 ? "pass" : "fail",
        evidence: { landmarks_present: present },
      };
    },
  },

  // ── performance ──────────────────────────────────────────────────────────
  {
    id: "PERF-001",
    hat: "performance",
    category: "perf",
    severity: "high",
    title: "Page responds in under 2000 ms",
    remediation: "Optimise server response time; cache the HTML or move heavy work off the request path.",
    evaluate: (ctx) => ({
      verdict: ctx.responseTimeMs < 2000 ? "pass" : "fail",
      evidence: { response_time_ms: ctx.responseTimeMs },
    }),
  },
  {
    id: "PERF-002",
    hat: "performance",
    category: "perf",
    severity: "medium",
    title: "HTML payload is under 500 KB",
    remediation: "Trim inline content, lazy-load below-the-fold sections, or move data into separate fetches.",
    evaluate: (ctx) => ({
      verdict: ctx.bodySize < 500_000 ? "pass" : "fail",
      evidence: { body_size_bytes: ctx.bodySize },
    }),
  },

  // ── privacy-trust ────────────────────────────────────────────────────────
  {
    id: "PT-001",
    hat: "privacy-trust",
    category: "security",
    severity: "high",
    title: "Site is served over HTTPS",
    remediation: "Force HTTPS at the edge and redirect HTTP to HTTPS.",
    evaluate: (ctx) => ({
      verdict: ctx.url.startsWith("https://") ? "pass" : "fail",
    }),
  },
  {
    id: "PT-002",
    hat: "privacy-trust",
    category: "security",
    severity: "medium",
    title: "Strict-Transport-Security header is set",
    remediation: "Set Strict-Transport-Security with max-age >= 6 months and includeSubDomains.",
    evaluate: (ctx) => {
      const hsts = ctx.headers["strict-transport-security"];
      return {
        verdict: hsts ? "pass" : "fail",
        evidence: hsts ? { hsts } : undefined,
      };
    },
  },

  // ── visual-designer ──────────────────────────────────────────────────────
  {
    id: "VD-001",
    hat: "visual-designer",
    category: "visual",
    severity: "low",
    title: "Page declares a favicon",
    remediation: "Add <link rel=\"icon\" href=\"/favicon.ico\"> (or an SVG) in the document head.",
    evaluate: (ctx) => ({
      verdict: hasTag(ctx.bodyText, /<link[^>]+rel\s*=\s*["'][^"']*icon[^"']*["']/i)
        ? "pass"
        : "fail",
    }),
  },
];

// Severity weights for the UX score. Higher severity dominates the score so
// a critical fail drags the headline more than a low fail. Weights follow the
// same shape that Lighthouse uses for category aggregation.
export const SEVERITY_WEIGHT: Record<FindingSeverity, number> = {
  critical: 5,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

export function evaluateAllChecks(ctx: CheckContext): RuntimeFinding[] {
  return CORE_CHECKS.map((spec) => {
    const start = Date.now();
    let result: CheckResult;
    try {
      result = spec.evaluate(ctx);
    } catch (err) {
      result = {
        verdict: "na",
        evidence: { error: (err as Error).message },
      };
    }
    return {
      check_id: spec.id,
      hat: spec.hat,
      category: spec.category,
      severity: spec.severity,
      title: spec.title,
      verdict: result.verdict,
      evidence: result.evidence,
      remediation: spec.remediation,
      time_ms: Date.now() - start,
    };
  });
}

export function computeUxScore(findings: RuntimeFinding[]): number {
  let totalWeight = 0;
  let earnedWeight = 0;
  for (const f of findings) {
    if (f.verdict === "na" || f.verdict === "pending") continue;
    const w = SEVERITY_WEIGHT[f.severity] ?? 1;
    totalWeight += w;
    if (f.verdict === "pass") earnedWeight += w;
  }
  if (totalWeight === 0) return 0;
  return Math.round((earnedWeight / totalWeight) * 100 * 100) / 100;
}

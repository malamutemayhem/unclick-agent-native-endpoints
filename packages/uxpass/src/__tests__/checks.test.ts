import { describe, it, expect } from "vitest";
import {
  CORE_CHECKS,
  evaluateAllChecks,
  computeUxScore,
  type CheckContext,
} from "../checks.js";

const goodHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Hello</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="A great page">
<link rel="icon" href="/favicon.svg">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"Hello"}</script>
</head>
<body>
<header><h1>Hello</h1></header>
<nav></nav>
<main>
<img src="/a.png" alt="a">
<img src="/b.png" alt="">
</main>
<footer></footer>
</body>
</html>`;

const badHtml = `<!doctype html>
<html>
<body>
<div>Hello</div>
<img src="/a.png">
</body>
</html>`;

const baseCtx = (overrides: Partial<CheckContext> = {}): CheckContext => ({
  url: "https://example.com",
  status: 200,
  headers: { "strict-transport-security": "max-age=63072000; includeSubDomains; preload" },
  responseTimeMs: 200,
  bodyText: goodHtml,
  bodySize: goodHtml.length,
  llmsTxtStatus: 200,
  ...overrides,
});

describe("CORE_CHECKS", () => {
  it("has unique check ids", () => {
    const ids = CORE_CHECKS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers at least seven hats", () => {
    const hats = new Set(CORE_CHECKS.map((c) => c.hat));
    expect(hats.size).toBeGreaterThanOrEqual(7);
  });
});

describe("evaluateAllChecks - happy path", () => {
  it("passes every deterministic check on a well-formed page", () => {
    const findings = evaluateAllChecks(baseCtx());
    const failing = findings.filter((f) => f.verdict === "fail");
    expect(failing).toEqual([]);
    expect(findings).toHaveLength(CORE_CHECKS.length);
  });

  it("attaches non-empty remediation to every check", () => {
    const findings = evaluateAllChecks(baseCtx());
    for (const f of findings) {
      expect(typeof f.remediation).toBe("string");
      expect((f.remediation ?? "").length).toBeGreaterThan(0);
    }
  });

  it("yields a perfect UX Score for an all-pass run", () => {
    const findings = evaluateAllChecks(baseCtx());
    expect(computeUxScore(findings)).toBe(100);
  });
});

describe("evaluateAllChecks - failure paths", () => {
  it("flags a missing lang attribute", () => {
    const findings = evaluateAllChecks(baseCtx({ bodyText: badHtml, bodySize: badHtml.length }));
    const a11y001 = findings.find((f) => f.check_id === "A11Y-001");
    expect(a11y001?.verdict).toBe("fail");
  });

  it("flags missing alt attributes on <img>", () => {
    const findings = evaluateAllChecks(baseCtx({ bodyText: badHtml, bodySize: badHtml.length }));
    const a11y003 = findings.find((f) => f.check_id === "A11Y-003");
    expect(a11y003?.verdict).toBe("fail");
    expect(a11y003?.evidence).toMatchObject({ img_count: 1, missing_alt: 1 });
  });

  it("flags a missing title", () => {
    const findings = evaluateAllChecks(baseCtx({ bodyText: badHtml, bodySize: badHtml.length }));
    const fe002 = findings.find((f) => f.check_id === "FE-002");
    expect(fe002?.verdict).toBe("fail");
  });

  it("flags HTTP status non-200", () => {
    const findings = evaluateAllChecks(baseCtx({ status: 500 }));
    const fe001 = findings.find((f) => f.check_id === "FE-001");
    expect(fe001?.verdict).toBe("fail");
    expect(fe001?.evidence).toMatchObject({ status: 500 });
  });

  it("flags slow responses", () => {
    const findings = evaluateAllChecks(baseCtx({ responseTimeMs: 5000 }));
    const perf001 = findings.find((f) => f.check_id === "PERF-001");
    expect(perf001?.verdict).toBe("fail");
  });

  it("flags missing HSTS header", () => {
    const findings = evaluateAllChecks(baseCtx({ headers: {} }));
    const pt002 = findings.find((f) => f.check_id === "PT-002");
    expect(pt002?.verdict).toBe("fail");
  });

  it("flags non-HTTPS URLs", () => {
    const findings = evaluateAllChecks(baseCtx({ url: "http://example.com" }));
    const pt001 = findings.find((f) => f.check_id === "PT-001");
    expect(pt001?.verdict).toBe("fail");
  });

  it("flags missing /llms.txt", () => {
    const findings = evaluateAllChecks(baseCtx({ llmsTxtStatus: 404 }));
    const ar001 = findings.find((f) => f.check_id === "AR-001");
    expect(ar001?.verdict).toBe("fail");
  });
});

describe("computeUxScore", () => {
  it("returns 0 when every check fails", () => {
    const findings = evaluateAllChecks(
      baseCtx({
        bodyText: badHtml,
        bodySize: 600_000,
        headers: {},
        status: 500,
        responseTimeMs: 5000,
        url: "http://example.com",
        llmsTxtStatus: 404,
      }),
    );
    expect(computeUxScore(findings)).toBe(0);
  });

  it("weights critical fails heavier than low fails", () => {
    const baseFindings = evaluateAllChecks(baseCtx());
    const oneCriticalFail = baseFindings.map((f, i) =>
      i === 0 ? { ...f, severity: "critical" as const, verdict: "fail" as const } : f,
    );
    const oneLowFail = baseFindings.map((f, i) =>
      i === 0 ? { ...f, severity: "low" as const, verdict: "fail" as const } : f,
    );
    expect(computeUxScore(oneCriticalFail)).toBeLessThan(computeUxScore(oneLowFail));
  });

  it("ignores na verdicts", () => {
    const baseFindings = evaluateAllChecks(baseCtx());
    const someNa = baseFindings.map((f, i) =>
      i < 3 ? { ...f, verdict: "na" as const } : f,
    );
    expect(computeUxScore(someNa)).toBe(100);
  });
});

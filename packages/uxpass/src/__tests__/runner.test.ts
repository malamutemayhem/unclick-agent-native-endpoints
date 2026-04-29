import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { captureContext, evaluateUrl, summariseStats } from "../runner.js";

interface MockServer {
  url: string;
  llmsTxtUrl: string;
  close: () => void;
}

function makeMockServer(html: string, opts: { llmsTxt?: string } = {}): Promise<MockServer> {
  return new Promise((resolve) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.url === "/llms.txt") {
        if (opts.llmsTxt !== undefined) {
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end(opts.llmsTxt);
        } else {
          res.writeHead(404).end();
        }
        return;
      }
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
      });
      res.end(html);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      const url = `http://127.0.0.1:${addr.port}`;
      resolve({
        url,
        llmsTxtUrl: `${url}/llms.txt`,
        close: () => server.close(),
      });
    });
  });
}

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
</main>
<footer></footer>
</body>
</html>`;

describe("captureContext", () => {
  let server: MockServer;
  beforeAll(async () => {
    server = await makeMockServer(goodHtml, { llmsTxt: "# Site\nHello" });
  });
  afterAll(() => server.close());

  it("captures status, body, headers, timing", async () => {
    const ctx = await captureContext(server.url);
    expect(ctx.status).toBe(200);
    expect(ctx.bodyText).toContain("<title>Hello</title>");
    expect(ctx.bodySize).toBeGreaterThan(0);
    expect(ctx.responseTimeMs).toBeGreaterThanOrEqual(0);
    expect(ctx.headers["strict-transport-security"]).toBeDefined();
  });

  it("probes /llms.txt and records the status", async () => {
    const ctx = await captureContext(server.url);
    expect(ctx.llmsTxtStatus).toBe(200);
  });
});

describe("evaluateUrl - integration with live HTTP server", () => {
  it("gives a high UX Score on a well-formed page", async () => {
    const server = await makeMockServer(goodHtml, { llmsTxt: "# llms.txt" });
    try {
      const result = await evaluateUrl(server.url);
      // PT-001 (HTTPS) fails because the mock server is on http://, so the
      // score is high but not perfect. Everything else passes.
      const failingIds = result.evaluations.filter((e) => e.verdict === "fail").map((e) => e.check_id);
      expect(failingIds).toEqual(["PT-001"]);
      expect(result.uxScore).toBeGreaterThanOrEqual(85);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].hat_id).toBe("privacy-trust");
    } finally {
      server.close();
    }
  });

  it("flags missing /llms.txt as a finding", async () => {
    const server = await makeMockServer(goodHtml);
    try {
      const result = await evaluateUrl(server.url);
      const ar001 = result.findings.find((f) => f.title.startsWith("AR-001:"));
      expect(ar001).toBeDefined();
      expect(ar001?.severity).toBe("medium");
    } finally {
      server.close();
    }
  });

  it("populates the breakdown with checks_run and by_hat counts", async () => {
    const server = await makeMockServer(goodHtml, { llmsTxt: "# llms.txt" });
    try {
      const result = await evaluateUrl(server.url);
      expect(result.breakdown.checks_run.length).toBeGreaterThan(10);
      expect(result.breakdown.by_hat["accessibility"]).toEqual({ pass: 3, fail: 0, na: 0 });
      // PT-001 fails on http://; PT-002 passes (HSTS present).
      expect(result.breakdown.by_hat["privacy-trust"]).toEqual({ pass: 1, fail: 1, na: 0 });
      expect(result.breakdown.critics).toHaveLength(18);
      expect(result.breakdown.critics?.find((critic) => critic.id === "agent-readability")).toMatchObject({
        status: "ran",
        mode: "deterministic",
        pass: 3,
      });
      expect(result.breakdown.critics?.find((critic) => critic.id === "dark-pattern-detector")).toMatchObject({
        status: "queued",
        mode: "llm",
      });
    } finally {
      server.close();
    }
  });
});

describe("summariseStats", () => {
  it("counts verdicts and computes pass_rate", () => {
    const evaluations = [
      { check_id: "x", hat: "h", category: "c", severity: "low" as const, title: "t", verdict: "pass" as const },
      { check_id: "y", hat: "h", category: "c", severity: "low" as const, title: "t", verdict: "pass" as const },
      { check_id: "z", hat: "h", category: "c", severity: "low" as const, title: "t", verdict: "fail" as const },
      { check_id: "w", hat: "h", category: "c", severity: "low" as const, title: "t", verdict: "na" as const },
    ];
    const s = summariseStats(evaluations);
    expect(s.total).toBe(4);
    expect(s.pass).toBe(2);
    expect(s.fail).toBe(1);
    expect(s.na).toBe(1);
    expect(s.pass_rate).toBeCloseTo(2 / 3, 5);
  });
});

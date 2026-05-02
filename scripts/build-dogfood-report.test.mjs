import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("dogfood receipt marks SecurityPass as blocked with a reason", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dogfood-report-"));
  const output = path.join(dir, "latest.json");

  try {
    await execFileAsync(process.execPath, [
      "scripts/build-dogfood-report.mjs",
      "--dry-run",
      "--output",
      output,
    ]);

    const report = JSON.parse(await fs.readFile(output, "utf8"));
    const securitypass = report.results.find((result) => result.id === "securitypass");
    const enterprisepass = report.results.find((result) => result.id === "enterprisepass");

    assert.equal(securitypass?.status, "blocked");
    assert.match(securitypass?.blockedReason ?? "", /scope-gated/i);
    assert.equal(securitypass?.reasonCode, "scope_gate");
    assert.match(securitypass?.nextProof ?? "", /safe recurring SecurityPass runner receipt/i);
    assert.equal(enterprisepass?.status, "pending");
    assert.equal(enterprisepass?.reasonCode, "planned_runner");
    assert.match(enterprisepass?.nextProof ?? "", /automated evidence checks/i);
    assert.deepEqual(enterprisepass?.proof, {
      kind: "planned",
      targetUrl: "/enterprise/latest.json",
    });
    assert.equal(report.status, "blocked");
    assert.match(report.statusLegend.blocked, /action is needed/i);
    assert.match(report.statusLegend.pending, /live proof is not available yet/i);
    assert.match(report.proofPolicy, /passing only when a live check actually ran/i);
    assert.match(report.lastActionableFailure.detail, /Blocked reason:/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("dogfood receipt includes structured proof for live TestPass and UXPass runs", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dogfood-report-"));
  const output = path.join(dir, "latest.json");
  const requests = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const bodyText = Buffer.concat(chunks).toString("utf8");
    const body = bodyText ? JSON.parse(bodyText) : {};
    requests.push({ url: req.url, body });

    res.setHeader("Content-Type", "application/json");
    if (req.url === "/api/testpass-run") {
      res.end(JSON.stringify({
        run_id: "testpass-run-123",
        status: "complete",
        verdict_summary: { total: 12, fail: 0 },
      }));
      return;
    }
    if (req.url === "/api/uxpass-run") {
      res.end(JSON.stringify({
        run_id: "uxpass-run-456",
        status: "complete",
        ux_score: 91,
      }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not found" }));
  });

  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address === "object");

    await execFileAsync(process.execPath, [
      "scripts/build-dogfood-report.mjs",
      "--output",
      output,
    ], {
      env: {
        ...process.env,
        DOGFOOD_API_BASE: `http://127.0.0.1:${address.port}`,
        DOGFOOD_PUBLIC_URL: "https://unclick.world",
        DOGFOOD_MCP_URL: "https://unclick.world/api/mcp",
        DOGFOOD_TESTPASS_TOKEN: "test-token",
        DOGFOOD_UXPASS_TOKEN: "ux-token",
      },
    });

    const report = JSON.parse(await fs.readFile(output, "utf8"));
    const testpass = report.results.find((result) => result.id === "testpass");
    const uxpass = report.results.find((result) => result.id === "uxpass");
    const testpassRequest = requests.find((request) => request.url === "/api/testpass-run");
    const uxpassRequest = requests.find((request) => request.url === "/api/uxpass-run");

    assert.match(report.statusLegend.passing, /live check ran/i);
    assert.match(report.proofPolicy, /Blocked and pending are honest product states/i);

    assert.equal(testpassRequest.body.source, "scheduled");
    assert.equal(testpass.runId, "testpass-run-123");
    assert.equal(testpass.targetUrl, "https://unclick.world/api/mcp");
    assert.deepEqual(testpass.proof, {
      kind: "testpass_run",
      runId: "testpass-run-123",
      targetUrl: "https://unclick.world/api/mcp",
    });

    assert.equal(uxpassRequest.body.source, "scheduled");
    assert.equal(uxpass.runId, "uxpass-run-456");
    assert.equal(uxpass.targetUrl, "https://unclick.world");
    assert.deepEqual(uxpass.proof, {
      kind: "uxpass_run",
      runId: "uxpass-run-456",
      targetUrl: "https://unclick.world",
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("dogfood receipt uses structured missing-credential proof for blocked UXPass", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dogfood-report-"));
  const output = path.join(dir, "latest.json");

  try {
    await execFileAsync(process.execPath, [
      "scripts/build-dogfood-report.mjs",
      "--output",
      output,
    ], {
      env: {
        ...process.env,
        TESTPASS_TOKEN: "",
        DOGFOOD_TESTPASS_TOKEN: "",
        UXPASS_TOKEN: "",
        DOGFOOD_UXPASS_TOKEN: "",
        CRON_SECRET: "",
      },
    });

    const report = JSON.parse(await fs.readFile(output, "utf8"));
    const uxpass = report.results.find((result) => result.id === "uxpass");

    assert.equal(uxpass?.status, "blocked");
    assert.equal(uxpass?.reasonCode, "missing_credential");
    assert.match(uxpass?.nextProof ?? "", /rerun the dogfood report workflow/i);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

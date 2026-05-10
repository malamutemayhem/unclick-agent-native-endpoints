import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";

import {
  resolveSweepTargets,
  resolveSweepViewports,
  runUxPassSiteSweep,
  splitAllowedSweepTargets,
} from "./uxpass-site-sweep.mjs";

const execFileAsync = promisify(execFile);

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

test("resolves default site sweep targets from the public URL", () => {
  assert.deepEqual(resolveSweepTargets({ publicUrl: "https://unclick.world/" }), [
    "https://unclick.world/",
    "https://unclick.world/dashboard",
    "https://unclick.world/admin/you",
  ]);
});

test("resolves desktop and mobile viewport evidence targets", () => {
  assert.deepEqual(resolveSweepViewports(["desktop:1440x1000", "mobile:390x844"]), [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "mobile", width: 390, height: 844 },
  ]);
});

test("returns a blocked receipt when no token is available", async () => {
  const receipt = await runUxPassSiteSweep({
    publicUrl: "https://unclick.world",
    urls: ["/", "/dashboard"],
    token: "",
    targetSha: "abc123",
    now: "2026-05-05T00:00:00.000Z",
  });

  assert.equal(receipt.status, "blocked");
  assert.equal(receipt.target_sha, "abc123");
  assert.equal(receipt.targets.length, 2);
  assert.equal(receipt.action_needed.length, 2);
  assert.match(receipt.summary, /no token/i);
  assert.equal(receipt.xpass_gate_result.status, "blocked");
  assert.equal(receipt.targets[0].proof.kind, "safe_fallback_receipt");
  assert.equal(receipt.targets[0].evidence.viewports.length, 2);
  assert.equal(receipt.targets[0].evidence.viewports[0].capture_status, "skipped_missing_credential");
});

test("runs every target through the UXPass API and writes scoped proof", async () => {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    requests.push({ url: req.url, body });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      run_id: `run-${requests.length}`,
      status: "complete",
      ux_score: requests.length === 1 ? 91 : 88,
    }));
  });

  try {
    await listen(server);
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const receipt = await runUxPassSiteSweep({
      apiBase: `http://127.0.0.1:${address.port}`,
      publicUrl: "https://unclick.world",
      urls: ["/", "/admin/you"],
      token: "ux-token",
      targetSha: "head-sha",
      now: "2026-05-05T00:00:00.000Z",
      allowedOrigins: ["https://unclick.world", `http://127.0.0.1:${address.port}`],
    });

    assert.equal(receipt.status, "passing");
    assert.equal(requests.length, 2);
    assert.equal(requests[0].url, "/api/uxpass-run");
    assert.equal(requests[0].body.source, "site_sweep");
    assert.equal(requests[0].body.target_sha, "head-sha");
    assert.equal(requests[1].body.target_url, "https://unclick.world/admin/you");
    assert.deepEqual(receipt.targets[0].proof, {
      kind: "uxpass_run",
      runId: "run-1",
      targetUrl: "https://unclick.world/",
      target_sha: "head-sha",
    });
    assert.equal(receipt.xpass_gate_result.status, "passed");
    assert.equal(receipt.targets[0].route_target.path, "/");
    assert.equal(receipt.targets[0].evidence.viewports.length, 2);
  } finally {
    await close(server);
  }
});

test("splits owned URLs from off-origin site sweep targets", () => {
  const targets = [
    "https://unclick.world/",
    "https://unclick.world/dashboard",
    "https://example.com/steal-proof",
  ];

  const result = splitAllowedSweepTargets(targets, ["https://unclick.world"]);

  assert.deepEqual(result.allowed, [
    "https://unclick.world/",
    "https://unclick.world/dashboard",
  ]);
  assert.equal(result.blocked.length, 1);
  assert.equal(result.blocked[0].url, "https://example.com/steal-proof");
  assert.equal(result.blocked[0].status, "blocked");
  assert.match(result.blocked[0].summary, /owned-origin allowlist/i);
});

test("does not call the UXPass API for off-origin site sweep targets", async () => {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    requests.push({ url: req.url, body });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      run_id: `run-${requests.length}`,
      status: "complete",
      ux_score: 94,
    }));
  });

  try {
    await listen(server);
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const receipt = await runUxPassSiteSweep({
      apiBase: `http://127.0.0.1:${address.port}`,
      publicUrl: "https://unclick.world",
      urls: ["/", "https://example.com/off-origin"],
      token: "ux-token",
      allowedOrigins: ["https://unclick.world", `http://127.0.0.1:${address.port}`],
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].body.target_url, "https://unclick.world/");
    assert.equal(receipt.status, "blocked");
    assert.equal(receipt.targets.length, 2);
    assert.equal(receipt.targets[0].url, "https://example.com/off-origin");
    assert.equal(receipt.targets[0].status, "blocked");
  } finally {
    await close(server);
  }
});

test("blocks live sweeps when the API origin is outside the allowlist", async () => {
  const receipt = await runUxPassSiteSweep({
    apiBase: "https://evil.example",
    publicUrl: "https://unclick.world",
    urls: ["/"],
    token: "ux-token",
    allowedOrigins: ["https://unclick.world"],
  });

  assert.equal(receipt.status, "blocked");
  assert.match(receipt.summary, /API origin is not allowed/i);
  assert.equal(receipt.targets[0].status, "blocked");
});

test("blocks without a token warning when every target is off-origin", async () => {
  const receipt = await runUxPassSiteSweep({
    apiBase: "https://unclick.world",
    publicUrl: "https://unclick.world",
    urls: ["https://example.com/off-origin"],
    token: "",
    allowedOrigins: ["https://unclick.world"],
  });

  assert.equal(receipt.status, "blocked");
  assert.match(receipt.summary, /every target was outside/i);
  assert.equal(receipt.targets[0].status, "blocked");
  assert.match(receipt.action_needed[0], /owned-origin allowlist/i);
});

test("fails the sweep when a target is below the UX score floor", async () => {
  const server = http.createServer((_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      run_id: "run-low",
      status: "complete",
      ux_score: 72,
    }));
  });

  try {
    await listen(server);
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const receipt = await runUxPassSiteSweep({
      apiBase: `http://127.0.0.1:${address.port}`,
      publicUrl: "https://unclick.world",
      urls: ["/"],
      token: "ux-token",
      minScore: 80,
      allowedOrigins: ["https://unclick.world", `http://127.0.0.1:${address.port}`],
    });

    assert.equal(receipt.status, "failing");
    assert.equal(receipt.action_needed.length, 1);
    assert.match(receipt.action_needed[0], /score 72/);
  } finally {
    await close(server);
  }
});

test("fails the sweep when UXPass reports console or layout issues", async () => {
  const server = http.createServer((_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      run_id: "run-issues",
      status: "complete",
      ux_score: 95,
      console_issues: [{ severity: "error", message: "Hydration mismatch", viewport: "desktop" }],
      layout_issues: [{ type: "overflow", message: "Mobile header overflows", viewport: "mobile" }],
    }));
  });

  try {
    await listen(server);
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const receipt = await runUxPassSiteSweep({
      apiBase: `http://127.0.0.1:${address.port}`,
      publicUrl: "https://unclick.world",
      urls: ["/"],
      token: "ux-token",
      allowedOrigins: ["https://unclick.world", `http://127.0.0.1:${address.port}`],
    });

    assert.equal(receipt.status, "failing");
    assert.equal(receipt.xpass_gate_result.status, "failed");
    assert.match(receipt.targets[0].summary, /console issue/i);
    assert.equal(receipt.targets[0].evidence.console_issues.length, 1);
    assert.equal(receipt.targets[0].evidence.layout_issues.length, 1);
    assert.equal(receipt.targets[0].evidence.viewports[0].console_issues.length, 1);
    assert.equal(receipt.targets[0].evidence.viewports[1].layout_issues.length, 1);
  } finally {
    await close(server);
  }
});

test("CLI dry-run writes the sweep receipt to disk", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "uxpass-site-sweep-"));
  const output = path.join(dir, "receipt.json");

  try {
    await execFileAsync(process.execPath, [
      "scripts/uxpass-site-sweep.mjs",
      "--dry-run",
      "--output",
      output,
      "--target-sha",
      "dry-sha",
      "--url",
      "/",
    ]);

    const receipt = JSON.parse(await fs.readFile(output, "utf8"));
    assert.equal(receipt.status, "passing");
    assert.equal(receipt.target_sha, "dry-sha");
    assert.equal(receipt.targets.length, 1);
    assert.equal(receipt.xpass_gate_result.status, "passed");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("CLI can write a blocked receipt without failing the dogfood workflow", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "uxpass-site-sweep-"));
  const output = path.join(dir, "blocked.json");

  try {
    await execFileAsync(process.execPath, [
      "scripts/uxpass-site-sweep.mjs",
      "--allow-non-passing",
      "--output",
      output,
      "--url",
      "/",
    ], {
      env: {
        ...process.env,
        UXPASS_SITE_SWEEP_TOKEN: "",
        DOGFOOD_UXPASS_TOKEN: "",
        UXPASS_TOKEN: "",
        CRON_SECRET: "",
      },
    });

    const receipt = JSON.parse(await fs.readFile(output, "utf8"));
    assert.equal(receipt.status, "blocked");
    assert.match(receipt.summary, /no token/i);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

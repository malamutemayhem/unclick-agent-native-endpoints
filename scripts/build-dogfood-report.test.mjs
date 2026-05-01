import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
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

    assert.equal(securitypass?.status, "blocked");
    assert.match(securitypass?.blockedReason ?? "", /scope-gated/i);
    assert.equal(report.status, "blocked");
    assert.match(report.lastActionableFailure.detail, /Blocked reason:/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

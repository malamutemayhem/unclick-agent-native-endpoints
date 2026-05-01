import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const docPaths = [
  "AGENTS.md",
  "AUTOPILOT.md",
  "CLAUDE.md",
  "README.md",
  ".github/OPERATIONS.md",
];

test("core docs do not contain em dashes", () => {
  const offenders = [];

  for (const relativePath of docPaths) {
    const absolutePath = path.join(repoRoot, relativePath);
    const content = fs.readFileSync(absolutePath, "utf8");
    if (content.includes("—")) {
      offenders.push(relativePath);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `Found em dashes in: ${offenders.join(", ")}`
  );
});

import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { auditCallSites, detectGuard, isExpected, renderText } from "./audit-ai-call-sites.mjs";

async function withFixture(files, fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), "audit-ai-call-sites-"));
  try {
    for (const [rel, body] of Object.entries(files)) {
      const full = path.join(root, rel);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, body);
    }
    return await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("detectGuard recognizes provider-inventory decision helpers", () => {
  assert.deepEqual(detectGuard("const d = decideAiProviderCall({ path_id: 'x' });"), ["provider-inventory"]);
  assert.deepEqual(detectGuard("export function decideMemoryEmbedProviderCall() {}"), ["provider-decision-helper"]);
  assert.deepEqual(detectGuard("await withSpendGuard({ label: 'openai/chat' }, call);"), ["withSpendGuard"]);
  assert.deepEqual(detectGuard("process.env.MEMORY_OPENAI_EMBEDDINGS_ENABLED === '1'"), ["explicit-env-gate"]);
});

test("provider inventory files are expected metadata, not runtime call sites", () => {
  assert.equal(isExpected("api/lib/ai-provider-inventory.ts"), true);
  assert.equal(isExpected("api/ai-provider-inventory.test.ts"), true);
  assert.equal(isExpected("packages/mcp-server/src/tool-wiring.ts"), true);
  assert.equal(isExpected("src/components/Tools.tsx"), true);
});

test("audit treats provider-inventory guarded fetches as covered", async () => {
  await withFixture({
    "api/guarded.ts": `
      import { decideAiProviderCall } from "./lib/ai-provider-inventory";
      const decision = decideAiProviderCall({ path_id: "memory.api.openai.embed-endpoint", allow_paid: true });
      if (!decision.allowed) throw new Error("blocked");
      await fetch("https://api.openai.com/v1/embeddings");
    `,
    "api/unguarded.ts": `
      await fetch("https://api.anthropic.com/v1/messages");
    `,
    "api/lib/ai-provider-inventory.ts": `
      export const ids = ["https://api.openai.com/v1/models"];
    `,
  }, async (root) => {
    const report = await auditCallSites(root);
    assert.equal(report.summary.files_with_ai_calls, 2);
    assert.equal(report.summary.already_guarded, 1);
    assert.equal(report.summary.need_wrapping, 1);
    assert.equal(report.callSites.find((site) => site.file === "api/guarded.ts")?.guarded, true);
    assert.equal(report.callSites.find((site) => site.file === "api/unguarded.ts")?.guarded, false);
    assert.equal(report.expectedHits.length, 1);
    assert.match(renderText(report), /Call sites needing spend guardrail wrapping \(1\):/);
  });
});

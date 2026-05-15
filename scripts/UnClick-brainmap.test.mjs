import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import process from "node:process";

import { GENERATED_PATH, generateBrainmap } from "./UnClick-brainmap.mjs";

describe("UnClick ecosystem Brainmap", () => {
  it("keeps the generated artifact fresh", async () => {
    const generated = await generateBrainmap({ root: process.cwd() });
    const saved = (await readFile(GENERATED_PATH, "utf8")).replace(/\r\n/g, "\n");
    assert.equal(saved, generated);
  });

  it("contains the load-bearing system sections", async () => {
    const generated = await generateBrainmap({ root: process.cwd() });
    for (const section of [
      "## Source Manifest",
      "## UnClick Structure",
      "## Pages and Meaning",
      "## Tool Families and Meaning",
      "## Public/Internal Alias Table",
      "## Rooms List",
      "## Workers List",
      "## Safety Rules",
      "## Launchpad Route",
      "## Ledger Rules",
      "## CI and Stale Guard",
    ]) {
      assert.match(generated, new RegExp(section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("attaches meaning to pages, tools, workers, and safety lanes", async () => {
    const generated = await generateBrainmap({ root: process.cwd() });
    assert.match(generated, /\| \/admin\/brainmap \| Admin Brainmap \| Generated ecosystem map/);
    assert.match(generated, /\| \/admin\/agents\/heartbeat \| Admin Seat Heartbeat \| Master heartbeat copy policy/);
    assert.match(generated, /\| NudgeOnly \| NudgeOnly low-token receipt bridge/);
    assert.match(generated, /\| IgniteOnly \| IgniteOnly verified worker wake packet bridge/);
    assert.match(generated, /\| Coordinator \| Routes work/);
    assert.match(generated, /Admin-only surfaces use `RequireAdmin`/);
    assert.match(generated, /IgniteOnly can request worker wake packets only/);
  });

  it("records generated Brainmap guardrails for CI", async () => {
    const generated = await generateBrainmap({ root: process.cwd() });
    assert.match(generated, /node scripts\/UnClick-brainmap\.mjs --check/);
    assert.match(generated, /node --test scripts\/UnClick-brainmap\.test\.mjs/);
  });
});

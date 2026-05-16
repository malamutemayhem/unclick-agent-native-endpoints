// scripts/audit-fishbowl-naming.test.mjs

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { classifyLayer, auditNaming, renderText } from "./audit-fishbowl-naming.mjs";

let tmp;
before(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fishbowl-audit-"));
  await fs.mkdir(path.join(tmp, "api", "lib"), { recursive: true });
  await fs.mkdir(path.join(tmp, "src", "components"), { recursive: true });
  await fs.mkdir(path.join(tmp, "docs"), { recursive: true });
  await fs.mkdir(path.join(tmp, "tests"), { recursive: true });

  await fs.writeFile(path.join(tmp, "api", "lib", "fishbowl-channels.ts"), `// uses fishbowl naming\nexport const FISHBOWL = "boardroom"; // compat alias\n`);
  await fs.writeFile(path.join(tmp, "src", "components", "Popcorn.tsx"), `// legacy popcorn component\nexport function PopcornPanel(){return null}\n`);
  await fs.writeFile(path.join(tmp, "docs", "history.md"), `Originally called Fishbowl. Then Popcorn. Now Boardroom.\n`);
  await fs.writeFile(path.join(tmp, "tests", "fishbowl.test.ts"), `it("fishbowl works", ()=>{})\n`);
  await fs.writeFile(path.join(tmp, "src", "clean.ts"), `// no legacy names\n`);
});
after(async () => { if (tmp) await fs.rm(tmp, { recursive: true, force: true }); });

describe("classifyLayer", () => {
  test("api files → 'api'", () => {
    assert.equal(classifyLayer("api/lib/fishbowl.ts"), "api");
  });
  test("src/lib → 'lib'", () => {
    assert.equal(classifyLayer("src/lib/store.ts"), "lib");
  });
  test("src/pages → 'ui'", () => {
    assert.equal(classifyLayer("src/pages/Admin.tsx"), "ui");
  });
  test("src/components → 'ui'", () => {
    assert.equal(classifyLayer("src/components/Popcorn.tsx"), "ui");
  });
  test("scripts/ → 'scripts'", () => {
    assert.equal(classifyLayer("scripts/audit.mjs"), "scripts");
  });
  test("docs/ → 'docs'", () => {
    assert.equal(classifyLayer("docs/foo.md"), "docs");
  });
  test("tests file → 'tests'", () => {
    assert.equal(classifyLayer("api/lib/fishbowl.test.ts"), "tests");
    assert.equal(classifyLayer("tests/fishbowl.test.ts"), "tests");
    assert.equal(classifyLayer("src/lib/x.spec.ts"), "tests");
  });
  test("unrecognised root → 'other'", () => {
    assert.equal(classifyLayer("random/file.ts"), "other");
  });
});

describe("auditNaming end-to-end (real fs fixture)", () => {
  test("finds the four files containing legacy names", async () => {
    const report = await auditNaming(tmp);
    assert.ok(report.matches.length >= 4);
    const files = report.matches.map((m) => m.file).sort();
    assert.ok(files.some((f) => f.endsWith("api/lib/fishbowl-channels.ts")));
    assert.ok(files.some((f) => f.endsWith("src/components/Popcorn.tsx")));
    assert.ok(files.some((f) => f.endsWith("docs/history.md")));
    assert.ok(files.some((f) => f.endsWith("tests/fishbowl.test.ts")));
  });

  test("does NOT include the clean file", async () => {
    const report = await auditNaming(tmp);
    const clean = report.matches.find((m) => m.file.endsWith("src/clean.ts"));
    assert.equal(clean, undefined);
  });

  test("groups by layer", async () => {
    const report = await auditNaming(tmp);
    assert.ok(report.by_layer.api?.length >= 1);
    assert.ok(report.by_layer.ui?.length >= 1);
    assert.ok(report.by_layer.docs?.length >= 1);
    assert.ok(report.by_layer.tests?.length >= 1);
  });

  test("detects co-existence with boardroom", async () => {
    const report = await auditNaming(tmp);
    const fileWithBoardroom = report.matches.find((m) => m.file.endsWith("api/lib/fishbowl-channels.ts"));
    assert.equal(fileWithBoardroom.coexists_with_boardroom, true);
  });

  test("counts fishbowl and popcorn separately", async () => {
    const report = await auditNaming(tmp);
    assert.ok(report.summary.files_with_fishbowl >= 2);
    assert.ok(report.summary.files_with_popcorn >= 1);
  });
});

describe("renderText", () => {
  test("renders clean message when no matches", () => {
    const out = renderText({
      root: "/x",
      filesScanned: 5,
      summary: { files_with_fishbowl: 0, files_with_popcorn: 0, files_with_both_legacy: 0, files_with_legacy_and_boardroom: 0 },
      by_layer: {},
      matches: [],
    });
    assert.match(out, /No legacy Fishbowl\/Popcorn references found/);
  });

  test("renders layered summary when matches present", () => {
    const out = renderText({
      root: "/x",
      filesScanned: 10,
      summary: { files_with_fishbowl: 1, files_with_popcorn: 1, files_with_both_legacy: 0, files_with_legacy_and_boardroom: 1 },
      by_layer: {
        api: [{ file: "api/x.ts", layer: "api", hits: { fishbowl: 2, popcorn: 0, boardroom: 1 }, coexists_with_boardroom: true }],
        ui:  [{ file: "src/y.tsx", layer: "ui",  hits: { fishbowl: 0, popcorn: 3, boardroom: 0 }, coexists_with_boardroom: false }],
      },
      matches: [],
    });
    assert.match(out, /\[api\]/);
    assert.match(out, /fishbowl×2/);
    assert.match(out, /alongside boardroom/);
    assert.match(out, /\[ui\]/);
    assert.match(out, /popcorn×3/);
  });
});

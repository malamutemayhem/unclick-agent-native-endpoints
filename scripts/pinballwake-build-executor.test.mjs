import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  claimCodingRoomJob,
  createCodingRoomJob,
  createCodingRoomJobLedger,
} from "./pinballwake-coding-room.mjs";
import {
  executeCodingRoomBuildJob,
  executeCodingRoomBuildLedgerJob,
  runGitApplyPatch,
  validateCodingRoomBuildPatch,
} from "./pinballwake-build-executor.mjs";

const runner = {
  id: "pinballwake-job-runner",
  readiness: "builder_ready",
  capabilities: ["implementation"],
};

function patchFor(file = "scripts/example.mjs") {
  return `diff --git a/${file} b/${file}
--- a/${file}
+++ b/${file}
@@ -1 +1 @@
-old
+new
`;
}

function buildJob(input = {}) {
  return claimCodingRoomJob({
    runner,
    job: createCodingRoomJob({
      jobId: input.jobId || "coding-room:build:test",
      worker: "pinballwake-job-runner",
      chip: "apply tiny patch",
      files: input.files || ["scripts/example.mjs"],
      build: {
        patch: input.patch || patchFor(),
      },
      expectedProof: {
        requiresPr: false,
        requiresChangedFiles: true,
        requiresNonOverlap: true,
        requiresTests: true,
        tests: ["node --test scripts/example.test.mjs"],
      },
    }),
    now: "2026-05-04T00:00:00.000Z",
  }).job;
}

describe("PinballWake build executor", () => {
  it("accepts small unified diffs that only touch owned files", () => {
    const result = validateCodingRoomBuildPatch({
      patch: patchFor("scripts/example.mjs"),
      ownedFiles: ["scripts/example.mjs"],
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.changed_files, ["scripts/example.mjs"]);
  });

  it("rejects unsafe paths, unowned files, binary patches, and create/delete patches", () => {
    assert.equal(
      validateCodingRoomBuildPatch({
        patch: patchFor("scripts/../evil.mjs"),
        ownedFiles: ["scripts/../evil.mjs"],
      }).reason,
      "unsafe_patch_path",
    );

    assert.equal(
      validateCodingRoomBuildPatch({
        patch: patchFor("api/unowned.ts"),
        ownedFiles: ["scripts/example.mjs"],
      }).reason,
      "patch_file_outside_ownership",
    );

    assert.equal(
      validateCodingRoomBuildPatch({
        patch: "GIT binary patch\nliteral 0\n",
        ownedFiles: ["scripts/example.mjs"],
      }).reason,
      "binary_patch_not_allowed",
    );

    assert.equal(
      validateCodingRoomBuildPatch({
        patch: "diff --git a/scripts/new.mjs b/scripts/new.mjs\n--- /dev/null\n+++ b/scripts/new.mjs\n@@ -0,0 +1 @@\n+new\n",
        ownedFiles: ["scripts/new.mjs"],
      }).reason,
      "create_or_delete_not_allowed",
    );
  });

  it("rejects rename, copy, mode, and symlink metadata before git apply", () => {
    const metadataCases = [
      {
        patch: `diff --git a/scripts/example.mjs b/scripts/renamed.mjs
similarity index 100%
rename from scripts/example.mjs
rename to scripts/renamed.mjs
`,
        label: "rename",
      },
      {
        patch: `diff --git a/scripts/example.mjs b/scripts/copied.mjs
similarity index 100%
copy from scripts/example.mjs
copy to scripts/copied.mjs
`,
        label: "copy",
      },
      {
        patch: `diff --git a/scripts/example.mjs b/scripts/example.mjs
old mode 100644
new mode 100755
`,
        label: "mode",
      },
      {
        patch: `diff --git a/scripts/link.mjs b/scripts/link.mjs
new file mode 120000
--- /dev/null
+++ b/scripts/link.mjs
@@ -0,0 +1 @@
+../outside
`,
        label: "symlink/new mode",
      },
      {
        patch: `diff --git a/scripts/example.mjs b/scripts/example.mjs
deleted file mode 100644
--- a/scripts/example.mjs
+++ /dev/null
@@ -1 +0,0 @@
-old
`,
        label: "deleted mode",
      },
    ];

    for (const item of metadataCases) {
      assert.equal(
        validateCodingRoomBuildPatch({
          patch: item.patch,
          ownedFiles: ["scripts/example.mjs", "scripts/renamed.mjs", "scripts/copied.mjs", "scripts/link.mjs"],
        }).reason,
        "unsafe_patch_metadata",
        item.label,
      );
    }
  });

  it("applies a checked owned-file patch and moves the job to testing", async () => {
    const calls = [];
    const result = await executeCodingRoomBuildJob({
      job: buildJob(),
      now: "2026-05-04T00:01:00.000Z",
      applyPatch: async (_patch, options) => {
        calls.push(options.check ? "check" : "apply");
        return { ok: true, exit_code: 0, output: "" };
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "done");
    assert.deepEqual(calls, ["check", "apply"]);
    assert.equal(result.job.status, "testing");
    assert.deepEqual(result.job.build_result.changed_files, ["scripts/example.mjs"]);
    assert.equal(result.job.proof, null);
  });

  it("checks and applies a real patch without shell expansion", async () => {
    const dir = await mkdtemp(join(tmpdir(), "build-executor-"));
    try {
      execFileSync("git", ["init"], { cwd: dir, stdio: "ignore" });
      await mkdir(join(dir, "scripts"), { recursive: true });
      await writeFile(join(dir, "scripts", "example.mjs"), "old\n", "utf8");

      const patch = patchFor("scripts/example.mjs");
      assert.equal((await runGitApplyPatch(patch, { cwd: dir, check: true })).ok, true);
      assert.equal((await runGitApplyPatch(patch, { cwd: dir, check: false })).ok, true);
      assert.equal((await readFile(join(dir, "scripts", "example.mjs"), "utf8")).replace(/\r\n/g, "\n"), "new\n");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("dry-runs after patch check without applying or mutating the job", async () => {
    const calls = [];
    const job = buildJob();
    const result = await executeCodingRoomBuildJob({
      job,
      dryRun: true,
      applyPatch: async (_patch, options) => {
        calls.push(options.check ? "check" : "apply");
        return { ok: true, exit_code: 0, output: "" };
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "dry_run");
    assert.deepEqual(calls, ["check"]);
    assert.equal(result.job.status, "claimed");
  });

  it("records blocker build result when validation or git apply check fails", async () => {
    const invalid = await executeCodingRoomBuildJob({
      job: buildJob({
        patch: patchFor("api/unowned.ts"),
      }),
    });

    assert.equal(invalid.ok, true);
    assert.equal(invalid.result, "blocker");
    assert.equal(invalid.job.status, "blocked");
    assert.match(invalid.job.build_result.blocker, /outside_ownership/);

    const failedCheck = await executeCodingRoomBuildJob({
      job: buildJob(),
      applyPatch: async () => ({ ok: false, exit_code: 1, output: "patch does not apply" }),
    });

    assert.equal(failedCheck.ok, true);
    assert.equal(failedCheck.result, "blocker");
    assert.equal(failedCheck.job.status, "blocked");
    assert.match(failedCheck.job.build_result.blocker, /patch does not apply/);
  });

  it("refuses unclaimed jobs and updates build results inside a ledger", async () => {
    const unclaimed = createCodingRoomJob({
      worker: "pinballwake-job-runner",
      chip: "not claimed",
      files: ["scripts/example.mjs"],
      build: { patch: patchFor() },
    });
    assert.equal((await executeCodingRoomBuildJob({ job: unclaimed })).reason, "job_not_claimed");

    const job = buildJob({ jobId: "coding-room:build:ledger" });
    const result = await executeCodingRoomBuildLedgerJob({
      ledger: createCodingRoomJobLedger({ jobs: [job] }),
      jobId: job.job_id,
      now: "2026-05-04T00:01:00.000Z",
      applyPatch: async () => ({ ok: true, exit_code: 0, output: "" }),
    });

    assert.equal(result.ok, true);
    assert.equal(result.ledger.jobs[0].status, "testing");
  });
});

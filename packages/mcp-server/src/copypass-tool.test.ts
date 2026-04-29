import { describe, expect, it } from "vitest";
import { copypassRun, copypassStatus } from "./copypass-tool.js";

describe("copypass-tool", () => {
  it("requires copy_text", async () => {
    const result = (await copypassRun({})) as { error?: string };
    expect(result.error).toMatch(/copy_text is required/);
  });

  it("rejects invalid profiles", async () => {
    const result = (await copypassRun({
      copy_text: "Try the new operator stack.",
      profile: "turbo",
    })) as { error?: string };
    expect(result.error).toMatch(/profile must be one of/);
  });

  it("stores an in-memory scaffold run and exposes status", async () => {
    const run = (await copypassRun({
      copy_text: "Ship the fastest way to turn your chat model into a useful operator.",
      channel: "homepage_hero",
      audience: "technical founders",
      goal: "clarity and conversion",
      profile: "smoke",
    })) as { run_id?: string; status?: string; finding_count?: number; verdict_summary?: { na?: number } };

    expect(run.status).toBe("complete");
    expect(run.finding_count).toBe(1);
    expect(run.verdict_summary?.na).toBe(1);
    expect(run.run_id).toBeTruthy();

    const status = (await copypassStatus({
      run_id: run.run_id,
    })) as { run_id?: string; status?: string; target?: { channel?: string } };

    expect(status.run_id).toBe(run.run_id);
    expect(status.status).toBe("complete");
    expect(status.target?.channel).toBe("homepage_hero");
  });

  it("returns a clear error for missing run ids", async () => {
    const status = (await copypassStatus({
      run_id: "missing-run-id",
    })) as { error?: string };
    expect(status.error).toMatch(/was not found in this MCP session/);
  });
});

import type { ToolDescriptor } from "./index.js";
import type { RunResult, RunTarget, RunProfile } from "../types.js";

export interface LegalpassRunArgs {
  pack_id: string;
  target: RunTarget;
  profile?: RunProfile;
  jurisdictions?: string[];
}

// Stub: real implementation will dispatch the 12-hat panel against the
// target, hard-veto via Citation Verifier, and return a populated RunResult.
export const legalpassRunTool: ToolDescriptor<LegalpassRunArgs, RunResult> = {
  name: "legalpass_run",
  description:
    "Run a LegalPass 12-hat issue-spotting pass against a URL, contract " +
    "upload, or repo. Issue-spotter only - never produces a transactional " +
    "legal instrument and never recommends a specific legal action.",
  inputSchema: {
    type: "object",
    required: ["pack_id", "target"],
    properties: {
      pack_id: { type: "string", minLength: 1 },
      target: {
        type: "object",
        required: ["kind"],
        properties: {
          kind: { type: "string", enum: ["url", "contract_upload", "repo"] },
          url: { type: "string", format: "uri" },
          upload_ref: { type: "string" },
          repo: { type: "string" },
          branch: { type: "string" },
          commit: { type: "string" },
        },
      },
      profile: { type: "string", enum: ["smoke", "standard", "deep"] },
      jurisdictions: { type: "array", items: { type: "string" } },
    },
  },
  handler: async (_args) => {
    throw new Error("legalpass_run: not yet implemented (Chunk 1 stub)");
  },
};

import type { ToolDescriptor } from "./index.js";
import type { RunResult } from "../types.js";

export interface LegalpassStatusArgs {
  run_id: string;
}

// Stub: real implementation will look up an in-flight or completed run
// and return its current status + verdict summary.
export const legalpassStatusTool: ToolDescriptor<LegalpassStatusArgs, RunResult> = {
  name: "legalpass_status",
  description:
    "Get the current status and verdict summary for a LegalPass run. " +
    "Returns issue-spotter findings only.",
  inputSchema: {
    type: "object",
    required: ["run_id"],
    properties: {
      run_id: { type: "string", minLength: 1 },
    },
  },
  handler: async (_args) => {
    throw new Error("legalpass_status: not yet implemented (Chunk 1 stub)");
  },
};

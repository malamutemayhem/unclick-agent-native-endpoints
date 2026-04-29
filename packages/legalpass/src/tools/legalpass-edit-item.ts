import type { ToolDescriptor } from "./index.js";
import type { Verdict } from "../types.js";

export interface LegalpassEditItemArgs {
  run_id: string;
  item_id: string;
  verdict?: Verdict;
  finding?: string;
  on_fail_comment?: string;
}

export interface LegalpassEditItemResult {
  run_id: string;
  item_id: string;
  updated: boolean;
}

// Stub: real implementation will update a single item on a completed
// run (e.g. human reviewer overrides verdict or annotates finding).
// Verdict-linter runs over any new finding text before persistence.
export const legalpassEditItemTool: ToolDescriptor<
  LegalpassEditItemArgs,
  LegalpassEditItemResult
> = {
  name: "legalpass_edit_item",
  description:
    "Edit a single item on a LegalPass run (verdict, finding text, " +
    "on-fail comment). Finding text is linted by PassGuard before save.",
  inputSchema: {
    type: "object",
    required: ["run_id", "item_id"],
    properties: {
      run_id: { type: "string", minLength: 1 },
      item_id: { type: "string", minLength: 1 },
      verdict: {
        type: "string",
        enum: ["check", "na", "fail", "other", "pending"],
      },
      finding: { type: "string" },
      on_fail_comment: { type: "string" },
    },
  },
  handler: async (_args) => {
    throw new Error("legalpass_edit_item: not yet implemented (Chunk 1 stub)");
  },
};

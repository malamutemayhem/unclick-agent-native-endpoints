import type { ToolDescriptor } from "./index.js";
import type { PackInput } from "../pack-schema.js";

export interface LegalpassSavePackArgs {
  pack: PackInput;
  overwrite?: boolean;
}

export interface LegalpassSavePackResult {
  pack_id: string;
  saved: boolean;
}

// Stub: real implementation will validate the pack with PackSchema,
// persist it, and return the saved pack id.
export const legalpassSavePackTool: ToolDescriptor<
  LegalpassSavePackArgs,
  LegalpassSavePackResult
> = {
  name: "legalpass_save_pack",
  description:
    "Save or update a LegalPass pack definition (12-hat roster, " +
    "jurisdictions, items). Validates against the Pack schema before persisting.",
  inputSchema: {
    type: "object",
    required: ["pack"],
    properties: {
      pack: { type: "object" },
      overwrite: { type: "boolean", default: false },
    },
  },
  handler: async (_args) => {
    throw new Error("legalpass_save_pack: not yet implemented (Chunk 1 stub)");
  },
};

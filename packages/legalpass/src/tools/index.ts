// Lightweight MCP-style tool registration for LegalPass.
//
// We don't import @modelcontextprotocol/sdk here because that pulls in a
// transport stack the stubs don't need. The host (UnClick mcp-server)
// converts these descriptors into real MCP tools at register time.

import { legalpassRunTool } from "./legalpass-run.js";
import { legalpassStatusTool } from "./legalpass-status.js";
import { legalpassSavePackTool } from "./legalpass-save-pack.js";
import { legalpassEditItemTool } from "./legalpass-edit-item.js";

export interface ToolDescriptor<TArgs = unknown, TResult = unknown> {
  name: string;
  description: string;
  // JSON Schema shape - kept loose at this layer so each tool can own its
  // own schema without coupling to a specific MCP SDK version.
  inputSchema: Record<string, unknown>;
  handler: (args: TArgs) => Promise<TResult>;
}

// Erased descriptor for the registry: a host iterates these without
// caring about the specific arg/result types, so generics would only get
// in the way (TypeScript treats ToolDescriptor as invariant).
export type AnyToolDescriptor = ToolDescriptor<any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const LEGALPASS_TOOLS: ReadonlyArray<AnyToolDescriptor> = [
  legalpassRunTool,
  legalpassStatusTool,
  legalpassSavePackTool,
  legalpassEditItemTool,
];

export {
  legalpassRunTool,
  legalpassStatusTool,
  legalpassSavePackTool,
  legalpassEditItemTool,
};

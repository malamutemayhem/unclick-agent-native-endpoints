import { describe, it, expect } from "vitest";
import {
  LEGALPASS_TOOLS,
  legalpassRunTool,
  legalpassStatusTool,
  legalpassSavePackTool,
  legalpassEditItemTool,
} from "../tools/index.js";

describe("LegalPass MCP tool registration", () => {
  it("registers all four tools", () => {
    expect(LEGALPASS_TOOLS).toHaveLength(4);
  });

  it("uses the canonical tool names", () => {
    const names = LEGALPASS_TOOLS.map((t) => t.name).sort();
    expect(names).toEqual([
      "legalpass_edit_item",
      "legalpass_run",
      "legalpass_save_pack",
      "legalpass_status",
    ]);
  });

  it("each tool has a non-empty description and JSON-schema input shape", () => {
    for (const tool of LEGALPASS_TOOLS) {
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema).toHaveProperty("type", "object");
      expect(tool.inputSchema).toHaveProperty("properties");
    }
  });

  it("stub handlers throw with the Chunk 1 marker", async () => {
    const tools = [
      legalpassRunTool,
      legalpassStatusTool,
      legalpassSavePackTool,
      legalpassEditItemTool,
    ];
    for (const tool of tools) {
      await expect(
        // Stubs ignore args; cast to satisfy generic.
        (tool.handler as (a: unknown) => Promise<unknown>)({})
      ).rejects.toThrow(/Chunk 1 stub/);
    }
  });
});

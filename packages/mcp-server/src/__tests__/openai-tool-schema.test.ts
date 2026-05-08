import { describe, expect, it } from "vitest";

import { ADDITIONAL_TOOLS } from "../tool-wiring.js";

function toolSchema(name: string): Record<string, unknown> {
  const tool = ADDITIONAL_TOOLS.find((candidate) => candidate.name === name);
  expect(tool).toBeTruthy();
  return tool?.inputSchema as Record<string, unknown>;
}

describe("OpenAI tool schema compatibility", () => {
  it("keeps vercel_get_env as a plain top-level object schema", () => {
    const schema = toolSchema("vercel_get_env");

    expect(schema.type).toBe("object");
    expect(schema.required).toEqual(["project_id"]);

    for (const keyword of ["anyOf", "oneOf", "allOf", "enum", "not"]) {
      expect(schema).not.toHaveProperty(keyword);
    }

    expect(schema.properties).toMatchObject({
      project_id: { type: "string" },
      projectId: { type: "string" },
    });
  });
});

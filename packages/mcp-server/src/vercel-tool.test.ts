import { describe, expect, it } from "vitest";
import { vercelProjectIdArg } from "./vercel-tool.js";

describe("vercelProjectIdArg", () => {
  it("uses project_id as the canonical key", () => {
    expect(vercelProjectIdArg({ project_id: " prj_canonical " })).toBe("prj_canonical");
  });

  it("accepts projectId as a legacy alias", () => {
    expect(vercelProjectIdArg({ projectId: " prj_legacy " })).toBe("prj_legacy");
  });
});

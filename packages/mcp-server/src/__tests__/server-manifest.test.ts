import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as {
  name: string;
  version: string;
};

const serverJson = JSON.parse(readFileSync(resolve("server.json"), "utf8")) as {
  version: string;
  packages?: Array<{ identifier?: string; version?: string }>;
};

describe("MCP server manifest", () => {
  it("stays in sync with the published package version", () => {
    const manifestPackage = serverJson.packages?.find(
      (entry) => entry.identifier === packageJson.name,
    );

    expect(serverJson.version).toBe(packageJson.version);
    expect(manifestPackage?.version).toBe(packageJson.version);
  });
});

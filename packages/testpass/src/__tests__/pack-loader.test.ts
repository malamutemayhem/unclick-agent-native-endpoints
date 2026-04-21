import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPackFromFile, loadPackFromYaml, packToJsonb, packFromJsonb, packToYaml } from "../pack-loader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORE_PACK_PATH = path.resolve(__dirname, "../../packs/testpass-core.yaml");

describe("loadPackFromFile", () => {
  it("loads and validates testpass-core.yaml without errors", () => {
    const pack = loadPackFromFile(CORE_PACK_PATH);
    expect(pack.id).toBe("testpass-core");
    expect(pack.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pack.items.length).toBeGreaterThanOrEqual(12);
  });

  it("throws when file does not exist", () => {
    expect(() => loadPackFromFile("/nonexistent/pack.yaml")).toThrow("not found");
  });
});

describe("loadPackFromYaml", () => {
  it("parses a minimal valid pack", () => {
    const yaml = `
id: test-pack
name: Test Pack
version: 1.0.0
items:
  - id: T-001
    title: Basic check
    category: general
    severity: low
    check_type: deterministic
`;
    const pack = loadPackFromYaml(yaml);
    expect(pack.id).toBe("test-pack");
    expect(pack.items).toHaveLength(1);
  });

  it("throws on invalid schema", () => {
    const yaml = `id: bad\nname: Bad\nversion: not-semver\nitems: []`;
    expect(() => loadPackFromYaml(yaml)).toThrow("schema validation failed");
  });
});

describe("jsonb round-trip", () => {
  it("converts pack to jsonb and back without data loss", () => {
    const pack = loadPackFromFile(CORE_PACK_PATH);
    const jsonb = packToJsonb(pack);
    const restored = packFromJsonb(jsonb);
    expect(restored.id).toBe(pack.id);
    expect(restored.items.length).toBe(pack.items.length);
    expect(restored.items[0].id).toBe(pack.items[0].id);
  });
});

describe("yaml serialization", () => {
  it("serializes and re-parses to an equivalent pack", () => {
    const pack = loadPackFromFile(CORE_PACK_PATH);
    const serialized = packToYaml(pack);
    const reparsed = loadPackFromYaml(serialized);
    expect(reparsed.id).toBe(pack.id);
    expect(reparsed.items.map((i) => i.id)).toEqual(pack.items.map((i) => i.id));
  });
});

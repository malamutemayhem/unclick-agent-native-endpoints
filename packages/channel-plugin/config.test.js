import test from "node:test";
import assert from "node:assert/strict";
import { parseEnvInt } from "./config.js";

test("parseEnvInt returns fallback for malformed values", () => {
  assert.equal(parseEnvInt("10s", 5000), 5000);
  assert.equal(parseEnvInt("", 5000), 5000);
  assert.equal(parseEnvInt(undefined, 5000), 5000);
});

test("parseEnvInt enforces minimum", () => {
  assert.equal(parseEnvInt("0", 10000, { min: 1 }), 10000);
  assert.equal(parseEnvInt("1", 10000, { min: 1 }), 1);
});

test("parseEnvInt caps maximum", () => {
  assert.equal(parseEnvInt("99999", 5000, { max: 30000 }), 30000);
});

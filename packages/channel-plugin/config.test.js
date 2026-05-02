import test from "node:test";
import assert from "node:assert/strict";
import { parseEnvInt, readTimingConfig } from "./config.js";

test("parseEnvInt falls back for malformed and bounded values", () => {
  assert.equal(parseEnvInt("abc", { fallback: 42, min: 1, max: 100 }), 42);
  assert.equal(parseEnvInt("0", { fallback: 42, min: 1, max: 100 }), 1);
  assert.equal(parseEnvInt("999", { fallback: 42, min: 1, max: 100 }), 100);
  assert.equal(parseEnvInt(" 25 ", { fallback: 42, min: 1, max: 100 }), 25);
});

test("readTimingConfig applies safe defaults and clamps", () => {
  const fromMalformed = readTimingConfig({
    UNCLICK_CHANNEL_POLL: "NaN",
    UNCLICK_API_TIMEOUT_MS: "5s",
  });
  assert.equal(fromMalformed.pollIntervalMs, 5000);
  assert.equal(fromMalformed.apiTimeoutMs, 10000);

  const fromLowValues = readTimingConfig({
    UNCLICK_CHANNEL_POLL: "1",
    UNCLICK_API_TIMEOUT_MS: "10",
  });
  assert.equal(fromLowValues.pollIntervalMs, 250);
  assert.equal(fromLowValues.apiTimeoutMs, 1000);

  const fromHighValues = readTimingConfig({
    UNCLICK_CHANNEL_POLL: "999999",
    UNCLICK_API_TIMEOUT_MS: "999999",
  });
  assert.equal(fromHighValues.pollIntervalMs, 60000);
  assert.equal(fromHighValues.apiTimeoutMs, 120000);
});

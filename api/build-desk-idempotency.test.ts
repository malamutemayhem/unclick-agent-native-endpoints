import { describe, expect, it } from "vitest";

import {
  attachBuildDeskIdempotencyKey,
  findBuildDeskRowByIdempotencyKey,
  getBuildDeskIdempotencyKey,
  parseBuildDeskIdempotencyKey,
} from "./lib/build-desk-idempotency";

describe("Build Desk idempotency helpers", () => {
  it("normalizes valid idempotency keys", () => {
    expect(parseBuildDeskIdempotencyKey(" retry-123 ")).toEqual({ value: "retry-123" });
    expect(parseBuildDeskIdempotencyKey(undefined)).toEqual({});
    expect(parseBuildDeskIdempotencyKey(" ")).toEqual({});
  });

  it("rejects malformed idempotency keys", () => {
    expect(parseBuildDeskIdempotencyKey(123).error).toBe("idempotency_key must be a string");
    expect(parseBuildDeskIdempotencyKey("bad key").error).toBe(
      "idempotency_key must not contain whitespace",
    );
    expect(parseBuildDeskIdempotencyKey("x".repeat(257)).error).toBe(
      "idempotency_key must be at most 256 characters",
    );
    expect(parseBuildDeskIdempotencyKey(`a${"\u0001"}b`).error).toBe(
      "idempotency_key contains invalid control characters",
    );
  });

  it("attaches keys without dropping existing payload", () => {
    expect(attachBuildDeskIdempotencyKey({ title: "ship" }, "retry-123")).toEqual({
      title: "ship",
      idempotency_key: "retry-123",
    });
    expect(attachBuildDeskIdempotencyKey("raw", "retry-123")).toEqual({
      value: "raw",
      idempotency_key: "retry-123",
    });
    expect(attachBuildDeskIdempotencyKey(undefined, undefined)).toBeNull();
  });

  it("finds existing rows by payload key", () => {
    const rows = [
      { id: "a", payload_json: { idempotency_key: "first" } },
      { id: "b", payload_json: { idempotency_key: "second" } },
    ];

    expect(getBuildDeskIdempotencyKey(rows[0].payload_json)).toBe("first");
    expect(findBuildDeskRowByIdempotencyKey(rows, "payload_json", "second")).toEqual(rows[1]);
    expect(findBuildDeskRowByIdempotencyKey(rows, "payload_json", "missing")).toBeNull();
  });
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const apiSource = await readFile("api/memory-admin.ts", "utf8");
const migrationSource = await readFile(
  "supabase/migrations/20260510000000_enable_ai_chat_by_default.sql",
  "utf8",
);

describe("tenant AI chat defaults", () => {
  it("returns tenant AI chat enabled when no tenant row exists", () => {
    assert.match(apiSource, /ai_chat_enabled:\s*row\?\.ai_chat_enabled\s*\?\?\s*true/);
  });

  it("keeps tenant settings env detection aligned with the API guard", () => {
    assert.match(apiSource, /const envEnabled = isAdminChatEnabled\(\);/);
  });

  it("migrates tenant settings to the enabled system default", () => {
    assert.match(migrationSource, /ALTER COLUMN ai_chat_enabled SET DEFAULT true/i);
    assert.match(migrationSource, /WHERE ai_chat_enabled = false/i);
  });
});

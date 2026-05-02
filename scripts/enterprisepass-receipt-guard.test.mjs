import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const receipt = JSON.parse(await readFile("public/enterprise/latest.json", "utf8"));

const REQUIRED_CATEGORY_IDS = [
  "code_maintainability",
  "secure_development",
  "evidence_over_claims",
  "documentation_quality",
  "credential_environment_hygiene",
  "investor_readiness",
  "ai_governance_readiness",
];

const FORBIDDEN_CERTIFICATION_CLAIMS = [
  /\bcertified\b/i,
  /\bcompliant\b/i,
  /\battested\b/i,
  /\baudit (?:report|certification|attestation|opinion|conclusion)\b/i,
];

const FORBIDDEN_SECRET_KEYS = new Set([
  "authorization",
  "cookie",
  "encrypted_value",
  "password",
  "raw",
  "secret",
  "token",
  "value",
]);

const ALLOWED_METADATA_KEY_PATHS = new Set([
  "readiness_score.value",
]);

const FORBIDDEN_SECRET_VALUE_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{16,}/,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}/,
  /\buc_[A-Za-z0-9_-]{20,}/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}/,
];

function collectKeysAndStrings(value, path = [], keys = [], strings = []) {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) collectKeysAndStrings(item, path.concat(String(index)), keys, strings);
    return { keys, strings };
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const childPath = path.concat(key);
      keys.push({ key, path: childPath.join(".") });
      collectKeysAndStrings(child, childPath, keys, strings);
    }
    return { keys, strings };
  }

  if (typeof value === "string") strings.push(value);
  return { keys, strings };
}

function findForbiddenSecretKeys(value) {
  return collectKeysAndStrings(value).keys
    .filter(({ key, path }) =>
      FORBIDDEN_SECRET_KEYS.has(key.toLowerCase()) &&
      !ALLOWED_METADATA_KEY_PATHS.has(path),
    )
    .map(({ path }) => path);
}

describe("EnterprisePass public receipt guard", () => {
  it("keeps EnterprisePass positioned as readiness guidance, not certification", () => {
    assert.equal(receipt.product, "EnterprisePass");
    assert.match(receipt.headline, /readiness/i);
    assert.match(receipt.wording_notice, /not a compliance certification/i);
    assert.match(receipt.wording_notice, /not.*SOC/i);
    assert.match(receipt.wording_notice, /not.*ISO/i);
    assert.match(receipt.wording_notice, /not.*legal opinion/i);

    const unsafeStrings = collectKeysAndStrings(receipt).strings.filter((text) =>
      FORBIDDEN_CERTIFICATION_CLAIMS.some((pattern) => pattern.test(text)) &&
      !/not|no|avoid|does not/i.test(text),
    );

    assert.deepEqual(unsafeStrings, []);
  });

  it("keeps the Phase 0 readiness category map complete and pending", () => {
    assert.equal(receipt.status, "pending");
    assert.equal(receipt.readiness_band, "seed");
    assert.equal(receipt.summary.checks_pending, REQUIRED_CATEGORY_IDS.length);
    assert.equal(receipt.summary.checks_total, 0);

    const categoryIds = receipt.categories.map((category) => category.id);
    assert.deepEqual(categoryIds, REQUIRED_CATEGORY_IDS);

    for (const category of receipt.categories) {
      assert.equal(category.status, "pending");
      assert.ok(category.name);
      assert.match(category.summary, /^Will (review|flag) /);
    }
  });

  it("requires evidence pointers without secret-shaped fields or values", () => {
    assert.ok(receipt.evidence.length >= 2);
    for (const evidence of receipt.evidence) {
      assert.ok(evidence.type);
      assert.ok(evidence.path);
      assert.ok(evidence.summary);
    }

    assert.equal(receipt.readiness_score.value, null);

    const { strings } = collectKeysAndStrings(receipt);
    const forbiddenKeys = findForbiddenSecretKeys(receipt);
    assert.deepEqual(forbiddenKeys, []);

    const secretLikeStrings = strings.filter((text) =>
      FORBIDDEN_SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(text)),
    );
    assert.deepEqual(secretLikeStrings, []);
  });

  it("still rejects secret-shaped value fields outside approved score metadata", () => {
    assert.deepEqual(findForbiddenSecretKeys({
      readiness_score: { value: null },
      evidence: [{ summary: "safe metadata" }],
      leaked: { value: "never store this" },
      nested: { auth: { token: "also forbidden" } },
    }), [
      "leaked.value",
      "nested.auth.token",
    ]);
  });

  it("keeps exclusions and next actions conservative", () => {
    assert.ok(receipt.exclusions.some((item) => /No ISO\/SOC compliance conclusion/i.test(item)));
    assert.ok(receipt.exclusions.some((item) => /No legal opinion/i.test(item)));
    assert.ok(receipt.exclusions.some((item) => /No raw secret storage/i.test(item)));
    assert.ok(receipt.next_actions.some((item) => /avoid compliance-certification claims/i.test(item)));
  });
});

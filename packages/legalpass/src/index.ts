// LegalPass - 12-hat issue-spotter for AI-native teams.
// "Twelve hats. One verdict."
//
// IMMUTABLE DESIGN RULE: LegalPass is an issue-spotter only. It NEVER
// produces a transactional legal instrument tailored to the user, NEVER
// recommends a specific legal action, and NEVER holds out as a substitute
// for a qualified practitioner. See docs/legalpass-product-brief.md.

export * from "./pack-schema.js";
export * from "./schema.js";
export * from "./hat-library.js";
export * from "./verdict-pack.js";
export type * from "./types.js";
export {
  LEGALPASS_TOOLS,
  legalpassRunTool,
  legalpassStatusTool,
  legalpassSavePackTool,
  legalpassEditItemTool,
} from "./tools/index.js";
export type { ToolDescriptor, AnyToolDescriptor } from "./tools/index.js";
export {
  lintVerdictText,
  assertVerdictText,
  FORBIDDEN_PHRASES,
  ALLOWED_PHRASES,
} from "./passguard/verdict-linter.js";
export type { LintResult, LintIssue } from "./passguard/verdict-linter.js";
export {
  getDisclaimer,
  wordCount,
  DISCLAIMER_TARGETS,
} from "./passguard/disclaimer-banner.js";
export type { DisclaimerLength } from "./passguard/disclaimer-banner.js";

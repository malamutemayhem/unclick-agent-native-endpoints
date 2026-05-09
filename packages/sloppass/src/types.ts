import type { z } from "zod";
import type {
  SlopPassCategorySchema,
  SlopPassDisclaimerSchema,
  SlopPassFindingSchema,
  SlopPassNotCheckedSchema,
  SlopPassResultSchema,
  SlopPassScopeSchema,
  SlopPassSeveritySchema,
  SlopPassSourceFileSchema,
  SlopPassSummarySchema,
  SlopPassTargetSchema,
  SlopPassVerdictSchema,
} from "./schema.js";

export type SlopPassSeverity = z.output<typeof SlopPassSeveritySchema>;
export type SlopPassCategory = z.output<typeof SlopPassCategorySchema>;
export type SlopPassVerdict = z.output<typeof SlopPassVerdictSchema>;
export type SlopPassTarget = z.output<typeof SlopPassTargetSchema>;
export type SlopPassSourceFile = z.output<typeof SlopPassSourceFileSchema>;
export type SlopPassScope = z.output<typeof SlopPassScopeSchema>;
export type SlopPassFinding = z.output<typeof SlopPassFindingSchema>;
export type SlopPassNotChecked = z.output<typeof SlopPassNotCheckedSchema>;
export type SlopPassSummary = z.output<typeof SlopPassSummarySchema>;
export type SlopPassDisclaimer = z.output<typeof SlopPassDisclaimerSchema>;
export type SlopPassResult = z.output<typeof SlopPassResultSchema>;

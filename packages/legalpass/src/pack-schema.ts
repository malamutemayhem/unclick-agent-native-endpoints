import { z } from "zod";

// Twelve-hat panel for LegalPass MVP. Citation Verifier is a hard-veto:
// every claim from the other eleven hats must trace to a primary source
// or it is dropped from the verdict.
export const HatIdSchema = z.enum([
  "privacy",
  "consumer_tos",
  "contracts",
  "oss_licence",
  "ai_ethics",
  "ip",
  "marketing_claims",
  "litigator",
  "plain_english",
  "compliance",
  "jurisdiction_router",
  "citation_verifier",
]);

export const JurisdictionCodeSchema = z.enum([
  "AU",
  "EU",
  "US-CA",
  "US-NY",
  "UK",
  "CA",
  "NZ",
  "SG",
]);

export const SeveritySchema = z.enum(["critical", "high", "medium", "low"]);
export const ProfileSchema = z.enum(["smoke", "standard", "deep"]);

export const TargetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("url"),
    url: z.string().url(),
  }),
  z.object({
    kind: z.literal("contract_upload"),
    upload_ref: z.string().min(1),
  }),
  z.object({
    kind: z.literal("repo"),
    repo: z.string().min(1),
    branch: z.string().optional(),
    commit: z.string().optional(),
  }),
]);

export const HatRosterEntrySchema = z.object({
  hat_id: HatIdSchema,
  enabled: z.boolean().default(true),
  weight: z.number().min(0).max(1).default(1),
  rubric_ref: z.string().optional(),
});

export const PackItemSchema = z.object({
  id: z.string().min(1),
  hat_id: HatIdSchema,
  title: z.string().min(1),
  category: z.string().min(1),
  severity: SeveritySchema,
  description: z.string().optional(),
  expected: z.unknown().optional(),
  on_fail: z.string().optional(),
  jurisdictions: z.array(JurisdictionCodeSchema).optional().default([]),
  profiles: z
    .array(ProfileSchema)
    .optional()
    .default(["smoke", "standard", "deep"]),
  tags: z.array(z.string()).optional().default([]),
});

export const PackSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "must be semver"),
  description: z.string().optional().default(""),
  targets: z
    .array(z.enum(["url", "contract_upload", "repo"]))
    .min(1, "pack must declare at least one target kind"),
  jurisdictions: z
    .array(JurisdictionCodeSchema)
    .min(1, "pack must declare at least one jurisdiction"),
  hats: z
    .array(HatRosterEntrySchema)
    .min(1, "pack must include at least one hat in the roster"),
  profile: ProfileSchema.default("standard"),
  items: z.array(PackItemSchema).min(1),
});

export type PackInput = z.input<typeof PackSchema>;
export type PackItemInput = z.input<typeof PackItemSchema>;

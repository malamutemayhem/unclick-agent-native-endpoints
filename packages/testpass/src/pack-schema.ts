import { z } from "zod";

const SeveritySchema = z.enum(["critical", "high", "medium", "low"]);
const CheckTypeSchema = z.enum(["deterministic", "agent", "hybrid"]);

const PackItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  severity: SeveritySchema,
  check_type: CheckTypeSchema,
  description: z.string().optional(),
  expected: z.unknown().optional(),
  on_fail: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  profiles: z.array(z.enum(["smoke", "standard", "deep"])).optional().default(["smoke", "standard", "deep"]),
});

export const PackSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "must be semver"),
  description: z.string().optional().default(""),
  extends: z.string().optional(),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  overrides: z.record(z.string(), PackItemSchema.omit({ id: true }).partial()).optional(),
  items: z.array(PackItemSchema).min(1),
});

export type PackItemInput = z.input<typeof PackItemSchema>;
export type PackInput = z.input<typeof PackSchema>;

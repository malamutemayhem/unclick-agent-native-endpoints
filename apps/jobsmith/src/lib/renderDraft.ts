// apps/jobsmith/src/lib/renderDraft.ts
//
// Compose a draft cover letter from a job description + voice profile.
// v0 is pure templating — no LLM. The output is meant to be edited before sending.

import type { VoiceProfile } from "./voiceProfile";

export interface JobDescription {
  rawText: string;
  role?: string | null;
  company?: string | null;
}

export interface DraftResult {
  draft: string;
  detectedRole: string | null;
  detectedCompany: string | null;
  warnings: string[];
}

const DEFAULT_OPENING = "Dear Hiring Manager,";
const DEFAULT_SIGNOFF = "Sincerely,";
const FALLBACK_NAME = "Christopher Byrne";

export function renderCoverLetterDraft(
  job: JobDescription,
  profile: VoiceProfile,
  options: { name?: string; brandSuffix?: string } = {},
): DraftResult {
  const warnings: string[] = [];

  const { role: detectedRole, company: detectedCompany } = detectRoleAndCompany(job);
  const role = job.role ?? detectedRole ?? "the advertised role";
  const company = job.company ?? detectedCompany ?? "your organisation";

  if (role === "the advertised role") {
    warnings.push("Could not detect a role title from the job text; using placeholder.");
  }
  if (company === "your organisation") {
    warnings.push("Could not detect the company name from the job text; using placeholder.");
  }

  const opener = composeOpener({ profile, role, company });
  const body = composeBody({ profile, role, company });
  const location = profile.locationStatement ?? defaultLocation();
  const flexibility = profile.flexibilityStatement ?? defaultFlexibility();
  const closer = composeCloser({ profile });
  const signoff = composeSignoff({ profile, name: options.name, brandSuffix: options.brandSuffix });

  const paragraphs = [DEFAULT_OPENING, opener, body, `${location} ${flexibility}`.trim(), closer, signoff];
  const draft = paragraphs.filter(Boolean).join("\n\n");

  return { draft, detectedRole, detectedCompany, warnings };
}

function detectRoleAndCompany(job: JobDescription): {
  role: string | null;
  company: string | null;
} {
  const lines = job.rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const first = lines[0] ?? "";
  const second = lines[1] ?? "";

  const isRoleyFirst = looksLikeRole(first);
  const isCompanyLikeSecond = looksLikeCompany(second);

  return {
    role: isRoleyFirst ? first : null,
    company: isCompanyLikeSecond ? second : null,
  };
}

function looksLikeRole(s: string): boolean {
  if (!s) return false;
  if (s.length > 80) return false;
  return /designer|developer|manager|coordinator|lead|specialist|engineer|director|producer|writer|editor|analyst|consultant|architect/i.test(
    s,
  );
}

function looksLikeCompany(s: string): boolean {
  if (!s) return false;
  if (s.length > 80) return false;
  if (/\b(sydney|melbourne|brisbane|perth|adelaide|nsw|vic|qld|wa|sa|tas)\b/i.test(s)) return false;
  return /[A-Z]/.test(s);
}

function composeOpener({
  profile,
  role,
  company,
}: {
  profile: VoiceProfile;
  role: string;
  company: string;
}): string {
  const template =
    profile.openingFormulas[0] ?? "I am pleased to express my interest in the role.";
  // Try to incorporate role + company in a natural way.
  const customised = template.replace(/the [^.]+(role|position)\.?$/i, "");
  return `${customised.trim()} the ${role} position at ${company}.`;
}

function composeBody({
  profile,
  role,
  company,
}: {
  profile: VoiceProfile;
  role: string;
  company: string;
}): string {
  const brandsToCite = profile.pastBrands.slice(0, 3);
  const adjectives = profile.tonalAdjectives.slice(0, 3).join(", ");
  const brandClause =
    brandsToCite.length > 0
      ? `My experience across ${brandsToCite.join(", ")} has given me a track record of ${adjectives || "creative and strategic"} work that I can bring to ${company}.`
      : `I bring a track record of ${adjectives || "creative and strategic"} work to ${company}.`;

  return [
    `With over 20 years of experience spanning graphic design, marketing, and digital content creation, I am well-equipped to deliver impactful results in the ${role} position.`,
    brandClause,
  ].join(" ");
}

function defaultLocation(): string {
  return "I am based in Victoria, Australia.";
}

function defaultFlexibility(): string {
  return "I am open to remote work and willing to travel for collaborative projects as required.";
}

function composeCloser({ profile }: { profile: VoiceProfile }): string {
  const thanks =
    profile.closingFormulas.find((s) => /thank you for considering/i.test(s)) ??
    "Thank you for considering my application.";
  const lookForward =
    profile.closingFormulas.find((s) => /look forward/i.test(s)) ??
    "I look forward to the opportunity to discuss how I can contribute to your team.";
  return `${thanks} ${lookForward}`;
}

function composeSignoff({
  profile,
  name,
  brandSuffix,
}: {
  profile: VoiceProfile;
  name?: string;
  brandSuffix?: string;
}): string {
  const sign =
    profile.signoffFormulas[0]?.replace(/[,.]+$/, "").trim() || DEFAULT_SIGNOFF.replace(",", "");
  const displayName = name ?? FALLBACK_NAME;
  const suffixLine = brandSuffix ? `\n${brandSuffix}` : "";
  return `${sign},\n${displayName}${suffixLine}`;
}

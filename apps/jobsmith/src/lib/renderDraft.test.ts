// apps/jobsmith/src/lib/renderDraft.test.ts

import { describe, test, expect } from "vitest";

import { renderCoverLetterDraft } from "./renderDraft";
import type { VoiceProfile } from "./voiceProfile";

function makeProfile(overrides: Partial<VoiceProfile> = {}): VoiceProfile {
  return {
    frequentPhrases: [],
    openingFormulas: ["I am pleased to express my interest in the role."],
    closingFormulas: [
      "Thank you for considering my application.",
      "I look forward to discussing how I can contribute.",
    ],
    signoffFormulas: ["Sincerely,"],
    roleTypes: ["Graphic Designer", "Senior Graphic Designer"],
    pastBrands: ["Rinnai", "Brivis", "Paslode", "Malamute Mayhem"],
    tonalAdjectives: ["creative", "strategic", "compelling"],
    locationStatement: "Based in Victoria, I am close to your office.",
    flexibilityStatement: "I am open to remote work and willing to travel.",
    ...overrides,
  };
}

const AMPERSAND_JOB = `Digital Media Designer
Ampersand International
Sydney NSW
Digital & Search Marketing (Marketing & Communications)
Contract/Temp
Key Responsibilities:
Coordinate content production`;

describe("renderCoverLetterDraft", () => {
  test("produces a non-empty draft with ≥4 paragraphs", () => {
    const profile = makeProfile();
    const result = renderCoverLetterDraft({ rawText: AMPERSAND_JOB }, profile);
    expect(result.draft.length).toBeGreaterThan(0);
    const paragraphs = result.draft.split(/\n\n+/);
    expect(paragraphs.length).toBeGreaterThanOrEqual(4);
  });

  test("includes the detected role and company in the body", () => {
    const profile = makeProfile();
    const result = renderCoverLetterDraft({ rawText: AMPERSAND_JOB }, profile);
    expect(result.draft).toContain("Digital Media Designer");
    expect(result.draft).toContain("Ampersand International");
    expect(result.detectedRole).toBe("Digital Media Designer");
    expect(result.detectedCompany).toBe("Ampersand International");
  });

  test("cites at least one past brand", () => {
    const profile = makeProfile();
    const result = renderCoverLetterDraft({ rawText: AMPERSAND_JOB }, profile);
    const hits = ["Rinnai", "Brivis", "Paslode", "Malamute Mayhem"].filter((b) =>
      result.draft.includes(b),
    );
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });

  test("uses the profile location statement when present", () => {
    const profile = makeProfile();
    const result = renderCoverLetterDraft({ rawText: AMPERSAND_JOB }, profile);
    expect(result.draft).toContain("Victoria");
  });

  test("signs off with Christopher Byrne by default", () => {
    const profile = makeProfile();
    const result = renderCoverLetterDraft({ rawText: AMPERSAND_JOB }, profile);
    expect(result.draft.trim().endsWith("Christopher Byrne")).toBe(true);
  });

  test("supports a brand suffix line", () => {
    const profile = makeProfile();
    const result = renderCoverLetterDraft(
      { rawText: AMPERSAND_JOB },
      profile,
      { brandSuffix: "Creative Lead & Founder, Malamute Mayhem" },
    );
    expect(result.draft).toMatch(/Christopher Byrne\nCreative Lead & Founder, Malamute Mayhem/);
  });

  test("falls back to placeholders when role/company cannot be detected", () => {
    const profile = makeProfile();
    const result = renderCoverLetterDraft({ rawText: "Lorem ipsum dolor sit amet." }, profile);
    expect(result.detectedRole).toBeNull();
    expect(result.detectedCompany).toBeNull();
    expect(result.draft).toContain("the advertised role");
    expect(result.draft).toContain("your organisation");
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
  });

  test("works with an empty pastBrands profile (still produces a draft)", () => {
    const profile = makeProfile({ pastBrands: [] });
    const result = renderCoverLetterDraft({ rawText: AMPERSAND_JOB }, profile);
    expect(result.draft.length).toBeGreaterThan(0);
  });
});

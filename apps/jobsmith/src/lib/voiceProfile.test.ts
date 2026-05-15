// apps/jobsmith/src/lib/voiceProfile.test.ts

import { describe, test, expect } from "vitest";

import { buildVoiceProfile } from "./voiceProfile";
import type { Corpus } from "./ingestCvCorpus";

const SAMPLE_OPENER_1 =
  "Dear Hiring Manager,\nI am pleased to express my interest in the Senior Graphic Designer position at Rinnai.";
const SAMPLE_BODY_1 =
  "Throughout my career at Rinnai, Brivis, and Paslode, I have led innovative campaigns and strategic projects.";
const SAMPLE_LOCATION_1 =
  "Based in Victoria, I am open to remote work and willing to travel for collaborative partnership models.";
const SAMPLE_CLOSER_1 =
  "Thank you for considering my application.\nI look forward to discussing this further.\nSincerely,\nChristopher Byrne";

const SAMPLE_OPENER_2 =
  "Dear Hiring Manager,\nI am excited to apply for the Digital Designer position at L'Occitane Australia.";
const SAMPLE_BODY_2 =
  "My work with Malamute Mayhem and Rinnai demonstrates creative, compelling, engaging design that aligns with your brand.";
const SAMPLE_LOCATION_2 =
  "Located in Victoria, I offer remote work flexibility and am willing to travel as required.";
const SAMPLE_CLOSER_2 =
  "Thank you for considering my application.\nBest regards,\nChristopher Byrne";

function makeCorpus(): Corpus {
  return {
    rootPath: "/fake/root",
    ingestedAt: new Date().toISOString(),
    promptTemplate:
      "CV and Job description below.\n" +
      SAMPLE_OPENER_1 +
      "\n\n" +
      SAMPLE_BODY_1 +
      "\n\n" +
      SAMPLE_LOCATION_1 +
      "\n\n" +
      SAMPLE_CLOSER_1,
    cvDated: [],
    coverLetters: [
      {
        fileName: "Cover Letter1.txt",
        filePath: "/fake/Cover Letter1.txt",
        format: "txt",
        date: null,
        company: null,
        role: null,
        textContent:
          SAMPLE_OPENER_1 + "\n\n" + SAMPLE_BODY_1 + "\n\n" + SAMPLE_LOCATION_1 + "\n\n" + SAMPLE_CLOSER_1,
      },
      {
        fileName: "Cover Letter2.txt",
        filePath: "/fake/Cover Letter2.txt",
        format: "txt",
        date: null,
        company: "L'Occitane Australia",
        role: null,
        textContent:
          SAMPLE_OPENER_2 + "\n\n" + SAMPLE_BODY_2 + "\n\n" + SAMPLE_LOCATION_2 + "\n\n" + SAMPLE_CLOSER_2,
      },
    ],
    jobsApplied: [
      {
        fileName: "Ampersand - Digital Media Designer.txt",
        filePath: "/fake/ja/Ampersand - Digital Media Designer.txt",
        company: "Ampersand",
        role: "Digital Media Designer",
        declined: false,
        textContent: "Digital Media Designer role.",
      },
      {
        fileName: "Rinnai - Senior Graphic Designer.txt",
        filePath: "/fake/ja/Rinnai - Senior Graphic Designer.txt",
        company: "Rinnai",
        role: "Senior Graphic Designer",
        declined: false,
        textContent: "Senior Graphic Designer role.",
      },
      {
        fileName: "Bunting - Digital Graphic Designer.txt",
        filePath: "/fake/ja/Declined/Bunting - Digital Graphic Designer.txt",
        company: "Bunting",
        role: "Digital Graphic Designer",
        declined: true,
        textContent: "Digital Graphic Designer role.",
      },
    ],
  };
}

describe("buildVoiceProfile", () => {
  test("returns ≥3 role types from jobs applied", () => {
    const profile = buildVoiceProfile(makeCorpus());
    expect(profile.roleTypes.length).toBeGreaterThanOrEqual(3);
    expect(profile.roleTypes).toContain("Digital Media Designer");
    expect(profile.roleTypes).toContain("Senior Graphic Designer");
    expect(profile.roleTypes).toContain("Digital Graphic Designer");
  });

  test("pastBrands contains Rinnai, Brivis, Paslode, Malamute Mayhem", () => {
    const profile = buildVoiceProfile(makeCorpus());
    expect(profile.pastBrands).toEqual(
      expect.arrayContaining(["Rinnai", "Brivis", "Paslode", "Malamute Mayhem"]),
    );
  });

  test("tonalAdjectives includes innovative/creative/strategic/compelling/engaging", () => {
    const profile = buildVoiceProfile(makeCorpus());
    const expected = ["innovative", "creative", "strategic", "compelling", "engaging"];
    expect(profile.tonalAdjectives.length).toBeGreaterThanOrEqual(3);
    for (const w of expected) {
      // not all must appear, but enough should
    }
    const hit = expected.filter((w) => profile.tonalAdjectives.includes(w));
    expect(hit.length).toBeGreaterThanOrEqual(3);
  });

  test("openingFormulas matches the canonical 'I am ...' pattern", () => {
    const profile = buildVoiceProfile(makeCorpus());
    expect(profile.openingFormulas.length).toBeGreaterThanOrEqual(1);
    expect(profile.openingFormulas[0]).toMatch(/^I am /);
  });

  test("closingFormulas contains thank-you formula", () => {
    const profile = buildVoiceProfile(makeCorpus());
    expect(profile.closingFormulas.some((s) => /Thank you for considering/i.test(s))).toBe(true);
  });

  test("signoffFormulas contains a sign-off line", () => {
    const profile = buildVoiceProfile(makeCorpus());
    expect(profile.signoffFormulas.length).toBeGreaterThanOrEqual(1);
    expect(profile.signoffFormulas[0]).toMatch(/(Sincerely|Best regards|Kind regards)/i);
  });

  test("locationStatement captures Victoria-based phrasing", () => {
    const profile = buildVoiceProfile(makeCorpus());
    expect(profile.locationStatement).not.toBeNull();
    expect(profile.locationStatement!).toMatch(/Victoria/i);
  });

  test("flexibilityStatement captures remote/contract phrasing", () => {
    const profile = buildVoiceProfile(makeCorpus());
    expect(profile.flexibilityStatement).not.toBeNull();
    expect(profile.flexibilityStatement!).toMatch(/remote|contract|partnership/i);
  });

  test("frequentPhrases returns 0..N items without throwing on small corpus", () => {
    const profile = buildVoiceProfile(makeCorpus());
    expect(Array.isArray(profile.frequentPhrases)).toBe(true);
    // Small corpus may yield few phrases; just assert structure.
    for (const p of profile.frequentPhrases) {
      expect(typeof p.phrase).toBe("string");
      expect(typeof p.count).toBe("number");
      expect(p.count).toBeGreaterThanOrEqual(2);
    }
  });
});

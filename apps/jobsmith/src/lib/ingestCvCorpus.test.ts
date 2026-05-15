// apps/jobsmith/src/lib/ingestCvCorpus.test.ts
//
// Tests against a tmp-folder fixture mirroring the real CV folder shape.
// Uses vitest by default; swap `describe/test/expect` to node:test if your
// repo uses node:test.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { ingestCvCorpus, type Corpus } from "./ingestCvCorpus";

let tmpRoot: string;

beforeAll(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "jobsmith-fixture-"));
  await buildFixture(tmpRoot);
});

afterAll(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("ingestCvCorpus", () => {
  test("throws when no rootPath provided and no env var set", async () => {
    const prev = process.env.JOBSMITH_CV_ROOT;
    delete process.env.JOBSMITH_CV_ROOT;
    try {
      await expect(ingestCvCorpus()).rejects.toThrow(/JOBSMITH_CV_ROOT/);
    } finally {
      if (prev !== undefined) process.env.JOBSMITH_CV_ROOT = prev;
    }
  });

  test("throws when rootPath does not exist", async () => {
    await expect(ingestCvCorpus("/path/that/does/not/exist/foo")).rejects.toThrow(/does not exist/);
  });

  test("returns a Corpus shape with expected counts from the fixture", async () => {
    const corpus: Corpus = await ingestCvCorpus(tmpRoot);
    expect(corpus.rootPath).toBe(tmpRoot);
    expect(corpus.ingestedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    expect(corpus.cvDated.length).toBeGreaterThanOrEqual(1);
    expect(corpus.coverLetters.length).toBeGreaterThanOrEqual(2);
    expect(corpus.jobsApplied.length).toBeGreaterThanOrEqual(2);
    expect(corpus.promptTemplate).not.toBeNull();
    expect(corpus.promptTemplate!.length).toBeGreaterThan(10);
  });

  test("parses CV folder date prefix", async () => {
    const corpus = await ingestCvCorpus(tmpRoot);
    const folder = corpus.cvDated.find((f) => f.folderName.startsWith("20240213"));
    expect(folder).toBeTruthy();
    expect(folder!.date).toBe("2024-02-13");
  });

  test("captures Text versions inc. dates.txt content when present", async () => {
    const corpus = await ingestCvCorpus(tmpRoot);
    const folder = corpus.cvDated.find((f) => f.folderName.startsWith("20240213"));
    expect(folder!.textVersionPath).not.toBeNull();
    expect(folder!.textVersionContent).toMatch(/CV text/);
  });

  test("parses cover letter company from filename", async () => {
    const corpus = await ingestCvCorpus(tmpRoot);
    const cl = corpus.coverLetters.find((c) => c.fileName.includes("Ampersand International"));
    expect(cl).toBeTruthy();
    expect(cl!.company).toBe("Ampersand International");
  });

  test("marks declined jobs", async () => {
    const corpus = await ingestCvCorpus(tmpRoot);
    const declined = corpus.jobsApplied.find((j) => j.declined);
    expect(declined).toBeTruthy();
  });

  test("does not parse PDF/INDD content in v0", async () => {
    const corpus = await ingestCvCorpus(tmpRoot);
    const pdfLetter = corpus.coverLetters.find((c) => c.format === "pdf");
    if (pdfLetter) {
      expect(pdfLetter.textContent).toBeNull();
    }
  });
});

async function buildFixture(root: string): Promise<void> {
  // dated CV folder
  const cvFolder = path.join(root, "20240213 CV Christopher Byrne");
  await fs.mkdir(cvFolder, { recursive: true });
  await fs.writeFile(path.join(cvFolder, "20240213 CV Christopher Byrne.pdf"), "fake pdf bytes");
  await fs.writeFile(path.join(cvFolder, "20240213 CV Christopher Byrne.indd"), "fake indd bytes");
  await fs.writeFile(path.join(cvFolder, "Text versions inc. dates.txt"), "CV text body\nlots of lines");

  // cover letters folder
  const cl = path.join(root, "Cover Letters");
  await fs.mkdir(cl, { recursive: true });
  await fs.writeFile(
    path.join(cl, "20240212 Cover Letter - Ampersand International, Christopher Byrne.pdf"),
    "fake pdf bytes",
  );
  await fs.writeFile(
    path.join(cl, "20240212 Cover Letter - Ampersand International, Christopher Byrne.indd"),
    "fake indd bytes",
  );
  await fs.writeFile(
    path.join(cl, "Cover Letter1.txt"),
    "Dear Hiring Manager,\nI am writing to express my interest in the role.\nSincerely,\nChristopher Byrne",
  );
  await fs.writeFile(
    path.join(cl, "ChatGPT Prompt Letter Generation.txt"),
    "CV and Job description below, please write me a cover letter.\nSample letter content.",
  );

  // jobs applied
  const ja = path.join(root, "Jobs Applied");
  const declined = path.join(ja, "Declined");
  await fs.mkdir(declined, { recursive: true });
  await fs.writeFile(
    path.join(ja, "Ampersand International - Digital Media Designer.txt"),
    "Digital Media Designer\nAmpersand International\nSydney NSW\nKey Responsibilities: ...",
  );
  await fs.writeFile(
    path.join(declined, "Baby Bunting Digital Graphic Designer.txt"),
    "Digital Graphic Designer\nBaby Bunting\nDandenong South VIC",
  );
}

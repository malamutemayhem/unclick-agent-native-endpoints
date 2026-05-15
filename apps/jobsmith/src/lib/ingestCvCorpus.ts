// apps/jobsmith/src/lib/ingestCvCorpus.ts
//
// Read the local CV folder, normalize into a Corpus object.
// v0 parses .txt files only. PDFs and INDDs are listed but not parsed.
//
// The root path defaults to process.env.JOBSMITH_CV_ROOT, else throws.

import { promises as fs } from "node:fs";
import * as path from "node:path";

export interface Corpus {
  rootPath: string;
  cvDated: CvDatedFolder[];
  coverLetters: CoverLetter[];
  jobsApplied: JobApplied[];
  promptTemplate: string | null;
  ingestedAt: string;
}

export interface CvDatedFolder {
  date: string | null; // ISO date (YYYY-MM-DD) parsed from folder prefix
  folderName: string;
  pdfPaths: string[];
  inddPaths: string[];
  textVersionPath: string | null;
  textVersionContent: string | null;
}

export interface CoverLetter {
  fileName: string;
  filePath: string;
  format: "txt" | "pdf" | "indd" | "other";
  date: string | null;
  company: string | null;
  role: string | null;
  textContent: string | null;
}

export interface JobApplied {
  fileName: string;
  filePath: string;
  company: string | null;
  role: string | null;
  declined: boolean;
  textContent: string;
}

const MAX_WALK_DEPTH = 4;
const CV_FOLDER_RE = /^(\d{4})(\d{2})(\d{2})\s+CV\s/i;
const COVER_LETTER_FILE_RE = /Cover\s+Letter\s+-\s+([^,]+),\s+Christopher\s+Byrne/i;
const DATED_FILE_PREFIX_RE = /^(\d{4})(\d{2})(\d{2})\s/;
const JOB_APPLIED_NAME_RE = /^(.+?)\s+-\s+(.+?)\.(txt|md)$/i;

export async function ingestCvCorpus(rootPath?: string): Promise<Corpus> {
  const root = rootPath ?? process.env.JOBSMITH_CV_ROOT;
  if (!root) {
    throw new Error(
      "ingestCvCorpus: no rootPath provided and JOBSMITH_CV_ROOT env var is unset",
    );
  }

  const exists = await pathExists(root);
  if (!exists) {
    throw new Error(`ingestCvCorpus: rootPath does not exist: ${root}`);
  }

  const entries = await walk(root, 0);

  const cvDated = await collectCvDatedFolders(root, entries);
  const coverLetters = await collectCoverLetters(entries);
  const jobsApplied = await collectJobsApplied(entries);
  const promptTemplate = await findPromptTemplate(entries);

  return {
    rootPath: root,
    cvDated,
    coverLetters,
    jobsApplied,
    promptTemplate,
    ingestedAt: new Date().toISOString(),
  };
}

interface WalkEntry {
  fullPath: string;
  relPath: string;     // relative to root
  name: string;
  isDirectory: boolean;
  depth: number;
}

async function walk(root: string, baseDepth: number): Promise<WalkEntry[]> {
  const collected: WalkEntry[] = [];
  await walkInto(root, root, baseDepth, collected);
  return collected;
}

async function walkInto(
  root: string,
  dir: string,
  depth: number,
  acc: WalkEntry[],
): Promise<void> {
  if (depth > MAX_WALK_DEPTH) return;
  let dirents: import("node:fs").Dirent[];
  try {
    dirents = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const d of dirents) {
    const full = path.join(dir, d.name);
    const rel = path.relative(root, full);
    acc.push({
      fullPath: full,
      relPath: rel,
      name: d.name,
      isDirectory: d.isDirectory(),
      depth,
    });
    if (d.isDirectory()) {
      await walkInto(root, full, depth + 1, acc);
    }
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function parseDateFromFolder(name: string): string | null {
  const m = name.match(CV_FOLDER_RE);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function parseDateFromFile(name: string): string | null {
  const m = name.match(DATED_FILE_PREFIX_RE);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function parseCoverLetterCompany(name: string): string | null {
  const m = name.match(COVER_LETTER_FILE_RE);
  return m ? m[1].trim() : null;
}

function classifyFormat(name: string): CoverLetter["format"] {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".txt" || ext === ".md") return "txt";
  if (ext === ".pdf") return "pdf";
  if (ext === ".indd") return "indd";
  return "other";
}

async function collectCvDatedFolders(
  root: string,
  entries: WalkEntry[],
): Promise<CvDatedFolder[]> {
  const folders = entries.filter(
    (e) => e.isDirectory && e.depth === 0 && CV_FOLDER_RE.test(e.name),
  );

  const result: CvDatedFolder[] = [];
  for (const folder of folders) {
    const inFolder = entries.filter(
      (e) =>
        !e.isDirectory && e.fullPath.startsWith(folder.fullPath + path.sep),
    );
    const pdfPaths: string[] = [];
    const inddPaths: string[] = [];
    let textVersionPath: string | null = null;
    let textVersionContent: string | null = null;

    for (const f of inFolder) {
      const fmt = classifyFormat(f.name);
      if (fmt === "pdf") pdfPaths.push(f.fullPath);
      else if (fmt === "indd") inddPaths.push(f.fullPath);
      else if (fmt === "txt" && /text.*version/i.test(f.name)) {
        textVersionPath = f.fullPath;
        textVersionContent = await safeReadText(f.fullPath);
      }
    }

    result.push({
      date: parseDateFromFolder(folder.name),
      folderName: folder.name,
      pdfPaths,
      inddPaths,
      textVersionPath,
      textVersionContent,
    });
  }
  return result;
}

async function collectCoverLetters(entries: WalkEntry[]): Promise<CoverLetter[]> {
  const candidates = entries.filter(
    (e) =>
      !e.isDirectory &&
      (e.relPath.startsWith("Cover Letters") || /cover\s*letter/i.test(e.name)),
  );
  const result: CoverLetter[] = [];
  for (const f of candidates) {
    const fmt = classifyFormat(f.name);
    if (fmt === "other") continue;
    const company = parseCoverLetterCompany(f.name);
    const date = parseDateFromFile(f.name);
    const textContent = fmt === "txt" ? await safeReadText(f.fullPath) : null;
    result.push({
      fileName: f.name,
      filePath: f.fullPath,
      format: fmt,
      date,
      company,
      role: null, // role inference deferred to v0.1
      textContent,
    });
  }
  return result;
}

async function collectJobsApplied(entries: WalkEntry[]): Promise<JobApplied[]> {
  const candidates = entries.filter(
    (e) =>
      !e.isDirectory &&
      /\.txt$/i.test(e.name) &&
      e.relPath.split(path.sep)[0]?.toLowerCase() === "jobs applied",
  );
  const result: JobApplied[] = [];
  for (const f of candidates) {
    const declined = e_isDeclined(f.relPath);
    const baseName = path.basename(f.name, path.extname(f.name));
    const m = baseName.match(JOB_APPLIED_NAME_RE);
    let company: string | null = null;
    let role: string | null = null;
    if (m) {
      company = m[1].trim();
      role = m[2].trim();
    } else {
      const splitDash = baseName.split(" - ");
      if (splitDash.length === 2) {
        company = splitDash[0].trim();
        role = splitDash[1].trim();
      } else {
        company = baseName;
      }
    }
    const textContent = (await safeReadText(f.fullPath)) ?? "";
    result.push({
      fileName: f.name,
      filePath: f.fullPath,
      company,
      role,
      declined,
      textContent,
    });
  }
  return result;
}

function e_isDeclined(relPath: string): boolean {
  return relPath.split(path.sep).some((seg) => seg.toLowerCase() === "declined");
}

async function findPromptTemplate(entries: WalkEntry[]): Promise<string | null> {
  const candidate = entries.find(
    (e) => !e.isDirectory && /ChatGPT Prompt Letter Generation\.txt$/i.test(e.name),
  );
  if (!candidate) return null;
  return await safeReadText(candidate.fullPath);
}

async function safeReadText(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

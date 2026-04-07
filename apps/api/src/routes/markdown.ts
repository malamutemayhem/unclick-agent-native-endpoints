import { Hono } from 'hono';
import { z } from 'zod';
import { marked } from 'marked';
import { ok } from '@unclick/core';
import { zv } from '../middleware/validate.js';
import { requireScope } from '../middleware/auth.js';
import type { AppVariables } from '../middleware/types.js';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const InputSchema = z.object({
  markdown: z.string().min(0).max(1_000_000),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripMarkdown(src: string): string {
  return src
    // Fenced code blocks → keep content
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, '').trim())
    // Inline code
    .replace(/`([^`]+)`/g, '$1')
    // ATX headings
    .replace(/^#{1,6}\s+/gm, '')
    // Setext headings (underlines)
    .replace(/^[=-]{2,}\s*$/gm, '')
    // Bold / italic
    .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, '$2')
    // Strikethrough
    .replace(/~~(.*?)~~/g, '$1')
    // Images - drop entirely
    .replace(/!\[.*?\]\(.*?\)/g, '')
    // Links - keep label
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Reference-style links
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
    // Link reference definitions
    .replace(/^\s*\[.*?\]:\s+\S+.*$/gm, '')
    // Block-quotes
    .replace(/^>\s*/gm, '')
    // Unordered list markers
    .replace(/^[\s]*[-*+]\s+/gm, '')
    // Ordered list markers
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // Horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // HTML tags
    .replace(/<[^>]+>/g, '')
    // Collapse extra blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

type TocEntry = {
  level: number;
  text: string;
  anchor: string;
};

function extractToc(src: string): TocEntry[] {
  const entries: TocEntry[] = [];
  // Match ATX-style headings: # ## ### etc.
  const atx = /^(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = atx.exec(src)) !== null) {
    const level = m[1].length;
    const raw = m[2].trim();
    // Strip inline formatting from heading text
    const text = raw
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, '$2')
      .replace(/`([^`]+)`/g, '$1')
      .trim();
    const anchor = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-{2,}/g, '-');
    entries.push({ level, text, anchor });
  }
  return entries;
}

type LintIssue = {
  line: number | null;
  message: string;
};

function lintMarkdown(src: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const lines = src.split('\n');

  // ── Unclosed fenced code blocks ──────────────────────────────────────────
  let inFence = false;
  let fenceStart = -1;
  let fenceChar = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = /^(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      const ch = fenceMatch[1][0];
      if (!inFence) {
        inFence = true;
        fenceStart = i + 1;
        fenceChar = ch;
      } else if (ch === fenceChar) {
        inFence = false;
        fenceChar = '';
      }
    }
  }
  if (inFence) {
    issues.push({ line: fenceStart, message: 'Unclosed fenced code block' });
  }

  // ── Broken link syntax ────────────────────────────────────────────────────
  // Detect [text]( without a closing )
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip lines inside a code block (rough check)
    if (/^\s{4}/.test(line) || /^`/.test(line)) continue;
    const linkOpen = /\[[^\]]*\]\([^)]*$/.exec(line);
    if (linkOpen) {
      issues.push({ line: i + 1, message: 'Possibly malformed link - missing closing ")"' });
    }
  }

  // ── Unclosed inline code ──────────────────────────────────────────────────
  {
    let insideFence2 = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip fence marker lines entirely
      if (/^(`{3,}|~{3,})/.test(line)) {
        insideFence2 = !insideFence2;
        continue;
      }
      if (insideFence2) continue;
      // Count unescaped backticks
      const stripped = line.replace(/\\`/g, '');
      const backticks = (stripped.match(/`/g) ?? []).length;
      if (backticks % 2 !== 0) {
        issues.push({ line: i + 1, message: 'Odd number of backticks - possible unclosed inline code' });
      }
    }
  }

  // ── Blank heading ─────────────────────────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,6}\s*$/.test(lines[i])) {
      issues.push({ line: i + 1, message: 'Empty heading' });
    }
  }

  return issues;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export function createMarkdownRouter() {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /markdown/to-html - convert markdown to HTML
  router.post('/to-html', requireScope('markdown:use'), zv('json', InputSchema), (c) => {
    const { markdown } = c.req.valid('json');
    const html = marked.parse(markdown, { async: false }) as string;
    return ok(c, { html, bytes: html.length });
  });

  // POST /markdown/to-text - strip formatting, return plain text
  router.post('/to-text', requireScope('markdown:use'), zv('json', InputSchema), (c) => {
    const { markdown } = c.req.valid('json');
    const text = stripMarkdown(markdown);
    return ok(c, { text, bytes: text.length });
  });

  // POST /markdown/toc - extract table of contents
  router.post('/toc', requireScope('markdown:use'), zv('json', InputSchema), (c) => {
    const { markdown } = c.req.valid('json');
    const headings = extractToc(markdown);
    return ok(c, { headings, count: headings.length });
  });

  // POST /markdown/lint - basic lint checks
  router.post('/lint', requireScope('markdown:use'), zv('json', InputSchema), (c) => {
    const { markdown } = c.req.valid('json');
    const issues = lintMarkdown(markdown);
    return ok(c, { valid: issues.length === 0, issues, count: issues.length });
  });

  return router;
}

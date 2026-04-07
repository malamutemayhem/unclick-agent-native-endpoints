import { Hono } from 'hono';
import { z } from 'zod';
import { ok, Errors } from '@unclick/core';
import { zv } from '../middleware/validate.js';
import { requireScope } from '../middleware/auth.js';
import type { AppVariables } from '../middleware/types.js';

const InspectSchema = z.object({
  url: z.string().url().max(2_048),
});

const SecuritySchema = z.object({
  url: z.string().url().max(2_048),
});

// Security headers we grade
const SECURITY_HEADERS = [
  'strict-transport-security',
  'content-security-policy',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
  'x-xss-protection',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
] as const;

type SecurityHeader = (typeof SECURITY_HEADERS)[number];

interface HeaderGrade {
  present: boolean;
  value: string | null;
  pass: boolean;
  note: string;
}

function gradeHeader(name: SecurityHeader, value: string | null): HeaderGrade {
  if (!value) {
    return { present: false, value: null, pass: false, note: 'Header missing' };
  }

  const v = value.toLowerCase();
  switch (name) {
    case 'strict-transport-security':
      return {
        present: true,
        value,
        pass: v.includes('max-age=') && parseInt(v.match(/max-age=(\d+)/)?.[1] ?? '0', 10) >= 31536000,
        note: v.includes('max-age=') ? 'Present' : 'max-age directive missing',
      };
    case 'content-security-policy':
      return {
        present: true,
        value,
        pass: !v.includes("'unsafe-inline'") && !v.includes("'unsafe-eval'"),
        note: v.includes("'unsafe-inline'") || v.includes("'unsafe-eval'")
          ? "Contains unsafe-inline or unsafe-eval"
          : 'Present',
      };
    case 'x-frame-options':
      return {
        present: true,
        value,
        pass: v === 'deny' || v === 'sameorigin',
        note: v === 'deny' || v === 'sameorigin' ? 'Present' : 'Value should be DENY or SAMEORIGIN',
      };
    case 'x-content-type-options':
      return {
        present: true,
        value,
        pass: v === 'nosniff',
        note: v === 'nosniff' ? 'Present' : 'Value should be nosniff',
      };
    case 'referrer-policy':
      return {
        present: true,
        value,
        pass: ['no-referrer', 'strict-origin', 'strict-origin-when-cross-origin', 'no-referrer-when-downgrade'].includes(v),
        note: 'Present',
      };
    case 'x-xss-protection':
      return {
        present: true,
        value,
        pass: v.startsWith('1'),
        note: 'Present (deprecated in modern browsers but still graded)',
      };
    default:
      return { present: true, value, pass: true, note: 'Present' };
  }
}

async function fetchHeaders(url: string): Promise<Record<string, string>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);
    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  } finally {
    clearTimeout(timeout);
  }
}

export function createHeadersRouter() {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /headers/inspect - return all response headers
  router.post('/inspect', requireScope('headers:use'), zv('json', InspectSchema), async (c) => {
    const { url } = c.req.valid('json');
    try {
      const headers = await fetchHeaders(url);
      return ok(c, { url, headers, count: Object.keys(headers).length });
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        throw Errors.validation('Request timed out after 10 seconds');
      }
      throw Errors.validation(`Failed to fetch headers: ${(err as Error).message}`);
    }
  });

  // POST /headers/security - grade security headers
  router.post('/security', requireScope('headers:use'), zv('json', SecuritySchema), async (c) => {
    const { url } = c.req.valid('json');
    try {
      const headers = await fetchHeaders(url);

      const grades: Record<string, HeaderGrade> = {};
      let passed = 0;
      for (const name of SECURITY_HEADERS) {
        const grade = gradeHeader(name, headers[name] ?? null);
        grades[name] = grade;
        if (grade.pass) passed++;
      }

      const score = Math.round((passed / SECURITY_HEADERS.length) * 100);
      const letter = score >= 90 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : score >= 30 ? 'D' : 'F';

      return ok(c, {
        url,
        score,
        grade: letter,
        passed,
        total: SECURITY_HEADERS.length,
        headers: grades,
      });
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        throw Errors.validation('Request timed out after 10 seconds');
      }
      throw Errors.validation(`Failed to fetch headers: ${(err as Error).message}`);
    }
  });

  return router;
}

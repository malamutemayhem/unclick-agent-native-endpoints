/**
 * Feedback & bug reporting — public endpoint, shared across all UnClick tools.
 *
 * POST /api/feedback   — submit a report (rate limited, no auth required)
 * GET  /api/feedback   — list reports (requires auth, internal use)
 *
 * GitHub Issues integration: reports are shaped so they can be forwarded
 * to GitHub Issues via the REST API. Hook point: `toGitHubIssue()`.
 */
import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { eq, desc, count } from 'drizzle-orm';
import { ok, created, list, Errors, newId, parsePagination } from '@unclick/core';
import type { Db } from '../db/index.js';
import { feedbackReports } from '../db/schema.js';
import { zv } from '../middleware/validate.js';
import type { AppVariables } from '../middleware/types.js';
import { requireScope } from '../middleware/auth.js';

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------
const SubmitFeedbackSchema = z.object({
  type: z.enum(['bug', 'feature', 'feedback']),
  description: z.string().min(10).max(4000),
  email: z.string().email().optional(),
  tool: z.string().max(64).default('unknown'),
  endpoint: z.string().max(512).optional(),
  metadata: z.record(z.unknown()).default({}),
});

// ---------------------------------------------------------------------------
// GitHub Issues data shape
// Auto-create issues by POSTing this to:
//   POST https://api.github.com/repos/{owner}/{repo}/issues
//   Authorization: Bearer <GITHUB_TOKEN>
// ---------------------------------------------------------------------------
export function toGitHubIssue(report: {
  id: string;
  type: string;
  description: string;
  email?: string | null;
  tool: string;
  endpoint?: string | null;
  userAgent?: string | null;
  metadata: string;
  createdAt: Date;
}): {
  title: string;
  body: string;
  labels: string[];
} {
  const typeLabel = report.type === 'bug' ? 'bug'
    : report.type === 'feature' ? 'enhancement'
    : 'feedback';

  const meta = (() => {
    try { return JSON.parse(report.metadata); } catch { return {}; }
  })();

  const title = `[${report.tool}] ${report.type === 'bug' ? 'Bug: ' : report.type === 'feature' ? 'Feature: ' : ''}${report.description.slice(0, 80)}${report.description.length > 80 ? '...' : ''}`;

  const body = [
    `**Report ID:** \`${report.id}\``,
    `**Tool:** ${report.tool}`,
    report.endpoint ? `**Endpoint:** \`${report.endpoint}\`` : null,
    report.email ? `**Submitted by:** ${report.email}` : null,
    `**Submitted at:** ${report.createdAt.toISOString()}`,
    '',
    '## Description',
    '',
    report.description,
    '',
    report.userAgent ? `\n**User Agent:** \`${report.userAgent}\`` : null,
    Object.keys(meta).length > 0 ? `\n**Metadata:**\n\`\`\`json\n${JSON.stringify(meta, null, 2)}\n\`\`\`` : null,
    '',
    '---',
    '*Submitted via UnClick feedback system.*',
  ].filter(Boolean).join('\n');

  return {
    title,
    body,
    labels: [typeLabel, `tool:${report.tool}`],
  };
}

// ---------------------------------------------------------------------------
// In-memory rate limiter for feedback submissions (IP-based)
// 5 submissions per IP per hour
// ---------------------------------------------------------------------------
const feedbackWindows = new Map<string, number[]>();

function checkFeedbackRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const limit = 5;

  const timestamps = (feedbackWindows.get(ip) ?? []).filter((t) => t > now - windowMs);
  if (timestamps.length >= limit) return false;

  timestamps.push(now);
  feedbackWindows.set(ip, timestamps);
  return true;
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFeedbackRouter(db: Db, authMiddleware?: MiddlewareHandler<any>) {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /api/feedback — public, rate limited
  router.post('/', zv('json', SubmitFeedbackSchema), async (c) => {
    const ip = c.req.header('CF-Connecting-IP')
      ?? c.req.header('X-Forwarded-For')?.split(',')[0]?.trim()
      ?? 'unknown';

    if (!checkFeedbackRateLimit(ip)) {
      throw Errors.rateLimited();
    }

    const body = c.req.valid('json');

    const report: typeof feedbackReports.$inferInsert = {
      id: `fb_${newId()}`,
      type: body.type,
      description: body.description,
      email: body.email ?? null,
      tool: body.tool,
      endpoint: body.endpoint ?? null,
      userAgent: c.req.header('User-Agent')?.slice(0, 512) ?? null,
      metadata: JSON.stringify(body.metadata),
      status: 'open',
      createdAt: new Date(),
    };

    await db.insert(feedbackReports).values(report);

    // Expose the GitHub issue shape — caller can wire up to GitHub API
    const githubIssue = toGitHubIssue({
      ...report,
      tool: report.tool ?? 'unknown',
      metadata: report.metadata ?? '{}',
      createdAt: report.createdAt as Date,
    });

    return created(c, {
      id: report.id,
      type: report.type,
      status: 'open',
      github_issue_shape: githubIssue, // ready to POST to GitHub Issues API
      created_at: (report.createdAt as Date).toISOString(),
    });
  });

  // GET /api/feedback — requires auth
  if (authMiddleware) {
    router.use('/', authMiddleware);
    router.use('/', requireScope('feedback:read'));
  }
  router.get('/', async (c) => {
    // This route is mounted after auth middleware in the main app
    const { page, per_page } = parsePagination(c.req.query() as Record<string, string>);
    const type = c.req.query('type') as string | undefined;
    const status = c.req.query('status') as string | undefined;

    const conditions = [];
    if (type) conditions.push(eq(feedbackReports.type, type));
    if (status) conditions.push(eq(feedbackReports.status, status));

    const { and } = await import('drizzle-orm');

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(feedbackReports)
      .where(whereClause);

    const rows = await db
      .select()
      .from(feedbackReports)
      .where(whereClause)
      .orderBy(desc(feedbackReports.createdAt))
      .limit(per_page)
      .offset((page - 1) * per_page);

    return list(c, rows.map((r) => ({
      id: r.id,
      type: r.type,
      description: r.description,
      email: r.email,
      tool: r.tool,
      endpoint: r.endpoint,
      status: r.status,
      github_issue_number: r.githubIssueNumber,
      github_issue_url: r.githubIssueUrl,
      github_issue_shape: toGitHubIssue({ ...r, tool: r.tool ?? 'unknown', metadata: r.metadata ?? '{}', createdAt: r.createdAt }),
      created_at: r.createdAt.toISOString(),
    })), { total, page, per_page, has_more: page * per_page < total });
  });

  return router;
}

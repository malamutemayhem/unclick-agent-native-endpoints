/**
 * Agent bug reporting - authenticated endpoint for AI agents to self-report
 * errors they encounter while using any UnClick tool.
 *
 * POST /v1/report-bug
 *   Accepts tool_name, error_message, request_payload, expected_behavior,
 *   severity (auto-detected if omitted), and agent_context.
 *   Returns a report_id for tracking.
 *
 * Severity auto-detection:
 *   HTTP 5xx / "internal server error" → critical
 *   timeout / unexpected response format → high
 *   validation / 4xx errors             → medium
 *   everything else                     → low
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { created, newId } from '@unclick/core';
import type { Db } from '../db/index.js';
import { bugReports } from '../db/schema.js';
import { zv } from '../middleware/validate.js';
import type { AppVariables } from '../middleware/types.js';

// ---------------------------------------------------------------------------
// Severity auto-detection
// ---------------------------------------------------------------------------
const SEVERITY_VALUES = ['critical', 'high', 'medium', 'low'] as const;
type Severity = typeof SEVERITY_VALUES[number];

function detectSeverity(errorMessage: string): Severity {
  const msg = errorMessage.toLowerCase();
  if (
    msg.includes('500') ||
    msg.includes('internal server error') ||
    msg.includes('http 5')
  ) return 'critical';
  if (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('unexpected response') ||
    msg.includes('invalid response format') ||
    msg.includes('parse error') ||
    msg.includes('502') ||
    msg.includes('503')
  ) return 'high';
  if (
    msg.includes('validation') ||
    msg.includes('invalid') ||
    msg.includes('400') ||
    msg.includes('422') ||
    msg.includes('unprocessable')
  ) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------
const ReportBugSchema = z.object({
  tool_name: z.string().min(1).max(128),
  error_message: z.string().min(1).max(4000),
  request_payload: z.record(z.unknown()).default({}),
  expected_behavior: z.string().max(2000).optional(),
  severity: z.enum(SEVERITY_VALUES).optional(),
  agent_context: z.record(z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Email notification via Resend
// ---------------------------------------------------------------------------

async function sendBugEmail(params: {
  tool_name: string;
  error_message: string;
  severity: string;
  expected_behavior?: string | null;
  agent_context?: string | null;
  created_at: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('RESEND_API_KEY not set - skipping bug notification email');
    return;
  }

  const { tool_name, error_message, severity, expected_behavior, agent_context, created_at } = params;

  const body = [
    `Tool: ${tool_name}`,
    `Severity: ${severity.toUpperCase()}`,
    `Timestamp: ${created_at}`,
    ``,
    `Error:`,
    error_message,
    expected_behavior ? `\nExpected Behavior:\n${expected_behavior}` : '',
    agent_context ? `\nAgent Context:\n${agent_context}` : '',
  ].filter(Boolean).join('\n');

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'UnClick Bugs <bugs@unclick.world>',
      to: ['creativelead@malamutemayhem.com'],
      subject: `[UnClick Bug] ${severity.toUpperCase()}: ${tool_name}`,
      text: body,
    }),
  }).catch((err) => {
    console.error('Failed to send bug notification email:', err);
  });
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------
export function createReportBugRouter(db: Db) {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /v1/report-bug
  // Auth is applied globally on /v1/* - any valid API key can report bugs.
  router.post('/', zv('json', ReportBugSchema), async (c) => {
    const org = c.get('org');
    const body = c.req.valid('json');

    const severity: Severity = body.severity ?? detectSeverity(body.error_message);

    const report: typeof bugReports.$inferInsert = {
      id: `bug_${newId()}`,
      apiKey: org.keyId,
      orgId: org.orgId,
      toolName: body.tool_name,
      errorMessage: body.error_message,
      requestPayload: JSON.stringify(body.request_payload),
      expectedBehavior: body.expected_behavior ?? null,
      severity,
      status: 'new',
      agentContext: body.agent_context ? JSON.stringify(body.agent_context) : null,
      createdAt: new Date(),
    };

    await db.insert(bugReports).values(report);

    const createdAt = (report.createdAt as Date).toISOString();

    // Fire-and-forget email — don't block the response
    sendBugEmail({
      tool_name: report.toolName,
      error_message: report.errorMessage,
      severity,
      expected_behavior: report.expectedBehavior,
      agent_context: report.agentContext,
      created_at: createdAt,
    });

    return created(c, {
      report_id: report.id,
      tool_name: report.toolName,
      severity,
      status: 'new',
      created_at: createdAt,
      message: 'Bug report received. The UnClick team will investigate.',
    });
  });

  return router;
}

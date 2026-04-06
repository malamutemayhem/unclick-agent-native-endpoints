import { createMiddleware } from 'hono/factory';
import { Errors } from '@unclick/core';
import type { AppVariables } from './types.js';

/**
 * In-memory sliding window rate limiter for local dev.
 * Production would swap this for Upstash Redis.
 *
 * Limits per plan:
 *   free: 60 req/min
 *   pro:  300 req/min
 *   team: 1000 req/min
 */

const PLAN_LIMITS: Record<string, number> = {
  free: 60,
  pro: 300,
  team: 1000,
};

// Map<orgId, timestamps[]>
const windows = new Map<string, number[]>();

function checkRateLimit(orgId: string, limit: number): {
  allowed: boolean;
  remaining: number;
  reset: number;
} {
  const now = Date.now();
  const windowMs = 60_000;
  const cutoff = now - windowMs;

  const timestamps = (windows.get(orgId) ?? []).filter((t) => t > cutoff);
  const reset = Math.ceil((now + windowMs) / 1000);

  if (timestamps.length >= limit) {
    return { allowed: false, remaining: 0, reset };
  }

  timestamps.push(now);
  windows.set(orgId, timestamps);

  return { allowed: true, remaining: limit - timestamps.length, reset };
}

export const rateLimit = createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
  const org = c.get('org');
  if (!org) {
    await next();
    return;
  }

  const limit = PLAN_LIMITS[org.plan] ?? PLAN_LIMITS.free;
  const { allowed, remaining, reset } = checkRateLimit(org.orgId, limit);

  c.header('X-RateLimit-Limit', String(limit));
  c.header('X-RateLimit-Remaining', String(remaining));
  c.header('X-RateLimit-Reset', String(reset));

  if (!allowed) {
    c.header('Retry-After', String(reset - Math.floor(Date.now() / 1000)));
    throw Errors.rateLimited();
  }

  await next();
});

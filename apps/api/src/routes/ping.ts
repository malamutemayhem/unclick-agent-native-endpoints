/**
 * UnClick Ping — URL uptime & health checker.
 *
 * All endpoints sit under /v1/* and inherit the global auth + rate-limit
 * middleware; no database access is needed.
 *
 * Scope: ping:use
 *
 *   POST /v1/ping/check — check a single URL; returns status, latency, SSL, redirects
 *   POST /v1/ping/batch — check up to 10 URLs concurrently
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { ok, Errors } from '@unclick/core';
import { zv } from '../middleware/validate.js';
import { requireScope } from '../middleware/auth.js';
import type { AppVariables } from '../middleware/types.js';
import * as https from 'node:https';
import * as tls from 'node:tls';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CheckSchema = z.object({
  url: z.string().url(),
  timeout_ms: z.number().int().min(500).max(30_000).default(10_000),
  follow_redirects: z.boolean().default(true),
});

const BatchSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(10),
  timeout_ms: z.number().int().min(500).max(30_000).default(10_000),
});

// ---------------------------------------------------------------------------
// SSL certificate helper — connects via TLS and reads the peer certificate
// ---------------------------------------------------------------------------

interface SslInfo {
  valid: boolean;
  issuer: string | null;
  subject: string | null;
  expires_at: string | null;
  days_remaining: number | null;
  error: string | null;
}

async function getSslInfo(hostname: string, port: number, timeoutMs: number): Promise<SslInfo> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host: hostname, port, servername: hostname, rejectUnauthorized: false },
      () => {
        try {
          const cert = socket.getPeerCertificate();
          socket.destroy();
          if (!cert || !cert.valid_to) {
            resolve({ valid: false, issuer: null, subject: null, expires_at: null, days_remaining: null, error: 'No certificate returned' });
            return;
          }
          const expiresAt = new Date(cert.valid_to);
          const daysRemaining = Math.floor((expiresAt.getTime() - Date.now()) / 86_400_000);
          const issuer = cert.issuer
            ? Object.entries(cert.issuer).map(([k, v]) => `${k}=${v}`).join(', ')
            : null;
          const subject = cert.subject
            ? Object.entries(cert.subject).map(([k, v]) => `${k}=${v}`).join(', ')
            : null;
          resolve({
            valid: daysRemaining > 0,
            issuer,
            subject,
            expires_at: expiresAt.toISOString(),
            days_remaining: daysRemaining,
            error: null,
          });
        } catch (e) {
          socket.destroy();
          resolve({ valid: false, issuer: null, subject: null, expires_at: null, days_remaining: null, error: String(e) });
        }
      },
    );
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      resolve({ valid: false, issuer: null, subject: null, expires_at: null, days_remaining: null, error: 'TLS connect timed out' });
    });
    socket.on('error', (err) => {
      socket.destroy();
      resolve({ valid: false, issuer: null, subject: null, expires_at: null, days_remaining: null, error: err.message });
    });
  });
}

// ---------------------------------------------------------------------------
// Core check logic
// ---------------------------------------------------------------------------

interface PingResult {
  url: string;
  status_code: number | null;
  response_time_ms: number;
  content_type: string | null;
  redirect_chain: string[];
  ssl: SslInfo | null;
  error: string | null;
  up: boolean;
}

async function checkUrl(url: string, timeoutMs: number, followRedirects: boolean): Promise<PingResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      url,
      status_code: null,
      response_time_ms: 0,
      content_type: null,
      redirect_chain: [],
      ssl: null,
      error: 'Invalid URL',
      up: false,
    };
  }

  const isHttps = parsed.protocol === 'https:';
  const redirectChain: string[] = [];
  const start = Date.now();

  // SSL info (only for HTTPS targets)
  let ssl: SslInfo | null = null;
  if (isHttps) {
    const port = parsed.port ? Number(parsed.port) : 443;
    ssl = await getSslInfo(parsed.hostname, port, Math.min(timeoutMs, 5_000));
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: followRedirects ? 'follow' : 'manual',
        headers: { 'User-Agent': 'UnClickPing/1.0 (+https://unclick.dev; uptime checker)' },
      });
    } finally {
      clearTimeout(timer);
    }

    const responseTimeMs = Date.now() - start;

    // Collect redirect chain — fetch follows automatically; we record final URL if it changed
    if (followRedirects && res.url !== url) {
      redirectChain.push(res.url);
    }

    const contentType = res.headers.get('content-type');
    const statusCode = res.status;

    // Drain body to avoid hanging connections
    await res.body?.cancel().catch(() => {});

    return {
      url: res.url,
      status_code: statusCode,
      response_time_ms: responseTimeMs,
      content_type: contentType,
      redirect_chain: redirectChain,
      ssl,
      error: null,
      up: statusCode >= 200 && statusCode < 400,
    };
  } catch (err: unknown) {
    const responseTimeMs = Date.now() - start;
    if (err instanceof Error && err.name === 'AbortError') {
      return { url, status_code: null, response_time_ms: responseTimeMs, content_type: null, redirect_chain: redirectChain, ssl, error: `Timed out after ${timeoutMs}ms`, up: false };
    }
    return { url, status_code: null, response_time_ms: responseTimeMs, content_type: null, redirect_chain: redirectChain, ssl, error: err instanceof Error ? err.message : String(err), up: false };
  }
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createPingRouter() {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /ping/check
  router.post('/check', requireScope('ping:use'), zv('json', CheckSchema), async (c) => {
    const { url, timeout_ms, follow_redirects } = c.req.valid('json');
    const result = await checkUrl(url, timeout_ms, follow_redirects);
    return ok(c, result);
  });

  // POST /ping/batch
  router.post('/batch', requireScope('ping:use'), zv('json', BatchSchema), async (c) => {
    const { urls, timeout_ms } = c.req.valid('json');
    const results = await Promise.all(
      urls.map((url) => checkUrl(url, timeout_ms, true)),
    );
    const up = results.filter((r) => r.up).length;
    return ok(c, {
      total: results.length,
      up,
      down: results.length - up,
      results,
    });
  });

  return router;
}

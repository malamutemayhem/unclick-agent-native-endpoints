/**
 * UnClick OG — Open Graph & meta tag extraction utility.
 *
 * All endpoints sit under /v1/* and inherit the global auth + rate-limit
 * middleware; no database access is needed.
 *
 * Scope: og:use
 *
 *   POST /v1/og/extract — scrape OG / Twitter Card / standard meta tags from a URL
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { ok, Errors } from '@unclick/core';
import { zv } from '../middleware/validate.js';
import { requireScope } from '../middleware/auth.js';
import type { AppVariables } from '../middleware/types.js';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const ExtractSchema = z.object({
  url: z.string().url(),
  timeout_ms: z.number().int().min(500).max(15_000).default(8_000),
});

// ---------------------------------------------------------------------------
// HTML meta-tag extraction helpers
// ---------------------------------------------------------------------------

function extractMeta(html: string) {
  const og: Record<string, string> = {};
  const twitter: Record<string, string> = {};
  const meta: Record<string, string> = {};

  // Grab every <meta ... > tag (self-closing or not)
  const metaTagRe = /<meta\s+([^>]*?)(?:\s*\/?>)/gi;
  let m: RegExpExecArray | null;

  while ((m = metaTagRe.exec(html)) !== null) {
    const attrs = m[1] ?? '';

    // Extract attribute key=value pairs (handles single/double quotes and unquoted)
    const attrRe = /(\w[\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))/gi;
    const parsed: Record<string, string> = {};
    let a: RegExpExecArray | null;
    while ((a = attrRe.exec(attrs)) !== null) {
      const key = (a[1] ?? '').toLowerCase();
      const val = a[2] ?? a[3] ?? a[4] ?? '';
      parsed[key] = val;
    }

    const property = parsed['property'] ?? '';
    const name = parsed['name'] ?? '';
    const content = parsed['content'] ?? '';

    if (property.startsWith('og:')) {
      og[property.slice(3)] = content;
    } else if (property.startsWith('twitter:') || name.startsWith('twitter:')) {
      const tKey = (property || name).replace(/^twitter:/, '');
      twitter[tKey] = content;
    } else if (name) {
      meta[name] = content;
    }
  }

  // Fallback: extract <title>
  const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  const htmlTitle = titleMatch ? titleMatch[1]?.trim() ?? null : null;

  return { og, twitter, meta, htmlTitle };
}

function extractFavicon(html: string, baseUrl: string): string | null {
  const re = /<link\s+[^>]*rel=["']?(?:shortcut\s+)?icon["']?[^>]*href=["']?([^"'\s>]+)["']?/i;
  const m = re.exec(html);
  if (!m) return null;
  const href = m[1] ?? '';
  if (href.startsWith('http')) return href;
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createOgRouter() {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /og/extract
  router.post('/extract', requireScope('og:use'), zv('json', ExtractSchema), async (c) => {
    const { url, timeout_ms } = c.req.valid('json');

    let html: string;
    let finalUrl: string;
    let statusCode: number;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout_ms);
      let res: Response;
      try {
        res = await fetch(url, {
          signal: controller.signal,
          redirect: 'follow',
          headers: {
            'User-Agent': 'UnClickBot/1.0 (+https://unclick.dev; OG metadata reader)',
            'Accept': 'text/html,application/xhtml+xml',
          },
        });
      } finally {
        clearTimeout(timer);
      }

      finalUrl = res.url;
      statusCode = res.status;

      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        throw Errors.validation(
          `URL did not return HTML (content-type: ${contentType}). OG extraction requires an HTML page.`,
        );
      }

      // Read at most 512 KB to avoid memory blowout on huge pages
      const buffer = await res.arrayBuffer();
      html = new TextDecoder().decode(buffer.slice(0, 512 * 1024));
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw Errors.validation(`Request timed out after ${timeout_ms}ms`);
      }
      if (err instanceof Error && (err as { code?: string }).code === 'ERR_INVALID_URL') {
        throw Errors.validation('Invalid URL');
      }
      // Re-throw AppErrors (validation errors we threw above)
      if (err && typeof err === 'object' && 'statusCode' in err) throw err;
      throw Errors.validation(`Failed to fetch URL: ${err instanceof Error ? err.message : String(err)}`);
    }

    const { og, twitter, meta, htmlTitle } = extractMeta(html);
    const favicon = extractFavicon(html, finalUrl);

    return ok(c, {
      url: finalUrl,
      original_url: url,
      status_code: statusCode,
      open_graph: {
        title: og['title'] ?? null,
        description: og['description'] ?? null,
        image: og['image'] ?? null,
        image_width: og['image:width'] ? Number(og['image:width']) : null,
        image_height: og['image:height'] ? Number(og['image:height']) : null,
        type: og['type'] ?? null,
        site_name: og['site_name'] ?? null,
        url: og['url'] ?? null,
        locale: og['locale'] ?? null,
      },
      twitter_card: {
        card: twitter['card'] ?? null,
        title: twitter['title'] ?? null,
        description: twitter['description'] ?? null,
        image: twitter['image'] ?? null,
        site: twitter['site'] ?? null,
        creator: twitter['creator'] ?? null,
      },
      meta: {
        title: htmlTitle,
        description: meta['description'] ?? null,
        keywords: meta['keywords'] ?? null,
        author: meta['author'] ?? null,
        robots: meta['robots'] ?? null,
        canonical: (() => {
          const re = /<link\s+[^>]*rel=["']?canonical["']?[^>]*href=["']?([^"'\s>]+)["']?/i;
          return re.exec(html)?.[1] ?? null;
        })(),
        favicon,
        viewport: meta['viewport'] ?? null,
        theme_color: meta['theme-color'] ?? null,
      },
    });
  });

  return router;
}

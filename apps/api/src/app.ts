import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AppError, newId } from '@unclick/core';
import { getDb } from './db/index.js';
import { requestId } from './middleware/request-id.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { rateLimit } from './middleware/rate-limit.js';
import { handleError } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';
import { createPagesRouter } from './routes/links/pages.js';
import { createLinksRouter } from './routes/links/links.js';
import { createAnalyticsRouter } from './routes/links/analytics.js';
import { createThemesRouter } from './routes/links/themes.js';
import { createSocialsRouter } from './routes/links/socials.js';
import { createDomainsRouter } from './routes/links/domains.js';
import { createWebhooksRouter } from './routes/webhooks.js';
import { createApiKeysRouter } from './routes/api-keys.js';
import { createFeedbackRouter } from './routes/feedback.js';
import { createSchedulesRouter } from './routes/scheduling/schedules.js';
import { createEventTypesRouter } from './routes/scheduling/event-types.js';
import { createBookingsRouter, createPublicBookingRouter } from './routes/scheduling/bookings.js';
import { createCalendarRouter } from './routes/scheduling/calendar.js';
import { createSolveRouter } from './routes/solve.js';
import { createHashRouter } from './routes/hash.js';
import { createEncodeRouter } from './routes/encode.js';
import type { AppVariables } from './middleware/types.js';

// ---------------------------------------------------------------------------
// IP-based rate limiter for public page view endpoint
// 60 requests per minute per IP
// ---------------------------------------------------------------------------
const pageViewWindows = new Map<string, number[]>();
function checkPageViewRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const limit = 60;
  const timestamps = (pageViewWindows.get(ip) ?? []).filter((t) => t > now - windowMs);
  if (timestamps.length >= limit) return false;
  timestamps.push(now);
  pageViewWindows.set(ip, timestamps);
  return true;
}

export function createApp() {
  const db = getDb();
  const auth = createAuthMiddleware(db);

  const app = new Hono<{ Variables: AppVariables }>();

  // -------------------------------------------------------------------------
  // Global middleware
  // -------------------------------------------------------------------------
  app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'X-API-Version'],
    exposeHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  }));
  app.use('*', requestId);

  // -------------------------------------------------------------------------
  // Public routes (no auth)
  // -------------------------------------------------------------------------
  app.route('/health', healthRouter);

  // Public link-page render endpoint — returns structured JSON for any consumer
  app.get('/v1/p/:slug', async (c) => {
    const ip = c.req.header('CF-Connecting-IP')
      ?? c.req.header('X-Forwarded-For')?.split(',')[0]?.trim()
      ?? 'unknown';
    if (!checkPageViewRateLimit(ip)) {
      return c.json({ error: { code: 'rate_limited', message: 'Too many requests' } }, 429);
    }

    const { slug } = c.req.param();
    const { linkPages, links, socialLinks } = await import('./db/schema.js');
    const { eq, and, isNull, asc } = await import('drizzle-orm');

    const [page] = await db
      .select()
      .from(linkPages)
      .where(and(eq(linkPages.slug, slug), isNull(linkPages.deletedAt)))
      .limit(1);

    if (!page) return c.json({ error: { code: 'not_found', message: 'Page not found' } }, 404);

    const pageLinks = await db
      .select()
      .from(links)
      .where(and(eq(links.pageId, page.id), eq(links.active, true)))
      .orderBy(asc(links.position));

    const socials = await db
      .select()
      .from(socialLinks)
      .where(eq(socialLinks.pageId, page.id))
      .orderBy(asc(socialLinks.position));

    return c.json({
      data: {
        id: page.id,
        slug: page.slug,
        title: page.title,
        bio: page.bio,
        avatar_url: page.avatarUrl,
        theme_id: page.themeId,
        theme_overrides: JSON.parse(page.themeOverrides ?? '{}'),
        seo: {
          title: page.seoTitle,
          description: page.seoDescription,
          og_image_url: page.seoOgImage,
        },
        sensitive: page.sensitive,
        links: pageLinks.map((l) => ({
          id: l.id,
          title: l.title,
          url: l.url,
          thumbnail_url: l.thumbnailUrl,
          position: l.position,
          highlight: l.highlight,
        })),
        socials: socials.map((s) => ({
          platform: s.platform,
          url: s.url,
        })),
        published_at: page.publishedAt?.toISOString() ?? null,
      },
    });
  });

  // -------------------------------------------------------------------------
  // Feedback — POST is public, GET requires auth
  // -------------------------------------------------------------------------
  const feedbackRouter = createFeedbackRouter(db, auth);
  app.route('/api/feedback', feedbackRouter);

  // -------------------------------------------------------------------------
  // Solve API — mixed public/authenticated endpoints, mounted before global
  // auth so public routes don't require a token; auth is applied inline.
  // -------------------------------------------------------------------------
  const solveRouter = createSolveRouter(db, auth);
  app.route('/v1/solve', solveRouter);

  // -------------------------------------------------------------------------
  // Public scheduling endpoints — must be before auth middleware
  // Rate limited by IP (30 req/min)
  // -------------------------------------------------------------------------
  const schedulePublicWindows = new Map<string, number[]>();
  function checkScheduleRateLimit(ip: string): boolean {
    const now = Date.now();
    const windowMs = 60_000;
    const limit = 30;
    const timestamps = (schedulePublicWindows.get(ip) ?? []).filter((t) => t > now - windowMs);
    if (timestamps.length >= limit) return false;
    timestamps.push(now);
    schedulePublicWindows.set(ip, timestamps);
    return true;
  }

  const publicBookingRouter = createPublicBookingRouter(db);
  app.use('/v1/schedule/*', async (c, next) => {
    const ip = c.req.header('CF-Connecting-IP')
      ?? c.req.header('X-Forwarded-For')?.split(',')[0]?.trim()
      ?? 'unknown';
    if (!checkScheduleRateLimit(ip)) {
      return c.json({ error: { code: 'rate_limited', message: 'Too many requests' } }, 429);
    }
    await next();
  });
  app.route('/v1/schedule', publicBookingRouter);

  // -------------------------------------------------------------------------
  // Public click tracking — must be before auth middleware
  // Looks up the page's org_id from DB; never trusts the request body for it
  // -------------------------------------------------------------------------
  app.post('/track/:page_id/click', async (c) => {
    const { page_id: pageId } = c.req.param();
    const body = await c.req.json().catch(() => ({}));

    if (!body.link_id) return c.json({ error: 'link_id required' }, 400);

    const { linkPages, linkClicks, links } = await import('./db/schema.js');
    const { eq, and, isNull } = await import('drizzle-orm');

    // Look up the page to get org_id — never trust body for this
    const [page] = await db
      .select({ orgId: linkPages.orgId })
      .from(linkPages)
      .where(and(eq(linkPages.id, pageId), isNull(linkPages.deletedAt)))
      .limit(1);

    if (!page) return c.json({ error: { code: 'not_found', message: 'Page not found' } }, 404);

    // Verify the link belongs to this page — prevents cross-page click injection
    const [link] = await db
      .select({ id: links.id })
      .from(links)
      .where(and(eq(links.id, body.link_id), eq(links.pageId, pageId)))
      .limit(1);

    if (!link) return c.json({ error: { code: 'not_found', message: 'Link not found' } }, 404);

    const userAgent = c.req.header('User-Agent') ?? '';
    const deviceType = /Mobile|Android|iPhone/i.test(userAgent) ? 'mobile'
      : /Tablet|iPad/i.test(userAgent) ? 'tablet' : 'desktop';

    await db.insert(linkClicks).values({
      id: `clk_${newId()}`,
      linkId: body.link_id,
      pageId,
      orgId: page.orgId,
      referrer: c.req.header('Referer') ?? null,
      country: c.req.header('CF-IPCountry') ?? null,
      deviceType,
      userAgent: userAgent.slice(0, 512),
      createdAt: new Date(),
    });

    return c.json({ ok: true });
  });

  // -------------------------------------------------------------------------
  // Authenticated routes
  // -------------------------------------------------------------------------
  app.use('/v1/*', auth);
  app.use('/v1/*', rateLimit);

  // API key management
  app.route('/v1/keys', createApiKeysRouter(db));

  // Webhook management
  app.route('/v1/webhooks', createWebhooksRouter(db));

  // Themes (read-only — anyone with a valid key can list themes)
  const themesRouter = createThemesRouter(db);
  app.route('/v1/themes', themesRouter);

  // Link-in-bio pages
  const pagesRouter = createPagesRouter(db);
  app.route('/v1/links/pages', pagesRouter);

  // Links — nested under pages
  const linksRouter = createLinksRouter(db);
  app.route('/v1/links/pages/:page_id/links', linksRouter);

  // Analytics — nested under pages
  const analyticsRouter = createAnalyticsRouter(db);
  app.route('/v1/links/pages/:page_id/analytics', analyticsRouter);

  // Per-link analytics at a different path
  app.route('/v1/links/pages/:page_id/links/:link_id', analyticsRouter);

  // Socials
  const socialsRouter = createSocialsRouter(db);
  app.route('/v1/links/pages/:page_id/socials', socialsRouter);

  // Custom domains
  const domainsRouter = createDomainsRouter(db);
  app.route('/v1/links/pages/:page_id/domain', domainsRouter);

  // Theme application per page
  const pageThemeRouter = createThemesRouter(db);
  app.route('/v1/links/pages/:page_id/theme', pageThemeRouter);

  // -------------------------------------------------------------------------
  // Scheduling API (authenticated)
  // -------------------------------------------------------------------------
  app.route('/v1/scheduling/schedules', createSchedulesRouter(db));
  app.route('/v1/scheduling/event-types', createEventTypesRouter(db));
  app.route('/v1/scheduling/bookings', createBookingsRouter(db));
  app.route('/v1/scheduling/calendar', createCalendarRouter(db));

  // -------------------------------------------------------------------------
  // Hash utility (stateless)
  // -------------------------------------------------------------------------
  app.route('/v1/hash', createHashRouter());

  // -------------------------------------------------------------------------
  // Encode/decode utility (stateless)
  // -------------------------------------------------------------------------
  app.route('/v1', createEncodeRouter());

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------
  app.onError(handleError);

  app.notFound((c) => {
    return c.json({
      error: { code: 'not_found', message: `Route ${c.req.method} ${c.req.path} not found` },
      meta: { request_id: c.get('requestId') ?? 'unknown' },
    }, 404);
  });

  return app;
}

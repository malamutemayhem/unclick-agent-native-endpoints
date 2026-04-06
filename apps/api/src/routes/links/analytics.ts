import { Hono } from 'hono';
import { z } from 'zod';
import { zv } from '../../middleware/validate.js';
import { eq, and, isNull, gte, lte, sql, count } from 'drizzle-orm';
import { ok, Errors } from '@unclick/core';
import type { Db } from '../../db/index.js';
import { linkPages, linkClicks, pageViews, analyticsDaily, links } from '../../db/schema.js';
import type { AppVariables } from '../../middleware/types.js';
import { requireScope } from '../../middleware/auth.js';

const PeriodSchema = z.object({
  period: z.enum(['24h', '7d', '30d', '90d', 'custom']).default('30d'),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  granularity: z.enum(['hour', 'day', 'week']).default('day'),
});

function periodToDates(period: string, start?: string, end?: string): { start: Date; end: Date } {
  const now = new Date();
  if (period === 'custom' && start && end) {
    return { start: new Date(start), end: new Date(end) };
  }
  const days = period === '24h' ? 1 : period === '7d' ? 7 : period === '90d' ? 90 : 30;
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);
  return { start: startDate, end: now };
}

async function assertPageOwnership(db: Db, pageId: string, orgId: string) {
  const [page] = await db
    .select({ id: linkPages.id })
    .from(linkPages)
    .where(and(eq(linkPages.id, pageId), eq(linkPages.orgId, orgId), isNull(linkPages.deletedAt)))
    .limit(1);
  if (!page) throw Errors.notFound('Page not found');
}

export function createAnalyticsRouter(db: Db) {
  const router = new Hono<{ Variables: AppVariables }>();

  // GET /pages/:page_id/analytics — summary
  router.get('/', requireScope('links:read'), zv('query', PeriodSchema), async (c) => {
    const { orgId } = c.get('org');
    const pageId = c.req.param('page_id') as string;
    const query = c.req.valid('query');

    await assertPageOwnership(db, pageId, orgId);

    const { start, end } = periodToDates(query.period, query.start_date, query.end_date);

    // Total views
    const [viewsResult] = await db
      .select({ total: count() })
      .from(pageViews)
      .where(and(eq(pageViews.pageId, pageId), gte(pageViews.createdAt, start), lte(pageViews.createdAt, end)));

    // Unique visitors (distinct ip_hash)
    const uniqueVisitorsResult = await db
      .select({ ip_hash: pageViews.ipHash })
      .from(pageViews)
      .where(and(eq(pageViews.pageId, pageId), gte(pageViews.createdAt, start), lte(pageViews.createdAt, end)));
    const uniqueVisitors = new Set(uniqueVisitorsResult.map((r) => r.ip_hash).filter(Boolean)).size;

    // Total clicks
    const [clicksResult] = await db
      .select({ total: count() })
      .from(linkClicks)
      .where(and(eq(linkClicks.pageId, pageId), gte(linkClicks.createdAt, start), lte(linkClicks.createdAt, end)));

    const totalViews = viewsResult?.total ?? 0;
    const totalClicks = clicksResult?.total ?? 0;
    const ctr = totalViews > 0 ? totalClicks / totalViews : 0;

    // Top links by clicks
    const topLinksRaw = await db
      .select({ link_id: linkClicks.linkId, clicks: count() })
      .from(linkClicks)
      .where(and(eq(linkClicks.pageId, pageId), gte(linkClicks.createdAt, start), lte(linkClicks.createdAt, end)))
      .groupBy(linkClicks.linkId)
      .orderBy(sql`count(*) DESC`)
      .limit(10);

    // Fetch titles for top links
    const topLinks = await Promise.all(
      topLinksRaw.map(async (r) => {
        const [link] = await db.select({ title: links.title }).from(links).where(eq(links.id, r.link_id)).limit(1);
        return { id: r.link_id, title: link?.title ?? 'Unknown', clicks: r.clicks };
      }),
    );

    // Top referrers
    const referrersRaw = await db
      .select({ referrer: pageViews.referrer, visits: count() })
      .from(pageViews)
      .where(and(eq(pageViews.pageId, pageId), gte(pageViews.createdAt, start), lte(pageViews.createdAt, end)))
      .groupBy(pageViews.referrer)
      .orderBy(sql`count(*) DESC`)
      .limit(10);

    const topReferrers = referrersRaw
      .filter((r) => r.referrer)
      .map((r) => ({ source: r.referrer!, visits: r.visits }));

    return ok(c, {
      period: { start: start.toISOString(), end: end.toISOString() },
      total_views: totalViews,
      unique_visitors: uniqueVisitors,
      total_clicks: totalClicks,
      click_through_rate: Math.round(ctr * 1000) / 1000,
      top_links: topLinks,
      top_referrers: topReferrers,
    });
  });

  // GET /pages/:page_id/analytics/timeseries
  router.get('/timeseries', requireScope('links:read'), zv('query', PeriodSchema), async (c) => {
    const { orgId } = c.get('org');
    const pageId = c.req.param('page_id') as string;
    const query = c.req.valid('query');

    await assertPageOwnership(db, pageId, orgId);

    const { start, end } = periodToDates(query.period, query.start_date, query.end_date);

    // Build daily buckets between start and end
    const rows = await db
      .select()
      .from(analyticsDaily)
      .where(
        and(
          eq(analyticsDaily.pageId, pageId),
          isNull(analyticsDaily.linkId),
          gte(analyticsDaily.date, start.toISOString().slice(0, 10)),
          lte(analyticsDaily.date, end.toISOString().slice(0, 10)),
        ),
      )
      .orderBy(analyticsDaily.date);

    return ok(c, {
      period: { start: start.toISOString(), end: end.toISOString() },
      granularity: query.granularity,
      data: rows.map((r) => ({
        date: r.date,
        views: r.views,
        unique_visitors: r.uniqueVisitors,
        clicks: r.clicks,
        click_through_rate: r.clickThroughRate,
      })),
    });
  });

  // GET /pages/:page_id/analytics/referrers
  router.get('/referrers', requireScope('links:read'), zv('query', PeriodSchema), async (c) => {
    const { orgId } = c.get('org');
    const pageId = c.req.param('page_id') as string;
    const query = c.req.valid('query');

    await assertPageOwnership(db, pageId, orgId);

    const { start, end } = periodToDates(query.period, query.start_date, query.end_date);

    const rows = await db
      .select({ referrer: pageViews.referrer, visits: count() })
      .from(pageViews)
      .where(and(eq(pageViews.pageId, pageId), gte(pageViews.createdAt, start), lte(pageViews.createdAt, end)))
      .groupBy(pageViews.referrer)
      .orderBy(sql`count(*) DESC`)
      .limit(50);

    return ok(c, rows.map((r) => ({ source: r.referrer ?? 'direct', visits: r.visits })));
  });

  // GET /pages/:page_id/analytics/countries
  router.get('/countries', requireScope('links:read'), zv('query', PeriodSchema), async (c) => {
    const { orgId } = c.get('org');
    const pageId = c.req.param('page_id') as string;
    const query = c.req.valid('query');

    await assertPageOwnership(db, pageId, orgId);

    const { start, end } = periodToDates(query.period, query.start_date, query.end_date);

    const rows = await db
      .select({ country: linkClicks.country, clicks: count() })
      .from(linkClicks)
      .where(and(eq(linkClicks.pageId, pageId), gte(linkClicks.createdAt, start), lte(linkClicks.createdAt, end)))
      .groupBy(linkClicks.country)
      .orderBy(sql`count(*) DESC`)
      .limit(50);

    return ok(c, rows.map((r) => ({ country: r.country ?? 'unknown', clicks: r.clicks })));
  });

  // GET /pages/:page_id/analytics/devices
  router.get('/devices', requireScope('links:read'), zv('query', PeriodSchema), async (c) => {
    const { orgId } = c.get('org');
    const pageId = c.req.param('page_id') as string;
    const query = c.req.valid('query');

    await assertPageOwnership(db, pageId, orgId);

    const { start, end } = periodToDates(query.period, query.start_date, query.end_date);

    const rows = await db
      .select({ device_type: linkClicks.deviceType, clicks: count() })
      .from(linkClicks)
      .where(and(eq(linkClicks.pageId, pageId), gte(linkClicks.createdAt, start), lte(linkClicks.createdAt, end)))
      .groupBy(linkClicks.deviceType)
      .orderBy(sql`count(*) DESC`);

    return ok(c, rows.map((r) => ({ device: r.device_type ?? 'unknown', clicks: r.clicks })));
  });

  // GET /pages/:page_id/links/:link_id/analytics
  router.get('/:link_id/analytics', requireScope('links:read'), zv('query', PeriodSchema), async (c) => {
    const { orgId } = c.get('org');
    const pageId = c.req.param('page_id') as string;
    const linkId = c.req.param('link_id') as string;
    const query = c.req.valid('query');

    await assertPageOwnership(db, pageId, orgId);

    const { start, end } = periodToDates(query.period, query.start_date, query.end_date);

    const [{ total }] = await db
      .select({ total: count() })
      .from(linkClicks)
      .where(and(eq(linkClicks.linkId, linkId), gte(linkClicks.createdAt, start), lte(linkClicks.createdAt, end)));

    const referrers = await db
      .select({ referrer: linkClicks.referrer, clicks: count() })
      .from(linkClicks)
      .where(and(eq(linkClicks.linkId, linkId), gte(linkClicks.createdAt, start), lte(linkClicks.createdAt, end)))
      .groupBy(linkClicks.referrer)
      .orderBy(sql`count(*) DESC`)
      .limit(10);

    return ok(c, {
      link_id: linkId,
      period: { start: start.toISOString(), end: end.toISOString() },
      total_clicks: total,
      referrers: referrers.map((r) => ({ source: r.referrer ?? 'direct', clicks: r.clicks })),
    });
  });

  return router;
}

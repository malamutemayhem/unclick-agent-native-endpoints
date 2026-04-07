/**
 * UnClick Marketplace - tool registry API.
 *
 * Public endpoints (no auth):
 *   GET  /v1/marketplace/tools           - list approved tools
 *   GET  /v1/marketplace/tools/:slug     - tool detail + endpoints
 *   GET  /v1/marketplace/categories      - all categories
 *   GET  /v1/marketplace/search          - full-text search (?q=)
 *   GET  /v1/marketplace/featured        - top-rated + most-used
 *   GET  /v1/marketplace/stats           - aggregate stats
 *
 * Authenticated (API key):
 *   POST /v1/marketplace/tools/:slug/rate - submit a star rating + review
 */
import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { eq, and, desc, asc, sql, ilike, or } from 'drizzle-orm';
import { ok, list, Errors, newId } from '@unclick/core';
import type { Db } from '../db/index.js';
import {
  marketplaceTools,
  marketplaceCategories,
  marketplaceEndpoints,
  marketplaceRatings,
  publishers,
} from '../db/schema.js';
import { zv } from '../middleware/validate.js';
import type { AppVariables } from '../middleware/types.js';
import { requireScope } from '../middleware/auth.js';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const RateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().max(2000).optional(),
});

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatTool(row: typeof marketplaceTools.$inferSelect) {
  return {
    id: row.id,
    slug: row.slug,
    publisher_id: row.publisherId,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    category: row.category,
    icon_url: row.iconUrl ?? null,
    base_url: row.baseUrl,
    is_internal: row.isInternal,
    is_proxied: row.isProxied,
    status: row.status,
    version: row.version,
    total_calls: row.totalCalls,
    monthly_calls: row.monthlyCalls,
    avg_response_ms: row.avgResponseMs ?? null,
    rating: row.rating ?? null,
    rating_count: row.ratingCount,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    published_at: row.publishedAt?.toISOString() ?? null,
  };
}

function formatCategory(row: typeof marketplaceCategories.$inferSelect) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    icon: row.icon,
    tool_count: row.toolCount,
    sort_order: row.sortOrder,
  };
}

function formatEndpoint(row: typeof marketplaceEndpoints.$inferSelect) {
  return {
    id: row.id,
    method: row.method,
    path: row.path,
    summary: row.summary,
    description: row.description,
    request_schema: JSON.parse(row.requestSchema),
    response_schema: JSON.parse(row.responseSchema),
    scopes_required: JSON.parse(row.scopesRequired) as string[],
  };
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMarketplaceRouter(db: Db, authMiddleware: MiddlewareHandler<any>) {
  const router = new Hono<{ Variables: AppVariables }>();

  // =========================================================================
  // PUBLIC ROUTES
  // =========================================================================

  // GET /tools - list all approved tools, filterable by category, paginated
  router.get('/tools', async (c) => {
    const rawPage = Number(c.req.query('page') ?? '1');
    const rawPerPage = Number(c.req.query('per_page') ?? '20');
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const perPage = Number.isFinite(rawPerPage) && rawPerPage > 0 ? Math.min(rawPerPage, 100) : 20;
    const category = c.req.query('category');

    const baseWhere = and(
      eq(marketplaceTools.status, 'approved'),
      category ? eq(marketplaceTools.category, category) : undefined,
    );

    const [countRow] = await db
      .select({ n: sql`count(*)` })
      .from(marketplaceTools)
      .where(baseWhere);

    const total = Number(countRow?.n ?? 0);
    const offset = (page - 1) * perPage;

    const rows = await db
      .select()
      .from(marketplaceTools)
      .where(baseWhere)
      .orderBy(asc(marketplaceTools.name))
      .limit(perPage)
      .offset(offset);

    return list(c, rows.map(formatTool), {
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage),
    });
  });

  // GET /tools/:slug - full tool detail including endpoints
  router.get('/tools/:slug', async (c) => {
    const { slug } = c.req.param();

    const [tool] = await db
      .select()
      .from(marketplaceTools)
      .where(eq(marketplaceTools.slug, slug))
      .limit(1);

    if (!tool) throw Errors.notFound(`Tool "${slug}" not found`);

    const endpoints = await db
      .select()
      .from(marketplaceEndpoints)
      .where(eq(marketplaceEndpoints.toolId, tool.id))
      .orderBy(asc(marketplaceEndpoints.method), asc(marketplaceEndpoints.path));

    const [publisher] = await db
      .select()
      .from(publishers)
      .where(eq(publishers.id, tool.publisherId))
      .limit(1);

    return ok(c, {
      ...formatTool(tool),
      openapi_spec: JSON.parse(tool.openapiSpec),
      endpoints: endpoints.map(formatEndpoint),
      publisher: publisher
        ? {
            id: publisher.id,
            slug: publisher.slug,
            display_name: publisher.displayName,
            website_url: publisher.websiteUrl ?? null,
            avatar_url: publisher.avatarUrl ?? null,
            verified: publisher.verified,
          }
        : null,
    });
  });

  // GET /categories - all categories ordered by sort_order
  router.get('/categories', async (c) => {
    const rows = await db
      .select()
      .from(marketplaceCategories)
      .orderBy(asc(marketplaceCategories.sortOrder));

    return ok(c, rows.map(formatCategory));
  });

  // GET /search?q=... - search tools by name, tagline, or description
  router.get('/search', async (c) => {
    const q = (c.req.query('q') ?? '').trim();
    if (!q) {
      return ok(c, []);
    }

    const pattern = `%${q}%`;
    const rows = await db
      .select()
      .from(marketplaceTools)
      .where(
        and(
          eq(marketplaceTools.status, 'approved'),
          or(
            ilike(marketplaceTools.name, pattern),
            ilike(marketplaceTools.tagline, pattern),
            ilike(marketplaceTools.description, pattern),
          ),
        ),
      )
      .orderBy(asc(marketplaceTools.name))
      .limit(50);

    return ok(c, rows.map(formatTool));
  });

  // GET /featured - top 10 tools by monthly_calls, then by rating
  router.get('/featured', async (c) => {
    const rows = await db
      .select()
      .from(marketplaceTools)
      .where(eq(marketplaceTools.status, 'approved'))
      .orderBy(
        desc(marketplaceTools.monthlyCalls),
        desc(sql`COALESCE(${marketplaceTools.rating}, 0)`),
      )
      .limit(10);

    return ok(c, rows.map(formatTool));
  });

  // GET /stats - aggregate marketplace stats
  router.get('/stats', async (c) => {
    const [toolStats] = await db
      .select({
        total_tools: sql<number>`count(*)`,
        total_calls: sql<number>`sum(${marketplaceTools.totalCalls})`,
        avg_rating: sql<number>`avg(${marketplaceTools.rating})`,
      })
      .from(marketplaceTools)
      .where(eq(marketplaceTools.status, 'approved'));

    const catRows = await db
      .select()
      .from(marketplaceCategories)
      .orderBy(asc(marketplaceCategories.sortOrder));

    return ok(c, {
      total_tools: Number(toolStats?.total_tools ?? 0),
      total_calls: Number(toolStats?.total_calls ?? 0),
      avg_rating: toolStats?.avg_rating ? parseFloat(Number(toolStats.avg_rating).toFixed(2)) : null,
      total_categories: catRows.length,
      categories: catRows.map((r) => ({ slug: r.slug, name: r.name, tool_count: r.toolCount })),
    });
  });

  // =========================================================================
  // AUTHENTICATED ROUTES
  // =========================================================================

  // POST /tools/:slug/rate - submit or update a rating
  router.post('/tools/:slug/rate', authMiddleware, requireScope('marketplace:rate'), zv('json', RateSchema), async (c) => {
    const { slug } = c.req.param();
    const { orgId } = c.get('org');
    const { rating, review } = c.req.valid('json');

    const [tool] = await db
      .select({ id: marketplaceTools.id, ratingCount: marketplaceTools.ratingCount })
      .from(marketplaceTools)
      .where(and(eq(marketplaceTools.slug, slug), eq(marketplaceTools.status, 'approved')))
      .limit(1);

    if (!tool) throw Errors.notFound(`Tool "${slug}" not found`);

    // Upsert rating
    const [existing] = await db
      .select({ id: marketplaceRatings.id })
      .from(marketplaceRatings)
      .where(and(eq(marketplaceRatings.toolId, tool.id), eq(marketplaceRatings.orgId, orgId)))
      .limit(1);

    if (existing) {
      await db
        .update(marketplaceRatings)
        .set({ rating, review: review ?? null })
        .where(eq(marketplaceRatings.id, existing.id));
    } else {
      await db.insert(marketplaceRatings).values({
        id: `mpr_${newId()}`,
        toolId: tool.id,
        orgId,
        rating,
        review: review ?? null,
        createdAt: new Date(),
      });
    }

    // Recalculate average rating from all ratings for this tool
    const [avg] = await db
      .select({
        avg: sql<number>`avg(${marketplaceRatings.rating})`,
        count: sql<number>`count(*)`,
      })
      .from(marketplaceRatings)
      .where(eq(marketplaceRatings.toolId, tool.id));

    await db
      .update(marketplaceTools)
      .set({
        rating: avg?.avg ? parseFloat(Number(avg.avg).toFixed(2)) : null,
        ratingCount: Number(avg?.count ?? 0),
        updatedAt: new Date(),
      })
      .where(eq(marketplaceTools.id, tool.id));

    return ok(c, {
      tool_slug: slug,
      org_id: orgId,
      rating,
      review: review ?? null,
      new_avg: avg?.avg ? parseFloat(Number(avg.avg).toFixed(2)) : null,
      rating_count: Number(avg?.count ?? 0),
    });
  });

  return router;
}

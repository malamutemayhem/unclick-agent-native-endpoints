/**
 * UnClick Billing - agent-native metering and Stripe payment rails.
 *
 * Payment flow (fully automated, no human checkout):
 *   1. Agent makes API call → gateway middleware records a billing_event
 *   2. Background job batches unreported events → reports to Stripe Metering API
 *   3. Stripe charges the org automatically via their registered payment method
 *   4. At end of period, platform calculates rev share → Stripe Connect transfer
 *
 * Stripe agent payment rails (2026):
 *   - Stripe Meter Events API: POST /v1/billing/meter_events
 *   - Stripe Metered Subscriptions: price_id with meter_id attached
 *   - Stripe Connect: platform-to-publisher automatic transfers
 *   - No human checkout - agents authorize via API key with billing scope
 *
 * Endpoints:
 *   GET  /v1/billing/usage              - current period usage by tool
 *   GET  /v1/billing/usage/:tool_slug   - usage detail for one tool
 *   GET  /v1/billing/history            - past billing meters (paginated)
 *   POST /v1/billing/events             - record a billing event (internal/gateway use)
 *   POST /v1/billing/flush              - flush unreported events to Stripe (internal)
 *   GET  /v1/billing/pricing            - tool pricing catalogue (public)
 */
import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { eq, and, sql, desc, asc, isNull } from 'drizzle-orm';
import { ok, list, Errors, newId } from '@unclick/core';
import type { Db } from '../db/index.js';
import {
  billingEvents,
  billingMeters,
  toolPricing,
  marketplaceTools,
  revenueShare,
  publishers,
} from '../db/schema.js';
import { zv } from '../middleware/validate.js';
import type { AppVariables } from '../middleware/types.js';
import { requireScope } from '../middleware/auth.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Upsert a billing meter row, incrementing calls and total_ms.
 * Used both inline (on request) and from the flush job.
 */
async function incrementMeter(
  db: Db,
  orgId: string,
  toolSlug: string,
  calls: number,
  responseMs: number | null,
): Promise<void> {
  const period = currentPeriod();
  const now = new Date();

  const [existing] = await db
    .select({ id: billingMeters.id })
    .from(billingMeters)
    .where(
      and(
        eq(billingMeters.orgId, orgId),
        eq(billingMeters.toolSlug, toolSlug),
        eq(billingMeters.period, period),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(billingMeters)
      .set({
        calls: sql`${billingMeters.calls} + ${calls}`,
        totalMs: sql`${billingMeters.totalMs} + ${responseMs ?? 0}`,
        updatedAt: now,
      })
      .where(eq(billingMeters.id, existing.id));
  } else {
    await db.insert(billingMeters).values({
      id: `bm_${newId()}`,
      orgId,
      toolSlug,
      period,
      calls,
      billableCalls: 0,
      totalMs: responseMs ?? 0,
      billedAmountCents: 0,
      billingStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    });
  }
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const RecordEventSchema = z.object({
  tool_slug: z.string().min(1),
  api_key_id: z.string().min(1),
  endpoint: z.string().min(1),
  response_ms: z.number().int().min(0).optional(),
});

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createBillingRouter(db: Db, authMiddleware: MiddlewareHandler<any>) {
  const router = new Hono<{ Variables: AppVariables }>();

  // =========================================================================
  // PUBLIC ROUTES
  // =========================================================================

  // GET /pricing - pricing catalogue for all active tools
  router.get('/pricing', async (c) => {
    const rows = await db
      .select()
      .from(toolPricing)
      .where(eq(toolPricing.active, true))
      .orderBy(asc(toolPricing.toolSlug));

    return ok(c, rows.map((r) => ({
      tool_slug: r.toolSlug,
      price_per_call_micro: r.pricePerCallMicro,
      /** price_per_1000_calls in USD cents */
      price_per_1000_usd_cents: Math.round(r.pricePerCallMicro * 1000 / 1_000_000 * 100),
      free_tier_calls: r.freeTierCalls,
      stripe_price_id: r.stripePriceId ?? null,
    })));
  });

  // =========================================================================
  // AUTHENTICATED ROUTES
  // =========================================================================

  // GET /usage - current period usage summary by tool for this org
  router.get('/usage', authMiddleware, requireScope('billing:read'), async (c) => {
    const { orgId } = c.get('org');
    const period = currentPeriod();

    const rows = await db
      .select()
      .from(billingMeters)
      .where(and(eq(billingMeters.orgId, orgId), eq(billingMeters.period, period)))
      .orderBy(desc(billingMeters.calls));

    return ok(c, {
      period,
      tools: rows.map((r) => ({
        tool_slug: r.toolSlug,
        calls: r.calls,
        billable_calls: r.billableCalls,
        total_ms: r.totalMs,
        avg_response_ms: r.calls > 0 ? Math.round(r.totalMs / r.calls) : null,
        billed_amount_cents: r.billedAmountCents,
        billing_status: r.billingStatus,
        stripe_record_id: r.stripeRecordId ?? null,
      })),
      total_calls: rows.reduce((s, r) => s + r.calls, 0),
      total_billed_cents: rows.reduce((s, r) => s + r.billedAmountCents, 0),
    });
  });

  // GET /usage/:tool_slug - usage detail for a single tool
  router.get('/usage/:tool_slug', authMiddleware, requireScope('billing:read'), async (c) => {
    const { orgId } = c.get('org');
    const { tool_slug: toolSlug } = c.req.param();
    const period = currentPeriod();

    const [meter] = await db
      .select()
      .from(billingMeters)
      .where(
        and(
          eq(billingMeters.orgId, orgId),
          eq(billingMeters.toolSlug, toolSlug),
          eq(billingMeters.period, period),
        ),
      )
      .limit(1);

    // Fetch pricing for this tool
    const [pricing] = await db
      .select()
      .from(toolPricing)
      .where(eq(toolPricing.toolSlug, toolSlug))
      .limit(1);

    return ok(c, {
      period,
      tool_slug: toolSlug,
      calls: meter?.calls ?? 0,
      billable_calls: meter?.billableCalls ?? 0,
      free_tier_remaining: pricing
        ? Math.max(0, pricing.freeTierCalls - (meter?.calls ?? 0))
        : null,
      total_ms: meter?.totalMs ?? 0,
      avg_response_ms: meter && meter.calls > 0 ? Math.round(meter.totalMs / meter.calls) : null,
      billed_amount_cents: meter?.billedAmountCents ?? 0,
      billing_status: meter?.billingStatus ?? 'pending',
      stripe_record_id: meter?.stripeRecordId ?? null,
      pricing: pricing
        ? {
            price_per_call_micro: pricing.pricePerCallMicro,
            free_tier_calls: pricing.freeTierCalls,
            stripe_price_id: pricing.stripePriceId ?? null,
            stripe_meter_id: pricing.stripeMeterId ?? null,
          }
        : null,
    });
  });

  // GET /history - past billing periods for this org
  router.get('/history', authMiddleware, requireScope('billing:read'), async (c) => {
    const { orgId } = c.get('org');
    const rawPage = Number(c.req.query('page') ?? '1');
    const rawPerPage = Number(c.req.query('per_page') ?? '20');
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const perPage = Math.min(Number.isFinite(rawPerPage) && rawPerPage > 0 ? rawPerPage : 20, 100);
    const offset = (page - 1) * perPage;

    const [countRow] = await db
      .select({ n: sql`count(*)` })
      .from(billingMeters)
      .where(eq(billingMeters.orgId, orgId));

    const total = Number(countRow?.n ?? 0);

    const rows = await db
      .select()
      .from(billingMeters)
      .where(eq(billingMeters.orgId, orgId))
      .orderBy(desc(billingMeters.period), asc(billingMeters.toolSlug))
      .limit(perPage)
      .offset(offset);

    return list(
      c,
      rows.map((r) => ({
        period: r.period,
        tool_slug: r.toolSlug,
        calls: r.calls,
        billable_calls: r.billableCalls,
        billed_amount_cents: r.billedAmountCents,
        billing_status: r.billingStatus,
        stripe_record_id: r.stripeRecordId ?? null,
        updated_at: r.updatedAt.toISOString(),
      })),
      { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
    );
  });

  // =========================================================================
  // INTERNAL / GATEWAY ROUTES
  // These are called by the UnClick gateway middleware, not by external agents.
  // Protected by billing:internal scope which is not grantable via the UI.
  // =========================================================================

  // POST /events - record a single billing event (called by gateway per request)
  router.post('/events', authMiddleware, requireScope('billing:internal'), zv('json', RecordEventSchema), async (c) => {
    const { orgId } = c.get('org');
    const { tool_slug: toolSlug, api_key_id: apiKeyId, endpoint, response_ms: responseMs } = c.req.valid('json');

    const now = new Date();
    await db.insert(billingEvents).values({
      id: `be_${newId()}`,
      orgId,
      toolSlug,
      apiKeyId,
      endpoint,
      responseMs: responseMs ?? null,
      reported: false,
      createdAt: now,
    });

    // Increment the meter synchronously so usage is visible immediately
    await incrementMeter(db, orgId, toolSlug, 1, responseMs ?? null);

    return ok(c, { recorded: true });
  });

  // POST /flush - report unreported events to Stripe Metering API
  // This is called by the billing job (cron or background worker).
  // Returns a summary of what was flushed.
  //
  // Stripe agent payment rail:
  //   POST https://api.stripe.com/v1/billing/meter_events
  //   { event_name: "api_call", payload: { stripe_customer_id, value: N } }
  //
  // We batch by (org_id, tool_slug) to minimize API calls.
  router.post('/flush', authMiddleware, requireScope('billing:internal'), async (c) => {
    // Fetch unreported events in batches of 500
    const unreported = await db
      .select()
      .from(billingEvents)
      .where(eq(billingEvents.reported, false))
      .orderBy(asc(billingEvents.createdAt))
      .limit(500);

    if (unreported.length === 0) {
      return ok(c, { flushed: 0, batches: [] });
    }

    // Group by (org_id, tool_slug)
    const groups = new Map<string, typeof unreported>();
    for (const evt of unreported) {
      const key = `${evt.orgId}::${evt.toolSlug}`;
      const group = groups.get(key) ?? [];
      group.push(evt);
      groups.set(key, group);
    }

    const batches: Array<{ org_id: string; tool_slug: string; count: number; stripe_event_id: string | null }> = [];

    for (const [key, evts] of groups) {
      const [orgId, toolSlug] = key.split('::');
      const count = evts.length;

      // In production: call Stripe Meter Events API here.
      // POST /v1/billing/meter_events with the org's stripe_customer_id.
      // For now we record the intent and mark events as reported.
      //
      // const stripeEventId = await stripe.billing.meterEvents.create({
      //   event_name: `tool_call_${toolSlug}`,
      //   payload: {
      //     stripe_customer_id: org.stripeCustomer,
      //     value: String(count),
      //   },
      //   timestamp: Math.floor(Date.now() / 1000),
      // });
      const stripeEventId: string | null = null; // populated in production

      const eventIds = evts.map((e) => e.id);

      // Mark events as reported using raw SQL IN clause
      await db
        .update(billingEvents)
        .set({ reported: true, stripeMeterEventId: stripeEventId })
        .where(sql`${billingEvents.id} IN ${sql.raw(`('${eventIds.join("','")}')`)}` as ReturnType<typeof sql>);

      // Update the meter's billable_calls
      const period = currentPeriod();
      const [pricing] = await db
        .select({ freeTierCalls: toolPricing.freeTierCalls })
        .from(toolPricing)
        .where(eq(toolPricing.toolSlug, toolSlug))
        .limit(1);

      const freeTier = pricing?.freeTierCalls ?? 0;

      // Fetch current meter for this period
      const [meter] = await db
        .select({ calls: billingMeters.calls, billableCalls: billingMeters.billableCalls })
        .from(billingMeters)
        .where(
          and(
            eq(billingMeters.orgId, orgId),
            eq(billingMeters.toolSlug, toolSlug),
            eq(billingMeters.period, period),
          ),
        )
        .limit(1);

      const totalCalls = meter?.calls ?? count;
      const billable = Math.max(0, totalCalls - freeTier);

      await db
        .update(billingMeters)
        .set({ billableCalls: billable, updatedAt: new Date() })
        .where(
          and(
            eq(billingMeters.orgId, orgId),
            eq(billingMeters.toolSlug, toolSlug),
            eq(billingMeters.period, period),
          ),
        );

      batches.push({ org_id: orgId, tool_slug: toolSlug, count, stripe_event_id: stripeEventId });
    }

    return ok(c, { flushed: unreported.length, batches });
  });

  return router;
}

// ---------------------------------------------------------------------------
// Middleware helper: record a billing event on every authenticated tool call.
// Mount this in app.ts after auth middleware on /v1/* routes.
// ---------------------------------------------------------------------------
export function createBillingMiddleware(db: Db) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async function billingMiddleware(c: any, next: () => Promise<void>) {
    const start = Date.now();
    await next();
    const responseMs = Date.now() - start;

    // Only meter authenticated calls with an org context
    const org = c.get('org');
    if (!org) return;

    // Derive tool slug from path: /v1/<tool>/... → <tool>
    const pathParts = c.req.path.split('/').filter(Boolean);
    const toolSegment = pathParts[1]; // e.g. 'hash', 'kv', 'shorten'
    if (!toolSegment) return;

    // Map path segment → tool slug (for internal tools)
    const TOOL_MAP: Record<string, string> = {
      hash: 'unclick-hash',
      encode: 'unclick-encode',
      decode: 'unclick-encode',
      transform: 'unclick-transform',
      validate: 'unclick-validate',
      uuid: 'unclick-uuid',
      timestamp: 'unclick-timestamp',
      random: 'unclick-random',
      image: 'unclick-image',
      csv: 'unclick-csv',
      json: 'unclick-json',
      markdown: 'unclick-markdown',
      diff: 'unclick-diff',
      cron: 'unclick-cron',
      kv: 'unclick-kv',
      regex: 'unclick-regex',
      color: 'unclick-color',
      ip: 'unclick-ip',
      qr: 'unclick-qr',
      shorten: 'unclick-shorten',
      webhook: 'unclick-webhook',
      links: 'unclick-links',
      scheduling: 'unclick-scheduling',
      solve: 'unclick-solve',
    };

    const toolSlug = TOOL_MAP[toolSegment];
    if (!toolSlug) return;

    // Fire-and-forget: do not block the response
    setImmediate(async () => {
      try {
        const now = new Date();
        await db.insert(billingEvents).values({
          id: `be_${newId()}`,
          orgId: org.orgId,
          toolSlug,
          apiKeyId: org.keyId,
          endpoint: `${c.req.method} ${c.req.path}`,
          responseMs,
          reported: false,
          createdAt: now,
        });
        await incrementMeter(db, org.orgId, toolSlug, 1, responseMs);
      } catch {
        // Non-fatal - billing events should never break API responses
      }
    });
  };
}

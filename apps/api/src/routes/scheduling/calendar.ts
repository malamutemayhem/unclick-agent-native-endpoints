import { Hono } from 'hono';
import { z } from 'zod';
import { zv } from '../../middleware/validate.js';
import { eq, and, gte, lte, asc } from 'drizzle-orm';
import { ok } from '@unclick/core';
import type { Db } from '../../db/index.js';
import { bookings, bookingAnswers, eventTypes } from '../../db/schema.js';
import type { AppVariables } from '../../middleware/types.js';
import { requireScope } from '../../middleware/auth.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const AgendaQuerySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  event_type_id: z.string().optional(),
  status: z.enum(['confirmed', 'cancelled', 'rescheduled']).optional(),
});

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatBookingSummary(
  row: typeof bookings.$inferSelect,
  et: Pick<typeof eventTypes.$inferSelect, 'name' | 'duration' | 'color'> | undefined,
) {
  return {
    id: row.id,
    event_type_id: row.eventTypeId,
    event_type_name: et?.name ?? null,
    event_type_color: et?.color ?? null,
    start_time: row.startTime.toISOString(),
    end_time: row.endTime.toISOString(),
    duration_minutes: et?.duration ?? null,
    status: row.status,
    attendee_name: row.attendeeName,
    attendee_email: row.attendeeEmail,
    attendee_timezone: row.attendeeTimezone,
    notes: row.notes ?? null,
    created_at: row.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createCalendarRouter(db: Db) {
  const router = new Hono<{ Variables: AppVariables }>();

  // GET /v1/scheduling/calendar — list bookings for a date range
  router.get('/', requireScope('scheduling:read'), zv('query', AgendaQuerySchema), async (c) => {
    const { orgId } = c.get('org');
    const query = c.req.valid('query');

    const fromDate = new Date(query.start_date + 'T00:00:00Z');
    const toDate = new Date(query.end_date + 'T23:59:59Z');

    if (fromDate > toDate) {
      return c.json({ error: { code: 'invalid_range', message: 'start_date must be before end_date' } }, 400);
    }

    let conditions = and(
      eq(bookings.orgId, orgId),
      gte(bookings.startTime, fromDate),
      lte(bookings.startTime, toDate),
    );

    if (query.event_type_id) {
      conditions = and(conditions, eq(bookings.eventTypeId, query.event_type_id));
    }
    if (query.status) {
      conditions = and(conditions, eq(bookings.status, query.status));
    }

    const rows = await db
      .select()
      .from(bookings)
      .where(conditions)
      .orderBy(asc(bookings.startTime));

    // Load event type metadata for all unique event type IDs
    const etIds = [...new Set(rows.map((r) => r.eventTypeId))];
    const etMap = new Map<string, Pick<typeof eventTypes.$inferSelect, 'name' | 'duration' | 'color'>>();

    for (const etId of etIds) {
      const [et] = await db
        .select({ name: eventTypes.name, duration: eventTypes.duration, color: eventTypes.color })
        .from(eventTypes)
        .where(eq(eventTypes.id, etId))
        .limit(1);
      if (et) etMap.set(etId, et);
    }

    return ok(c, rows.map((row) => formatBookingSummary(row, etMap.get(row.eventTypeId))));
  });

  // GET /v1/scheduling/calendar/day/:date — single-day agenda
  router.get('/day/:date', requireScope('scheduling:read'), async (c) => {
    const { orgId } = c.get('org');
    const { date } = c.req.param();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return c.json({ error: { code: 'invalid_date', message: 'Date must be YYYY-MM-DD' } }, 400);
    }

    const fromDate = new Date(date + 'T00:00:00Z');
    const toDate = new Date(date + 'T23:59:59Z');

    const rows = await db
      .select()
      .from(bookings)
      .where(and(
        eq(bookings.orgId, orgId),
        gte(bookings.startTime, fromDate),
        lte(bookings.startTime, toDate),
      ))
      .orderBy(asc(bookings.startTime));

    const etIds = [...new Set(rows.map((r) => r.eventTypeId))];
    const etMap = new Map<string, Pick<typeof eventTypes.$inferSelect, 'name' | 'duration' | 'color'>>();
    for (const etId of etIds) {
      const [et] = await db
        .select({ name: eventTypes.name, duration: eventTypes.duration, color: eventTypes.color })
        .from(eventTypes)
        .where(eq(eventTypes.id, etId))
        .limit(1);
      if (et) etMap.set(etId, et);
    }

    return ok(c, {
      date,
      total: rows.length,
      bookings: rows.map((row) => formatBookingSummary(row, etMap.get(row.eventTypeId))),
    });
  });

  // GET /v1/scheduling/calendar/week/:date — week containing the given date (Mon-Sun)
  router.get('/week/:date', requireScope('scheduling:read'), async (c) => {
    const { orgId } = c.get('org');
    const { date } = c.req.param();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return c.json({ error: { code: 'invalid_date', message: 'Date must be YYYY-MM-DD' } }, 400);
    }

    const d = new Date(date + 'T00:00:00Z');
    // ISO week: Monday = 0
    const day = d.getUTCDay(); // 0=Sun
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    const rows = await db
      .select()
      .from(bookings)
      .where(and(
        eq(bookings.orgId, orgId),
        gte(bookings.startTime, new Date(monday.toISOString().slice(0, 10) + 'T00:00:00Z')),
        lte(bookings.startTime, new Date(sunday.toISOString().slice(0, 10) + 'T23:59:59Z')),
      ))
      .orderBy(asc(bookings.startTime));

    const etIds = [...new Set(rows.map((r) => r.eventTypeId))];
    const etMap = new Map<string, Pick<typeof eventTypes.$inferSelect, 'name' | 'duration' | 'color'>>();
    for (const etId of etIds) {
      const [et] = await db
        .select({ name: eventTypes.name, duration: eventTypes.duration, color: eventTypes.color })
        .from(eventTypes)
        .where(eq(eventTypes.id, etId))
        .limit(1);
      if (et) etMap.set(etId, et);
    }

    // Group by date
    const byDate: Record<string, ReturnType<typeof formatBookingSummary>[]> = {};
    for (const row of rows) {
      const dayKey = row.startTime.toISOString().slice(0, 10);
      if (!byDate[dayKey]) byDate[dayKey] = [];
      byDate[dayKey].push(formatBookingSummary(row, etMap.get(row.eventTypeId)));
    }

    return ok(c, {
      week_start: monday.toISOString().slice(0, 10),
      week_end: sunday.toISOString().slice(0, 10),
      total: rows.length,
      days: byDate,
    });
  });

  return router;
}

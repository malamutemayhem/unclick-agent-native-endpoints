import { Hono } from 'hono';
import { zv } from '../../middleware/validate.js';
import { z } from 'zod';
import { eq, and, isNull, gte, lte, ne } from 'drizzle-orm';
import { ok, created, list, Errors, newId } from '@unclick/core';
import type { Db } from '../../db/index.js';
import {
  eventTypes, eventTypeQuestions, schedules, scheduleOverrides,
  bookings, bookingAnswers,
} from '../../db/schema.js';
import type { AppVariables } from '../../middleware/types.js';
import { requireScope } from '../../middleware/auth.js';
import { randomBytes } from 'node:crypto';

// ---------------------------------------------------------------------------
// Slot computation helpers
// ---------------------------------------------------------------------------

/** Parse "HH:MM" into minutes from midnight */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** Given a date string and HH:MM, return a UTC Date */
function toUtc(date: string, time: string, tz: string): Date {
  // Build ISO string in the given timezone and let Date parse it.
  // For simplicity we use the offset from Intl.DateTimeFormat.
  const dtStr = `${date}T${time}:00`;
  // Create a Date representing that wall-clock time in tz
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  // Get the UTC offset by comparing a reference
  const localRef = new Date(dtStr + 'Z'); // treat as UTC first
  const parts = formatter.formatToParts(localRef);
  const p: Record<string, string> = {};
  parts.forEach(({ type, value }) => { p[type] = value; });
  const localMs = localRef.getTime();
  const tzMs = new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`).getTime();
  const offsetMs = localMs - tzMs;
  return new Date(new Date(dtStr + 'Z').getTime() + offsetMs);
}

/** Get all dates in a range [startDate, endDate] inclusive */
function eachDay(startDate: Date, endDate: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(startDate);
  current.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setUTCHours(0, 0, 0, 0);
  while (current <= end) {
    days.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return days;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface WeeklySlot { day: number; start_time: string; end_time: string }
interface OverrideSlot { start_time: string; end_time: string }

/**
 * Compute available booking slots for a given event type and date range.
 * Returns array of { start: ISO string, end: ISO string }.
 */
async function computeAvailableSlots(
  db: Db,
  eventType: typeof eventTypes.$inferSelect,
  schedule: typeof schedules.$inferSelect,
  overrideMap: Map<string, OverrideSlot[] | null>,
  existingBookings: Array<{ startTime: Date; endTime: Date }>,
  fromDate: Date,
  toDate: Date,
  now: Date,
): Promise<Array<{ start: string; end: string }>> {
  const tz = schedule.timezone;
  const weeklyHours: WeeklySlot[] = JSON.parse(schedule.weeklyHours ?? '[]');
  const duration = eventType.duration; // minutes
  const bufferBefore = schedule.bufferBefore;
  const bufferAfter = schedule.bufferAfter;
  const slotStep = duration; // slots are non-overlapping, each slot = one booking

  const slots: Array<{ start: string; end: string }> = [];
  const days = eachDay(fromDate, toDate);

  for (const day of days) {
    const dateStr = toIsoDate(day);
    const dayOfWeek = day.getUTCDay(); // 0=Sun

    let daySlots: OverrideSlot[];
    if (overrideMap.has(dateStr)) {
      const override = overrideMap.get(dateStr)!;
      if (override === null) continue; // day off
      daySlots = override;
    } else {
      const weekSlots = weeklyHours.filter((s) => s.day === dayOfWeek);
      daySlots = weekSlots.map((s) => ({ start_time: s.start_time, end_time: s.end_time }));
    }

    for (const window of daySlots) {
      const windowStart = timeToMinutes(window.start_time);
      const windowEnd = timeToMinutes(window.end_time);

      let cursor = windowStart;
      while (cursor + duration <= windowEnd) {
        const slotStartUtc = toUtc(dateStr, `${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`, tz);
        const slotEndUtc = new Date(slotStartUtc.getTime() + duration * 60_000);

        // Apply min notice
        const minNoticeCutoff = new Date(now.getTime() + eventType.minNoticeMinutes * 60_000);
        if (slotStartUtc < minNoticeCutoff) {
          cursor += slotStep;
          continue;
        }

        // Check conflicts with existing confirmed bookings (including buffer)
        const hasConflict = existingBookings.some((b) => {
          const bufStart = new Date(b.startTime.getTime() - bufferBefore * 60_000);
          const bufEnd = new Date(b.endTime.getTime() + bufferAfter * 60_000);
          return slotStartUtc < bufEnd && slotEndUtc > bufStart;
        });

        if (!hasConflict) {
          slots.push({ start: slotStartUtc.toISOString(), end: slotEndUtc.toISOString() });
        }

        cursor += slotStep;
      }
    }
  }

  return slots;
}

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const ListSlotsQuerySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
});

const AnswerSchema = z.object({
  question_id: z.string(),
  answer: z.string(),
});

const CreateBookingSchema = z.object({
  start_time: z.string().datetime(),
  attendee_name: z.string().min(1).max(256),
  attendee_email: z.string().email(),
  attendee_timezone: z.string().min(1).max(100).default('UTC'),
  notes: z.string().max(2000).optional(),
  answers: z.array(AnswerSchema).default([]),
});

const RescheduleSchema = z.object({
  start_time: z.string().datetime(),
  attendee_timezone: z.string().min(1).max(100).optional(),
  notes: z.string().max(2000).optional(),
});

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatBooking(row: typeof bookings.$inferSelect, answers: typeof bookingAnswers.$inferSelect[] = []) {
  return {
    id: row.id,
    org_id: row.orgId,
    event_type_id: row.eventTypeId,
    start_time: row.startTime.toISOString(),
    end_time: row.endTime.toISOString(),
    status: row.status,
    attendee_name: row.attendeeName,
    attendee_email: row.attendeeEmail,
    attendee_timezone: row.attendeeTimezone,
    notes: row.notes ?? null,
    cancel_token: row.cancelToken,
    cancelled_at: row.cancelledAt?.toISOString() ?? null,
    rescheduled_from_id: row.rescheduledFromId ?? null,
    answers: answers.map((a) => ({ question_id: a.questionId, answer: a.answer })),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function generateCancelToken(): string {
  return randomBytes(24).toString('base64url');
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createBookingsRouter(db: Db) {
  const router = new Hono<{ Variables: AppVariables }>();

  // =========================================================================
  // PUBLIC endpoints — no auth required
  // These are registered before auth middleware in app.ts
  // =========================================================================

  // GET /v1/schedule/:org_slug/:event_slug/slots?start_date=&end_date=
  // (This is handled at app level as a raw route)

  // =========================================================================
  // AUTHENTICATED endpoints
  // =========================================================================

  // GET /v1/scheduling/bookings
  router.get('/', requireScope('scheduling:read'), async (c) => {
    const { orgId } = c.get('org');
    const q = c.req.query() as Record<string, string>;

    const startDate = q.start_date;
    const endDate = q.end_date;

    let conditions = and(eq(bookings.orgId, orgId));

    if (startDate) {
      const from = new Date(startDate + 'T00:00:00Z');
      conditions = and(conditions, gte(bookings.startTime, from));
    }
    if (endDate) {
      const to = new Date(endDate + 'T23:59:59Z');
      conditions = and(conditions, lte(bookings.startTime, to));
    }

    const rows = await db
      .select()
      .from(bookings)
      .where(conditions)
      .orderBy(bookings.startTime);

    const allAnswers = rows.length > 0
      ? await db.select().from(bookingAnswers).where(
          // fetch answers for all returned booking IDs
          // Drizzle doesn't have a clean IN for text, use multiple checks
          // For simplicity, fetch all org booking answers in this range
          eq(bookingAnswers.bookingId, rows[0]?.id ?? '')
        )
      : [];

    // Build a map for efficient lookup
    const answersByBooking = new Map<string, typeof bookingAnswers.$inferSelect[]>();
    for (const row of rows) {
      const ans = await db.select().from(bookingAnswers).where(eq(bookingAnswers.bookingId, row.id));
      answersByBooking.set(row.id, ans);
    }
    void allAnswers; // used above to suppress unused var warning

    return ok(c, rows.map((row) => formatBooking(row, answersByBooking.get(row.id) ?? [])));
  });

  // GET /v1/scheduling/bookings/:id
  router.get('/:id', requireScope('scheduling:read'), async (c) => {
    const { orgId } = c.get('org');
    const { id } = c.req.param();

    const [row] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, id), eq(bookings.orgId, orgId)))
      .limit(1);

    if (!row) throw Errors.notFound('Booking not found');

    const answers = await db.select().from(bookingAnswers).where(eq(bookingAnswers.bookingId, id));
    return ok(c, formatBooking(row, answers));
  });

  // DELETE /v1/scheduling/bookings/:id (cancel, auth version)
  router.delete('/:id', requireScope('scheduling:write'), async (c) => {
    const { orgId } = c.get('org');
    const { id } = c.req.param();

    const [row] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, id), eq(bookings.orgId, orgId)))
      .limit(1);

    if (!row) throw Errors.notFound('Booking not found');
    if (row.status === 'cancelled') {
      return c.json({ error: { code: 'already_cancelled', message: 'Booking is already cancelled' } }, 409);
    }

    const now = new Date();
    await db.update(bookings)
      .set({ status: 'cancelled', cancelledAt: now, updatedAt: now })
      .where(eq(bookings.id, id));

    const [updated] = await db.select().from(bookings).where(eq(bookings.id, id));
    const answers = await db.select().from(bookingAnswers).where(eq(bookingAnswers.bookingId, id));
    return ok(c, formatBooking(updated, answers));
  });

  return router;
}

// ---------------------------------------------------------------------------
// Public booking endpoints (mounted separately in app.ts, no auth)
// ---------------------------------------------------------------------------

export function createPublicBookingRouter(db: Db) {
  const router = new Hono();

  // GET /v1/schedule/:event_type_id/slots?start_date=&end_date=
  router.get('/:event_type_id/slots', zv('query', ListSlotsQuerySchema), async (c) => {
    const { event_type_id } = c.req.param();
    const { start_date, end_date } = c.req.valid('query');

    // Validate date range
    const fromDate = new Date(start_date + 'T00:00:00Z');
    const toDate = new Date(end_date + 'T23:59:59Z');
    if (fromDate > toDate) {
      return c.json({ error: { code: 'invalid_range', message: 'start_date must be before end_date' } }, 400);
    }
    const maxWindowMs = 60 * 24 * 60 * 60 * 1000; // 60 days
    if (toDate.getTime() - fromDate.getTime() > maxWindowMs) {
      return c.json({ error: { code: 'range_too_large', message: 'Date range cannot exceed 60 days' } }, 400);
    }

    // Load event type (public, by id)
    const [eventType] = await db
      .select()
      .from(eventTypes)
      .where(and(eq(eventTypes.id, event_type_id), eq(eventTypes.active, true), isNull(eventTypes.deletedAt)))
      .limit(1);

    if (!eventType) return c.json({ error: { code: 'not_found', message: 'Event type not found' } }, 404);

    // Validate booking window
    const now = new Date();
    const maxBookingDate = new Date(now.getTime() + eventType.bookingWindowDays * 24 * 60 * 60 * 1000);
    if (fromDate > maxBookingDate) {
      return c.json({ data: [] });
    }
    const effectiveTo = toDate < maxBookingDate ? toDate : maxBookingDate;

    // Load schedule
    let schedule: typeof schedules.$inferSelect | null = null;
    if (eventType.scheduleId) {
      const [s] = await db
        .select()
        .from(schedules)
        .where(and(eq(schedules.id, eventType.scheduleId), isNull(schedules.deletedAt)))
        .limit(1);
      schedule = s ?? null;
    }
    if (!schedule) {
      // Try org default
      const [s] = await db
        .select()
        .from(schedules)
        .where(and(
          eq(schedules.orgId, eventType.orgId),
          eq(schedules.isDefault, true),
          isNull(schedules.deletedAt),
        ))
        .limit(1);
      schedule = s ?? null;
    }

    if (!schedule) {
      return c.json({ data: [] }); // no schedule configured
    }

    // Load overrides for the date range
    const overrideRows = await db
      .select()
      .from(scheduleOverrides)
      .where(and(
        eq(scheduleOverrides.scheduleId, schedule.id),
        gte(scheduleOverrides.date, start_date),
        lte(scheduleOverrides.date, end_date),
      ));

    const overrideMap = new Map<string, Array<{ start_time: string; end_time: string }> | null>();
    for (const o of overrideRows) {
      overrideMap.set(o.date, o.slots ? JSON.parse(o.slots) : null);
    }

    // Load existing confirmed bookings in range
    const existingBookings = await db
      .select({ startTime: bookings.startTime, endTime: bookings.endTime })
      .from(bookings)
      .where(and(
        eq(bookings.eventTypeId, event_type_id),
        ne(bookings.status, 'cancelled'),
        gte(bookings.startTime, fromDate),
        lte(bookings.endTime, effectiveTo),
      ));

    const slots = await computeAvailableSlots(
      db, eventType, schedule, overrideMap, existingBookings,
      fromDate, effectiveTo, now,
    );

    return c.json({ data: slots });
  });

  // POST /v1/schedule/:event_type_id/book
  router.post('/:event_type_id/book', zv('json', CreateBookingSchema), async (c) => {
    const { event_type_id } = c.req.param();
    const body = c.req.valid('json');

    const [eventType] = await db
      .select()
      .from(eventTypes)
      .where(and(eq(eventTypes.id, event_type_id), eq(eventTypes.active, true), isNull(eventTypes.deletedAt)))
      .limit(1);

    if (!eventType) return c.json({ error: { code: 'not_found', message: 'Event type not found' } }, 404);

    const startTime = new Date(body.start_time);
    const endTime = new Date(startTime.getTime() + eventType.duration * 60_000);
    const now = new Date();

    // Check min notice
    const minNoticeCutoff = new Date(now.getTime() + eventType.minNoticeMinutes * 60_000);
    if (startTime < minNoticeCutoff) {
      return c.json({ error: { code: 'min_notice_violation', message: 'Booking start time is too soon' } }, 409);
    }

    // Check booking window
    const maxBookingDate = new Date(now.getTime() + eventType.bookingWindowDays * 24 * 60 * 60 * 1000);
    if (startTime > maxBookingDate) {
      return c.json({ error: { code: 'outside_booking_window', message: 'Booking date is outside the allowed window' } }, 409);
    }

    // Check for conflicts (include buffer)
    let schedule: typeof schedules.$inferSelect | null = null;
    if (eventType.scheduleId) {
      const [s] = await db.select().from(schedules).where(eq(schedules.id, eventType.scheduleId)).limit(1);
      schedule = s ?? null;
    }
    if (!schedule) {
      const [s] = await db.select().from(schedules).where(and(eq(schedules.orgId, eventType.orgId), eq(schedules.isDefault, true), isNull(schedules.deletedAt))).limit(1);
      schedule = s ?? null;
    }

    const bufferBefore = schedule?.bufferBefore ?? 0;
    const bufferAfter = schedule?.bufferAfter ?? 0;
    const conflictWindow = {
      from: new Date(startTime.getTime() - bufferBefore * 60_000),
      to: new Date(endTime.getTime() + bufferAfter * 60_000),
    };

    const [conflict] = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(
        eq(bookings.eventTypeId, event_type_id),
        ne(bookings.status, 'cancelled'),
        lte(bookings.startTime, conflictWindow.to),
        gte(bookings.endTime, conflictWindow.from),
      ))
      .limit(1);

    if (conflict) {
      return c.json({ error: { code: 'slot_taken', message: 'That time slot is no longer available' } }, 409);
    }

    // Validate required questions
    const questions = await db
      .select()
      .from(eventTypeQuestions)
      .where(eq(eventTypeQuestions.eventTypeId, event_type_id));

    const requiredIds = questions.filter((q) => q.required).map((q) => q.id);
    const answeredIds = new Set(body.answers.map((a) => a.question_id));
    const missing = requiredIds.filter((id) => !answeredIds.has(id));
    if (missing.length > 0) {
      return c.json({ error: { code: 'missing_required_answers', message: `Missing answers for: ${missing.join(', ')}` } }, 400);
    }

    // Create booking
    const cancelToken = generateCancelToken();
    const booking: typeof bookings.$inferInsert = {
      id: `bkg_${newId()}`,
      orgId: eventType.orgId,
      eventTypeId: event_type_id,
      startTime,
      endTime,
      status: 'confirmed',
      attendeeName: body.attendee_name,
      attendeeEmail: body.attendee_email,
      attendeeTimezone: body.attendee_timezone,
      notes: body.notes ?? null,
      cancelToken,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(bookings).values(booking);

    // Insert answers
    const answerRows: typeof bookingAnswers.$inferInsert[] = body.answers.map((a) => ({
      id: `bka_${newId()}`,
      bookingId: booking.id,
      questionId: a.question_id,
      answer: a.answer,
    }));
    if (answerRows.length > 0) {
      await db.insert(bookingAnswers).values(answerRows);
    }

    const [inserted] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    const answers = await db.select().from(bookingAnswers).where(eq(bookingAnswers.bookingId, booking.id));

    return c.json({ data: formatBooking(inserted, answers) }, 201);
  });

  // POST /v1/schedule/cancel/:cancel_token
  router.post('/cancel/:cancel_token', async (c) => {
    const { cancel_token } = c.req.param();

    const [row] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.cancelToken, cancel_token))
      .limit(1);

    if (!row) return c.json({ error: { code: 'not_found', message: 'Booking not found' } }, 404);
    if (row.status === 'cancelled') {
      return c.json({ error: { code: 'already_cancelled', message: 'Booking is already cancelled' } }, 409);
    }

    const now = new Date();
    await db.update(bookings)
      .set({ status: 'cancelled', cancelledAt: now, updatedAt: now })
      .where(eq(bookings.id, row.id));

    const [updated] = await db.select().from(bookings).where(eq(bookings.id, row.id));
    const answers = await db.select().from(bookingAnswers).where(eq(bookingAnswers.bookingId, row.id));
    return c.json({ data: formatBooking(updated, answers) });
  });

  // POST /v1/schedule/reschedule/:cancel_token
  router.post('/reschedule/:cancel_token', zv('json', RescheduleSchema), async (c) => {
    const { cancel_token } = c.req.param();
    const body = c.req.valid('json');

    const [original] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.cancelToken, cancel_token))
      .limit(1);

    if (!original) return c.json({ error: { code: 'not_found', message: 'Booking not found' } }, 404);
    if (original.status === 'cancelled') {
      return c.json({ error: { code: 'already_cancelled', message: 'Cannot reschedule a cancelled booking' } }, 409);
    }

    const [eventType] = await db
      .select()
      .from(eventTypes)
      .where(eq(eventTypes.id, original.eventTypeId))
      .limit(1);

    if (!eventType) return c.json({ error: { code: 'not_found', message: 'Event type not found' } }, 404);

    const newStart = new Date(body.start_time);
    const newEnd = new Date(newStart.getTime() + eventType.duration * 60_000);
    const now = new Date();

    // Check min notice
    const minNoticeCutoff = new Date(now.getTime() + eventType.minNoticeMinutes * 60_000);
    if (newStart < minNoticeCutoff) {
      return c.json({ error: { code: 'min_notice_violation', message: 'New start time is too soon' } }, 409);
    }

    // Check conflicts (exclude original booking)
    const [conflict] = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(
        eq(bookings.eventTypeId, original.eventTypeId),
        ne(bookings.status, 'cancelled'),
        ne(bookings.id, original.id),
        lte(bookings.startTime, newEnd),
        gte(bookings.endTime, newStart),
      ))
      .limit(1);

    if (conflict) {
      return c.json({ error: { code: 'slot_taken', message: 'That time slot is no longer available' } }, 409);
    }

    // Cancel original
    await db.update(bookings)
      .set({ status: 'rescheduled', cancelledAt: now, updatedAt: now })
      .where(eq(bookings.id, original.id));

    // Fetch original answers to carry forward
    const originalAnswers = await db
      .select()
      .from(bookingAnswers)
      .where(eq(bookingAnswers.bookingId, original.id));

    // Create new booking
    const newCancelToken = generateCancelToken();
    const newBooking: typeof bookings.$inferInsert = {
      id: `bkg_${newId()}`,
      orgId: original.orgId,
      eventTypeId: original.eventTypeId,
      startTime: newStart,
      endTime: newEnd,
      status: 'confirmed',
      attendeeName: original.attendeeName,
      attendeeEmail: original.attendeeEmail,
      attendeeTimezone: body.attendee_timezone ?? original.attendeeTimezone,
      notes: body.notes !== undefined ? (body.notes ?? null) : original.notes,
      cancelToken: newCancelToken,
      rescheduledFromId: original.id,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(bookings).values(newBooking);

    // Carry forward answers
    if (originalAnswers.length > 0) {
      const answerRows: typeof bookingAnswers.$inferInsert[] = originalAnswers.map((a) => ({
        id: `bka_${newId()}`,
        bookingId: newBooking.id,
        questionId: a.questionId,
        answer: a.answer,
      }));
      await db.insert(bookingAnswers).values(answerRows);
    }

    const [inserted] = await db.select().from(bookings).where(eq(bookings.id, newBooking.id));
    const answers = await db.select().from(bookingAnswers).where(eq(bookingAnswers.bookingId, newBooking.id));
    return c.json({ data: formatBooking(inserted, answers) }, 201);
  });

  return router;
}

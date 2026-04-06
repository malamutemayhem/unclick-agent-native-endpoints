/**
 * Complete schema for the UnClick API.
 * Re-exports shared core tables + defines link-in-bio specific tables.
 */
import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  uniqueIndex,
  index,
  real,
} from 'drizzle-orm/pg-core';

// Re-export shared schema
export {
  orgs,
  apiKeys,
  usageLogs,
  webhookEndpoints,
  webhookDeliveries,
} from '@unclick/core';

// ---------------------------------------------------------------------------
// Pre-built themes
// ---------------------------------------------------------------------------
export const themes = pgTable('themes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  previewUrl: text('preview_url'),
  /** JSON-encoded theme config: colors, fonts, button styles */
  config: text('config').notNull().default('{}'),
  isPremium: boolean('is_premium').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Link pages (one org can have many pages)
// ---------------------------------------------------------------------------
export const linkPages = pgTable('link_pages', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  themeId: text('theme_id').notNull().default('default'),
  /** JSON-encoded theme override object */
  themeOverrides: text('theme_overrides').notNull().default('{}'),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  seoOgImage: text('seo_og_image'),
  customDomain: text('custom_domain'),
  domainVerified: boolean('domain_verified').notNull().default(false),
  sensitive: boolean('sensitive').notNull().default(false),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('link_pages_slug_idx').on(t.slug),
  index('link_pages_org_idx').on(t.orgId),
  index('link_pages_domain_idx').on(t.customDomain),
]);

// ---------------------------------------------------------------------------
// Individual links on a page
// ---------------------------------------------------------------------------
export const links = pgTable('links', {
  id: text('id').primaryKey(),
  pageId: text('page_id').notNull(),
  orgId: text('org_id').notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  position: integer('position').notNull().default(0),
  highlight: boolean('highlight').notNull().default(false),
  active: boolean('active').notNull().default(true),
  scheduleStart: timestamp('schedule_start', { withTimezone: true }),
  scheduleEnd: timestamp('schedule_end', { withTimezone: true }),
  abVariant: text('ab_variant'), // null, 'A', or 'B'
  abTestId: text('ab_test_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('links_page_idx').on(t.pageId, t.position),
  index('links_org_idx').on(t.orgId),
]);

// ---------------------------------------------------------------------------
// Social links on a page
// ---------------------------------------------------------------------------
export const socialLinks = pgTable('social_links', {
  id: text('id').primaryKey(),
  pageId: text('page_id').notNull(),
  platform: text('platform').notNull(), // 'instagram', 'youtube', 'github', etc.
  url: text('url').notNull(),
  position: integer('position').notNull().default(0),
}, (t) => [
  uniqueIndex('social_links_page_platform_idx').on(t.pageId, t.platform),
]);

// ---------------------------------------------------------------------------
// Click events (append-only, high volume)
// ---------------------------------------------------------------------------
export const linkClicks = pgTable('link_clicks', {
  id: text('id').primaryKey(),
  linkId: text('link_id').notNull(),
  pageId: text('page_id').notNull(),
  orgId: text('org_id').notNull(),
  referrer: text('referrer'),
  country: text('country'), // ISO 2-letter code
  deviceType: text('device_type'), // 'mobile', 'desktop', 'tablet'
  userAgent: text('user_agent'),
  ipHash: text('ip_hash'), // SHA-256 of IP for unique visitor counting
  abVariant: text('ab_variant'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('link_clicks_link_idx').on(t.linkId, t.createdAt),
  index('link_clicks_page_idx').on(t.pageId, t.createdAt),
  index('link_clicks_org_idx').on(t.orgId, t.createdAt),
]);

// ---------------------------------------------------------------------------
// Page views (append-only)
// ---------------------------------------------------------------------------
export const pageViews = pgTable('page_views', {
  id: text('id').primaryKey(),
  pageId: text('page_id').notNull(),
  orgId: text('org_id').notNull(),
  referrer: text('referrer'),
  country: text('country'),
  deviceType: text('device_type'),
  ipHash: text('ip_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('page_views_page_idx').on(t.pageId, t.createdAt),
]);

// ---------------------------------------------------------------------------
// Feedback reports (shared across all tools)
// ---------------------------------------------------------------------------
export const feedbackReports = pgTable('feedback_reports', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'bug' | 'feature' | 'feedback'
  description: text('description').notNull(),
  email: text('email'),
  tool: text('tool').notNull().default('unknown'), // 'links', 'schedule', etc.
  endpoint: text('endpoint'), // which URL/route the user was on
  userAgent: text('user_agent'),
  /** JSON-encoded extra metadata */
  metadata: text('metadata').notNull().default('{}'),
  status: text('status').notNull().default('open'), // 'open' | 'triaged' | 'resolved' | 'closed'
  githubIssueNumber: integer('github_issue_number'),
  githubIssueUrl: text('github_issue_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('feedback_reports_status_idx').on(t.status, t.createdAt),
  index('feedback_reports_type_idx').on(t.type, t.createdAt),
]);

// ===========================================================================
// Scheduling API tables
// ===========================================================================

// ---------------------------------------------------------------------------
// Availability schedules (weekly recurring slots per org)
// ---------------------------------------------------------------------------
export const schedules = pgTable('schedules', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  name: text('name').notNull(),
  timezone: text('timezone').notNull().default('UTC'),
  /** JSON array: [{day:0-6, startTime:"09:00", endTime:"17:00"}] */
  weeklyHours: text('weekly_hours').notNull().default('[]'),
  bufferBefore: integer('buffer_before').notNull().default(0), // minutes
  bufferAfter: integer('buffer_after').notNull().default(0),   // minutes
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('schedules_org_idx').on(t.orgId),
]);

// ---------------------------------------------------------------------------
// Schedule overrides (date-specific availability changes)
// ---------------------------------------------------------------------------
export const scheduleOverrides = pgTable('schedule_overrides', {
  id: text('id').primaryKey(),
  scheduleId: text('schedule_id').notNull(),
  orgId: text('org_id').notNull(),
  date: text('date').notNull(), // ISO date: '2026-04-15'
  /** null = day off. JSON array if open: [{startTime:"10:00",endTime:"14:00"}] */
  slots: text('slots'), // null means unavailable all day
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('schedule_overrides_unique_idx').on(t.scheduleId, t.date),
  index('schedule_overrides_org_idx').on(t.orgId),
]);

// ---------------------------------------------------------------------------
// Event types (what can be booked)
// ---------------------------------------------------------------------------
export const eventTypes = pgTable('event_types', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  scheduleId: text('schedule_id'), // null = use org default schedule
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  duration: integer('duration').notNull(), // minutes
  location: text('location'),            // freeform: "Zoom", "In person", URL
  color: text('color').notNull().default('#E2B93B'),
  bookingWindowDays: integer('booking_window_days').notNull().default(60),
  minNoticeMinutes: integer('min_notice_minutes').notNull().default(60),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('event_types_org_slug_idx').on(t.orgId, t.slug),
  index('event_types_org_idx').on(t.orgId),
]);

// ---------------------------------------------------------------------------
// Custom intake questions per event type
// ---------------------------------------------------------------------------
export const eventTypeQuestions = pgTable('event_type_questions', {
  id: text('id').primaryKey(),
  eventTypeId: text('event_type_id').notNull(),
  orgId: text('org_id').notNull(),
  label: text('label').notNull(),
  fieldType: text('field_type').notNull().default('text'), // 'text'|'textarea'|'select'|'checkbox'
  /** JSON array of strings for select options */
  options: text('options'),
  required: boolean('required').notNull().default(false),
  position: integer('position').notNull().default(0),
}, (t) => [
  index('event_type_questions_event_idx').on(t.eventTypeId),
]);

// ---------------------------------------------------------------------------
// Bookings (the actual appointments)
// ---------------------------------------------------------------------------
export const bookings = pgTable('bookings', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  eventTypeId: text('event_type_id').notNull(),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('confirmed'), // 'confirmed'|'cancelled'|'rescheduled'
  attendeeName: text('attendee_name').notNull(),
  attendeeEmail: text('attendee_email').notNull(),
  attendeeTimezone: text('attendee_timezone').notNull().default('UTC'),
  notes: text('notes'),
  /** token used by attendee to cancel/reschedule without auth */
  cancelToken: text('cancel_token').notNull(),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  rescheduledFromId: text('rescheduled_from_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('bookings_org_idx').on(t.orgId, t.startTime),
  index('bookings_event_type_idx').on(t.eventTypeId, t.startTime),
  index('bookings_cancel_token_idx').on(t.cancelToken),
]);

// ---------------------------------------------------------------------------
// Attendee answers to custom intake questions
// ---------------------------------------------------------------------------
export const bookingAnswers = pgTable('booking_answers', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull(),
  questionId: text('question_id').notNull(),
  answer: text('answer').notNull(),
}, (t) => [
  index('booking_answers_booking_idx').on(t.bookingId),
]);

// ---------------------------------------------------------------------------
// Daily analytics rollup (pre-aggregated for fast reads)
// ---------------------------------------------------------------------------
export const analyticsDaily = pgTable('analytics_daily', {
  id: text('id').primaryKey(),
  pageId: text('page_id').notNull(),
  linkId: text('link_id'), // null = page-level stats
  date: text('date').notNull(), // ISO date string: '2026-04-05'
  views: integer('views').notNull().default(0),
  uniqueVisitors: integer('unique_visitors').notNull().default(0),
  clicks: integer('clicks').notNull().default(0),
  /** JSON-encoded: {"instagram.com": 45, "twitter.com": 23} */
  referrerData: text('referrer_data').notNull().default('{}'),
  /** JSON-encoded: {"AU": 120, "US": 89} */
  countryData: text('country_data').notNull().default('{}'),
  /** JSON-encoded: {"mobile": 150, "desktop": 80} */
  deviceData: text('device_data').notNull().default('{}'),
  clickThroughRate: real('click_through_rate').notNull().default(0),
}, (t) => [
  index('analytics_daily_page_idx').on(t.pageId, t.date),
]);

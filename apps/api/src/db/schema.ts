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

// ===========================================================================
// Solve API tables
// ===========================================================================

// ---------------------------------------------------------------------------
// Problem categories (admin-seeded)
// ---------------------------------------------------------------------------
export const solveCategories = pgTable('solve_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  icon: text('icon'),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => [
  uniqueIndex('solve_categories_slug_idx').on(t.slug),
]);

// ---------------------------------------------------------------------------
// Problems (publicly postable, org_id nullable for anonymous posts)
// ---------------------------------------------------------------------------
export const solveProblems = pgTable('solve_problems', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),             // null for anonymous human posts
  categoryId: text('category_id').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  status: text('status').notNull().default('open'), // open | solved | closed
  solutionCount: integer('solution_count').notNull().default(0),
  viewCount: integer('view_count').notNull().default(0),
  postedByAgentId: text('posted_by_agent_id'), // keyId if posted by an agent
  posterName: text('poster_name'),
  posterType: text('poster_type').notNull().default('human'), // human | agent
  acceptedSolutionId: text('accepted_solution_id'),
  // Arena Feature 2: Daily Question
  // SQL: ALTER TABLE solve_problems ADD COLUMN is_daily BOOLEAN NOT NULL DEFAULT false;
  // SQL: ALTER TABLE solve_problems ADD COLUMN daily_date TEXT;
  isDaily: boolean('is_daily').notNull().default(false),
  dailyDate: text('daily_date'), // ISO date '2026-04-07' or null
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('solve_problems_status_idx').on(t.status, t.createdAt),
  index('solve_problems_category_idx').on(t.categoryId, t.createdAt),
  index('solve_problems_daily_idx').on(t.isDaily, t.dailyDate),
]);

// ---------------------------------------------------------------------------
// Solutions (agents only)
// ---------------------------------------------------------------------------
export const solveSolutions = pgTable('solve_solutions', {
  id: text('id').primaryKey(),
  problemId: text('problem_id').notNull(),
  orgId: text('org_id').notNull(),
  agentId: text('agent_id').notNull(), // keyId from API key
  body: text('body').notNull(),
  score: integer('score').notNull().default(0), // net votes
  isAccepted: boolean('is_accepted').notNull().default(false),
  // Arena Feature 3: Bot Confidence Score
  // SQL: ALTER TABLE solve_solutions ADD COLUMN confidence INTEGER;
  confidence: integer('confidence'), // 0-100, null = not provided
  // Arena Feature 4: Show Reasoning
  // SQL: ALTER TABLE solve_solutions ADD COLUMN reasoning TEXT;
  reasoning: text('reasoning'), // chain of thought, null = not provided
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('solve_solutions_problem_idx').on(t.problemId, t.score),
  index('solve_solutions_agent_idx').on(t.agentId),
]);

// ---------------------------------------------------------------------------
// Votes (+1 / -1, one per agent per solution)
// ---------------------------------------------------------------------------
export const solveVotes = pgTable('solve_votes', {
  id: text('id').primaryKey(),
  solutionId: text('solution_id').notNull(),
  orgId: text('org_id').notNull(),
  agentId: text('agent_id').notNull(),
  value: integer('value').notNull(), // +1 or -1
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('solve_votes_unique_idx').on(t.solutionId, t.agentId),
  index('solve_votes_solution_idx').on(t.solutionId),
]);

// ---------------------------------------------------------------------------
// Agent reputation profiles (auto-provisioned on first action)
// ---------------------------------------------------------------------------
export const solveAgentProfiles = pgTable('solve_agent_profiles', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  agentId: text('agent_id').notNull(), // keyId from API key
  displayName: text('display_name').notNull(),
  bio: text('bio'),
  modelName: text('model_name'),
  totalSolutions: integer('total_solutions').notNull().default(0),
  acceptedSolutions: integer('accepted_solutions').notNull().default(0),
  totalUpvotes: integer('total_upvotes').notNull().default(0),
  reputationScore: integer('reputation_score').notNull().default(0),
  tier: text('tier').notNull().default('rookie'), // rookie | solver | expert | master
  // Arena Feature 6: Landslide Badge wins counter
  // SQL: ALTER TABLE solve_agent_profiles ADD COLUMN landslide_wins INTEGER NOT NULL DEFAULT 0;
  landslideWins: integer('landslide_wins').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('solve_agent_profiles_unique_idx').on(t.orgId, t.agentId),
  index('solve_agent_profiles_reputation_idx').on(t.reputationScore),
]);

// ===========================================================================
// Webhook Bin tables (RequestBin-style tool)
// ===========================================================================

// ---------------------------------------------------------------------------
// Webhook bins - temporary endpoints that capture incoming HTTP requests
// ---------------------------------------------------------------------------
export const webhookBins = pgTable('webhook_bins', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  /**
   * The API key that created this bin. Ownership of a bin is scoped to the
   * specific key, not just the org, so that sibling keys in the same org
   * cannot read each other's captured webhook data.
   *
   * Nullable only for rows that pre-date this column. New bins always have
   * a keyId and are enforced at the route level.
   */
  keyId: text('key_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (t) => [
  index('webhook_bins_org_idx').on(t.orgId),
  index('webhook_bins_key_idx').on(t.keyId),
  index('webhook_bins_expires_idx').on(t.expiresAt),
]);

// ---------------------------------------------------------------------------
// Captured requests per bin
// ---------------------------------------------------------------------------
export const webhookBinRequests = pgTable('webhook_bin_requests', {
  id: text('id').primaryKey(),
  binId: text('bin_id').notNull(),
  method: text('method').notNull(),
  /** JSON-encoded headers object */
  headers: text('headers').notNull().default('{}'),
  /** Raw request body (capped at 100 KB); null when empty */
  body: text('body'),
  /** JSON-encoded query params object */
  queryParams: text('query_params').notNull().default('{}'),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('webhook_bin_requests_bin_idx').on(t.binId, t.receivedAt),
]);

// ===========================================================================
// KV Store tables
// ===========================================================================

// ---------------------------------------------------------------------------
// Key-value scratchpad - org-scoped, optional TTL, values stored as JSON text
// ---------------------------------------------------------------------------
export const kvStore = pgTable('kv_store', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  key: text('key').notNull(),
  /** JSON-serialised value (up to 512 KB) */
  value: text('value').notNull().default('null'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('kv_store_org_key_idx').on(t.orgId, t.key),
  index('kv_store_org_idx').on(t.orgId),
  index('kv_store_expires_idx').on(t.expiresAt),
]);

// ===========================================================================
// Paste API tables
// ===========================================================================

// ---------------------------------------------------------------------------
// Pastes - org-scoped text snippets with optional expiry
// ---------------------------------------------------------------------------
export const pastes = pgTable('pastes', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  title: text('title'),
  content: text('content').notNull(),
  language: text('language'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
}, (t) => [
  index('pastes_org_idx').on(t.orgId),
  index('pastes_expires_idx').on(t.expiresAt),
]);

// ===========================================================================
// Secret API tables
// ===========================================================================

// ---------------------------------------------------------------------------
// Secrets - one-time encrypted text, destroyed on first read
// ---------------------------------------------------------------------------
export const secrets = pgTable('secrets', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  /** Base64-encoded AES-256-GCM ciphertext */
  encryptedContent: text('encrypted_content').notNull(),
  /** Base64-encoded 12-byte GCM IV */
  iv: text('iv').notNull(),
  /** Base64-encoded 16-byte PBKDF2 salt */
  salt: text('salt').notNull(),
  /** Base64-encoded 16-byte GCM auth tag */
  authTag: text('auth_tag').notNull(),
  /** SHA-256 hex of the passphrase, or null if no passphrase */
  passphraseHash: text('passphrase_hash'),
  viewed: boolean('viewed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (t) => [
  index('secrets_org_idx').on(t.orgId),
  index('secrets_expires_idx').on(t.expiresAt),
]);

// ===========================================================================
// Shorten API tables
// ===========================================================================

// ---------------------------------------------------------------------------
// Shortened URLs (one short code maps to one original URL, per org)
// ---------------------------------------------------------------------------
export const shortenedUrls = pgTable('shortened_urls', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  originalUrl: text('original_url').notNull(),
  orgId: text('org_id').notNull(),
  clickCount: integer('click_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('shortened_urls_code_idx').on(t.code),
  index('shortened_urls_org_idx').on(t.orgId),
]);

// ===========================================================================
// Marketplace tables
// ===========================================================================

// ---------------------------------------------------------------------------
// Publishers - orgs that list tools in the marketplace
// ---------------------------------------------------------------------------
export const publishers = pgTable('publishers', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  displayName: text('display_name').notNull(),
  slug: text('slug').notNull(),
  description: text('description').notNull(),
  websiteUrl: text('website_url'),
  avatarUrl: text('avatar_url'),
  verified: boolean('verified').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('publishers_slug_idx').on(t.slug),
  index('publishers_org_idx').on(t.orgId),
]);

// ---------------------------------------------------------------------------
// Marketplace categories
// ---------------------------------------------------------------------------
export const marketplaceCategories = pgTable('marketplace_categories', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull(),
  toolCount: integer('tool_count').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => [
  uniqueIndex('marketplace_categories_slug_idx').on(t.slug),
]);

// ---------------------------------------------------------------------------
// Marketplace tool listings
// ---------------------------------------------------------------------------
export const marketplaceTools = pgTable('marketplace_tools', {
  id: text('id').primaryKey(),
  publisherId: text('publisher_id').notNull(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  tagline: text('tagline').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  iconUrl: text('icon_url'),
  /** Full OpenAPI spec serialized as JSON string */
  openapiSpec: text('openapi_spec').notNull().default('{}'),
  baseUrl: text('base_url').notNull(),
  isInternal: boolean('is_internal').notNull().default(false),
  isProxied: boolean('is_proxied').notNull().default(true),
  /** draft | pending_review | approved | rejected | suspended */
  status: text('status').notNull().default('draft'),
  version: text('version').notNull().default('1.0.0'),
  totalCalls: integer('total_calls').notNull().default(0),
  monthlyCalls: integer('monthly_calls').notNull().default(0),
  avgResponseMs: integer('avg_response_ms'),
  rating: real('rating'),
  ratingCount: integer('rating_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('marketplace_tools_slug_idx').on(t.slug),
  index('marketplace_tools_publisher_idx').on(t.publisherId),
  index('marketplace_tools_category_idx').on(t.category),
  index('marketplace_tools_status_idx').on(t.status),
]);

// ---------------------------------------------------------------------------
// Per-tool endpoint catalogue
// ---------------------------------------------------------------------------
export const marketplaceEndpoints = pgTable('marketplace_endpoints', {
  id: text('id').primaryKey(),
  toolId: text('tool_id').notNull(),
  method: text('method').notNull(),
  path: text('path').notNull(),
  summary: text('summary').notNull(),
  description: text('description').notNull().default(''),
  /** JSON Schema for request body */
  requestSchema: text('request_schema').notNull().default('{}'),
  /** JSON Schema for response body */
  responseSchema: text('response_schema').notNull().default('{}'),
  /** JSON-encoded string[] of required scopes */
  scopesRequired: text('scopes_required').notNull().default('[]'),
}, (t) => [
  index('marketplace_endpoints_tool_idx').on(t.toolId),
]);

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------
export const marketplaceTags = pgTable('marketplace_tags', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
}, (t) => [
  uniqueIndex('marketplace_tags_slug_idx').on(t.slug),
]);

// Tool ↔ tag junction
export const marketplaceToolTags = pgTable('marketplace_tool_tags', {
  id: text('id').primaryKey(),
  toolId: text('tool_id').notNull(),
  tagId: text('tag_id').notNull(),
}, (t) => [
  uniqueIndex('marketplace_tool_tags_unique_idx').on(t.toolId, t.tagId),
  index('marketplace_tool_tags_tool_idx').on(t.toolId),
  index('marketplace_tool_tags_tag_idx').on(t.tagId),
]);

// ---------------------------------------------------------------------------
// Org ratings for tools (one per org per tool)
// ---------------------------------------------------------------------------
export const marketplaceRatings = pgTable('marketplace_ratings', {
  id: text('id').primaryKey(),
  toolId: text('tool_id').notNull(),
  orgId: text('org_id').notNull(),
  /** 1–5 integer star rating */
  rating: integer('rating').notNull(),
  review: text('review'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('marketplace_ratings_unique_idx').on(t.toolId, t.orgId),
  index('marketplace_ratings_tool_idx').on(t.toolId),
]);

// ===========================================================================
// Marketplace billing - agent-native metering + Stripe payment rails
// ===========================================================================

// ---------------------------------------------------------------------------
// Pricing config per tool listing
// ---------------------------------------------------------------------------
export const toolPricing = pgTable('tool_pricing', {
  id: text('id').primaryKey(),
  toolSlug: text('tool_slug').notNull(),
  publisherId: text('publisher_id').notNull(),
  /** Price per API call in micro-cents (1000 = $0.00001) */
  pricePerCallMicro: integer('price_per_call_micro').notNull().default(0),
  /** Free tier monthly call allowance */
  freeTierCalls: integer('free_tier_calls').notNull().default(1000),
  /** Stripe Price ID for metered billing */
  stripePriceId: text('stripe_price_id'),
  /** Stripe Meter ID for usage-based billing */
  stripeMeterId: text('stripe_meter_id'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('tool_pricing_tool_slug_idx').on(t.toolSlug),
  index('tool_pricing_publisher_idx').on(t.publisherId),
]);

// ---------------------------------------------------------------------------
// Billing events - append-only metering ledger per API call
// Batched and reported to Stripe Metering API for automatic agent billing
// ---------------------------------------------------------------------------
export const billingEvents = pgTable('billing_events', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  toolSlug: text('tool_slug').notNull(),
  apiKeyId: text('api_key_id').notNull(),
  endpoint: text('endpoint').notNull(),
  responseMs: integer('response_ms'),
  /** Whether this event has been reported to Stripe */
  reported: boolean('reported').notNull().default(false),
  /** Stripe Meter Event ID after reporting */
  stripeMeterEventId: text('stripe_meter_event_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('billing_events_org_idx').on(t.orgId, t.createdAt),
  index('billing_events_tool_idx').on(t.toolSlug, t.createdAt),
  index('billing_events_unreported_idx').on(t.reported),
]);

// ---------------------------------------------------------------------------
// Billing meters - pre-aggregated monthly usage per org per tool
// ---------------------------------------------------------------------------
export const billingMeters = pgTable('billing_meters', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  toolSlug: text('tool_slug').notNull(),
  /** ISO month: '2026-04' */
  period: text('period').notNull(),
  calls: integer('calls').notNull().default(0),
  billableCalls: integer('billable_calls').notNull().default(0),
  totalMs: integer('total_ms').notNull().default(0),
  billedAmountCents: integer('billed_amount_cents').notNull().default(0),
  /** pending | billed | failed | free */
  billingStatus: text('billing_status').notNull().default('pending'),
  /** Stripe Invoice or UsageRecord ID */
  stripeRecordId: text('stripe_record_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('billing_meters_unique_idx').on(t.orgId, t.toolSlug, t.period),
  index('billing_meters_org_idx').on(t.orgId),
  index('billing_meters_status_idx').on(t.billingStatus),
]);

// ---------------------------------------------------------------------------
// Revenue share payouts to publishers via Stripe Connect
// ---------------------------------------------------------------------------
export const revenueShare = pgTable('revenue_share', {
  id: text('id').primaryKey(),
  publisherId: text('publisher_id').notNull(),
  period: text('period').notNull(),
  grossAmountCents: integer('gross_amount_cents').notNull().default(0),
  /** Publisher share percentage, e.g. 70 = 70% */
  sharePct: real('share_pct').notNull().default(70),
  netAmountCents: integer('net_amount_cents').notNull().default(0),
  /** Stripe Connect Transfer ID */
  stripeTransferId: text('stripe_transfer_id'),
  /** pending | transferred | failed */
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('revenue_share_unique_idx').on(t.publisherId, t.period),
  index('revenue_share_publisher_idx').on(t.publisherId),
  index('revenue_share_status_idx').on(t.status),
]);

// ===========================================================================
// Bug Reports - agent-submitted error reports via POST /v1/report-bug
// ===========================================================================

export const bugReports = pgTable('bug_reports', {
  id: text('id').primaryKey(),
  apiKey: text('api_key').notNull(),
  orgId: text('org_id').notNull(),
  toolName: text('tool_name').notNull(),
  errorMessage: text('error_message').notNull(),
  /** JSON-encoded request payload the agent sent */
  requestPayload: text('request_payload').notNull().default('{}'),
  expectedBehavior: text('expected_behavior'),
  severity: text('severity').notNull().default('low'), // critical | high | medium | low
  status: text('status').notNull().default('new'),     // new | investigating | fixed | wontfix
  /** JSON-encoded extra context the agent provides */
  agentContext: text('agent_context'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('bug_reports_org_idx').on(t.orgId, t.createdAt),
  index('bug_reports_severity_idx').on(t.severity, t.status),
  index('bug_reports_tool_idx').on(t.toolName),
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

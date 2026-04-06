/**
 * Shared database schema definitions using drizzle-orm pg-core.
 * These tables are used by all tools in the suite.
 */
import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Organizations (synced from Clerk or created via API in dev mode)
// ---------------------------------------------------------------------------
export const orgs = pgTable('orgs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  stripeCustomer: text('stripe_customer'),
  plan: text('plan').notNull().default('free'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('orgs_slug_idx').on(t.slug)]);

// ---------------------------------------------------------------------------
// API Keys
// ---------------------------------------------------------------------------
export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => orgs.id),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  /** JSON-encoded string[] of scopes, e.g. '["links:read","links:write"]' */
  scopes: text('scopes').notNull().default('[]'),
  environment: text('environment').notNull().default('live'),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('api_keys_hash_idx').on(t.keyHash),
  index('api_keys_org_idx').on(t.orgId),
]);

// ---------------------------------------------------------------------------
// Usage logs (lightweight, append-only)
// ---------------------------------------------------------------------------
export const usageLogs = pgTable('usage_logs', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => orgs.id),
  tool: text('tool').notNull(),
  endpoint: text('endpoint').notNull(),
  method: text('method').notNull(),
  statusCode: integer('status_code').notNull(),
  responseMs: integer('response_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('usage_logs_org_idx').on(t.orgId, t.createdAt)]);

// ---------------------------------------------------------------------------
// Webhook endpoints
// ---------------------------------------------------------------------------
export const webhookEndpoints = pgTable('webhook_endpoints', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => orgs.id),
  url: text('url').notNull(),
  /** JSON-encoded string[] of event types */
  events: text('events').notNull().default('[]'),
  secret: text('secret').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('webhooks_org_idx').on(t.orgId)]);

// ---------------------------------------------------------------------------
// Webhook deliveries
// ---------------------------------------------------------------------------
export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: text('id').primaryKey(),
  endpointId: text('endpoint_id').notNull().references(() => webhookEndpoints.id),
  eventType: text('event_type').notNull(),
  /** JSON-encoded payload */
  payload: text('payload').notNull(),
  statusCode: integer('status_code'),
  attempt: integer('attempt').notNull().default(1),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('deliveries_endpoint_idx').on(t.endpointId),
  index('deliveries_retry_idx').on(t.nextRetryAt),
]);

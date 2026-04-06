import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from './schema.js';

const DB_PATH = process.env.DB_PATH;

let _client: PGlite | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!_db) {
    // No path = in-memory. Explicit path = file-backed.
    _client = DB_PATH ? new PGlite(DB_PATH) : new PGlite();
    _db = drizzle(_client, { schema });
  }
  return _db;
}

export type Db = ReturnType<typeof getDb>;
export { schema };

/**
 * Initialize database tables if they don't exist.
 * Run once at startup. Uses IF NOT EXISTS so it's idempotent.
 */
export async function initDb(): Promise<void> {
  const client = _client ?? (DB_PATH ? new PGlite(DB_PATH) : new PGlite());
  if (!_client) {
    _client = client;
    _db = drizzle(client, { schema });
  }

  await client.exec(`
    CREATE TABLE IF NOT EXISTS orgs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      stripe_customer TEXT,
      plan TEXT NOT NULL DEFAULT 'free',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS orgs_slug_idx ON orgs(slug);

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      scopes TEXT NOT NULL DEFAULT '[]',
      environment TEXT NOT NULL DEFAULT 'live',
      last_used_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS api_keys_hash_idx ON api_keys(key_hash);
    CREATE INDEX IF NOT EXISTS api_keys_org_idx ON api_keys(org_id);

    CREATE TABLE IF NOT EXISTS usage_logs (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      tool TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      response_ms INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS usage_logs_org_idx ON usage_logs(org_id, created_at);

    CREATE TABLE IF NOT EXISTS webhook_endpoints (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      url TEXT NOT NULL,
      events TEXT NOT NULL DEFAULT '[]',
      secret TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS webhooks_org_idx ON webhook_endpoints(org_id);

    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id TEXT PRIMARY KEY,
      endpoint_id TEXT NOT NULL REFERENCES webhook_endpoints(id),
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status_code INTEGER,
      attempt INTEGER NOT NULL DEFAULT 1,
      next_retry_at TIMESTAMPTZ,
      delivered_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS deliveries_endpoint_idx ON webhook_deliveries(endpoint_id);
    CREATE INDEX IF NOT EXISTS deliveries_retry_idx ON webhook_deliveries(next_retry_at);

    CREATE TABLE IF NOT EXISTS themes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      preview_url TEXT,
      config TEXT NOT NULL DEFAULT '{}',
      is_premium BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS link_pages (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      bio TEXT,
      avatar_url TEXT,
      theme_id TEXT NOT NULL DEFAULT 'default',
      theme_overrides TEXT NOT NULL DEFAULT '{}',
      seo_title TEXT,
      seo_description TEXT,
      seo_og_image TEXT,
      custom_domain TEXT,
      domain_verified BOOLEAN NOT NULL DEFAULT FALSE,
      sensitive BOOLEAN NOT NULL DEFAULT FALSE,
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX IF NOT EXISTS link_pages_slug_idx ON link_pages(slug);
    CREATE INDEX IF NOT EXISTS link_pages_org_idx ON link_pages(org_id);
    CREATE INDEX IF NOT EXISTS link_pages_domain_idx ON link_pages(custom_domain);

    CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      org_id TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      thumbnail_url TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      highlight BOOLEAN NOT NULL DEFAULT FALSE,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      schedule_start TIMESTAMPTZ,
      schedule_end TIMESTAMPTZ,
      ab_variant TEXT,
      ab_test_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS links_page_idx ON links(page_id, position);
    CREATE INDEX IF NOT EXISTS links_org_idx ON links(org_id);

    CREATE TABLE IF NOT EXISTS social_links (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      url TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      UNIQUE(page_id, platform)
    );

    CREATE TABLE IF NOT EXISTS link_clicks (
      id TEXT PRIMARY KEY,
      link_id TEXT NOT NULL,
      page_id TEXT NOT NULL,
      org_id TEXT NOT NULL,
      referrer TEXT,
      country TEXT,
      device_type TEXT,
      user_agent TEXT,
      ip_hash TEXT,
      ab_variant TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS link_clicks_link_idx ON link_clicks(link_id, created_at);
    CREATE INDEX IF NOT EXISTS link_clicks_page_idx ON link_clicks(page_id, created_at);
    CREATE INDEX IF NOT EXISTS link_clicks_org_idx ON link_clicks(org_id, created_at);

    CREATE TABLE IF NOT EXISTS page_views (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      org_id TEXT NOT NULL,
      referrer TEXT,
      country TEXT,
      device_type TEXT,
      ip_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS page_views_page_idx ON page_views(page_id, created_at);

    CREATE TABLE IF NOT EXISTS analytics_daily (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      link_id TEXT,
      date TEXT NOT NULL,
      views INTEGER NOT NULL DEFAULT 0,
      unique_visitors INTEGER NOT NULL DEFAULT 0,
      clicks INTEGER NOT NULL DEFAULT 0,
      referrer_data TEXT NOT NULL DEFAULT '{}',
      country_data TEXT NOT NULL DEFAULT '{}',
      device_data TEXT NOT NULL DEFAULT '{}',
      click_through_rate REAL NOT NULL DEFAULT 0
    );
    CREATE UNIQUE INDEX IF NOT EXISTS analytics_daily_unique_idx ON analytics_daily(page_id, date, COALESCE(link_id, ''));
    CREATE INDEX IF NOT EXISTS analytics_daily_page_idx ON analytics_daily(page_id, date);

    CREATE TABLE IF NOT EXISTS feedback_reports (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      email TEXT,
      tool TEXT NOT NULL DEFAULT 'unknown',
      endpoint TEXT,
      user_agent TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'open',
      github_issue_number INTEGER,
      github_issue_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS feedback_reports_status_idx ON feedback_reports(status, created_at);
    CREATE INDEX IF NOT EXISTS feedback_reports_type_idx ON feedback_reports(type, created_at);
  `);

  // Scheduling API tables
  await client.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      name TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      weekly_hours TEXT NOT NULL DEFAULT '[]',
      buffer_before INTEGER NOT NULL DEFAULT 0,
      buffer_after INTEGER NOT NULL DEFAULT 0,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS schedules_org_idx ON schedules(org_id);

    CREATE TABLE IF NOT EXISTS schedule_overrides (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL REFERENCES schedules(id),
      org_id TEXT NOT NULL,
      date TEXT NOT NULL,
      slots TEXT,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(schedule_id, date)
    );
    CREATE INDEX IF NOT EXISTS schedule_overrides_org_idx ON schedule_overrides(org_id);

    CREATE TABLE IF NOT EXISTS event_types (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      schedule_id TEXT REFERENCES schedules(id),
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      duration INTEGER NOT NULL,
      location TEXT,
      color TEXT NOT NULL DEFAULT '#E2B93B',
      booking_window_days INTEGER NOT NULL DEFAULT 60,
      min_notice_minutes INTEGER NOT NULL DEFAULT 60,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      UNIQUE(org_id, slug)
    );
    CREATE INDEX IF NOT EXISTS event_types_org_idx ON event_types(org_id);

    CREATE TABLE IF NOT EXISTS event_type_questions (
      id TEXT PRIMARY KEY,
      event_type_id TEXT NOT NULL REFERENCES event_types(id),
      org_id TEXT NOT NULL,
      label TEXT NOT NULL,
      field_type TEXT NOT NULL DEFAULT 'text',
      options TEXT,
      required BOOLEAN NOT NULL DEFAULT FALSE,
      position INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS event_type_questions_event_idx ON event_type_questions(event_type_id);

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      event_type_id TEXT NOT NULL REFERENCES event_types(id),
      start_time TIMESTAMPTZ NOT NULL,
      end_time TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'confirmed',
      attendee_name TEXT NOT NULL,
      attendee_email TEXT NOT NULL,
      attendee_timezone TEXT NOT NULL DEFAULT 'UTC',
      notes TEXT,
      cancel_token TEXT NOT NULL,
      cancelled_at TIMESTAMPTZ,
      rescheduled_from_id TEXT,
      idempotency_key TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS bookings_org_idx ON bookings(org_id, start_time);
    CREATE INDEX IF NOT EXISTS bookings_event_type_idx ON bookings(event_type_id, start_time);
    CREATE INDEX IF NOT EXISTS bookings_cancel_token_idx ON bookings(cancel_token);
    CREATE UNIQUE INDEX IF NOT EXISTS bookings_idempotency_key_idx ON bookings(idempotency_key) WHERE idempotency_key IS NOT NULL;

    CREATE TABLE IF NOT EXISTS booking_answers (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL REFERENCES bookings(id),
      question_id TEXT NOT NULL,
      answer TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS booking_answers_booking_idx ON booking_answers(booking_id);
  `);

  // Seed default themes
  await client.exec(`
    INSERT INTO themes (id, name, config, is_premium) VALUES
      ('default',      'Default',       '{"background":"#ffffff","text":"#111111","button":"#111111","buttonText":"#ffffff","buttonStyle":"rounded","fontFamily":"Inter"}', FALSE),
      ('minimal-dark', 'Minimal Dark',  '{"background":"#0a0a0a","text":"#e8e8e8","button":"#e2b93b","buttonText":"#0a0a0a","buttonStyle":"rounded","fontFamily":"Inter"}', FALSE),
      ('ocean',        'Ocean',         '{"background":"#0f2027","text":"#e0e0e0","button":"#00b4d8","buttonText":"#ffffff","buttonStyle":"pill","fontFamily":"Inter"}', FALSE),
      ('rose',         'Rose',          '{"background":"#fff0f3","text":"#3d0014","button":"#c9184a","buttonText":"#ffffff","buttonStyle":"rounded","fontFamily":"Inter"}', FALSE),
      ('mono',         'Mono',          '{"background":"#f5f5f5","text":"#1a1a1a","button":"#1a1a1a","buttonText":"#f5f5f5","buttonStyle":"sharp","fontFamily":"JetBrains Mono"}', FALSE),
      ('aurora',       'Aurora',        '{"background":"#0d0d1a","text":"#e0e0ff","button":"#7b2fff","buttonText":"#ffffff","buttonStyle":"pill","fontFamily":"Inter"}', TRUE)
    ON CONFLICT (id) DO NOTHING;
  `);
}

/**
 * Seed a development org and API key for local testing.
 * Only runs in dev mode. Returns the plaintext test key.
 */
export async function seedDevOrg(): Promise<string> {
  const DEV_ORG_ID = 'org_dev';
  const DEV_KEY = 'agt_test_devkey_localdev_00000000000000000000000000';

  await _client!.exec(`
    INSERT INTO orgs (id, name, slug, plan) VALUES
      ('${DEV_ORG_ID}', 'Dev Org', 'dev-org', 'pro')
    ON CONFLICT (id) DO NOTHING;
  `);

  const { hashKey } = await import('@unclick/core');
  const hash = hashKey(DEV_KEY);

  await _client!.exec(`
    INSERT INTO api_keys (id, org_id, name, key_hash, key_prefix, scopes, environment)
    VALUES ('key_dev', '${DEV_ORG_ID}', 'Dev Key', '${hash}', 'devkey_l', '[]', 'test')
    ON CONFLICT (id) DO NOTHING;
  `);

  return DEV_KEY;
}

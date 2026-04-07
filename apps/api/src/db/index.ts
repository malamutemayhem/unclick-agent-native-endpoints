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

  // Solve API tables
  await client.exec(`
    CREATE TABLE IF NOT EXISTS solve_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(slug)
    );

    CREATE TABLE IF NOT EXISTS solve_problems (
      id TEXT PRIMARY KEY,
      org_id TEXT,
      category_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      solution_count INTEGER NOT NULL DEFAULT 0,
      view_count INTEGER NOT NULL DEFAULT 0,
      posted_by_agent_id TEXT,
      poster_name TEXT,
      poster_type TEXT NOT NULL DEFAULT 'human',
      accepted_solution_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS solve_problems_status_idx ON solve_problems(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS solve_problems_category_idx ON solve_problems(category_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS solve_solutions (
      id TEXT PRIMARY KEY,
      problem_id TEXT NOT NULL REFERENCES solve_problems(id),
      org_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      body TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      is_accepted BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX IF NOT EXISTS solve_solutions_unique_idx ON solve_solutions(problem_id, agent_id) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS solve_solutions_problem_idx ON solve_solutions(problem_id, score DESC);
    CREATE INDEX IF NOT EXISTS solve_solutions_agent_idx ON solve_solutions(agent_id);

    CREATE TABLE IF NOT EXISTS solve_votes (
      id TEXT PRIMARY KEY,
      solution_id TEXT NOT NULL REFERENCES solve_solutions(id),
      org_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      value INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(solution_id, agent_id)
    );
    CREATE INDEX IF NOT EXISTS solve_votes_solution_idx ON solve_votes(solution_id);

    CREATE TABLE IF NOT EXISTS solve_agent_profiles (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      bio TEXT,
      model_name TEXT,
      total_solutions INTEGER NOT NULL DEFAULT 0,
      accepted_solutions INTEGER NOT NULL DEFAULT 0,
      total_upvotes INTEGER NOT NULL DEFAULT 0,
      reputation_score INTEGER NOT NULL DEFAULT 0,
      tier TEXT NOT NULL DEFAULT 'rookie',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(org_id, agent_id)
    );
    CREATE INDEX IF NOT EXISTS solve_agent_profiles_reputation_idx ON solve_agent_profiles(reputation_score DESC);
  `);

  // Webhook Bin tables
  await client.exec(`
    CREATE TABLE IF NOT EXISTS webhook_bins (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS webhook_bins_org_idx ON webhook_bins(org_id);
    CREATE INDEX IF NOT EXISTS webhook_bins_expires_idx ON webhook_bins(expires_at);

    CREATE TABLE IF NOT EXISTS webhook_bin_requests (
      id TEXT PRIMARY KEY,
      bin_id TEXT NOT NULL REFERENCES webhook_bins(id),
      method TEXT NOT NULL,
      headers TEXT NOT NULL DEFAULT '{}',
      body TEXT,
      query_params TEXT NOT NULL DEFAULT '{}',
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS webhook_bin_requests_bin_idx ON webhook_bin_requests(bin_id, received_at DESC);
  `);

  // KV Store tables
  await client.exec(`
    CREATE TABLE IF NOT EXISTS kv_store (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL DEFAULT 'null',
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(org_id, key)
    );
    CREATE INDEX IF NOT EXISTS kv_store_org_idx ON kv_store(org_id);
    CREATE INDEX IF NOT EXISTS kv_store_expires_idx ON kv_store(expires_at) WHERE expires_at IS NOT NULL;
  `);

  // Marketplace tables
  await client.exec(`
    CREATE TABLE IF NOT EXISTS publishers (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT NOT NULL,
      website_url TEXT,
      avatar_url TEXT,
      verified BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS publishers_slug_idx ON publishers(slug);
    CREATE INDEX IF NOT EXISTS publishers_org_idx ON publishers(org_id);

    CREATE TABLE IF NOT EXISTS marketplace_categories (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT NOT NULL,
      tool_count INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE UNIQUE INDEX IF NOT EXISTS marketplace_categories_slug_idx ON marketplace_categories(slug);

    CREATE TABLE IF NOT EXISTS marketplace_tools (
      id TEXT PRIMARY KEY,
      publisher_id TEXT NOT NULL,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      tagline TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      icon_url TEXT,
      openapi_spec TEXT NOT NULL DEFAULT '{}',
      base_url TEXT NOT NULL,
      is_internal BOOLEAN NOT NULL DEFAULT FALSE,
      is_proxied BOOLEAN NOT NULL DEFAULT TRUE,
      status TEXT NOT NULL DEFAULT 'draft',
      version TEXT NOT NULL DEFAULT '1.0.0',
      total_calls INTEGER NOT NULL DEFAULT 0,
      monthly_calls INTEGER NOT NULL DEFAULT 0,
      avg_response_ms INTEGER,
      rating REAL,
      rating_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      published_at TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX IF NOT EXISTS marketplace_tools_slug_idx ON marketplace_tools(slug);
    CREATE INDEX IF NOT EXISTS marketplace_tools_publisher_idx ON marketplace_tools(publisher_id);
    CREATE INDEX IF NOT EXISTS marketplace_tools_category_idx ON marketplace_tools(category);
    CREATE INDEX IF NOT EXISTS marketplace_tools_status_idx ON marketplace_tools(status);

    CREATE TABLE IF NOT EXISTS marketplace_endpoints (
      id TEXT PRIMARY KEY,
      tool_id TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      summary TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      request_schema TEXT NOT NULL DEFAULT '{}',
      response_schema TEXT NOT NULL DEFAULT '{}',
      scopes_required TEXT NOT NULL DEFAULT '[]'
    );
    CREATE INDEX IF NOT EXISTS marketplace_endpoints_tool_idx ON marketplace_endpoints(tool_id);

    CREATE TABLE IF NOT EXISTS marketplace_tags (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      name TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS marketplace_tags_slug_idx ON marketplace_tags(slug);

    CREATE TABLE IF NOT EXISTS marketplace_tool_tags (
      id TEXT PRIMARY KEY,
      tool_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      UNIQUE(tool_id, tag_id)
    );
    CREATE INDEX IF NOT EXISTS marketplace_tool_tags_tool_idx ON marketplace_tool_tags(tool_id);
    CREATE INDEX IF NOT EXISTS marketplace_tool_tags_tag_idx ON marketplace_tool_tags(tag_id);

    CREATE TABLE IF NOT EXISTS marketplace_ratings (
      id TEXT PRIMARY KEY,
      tool_id TEXT NOT NULL,
      org_id TEXT NOT NULL,
      rating INTEGER NOT NULL,
      review TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(tool_id, org_id)
    );
    CREATE INDEX IF NOT EXISTS marketplace_ratings_tool_idx ON marketplace_ratings(tool_id);
  `);

  // Billing / metering tables (Stripe agent payment rails)
  await client.exec(`
    CREATE TABLE IF NOT EXISTS tool_pricing (
      id TEXT PRIMARY KEY,
      tool_slug TEXT NOT NULL,
      publisher_id TEXT NOT NULL,
      price_per_call_micro INTEGER NOT NULL DEFAULT 0,
      free_tier_calls INTEGER NOT NULL DEFAULT 1000,
      stripe_price_id TEXT,
      stripe_meter_id TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS tool_pricing_tool_slug_idx ON tool_pricing(tool_slug);
    CREATE INDEX IF NOT EXISTS tool_pricing_publisher_idx ON tool_pricing(publisher_id);

    CREATE TABLE IF NOT EXISTS billing_events (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      tool_slug TEXT NOT NULL,
      api_key_id TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      response_ms INTEGER,
      reported BOOLEAN NOT NULL DEFAULT FALSE,
      stripe_meter_event_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS billing_events_org_idx ON billing_events(org_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS billing_events_tool_idx ON billing_events(tool_slug, created_at DESC);
    CREATE INDEX IF NOT EXISTS billing_events_unreported_idx ON billing_events(reported) WHERE reported = FALSE;

    CREATE TABLE IF NOT EXISTS billing_meters (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      tool_slug TEXT NOT NULL,
      period TEXT NOT NULL,
      calls INTEGER NOT NULL DEFAULT 0,
      billable_calls INTEGER NOT NULL DEFAULT 0,
      total_ms INTEGER NOT NULL DEFAULT 0,
      billed_amount_cents INTEGER NOT NULL DEFAULT 0,
      billing_status TEXT NOT NULL DEFAULT 'pending',
      stripe_record_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(org_id, tool_slug, period)
    );
    CREATE INDEX IF NOT EXISTS billing_meters_org_idx ON billing_meters(org_id);
    CREATE INDEX IF NOT EXISTS billing_meters_status_idx ON billing_meters(billing_status);

    CREATE TABLE IF NOT EXISTS revenue_share (
      id TEXT PRIMARY KEY,
      publisher_id TEXT NOT NULL,
      period TEXT NOT NULL,
      gross_amount_cents INTEGER NOT NULL DEFAULT 0,
      share_pct REAL NOT NULL DEFAULT 70,
      net_amount_cents INTEGER NOT NULL DEFAULT 0,
      stripe_transfer_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(publisher_id, period)
    );
    CREATE INDEX IF NOT EXISTS revenue_share_publisher_idx ON revenue_share(publisher_id);
    CREATE INDEX IF NOT EXISTS revenue_share_status_idx ON revenue_share(status);
  `);

  // Shorten API tables
  await client.exec(`
    CREATE TABLE IF NOT EXISTS shortened_urls (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      original_url TEXT NOT NULL,
      org_id TEXT NOT NULL,
      click_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS shortened_urls_code_idx ON shortened_urls(code);
    CREATE INDEX IF NOT EXISTS shortened_urls_org_idx ON shortened_urls(org_id);
  `);

  // Seed Solve categories
  await client.exec(`
    INSERT INTO solve_categories (id, name, slug, description, icon, sort_order) VALUES
      ('cat_automation', 'Automation',  'automation', 'Workflow orchestration, task chaining, triggers',        '⚙️',  1),
      ('cat_data',       'Data',        'data',       'Parsing, transformation, analysis, pipelines',           '📊',  2),
      ('cat_web',        'Web',         'web',        'Scraping, APIs, HTTP, browser automation',               '🌐',  3),
      ('cat_scheduling', 'Scheduling',  'scheduling', 'Calendar, booking, time management, reminders',          '📅',  4),
      ('cat_content',    'Content',     'content',    'Writing, generation, summarization, translation',        '✍️',  5),
      ('cat_devtools',   'Dev Tools',   'dev-tools',  'Programming, debugging, architecture, DevOps',           '🛠️',  6),
      ('cat_business',   'Business',    'business',   'Strategy, operations, finance, project management',      '💼',  7),
      ('cat_general',    'General',     'general',    'Everything that does not fit another category',          '💡',  8)
    ON CONFLICT (id) DO NOTHING;
  `);

  // Seed marketplace: system org, publisher, categories, 23 internal tools
  await client.exec(`
    INSERT INTO orgs (id, name, slug, plan) VALUES
      ('org_system', 'UnClick System', 'unclick-system', 'pro')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO publishers (id, org_id, display_name, slug, description, website_url, verified, created_at, updated_at) VALUES
      ('pub_unclick', 'org_system', 'UnClick', 'unclick', 'Official UnClick developer tools — agent-native APIs for every workflow.', 'https://unclick.dev', TRUE, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO marketplace_categories (id, slug, name, description, icon, tool_count, sort_order) VALUES
      ('mpcat_utility',      'utility',      'Utility',      'General-purpose tools: UUIDs, encoding, randomness, timestamps',      '🔧', 4, 1),
      ('mpcat_text',         'text',         'Text',         'Text processing: transform, markdown, diff, regex',                   '📝', 4, 2),
      ('mpcat_data',         'data',         'Data',         'Data tools: JSON, CSV, key-value storage, validation',                '📊', 4, 3),
      ('mpcat_media',        'media',        'Media',        'Media generation: images, QR codes, color utilities',                 '🎨', 3, 4),
      ('mpcat_network',      'network',      'Network',      'Network tools: URL shortener, IP lookup, webhooks, cron',             '🌐', 4, 5),
      ('mpcat_productivity', 'productivity', 'Productivity', 'Productivity: link pages, scheduling, AI problem solving',            '🚀', 3, 6),
      ('mpcat_security',     'security',     'Security',     'Security primitives: hashing, HMAC verification',                    '🔒', 1, 7)
    ON CONFLICT (id) DO NOTHING;
  `);

  await client.exec(`
    INSERT INTO marketplace_tools (id, publisher_id, slug, name, tagline, description, category, base_url, is_internal, is_proxied, status, version, created_at, updated_at, published_at) VALUES
      ('mpt_shorten',    'pub_unclick', 'unclick-shorten',    'URL Shortener',      'Create short, trackable links instantly',                              'Generate short URLs with click tracking. Redirect, analyze, and manage your links programmatically.',                              'network',      '/v1/shorten',    TRUE, FALSE, 'approved', '1.0.0', NOW(), NOW(), NOW()),
      ('mpt_qr',         'pub_unclick', 'unclick-qr',         'QR Code Generator',  'Generate QR codes from any URL or text',                               'Create customizable QR codes as PNG images. Supports URLs, plain text, and arbitrary data.',                                    'media',        '/v1/qr',         TRUE, FALSE, 'approved', '1.0.0', NOW(), NOW(), NOW()),
      ('mpt_hash',       'pub_unclick', 'unclick-hash',       'Hash & HMAC',        'Compute and verify cryptographic hashes',                              'Hash text with MD5, SHA-1, SHA-256, or SHA-512. Verify hashes and compute HMACs for message integrity.',                        'security',     '/v1/hash',       TRUE, FALSE, 'approved', '1.0.0', NOW(), NOW(), NOW()),
      ('mpt_encode',     'pub_unclick', 'unclick-encode',     'Encode / Decode',    'Base64, URL, HTML, and hex encoding utilities',                        'Encode and decode data in Base64, URL encoding, HTML entities, and hexadecimal formats.',                                      'utility',      '/v1',            TRUE, FALSE, 'approved', '1.0.0', NOW(), NOW(), NOW()),
      ('mpt_transform',  'pub_unclick', 'unclick-transform',  'Text Transform',     'Case, whitespace, and structural text transformations',                'Transform text: uppercase, lowercase, camelCase, snake_case, slug, truncate, reverse, and more.',                              'text',         '/v1/transform',  TRUE, FALSE, 'approved', '1.0.0', NOW(), NOW(), NOW()),
      ('mpt_validate',   'pub_unclick', 'unclick-validate',   'Input Validator',    'Validate emails, URLs, UUIDs, IPs, and more',                          'Validate common input formats: email, URL, UUID, IP address, credit card, ISBN, and postal codes.',                            'data',         '/v1/validate',   TRUE, FALSE, 'approved', '1.0.0', NOW(), NOW(), NOW()),
      ('mpt_uuid',       'pub_unclick', 'unclick-uuid',       'UUID Generator',     'Generate v4, v5, and bulk UUIDs',                                      'Generate RFC-4122 UUIDs in v4 (random) or v5 (namespace) formats. Supports bulk generation.',                                  'utility',      '/v1/uuid',       TRUE, FALSE, 'approved', '1.0.0', NOW(), NOW(), NOW()),
      ('mpt_timestamp',  'pub_unclick', 'unclick-timestamp',  'Timestamp',          'Convert and format Unix timestamps',                                   'Convert between Unix timestamps, ISO 8601, and human-readable formats across timezones.',                                      'utility',      '/v1/timestamp',  TRUE, FALSE, 'approved', '1.0.0', NOW(), NOW(), NOW()),
      ('mpt_random',     'pub_unclick', 'unclick-random',     'Random Generator',   'CSPRNG-backed random numbers, strings, and picks',                     'Generate cryptographically secure random integers, floats, strings, UUIDs, and pick from arrays.',                            'utility',      '/v1/random',     TRUE, FALSE, 'approved', '1.0.0', NOW(), NOW(), NOW()),
      ('mpt_image',      'pub_unclick', 'unclick-image',      'Image Processor',    'Resize, convert, and process images via API',                          'Resize, crop, convert formats, adjust quality, and apply filters to images via API.',                                          'media',        '/v1/image',      TRUE, FALSE, 'approved', '1.0.0', NOW(), NOW(), NOW()),
      ('mpt_csv',        'pub_unclick', 'unclick-csv',        'CSV Processor',      'Parse, filter, sort, and transform CSV data',                          'Parse CSV to JSON, filter rows, sort columns, and export back to CSV. Handles large files.',                                   'data',         '/v1/csv',        TRUE, FALSE, 'approved', '1.0.0', NOW(), NOW(), NOW()),
      ('mpt_json',       'pub_unclick', 'unclick-json',       'JSON Utility',       'Format, validate, query, and diff JSON',                               'Pretty-print, minify, validate, extract values with JSONPath, and diff two JSON structures.',                                  'data',         '/v1/json',       TRUE, FALSE, 'approved', '1.0.0', NOW(), NOW(), NOW()),
      ('mpt_markdown',   'pub_unclick', 'unclick-markdown',   'Markdown',           'Render Markdown to HTML',                                              'Convert GitHub-flavoured Markdown to sanitized HTML. Supports tables, code fences, and task lists.',                           'text',         '/v1/markdown',   TRUE, FALSE, 'approved', '1.0.0', NOW(), NOW(), NOW()),
      ('mpt_diff',       'pub_unclick', 'unclick-diff',       'Text Diff',          'Compute line-by-line and word-level diffs',                            'Compare two strings and get structured or unified diff output. Supports line, word, and char modes.',                           'text',         '/v1/diff',       TRUE, FALSE, 'approved', '1.0.0', NOW(), NOW(), NOW()),
      ('mpt_cron',       'pub_unclick', 'unclick-cron',       'Cron Parser',        'Parse, validate, and describe cron expressions',                       'Parse cron expressions, get next N run times, validate syntax, and translate to human language.',                              'network',      '/v1/cron',       TRUE, FALSE, 'approved', '1.0.0', NOW(), NOW(), NOW()),
      ('mpt_kv',         'pub_unclick', 'unclick-kv',         'Key-Value Store',    'Persistent key-value scratchpad with TTL and prefix filtering',        'Set, get, delete, list, and atomically increment values. Supports TTL, prefix filtering, and bulk ops.',                       'data',         '/v1/kv',         TRUE, FALSE, 'approved', '1.0.0', NOW(), NOW(), NOW()),
      ('mpt_regex',      'pub_unclick', 'unclick-regex',      'Regex Tester',       'Test, match, and replace with regular expressions',                    'Test regex patterns against strings, extract matches and capture groups, and perform replacements.',                            'text',         '/v1/regex',      TRUE, FALSE, 'approved', '1.0.0', NOW(), NOW(), NOW()),
      ('mpt_color',      'pub_unclick', 'unclick-color',      'Color Converter',    'Convert, mix, and generate color palettes',                            'Convert between HEX, RGB, HSL, and HSV. Generate palettes, compute contrast ratios, and mix colors.',                         'media',        '/v1/color',      TRUE, FALSE, 'approved', '1.0.0', NOW(), NOW(), NOW()),
      ('mpt_ip',         'pub_unclick', 'unclick-ip',         'IP Lookup',          'Parse and analyze IPv4/IPv6 addresses',                                'Parse IPv4/IPv6 addresses, check CIDR membership, classify address types, and look up request IP.',                            'network',      '/v1/ip',         TRUE, FALSE, 'approved', '1.0.0', NOW(), NOW(), NOW()),
      ('mpt_links',      'pub_unclick', 'unclick-links',      'Link-in-Bio',        'Create and manage link-in-bio pages',                                  'Build link pages with custom themes, social links, analytics, A/B testing, and custom domains.',                               'productivity', '/v1/links',      TRUE, FALSE, 'approved', '1.0.0', NOW(), NOW(), NOW()),
      ('mpt_scheduling', 'pub_unclick', 'unclick-scheduling', 'Scheduling',         'Availability management and booking for AI agents',                    'Set availability schedules, create bookable event types, and accept bookings with custom intake forms.',                       'productivity', '/v1/scheduling', TRUE, FALSE, 'approved', '1.0.0', NOW(), NOW(), NOW()),
      ('mpt_solve',      'pub_unclick', 'unclick-solve',      'Solve',              'AI agent problem-solving forum with reputation scoring',               'Post problems for AI agents to solve. Agents compete, get scored, and build reputation over time.',                            'productivity', '/v1/solve',      TRUE, FALSE, 'approved', '1.0.0', NOW(), NOW(), NOW()),
      ('mpt_webhook',    'pub_unclick', 'unclick-webhook',    'Webhook Bin',        'Capture and inspect incoming HTTP requests',                           'Create temporary webhook endpoints to capture, inspect, and replay HTTP requests.',                                            'network',      '/v1/webhook',    TRUE, FALSE, 'approved', '1.0.0', NOW(), NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `);

  // Seed primary endpoints for each internal tool
  await client.exec(`
    INSERT INTO marketplace_endpoints (id, tool_id, method, path, summary, scopes_required) VALUES
      ('mpe_shorten_create',      'mpt_shorten',    'POST', '/v1/shorten',               'Create a shortened URL',             '["shorten:write"]'),
      ('mpe_shorten_list',        'mpt_shorten',    'GET',  '/v1/shorten',               'List shortened URLs',                '["shorten:read"]'),
      ('mpe_shorten_delete',      'mpt_shorten',    'DELETE','/v1/shorten/:id',           'Delete a shortened URL',             '["shorten:write"]'),
      ('mpe_qr_generate',         'mpt_qr',         'POST', '/v1/qr',                    'Generate a QR code PNG',             '["qr:use"]'),
      ('mpe_hash_compute',        'mpt_hash',       'POST', '/v1/hash',                  'Compute a hash',                     '["hash:use"]'),
      ('mpe_hash_verify',         'mpt_hash',       'POST', '/v1/hash/verify',           'Verify a hash',                      '["hash:use"]'),
      ('mpe_hash_hmac',           'mpt_hash',       'POST', '/v1/hash/hmac',             'Compute an HMAC',                    '["hash:use"]'),
      ('mpe_encode_base64',       'mpt_encode',     'POST', '/v1/encode/base64',         'Base64-encode a string',             '["encode:use"]'),
      ('mpe_decode_base64',       'mpt_encode',     'POST', '/v1/decode/base64',         'Base64-decode a string',             '["encode:use"]'),
      ('mpe_encode_url',          'mpt_encode',     'POST', '/v1/encode/url',            'URL-encode a string',                '["encode:use"]'),
      ('mpe_transform',           'mpt_transform',  'POST', '/v1/transform',             'Transform text',                     '["transform:use"]'),
      ('mpe_validate',            'mpt_validate',   'POST', '/v1/validate',              'Validate an input value',            '["validate:use"]'),
      ('mpe_uuid_generate',       'mpt_uuid',       'POST', '/v1/uuid',                  'Generate one or more UUIDs',         '["uuid:use"]'),
      ('mpe_timestamp_convert',   'mpt_timestamp',  'POST', '/v1/timestamp/convert',     'Convert a timestamp',                '["timestamp:use"]'),
      ('mpe_timestamp_now',       'mpt_timestamp',  'GET',  '/v1/timestamp/now',         'Get the current timestamp',          '["timestamp:use"]'),
      ('mpe_random_integer',      'mpt_random',     'POST', '/v1/random/integer',        'Generate a random integer',          '["random:use"]'),
      ('mpe_random_string',       'mpt_random',     'POST', '/v1/random/string',         'Generate a random string',           '["random:use"]'),
      ('mpe_random_pick',         'mpt_random',     'POST', '/v1/random/pick',           'Pick random items from an array',    '["random:use"]'),
      ('mpe_image_resize',        'mpt_image',      'POST', '/v1/image/resize',          'Resize an image',                    '["image:use"]'),
      ('mpe_image_convert',       'mpt_image',      'POST', '/v1/image/convert',         'Convert image format',               '["image:use"]'),
      ('mpe_csv_parse',           'mpt_csv',        'POST', '/v1/csv/parse',             'Parse CSV to JSON',                  '["csv:use"]'),
      ('mpe_csv_export',          'mpt_csv',        'POST', '/v1/csv/export',            'Export JSON array to CSV',           '["csv:use"]'),
      ('mpe_json_format',         'mpt_json',       'POST', '/v1/json/format',           'Pretty-print or minify JSON',        '["json:use"]'),
      ('mpe_json_validate',       'mpt_json',       'POST', '/v1/json/validate',         'Validate a JSON string',             '["json:use"]'),
      ('mpe_json_query',          'mpt_json',       'POST', '/v1/json/query',            'Query JSON with JSONPath',           '["json:use"]'),
      ('mpe_markdown_render',     'mpt_markdown',   'POST', '/v1/markdown/render',       'Render Markdown to HTML',            '["markdown:use"]'),
      ('mpe_diff',                'mpt_diff',       'POST', '/v1/diff',                  'Compute a text diff',                '["diff:use"]'),
      ('mpe_cron_parse',          'mpt_cron',       'POST', '/v1/cron/parse',            'Parse a cron expression',            '["cron:use"]'),
      ('mpe_cron_next',           'mpt_cron',       'POST', '/v1/cron/next',             'Get next N scheduled times',         '["cron:use"]'),
      ('mpe_kv_set',              'mpt_kv',         'POST', '/v1/kv/set',                'Set a key-value pair',               '["kv:write"]'),
      ('mpe_kv_get',              'mpt_kv',         'POST', '/v1/kv/get',                'Get a value by key',                 '["kv:read"]'),
      ('mpe_kv_delete',           'mpt_kv',         'POST', '/v1/kv/delete',             'Delete a key',                       '["kv:write"]'),
      ('mpe_kv_list',             'mpt_kv',         'POST', '/v1/kv/list',               'List keys with optional prefix',     '["kv:read"]'),
      ('mpe_kv_increment',        'mpt_kv',         'POST', '/v1/kv/increment',          'Atomically increment a numeric key', '["kv:write"]'),
      ('mpe_regex_test',          'mpt_regex',      'POST', '/v1/regex/test',            'Test a regex against a string',      '["regex:use"]'),
      ('mpe_regex_replace',       'mpt_regex',      'POST', '/v1/regex/replace',         'Replace matches in a string',        '["regex:use"]'),
      ('mpe_color_convert',       'mpt_color',      'POST', '/v1/color/convert',         'Convert a color between formats',    '["color:use"]'),
      ('mpe_color_palette',       'mpt_color',      'POST', '/v1/color/palette',         'Generate a color palette',           '["color:use"]'),
      ('mpe_ip_parse',            'mpt_ip',         'POST', '/v1/ip/parse',              'Parse an IP address',                '["ip:use"]'),
      ('mpe_ip_me',               'mpt_ip',         'GET',  '/v1/ip/me',                 'Get the caller''s IP info',          '["ip:use"]'),
      ('mpe_links_pages_list',    'mpt_links',      'GET',  '/v1/links/pages',           'List link pages',                    '["links:read"]'),
      ('mpe_links_pages_create',  'mpt_links',      'POST', '/v1/links/pages',           'Create a link page',                 '["links:write"]'),
      ('mpe_scheduling_create',   'mpt_scheduling', 'POST', '/v1/scheduling/bookings',   'Create a booking',                   '["scheduling:write"]'),
      ('mpe_scheduling_list',     'mpt_scheduling', 'GET',  '/v1/scheduling/bookings',   'List bookings',                      '["scheduling:read"]'),
      ('mpe_solve_problems',      'mpt_solve',      'GET',  '/v1/solve/problems',        'List open problems',                 '[]'),
      ('mpe_solve_post',          'mpt_solve',      'POST', '/v1/solve/problems',        'Post a new problem',                 '[]'),
      ('mpe_solve_solution',      'mpt_solve',      'POST', '/v1/solve/problems/:id/solutions', 'Submit a solution',           '["solve:write"]'),
      ('mpe_webhook_create',      'mpt_webhook',    'POST', '/v1/webhook/create',        'Create a webhook bin',               '["webhook:write"]'),
      ('mpe_webhook_requests',    'mpt_webhook',    'GET',  '/v1/webhook/:bin_id/requests', 'List captured requests',          '["webhook:read"]')
    ON CONFLICT (id) DO NOTHING;
  `);

  // Seed tool pricing — internal tools are free by default (billed at platform level)
  await client.exec(`
    INSERT INTO tool_pricing (id, tool_slug, publisher_id, price_per_call_micro, free_tier_calls, active, created_at, updated_at) VALUES
      ('tp_shorten',    'unclick-shorten',    'pub_unclick', 0, 10000, TRUE, NOW(), NOW()),
      ('tp_qr',         'unclick-qr',         'pub_unclick', 0, 5000,  TRUE, NOW(), NOW()),
      ('tp_hash',       'unclick-hash',       'pub_unclick', 0, 50000, TRUE, NOW(), NOW()),
      ('tp_encode',     'unclick-encode',     'pub_unclick', 0, 50000, TRUE, NOW(), NOW()),
      ('tp_transform',  'unclick-transform',  'pub_unclick', 0, 50000, TRUE, NOW(), NOW()),
      ('tp_validate',   'unclick-validate',   'pub_unclick', 0, 50000, TRUE, NOW(), NOW()),
      ('tp_uuid',       'unclick-uuid',       'pub_unclick', 0, 50000, TRUE, NOW(), NOW()),
      ('tp_timestamp',  'unclick-timestamp',  'pub_unclick', 0, 50000, TRUE, NOW(), NOW()),
      ('tp_random',     'unclick-random',     'pub_unclick', 0, 50000, TRUE, NOW(), NOW()),
      ('tp_image',      'unclick-image',      'pub_unclick', 0, 2000,  TRUE, NOW(), NOW()),
      ('tp_csv',        'unclick-csv',        'pub_unclick', 0, 10000, TRUE, NOW(), NOW()),
      ('tp_json',       'unclick-json',       'pub_unclick', 0, 50000, TRUE, NOW(), NOW()),
      ('tp_markdown',   'unclick-markdown',   'pub_unclick', 0, 50000, TRUE, NOW(), NOW()),
      ('tp_diff',       'unclick-diff',       'pub_unclick', 0, 50000, TRUE, NOW(), NOW()),
      ('tp_cron',       'unclick-cron',       'pub_unclick', 0, 50000, TRUE, NOW(), NOW()),
      ('tp_kv',         'unclick-kv',         'pub_unclick', 0, 10000, TRUE, NOW(), NOW()),
      ('tp_regex',      'unclick-regex',      'pub_unclick', 0, 50000, TRUE, NOW(), NOW()),
      ('tp_color',      'unclick-color',      'pub_unclick', 0, 50000, TRUE, NOW(), NOW()),
      ('tp_ip',         'unclick-ip',         'pub_unclick', 0, 50000, TRUE, NOW(), NOW()),
      ('tp_links',      'unclick-links',      'pub_unclick', 0, 5000,  TRUE, NOW(), NOW()),
      ('tp_scheduling', 'unclick-scheduling', 'pub_unclick', 0, 2000,  TRUE, NOW(), NOW()),
      ('tp_solve',      'unclick-solve',      'pub_unclick', 0, 5000,  TRUE, NOW(), NOW()),
      ('tp_webhook',    'unclick-webhook',    'pub_unclick', 0, 5000,  TRUE, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
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

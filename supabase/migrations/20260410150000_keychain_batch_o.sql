INSERT INTO platform_connectors (id, name, category, auth_type, description, setup_url, test_endpoint, sort_order) VALUES
('pagerduty', 'PagerDuty', 'Monitoring', 'api_key', 'Incident management: list, create, acknowledge, and resolve incidents', 'https://app.pagerduty.com/api_keys', 'https://api.pagerduty.com/services', 85),
('circleci', 'CircleCI', 'CI/CD', 'api_key', 'Pipeline and workflow management: list, inspect, and trigger builds', 'https://app.circleci.com/settings/user/tokens', 'https://circleci.com/api/v2/me', 86),
('segment', 'Segment', 'Analytics', 'api_key', 'Track events, identify users, and manage sources and destinations', 'https://app.segment.com/goto-my-workspace/settings/access-management', 'https://api.segmentapis.com/workspaces', 87),
('postmark', 'Postmark', 'Email', 'api_key', 'Transactional email delivery with templates, batch sends, and delivery stats', 'https://account.postmarkapp.com/servers', 'https://api.postmarkapp.com/deliverystats', 88),
('gumroad', 'Gumroad', 'Commerce', 'api_key', 'Digital product sales: list products, browse sales, and view subscribers', 'https://app.gumroad.com/settings/advanced', 'https://api.gumroad.com/v2/user', 89),
('togetherai', 'Together AI', 'AI/ML', 'api_key', 'Open-source model inference: chat, completions, and embeddings', 'https://api.together.ai/settings/api-keys', 'https://api.together.xyz/v1/models', 90),
('resend', 'Resend', 'Email', 'api_key', 'Developer-first transactional email with domain management and email tracking', 'https://resend.com/api-keys', 'https://api.resend.com/domains', 91),
('postman', 'Postman', 'Developer Tools', 'api_key', 'Browse API collections, environments, and monitors in Postman', 'https://go.postman.co/settings/me/api-keys', 'https://api.getpostman.com/me', 92),
('sentry', 'Sentry', 'Monitoring', 'api_key', 'Application error monitoring: list projects, issues, and events', 'https://sentry.io/settings/account/api/auth-tokens/', 'https://sentry.io/api/0/organizations/', 93),
('notion', 'Notion', 'Productivity', 'api_key', 'Pages, databases, blocks, and workspace search', 'https://www.notion.so/my-integrations', 'https://api.notion.com/v1/users/me', 94)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  auth_type = EXCLUDED.auth_type,
  description = EXCLUDED.description,
  setup_url = EXCLUDED.setup_url,
  test_endpoint = EXCLUDED.test_endpoint,
  sort_order = EXCLUDED.sort_order;

INSERT INTO platform_connectors (id, name, category, auth_type, description, setup_url, test_endpoint, sort_order) VALUES
-- Communication
('slack', 'Slack', 'Communication', 'api_key', 'Send messages, manage channels, read conversations', 'https://api.slack.com/apps', 'https://slack.com/api/auth.test', 10),
('discord', 'Discord', 'Communication', 'api_key', 'Bots, messages, server management', 'https://discord.com/developers/applications', 'https://discord.com/api/v10/users/@me', 11),
('twilio', 'Twilio', 'Communication', 'api_key', 'SMS, voice calls, verify', 'https://console.twilio.com/', 'https://api.twilio.com/2010-04-01/Accounts', 12),

-- Productivity
('notion', 'Notion', 'Productivity', 'api_key', 'Pages, databases, blocks, search', 'https://www.notion.so/my-integrations', 'https://api.notion.com/v1/users/me', 20),
('airtable', 'Airtable', 'Productivity', 'api_key', 'Bases, tables, records, views', 'https://airtable.com/create/tokens', 'https://api.airtable.com/v0/meta/whoami', 21),
('linear', 'Linear', 'Productivity', 'api_key', 'Issues, projects, teams, cycles', 'https://linear.app/settings/api', 'https://api.linear.app/graphql', 22),

-- Business / E-commerce
('shopify', 'Shopify', 'Business', 'api_key', 'Products, orders, customers, inventory', 'https://partners.shopify.com/', 'https://{store}.myshopify.com/admin/api/2024-01/shop.json', 30),

-- AI/ML
('openai', 'OpenAI', 'AI/ML', 'api_key', 'GPT, DALL-E, Whisper, embeddings', 'https://platform.openai.com/api-keys', 'https://api.openai.com/v1/models', 40),
('anthropic', 'Anthropic', 'AI/ML', 'api_key', 'Claude models and messages API', 'https://console.anthropic.com/settings/keys', 'https://api.anthropic.com/v1/messages', 41),

-- Analytics
('umami', 'Umami', 'Analytics', 'api_key', 'Self-hosted web analytics', '', 'https://analytics.unclick.world/api/auth/verify', 50),

-- Business (Australian / Finance)
('xero', 'Xero', 'Business', 'oauth2', 'Invoices, contacts, bank feeds, reports', 'https://developer.xero.com/app/manage', '', 60),

-- Developer Tools / Hosting
('digitalocean', 'DigitalOcean', 'Developer Tools', 'api_key', 'Droplets, databases, spaces, domains', 'https://cloud.digitalocean.com/account/api/tokens', 'https://api.digitalocean.com/v2/account', 70),
('railway', 'Railway', 'Developer Tools', 'api_key', 'Deploy, services, variables, domains', 'https://railway.app/account/tokens', 'https://backboard.railway.app/graphql/v2', 71),
('netlify', 'Netlify', 'Developer Tools', 'api_key', 'Sites, deploys, forms, functions', 'https://app.netlify.com/user/applications', 'https://api.netlify.com/api/v1/sites', 72);

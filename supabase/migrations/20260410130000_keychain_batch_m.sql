INSERT INTO platform_connectors (id, name, category, auth_type, description, setup_url, test_endpoint, sort_order) VALUES
('mailchimp',  'Mailchimp',  'Marketing',    'api_key', 'Email marketing platform - campaigns, audiences, and subscribers', 'https://mailchimp.com/account/api-keys', 'https://login.mailchimp.com/oauth2/metadata', 85),
('sendgrid',   'SendGrid',   'Marketing',    'api_key', 'Transactional email and marketing platform by Twilio', 'https://app.sendgrid.com/settings/api-keys', 'https://api.sendgrid.com/v3/user/profile', 86),
('mapbox',     'Mapbox',     'Geo',          'api_key', 'Maps, geocoding, and navigation APIs', 'https://account.mapbox.com/access-tokens', 'https://api.mapbox.com/tokens/v2', 87),
('algolia',    'Algolia',    'Search',       'api_key', 'Hosted search and discovery API', 'https://dashboard.algolia.com/account/api-keys', 'https://status.algolia.com', 88),
('pinecone',   'Pinecone',   'AI/ML',        'api_key', 'Vector database for AI-native similarity search', 'https://app.pinecone.io', 'https://api.pinecone.io/indexes', 89),
('mixpanel',   'Mixpanel',   'Analytics',    'api_key', 'Product analytics - events, funnels, and retention', 'https://mixpanel.com/settings/service-accounts', 'https://data.mixpanel.com/api/2.0/events', 90),
('datadog',    'Datadog',    'Observability','api_key', 'Infrastructure and application monitoring', 'https://app.datadoghq.com/organization-settings/api-keys', 'https://api.datadoghq.com/api/v1/validate', 91),
('deepl',      'DeepL',      'Text',         'api_key', 'Neural machine translation for 30+ languages', 'https://www.deepl.com/pro-api', 'https://api-free.deepl.com/v2/usage', 92),
('assemblyai', 'AssemblyAI', 'AI/ML',        'api_key', 'Speech-to-text with AI summarization and analysis', 'https://www.assemblyai.com/dashboard', 'https://api.assemblyai.com/v2/transcript', 93),
('groq',       'Groq',       'AI/ML',        'api_key', 'Ultra-fast LLM inference on LPU hardware', 'https://console.groq.com/keys', 'https://api.groq.com/openai/v1/models', 94);

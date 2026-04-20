-- Expand BackstagePass (Keychain) connector catalog.
-- Adds connectors that match Chris's real stack + fill obvious gaps in
-- AI/ML, Productivity, and Developer Tools categories. All entries are
-- idempotent via ON CONFLICT DO UPDATE so the migration is safe to re-run.
--
-- Sort order starts at 100 to sit cleanly after batch-o (ended at 94).

INSERT INTO platform_connectors (id, name, category, auth_type, description, setup_url, test_endpoint, sort_order) VALUES
  ('google-gemini',     'Google Gemini',     'AI/ML',            'api_key', 'Google Generative AI (Gemini) models: chat, vision, embeddings', 'https://aistudio.google.com/api-keys',                 'https://generativelanguage.googleapis.com/v1beta/models', 100),
  ('google-workspace',  'Google Workspace',  'Productivity',     'oauth',   'Gmail, Calendar, Drive, Docs, Sheets via Google OAuth',           'https://console.cloud.google.com/apis/credentials',    'https://www.googleapis.com/oauth2/v1/tokeninfo',          101),
  ('microsoft-graph',   'Microsoft 365',     'Productivity',     'oauth',   'Outlook, Teams, Excel, OneDrive, SharePoint via Microsoft Graph', 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade', 'https://graph.microsoft.com/v1.0/me',                    102),
  ('npm',               'npm',               'Developer Tools',  'api_key', 'Publish and manage npm packages; read download stats',            'https://www.npmjs.com/settings/~/tokens',              'https://registry.npmjs.org/-/whoami',                     103),
  ('huggingface',       'Hugging Face',      'AI/ML',            'api_key', 'Model hub, inference endpoints, datasets, and spaces',            'https://huggingface.co/settings/tokens',               'https://huggingface.co/api/whoami-v2',                    104),
  ('openrouter',        'OpenRouter',        'AI/ML',            'api_key', 'Unified API for 100+ LLMs: chat, completions, routing',           'https://openrouter.ai/keys',                            'https://openrouter.ai/api/v1/auth/key',                   105),
  ('replicate',         'Replicate',         'AI/ML',            'api_key', 'Run open-source models via API: image, video, audio, LLMs',       'https://replicate.com/account/api-tokens',              'https://api.replicate.com/v1/account',                    106),
  ('elevenlabs',        'ElevenLabs',        'AI/ML',            'api_key', 'Realistic AI voice generation, cloning, and dubbing',             'https://elevenlabs.io/app/settings/api-keys',           'https://api.elevenlabs.io/v1/user',                       107),
  ('deepgram',          'Deepgram',          'AI/ML',            'api_key', 'Speech-to-text, TTS, and real-time audio transcription',          'https://console.deepgram.com/project/default/api-keys', 'https://api.deepgram.com/v1/projects',                    108),
  ('hubspot',           'HubSpot',           'Business',         'api_key', 'CRM: contacts, companies, deals, tickets, and marketing',         'https://app.hubspot.com/settings/account/api',          'https://api.hubapi.com/account-info/v3/details',          109),
  ('clerk',             'Clerk',             'Developer Tools',  'api_key', 'User auth: session management, user lists, magic links',          'https://dashboard.clerk.com/last-active?path=api-keys', 'https://api.clerk.com/v1/users?limit=1',                  110),
  ('auth0',             'Auth0',             'Developer Tools',  'api_key', 'Identity platform: users, roles, rules, and log streams',         'https://manage.auth0.com/dashboard',                    'https://{tenant}.auth0.com/api/v2/users?per_page=1',      111),
  ('asana',             'Asana',             'Productivity',     'api_key', 'Projects, tasks, workspaces, and teams in Asana',                 'https://app.asana.com/0/my-apps',                       'https://app.asana.com/api/1.0/users/me',                  112),
  ('trello',            'Trello',            'Productivity',     'api_key', 'Boards, lists, cards, and members in Trello',                      'https://trello.com/app-key',                            'https://api.trello.com/1/members/me',                     113),
  ('intercom',          'Intercom',          'Business',         'api_key', 'Customer messaging: conversations, contacts, and articles',       'https://app.intercom.com/a/apps/_/settings/developers', 'https://api.intercom.io/me',                              114),
  ('planetscale',       'PlanetScale',       'Developer Tools',  'api_key', 'Serverless MySQL: databases, branches, deploy requests',          'https://app.planetscale.com/user/settings/tokens',      'https://api.planetscale.com/v1/organizations',            115)
ON CONFLICT (id) DO UPDATE SET
  name          = EXCLUDED.name,
  category      = EXCLUDED.category,
  auth_type     = EXCLUDED.auth_type,
  description   = EXCLUDED.description,
  setup_url     = EXCLUDED.setup_url,
  test_endpoint = EXCLUDED.test_endpoint,
  sort_order    = EXCLUDED.sort_order;

import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { initDb, seedDevOrg } from './db/index.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const isDev = process.env.NODE_ENV !== 'production';

async function main() {
  console.log('[unclick-api] Starting...');

  // Init DB tables
  await initDb();
  console.log('[unclick-api] Database ready');

  if (isDev) {
    const devKey = await seedDevOrg();
    console.log('\n[unclick-api] Dev mode : test credentials:');
    console.log(`  API Key: ${devKey}`);
    console.log(`  Header:  Authorization: Bearer ${devKey}\n`);
  }

  const app = createApp();

  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`[unclick-api] Running at http://localhost:${PORT}`);
    console.log(`[unclick-api] Health: http://localhost:${PORT}/health`);
    if (isDev) {
      console.log(`[unclick-api] Try: curl http://localhost:${PORT}/health`);
    }
  });
}

main().catch((err) => {
  console.error('[unclick-api] Fatal startup error:', err);
  process.exit(1);
});

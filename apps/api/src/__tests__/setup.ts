import { initDb, seedDevOrg } from '../db/index.js';

let initialized = false;

export async function setupTestDb(): Promise<string> {
  if (!initialized) {
    await initDb();
    initialized = true;
  }
  return seedDevOrg();
}

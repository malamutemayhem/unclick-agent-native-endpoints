import { ulid } from 'ulid';
import { createHash, randomBytes } from 'node:crypto';

export type KeyEnvironment = 'live' | 'test';

export interface GeneratedKey {
  /** The full plaintext key — shown once, never stored */
  key: string;
  /** First 8 chars of the random portion — used for UI identification */
  prefix: string;
  /** SHA-256 hex of the full key — stored in the database */
  hash: string;
  environment: KeyEnvironment;
}

export function generateApiKey(env: KeyEnvironment = 'live'): GeneratedKey {
  const random = randomBytes(32).toString('base64url');
  const key = `agt_${env}_${random}`;
  const prefix = random.slice(0, 8);
  const hash = hashKey(key);
  return { key, prefix, hash, environment: env };
}

export function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/** Generate a ULID for use as a row ID */
export function newId(): string {
  return ulid();
}

/** Validate the format of an API key without hitting the DB */
export function isValidKeyFormat(key: string): boolean {
  return /^agt_(live|test)_[A-Za-z0-9_-]{40,}$/.test(key);
}

/** Extract environment from a key string */
export function keyEnvironment(key: string): KeyEnvironment | null {
  if (key.startsWith('agt_live_')) return 'live';
  if (key.startsWith('agt_test_')) return 'test';
  return null;
}

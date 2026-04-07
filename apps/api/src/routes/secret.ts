import { Hono } from 'hono';
import { z } from 'zod';
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes, createHash } from 'node:crypto';
import { eq, and, or, isNull, gt, sql } from 'drizzle-orm';
import { ok, Errors, newId } from '@unclick/core';
import type { Db } from '../db/index.js';
import { secrets } from '../db/schema.js';
import type { AppVariables } from '../middleware/types.js';
import { requireScope } from '../middleware/auth.js';
import { zv } from '../middleware/validate.js';

// ─── Crypto helpers ───────────────────────────────────────────────────────────

// Number of PBKDF2 iterations - can be lowered via env for tests.
const PBKDF2_ITERATIONS = parseInt(process.env.PBKDF2_ITERATIONS ?? '100000', 10);

// Server-side secret blended into key derivation so DB-only access is insufficient.
const SERVER_SECRET = process.env.SECRET_ENCRYPTION_KEY ?? 'unclick-dev-secret-change-in-prod-!!';

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return pbkdf2Sync(SERVER_SECRET + passphrase, salt, PBKDF2_ITERATIONS, 32, 'sha256');
}

function encrypt(plaintext: string, passphrase: string): {
  encrypted: string;
  iv: string;
  salt: string;
  authTag: string;
} {
  const salt = randomBytes(16);
  const iv = randomBytes(12); // 96-bit IV for GCM
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    encrypted: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    salt: salt.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

function decrypt(
  encryptedB64: string,
  ivB64: string,
  saltB64: string,
  authTagB64: string,
  passphrase: string,
): string {
  const key = deriveKey(passphrase, Buffer.from(saltB64, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, 'base64')),
    decipher.final(),
  ]);
  return plain.toString('utf8');
}

function hashPassphrase(passphrase: string): string {
  return createHash('sha256').update(passphrase).digest('hex');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function notViewedOrExpired() {
  return and(
    eq(secrets.viewed, false),
    or(isNull(secrets.expiresAt), gt(secrets.expiresAt, sql`NOW()`))!,
  )!;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const CreateSchema = z.object({
  text: z.string().min(1).max(100_000),
  passphrase: z.string().min(1).max(1024).optional(),
  expiry_hours: z.number().int().min(1).max(168).default(24), // max 7 days
});

const ViewSchema = z.object({
  id: z.string().min(1),
  passphrase: z.string().min(1).max(1024).optional(),
});

const ExistsSchema = z.object({
  id: z.string().min(1),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export function createSecretRouter(db: Db) {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /secret/create - create a one-time secret
  router.post('/create', requireScope('secret:write'), zv('json', CreateSchema), async (c) => {
    const { orgId } = c.get('org');
    const { text, passphrase, expiry_hours } = c.req.valid('json');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiry_hours * 60 * 60 * 1000);
    const id = `sec_${newId()}`;

    const { encrypted, iv, salt, authTag } = encrypt(text, passphrase ?? '');
    const passphraseHash = passphrase ? hashPassphrase(passphrase) : null;

    await db.insert(secrets).values({
      id,
      orgId,
      encryptedContent: encrypted,
      iv,
      salt,
      authTag,
      passphraseHash,
      viewed: false,
      createdAt: now,
      expiresAt,
    });

    return ok(c, {
      id,
      has_passphrase: !!passphrase,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      url: `/v1/secret/view`,
    });
  });

  // POST /secret/view - view and immediately destroy a secret
  router.post('/view', requireScope('secret:read'), zv('json', ViewSchema), async (c) => {
    const { id, passphrase } = c.req.valid('json');

    const [row] = await db
      .select()
      .from(secrets)
      .where(and(eq(secrets.id, id), notViewedOrExpired()))
      .limit(1);

    if (!row) throw Errors.notFound('Secret not found, already viewed, or expired');

    // If secret was created with a passphrase, verify it before decrypting.
    if (row.passphraseHash !== null) {
      if (!passphrase) {
        throw Errors.forbidden('This secret requires a passphrase');
      }
      if (hashPassphrase(passphrase) !== row.passphraseHash) {
        throw Errors.forbidden('Incorrect passphrase');
      }
    }

    // Decrypt the secret.
    let text: string;
    try {
      text = decrypt(
        row.encryptedContent,
        row.iv,
        row.salt,
        row.authTag,
        passphrase ?? '',
      );
    } catch {
      throw Errors.forbidden('Decryption failed - passphrase may be incorrect');
    }

    // Mark as viewed immediately (one-read guarantee).
    await db
      .update(secrets)
      .set({ viewed: true })
      .where(eq(secrets.id, id));

    return ok(c, {
      id,
      text,
      viewed_at: new Date().toISOString(),
    });
  });

  // POST /secret/exists - check if a secret exists without revealing its content
  router.post('/exists', requireScope('secret:read'), zv('json', ExistsSchema), async (c) => {
    const { id } = c.req.valid('json');

    const [row] = await db
      .select({ id: secrets.id, passphraseHash: secrets.passphraseHash, expiresAt: secrets.expiresAt })
      .from(secrets)
      .where(and(eq(secrets.id, id), notViewedOrExpired()))
      .limit(1);

    return ok(c, {
      id,
      exists: !!row,
      has_passphrase: row ? row.passphraseHash !== null : null,
      expires_at: row?.expiresAt?.toISOString() ?? null,
    });
  });

  return router;
}

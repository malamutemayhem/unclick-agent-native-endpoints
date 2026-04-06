import { Hono } from 'hono';
import { z } from 'zod';
import QRCode from 'qrcode';
import { Errors } from '@unclick/core';
import type { Db } from '../db/index.js';
import type { AppVariables } from '../middleware/types.js';
import { requireScope } from '../middleware/auth.js';
import { zv } from '../middleware/validate.js';

const GenerateQrSchema = z.object({
  text: z.string().min(1, 'text is required').max(2000, 'text must be 2000 characters or fewer'),
  format: z.enum(['png', 'svg']).default('png'),
  size: z.number().int().min(100).max(1000).default(300),
  margin: z.number().int().min(0).max(10).default(2),
});

// db is accepted to match the createXxxRouter(db: Db) convention used by all other routers
export function createQrRouter(_db: Db) {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST / — generate a QR code; returns image bytes (PNG or SVG)
  router.post('/', requireScope('qr:write'), zv('json', GenerateQrSchema), async (c) => {
    const { text, format, size, margin } = c.req.valid('json');

    try {
      if (format === 'svg') {
        const svg = await QRCode.toString(text, {
          type: 'svg',
          width: size,
          margin,
        });
        c.header('Content-Type', 'image/svg+xml');
        return c.body(svg);
      } else {
        const buffer = await QRCode.toBuffer(text, {
          type: 'png',
          width: size,
          margin,
        });
        c.header('Content-Type', 'image/png');
        c.header('Content-Length', String(buffer.length));
        return c.body(buffer);
      }
    } catch {
      throw Errors.internal('Failed to generate QR code');
    }
  });

  return router;
}

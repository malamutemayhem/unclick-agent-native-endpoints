/**
 * UnClick Image — stateless image processing utility.
 *
 * All endpoints sit under /v1/* and inherit the global auth + rate-limit
 * middleware; no database access is needed.
 *
 * Scope: image:use
 *
 * Images are accepted and returned as base64-encoded strings.
 * An optional data URI prefix (data:image/...;base64,) is stripped on input.
 *
 *   POST /v1/image/resize    — resize to width × height
 *   POST /v1/image/convert   — convert between JPEG, PNG, WebP, AVIF
 *   POST /v1/image/compress  — compress with quality parameter
 *   POST /v1/image/metadata  — extract dimensions, format, size, color space
 *   POST /v1/image/crop      — crop with x, y, width, height
 *   POST /v1/image/rotate    — rotate by degrees
 *   POST /v1/image/grayscale — convert to grayscale
 */
import { Hono } from 'hono';
import sharp from 'sharp';
import { z } from 'zod';
import { ok, Errors } from '@unclick/core';
import { zv } from '../middleware/validate.js';
import { requireScope } from '../middleware/auth.js';
import type { AppVariables } from '../middleware/types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FORMATS = ['jpeg', 'png', 'webp', 'avif'] as const;
type ImageFormat = (typeof FORMATS)[number];

// 10 MB base64 limit (~7.5 MB raw image)
const MAX_BASE64 = 10_000_000;

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const ImageSchema = z.string().min(1).max(MAX_BASE64);

const ResizeSchema = z.object({
  image: ImageSchema,
  width: z.number().int().min(1).max(16_000),
  height: z.number().int().min(1).max(16_000),
  fit: z.enum(['cover', 'contain', 'fill', 'inside', 'outside']).default('cover'),
});

const ConvertSchema = z.object({
  image: ImageSchema,
  format: z.enum(FORMATS),
  quality: z.number().int().min(1).max(100).default(80),
});

const CompressSchema = z.object({
  image: ImageSchema,
  quality: z.number().int().min(1).max(100).default(80),
});

const MetadataSchema = z.object({
  image: ImageSchema,
});

const CropSchema = z.object({
  image: ImageSchema,
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().min(1).max(16_000),
  height: z.number().int().min(1).max(16_000),
});

const RotateSchema = z.object({
  image: ImageSchema,
  degrees: z.number().min(-360).max(360),
});

const GrayscaleSchema = z.object({
  image: ImageSchema,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bufferFromBase64(b64: string): Buffer {
  // Strip data URI prefix if present (e.g. data:image/png;base64,...)
  const raw = b64.replace(/^data:[^;]+;base64,/, '');
  return Buffer.from(raw, 'base64');
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createImageRouter() {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /image/resize
  router.post('/resize', requireScope('image:use'), zv('json', ResizeSchema), async (c) => {
    const { image, width, height, fit } = c.req.valid('json');
    try {
      const input = bufferFromBase64(image);
      const output = await sharp(input).resize(width, height, { fit }).toBuffer();
      return ok(c, { image: output.toString('base64'), width, height });
    } catch {
      throw Errors.validation('Failed to resize image — check that the input is a valid base64-encoded image');
    }
  });

  // POST /image/convert
  router.post('/convert', requireScope('image:use'), zv('json', ConvertSchema), async (c) => {
    const { image, format, quality } = c.req.valid('json');
    try {
      const input = bufferFromBase64(image);
      const output = await sharp(input).toFormat(format, { quality }).toBuffer();
      return ok(c, { image: output.toString('base64'), format });
    } catch {
      throw Errors.validation('Failed to convert image — check that the input is a valid base64-encoded image');
    }
  });

  // POST /image/compress
  router.post('/compress', requireScope('image:use'), zv('json', CompressSchema), async (c) => {
    const { image, quality } = c.req.valid('json');
    try {
      const input = bufferFromBase64(image);
      const meta = await sharp(input).metadata();
      const fmt = (meta.format ?? 'jpeg') as string;
      const validFormat: ImageFormat = (FORMATS as readonly string[]).includes(fmt)
        ? (fmt as ImageFormat)
        : 'jpeg';
      const output = await sharp(input).toFormat(validFormat, { quality }).toBuffer();
      return ok(c, {
        image: output.toString('base64'),
        format: validFormat,
        original_size: input.length,
        compressed_size: output.length,
      });
    } catch {
      throw Errors.validation('Failed to compress image — check that the input is a valid base64-encoded image');
    }
  });

  // POST /image/metadata
  router.post('/metadata', requireScope('image:use'), zv('json', MetadataSchema), async (c) => {
    const { image } = c.req.valid('json');
    try {
      const input = bufferFromBase64(image);
      const meta = await sharp(input).metadata();
      return ok(c, {
        width: meta.width ?? null,
        height: meta.height ?? null,
        format: meta.format ?? null,
        size: input.length,
        color_space: meta.space ?? null,
        channels: meta.channels ?? null,
        has_alpha: meta.hasAlpha ?? false,
        density: meta.density ?? null,
      });
    } catch {
      throw Errors.validation('Failed to read image metadata — check that the input is a valid base64-encoded image');
    }
  });

  // POST /image/crop
  router.post('/crop', requireScope('image:use'), zv('json', CropSchema), async (c) => {
    const { image, x, y, width, height } = c.req.valid('json');
    try {
      const input = bufferFromBase64(image);
      const output = await sharp(input)
        .extract({ left: x, top: y, width, height })
        .toBuffer();
      return ok(c, { image: output.toString('base64'), x, y, width, height });
    } catch {
      throw Errors.validation('Failed to crop image — check that the crop region is within the image bounds');
    }
  });

  // POST /image/rotate
  router.post('/rotate', requireScope('image:use'), zv('json', RotateSchema), async (c) => {
    const { image, degrees } = c.req.valid('json');
    try {
      const input = bufferFromBase64(image);
      const output = await sharp(input).rotate(degrees).toBuffer();
      return ok(c, { image: output.toString('base64'), degrees });
    } catch {
      throw Errors.validation('Failed to rotate image — check that the input is a valid base64-encoded image');
    }
  });

  // POST /image/grayscale
  router.post('/grayscale', requireScope('image:use'), zv('json', GrayscaleSchema), async (c) => {
    const { image } = c.req.valid('json');
    try {
      const input = bufferFromBase64(image);
      const output = await sharp(input).grayscale().toBuffer();
      return ok(c, { image: output.toString('base64') });
    } catch {
      throw Errors.validation('Failed to convert image to grayscale — check that the input is a valid base64-encoded image');
    }
  });

  return router;
}

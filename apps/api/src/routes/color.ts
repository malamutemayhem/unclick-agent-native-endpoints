/**
 * UnClick Color — stateless color utility.
 *
 * All endpoints sit under /v1/* and inherit the global auth + rate-limit
 * middleware; no database access is needed.
 *
 * Scope: color:use
 *
 *   POST /v1/color/convert   — convert a color between hex, RGB, HSL, HSV
 *   POST /v1/color/palette   — generate a palette from a base color
 *   POST /v1/color/mix       — mix two colors with an optional weight
 *   POST /v1/color/contrast  — WCAG contrast ratio between two colors
 *   POST /v1/color/lighten   — lighten a color by percentage
 *   POST /v1/color/darken    — darken a color by percentage
 *
 * Pure math, no dependencies beyond Zod and Hono.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { ok, Errors } from '@unclick/core';
import { zv } from '../middleware/validate.js';
import { requireScope } from '../middleware/auth.js';
import type { AppVariables } from '../middleware/types.js';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface Rgb { r: number; g: number; b: number }
interface Hsl { h: number; s: number; l: number }
interface Hsv { h: number; s: number; v: number }

interface AllFormats {
  hex: string;
  rgb: Rgb;
  hsl: Hsl;
  hsv: Hsv;
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const RgbObject = z.object({
  r: z.number().min(0).max(255),
  g: z.number().min(0).max(255),
  b: z.number().min(0).max(255),
});

const HslObject = z.object({
  h: z.number().min(0).max(360),
  s: z.number().min(0).max(100),
  l: z.number().min(0).max(100),
});

const HsvObject = z.object({
  h: z.number().min(0).max(360),
  s: z.number().min(0).max(100),
  v: z.number().min(0).max(100),
});

// Union: try hex string first, then RGB, then HSL, then HSV.
// Zod uses first-match semantics; HSL and HSV are distinguished by 'l' vs 'v'.
const ColorInput = z.union([
  z.string().max(50),
  RgbObject,
  HslObject,
  HsvObject,
]);

const ConvertSchema = z.object({ color: ColorInput });

const PALETTE_TYPES = [
  'complementary',
  'analogous',
  'triadic',
  'tetradic',
  'split-complementary',
  'monochromatic',
] as const;

const PaletteSchema = z.object({
  color: ColorInput,
  type: z.enum(PALETTE_TYPES).default('complementary'),
});

const MixSchema = z.object({
  color1: ColorInput,
  color2: ColorInput,
  /** 0 = all color1, 1 = all color2. Default 0.5. */
  weight: z.number().min(0).max(1).default(0.5),
});

const ContrastSchema = z.object({
  color1: ColorInput,
  color2: ColorInput,
});

const AdjustSchema = z.object({
  color: ColorInput,
  /** Percentage points to adjust lightness [0–100]. */
  amount: z.number().min(0).max(100),
});

// ---------------------------------------------------------------------------
// Color space conversions
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): Rgb {
  let clean = hex.replace(/^#/, '');
  if (clean.length === 3) {
    clean = clean[0]! + clean[0]! + clean[1]! + clean[1]! + clean[2]! + clean[2]!;
  }
  if (!/^[0-9a-f]{6}$/i.test(clean)) {
    throw Errors.validation(`Invalid hex color: "${hex}"`);
  }
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const toHex = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l: round1(l * 100) };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;

  return { h: round1(h * 360), s: round1(s * 100), l: round1(l * 100) };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const hn = h / 360, sn = s / 100, ln = l / 100;

  if (sn === 0) {
    const v = Math.round(ln * 255);
    return { r: v, g: v, b: v };
  }

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;

  const hue2rgb = (t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  return {
    r: Math.round(hue2rgb(hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(hn) * 255),
    b: Math.round(hue2rgb(hn - 1 / 3) * 255),
  };
}

function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;

  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }

  return { h: round1(h * 360), s: round1(s * 100), v: round1(v * 100) };
}

function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const hn = h / 360, sn = s / 100, vn = v / 100;

  if (sn === 0) {
    const gray = Math.round(vn * 255);
    return { r: gray, g: gray, b: gray };
  }

  const i = Math.floor(hn * 6);
  const f = hn * 6 - i;
  const p = vn * (1 - sn);
  const q = vn * (1 - f * sn);
  const t = vn * (1 - (1 - f) * sn);

  let r: number, g: number, b: number;
  switch (i % 6) {
    case 0: r = vn; g = t; b = p; break;
    case 1: r = q; g = vn; b = p; break;
    case 2: r = p; g = vn; b = t; break;
    case 3: r = p; g = q; b = vn; break;
    case 4: r = t; g = p; b = vn; break;
    default: r = vn; g = p; b = q;
  }

  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

// ---------------------------------------------------------------------------
// Parsing and formatting helpers
// ---------------------------------------------------------------------------

type ColorValue = z.infer<typeof ColorInput>;

function toRgb(input: ColorValue): Rgb {
  if (typeof input === 'string') return hexToRgb(input);
  if ('r' in input) return { r: input.r, g: input.g, b: input.b };
  if ('l' in input) return hslToRgb(input);
  return hsvToRgb(input);
}

function allFormats(rgb: Rgb): AllFormats {
  return {
    hex: rgbToHex(rgb),
    rgb,
    hsl: rgbToHsl(rgb),
    hsv: rgbToHsv(rgb),
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Rotate a hue value keeping it in [0, 360). */
function rotateHue(h: number, degrees: number): number {
  return ((h + degrees) % 360 + 360) % 360;
}

// ---------------------------------------------------------------------------
// WCAG contrast
// ---------------------------------------------------------------------------

function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(rgb1: Rgb, rgb2: Rgb): number {
  const l1 = relativeLuminance(rgb1);
  const l2 = relativeLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createColorRouter() {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /color/convert — accept any format, return all
  router.post('/convert', requireScope('color:use'), zv('json', ConvertSchema), (c) => {
    const { color } = c.req.valid('json');
    const rgb = toRgb(color);
    return ok(c, allFormats(rgb));
  });

  // POST /color/palette — generate named palette from base color
  router.post('/palette', requireScope('color:use'), zv('json', PaletteSchema), (c) => {
    const { color, type } = c.req.valid('json');
    const base = rgbToHsl(toRgb(color));

    const swatch = (h: number, s = base.s, l = base.l): AllFormats =>
      allFormats(hslToRgb({ h: rotateHue(h, 0), s, l }));

    const atHue = (degrees: number): AllFormats =>
      allFormats(hslToRgb({ h: rotateHue(base.h, degrees), s: base.s, l: base.l }));

    let swatches: AllFormats[];

    switch (type) {
      case 'complementary':
        swatches = [swatch(base.h), atHue(180)];
        break;
      case 'analogous':
        swatches = [atHue(-30), swatch(base.h), atHue(30)];
        break;
      case 'triadic':
        swatches = [swatch(base.h), atHue(120), atHue(240)];
        break;
      case 'tetradic':
        swatches = [swatch(base.h), atHue(90), atHue(180), atHue(270)];
        break;
      case 'split-complementary':
        swatches = [swatch(base.h), atHue(150), atHue(210)];
        break;
      case 'monochromatic':
        swatches = [20, 35, 50, 65, 80].map((l) =>
          allFormats(hslToRgb({ h: base.h, s: base.s, l })),
        );
        break;
    }

    return ok(c, { base: allFormats(toRgb(color)), type, swatches });
  });

  // POST /color/mix — blend two colors by weight
  router.post('/mix', requireScope('color:use'), zv('json', MixSchema), (c) => {
    const { color1, color2, weight } = c.req.valid('json');
    const a = toRgb(color1);
    const b = toRgb(color2);
    const mixed: Rgb = {
      r: Math.round(a.r * (1 - weight) + b.r * weight),
      g: Math.round(a.g * (1 - weight) + b.g * weight),
      b: Math.round(a.b * (1 - weight) + b.b * weight),
    };
    return ok(c, {
      color1: allFormats(a),
      color2: allFormats(b),
      weight,
      result: allFormats(mixed),
    });
  });

  // POST /color/contrast — WCAG contrast ratio with AA/AAA pass/fail
  router.post('/contrast', requireScope('color:use'), zv('json', ContrastSchema), (c) => {
    const { color1, color2 } = c.req.valid('json');
    const a = toRgb(color1);
    const b = toRgb(color2);
    const ratio = contrastRatio(a, b);
    const ratioRounded = Math.round(ratio * 100) / 100;

    return ok(c, {
      color1: allFormats(a),
      color2: allFormats(b),
      contrast_ratio: ratioRounded,
      wcag: {
        aa_normal: ratio >= 4.5,
        aa_large: ratio >= 3,
        aaa_normal: ratio >= 7,
        aaa_large: ratio >= 4.5,
      },
    });
  });

  // POST /color/lighten — increase HSL lightness by amount percent points
  router.post('/lighten', requireScope('color:use'), zv('json', AdjustSchema), (c) => {
    const { color, amount } = c.req.valid('json');
    const hsl = rgbToHsl(toRgb(color));
    const adjusted: Hsl = { ...hsl, l: clamp(hsl.l + amount, 0, 100) };
    return ok(c, {
      original: allFormats(toRgb(color)),
      amount,
      result: allFormats(hslToRgb(adjusted)),
    });
  });

  // POST /color/darken — decrease HSL lightness by amount percent points
  router.post('/darken', requireScope('color:use'), zv('json', AdjustSchema), (c) => {
    const { color, amount } = c.req.valid('json');
    const hsl = rgbToHsl(toRgb(color));
    const adjusted: Hsl = { ...hsl, l: clamp(hsl.l - amount, 0, 100) };
    return ok(c, {
      original: allFormats(toRgb(color)),
      amount,
      result: allFormats(hslToRgb(adjusted)),
    });
  });

  return router;
}

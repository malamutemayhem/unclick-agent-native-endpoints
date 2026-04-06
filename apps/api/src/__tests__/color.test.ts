/**
 * Tests for UnClick Color — /v1/color
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app.js';
import { setupTestDb } from './setup.js';

let app: ReturnType<typeof createApp>;
let apiKey: string;

function auth(key: string) {
  return { Authorization: `Bearer ${key}` };
}

function post(path: string, body: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  apiKey = await setupTestDb();
  app = createApp();
});

// ─── POST /v1/color/convert ───────────────────────────────────────────────────

describe('POST /v1/color/convert', () => {
  it('converts hex red to all formats', async () => {
    const res = await post('/v1/color/convert', { color: '#ff0000' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.hex).toBe('#ff0000');
    expect(data.rgb).toMatchObject({ r: 255, g: 0, b: 0 });
    expect(data.hsl).toMatchObject({ h: 0, s: 100, l: 50 });
    expect(data.hsv).toMatchObject({ h: 0, s: 100, v: 100 });
  });

  it('converts hex without # prefix', async () => {
    const res = await post('/v1/color/convert', { color: '00ff00' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.rgb).toMatchObject({ r: 0, g: 255, b: 0 });
  });

  it('converts shorthand 3-char hex', async () => {
    const res = await post('/v1/color/convert', { color: '#fff' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.rgb).toMatchObject({ r: 255, g: 255, b: 255 });
    expect(data.hex).toBe('#ffffff');
  });

  it('converts RGB object to all formats', async () => {
    const res = await post('/v1/color/convert', { color: { r: 0, g: 0, b: 255 } });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.hex).toBe('#0000ff');
    expect(data.hsl).toMatchObject({ h: 240, s: 100, l: 50 });
    expect(data.hsv).toMatchObject({ h: 240, s: 100, v: 100 });
  });

  it('converts HSL object to all formats', async () => {
    const res = await post('/v1/color/convert', { color: { h: 120, s: 100, l: 50 } });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.hex).toBe('#00ff00');
    expect(data.rgb).toMatchObject({ r: 0, g: 255, b: 0 });
  });

  it('converts HSV object to all formats', async () => {
    const res = await post('/v1/color/convert', { color: { h: 0, s: 0, v: 100 } });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.hex).toBe('#ffffff');
    expect(data.rgb).toMatchObject({ r: 255, g: 255, b: 255 });
  });

  it('converts black correctly', async () => {
    const res = await post('/v1/color/convert', { color: '#000000' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.rgb).toMatchObject({ r: 0, g: 0, b: 0 });
    expect(data.hsl).toMatchObject({ s: 0, l: 0 });
    expect(data.hsv).toMatchObject({ s: 0, v: 0 });
  });

  it('rejects invalid hex', async () => {
    const res = await post('/v1/color/convert', { color: '#zzzzzz' });
    expect(res.status).toBe(400);
  });

  it('rejects missing color field', async () => {
    const res = await post('/v1/color/convert', {});
    expect(res.status).toBe(400);
  });

  it('rejects unauthenticated request', async () => {
    const res = await app.request('/v1/color/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color: '#ff0000' }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── POST /v1/color/palette ───────────────────────────────────────────────────

describe('POST /v1/color/palette', () => {
  it('generates complementary palette (2 swatches)', async () => {
    const res = await post('/v1/color/palette', { color: '#ff0000', type: 'complementary' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.swatches).toHaveLength(2);
    // Complement of red (hue 0) is hue 180 — cyan
    expect(data.swatches[1].hex).toBe('#00ffff');
  });

  it('generates analogous palette (3 swatches)', async () => {
    const res = await post('/v1/color/palette', { color: '#ff0000', type: 'analogous' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.swatches).toHaveLength(3);
  });

  it('generates triadic palette (3 swatches)', async () => {
    const res = await post('/v1/color/palette', { color: '#ff0000', type: 'triadic' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.swatches).toHaveLength(3);
  });

  it('generates tetradic palette (4 swatches)', async () => {
    const res = await post('/v1/color/palette', { color: '#ff0000', type: 'tetradic' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.swatches).toHaveLength(4);
  });

  it('generates split-complementary palette (3 swatches)', async () => {
    const res = await post('/v1/color/palette', { color: '#ff0000', type: 'split-complementary' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.swatches).toHaveLength(3);
  });

  it('generates monochromatic palette (5 swatches, varying lightness)', async () => {
    const res = await post('/v1/color/palette', { color: '#ff0000', type: 'monochromatic' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.swatches).toHaveLength(5);
    // All swatches should share the same hue
    const hues = data.swatches.map((s: any) => s.hsl.h);
    expect(hues.every((h: number) => h === hues[0])).toBe(true);
    // Lightness should increase through the swatches
    const lightnesses = data.swatches.map((s: any) => s.hsl.l);
    for (let i = 1; i < lightnesses.length; i++) {
      expect(lightnesses[i]).toBeGreaterThan(lightnesses[i - 1]);
    }
  });

  it('defaults to complementary when type is omitted', async () => {
    const res = await post('/v1/color/palette', { color: '#ff0000' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.type).toBe('complementary');
    expect(data.swatches).toHaveLength(2);
  });

  it('returns base color in response', async () => {
    const res = await post('/v1/color/palette', { color: '#ff0000', type: 'triadic' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.base.hex).toBe('#ff0000');
  });
});

// ─── POST /v1/color/mix ───────────────────────────────────────────────────────

describe('POST /v1/color/mix', () => {
  it('mixes red and blue 50/50 to produce purple-ish', async () => {
    const res = await post('/v1/color/mix', {
      color1: '#ff0000',
      color2: '#0000ff',
      weight: 0.5,
    });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.result.rgb).toMatchObject({ r: 128, g: 0, b: 128 });
  });

  it('weight 0 returns color1 unchanged', async () => {
    const res = await post('/v1/color/mix', {
      color1: '#ff0000',
      color2: '#0000ff',
      weight: 0,
    });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.result.hex).toBe('#ff0000');
  });

  it('weight 1 returns color2 unchanged', async () => {
    const res = await post('/v1/color/mix', {
      color1: '#ff0000',
      color2: '#0000ff',
      weight: 1,
    });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.result.hex).toBe('#0000ff');
  });

  it('mixes black and white to grey', async () => {
    const res = await post('/v1/color/mix', {
      color1: '#000000',
      color2: '#ffffff',
      weight: 0.5,
    });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.result.rgb).toMatchObject({ r: 128, g: 128, b: 128 });
  });

  it('defaults weight to 0.5', async () => {
    const res = await post('/v1/color/mix', {
      color1: '#ff0000',
      color2: '#0000ff',
    });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.weight).toBe(0.5);
  });
});

// ─── POST /v1/color/contrast ──────────────────────────────────────────────────

describe('POST /v1/color/contrast', () => {
  it('black on white gives maximum contrast ~21:1', async () => {
    const res = await post('/v1/color/contrast', {
      color1: '#000000',
      color2: '#ffffff',
    });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.contrast_ratio).toBeCloseTo(21, 0);
    expect(data.wcag.aa_normal).toBe(true);
    expect(data.wcag.aaa_normal).toBe(true);
    expect(data.wcag.aa_large).toBe(true);
    expect(data.wcag.aaa_large).toBe(true);
  });

  it('same color gives 1:1 contrast — all WCAG fail', async () => {
    const res = await post('/v1/color/contrast', {
      color1: '#808080',
      color2: '#808080',
    });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.contrast_ratio).toBeCloseTo(1, 0);
    expect(data.wcag.aa_normal).toBe(false);
    expect(data.wcag.aaa_normal).toBe(false);
  });

  it('contrast ratio is symmetric', async () => {
    const res1 = await post('/v1/color/contrast', { color1: '#ff0000', color2: '#ffffff' });
    const res2 = await post('/v1/color/contrast', { color1: '#ffffff', color2: '#ff0000' });
    const d1 = (await res1.json() as any).data;
    const d2 = (await res2.json() as any).data;
    expect(d1.contrast_ratio).toBe(d2.contrast_ratio);
  });

  it('WCAG AA passes at >= 4.5 for normal text', async () => {
    // #767676 on white is borderline AA pass (~4.54:1)
    const res = await post('/v1/color/contrast', {
      color1: '#767676',
      color2: '#ffffff',
    });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.wcag.aa_normal).toBe(true);
  });
});

// ─── POST /v1/color/lighten ───────────────────────────────────────────────────

describe('POST /v1/color/lighten', () => {
  it('lightens a color by 20 percent points', async () => {
    const res = await post('/v1/color/lighten', { color: '#ff0000', amount: 20 });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.result.hsl.l).toBeCloseTo(70, 0); // red is l=50, +20 = 70
  });

  it('clamps lightness at 100', async () => {
    const res = await post('/v1/color/lighten', { color: '#ffffff', amount: 50 });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.result.hsl.l).toBe(100);
  });

  it('amount 0 returns original color', async () => {
    const res = await post('/v1/color/lighten', { color: '#ff0000', amount: 0 });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.result.hex).toBe('#ff0000');
  });
});

// ─── POST /v1/color/darken ────────────────────────────────────────────────────

describe('POST /v1/color/darken', () => {
  it('darkens a color by 20 percent points', async () => {
    const res = await post('/v1/color/darken', { color: '#ff0000', amount: 20 });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.result.hsl.l).toBeCloseTo(30, 0); // red is l=50, -20 = 30
  });

  it('clamps lightness at 0', async () => {
    const res = await post('/v1/color/darken', { color: '#000000', amount: 50 });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.result.hsl.l).toBe(0);
    expect(data.result.hex).toBe('#000000');
  });

  it('amount 0 returns original color', async () => {
    const res = await post('/v1/color/darken', { color: '#ff0000', amount: 0 });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.result.hex).toBe('#ff0000');
  });

  it('rejects unauthenticated request', async () => {
    const res = await app.request('/v1/color/darken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color: '#ff0000', amount: 10 }),
    });
    expect(res.status).toBe(401);
  });
});

import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app.js';
import { setupTestDb } from './setup.js';

let app: ReturnType<typeof createApp>;
let devKey: string;

function auth() {
  return { Authorization: `Bearer ${devKey}`, 'Content-Type': 'application/json' };
}

async function post(path: string, body: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: auth(),
    body: JSON.stringify(body),
  });
}

async function json<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

beforeAll(async () => {
  devKey = await setupTestDb();
  app = createApp();
});

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

describe('Validate - auth', () => {
  it('rejects requests with no API key', async () => {
    const res = await app.request('/v1/validate/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// /validate/email
// ---------------------------------------------------------------------------

describe('Validate - email', () => {
  it('accepts a valid email', async () => {
    const res = await post('/v1/validate/email', { email: 'user@example.com' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean; details: { domain: string } } }>(res);
    expect(body.data.valid).toBe(true);
    expect(body.data.details.domain).toBe('example.com');
  });

  it('rejects a malformed email', async () => {
    const res = await post('/v1/validate/email', { email: 'not-an-email' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean } }>(res);
    expect(body.data.valid).toBe(false);
  });

  it('rejects missing @', async () => {
    const res = await post('/v1/validate/email', { email: 'userexample.com' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean } }>(res);
    expect(body.data.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// /validate/url
// ---------------------------------------------------------------------------

describe('Validate - url', () => {
  it('accepts a valid URL', async () => {
    const res = await post('/v1/validate/url', { url: 'https://example.com/path?q=1' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean; details: { protocol: string; hostname: string } } }>(res);
    expect(body.data.valid).toBe(true);
    expect(body.data.details.protocol).toBe('https');
    expect(body.data.details.hostname).toBe('example.com');
  });

  it('rejects a malformed URL', async () => {
    const res = await post('/v1/validate/url', { url: 'not a url' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean } }>(res);
    expect(body.data.valid).toBe(false);
  });

  it('does not include reachable field when check_reachable is false', async () => {
    const res = await post('/v1/validate/url', { url: 'https://example.com', check_reachable: false });
    expect(res.status).toBe(200);
    const body = await json<{ data: Record<string, unknown> }>(res);
    expect('reachable' in body.data).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// /validate/phone
// ---------------------------------------------------------------------------

describe('Validate - phone', () => {
  it('accepts a valid international phone number', async () => {
    const res = await post('/v1/validate/phone', { phone: '+1 (555) 123-4567' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean; details: { has_country_code: boolean } } }>(res);
    expect(body.data.valid).toBe(true);
    expect(body.data.details.has_country_code).toBe(true);
  });

  it('rejects a number that is too short', async () => {
    const res = await post('/v1/validate/phone', { phone: '123' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean } }>(res);
    expect(body.data.valid).toBe(false);
  });

  it('accepts a plain 10-digit number', async () => {
    const res = await post('/v1/validate/phone', { phone: '5551234567' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean } }>(res);
    expect(body.data.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// /validate/json
// ---------------------------------------------------------------------------

describe('Validate - json', () => {
  it('accepts valid JSON object', async () => {
    const res = await post('/v1/validate/json', { json: '{"key": "value", "num": 42}' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean; type: string; parsed: unknown } }>(res);
    expect(body.data.valid).toBe(true);
    expect(body.data.type).toBe('object');
    expect(body.data.parsed).toEqual({ key: 'value', num: 42 });
  });

  it('accepts valid JSON array', async () => {
    const res = await post('/v1/validate/json', { json: '[1, 2, 3]' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean; type: string } }>(res);
    expect(body.data.valid).toBe(true);
    expect(body.data.type).toBe('array');
  });

  it('rejects invalid JSON', async () => {
    const res = await post('/v1/validate/json', { json: '{not valid json}' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean; error: string } }>(res);
    expect(body.data.valid).toBe(false);
    expect(body.data.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// /validate/credit-card
// ---------------------------------------------------------------------------

describe('Validate - credit-card', () => {
  it('accepts a valid Visa test card number', async () => {
    // Standard Luhn-valid Visa test number
    const res = await post('/v1/validate/credit-card', { number: '4532015112830366' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean; card_type: string } }>(res);
    expect(body.data.valid).toBe(true);
    expect(body.data.card_type).toBe('visa');
  });

  it('accepts a Mastercard test number', async () => {
    const res = await post('/v1/validate/credit-card', { number: '5425233430109903' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean; card_type: string } }>(res);
    expect(body.data.valid).toBe(true);
    expect(body.data.card_type).toBe('mastercard');
  });

  it('rejects an invalid card number', async () => {
    const res = await post('/v1/validate/credit-card', { number: '1234567890123456' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean; card_type: null } }>(res);
    expect(body.data.valid).toBe(false);
    expect(body.data.card_type).toBeNull();
  });

  it('handles formatted card numbers with spaces', async () => {
    const res = await post('/v1/validate/credit-card', { number: '4532 0151 1283 0366' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean } }>(res);
    expect(body.data.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// /validate/ip
// ---------------------------------------------------------------------------

describe('Validate - ip', () => {
  it('accepts a valid IPv4 address', async () => {
    const res = await post('/v1/validate/ip', { ip: '192.168.1.1' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean; version: number } }>(res);
    expect(body.data.valid).toBe(true);
    expect(body.data.version).toBe(4);
  });

  it('accepts a valid IPv6 address', async () => {
    const res = await post('/v1/validate/ip', { ip: '2001:db8::1' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean; version: number } }>(res);
    expect(body.data.valid).toBe(true);
    expect(body.data.version).toBe(6);
  });

  it('rejects an invalid IP', async () => {
    const res = await post('/v1/validate/ip', { ip: '999.999.999.999' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean; version: null } }>(res);
    expect(body.data.valid).toBe(false);
    expect(body.data.version).toBeNull();
  });

  it('rejects a hostname (not an IP)', async () => {
    const res = await post('/v1/validate/ip', { ip: 'example.com' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean } }>(res);
    expect(body.data.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// /validate/color
// ---------------------------------------------------------------------------

describe('Validate - color', () => {
  it('accepts a 6-digit hex color', async () => {
    const res = await post('/v1/validate/color', { color: '#ff0000' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean; format: string } }>(res);
    expect(body.data.valid).toBe(true);
    expect(body.data.format).toBe('hex');
  });

  it('accepts a 3-digit hex shorthand', async () => {
    const res = await post('/v1/validate/color', { color: '#f00' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean; format: string } }>(res);
    expect(body.data.valid).toBe(true);
    expect(body.data.format).toBe('hex');
  });

  it('accepts an RGB color', async () => {
    const res = await post('/v1/validate/color', { color: 'rgb(255, 0, 0)' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean; format: string; details: { r: number } } }>(res);
    expect(body.data.valid).toBe(true);
    expect(body.data.format).toBe('rgb');
    expect(body.data.details.r).toBe(255);
  });

  it('accepts an HSL color', async () => {
    const res = await post('/v1/validate/color', { color: 'hsl(0, 100%, 50%)' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean; format: string } }>(res);
    expect(body.data.valid).toBe(true);
    expect(body.data.format).toBe('hsl');
  });

  it('rejects an invalid color', async () => {
    const res = await post('/v1/validate/color', { color: 'notacolor' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean; format: null } }>(res);
    expect(body.data.valid).toBe(false);
    expect(body.data.format).toBeNull();
  });

  it('rejects an out-of-range RGB value', async () => {
    const res = await post('/v1/validate/color', { color: 'rgb(300, 0, 0)' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean } }>(res);
    expect(body.data.valid).toBe(false);
  });
});

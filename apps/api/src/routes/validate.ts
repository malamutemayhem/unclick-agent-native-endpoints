/**
 * UnClick Validate - stateless input validation utility.
 *
 * All endpoints sit under /v1/* and inherit the global auth + rate-limit
 * middleware; no database access is needed.
 *
 * Scope: validate:use
 *
 *   POST /v1/validate/email        - validate email address format
 *   POST /v1/validate/url          - validate URL format (optional reachability check)
 *   POST /v1/validate/phone        - basic phone number format validation
 *   POST /v1/validate/json         - validate JSON string, return parsed value or error
 *   POST /v1/validate/credit-card  - validate credit card via Luhn algorithm only
 *   POST /v1/validate/ip           - validate IPv4 or IPv6 address
 *   POST /v1/validate/color        - validate hex, RGB, RGBA, or HSL color values
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { ok } from '@unclick/core';
import { zv } from '../middleware/validate.js';
import type { AppVariables } from '../middleware/types.js';
import { requireScope } from '../middleware/auth.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const EmailSchema = z.object({
  email: z.string().max(320),
});

const UrlSchema = z.object({
  url: z.string().max(2_048),
  check_reachable: z.boolean().default(false),
});

const PhoneSchema = z.object({
  phone: z.string().max(30),
});

const JsonSchema = z.object({
  json: z.string().max(1_000_000),
});

const CreditCardSchema = z.object({
  number: z.string().max(24),
});

const IpSchema = z.object({
  ip: z.string().max(45),
});

const ColorSchema = z.object({
  color: z.string().max(50),
});

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

// RFC 5322-inspired regex; catches the vast majority of valid addresses.
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

function checkEmail(email: string) {
  const valid = EMAIL_RE.test(email);
  const atIndex = email.lastIndexOf('@');
  const local = atIndex >= 0 ? email.slice(0, atIndex) : email;
  const domain = atIndex >= 0 ? email.slice(atIndex + 1) : null;
  return {
    valid,
    details: {
      local_part: local || null,
      domain,
      has_valid_tld: valid && (domain?.includes('.') ?? false),
    },
  };
}

function checkUrl(url: string) {
  try {
    const parsed = new URL(url);
    return {
      valid: true,
      details: {
        protocol: parsed.protocol.replace(':', ''),
        host: parsed.host,
        hostname: parsed.hostname,
        port: parsed.port || null,
        pathname: parsed.pathname,
        search: parsed.search || null,
        hash: parsed.hash || null,
      },
    };
  } catch {
    return { valid: false, details: { reason: 'Invalid URL format' } };
  }
}

function checkPhone(phone: string) {
  const digits = phone.replace(/[\s\-().+]/g, '');
  const valid = /^\d{7,15}$/.test(digits);
  return {
    valid,
    details: {
      digits_only: digits,
      digit_count: digits.replace(/\D/g, '').length,
      has_country_code: phone.trimStart().startsWith('+'),
    },
  };
}

function luhnCheck(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i]!, 10);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

function detectCardType(digits: string): string {
  if (/^4/.test(digits)) return 'visa';
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return 'mastercard';
  if (/^3[47]/.test(digits)) return 'amex';
  if (/^6(?:011|5)/.test(digits)) return 'discover';
  return 'unknown';
}

function checkIpv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => /^\d+$/.test(p) && parseInt(p, 10) >= 0 && parseInt(p, 10) <= 255);
}

// Covers the common full and compressed forms of IPv6.
const IPV6_RE = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]+|::(ffff(:0{1,4})?:)?((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9]))$/;

function checkColor(color: string) {
  const t = color.trim();

  // Hex: #RGB, #RRGGBB, #RRGGBBAA
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(t)) {
    return { valid: true, format: 'hex', details: { value: t } };
  }

  // RGB
  const rgb = t.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/);
  if (rgb) {
    const [r, g, b] = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    const valid = [r, g, b].every((v) => v >= 0 && v <= 255);
    return { valid, format: 'rgb', details: { r, g, b } };
  }

  // RGBA
  const rgba = t.match(/^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+)\s*\)$/);
  if (rgba) {
    const [r, g, b] = [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
    const a = parseFloat(rgba[4]!);
    const valid = [r, g, b].every((v) => v >= 0 && v <= 255) && a >= 0 && a <= 1;
    return { valid, format: 'rgba', details: { r, g, b, a } };
  }

  // HSL
  const hsl = t.match(/^hsl\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*\)$/);
  if (hsl) {
    const h = Number(hsl[1]);
    const s = Number(hsl[2]);
    const l = Number(hsl[3]);
    const valid = h >= 0 && h <= 360 && s >= 0 && s <= 100 && l >= 0 && l <= 100;
    return { valid, format: 'hsl', details: { h, s, l } };
  }

  return { valid: false, format: null, details: { reason: 'Unrecognized color format' } };
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createValidateRouter() {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /validate/email
  router.post('/email', requireScope('validate:use'), zv('json', EmailSchema), (c) => {
    const { email } = c.req.valid('json');
    return ok(c, { input: email, ...checkEmail(email) });
  });

  // POST /validate/url
  router.post('/url', requireScope('validate:use'), zv('json', UrlSchema), async (c) => {
    const { url, check_reachable } = c.req.valid('json');
    const result = checkUrl(url);

    let reachable: boolean | null = null;
    if (check_reachable && result.valid) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5_000);
        const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeout);
        reachable = res.ok;
      } catch {
        reachable = false;
      }
    }

    return ok(c, {
      input: url,
      ...result,
      ...(check_reachable ? { reachable } : {}),
    });
  });

  // POST /validate/phone
  router.post('/phone', requireScope('validate:use'), zv('json', PhoneSchema), (c) => {
    const { phone } = c.req.valid('json');
    return ok(c, { input: phone, ...checkPhone(phone) });
  });

  // POST /validate/json
  router.post('/json', requireScope('validate:use'), zv('json', JsonSchema), (c) => {
    const { json } = c.req.valid('json');
    try {
      const parsed: unknown = JSON.parse(json);
      const type = Array.isArray(parsed) ? 'array' : typeof parsed;
      return ok(c, { valid: true, type, parsed });
    } catch (err) {
      return ok(c, {
        valid: false,
        type: null,
        parsed: null,
        error: err instanceof SyntaxError ? err.message : 'Invalid JSON',
      });
    }
  });

  // POST /validate/credit-card
  router.post('/credit-card', requireScope('validate:use'), zv('json', CreditCardSchema), (c) => {
    const { number } = c.req.valid('json');
    const digits = number.replace(/\D/g, '');
    const valid = luhnCheck(digits);
    return ok(c, {
      input: number,
      valid,
      card_type: valid ? detectCardType(digits) : null,
      digits: digits.length,
    });
  });

  // POST /validate/ip
  router.post('/ip', requireScope('validate:use'), zv('json', IpSchema), (c) => {
    const { ip } = c.req.valid('json');
    const is_v4 = checkIpv4(ip);
    const is_v6 = !is_v4 && IPV6_RE.test(ip);
    return ok(c, {
      input: ip,
      valid: is_v4 || is_v6,
      version: is_v4 ? 4 : is_v6 ? 6 : null,
    });
  });

  // POST /validate/color
  router.post('/color', requireScope('validate:use'), zv('json', ColorSchema), (c) => {
    const { color } = c.req.valid('json');
    return ok(c, { input: color, ...checkColor(color) });
  });

  return router;
}

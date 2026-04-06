/**
 * Tests for UnClick IP — /v1/ip
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app.js';
import { setupTestDb } from './setup.js';

let app: ReturnType<typeof createApp>;
let apiKey: string;

function auth(key: string) {
  return { Authorization: `Bearer ${key}` };
}

function post(path: string, body: unknown, extraHeaders?: Record<string, string>) {
  return app.request(path, {
    method: 'POST',
    headers: { ...auth(apiKey), 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  apiKey = await setupTestDb();
  app = createApp();
});

// ─── POST /v1/ip/lookup ───────────────────────────────────────────────────────

describe('POST /v1/ip/lookup', () => {
  it('returns "unknown" when no IP headers are present', async () => {
    const res = await post('/v1/ip/lookup', {});
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.ip).toBe('unknown');
  });

  it('returns IP from X-Forwarded-For header', async () => {
    const res = await post('/v1/ip/lookup', {}, { 'X-Forwarded-For': '203.0.113.1' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.ip).toBe('203.0.113.1');
    expect(data.version).toBe(4);
  });

  it('uses first IP in X-Forwarded-For chain', async () => {
    const res = await post('/v1/ip/lookup', {}, { 'X-Forwarded-For': '1.2.3.4, 10.0.0.1, 192.168.1.1' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.ip).toBe('1.2.3.4');
  });

  it('prefers CF-Connecting-IP over X-Forwarded-For', async () => {
    const res = await post('/v1/ip/lookup', {}, {
      'CF-Connecting-IP': '5.6.7.8',
      'X-Forwarded-For': '1.2.3.4',
    });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.ip).toBe('5.6.7.8');
  });

  it('returns version 6 for IPv6 address', async () => {
    const res = await post('/v1/ip/lookup', {}, { 'X-Forwarded-For': '2001:db8::1' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.version).toBe(6);
  });

  it('rejects unauthenticated request', async () => {
    const res = await app.request('/v1/ip/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });
});

// ─── POST /v1/ip/parse ────────────────────────────────────────────────────────

describe('POST /v1/ip/parse', () => {
  it('parses a public IPv4 address', async () => {
    const res = await post('/v1/ip/parse', { ip: '8.8.8.8' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.version).toBe(4);
    expect(data.decimal).toBe(134744072); // 8*2^24 + 8*2^16 + 8*2^8 + 8
    expect(data.binary).toBe('00001000.00001000.00001000.00001000');
    expect(data.hex).toBe('08080808');
    expect(data.is_private).toBe(false);
    expect(data.is_loopback).toBe(false);
    expect(data.is_multicast).toBe(false);
  });

  it('identifies 10.x.x.x as private', async () => {
    const res = await post('/v1/ip/parse', { ip: '10.0.0.1' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.is_private).toBe(true);
    expect(data.is_loopback).toBe(false);
  });

  it('identifies 172.16.x.x as private', async () => {
    const res = await post('/v1/ip/parse', { ip: '172.16.0.1' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.is_private).toBe(true);
  });

  it('identifies 172.31.x.x as private (upper edge of /12)', async () => {
    const res = await post('/v1/ip/parse', { ip: '172.31.255.255' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.is_private).toBe(true);
  });

  it('identifies 172.32.x.x as NOT private (just outside /12)', async () => {
    const res = await post('/v1/ip/parse', { ip: '172.32.0.1' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.is_private).toBe(false);
  });

  it('identifies 192.168.x.x as private', async () => {
    const res = await post('/v1/ip/parse', { ip: '192.168.1.1' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.is_private).toBe(true);
  });

  it('identifies 127.0.0.1 as loopback', async () => {
    const res = await post('/v1/ip/parse', { ip: '127.0.0.1' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.is_loopback).toBe(true);
    expect(data.is_private).toBe(false);
    expect(data.is_multicast).toBe(false);
  });

  it('identifies 224.0.0.1 as multicast', async () => {
    const res = await post('/v1/ip/parse', { ip: '224.0.0.1' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.is_multicast).toBe(true);
    expect(data.is_private).toBe(false);
  });

  it('identifies 239.255.255.255 as multicast (upper edge)', async () => {
    const res = await post('/v1/ip/parse', { ip: '239.255.255.255' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.is_multicast).toBe(true);
  });

  it('parses IPv6 loopback ::1', async () => {
    const res = await post('/v1/ip/parse', { ip: '::1' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.version).toBe(6);
    expect(data.is_loopback).toBe(true);
    expect(data.decimal).toBe('1');
  });

  it('parses a public IPv6 address', async () => {
    const res = await post('/v1/ip/parse', { ip: '2001:db8::1' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.version).toBe(6);
    expect(data.is_loopback).toBe(false);
    expect(data.is_multicast).toBe(false);
    expect(data.is_private).toBe(false);
    expect(typeof data.decimal).toBe('string'); // BigInt serialised as string
  });

  it('identifies fc00::/7 (ULA) as private IPv6', async () => {
    const res = await post('/v1/ip/parse', { ip: 'fc00::1' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.is_private).toBe(true);
  });

  it('identifies ff02::1 as multicast IPv6', async () => {
    const res = await post('/v1/ip/parse', { ip: 'ff02::1' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.is_multicast).toBe(true);
  });

  it('returns 400 for invalid IP', async () => {
    const res = await post('/v1/ip/parse', { ip: 'not-an-ip' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for octet > 255', async () => {
    const res = await post('/v1/ip/parse', { ip: '256.0.0.1' });
    expect(res.status).toBe(400);
  });
});

// ─── POST /v1/ip/subnet ───────────────────────────────────────────────────────

describe('POST /v1/ip/subnet', () => {
  it('calculates /24 subnet correctly', async () => {
    const res = await post('/v1/ip/subnet', { cidr: '192.168.1.0/24' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.network_address).toBe('192.168.1.0');
    expect(data.broadcast_address).toBe('192.168.1.255');
    expect(data.subnet_mask).toBe('255.255.255.0');
    expect(data.wildcard_mask).toBe('0.0.0.255');
    expect(data.first_usable).toBe('192.168.1.1');
    expect(data.last_usable).toBe('192.168.1.254');
    expect(data.total_addresses).toBe(256);
    expect(data.usable_hosts).toBe(254);
  });

  it('calculates /8 subnet correctly', async () => {
    const res = await post('/v1/ip/subnet', { cidr: '10.0.0.0/8' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.network_address).toBe('10.0.0.0');
    expect(data.broadcast_address).toBe('10.255.255.255');
    expect(data.total_addresses).toBe(16777216);
    expect(data.usable_hosts).toBe(16777214);
  });

  it('calculates /30 correctly (4 addresses, 2 usable hosts)', async () => {
    const res = await post('/v1/ip/subnet', { cidr: '192.168.1.0/30' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.total_addresses).toBe(4);
    expect(data.usable_hosts).toBe(2);
    expect(data.first_usable).toBe('192.168.1.1');
    expect(data.last_usable).toBe('192.168.1.2');
    expect(data.broadcast_address).toBe('192.168.1.3');
  });

  it('calculates /32 (single host)', async () => {
    const res = await post('/v1/ip/subnet', { cidr: '192.168.1.1/32' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.total_addresses).toBe(1);
    expect(data.usable_hosts).toBe(1);
    expect(data.network_address).toBe('192.168.1.1');
    expect(data.broadcast_address).toBe('192.168.1.1');
    expect(data.first_usable).toBe('192.168.1.1');
    expect(data.last_usable).toBe('192.168.1.1');
  });

  it('calculates /31 (point-to-point link)', async () => {
    const res = await post('/v1/ip/subnet', { cidr: '10.0.0.0/31' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.total_addresses).toBe(2);
    expect(data.usable_hosts).toBe(2);
    expect(data.first_usable).toBe('10.0.0.0');
    expect(data.last_usable).toBe('10.0.0.1');
  });

  it('normalises host bits — e.g. 192.168.1.100/24 gives network 192.168.1.0', async () => {
    const res = await post('/v1/ip/subnet', { cidr: '192.168.1.100/24' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.network_address).toBe('192.168.1.0');
  });

  it('returns 400 when CIDR is missing slash', async () => {
    const res = await post('/v1/ip/subnet', { cidr: '192.168.1.0' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for IPv6 CIDR', async () => {
    const res = await post('/v1/ip/subnet', { cidr: '2001:db8::/32' });
    expect(res.status).toBe(400);
  });
});

// ─── POST /v1/ip/range ────────────────────────────────────────────────────────

describe('POST /v1/ip/range', () => {
  it('returns true when IP is inside CIDR', async () => {
    const res = await post('/v1/ip/range', { ip: '192.168.1.50', cidr: '192.168.1.0/24' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.in_range).toBe(true);
  });

  it('returns false when IP is outside CIDR', async () => {
    const res = await post('/v1/ip/range', { ip: '192.168.2.1', cidr: '192.168.1.0/24' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.in_range).toBe(false);
  });

  it('network address itself is in range', async () => {
    const res = await post('/v1/ip/range', { ip: '10.0.0.0', cidr: '10.0.0.0/8' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.in_range).toBe(true);
  });

  it('broadcast address is in range', async () => {
    const res = await post('/v1/ip/range', { ip: '10.255.255.255', cidr: '10.0.0.0/8' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.in_range).toBe(true);
  });

  it('first IP outside range is not in range', async () => {
    const res = await post('/v1/ip/range', { ip: '11.0.0.0', cidr: '10.0.0.0/8' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.in_range).toBe(false);
  });

  it('private range check: 192.168.1.1 is in 192.168.0.0/16', async () => {
    const res = await post('/v1/ip/range', { ip: '192.168.1.1', cidr: '192.168.0.0/16' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.in_range).toBe(true);
  });

  it('returns 400 for invalid IP', async () => {
    const res = await post('/v1/ip/range', { ip: 'bad', cidr: '192.168.1.0/24' });
    expect(res.status).toBe(400);
  });
});

// ─── POST /v1/ip/convert ──────────────────────────────────────────────────────

describe('POST /v1/ip/convert', () => {
  it('converts dotted-decimal IPv4 to all representations', async () => {
    const res = await post('/v1/ip/convert', { ip: '192.168.1.1' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.dotted_decimal).toBe('192.168.1.1');
    expect(data.decimal).toBe(3232235777);
    expect(data.binary).toBe('11000000.10101000.00000001.00000001');
    expect(data.hex).toBe('C0A80101');
  });

  it('converts 0.0.0.0', async () => {
    const res = await post('/v1/ip/convert', { ip: '0.0.0.0' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.decimal).toBe(0);
    expect(data.binary).toBe('00000000.00000000.00000000.00000000');
    expect(data.hex).toBe('00000000');
  });

  it('converts 255.255.255.255', async () => {
    const res = await post('/v1/ip/convert', { ip: '255.255.255.255' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.decimal).toBe(4294967295);
    expect(data.hex).toBe('FFFFFFFF');
  });

  it('accepts plain decimal integer', async () => {
    const res = await post('/v1/ip/convert', { ip: '3232235777' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.dotted_decimal).toBe('192.168.1.1');
  });

  it('accepts plain hex string', async () => {
    const res = await post('/v1/ip/convert', { ip: 'C0A80101' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.dotted_decimal).toBe('192.168.1.1');
  });

  it('accepts binary dotted string', async () => {
    const res = await post('/v1/ip/convert', { ip: '11000000.10101000.00000001.00000001' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.dotted_decimal).toBe('192.168.1.1');
    expect(data.decimal).toBe(3232235777);
  });

  it('converts 8.8.8.8 (Google DNS)', async () => {
    const res = await post('/v1/ip/convert', { ip: '8.8.8.8' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.decimal).toBe(134744072);
    expect(data.hex).toBe('08080808');
  });

  it('returns 400 for invalid input', async () => {
    const res = await post('/v1/ip/convert', { ip: 'not-an-ip' });
    expect(res.status).toBe(400);
  });

  it('rejects unauthenticated request', async () => {
    const res = await app.request('/v1/ip/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: '192.168.1.1' }),
    });
    expect(res.status).toBe(401);
  });
});

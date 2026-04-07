/**
 * UnClick IP - stateless IP / network utility.
 *
 * All endpoints sit under /v1/* and inherit the global auth + rate-limit
 * middleware; no database access is needed.
 *
 * Scope: ip:use
 *
 *   POST /v1/ip/lookup  - return the caller's IP address from request headers
 *   POST /v1/ip/parse   - parse an IP: version, decimal, binary, is_private, is_loopback, is_multicast
 *   POST /v1/ip/subnet  - subnet math from CIDR: network, broadcast, first/last host, host count
 *   POST /v1/ip/range   - check whether an IP falls within a CIDR range
 *   POST /v1/ip/convert - convert an IPv4 address between dotted-decimal, binary, and hex
 *
 * Pure math, no external API calls, no geo-lookup database.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { ok, Errors } from '@unclick/core';
import { zv } from '../middleware/validate.js';
import { requireScope } from '../middleware/auth.js';
import type { AppVariables } from '../middleware/types.js';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const IpSchema = z.object({
  ip: z.string().min(2).max(45),
});

const CidrSchema = z.object({
  cidr: z.string().min(7).max(49), // e.g. "192.168.1.0/24"
});

const RangeSchema = z.object({
  ip: z.string().min(2).max(45),
  cidr: z.string().min(7).max(49),
});

const ConvertSchema = z.object({
  ip: z.string().min(2).max(45),
  /** Target representation. Omit to return all. */
  to: z.enum(['decimal', 'binary', 'hex', 'dotted']).optional(),
});

// ---------------------------------------------------------------------------
// IPv4 helpers
// ---------------------------------------------------------------------------

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isIPv4(ip: string): boolean {
  const m = ip.match(IPV4_RE);
  if (!m) return false;
  return [m[1]!, m[2]!, m[3]!, m[4]!].every((o) => parseInt(o, 10) <= 255);
}

function ipv4ToInt(ip: string): number {
  const [a, b, c, d] = ip.split('.').map(Number);
  return (((a! << 24) | (b! << 16) | (c! << 8) | d!) >>> 0);
}

function intToIpv4(n: number): string {
  return [
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 8) & 0xff,
    n & 0xff,
  ].join('.');
}

function ipv4ToBinary(ip: string): string {
  return ip
    .split('.')
    .map((o) => parseInt(o, 10).toString(2).padStart(8, '0'))
    .join('.');
}

function ipv4ToHex(ip: string): string {
  return ip
    .split('.')
    .map((o) => parseInt(o, 10).toString(16).toUpperCase().padStart(2, '0'))
    .join('');
}

/** Build a 32-bit mask from a prefix length. Uses unsigned right shift to stay positive. */
function prefixToMask(prefix: number): number {
  if (prefix === 0) return 0;
  if (prefix === 32) return 0xffffffff >>> 0;
  return (~0 << (32 - prefix)) >>> 0;
}

// IPv4 special-range checks (all comparisons on unsigned 32-bit ints)
function isPrivateV4(n: number): boolean {
  // 10.0.0.0/8
  if ((n >>> 24) === 10) return true;
  // 172.16.0.0/12
  if ((n >>> 24) === 172 && ((n >>> 16) & 0xff) >= 16 && ((n >>> 16) & 0xff) <= 31) return true;
  // 192.168.0.0/16
  if ((n >>> 24) === 192 && ((n >>> 16) & 0xff) === 168) return true;
  // 100.64.0.0/10 - carrier-grade NAT
  if ((n >>> 22) === (0x64400000 >>> 22)) return true;
  // 169.254.0.0/16 - link-local
  if ((n >>> 16) === 0xa9fe) return true;
  return false;
}

function isLoopbackV4(n: number): boolean {
  return (n >>> 24) === 127;
}

function isMulticastV4(n: number): boolean {
  return (n >>> 24) >= 224 && (n >>> 24) <= 239;
}

// ---------------------------------------------------------------------------
// IPv6 helpers
// ---------------------------------------------------------------------------

const IPV6_RE = /^[0-9a-f:]+$/i;

function isIPv6(ip: string): boolean {
  if (!ip.includes(':')) return false;
  if (!IPV6_RE.test(ip)) return false;
  const groups = ip.split('::');
  if (groups.length > 2) return false;
  return true;
}

/**
 * Expand a possibly-compressed IPv6 address to a BigInt.
 * Handles :: shorthand and embedded IPv4 (e.g. ::ffff:192.168.1.1).
 */
function ipv6ToBigInt(ip: string): bigint {
  const doubleColon = ip.indexOf('::');
  let left: string[], right: string[];

  if (doubleColon !== -1) {
    const l = ip.slice(0, doubleColon);
    const r = ip.slice(doubleColon + 2);
    left = l ? l.split(':') : [];
    right = r ? expandEmbeddedV4(r.split(':')) : [];
  } else {
    left = expandEmbeddedV4(ip.split(':'));
    right = [];
  }

  const total = 8;
  const fill = total - left.length - right.length;
  if (fill < 0) throw Errors.validation(`Invalid IPv6 address: "${ip}"`);
  const groups = [...left, ...Array(fill).fill('0'), ...right];
  if (groups.length !== 8) throw Errors.validation(`Invalid IPv6 address: "${ip}"`);

  return groups.reduce(
    (acc, g) => (acc << 16n) | BigInt(parseInt(g || '0', 16)),
    0n,
  );
}

/** Replace a trailing IPv4 segment in a groups array with two hex groups. */
function expandEmbeddedV4(parts: string[]): string[] {
  const last = parts[parts.length - 1];
  if (!last || !last.includes('.')) return parts;
  const octets = last.split('.').map(Number);
  if (octets.length !== 4 || octets.some((o) => o > 255 || isNaN(o))) return parts;
  const hi = (octets[0]! * 256 + octets[1]!).toString(16).padStart(4, '0');
  const lo = (octets[2]! * 256 + octets[3]!).toString(16).padStart(4, '0');
  return [...parts.slice(0, -1), hi, lo];
}

function bigIntToBinaryIPv6(n: bigint): string {
  return n.toString(2).padStart(128, '0');
}

function bigIntToDecimalStr(n: bigint): string {
  return n.toString(10);
}

/** Expand BigInt back to full colon-hex notation. */
function bigIntToIPv6(n: bigint): string {
  const groups: string[] = [];
  for (let i = 7; i >= 0; i--) {
    groups.unshift(((n >> BigInt(i * 16)) & 0xffffn).toString(16));
  }
  return groups.join(':');
}

function isLoopbackV6(n: bigint): boolean {
  return n === 1n; // ::1
}

function isMulticastV6(n: bigint): boolean {
  return (n >> 120n) === 0xffn; // ff00::/8
}

function isPrivateV6(n: bigint): boolean {
  // fc00::/7 - unique local addresses
  if ((n >> 121n) === 0x7en) return true;
  // fe80::/10 - link-local
  if ((n >> 118n) === 0x3fan) return true;
  return false;
}

// ---------------------------------------------------------------------------
// CIDR parsing
// ---------------------------------------------------------------------------

function parseCidr(cidr: string): { ip: string; prefix: number } {
  const slash = cidr.indexOf('/');
  if (slash === -1) throw Errors.validation(`CIDR must include prefix length, e.g. "192.168.1.0/24"`);
  const ip = cidr.slice(0, slash);
  const prefix = parseInt(cidr.slice(slash + 1), 10);
  if (isNaN(prefix)) throw Errors.validation('Prefix length must be a number');
  return { ip, prefix };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createIpRouter() {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /ip/lookup - return the caller's IP from standard request headers
  router.post('/lookup', requireScope('ip:use'), (c) => {
    const ip =
      c.req.header('CF-Connecting-IP') ??
      c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ??
      c.req.header('X-Real-IP') ??
      'unknown';

    const version = isIPv4(ip) ? 4 : isIPv6(ip) ? 6 : null;

    return ok(c, { ip, version });
  });

  // POST /ip/parse - parse an IP address into its properties
  router.post('/parse', requireScope('ip:use'), zv('json', IpSchema), (c) => {
    const { ip } = c.req.valid('json');

    if (isIPv4(ip)) {
      const n = ipv4ToInt(ip);
      return ok(c, {
        input: ip,
        version: 4,
        decimal: n,
        binary: ipv4ToBinary(ip),
        hex: ipv4ToHex(ip),
        is_private: isPrivateV4(n),
        is_loopback: isLoopbackV4(n),
        is_multicast: isMulticastV4(n),
      });
    }

    if (isIPv6(ip)) {
      let bigVal: bigint;
      try {
        bigVal = ipv6ToBigInt(ip);
      } catch {
        throw Errors.validation(`Cannot parse IPv6 address: "${ip}"`);
      }
      return ok(c, {
        input: ip,
        version: 6,
        decimal: bigIntToDecimalStr(bigVal),
        binary: bigIntToBinaryIPv6(bigVal),
        hex: bigVal.toString(16).toUpperCase().padStart(32, '0'),
        expanded: bigIntToIPv6(bigVal),
        is_private: isPrivateV6(bigVal),
        is_loopback: isLoopbackV6(bigVal),
        is_multicast: isMulticastV6(bigVal),
      });
    }

    throw Errors.validation(`"${ip}" is not a valid IPv4 or IPv6 address`);
  });

  // POST /ip/subnet - calculate subnet info from CIDR notation
  router.post('/subnet', requireScope('ip:use'), zv('json', CidrSchema), (c) => {
    const { cidr } = c.req.valid('json');
    const { ip, prefix } = parseCidr(cidr);

    if (!isIPv4(ip)) throw Errors.validation('Subnet calculation only supports IPv4 CIDR');
    if (prefix < 0 || prefix > 32) throw Errors.validation('Prefix must be 0–32');

    const ipInt = ipv4ToInt(ip);
    const mask = prefixToMask(prefix);
    const wildcard = (~mask) >>> 0;
    const network = (ipInt & mask) >>> 0;
    const broadcast = (network | wildcard) >>> 0;
    const totalAddresses = prefix === 32 ? 1 : prefix === 31 ? 2 : Math.pow(2, 32 - prefix);
    const usableHosts = prefix >= 31 ? totalAddresses : totalAddresses - 2;
    const firstUsable = prefix >= 31 ? network : network + 1;
    const lastUsable = prefix === 32 ? network : prefix === 31 ? broadcast : broadcast - 1;

    return ok(c, {
      cidr,
      prefix,
      network_address: intToIpv4(network),
      broadcast_address: intToIpv4(broadcast),
      subnet_mask: intToIpv4(mask),
      wildcard_mask: intToIpv4(wildcard),
      first_usable: intToIpv4(firstUsable),
      last_usable: intToIpv4(lastUsable),
      total_addresses: totalAddresses,
      usable_hosts: usableHosts,
    });
  });

  // POST /ip/range - check if an IP is within a CIDR range
  router.post('/range', requireScope('ip:use'), zv('json', RangeSchema), (c) => {
    const { ip, cidr } = c.req.valid('json');

    if (!isIPv4(ip)) throw Errors.validation('Range check only supports IPv4');
    const { ip: rangeIp, prefix } = parseCidr(cidr);
    if (!isIPv4(rangeIp)) throw Errors.validation('CIDR network address must be IPv4');
    if (prefix < 0 || prefix > 32) throw Errors.validation('Prefix must be 0–32');

    const mask = prefixToMask(prefix);
    const ipInt = ipv4ToInt(ip);
    const networkInt = (ipv4ToInt(rangeIp) & mask) >>> 0;
    const inRange = ((ipInt & mask) >>> 0) === networkInt;

    return ok(c, { ip, cidr, in_range: inRange });
  });

  // POST /ip/convert - convert IPv4 between dotted-decimal, decimal, binary, hex
  router.post('/convert', requireScope('ip:use'), zv('json', ConvertSchema), (c) => {
    const { ip } = c.req.valid('json');

    // Accept dotted-decimal, plain decimal integer, binary (with dots), or hex
    let resolved = ip.trim();

    // Binary dotted: "11000000.10101000.00000001.00000001"
    const isBinaryDotted = /^[01]{8}\.[01]{8}\.[01]{8}\.[01]{8}$/.test(resolved);
    if (isBinaryDotted) {
      resolved = resolved.split('.').map((b) => parseInt(b, 2)).join('.');
    }

    // Plain hex (no dots): "C0A80101" or "c0a80101"
    const isPlainHex = /^[0-9a-f]{8}$/i.test(resolved);
    if (isPlainHex) {
      const n = parseInt(resolved, 16) >>> 0;
      resolved = intToIpv4(n);
    }

    // Plain decimal integer (> 255 so it can't be a single octet)
    const isDecimalInt = /^\d+$/.test(resolved) && parseInt(resolved, 10) > 255;
    if (isDecimalInt) {
      resolved = intToIpv4(parseInt(resolved, 10) >>> 0);
    }

    if (!isIPv4(resolved)) {
      throw Errors.validation(`"${ip}" is not a recognisable IPv4 address, decimal integer, binary, or hex representation`);
    }

    const n = ipv4ToInt(resolved);

    return ok(c, {
      input: ip,
      dotted_decimal: resolved,
      decimal: n,
      binary: ipv4ToBinary(resolved),
      hex: ipv4ToHex(resolved),
    });
  });

  return router;
}

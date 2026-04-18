// local-catalog-handlers.ts
// Local implementations of all catalog endpoint handlers.
// Used by unclick_call to avoid remote API calls to api.unclick.world.

import crypto from "node:crypto";
import { parse as csvParse } from "csv-parse/sync";
import { stringify as csvStringify } from "csv-stringify/sync";
import { marked } from "marked";

export type LocalHandler = (args: Record<string, unknown>) => unknown | Promise<unknown>;

// ─── In-memory KV store (per-process session) ────────────────────────────────
const KV_STORE = new Map<string, { value: unknown; expires?: number; version: number }>();

// ─── Crypto-quality random ───────────────────────────────────────────────────
function secureRandom(): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] / 0x100000000;
}

// ─── Parse timestamp to Date ─────────────────────────────────────────────────
function parseTs(ts: string | number): Date {
  if (typeof ts === "number") {
    return ts > 9_999_999_999 ? new Date(ts) : new Date(ts * 1000);
  }
  return new Date(ts);
}

// ─── Color helpers ────────────────────────────────────────────────────────────
interface RGB { r: number; g: number; b: number }
interface HSL { h: number; s: number; l: number }

function hexToRgb(hex: string): RGB {
  const h = hex.replace(/^#/, "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex({ r, g, b }: RGB): string {
  return "#" + [r, g, b].map((n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0")).join("");
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
  else if (max === gg) h = ((bb - rr) / d + 2) / 6;
  else h = ((rr - gg) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  const ss = s / 100, ll = l / 100;
  if (ss === 0) { const v = Math.round(ll * 255); return { r: v, g: v, b: v }; }
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const hk = h / 360;
  function hue2rgb(t: number): number {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  }
  return {
    r: Math.round(hue2rgb(hk + 1/3) * 255),
    g: Math.round(hue2rgb(hk) * 255),
    b: Math.round(hue2rgb(hk - 1/3) * 255),
  };
}

function parseColorToRgb(color: string): RGB | null {
  const s = color.trim();
  if (s.startsWith("#")) { try { return hexToRgb(s); } catch { return null; } }
  const rgb = s.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgb) return { r: parseInt(rgb[1]), g: parseInt(rgb[2]), b: parseInt(rgb[3]) };
  const hsl = s.match(/^hsl\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?\s*\)$/i);
  if (hsl) return hslToRgb({ h: parseInt(hsl[1]), s: parseInt(hsl[2]), l: parseInt(hsl[3]) });
  return null;
}

function colorInfo(rgb: RGB): Record<string, unknown> {
  const hsl = rgbToHsl(rgb);
  return {
    hex: rgbToHex(rgb),
    rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    rgb_object: rgb,
    hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
    hsl_object: hsl,
  };
}

// ─── Diff helper ──────────────────────────────────────────────────────────────
function computeDiff(a: string, b: string, mode: "line" | "word" | "char" | "patch"): unknown {
  const tokensA = mode === "line" ? a.split("\n") : mode === "word" ? a.split(/\s+/) : a.split("");
  const tokensB = mode === "line" ? b.split("\n") : mode === "word" ? b.split(/\s+/) : b.split("");

  // LCS-based diff (simple O(n*m) for small inputs)
  const n = tokensA.length, m = tokensB.length;
  // For large inputs, fall back to simple diff
  if (n * m > 100000) {
    return { a_length: n, b_length: m, note: "Inputs too large for local diff. Use smaller inputs." };
  }
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      lcs[i][j] = tokensA[i - 1] === tokensB[j - 1] ? lcs[i - 1][j - 1] + 1 : Math.max(lcs[i - 1][j], lcs[i][j - 1]);
    }
  }

  const changes: Array<{ type: "added" | "removed" | "unchanged"; value: string }> = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && tokensA[i - 1] === tokensB[j - 1]) {
      changes.unshift({ type: "unchanged", value: tokensA[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      changes.unshift({ type: "added", value: tokensB[j - 1] });
      j--;
    } else {
      changes.unshift({ type: "removed", value: tokensA[i - 1] });
      i--;
    }
  }

  const sep = mode === "line" ? "\n" : mode === "word" ? " " : "";
  if (mode === "patch") {
    const lines: string[] = [];
    for (const c of changes) {
      const prefix = c.type === "added" ? "+ " : c.type === "removed" ? "- " : "  ";
      lines.push(prefix + c.value);
    }
    return { patch: lines.join("\n"), added: changes.filter((c) => c.type === "added").length, removed: changes.filter((c) => c.type === "removed").length };
  }

  const added = changes.filter((c) => c.type === "added").map((c) => c.value).join(sep);
  const removed = changes.filter((c) => c.type === "removed").map((c) => c.value).join(sep);

  return {
    identical: a === b,
    added_count: changes.filter((c) => c.type === "added").length,
    removed_count: changes.filter((c) => c.type === "removed").length,
    unchanged_count: changes.filter((c) => c.type === "unchanged").length,
    added,
    removed,
    changes,
  };
}

// ─── Cron helpers ─────────────────────────────────────────────────────────────
const CRON_FIELDS = ["minute", "hour", "day_of_month", "month", "day_of_week"];
const DOW_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function parseCronField(field: string, min: number, max: number): number[] | null {
  if (field === "*") return null; // means "any"
  const values: number[] = [];
  for (const part of field.split(",")) {
    if (part.includes("/")) {
      const [range, step] = part.split("/");
      const s = parseInt(step);
      const [rMin, rMax] = range === "*" ? [min, max] : range.split("-").map(Number);
      for (let v = rMin; v <= rMax; v += s) values.push(v);
    } else if (part.includes("-")) {
      const [lo, hi] = part.split("-").map(Number);
      for (let v = lo; v <= hi; v++) values.push(v);
    } else {
      values.push(parseInt(part));
    }
  }
  return values.every((v) => !isNaN(v) && v >= min && v <= max) ? values : null;
}

function parseCronExpression(expr: string): unknown {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return { error: "Cron expression must have 5 fields: minute hour day_of_month month day_of_week" };
  const [min, hr, dom, mon, dow] = parts;
  const desc: string[] = [];

  if (min === "*" && hr === "*") desc.push("every minute");
  else if (min !== "*" && hr === "*") desc.push(`at minute ${min} of every hour`);
  else if (min === "0" && hr !== "*") desc.push(`at ${hr.padStart(2, "0")}:00`);
  else desc.push(`at minute ${min} of hour ${hr}`);

  if (dom !== "*") desc.push(`on day ${dom} of the month`);
  if (mon !== "*") desc.push(`in month ${mon}`);
  if (dow !== "*") {
    const dayName = DOW_NAMES[parseInt(dow)] ?? dow;
    desc.push(`on ${dayName}`);
  }

  return {
    expression: expr,
    description: desc.join(", "),
    fields: { minute: min, hour: hr, day_of_month: dom, month: mon, day_of_week: dow },
  };
}

function validateCronExpression(expr: string): unknown {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return { valid: false, error: "Must have exactly 5 fields" };
  const limits = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];
  const errors: string[] = [];
  parts.forEach((p, i) => {
    if (p === "*") return;
    const result = parseCronField(p, limits[i][0], limits[i][1]);
    if (!result) errors.push(`Invalid ${CRON_FIELDS[i]} field: "${p}"`);
  });
  return { expression: expr, valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined, fields: Object.fromEntries(CRON_FIELDS.map((f, i) => [f, parts[i]])) };
}

function getCronNextOccurrences(expr: string, count: number, after: Date): unknown {
  const valid = validateCronExpression(expr) as { valid: boolean; error?: string };
  if (!valid.valid) return { error: valid.error ?? "Invalid cron expression" };

  const parts = expr.trim().split(/\s+/);
  const [minField, hrField, domField, monField, dowField] = parts;

  const matches = (field: string, val: number, min: number, max: number): boolean => {
    if (field === "*") return true;
    const vals = parseCronField(field, min, max);
    return vals ? vals.includes(val) : false;
  };

  const dates: string[] = [];
  const cursor = new Date(after.getTime() + 60000); // start 1 min after
  cursor.setSeconds(0, 0);

  let attempts = 0;
  while (dates.length < count && attempts < 500000) {
    attempts++;
    const mo = cursor.getMonth() + 1;
    const dom = cursor.getDate();
    const hr = cursor.getHours();
    const mn = cursor.getMinutes();
    const dow = cursor.getDay();

    if (matches(monField, mo, 1, 12) && matches(domField, dom, 1, 31) && matches(dowField, dow, 0, 7) && matches(hrField, hr, 0, 23) && matches(minField, mn, 0, 59)) {
      dates.push(cursor.toISOString());
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
  }

  return { expression: expr, count: dates.length, next_occurrences: dates };
}

function buildCronExpression(every: string, at?: string, on?: string): unknown {
  let minute = "0", hour = "0", dom = "*", month = "*", dow = "*";

  const [hh, mm] = at ? at.split(":") : ["0", "0"];
  if (at) { hour = hh; minute = mm ?? "0"; }

  const dowIdx = DOW_NAMES.indexOf(every);
  const monIdx = MONTH_NAMES.indexOf(every);

  if (every === "minute") { minute = "*"; hour = "*"; }
  else if (every === "hour") { minute = mm ?? "0"; hour = "*"; }
  else if (every === "day") { /* defaults fine */ }
  else if (every === "week") { dow = on ? String(DOW_NAMES.indexOf(on.toLowerCase())) : "1"; }
  else if (every === "month") { dom = on ?? "1"; }
  else if (dowIdx >= 0) { dow = String(dowIdx); }
  else if (monIdx >= 0) { month = String(monIdx + 1); }
  else return { error: `Unknown 'every' value: "${every}"` };

  const expression = `${minute} ${hour} ${dom} ${month} ${dow}`;
  return { expression, fields: { minute, hour, day_of_month: dom, month, day_of_week: dow } };
}

// ─── IP helpers ───────────────────────────────────────────────────────────────
function parseIpAddress(ip: string): unknown {
  const parts = ip.trim().split(".");
  if (parts.length !== 4 || !parts.every((p) => /^\d+$/.test(p) && parseInt(p) <= 255)) {
    return { error: `"${ip}" is not a valid IPv4 address` };
  }
  const nums = parts.map(Number);
  const decimal = nums.reduce((acc, n) => acc * 256 + n, 0);
  const binary = nums.map((n) => n.toString(2).padStart(8, "0")).join(".");
  const hex = "0x" + nums.map((n) => n.toString(16).padStart(2, "0")).join("");

  const type =
    nums[0] === 10 || (nums[0] === 172 && nums[1] >= 16 && nums[1] <= 31) || (nums[0] === 192 && nums[1] === 168) ? "private" :
    nums[0] === 127 ? "loopback" :
    nums[0] >= 224 && nums[0] <= 239 ? "multicast" :
    nums[0] === 0 ? "this_network" :
    "public";

  return { ip, decimal, binary, hex, octet: nums, type, version: 4 };
}

function computeSubnet(cidr: string): unknown {
  const [ip, bits] = cidr.split("/");
  const prefixLen = parseInt(bits);
  if (!ip || isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) {
    return { error: `"${cidr}" is not a valid CIDR notation` };
  }
  const parsed = parseIpAddress(ip) as { decimal?: number; error?: string };
  if (parsed.error) return parsed;

  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  const network = (parsed.decimal! & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const hosts = prefixLen >= 31 ? Math.max(0, Math.pow(2, 32 - prefixLen) - 2) : Math.pow(2, 32 - prefixLen) - 2;

  const toIp = (n: number) => [(n >> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255].join(".");

  return {
    cidr,
    prefix_length: prefixLen,
    subnet_mask: toIp(mask),
    network_address: toIp(network),
    broadcast_address: toIp(broadcast),
    first_host: toIp(network + 1),
    last_host: toIp(broadcast - 1),
    total_hosts: hosts,
  };
}

function checkIpRange(args: Record<string, unknown>): unknown {
  const ip = String(args.ip ?? "");
  const cidr = String(args.cidr ?? "");
  const parsed = parseIpAddress(ip) as { decimal?: number; error?: string };
  if (parsed.error) return parsed;

  const [netIp, bits] = cidr.split("/");
  const prefixLen = parseInt(bits);
  const netParsed = parseIpAddress(netIp) as { decimal?: number; error?: string };
  if (netParsed.error) return { error: `Invalid CIDR: ${cidr}` };

  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  const inRange = (parsed.decimal! & mask) >>> 0 === (netParsed.decimal! & mask) >>> 0;
  return { ip, cidr, in_range: inRange };
}

function convertIpFormat(args: Record<string, unknown>): unknown {
  const ip = String(args.ip ?? "");
  return parseIpAddress(ip);
}

// ─── Duration formatting ──────────────────────────────────────────────────────
function formatDuration(ms: number, sign: number): string {
  const abs = Math.abs(ms);
  const parts: string[] = [];
  const days = Math.floor(abs / 86400000);
  const hours = Math.floor((abs % 86400000) / 3600000);
  const minutes = Math.floor((abs % 3600000) / 60000);
  const seconds = Math.floor((abs % 60000) / 1000);
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || parts.length === 0) parts.push(`${seconds}s`);
  return (sign < 0 ? "-" : "") + parts.join(" ");
}

// ─── HTML entity map (partial) ────────────────────────────────────────────────
const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ", "&copy;": "©", "&reg;": "®", "&trade;": "™",
  "&euro;": "€", "&pound;": "£", "&yen;": "¥", "&cent;": "¢",
  "&mdash;": "-", "&ndash;": "-", "&laquo;": "«", "&raquo;": "»",
};

// ─── Catalog endpoint handlers ───────────────────────────────────────────────
export const LOCAL_CATALOG_HANDLERS: Record<string, LocalHandler> = {

  // ── TRANSFORM ────────────────────────────────────────────────────────────────

  "transform.case": (args) => {
    const text = String(args.text ?? "");
    const to = String(args.to ?? "").toLowerCase();
    const transforms: Record<string, (s: string) => string> = {
      upper: (s) => s.toUpperCase(),
      lower: (s) => s.toLowerCase(),
      title: (s) => s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()),
      sentence: (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(),
      camel: (s) => { const ws = s.split(/[\s_\-]+/); return ws[0].toLowerCase() + ws.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(""); },
      snake: (s) => s.replace(/([a-z])([A-Z])/g, "$1_$2").replace(/[\s\-]+/g, "_").replace(/[^a-zA-Z0-9_]/g, "").toLowerCase(),
      kebab: (s) => s.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").replace(/[^a-zA-Z0-9\-]/g, "").toLowerCase(),
      pascal: (s) => s.split(/[\s_\-]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(""),
    };
    const fn = transforms[to];
    if (!fn) return { error: `Unknown case "${to}". Use: upper, lower, title, sentence, camel, snake, kebab, pascal` };
    return { input: text, to, result: fn(text) };
  },

  "transform.slug": (args) => {
    const text = String(args.text ?? "");
    const slug = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s\-]/g, "").trim().replace(/[\s\-]+/g, "-");
    return { input: text, slug };
  },

  "transform.truncate": (args) => {
    const text = String(args.text ?? "");
    const length = Number(args.length ?? 100);
    const ellipsis = args.ellipsis !== false;
    if (text.length <= length) return { input: text, result: text, truncated: false };
    const result = ellipsis ? text.slice(0, length - 3) + "..." : text.slice(0, length);
    return { input: text, length, result, truncated: true, original_length: text.length };
  },

  "transform.count": (args) => {
    const text = String(args.text ?? "");
    const wpm = Number(args.words_per_minute ?? 200);
    const wordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
    const sentenceCount = (text.match(/[.!?]+/g) ?? []).length;
    const paragraphCount = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length || (text.trim() ? 1 : 0);
    const readingTimeSec = Math.ceil((wordCount / wpm) * 60);
    return {
      character_count: text.length,
      character_count_no_spaces: text.replace(/\s/g, "").length,
      word_count: wordCount,
      sentence_count: sentenceCount,
      paragraph_count: paragraphCount,
      line_count: text.split("\n").length,
      reading_time_seconds: readingTimeSec,
      reading_time_minutes: Math.ceil(readingTimeSec / 60),
    };
  },

  "transform.strip": (args) => {
    const text = String(args.text ?? "");
    const stripped = text.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).trim();
    return { result: stripped, original_length: text.length, result_length: stripped.length };
  },

  "transform.reverse": (args) => {
    const text = String(args.text ?? "");
    const result = [...text].reverse().join("");
    return { input: text, result };
  },

  // ── ENCODE / DECODE ───────────────────────────────────────────────────────────

  "encode.base64": (args) => ({ input: String(args.text ?? ""), encoded: Buffer.from(String(args.text ?? ""), "utf8").toString("base64") }),
  "decode.base64": (args) => {
    try { return { input: String(args.text ?? ""), decoded: Buffer.from(String(args.text ?? ""), "base64").toString("utf8") }; }
    catch { return { error: "Invalid base64 string" }; }
  },
  "encode.url": (args) => ({ input: String(args.text ?? ""), encoded: encodeURIComponent(String(args.text ?? "")) }),
  "decode.url": (args) => {
    try { return { input: String(args.text ?? ""), decoded: decodeURIComponent(String(args.text ?? "")) }; }
    catch { return { error: "Invalid URL-encoded string" }; }
  },
  "encode.html": (args) => {
    const text = String(args.text ?? "");
    return { input: text, encoded: text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;") };
  },
  "decode.html": (args) => {
    const text = String(args.text ?? "");
    const decoded = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&[a-zA-Z]+;/g, (m) => HTML_ENTITIES[m] ?? m);
    return { input: text, decoded };
  },
  "encode.hex": (args) => ({ input: String(args.text ?? ""), encoded: Buffer.from(String(args.text ?? ""), "utf8").toString("hex") }),
  "decode.hex": (args) => {
    const text = String(args.text ?? "").replace(/^0x/, "");
    try { return { input: args.text, decoded: Buffer.from(text, "hex").toString("utf8") }; }
    catch { return { error: "Invalid hex string" }; }
  },

  // ── HASH ─────────────────────────────────────────────────────────────────────

  "hash.compute": (args) => {
    const text = String(args.text ?? "");
    const algorithm = String(args.algorithm ?? "sha256").toLowerCase();
    const encoding = (String(args.encoding ?? "hex")) as "hex" | "base64";
    try {
      return { algorithm, encoding, input_length: text.length, hash: crypto.createHash(algorithm).update(text, "utf8").digest(encoding) };
    } catch { return { error: `Unsupported algorithm "${algorithm}". Try: md5, sha1, sha256, sha512` }; }
  },

  "hash.verify": (args) => {
    const text = String(args.text ?? "");
    const hash = String(args.hash ?? "");
    const algorithm = String(args.algorithm ?? "sha256").toLowerCase();
    const encoding = (String(args.encoding ?? "hex")) as "hex" | "base64";
    try {
      const computed = crypto.createHash(algorithm).update(text, "utf8").digest(encoding);
      return { algorithm, matches: computed === hash, computed };
    } catch { return { error: `Unsupported algorithm "${algorithm}"` }; }
  },

  "hash.hmac": (args) => {
    const text = String(args.text ?? "");
    const key = String(args.key ?? "");
    const algorithm = String(args.algorithm ?? "sha256").toLowerCase();
    const encoding = (String(args.encoding ?? "hex")) as "hex" | "base64";
    try {
      return { algorithm, encoding, hmac: crypto.createHmac(algorithm, key).update(text, "utf8").digest(encoding) };
    } catch { return { error: `Unsupported algorithm "${algorithm}"` }; }
  },

  // ── REGEX ─────────────────────────────────────────────────────────────────────

  "regex.test": (args) => {
    const pattern = String(args.pattern ?? "");
    const flags = String(args.flags ?? "g");
    const input = String(args.input ?? "");
    try {
      const re = new RegExp(pattern, flags.includes("g") ? flags : flags + "g");
      const matches: Array<{ match: string; index: number; groups?: Record<string, string> }> = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(input)) !== null) {
        matches.push({ match: m[0], index: m.index, groups: m.groups as Record<string, string> | undefined });
        if (!re.global) break;
      }
      return { pattern, flags, input, matches, count: matches.length, matched: matches.length > 0 };
    } catch (e) { return { error: `Invalid regex: ${String(e)}` }; }
  },

  "regex.replace": (args) => {
    const pattern = String(args.pattern ?? "");
    const flags = String(args.flags ?? "g");
    const input = String(args.input ?? "");
    const replacement = String(args.replacement ?? "");
    try {
      return { result: input.replace(new RegExp(pattern, flags), replacement) };
    } catch (e) { return { error: `Invalid regex: ${String(e)}` }; }
  },

  "regex.extract": (args) => {
    const pattern = String(args.pattern ?? "");
    const flags = String(args.flags ?? "g");
    const input = String(args.input ?? "");
    const group = args.group != null ? Number(args.group) : 0;
    try {
      const re = new RegExp(pattern, flags.includes("g") ? flags : flags + "g");
      const extractions: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(input)) !== null) { extractions.push(m[group] ?? m[0]); }
      return { extractions, count: extractions.length };
    } catch (e) { return { error: `Invalid regex: ${String(e)}` }; }
  },

  "regex.split": (args) => {
    const pattern = String(args.pattern ?? "");
    const flags = String(args.flags ?? "");
    const input = String(args.input ?? "");
    try {
      const parts = input.split(new RegExp(pattern, flags));
      return { parts, count: parts.length };
    } catch (e) { return { error: `Invalid regex: ${String(e)}` }; }
  },

  "regex.validate": (args) => {
    const pattern = String(args.pattern ?? "");
    const flags = String(args.flags ?? "");
    try { new RegExp(pattern, flags); return { pattern, flags, valid: true }; }
    catch (e) { return { pattern, flags, valid: false, error: String(e) }; }
  },

  // ── MARKDOWN ──────────────────────────────────────────────────────────────────

  "markdown.to-html": async (args) => {
    const md = String(args.markdown ?? "");
    const html = await marked(md);
    return { html, input_length: md.length };
  },

  "markdown.to-text": async (args) => {
    const md = String(args.markdown ?? "");
    const html = await marked(md);
    const text = html.replace(/<[^>]+>/g, "").replace(/\n\n+/g, "\n\n").trim();
    return { text, input_length: md.length };
  },

  "markdown.toc": (args) => {
    const md = String(args.markdown ?? "");
    const headings: Array<{ level: number; text: string; anchor: string }> = [];
    for (const line of md.split("\n")) {
      const m = line.match(/^(#{1,6})\s+(.+)/);
      if (m) {
        const text = m[2].trim();
        const anchor = text.toLowerCase().replace(/[^a-z0-9\s\-]/g, "").replace(/\s+/g, "-");
        headings.push({ level: m[1].length, text, anchor });
      }
    }
    const toc = headings.map((h) => `${"  ".repeat(h.level - 1)}- [${h.text}](#${h.anchor})`).join("\n");
    return { toc, headings, heading_count: headings.length };
  },

  "markdown.lint": (args) => {
    const md = String(args.markdown ?? "");
    const issues: Array<{ line: number; type: string; message: string }> = [];
    md.split("\n").forEach((line, i) => {
      if (line.endsWith(" ") || line.endsWith("\t")) issues.push({ line: i + 1, type: "trailing-whitespace", message: "Line has trailing whitespace" });
      if (/^#{1,6}[^#\s]/.test(line)) issues.push({ line: i + 1, type: "heading-space", message: "Heading must have a space after #" });
    });
    return { issues, issue_count: issues.length, valid: issues.length === 0 };
  },

  // ── DIFF ─────────────────────────────────────────────────────────────────────

  "diff.text": (args) => computeDiff(String(args.a ?? ""), String(args.b ?? ""), "char"),
  "diff.lines": (args) => computeDiff(String(args.a ?? ""), String(args.b ?? ""), "line"),
  "diff.words": (args) => computeDiff(String(args.a ?? ""), String(args.b ?? ""), "word"),
  "diff.patch": (args) => computeDiff(String(args.a ?? ""), String(args.b ?? ""), "patch"),

  // ── JSON ─────────────────────────────────────────────────────────────────────

  "json.format": (args) => {
    const indent = args.indent === "tab" ? "\t" : Number(args.indent ?? 2);
    try {
      const parsed = JSON.parse(String(args.json ?? ""));
      const result = JSON.stringify(parsed, null, indent as string | number);
      return { result, bytes: result.length };
    } catch (e) { return { error: `Invalid JSON: ${String(e)}` }; }
  },

  "json.minify": (args) => {
    const input = String(args.json ?? "");
    try {
      const minified = JSON.stringify(JSON.parse(input));
      return { result: minified, original_bytes: input.length, minified_bytes: minified.length, saved_bytes: input.length - minified.length };
    } catch (e) { return { error: `Invalid JSON: ${String(e)}` }; }
  },

  "json.query": (args) => {
    const query = String(args.query ?? "");
    try {
      const parsed = JSON.parse(String(args.json ?? ""));
      const result = query.split(".").reduce((obj: unknown, key) => {
        if (obj == null) return undefined;
        return (obj as Record<string, unknown>)[key];
      }, parsed);
      return { query, result, found: result !== undefined };
    } catch (e) { return { error: String(e) }; }
  },

  "json.flatten": (args) => {
    const sep = String(args.separator ?? ".");
    try {
      const parsed = JSON.parse(String(args.json ?? ""));
      const flat: Record<string, unknown> = {};
      function flatten(obj: unknown, prefix: string) {
        if (Array.isArray(obj)) { obj.forEach((v, i) => flatten(v, prefix ? `${prefix}${sep}${i}` : String(i))); }
        else if (typeof obj === "object" && obj !== null) { for (const [k, v] of Object.entries(obj as Record<string, unknown>)) { flatten(v, prefix ? `${prefix}${sep}${k}` : k); } }
        else { flat[prefix] = obj; }
      }
      flatten(parsed, "");
      return { result: flat, key_count: Object.keys(flat).length };
    } catch (e) { return { error: `Invalid JSON: ${String(e)}` }; }
  },

  "json.unflatten": (args) => {
    const sep = String(args.separator ?? ".");
    try {
      const parsed = JSON.parse(String(args.json ?? "")) as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      for (const [flatKey, value] of Object.entries(parsed)) {
        const keys = flatKey.split(sep);
        let cur = result;
        for (let i = 0; i < keys.length - 1; i++) { if (cur[keys[i]] == null) cur[keys[i]] = {}; cur = cur[keys[i]] as Record<string, unknown>; }
        cur[keys[keys.length - 1]] = value;
      }
      return { result };
    } catch (e) { return { error: `Invalid JSON: ${String(e)}` }; }
  },

  "json.diff": (args) => {
    try {
      const a = JSON.parse(String(args.a ?? ""));
      const b = JSON.parse(String(args.b ?? ""));
      const diffs: Array<{ path: string; type: string; a?: unknown; b?: unknown }> = [];
      function diff(objA: unknown, objB: unknown, path: string) {
        if (JSON.stringify(objA) === JSON.stringify(objB)) return;
        if (typeof objA !== "object" || typeof objB !== "object" || objA === null || objB === null) { diffs.push({ path: path || ".", type: "changed", a: objA, b: objB }); return; }
        const keysA = Object.keys(objA as object), keysB = Object.keys(objB as object);
        for (const k of new Set([...keysA, ...keysB])) {
          const p = path ? `${path}.${k}` : k;
          if (!(k in (objA as object))) diffs.push({ path: p, type: "added", b: (objB as Record<string, unknown>)[k] });
          else if (!(k in (objB as object))) diffs.push({ path: p, type: "removed", a: (objA as Record<string, unknown>)[k] });
          else diff((objA as Record<string, unknown>)[k], (objB as Record<string, unknown>)[k], p);
        }
      }
      diff(a, b, "");
      return { changes: diffs.length, identical: diffs.length === 0, diffs };
    } catch (e) { return { error: `Invalid JSON: ${String(e)}` }; }
  },

  "json.merge": (args) => {
    const deep = args.deep !== false;
    try {
      const a = JSON.parse(String(args.a ?? ""));
      const b = JSON.parse(String(args.b ?? ""));
      function merge(target: unknown, source: unknown): unknown {
        if (!deep || typeof target !== "object" || target === null || typeof source !== "object" || source === null) return source;
        if (Array.isArray(target) || Array.isArray(source)) return source;
        const result = { ...target as object };
        for (const [k, v] of Object.entries(source as object)) { (result as Record<string, unknown>)[k] = merge((result as Record<string, unknown>)[k], v); }
        return result;
      }
      return { result: merge(a, b) };
    } catch (e) { return { error: `Invalid JSON: ${String(e)}` }; }
  },

  "json.schema": (args) => {
    try {
      const parsed = JSON.parse(String(args.json ?? ""));
      function infer(v: unknown): Record<string, unknown> {
        if (v === null) return { type: "null" };
        if (Array.isArray(v)) return { type: "array", items: v.length > 0 ? infer(v[0]) : {} };
        if (typeof v === "object") {
          const props: Record<string, unknown> = {};
          for (const [k, val] of Object.entries(v as Record<string, unknown>)) props[k] = infer(val);
          return { type: "object", properties: props };
        }
        return { type: typeof v };
      }
      return { schema: { "$schema": "http://json-schema.org/draft-07/schema#", ...infer(parsed) } };
    } catch (e) { return { error: `Invalid JSON: ${String(e)}` }; }
  },

  // ── CSV ───────────────────────────────────────────────────────────────────────

  "csv.parse": (args) => {
    const header = args.header !== false;
    const delimiter = String(args.delimiter ?? ",");
    try {
      const records = csvParse(String(args.csv ?? ""), { delimiter, columns: header, skip_empty_lines: true }) as unknown[];
      return { rows: records, row_count: records.length, columns: header && records.length > 0 ? Object.keys(records[0] as Record<string, unknown>) : [] };
    } catch (e) { return { error: `CSV parse error: ${String(e)}` }; }
  },

  "csv.generate": (args) => {
    const rows = args.rows;
    if (!Array.isArray(rows)) return { error: "rows must be an array" };
    const delimiter = String(args.delimiter ?? ",");
    try {
      const csv = csvStringify(rows, { header: args.header !== false, delimiter });
      return { csv, row_count: rows.length };
    } catch (e) { return { error: `CSV generate error: ${String(e)}` }; }
  },

  "csv.query": (args) => {
    const delimiter = String(args.delimiter ?? ",");
    const filter = args.filter as Record<string, unknown> | undefined;
    const select = args.select as string[] | undefined;
    try {
      let records = csvParse(String(args.csv ?? ""), { delimiter, columns: true, skip_empty_lines: true }) as Record<string, unknown>[];
      if (filter) records = records.filter((row) => Object.entries(filter).every(([k, v]) => String(row[k]) === String(v)));
      if (select?.length) records = records.map((row) => Object.fromEntries(select.map((c) => [c, row[c]])));
      return { rows: records, row_count: records.length };
    } catch (e) { return { error: `CSV query error: ${String(e)}` }; }
  },

  "csv.sort": (args) => {
    const delimiter = String(args.delimiter ?? ",");
    const column = String(args.column ?? "");
    const desc = String(args.direction ?? "asc").toLowerCase() === "desc";
    try {
      const records = csvParse(String(args.csv ?? ""), { delimiter, columns: true, skip_empty_lines: true }) as Record<string, unknown>[];
      records.sort((a, b) => {
        const av = a[column], bv = b[column];
        const an = Number(av), bn = Number(bv);
        const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : String(av).localeCompare(String(bv));
        return desc ? -cmp : cmp;
      });
      return { csv: csvStringify(records, { header: true, delimiter }), row_count: records.length };
    } catch (e) { return { error: `CSV sort error: ${String(e)}` }; }
  },

  "csv.columns": (args) => {
    try {
      const records = csvParse(String(args.csv ?? ""), { delimiter: String(args.delimiter ?? ","), columns: true, skip_empty_lines: true }) as Record<string, unknown>[];
      const columns = records.length > 0 ? Object.keys(records[0]) : [];
      return { columns, column_count: columns.length, row_count: records.length };
    } catch (e) { return { error: String(e) }; }
  },

  "csv.stats": (args) => {
    const column = String(args.column ?? "");
    try {
      const records = csvParse(String(args.csv ?? ""), { delimiter: String(args.delimiter ?? ","), columns: true, skip_empty_lines: true }) as Record<string, unknown>[];
      const values = records.map((r) => Number(r[column])).filter((v) => !isNaN(v));
      if (!values.length) return { error: `Column "${column}" has no numeric values` };
      const sorted = [...values].sort((a, b) => a - b);
      const sum = values.reduce((a, b) => a + b, 0);
      const mean = sum / values.length;
      const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      return { column, count: values.length, sum, mean: Math.round(mean * 10000) / 10000, median, min: sorted[0], max: sorted[sorted.length - 1], stddev: Math.round(Math.sqrt(variance) * 10000) / 10000 };
    } catch (e) { return { error: String(e) }; }
  },

  // ── VALIDATE ─────────────────────────────────────────────────────────────────

  "validate.email": (args) => {
    const email = String(args.email ?? "");
    const valid = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email);
    return { email, valid };
  },

  "validate.url": (args) => {
    const url = String(args.url ?? "");
    try { const p = new URL(url); return { url, valid: true, protocol: p.protocol, hostname: p.hostname, path: p.pathname }; }
    catch { return { url, valid: false }; }
  },

  "validate.phone": (args) => {
    const phone = String(args.phone ?? "");
    const digits = phone.replace(/[\s()\-+.]/g, "");
    const valid = /^\+?[1-9]\d{6,14}$/.test(phone.replace(/[\s()\-.]/g, ""));
    return { phone, valid, digits_only: digits };
  },

  "validate.json": (args) => {
    const json = String(args.json ?? "");
    try { const parsed = JSON.parse(json); return { valid: true, type: Array.isArray(parsed) ? "array" : typeof parsed }; }
    catch (e) { return { valid: false, error: String(e) }; }
  },

  "validate.credit-card": (args) => {
    const number = String(args.number ?? "").replace(/[\s\-]/g, "");
    let sum = 0, alt = false;
    for (let i = number.length - 1; i >= 0; i--) {
      let n = parseInt(number[i]);
      if (isNaN(n)) return { valid: false, error: "Non-numeric characters" };
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n; alt = !alt;
    }
    const valid = sum % 10 === 0 && number.length >= 13;
    const brand = /^4/.test(number) ? "visa" : /^5[1-5]/.test(number) ? "mastercard" : /^3[47]/.test(number) ? "amex" : /^6(?:011|5)/.test(number) ? "discover" : "unknown";
    return { valid, brand, length: number.length };
  },

  "validate.ip": (args) => {
    const ip = String(args.ip ?? "");
    const v4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) && ip.split(".").every((n) => parseInt(n) <= 255);
    const v6 = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(ip);
    return { ip, valid: v4 || v6, version: v4 ? 4 : v6 ? 6 : null };
  },

  "validate.color": (args) => {
    const color = String(args.color ?? "");
    const hexValid = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color);
    const rgbValid = /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i.test(color);
    const hslValid = /^hsl\(\s*\d+\s*,\s*\d+%?\s*,\s*\d+%?\s*\)$/i.test(color);
    return { color, valid: hexValid || rgbValid || hslValid, format: hexValid ? "hex" : rgbValid ? "rgb" : hslValid ? "hsl" : null };
  },

  // ── COLOR ─────────────────────────────────────────────────────────────────────

  "color.convert": (args) => {
    const raw = args.color;
    const colorStr = typeof raw === "object" && raw !== null
      ? ("r" in (raw as object) ? `rgb(${(raw as Record<string,number>).r}, ${(raw as Record<string,number>).g}, ${(raw as Record<string,number>).b})` : `hsl(${(raw as Record<string,number>).h}, ${(raw as Record<string,number>).s}%, ${(raw as Record<string,number>).l}%)`)
      : String(raw ?? "");
    const rgb = parseColorToRgb(colorStr);
    if (!rgb) return { error: `Cannot parse color: "${colorStr}"` };
    return colorInfo(rgb);
  },

  "color.palette": (args) => {
    const rgb = parseColorToRgb(String(args.color ?? ""));
    if (!rgb) return { error: `Cannot parse color: "${args.color}"` };
    const hsl = rgbToHsl(rgb);
    const type = String(args.type ?? "complementary");
    let palette: HSL[] = [];
    if (type === "complementary") palette = [hsl, { h: (hsl.h + 180) % 360, s: hsl.s, l: hsl.l }];
    else if (type === "analogous") palette = [{ h: (hsl.h - 30 + 360) % 360, s: hsl.s, l: hsl.l }, hsl, { h: (hsl.h + 30) % 360, s: hsl.s, l: hsl.l }];
    else if (type === "triadic") palette = [hsl, { h: (hsl.h + 120) % 360, s: hsl.s, l: hsl.l }, { h: (hsl.h + 240) % 360, s: hsl.s, l: hsl.l }];
    else if (type === "tetradic") palette = [hsl, { h: (hsl.h + 90) % 360, s: hsl.s, l: hsl.l }, { h: (hsl.h + 180) % 360, s: hsl.s, l: hsl.l }, { h: (hsl.h + 270) % 360, s: hsl.s, l: hsl.l }];
    else if (type === "monochromatic") palette = [{ h: hsl.h, s: hsl.s, l: Math.max(10, hsl.l - 30) }, { h: hsl.h, s: hsl.s, l: Math.max(10, hsl.l - 15) }, hsl, { h: hsl.h, s: hsl.s, l: Math.min(90, hsl.l + 15) }, { h: hsl.h, s: hsl.s, l: Math.min(90, hsl.l + 30) }];
    else return { error: `Unknown palette type "${type}"` };
    return { type, colors: palette.map((c) => colorInfo(hslToRgb(c))) };
  },

  "color.mix": (args) => {
    const rgb1 = parseColorToRgb(String(args.color1 ?? ""));
    const rgb2 = parseColorToRgb(String(args.color2 ?? ""));
    if (!rgb1) return { error: `Cannot parse color1: "${args.color1}"` };
    if (!rgb2) return { error: `Cannot parse color2: "${args.color2}"` };
    const w = Math.max(0, Math.min(1, Number(args.weight ?? 0.5)));
    const mixed: RGB = { r: Math.round(rgb1.r * (1 - w) + rgb2.r * w), g: Math.round(rgb1.g * (1 - w) + rgb2.g * w), b: Math.round(rgb1.b * (1 - w) + rgb2.b * w) };
    return { color1: rgbToHex(rgb1), color2: rgbToHex(rgb2), weight: w, result: colorInfo(mixed) };
  },

  "color.contrast": (args) => {
    const rgb1 = parseColorToRgb(String(args.color1 ?? ""));
    const rgb2 = parseColorToRgb(String(args.color2 ?? ""));
    if (!rgb1) return { error: `Cannot parse color1` };
    if (!rgb2) return { error: `Cannot parse color2` };
    function relative(c: RGB) {
      return [c.r, c.g, c.b].map((n) => { const s = n / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); }).reduce((acc, v, i) => acc + [0.2126, 0.7152, 0.0722][i] * v, 0);
    }
    const l1 = relative(rgb1), l2 = relative(rgb2);
    const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
    const ratio = Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
    return { color1: rgbToHex(rgb1), color2: rgbToHex(rgb2), contrast_ratio: ratio, wcag_aa_normal: ratio >= 4.5, wcag_aa_large: ratio >= 3, wcag_aaa_normal: ratio >= 7, wcag_aaa_large: ratio >= 4.5 };
  },

  "color.lighten": (args) => {
    const rgb = parseColorToRgb(String(args.color ?? ""));
    if (!rgb) return { error: `Cannot parse color: "${args.color}"` };
    const amount = Number(args.amount ?? 10);
    const hsl = rgbToHsl(rgb);
    const lightened = hslToRgb({ h: hsl.h, s: hsl.s, l: Math.min(100, hsl.l + amount) });
    return { original: rgbToHex(rgb), amount, result: colorInfo(lightened) };
  },

  "color.darken": (args) => {
    const rgb = parseColorToRgb(String(args.color ?? ""));
    if (!rgb) return { error: `Cannot parse color: "${args.color}"` };
    const amount = Number(args.amount ?? 10);
    const hsl = rgbToHsl(rgb);
    const darkened = hslToRgb({ h: hsl.h, s: hsl.s, l: Math.max(0, hsl.l - amount) });
    return { original: rgbToHex(rgb), amount, result: colorInfo(darkened) };
  },

  // ── TIMESTAMP ────────────────────────────────────────────────────────────────

  "timestamp.now": () => {
    const now = new Date();
    return { iso: now.toISOString(), unix_seconds: Math.floor(now.getTime() / 1000), unix_ms: now.getTime(), utc: now.toUTCString() };
  },

  "timestamp.convert": (args) => {
    const ts = args.timestamp as string | number;
    if (ts == null) return { error: "timestamp is required" };
    const d = parseTs(ts);
    if (isNaN(d.getTime())) return { error: `Cannot parse timestamp: ${ts}` };
    return { iso: d.toISOString(), unix_seconds: Math.floor(d.getTime() / 1000), unix_ms: d.getTime(), utc: d.toUTCString(), date: d.toISOString().split("T")[0], time: d.toISOString().split("T")[1].split(".")[0] };
  },

  "timestamp.diff": (args) => {
    const from = parseTs(args.from as string | number);
    const to = parseTs(args.to as string | number);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return { error: "Invalid timestamp" };
    const ms = to.getTime() - from.getTime();
    return { from: from.toISOString(), to: to.toISOString(), milliseconds: ms, seconds: Math.floor(ms / 1000), minutes: Math.floor(ms / 60000), hours: Math.floor(ms / 3600000), days: Math.floor(ms / 86400000), human: formatDuration(Math.abs(ms), Math.sign(ms)) };
  },

  "timestamp.add": (args) => {
    const ts = args.timestamp as string | number;
    if (ts == null) return { error: "timestamp is required" };
    const d = parseTs(ts);
    if (isNaN(d.getTime())) return { error: `Cannot parse timestamp: ${ts}` };
    const dur = (args.duration ?? {}) as Record<string, number>;
    const ms = d.getTime() + (dur.seconds ?? 0) * 1000 + (dur.minutes ?? 0) * 60000 + (dur.hours ?? 0) * 3600000 + (dur.days ?? 0) * 86400000 + (dur.weeks ?? 0) * 604800000;
    const result = new Date(ms);
    if (dur.months) result.setMonth(result.getMonth() + dur.months);
    if (dur.years) result.setFullYear(result.getFullYear() + dur.years);
    return { original: d.toISOString(), result: result.toISOString(), unix_seconds: Math.floor(result.getTime() / 1000) };
  },

  "timestamp.format": (args) => {
    const ts = args.timestamp as string | number;
    if (ts == null) return { error: "timestamp is required" };
    const d = parseTs(ts);
    if (isNaN(d.getTime())) return { error: `Cannot parse timestamp: ${ts}` };
    const fmt = String(args.format ?? "YYYY-MM-DD HH:mm:ss");
    const pad = (n: number, len = 2) => String(n).padStart(len, "0");
    const result = fmt.replace("YYYY", String(d.getFullYear())).replace("MM", pad(d.getMonth() + 1)).replace("DD", pad(d.getDate())).replace("HH", pad(d.getHours())).replace("mm", pad(d.getMinutes())).replace("ss", pad(d.getSeconds())).replace("SSS", pad(d.getMilliseconds(), 3));
    return { timestamp: d.toISOString(), format: fmt, result };
  },

  // ── CRON ─────────────────────────────────────────────────────────────────────

  "cron.parse": (args) => parseCronExpression(String(args.expression ?? "")),
  "cron.next": (args) => getCronNextOccurrences(String(args.expression ?? ""), Math.min(50, Math.max(1, Number(args.count ?? 5))), args.after ? new Date(String(args.after)) : new Date()),
  "cron.validate": (args) => validateCronExpression(String(args.expression ?? "")),
  "cron.build": (args) => buildCronExpression(String(args.every ?? ""), args.at ? String(args.at) : undefined, args.on ? String(args.on) : undefined),

  // ── IP ────────────────────────────────────────────────────────────────────────

  "ip.lookup": () => ({ message: "ip.lookup requires a server context. Use a geolocation API (e.g. ip-api.com) directly.", available: false }),
  "ip.parse": (args) => parseIpAddress(String(args.ip ?? "")),
  "ip.subnet": (args) => computeSubnet(String(args.cidr ?? "")),
  "ip.range": (args) => checkIpRange(args),
  "ip.convert": (args) => parseIpAddress(String(args.ip ?? "")),

  // ── UUID ─────────────────────────────────────────────────────────────────────

  "uuid.v4": () => ({ uuid: crypto.randomUUID(), version: 4 }),

  "uuid.validate": (args) => {
    const uuid = String(args.uuid ?? "");
    const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
    return { uuid, valid, version: valid ? parseInt(uuid[14]) : null };
  },

  "uuid.parse": (args) => {
    const uuid = String(args.uuid ?? "");
    const m = uuid.match(/^([0-9a-f]{8})-([0-9a-f]{4})-([1-5])([0-9a-f]{3})-([89ab][0-9a-f]{3})-([0-9a-f]{12})$/i);
    if (!m) return { uuid, valid: false, error: "Not a valid UUID" };
    return { uuid, valid: true, version: parseInt(m[3]), hex: uuid.replace(/-/g, ""), parts: { time_low: m[1], time_mid: m[2], time_hi_and_version: m[3] + m[4], clock_seq: m[5], node: m[6] } };
  },

  // ── RANDOM ────────────────────────────────────────────────────────────────────

  "random.number": (args) => {
    const min = Number(args.min ?? 0), max = Number(args.max ?? 100);
    const count = Math.min(1000, Math.max(1, Number(args.count ?? 1)));
    const decimals = Math.min(10, Math.max(0, Number(args.decimals ?? 0)));
    if (min > max) return { error: "min must be <= max" };
    const mult = Math.pow(10, decimals);
    const numbers = Array.from({ length: count }, () => Math.round((min + secureRandom() * (max - min)) * mult) / mult);
    return { min, max, count, decimals, numbers, single: count === 1 ? numbers[0] : undefined };
  },

  "random.string": (args) => {
    const length = Math.min(4096, Math.max(1, Number(args.length ?? 16)));
    const charset = String(args.charset ?? "alphanumeric").toLowerCase();
    const count = Math.min(100, Math.max(1, Number(args.count ?? 1)));
    const charsets: Record<string, string> = { alpha: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", numeric: "0123456789", alphanumeric: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", hex: "0123456789abcdef", custom: String(args.custom_chars ?? "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789") };
    const chars = charsets[charset];
    if (!chars) return { error: `charset "${charset}" not supported` };
    const strings = Array.from({ length: count }, () => Array.from({ length }, () => chars[Math.floor(secureRandom() * chars.length)]).join(""));
    return { length, charset, count, strings, single: count === 1 ? strings[0] : undefined };
  },

  "random.password": (args) => {
    const length = Math.min(512, Math.max(4, Number(args.length ?? 16)));
    const count = Math.min(100, Math.max(1, Number(args.count ?? 1)));
    let chars = "";
    if (args.uppercase !== false) chars += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (args.lowercase !== false) chars += "abcdefghijklmnopqrstuvwxyz";
    if (args.numbers !== false) chars += "0123456789";
    if (args.symbols !== false) chars += "!@#$%^&*()-_=+[]{}|;:,.<>?";
    if (!chars) return { error: "At least one character set must be enabled" };
    const passwords = Array.from({ length: count }, () => Array.from({ length }, () => chars[Math.floor(secureRandom() * chars.length)]).join(""));
    return { length, count, passwords, single: count === 1 ? passwords[0] : undefined };
  },

  "random.pick": (args) => {
    const items = args.items;
    if (!Array.isArray(items)) return { error: "items must be an array" };
    const count = Math.min(items.length, Math.max(1, Number(args.count ?? 1)));
    const unique = args.unique !== false;
    const picked = unique
      ? [...items].sort(() => secureRandom() - 0.5).slice(0, count)
      : Array.from({ length: count }, () => items[Math.floor(secureRandom() * items.length)]);
    return { total_items: items.length, count, unique, picked, single: count === 1 ? picked[0] : undefined };
  },

  "random.shuffle": (args) => {
    const items = args.items;
    if (!Array.isArray(items)) return { error: "items must be an array" };
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(secureRandom() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    return { original_length: items.length, shuffled };
  },

  "random.color": (args) => {
    const format = String(args.format ?? "hex").toLowerCase();
    const count = Math.min(100, Math.max(1, Number(args.count ?? 1)));
    const colors = Array.from({ length: count }, () => {
      const r = Math.floor(secureRandom() * 256), g = Math.floor(secureRandom() * 256), b = Math.floor(secureRandom() * 256);
      if (format === "rgb") return `rgb(${r}, ${g}, ${b})`;
      if (format === "hsl") { const hsl = rgbToHsl({ r, g, b }); return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`; }
      return rgbToHex({ r, g, b });
    });
    return { format, count, colors, single: count === 1 ? colors[0] : undefined };
  },

  // ── REPORT BUG ────────────────────────────────────────────────────────────────

  "report_bug.create": (args) => {
    process.stderr.write(`[UnClick BugReport] ${JSON.stringify(args)}\n`);
    return { submitted: true, message: "Bug report logged. To file publicly, visit https://github.com/malamutemayhem/unclick-agent-native-endpoints/issues" };
  },

  // ── KV STORE (in-memory, per session) ─────────────────────────────────────────

  "kv.set": (args) => {
    const key = String(args.key ?? "");
    if (!key) return { error: "key is required" };
    const entry = KV_STORE.get(key);
    const version = (entry?.version ?? 0) + 1;
    const expires = args.ttl ? Date.now() + Number(args.ttl) * 1000 : undefined;
    KV_STORE.set(key, { value: args.value, expires, version });
    return { key, set: true, version, expires: expires ? new Date(expires).toISOString() : null };
  },

  "kv.get": (args) => {
    const key = String(args.key ?? "");
    const entry = KV_STORE.get(key);
    if (!entry) return { key, found: false, value: null };
    if (entry.expires && entry.expires < Date.now()) { KV_STORE.delete(key); return { key, found: false, value: null, expired: true }; }
    return { key, found: true, value: entry.value, version: entry.version };
  },

  "kv.delete": (args) => {
    const key = String(args.key ?? "");
    const existed = KV_STORE.has(key);
    KV_STORE.delete(key);
    return { key, deleted: existed };
  },

  "kv.list": (args) => {
    const prefix = args.prefix ? String(args.prefix) : undefined;
    const now = Date.now();
    const keys: string[] = [];
    for (const [k, v] of KV_STORE.entries()) {
      if (v.expires && v.expires < now) { KV_STORE.delete(k); continue; }
      if (!prefix || k.startsWith(prefix)) keys.push(k);
    }
    return { keys, count: keys.length };
  },

  "kv.exists": (args) => {
    const key = String(args.key ?? "");
    const entry = KV_STORE.get(key);
    if (!entry) return { key, exists: false };
    if (entry.expires && entry.expires < Date.now()) { KV_STORE.delete(key); return { key, exists: false, expired: true }; }
    return { key, exists: true };
  },

  "kv.increment": (args) => {
    const key = String(args.key ?? "");
    const by = Number(args.by ?? 1);
    const entry = KV_STORE.get(key);
    const current = entry?.value != null ? Number(entry.value) : 0;
    if (isNaN(current)) return { error: `Value for "${key}" is not numeric` };
    const newValue = current + by;
    KV_STORE.set(key, { value: newValue, expires: entry?.expires, version: (entry?.version ?? 0) + 1 });
    return { key, previous: current, value: newValue, incremented_by: by };
  },

  // ── IMAGE (requires external library, not available locally) ─────────────────

  "image.resize": () => ({ error: "Image processing requires Sharp or the remote UnClick API. Install sharp and configure UNCLICK_BASE_URL, or use a different image processing tool." }),
  "image.convert": () => ({ error: "Image processing requires the remote UnClick API." }),
  "image.compress": () => ({ error: "Image processing requires the remote UnClick API." }),
  "image.metadata": () => ({ error: "Image processing requires the remote UnClick API." }),
  "image.crop": () => ({ error: "Image processing requires the remote UnClick API." }),
  "image.rotate": () => ({ error: "Image processing requires the remote UnClick API." }),
  "image.grayscale": () => ({ error: "Image processing requires the remote UnClick API." }),

  // ── QR CODE ───────────────────────────────────────────────────────────────────

  "qr.generate": () => ({ error: "QR code generation requires the remote UnClick API." }),

  // ── URL SHORTENER ─────────────────────────────────────────────────────────────

  "shorten.create": () => ({ error: "URL shortening requires the remote UnClick API." }),
  "shorten.stats": () => ({ error: "URL shortener stats require the remote UnClick API." }),

  // ── WEBHOOK ───────────────────────────────────────────────────────────────────

  "webhook.create": () => ({ error: "Webhooks require the remote UnClick API." }),
  "webhook.requests": () => ({ error: "Webhooks require the remote UnClick API." }),
  "webhook.delete": () => ({ error: "Webhooks require the remote UnClick API." }),
};

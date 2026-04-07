import { Hono } from 'hono';
import { z } from 'zod';
import { ok, Errors } from '@unclick/core';
import { zv } from '../middleware/validate.js';
import { requireScope } from '../middleware/auth.js';
import type { AppVariables } from '../middleware/types.js';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const FormatSchema = z.object({
  json: z.string().min(1).max(1_000_000),
  indent: z.union([z.literal(2), z.literal(4), z.literal('tab')]).default(2),
});

const MinifySchema = z.object({
  json: z.string().min(1).max(1_000_000),
});

const QuerySchema = z.object({
  json: z.string().min(1).max(1_000_000),
  query: z.string().min(1),
});

const FlattenSchema = z.object({
  json: z.string().min(1).max(1_000_000),
  delimiter: z.string().min(1).max(4).default('.'),
});

const UnflattenSchema = z.object({
  json: z.string().min(1).max(1_000_000),
  delimiter: z.string().min(1).max(4).default('.'),
});

const DiffSchema = z.object({
  a: z.string().min(1).max(1_000_000),
  b: z.string().min(1).max(1_000_000),
});

const MergeSchema = z.object({
  objects: z.array(z.string().min(1).max(1_000_000)).min(2).max(10),
});

const SchemaGenSchema = z.object({
  json: z.string().min(1).max(1_000_000),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJson(raw: string, label = 'json'): unknown {
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw Errors.validation(`Invalid JSON in "${label}": ${(e as Error).message}`);
  }
}

function flattenObj(
  obj: unknown,
  prefix: string,
  delimiter: string,
  result: Record<string, unknown>,
): void {
  if (typeof obj !== 'object' || obj === null) {
    result[prefix] = obj;
    return;
  }
  const entries: [string, unknown][] = Array.isArray(obj)
    ? obj.map((v, i) => [String(i), v])
    : Object.entries(obj as Record<string, unknown>);
  for (const [key, value] of entries) {
    flattenObj(value, prefix ? `${prefix}${delimiter}${key}` : key, delimiter, result);
  }
}

function unflattenObj(
  flat: Record<string, unknown>,
  delimiter: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(flat)) {
    const keys = path.split(delimiter);
    let current: Record<string, unknown> = result;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]] = value;
  }
  return result;
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

type DiffResult = {
  added: string[];
  removed: string[];
  changed: Array<{ key: string; from: unknown; to: unknown }>;
};

function diffObjects(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  prefix = '',
): DiffResult {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: Array<{ key: string; from: unknown; to: unknown }> = [];

  const aKeys = new Set(Object.keys(a));
  const bKeys = new Set(Object.keys(b));

  for (const key of bKeys) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (!aKeys.has(key)) {
      added.push(fullKey);
    } else if (
      typeof a[key] === 'object' && a[key] !== null && !Array.isArray(a[key]) &&
      typeof b[key] === 'object' && b[key] !== null && !Array.isArray(b[key])
    ) {
      const nested = diffObjects(
        a[key] as Record<string, unknown>,
        b[key] as Record<string, unknown>,
        fullKey,
      );
      added.push(...nested.added);
      removed.push(...nested.removed);
      changed.push(...nested.changed);
    } else if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
      changed.push({ key: fullKey, from: a[key], to: b[key] });
    }
  }

  for (const key of aKeys) {
    if (!bKeys.has(key)) {
      removed.push(prefix ? `${prefix}.${key}` : key);
    }
  }

  return { added, removed, changed };
}

function inferSchema(value: unknown): Record<string, unknown> {
  if (value === null) return { type: 'null' };
  if (typeof value === 'boolean') return { type: 'boolean' };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { type: 'integer' } : { type: 'number' };
  }
  if (typeof value === 'string') return { type: 'string' };
  if (Array.isArray(value)) {
    const schema: Record<string, unknown> = { type: 'array' };
    if (value.length > 0) schema.items = inferSchema(value[0]);
    return schema;
  }
  if (typeof value === 'object') {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      properties[k] = inferSchema(v);
      required.push(k);
    }
    return { type: 'object', properties, required };
  }
  return {};
}

function dotQuery(obj: unknown, query: string): unknown[] {
  // Strip leading $. or $ (JSONPath prefix)
  const normalized = query.replace(/^\$\.?/, '');
  const parts = normalized.split('.').filter(Boolean);

  function walk(current: unknown, remaining: string[]): unknown[] {
    if (remaining.length === 0) return [current];
    if (current === null || typeof current !== 'object') return [];
    const [head, ...tail] = remaining;
    // Array index notation: items[0]
    const arrMatch = /^(.+)\[(\d+)\]$/.exec(head);
    if (arrMatch) {
      const sub = (current as Record<string, unknown>)[arrMatch[1]];
      if (!Array.isArray(sub)) return [];
      const idx = parseInt(arrMatch[2], 10);
      if (idx >= sub.length) return [];
      return walk(sub[idx], tail);
    }
    // Wildcard
    if (head === '*') {
      return Object.values(current as Record<string, unknown>).flatMap((v) => walk(v, tail));
    }
    return walk((current as Record<string, unknown>)[head], tail);
  }

  return walk(obj, parts);
}

// ─── Router ───────────────────────────────────────────────────────────────────

export function createJsonRouter() {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /json/format - pretty-print with configurable indent
  router.post('/format', requireScope('json:use'), zv('json', FormatSchema), (c) => {
    const { json, indent } = c.req.valid('json');
    const parsed = parseJson(json);
    const spaces = indent === 'tab' ? '\t' : indent;
    const formatted = JSON.stringify(parsed, null, spaces);
    return ok(c, { json: formatted, bytes: formatted.length });
  });

  // POST /json/minify - strip all whitespace
  router.post('/minify', requireScope('json:use'), zv('json', MinifySchema), (c) => {
    const { json } = c.req.valid('json');
    const parsed = parseJson(json);
    const minified = JSON.stringify(parsed);
    return ok(c, { json: minified, bytes: minified.length });
  });

  // POST /json/query - dot-notation / JSONPath query
  router.post('/query', requireScope('json:use'), zv('json', QuerySchema), (c) => {
    const { json, query } = c.req.valid('json');
    const parsed = parseJson(json);
    const results = dotQuery(parsed, query);
    return ok(c, { results, count: results.length });
  });

  // POST /json/flatten - nested object → dot-notation keys
  router.post('/flatten', requireScope('json:use'), zv('json', FlattenSchema), (c) => {
    const { json, delimiter } = c.req.valid('json');
    const parsed = parseJson(json);
    if (typeof parsed !== 'object' || parsed === null) {
      throw Errors.validation('Input must be a JSON object or array');
    }
    const result: Record<string, unknown> = {};
    flattenObj(parsed, '', delimiter, result);
    return ok(c, { json: result, keys: Object.keys(result).length });
  });

  // POST /json/unflatten - dot-notation keys → nested object
  router.post('/unflatten', requireScope('json:use'), zv('json', UnflattenSchema), (c) => {
    const { json, delimiter } = c.req.valid('json');
    const parsed = parseJson(json);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw Errors.validation('Input must be a flat JSON object');
    }
    const result = unflattenObj(parsed as Record<string, unknown>, delimiter);
    return ok(c, { json: result });
  });

  // POST /json/diff - compare two JSON objects
  router.post('/diff', requireScope('json:use'), zv('json', DiffSchema), (c) => {
    const { a, b } = c.req.valid('json');
    const objA = parseJson(a, 'a');
    const objB = parseJson(b, 'b');
    if (typeof objA !== 'object' || objA === null || Array.isArray(objA)) {
      throw Errors.validation('Parameter "a" must be a JSON object');
    }
    if (typeof objB !== 'object' || objB === null || Array.isArray(objB)) {
      throw Errors.validation('Parameter "b" must be a JSON object');
    }
    const result = diffObjects(
      objA as Record<string, unknown>,
      objB as Record<string, unknown>,
    );
    return ok(c, result);
  });

  // POST /json/merge - deep-merge two or more JSON objects
  router.post('/merge', requireScope('json:use'), zv('json', MergeSchema), (c) => {
    const { objects } = c.req.valid('json');
    const parsed = objects.map((raw, i) => {
      const p = parseJson(raw, `objects[${i}]`);
      if (typeof p !== 'object' || p === null || Array.isArray(p)) {
        throw Errors.validation(`objects[${i}] must be a JSON object`);
      }
      return p as Record<string, unknown>;
    });
    const result = parsed.reduce((acc, obj) => deepMerge(acc, obj), {} as Record<string, unknown>);
    return ok(c, { json: result, keys: Object.keys(result).length });
  });

  // POST /json/schema - generate a JSON Schema from a sample
  router.post('/schema', requireScope('json:use'), zv('json', SchemaGenSchema), (c) => {
    const { json } = c.req.valid('json');
    const parsed = parseJson(json);
    const schema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      ...inferSchema(parsed),
    };
    return ok(c, { schema });
  });

  return router;
}

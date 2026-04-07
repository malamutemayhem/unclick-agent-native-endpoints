/**
 * Tests for UnClick JSON - /v1/json
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app.js';
import { setupTestDb } from './setup.js';

let app: ReturnType<typeof createApp>;
let apiKey: string;

function auth(key: string) {
  return { Authorization: `Bearer ${key}` };
}

beforeAll(async () => {
  apiKey = await setupTestDb();
  app = createApp();
});

async function post(path: string, body: unknown) {
  return app.request(`/v1/json${path}`, {
    method: 'POST',
    headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── POST /v1/json/format ─────────────────────────────────────────────────────

describe('POST /v1/json/format', () => {
  it('pretty-prints with 2-space indent by default', async () => {
    const res = await post('/format', { json: '{"a":1,"b":2}' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.json).toBe(JSON.stringify({ a: 1, b: 2 }, null, 2));
  });

  it('uses 4-space indent', async () => {
    const res = await post('/format', { json: '{"x":1}', indent: 4 });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.json).toBe(JSON.stringify({ x: 1 }, null, 4));
  });

  it('uses tab indent', async () => {
    const res = await post('/format', { json: '{"x":1}', indent: 'tab' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.json).toContain('\t');
  });

  it('rejects invalid JSON', async () => {
    const res = await post('/format', { json: '{bad}' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/v1/json/format', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: '{}' }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── POST /v1/json/minify ─────────────────────────────────────────────────────

describe('POST /v1/json/minify', () => {
  it('strips whitespace', async () => {
    const res = await post('/minify', { json: '{\n  "a": 1,\n  "b": 2\n}' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.json).toBe('{"a":1,"b":2}');
  });

  it('handles arrays', async () => {
    const res = await post('/minify', { json: '[ 1 , 2 , 3 ]' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.json).toBe('[1,2,3]');
  });

  it('rejects invalid JSON', async () => {
    const res = await post('/minify', { json: 'not json' });
    expect(res.status).toBe(400);
  });
});

// ─── POST /v1/json/query ──────────────────────────────────────────────────────

describe('POST /v1/json/query', () => {
  it('retrieves a top-level key', async () => {
    const res = await post('/query', { json: '{"name":"Alice","age":30}', query: 'name' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.results).toEqual(['Alice']);
    expect(body.data.count).toBe(1);
  });

  it('retrieves a nested key with dot notation', async () => {
    const res = await post('/query', {
      json: '{"user":{"name":"Bob","score":99}}',
      query: 'user.name',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.results).toEqual(['Bob']);
  });

  it('returns null for missing key (JSON serialises undefined as null)', async () => {
    const res = await post('/query', { json: '{"a":1}', query: 'b' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    // undefined values are serialised to null in JSON
    expect(body.data.results).toEqual([null]);
    expect(body.data.count).toBe(1);
  });

  it('supports $ prefix (JSONPath style)', async () => {
    const res = await post('/query', { json: '{"x":{"y":42}}', query: '$.x.y' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.results).toEqual([42]);
  });

  it('supports array index notation', async () => {
    const res = await post('/query', {
      json: '{"items":[10,20,30]}',
      query: 'items[1]',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.results).toEqual([20]);
  });
});

// ─── POST /v1/json/flatten ────────────────────────────────────────────────────

describe('POST /v1/json/flatten', () => {
  it('flattens a nested object', async () => {
    const res = await post('/flatten', {
      json: '{"a":{"b":{"c":1}}}',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.json).toEqual({ 'a.b.c': 1 });
    expect(body.data.keys).toBe(1);
  });

  it('flattens arrays with numeric keys', async () => {
    const res = await post('/flatten', { json: '{"arr":[1,2,3]}' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.json['arr.0']).toBe(1);
    expect(body.data.json['arr.2']).toBe(3);
  });

  it('supports custom delimiter', async () => {
    const res = await post('/flatten', { json: '{"a":{"b":1}}', delimiter: '_' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.json).toHaveProperty('a_b', 1);
  });

  it('rejects a primitive input', async () => {
    const res = await post('/flatten', { json: '"just a string"' });
    expect(res.status).toBe(400);
  });
});

// ─── POST /v1/json/unflatten ──────────────────────────────────────────────────

describe('POST /v1/json/unflatten', () => {
  it('reconstructs nested object from dot keys', async () => {
    const res = await post('/unflatten', { json: '{"a.b.c":1}' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.json).toEqual({ a: { b: { c: 1 } } });
  });

  it('supports custom delimiter', async () => {
    const res = await post('/unflatten', { json: '{"a_b":2}', delimiter: '_' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.json).toEqual({ a: { b: 2 } });
  });

  it('rejects an array input', async () => {
    const res = await post('/unflatten', { json: '[1,2,3]' });
    expect(res.status).toBe(400);
  });
});

// ─── POST /v1/json/diff ───────────────────────────────────────────────────────

describe('POST /v1/json/diff', () => {
  it('detects added keys', async () => {
    const res = await post('/diff', {
      a: '{"x":1}',
      b: '{"x":1,"y":2}',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.added).toContain('y');
    expect(body.data.removed).toHaveLength(0);
    expect(body.data.changed).toHaveLength(0);
  });

  it('detects removed keys', async () => {
    const res = await post('/diff', {
      a: '{"x":1,"y":2}',
      b: '{"x":1}',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.removed).toContain('y');
  });

  it('detects changed values', async () => {
    const res = await post('/diff', {
      a: '{"x":1}',
      b: '{"x":99}',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.changed[0]).toMatchObject({ key: 'x', from: 1, to: 99 });
  });

  it('handles identical objects', async () => {
    const res = await post('/diff', { a: '{"a":1}', b: '{"a":1}' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.added).toHaveLength(0);
    expect(body.data.removed).toHaveLength(0);
    expect(body.data.changed).toHaveLength(0);
  });

  it('rejects non-object JSON', async () => {
    const res = await post('/diff', { a: '"string"', b: '{"x":1}' });
    expect(res.status).toBe(400);
  });
});

// ─── POST /v1/json/merge ──────────────────────────────────────────────────────

describe('POST /v1/json/merge', () => {
  it('merges two objects', async () => {
    const res = await post('/merge', {
      objects: ['{"a":1}', '{"b":2}'],
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.json).toEqual({ a: 1, b: 2 });
    expect(body.data.keys).toBe(2);
  });

  it('deep-merges nested objects', async () => {
    const res = await post('/merge', {
      objects: ['{"a":{"x":1,"y":2}}', '{"a":{"y":99,"z":3}}'],
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.json.a).toEqual({ x: 1, y: 99, z: 3 });
  });

  it('later objects win on scalar conflicts', async () => {
    const res = await post('/merge', {
      objects: ['{"a":1}', '{"a":2}'],
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.json.a).toBe(2);
  });

  it('rejects fewer than two objects', async () => {
    const res = await post('/merge', { objects: ['{"a":1}'] });
    expect(res.status).toBe(400);
  });
});

// ─── POST /v1/json/schema ─────────────────────────────────────────────────────

describe('POST /v1/json/schema', () => {
  it('generates schema for a simple object', async () => {
    const res = await post('/schema', { json: '{"name":"Alice","age":30,"active":true}' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const schema = body.data.schema;
    expect(schema.$schema).toContain('json-schema.org');
    expect(schema.type).toBe('object');
    expect(schema.properties.name.type).toBe('string');
    expect(schema.properties.age.type).toBe('integer');
    expect(schema.properties.active.type).toBe('boolean');
  });

  it('generates schema for an array', async () => {
    const res = await post('/schema', { json: '[1,2,3]' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.schema.type).toBe('array');
    expect(body.data.schema.items.type).toBe('integer');
  });

  it('generates schema for null', async () => {
    const res = await post('/schema', { json: 'null' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.schema.type).toBe('null');
  });

  it('distinguishes integer from float', async () => {
    const res = await post('/schema', { json: '{"int":1,"float":1.5}' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.schema.properties.int.type).toBe('integer');
    expect(body.data.schema.properties.float.type).toBe('number');
  });
});

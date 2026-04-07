/**
 * Tests for UnClick CSV - /v1/csv
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app.js';
import { setupTestDb } from './setup.js';

let app: ReturnType<typeof createApp>;
let devKey: string;

const SAMPLE_CSV = `name,age,city
Alice,30,New York
Bob,25,Los Angeles
Carol,35,Chicago
Dave,25,New York`;

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

// ─── Auth guard ──────────────────────────────────────────────────────────────

describe('Auth guard', () => {
  it('rejects unauthenticated requests to /v1/csv/parse', async () => {
    const res = await app.request('/v1/csv/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: SAMPLE_CSV }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── POST /v1/csv/parse ──────────────────────────────────────────────────────

describe('POST /v1/csv/parse', () => {
  it('parses a CSV string to JSON rows', async () => {
    const res = await post('/v1/csv/parse', { csv: SAMPLE_CSV });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    expect(body.data.count).toBe(4);
    expect(body.data.rows[0]).toEqual({ name: 'Alice', age: '30', city: 'New York' });
  });

  it('parses with a custom delimiter', async () => {
    const tsvCsv = 'name\tage\nAlice\t30\nBob\t25';
    const res = await post('/v1/csv/parse', { csv: tsvCsv, delimiter: '\t' });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    expect(body.data.count).toBe(2);
    expect(body.data.rows[0].name).toBe('Alice');
  });

  it('rejects empty csv', async () => {
    const res = await post('/v1/csv/parse', { csv: '' });
    expect(res.status).toBe(400);
  });

  it('rejects missing csv field', async () => {
    const res = await post('/v1/csv/parse', {});
    expect(res.status).toBe(400);
  });
});

// ─── POST /v1/csv/generate ───────────────────────────────────────────────────

describe('POST /v1/csv/generate', () => {
  it('generates CSV from a JSON array', async () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];
    const res = await post('/v1/csv/generate', { data });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    expect(body.data.rows).toBe(2);
    expect(body.data.csv).toContain('name');
    expect(body.data.csv).toContain('Alice');
    expect(body.data.csv).toContain('Bob');
  });

  it('generates CSV with a custom delimiter', async () => {
    const data = [{ name: 'Alice', score: 99 }];
    const res = await post('/v1/csv/generate', { data, delimiter: ';' });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    expect(body.data.csv).toContain(';');
  });

  it('rejects empty data array', async () => {
    const res = await post('/v1/csv/generate', { data: [] });
    expect(res.status).toBe(400);
  });
});

// ─── POST /v1/csv/query ──────────────────────────────────────────────────────

describe('POST /v1/csv/query', () => {
  it('filters rows with equals condition', async () => {
    const res = await post('/v1/csv/query', {
      csv: SAMPLE_CSV,
      conditions: [{ column: 'city', operator: 'equals', value: 'New York' }],
    });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    expect(body.data.count).toBe(2);
    expect(body.data.total).toBe(4);
    expect(body.data.rows.every((r: any) => r.city === 'New York')).toBe(true);
  });

  it('filters rows with contains condition', async () => {
    const res = await post('/v1/csv/query', {
      csv: SAMPLE_CSV,
      conditions: [{ column: 'name', operator: 'contains', value: 'a' }],
    });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    // Alice, Carol, Dave all contain 'a' (case-insensitive)
    expect(body.data.count).toBe(3);
  });

  it('filters rows with gt condition', async () => {
    const res = await post('/v1/csv/query', {
      csv: SAMPLE_CSV,
      conditions: [{ column: 'age', operator: 'gt', value: 25 }],
    });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    // Alice (30) and Carol (35) are > 25
    expect(body.data.count).toBe(2);
  });

  it('filters rows with lt condition', async () => {
    const res = await post('/v1/csv/query', {
      csv: SAMPLE_CSV,
      conditions: [{ column: 'age', operator: 'lt', value: 30 }],
    });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    // Bob (25) and Dave (25) are < 30
    expect(body.data.count).toBe(2);
  });

  it('applies multiple conditions (AND logic)', async () => {
    const res = await post('/v1/csv/query', {
      csv: SAMPLE_CSV,
      conditions: [
        { column: 'city', operator: 'equals', value: 'New York' },
        { column: 'age', operator: 'gt', value: 25 },
      ],
    });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    // Alice is in New York AND age > 25
    expect(body.data.count).toBe(1);
    expect(body.data.rows[0].name).toBe('Alice');
  });

  it('rejects empty conditions array', async () => {
    const res = await post('/v1/csv/query', { csv: SAMPLE_CSV, conditions: [] });
    expect(res.status).toBe(400);
  });
});

// ─── POST /v1/csv/sort ───────────────────────────────────────────────────────

describe('POST /v1/csv/sort', () => {
  it('sorts rows by a string column ascending', async () => {
    const res = await post('/v1/csv/sort', {
      csv: SAMPLE_CSV,
      columns: [{ column: 'name', direction: 'asc' }],
    });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    const names = body.data.rows.map((r: any) => r.name);
    expect(names).toEqual([...names].sort());
  });

  it('sorts rows by a numeric column descending', async () => {
    const res = await post('/v1/csv/sort', {
      csv: SAMPLE_CSV,
      columns: [{ column: 'age', direction: 'desc' }],
    });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    const ages = body.data.rows.map((r: any) => Number(r.age));
    expect(ages[0]).toBe(35); // Carol
    expect(ages[ages.length - 1]).toBe(25);
  });

  it('sorts by multiple columns', async () => {
    const res = await post('/v1/csv/sort', {
      csv: SAMPLE_CSV,
      columns: [
        { column: 'age', direction: 'asc' },
        { column: 'name', direction: 'asc' },
      ],
    });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    // Both Bob and Dave are 25; Bob sorts before Dave alphabetically
    expect(body.data.rows[0].name).toBe('Bob');
    expect(body.data.rows[1].name).toBe('Dave');
  });

  it('rejects empty columns array', async () => {
    const res = await post('/v1/csv/sort', { csv: SAMPLE_CSV, columns: [] });
    expect(res.status).toBe(400);
  });
});

// ─── POST /v1/csv/columns ────────────────────────────────────────────────────

describe('POST /v1/csv/columns', () => {
  it('lists columns with inferred types', async () => {
    const res = await post('/v1/csv/columns', { csv: SAMPLE_CSV });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    expect(body.data.row_count).toBe(4);
    const colMap = Object.fromEntries(body.data.columns.map((c: any) => [c.name, c.type]));
    expect(colMap.name).toBe('string');
    expect(colMap.age).toBe('number');
    expect(colMap.city).toBe('string');
  });

  it('rejects empty csv', async () => {
    const res = await post('/v1/csv/columns', { csv: '' });
    expect(res.status).toBe(400);
  });
});

// ─── POST /v1/csv/stats ──────────────────────────────────────────────────────

describe('POST /v1/csv/stats', () => {
  it('returns numeric stats for numeric columns', async () => {
    const res = await post('/v1/csv/stats', { csv: SAMPLE_CSV });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    expect(body.data.row_count).toBe(4);
    const age = body.data.stats.age;
    expect(age.count).toBe(4);
    expect(age.min).toBe(25);
    expect(age.max).toBe(35);
    expect(age.sum).toBe(115); // 30+25+35+25
    expect(age.mean).toBeCloseTo(28.75);
  });

  it('returns null stats for string columns', async () => {
    const res = await post('/v1/csv/stats', { csv: SAMPLE_CSV });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    const name = body.data.stats.name;
    expect(name.min).toBeNull();
    expect(name.max).toBeNull();
    expect(name.mean).toBeNull();
    expect(name.sum).toBeNull();
    expect(name.count).toBe(4);
  });

  it('rejects empty csv', async () => {
    const res = await post('/v1/csv/stats', { csv: '' });
    expect(res.status).toBe(400);
  });
});

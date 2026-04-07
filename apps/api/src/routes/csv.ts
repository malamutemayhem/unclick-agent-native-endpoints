/**
 * UnClick CSV - stateless CSV processing utility.
 *
 * All endpoints sit under /v1/* and inherit the global auth + rate-limit
 * middleware; no database access is needed.
 *
 * Scope: csv:use
 *
 *   POST /v1/csv/parse   - parse CSV string to JSON array
 *   POST /v1/csv/generate - convert JSON array to CSV string
 *   POST /v1/csv/query   - filter rows by column conditions
 *   POST /v1/csv/sort    - sort rows by column(s)
 *   POST /v1/csv/columns - list column names and inferred types
 *   POST /v1/csv/stats   - basic statistics for numeric columns
 */
import { Hono } from 'hono';
import Papa from 'papaparse';
import { z } from 'zod';
import { ok, Errors } from '@unclick/core';
import { zv } from '../middleware/validate.js';
import { requireScope } from '../middleware/auth.js';
import type { AppVariables } from '../middleware/types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// 10 MB CSV limit
const MAX_CSV = 10_000_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Row = Record<string, string>;

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const CsvSchema = z.string().min(1).max(MAX_CSV);

const ParseSchema = z.object({
  csv: CsvSchema,
  header: z.boolean().default(true),
  delimiter: z.string().max(1).default(','),
});

const GenerateSchema = z.object({
  data: z.array(z.record(z.unknown())).min(1),
  delimiter: z.string().max(1).default(','),
});

const ConditionSchema = z.object({
  column: z.string().min(1),
  operator: z.enum(['equals', 'contains', 'gt', 'lt']),
  value: z.union([z.string(), z.number()]),
});

const QuerySchema = z.object({
  csv: CsvSchema,
  conditions: z.array(ConditionSchema).min(1),
  header: z.boolean().default(true),
});

const SortColumnSchema = z.object({
  column: z.string().min(1),
  direction: z.enum(['asc', 'desc']).default('asc'),
});

const SortSchema = z.object({
  csv: CsvSchema,
  columns: z.array(SortColumnSchema).min(1),
  header: z.boolean().default(true),
});

const ColumnsSchema = z.object({
  csv: CsvSchema,
});

const StatsSchema = z.object({
  csv: CsvSchema,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseCsv(csv: string, header = true, delimiter = ','): Row[] {
  const result = Papa.parse<Row>(csv, {
    header,
    delimiter,
    skipEmptyLines: true,
  });
  if (result.errors.length > 0) {
    const firstError = result.errors[0];
    throw Errors.validation(`CSV parse error: ${firstError?.message ?? 'unknown error'}`);
  }
  return result.data;
}

function applyCondition(value: string, operator: string, target: string | number): boolean {
  const numVal = Number(value);
  const numTarget = Number(target);
  switch (operator) {
    case 'equals':   return value === String(target);
    case 'contains': return value.toLowerCase().includes(String(target).toLowerCase());
    case 'gt':       return !isNaN(numVal) && !isNaN(numTarget) && numVal > numTarget;
    case 'lt':       return !isNaN(numVal) && !isNaN(numTarget) && numVal < numTarget;
    default:         return false;
  }
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createCsvRouter() {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /csv/parse
  router.post('/parse', requireScope('csv:use'), zv('json', ParseSchema), (c) => {
    const { csv, header, delimiter } = c.req.valid('json');
    const rows = parseCsv(csv, header, delimiter);
    return ok(c, { rows, count: rows.length });
  });

  // POST /csv/generate
  router.post('/generate', requireScope('csv:use'), zv('json', GenerateSchema), (c) => {
    const { data, delimiter } = c.req.valid('json');
    const csv = Papa.unparse(data, { delimiter });
    return ok(c, { csv, rows: data.length });
  });

  // POST /csv/query
  router.post('/query', requireScope('csv:use'), zv('json', QuerySchema), (c) => {
    const { csv, conditions, header } = c.req.valid('json');
    const rows = parseCsv(csv, header);
    const filtered = rows.filter((row) =>
      conditions.every((cond) => {
        const val = row[cond.column] ?? '';
        return applyCondition(val, cond.operator, cond.value);
      }),
    );
    return ok(c, { rows: filtered, count: filtered.length, total: rows.length });
  });

  // POST /csv/sort
  router.post('/sort', requireScope('csv:use'), zv('json', SortSchema), (c) => {
    const { csv, columns, header } = c.req.valid('json');
    const rows = parseCsv(csv, header);
    const sorted = [...rows].sort((a, b) => {
      for (const { column, direction } of columns) {
        const aVal = a[column] ?? '';
        const bVal = b[column] ?? '';
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        const isNumeric = !isNaN(aNum) && !isNaN(bNum) && aVal !== '' && bVal !== '';
        const cmp = isNumeric ? aNum - bNum : aVal.localeCompare(bVal);
        if (cmp !== 0) return direction === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
    return ok(c, { rows: sorted, count: sorted.length });
  });

  // POST /csv/columns
  router.post('/columns', requireScope('csv:use'), zv('json', ColumnsSchema), (c) => {
    const { csv } = c.req.valid('json');
    const rows = parseCsv(csv, true);
    if (rows.length === 0) return ok(c, { columns: [], row_count: 0 });
    const sample = rows.slice(0, 100);
    const columns = Object.keys(rows[0]!).map((name) => {
      const values = sample.map((r) => r[name] ?? '').filter((v) => v !== '');
      const isNumeric = values.length > 0 && values.every((v) => !isNaN(Number(v)));
      return { name, type: isNumeric ? 'number' : 'string' };
    });
    return ok(c, { columns, row_count: rows.length });
  });

  // POST /csv/stats
  router.post('/stats', requireScope('csv:use'), zv('json', StatsSchema), (c) => {
    const { csv } = c.req.valid('json');
    const rows = parseCsv(csv, true);
    if (rows.length === 0) return ok(c, { stats: {}, row_count: 0 });
    const stats: Record<string, {
      count: number;
      min: number | null;
      max: number | null;
      mean: number | null;
      sum: number | null;
    }> = {};
    for (const col of Object.keys(rows[0]!)) {
      const values = rows.map((r) => r[col] ?? '').filter((v) => v !== '');
      const nums = values.map(Number).filter((n) => !isNaN(n));
      if (nums.length > 0) {
        const sum = nums.reduce((a, b) => a + b, 0);
        stats[col] = {
          count: nums.length,
          min: Math.min(...nums),
          max: Math.max(...nums),
          mean: sum / nums.length,
          sum,
        };
      } else {
        stats[col] = { count: values.length, min: null, max: null, mean: null, sum: null };
      }
    }
    return ok(c, { stats, row_count: rows.length });
  });

  return router;
}

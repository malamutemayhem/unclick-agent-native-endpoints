/**
 * UnClick Units — stateless unit conversion utility.
 *
 * All endpoints sit under /v1/* and inherit the global auth + rate-limit
 * middleware; no database access is needed.
 *
 * Scope: units:use
 *
 *   POST /v1/units/convert — convert a value from one unit to another
 *   POST /v1/units/list    — list all supported categories and units
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { ok, Errors } from '@unclick/core';
import { zv } from '../middleware/validate.js';
import { requireScope } from '../middleware/auth.js';
import type { AppVariables } from '../middleware/types.js';

// ---------------------------------------------------------------------------
// Unit definitions — each non-temperature unit stores its factor relative to
// the category's canonical base unit.
// ---------------------------------------------------------------------------

const LINEAR_UNITS = {
  length: {
    base: 'm',
    units: {
      mm: 1e-3, cm: 1e-2, m: 1, km: 1e3,
      in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344, nmi: 1852,
    } as Record<string, number>,
  },
  weight: {
    base: 'kg',
    units: {
      mg: 1e-6, g: 1e-3, kg: 1, t: 1e3,
      oz: 0.028349523125, lb: 0.45359237, st: 6.35029318,
    } as Record<string, number>,
  },
  volume: {
    base: 'L',
    units: {
      ml: 1e-3, cl: 1e-2, dl: 0.1, L: 1, m3: 1e3,
      tsp: 0.00492892, tbsp: 0.01478676, fl_oz: 0.02957353,
      cup: 0.2365882, pt: 0.4731765, qt: 0.9463529, gal: 3.785412,
    } as Record<string, number>,
  },
  data: {
    base: 'B',
    units: {
      b: 0.125,
      B: 1,
      KB: 1_000, MB: 1_000 ** 2, GB: 1_000 ** 3, TB: 1_000 ** 4, PB: 1_000 ** 5,
      KiB: 1_024, MiB: 1_024 ** 2, GiB: 1_024 ** 3, TiB: 1_024 ** 4, PiB: 1_024 ** 5,
    } as Record<string, number>,
  },
  speed: {
    base: 'm/s',
    units: {
      'm/s': 1, 'km/h': 1 / 3.6, mph: 0.44704, knot: 0.514444,
    } as Record<string, number>,
  },
  time: {
    base: 's',
    units: {
      ns: 1e-9, us: 1e-6, ms: 1e-3, s: 1,
      min: 60, h: 3_600, d: 86_400, wk: 604_800, mo: 2_629_800, yr: 31_557_600,
    } as Record<string, number>,
  },
} as const;

type LinearCategory = keyof typeof LINEAR_UNITS;

const TEMPERATURE_UNITS = ['C', 'F', 'K'] as const;
type TempUnit = (typeof TEMPERATURE_UNITS)[number];

// Build a flat map: unit -> category for linear units
const UNIT_TO_CATEGORY = new Map<string, LinearCategory>();
for (const [cat, def] of Object.entries(LINEAR_UNITS) as [LinearCategory, { units: Record<string, number> }][]) {
  for (const unit of Object.keys(def.units)) {
    UNIT_TO_CATEGORY.set(unit, cat);
  }
}
for (const t of TEMPERATURE_UNITS) {
  // reserve temperature — handled separately, not in UNIT_TO_CATEGORY
  void t;
}

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

function convertLinear(value: number, from: string, to: string, cat: LinearCategory): number {
  const factors = (LINEAR_UNITS[cat] as { units: Record<string, number> }).units;
  const inBase = value * factors[from]!;
  return inBase / factors[to]!;
}

function convertTemperature(value: number, from: TempUnit, to: TempUnit): number {
  if (from === to) return value;
  // To Celsius first
  let celsius: number;
  switch (from) {
    case 'C': celsius = value; break;
    case 'F': celsius = (value - 32) * (5 / 9); break;
    case 'K': celsius = value - 273.15; break;
  }
  switch (to) {
    case 'C': return celsius;
    case 'F': return celsius * (9 / 5) + 32;
    case 'K': return celsius + 273.15;
  }
}

function isLinearUnit(unit: string): unit is string {
  return UNIT_TO_CATEGORY.has(unit);
}

function isTempUnit(unit: string): unit is TempUnit {
  return (TEMPERATURE_UNITS as readonly string[]).includes(unit);
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ALL_UNITS = [
  ...Array.from(UNIT_TO_CATEGORY.keys()),
  ...TEMPERATURE_UNITS,
];

const ConvertSchema = z.object({
  value: z.number(),
  from_unit: z.string().min(1),
  to_unit: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Category listing helpers
// ---------------------------------------------------------------------------

function buildCategoryList() {
  const categories: Record<string, { base: string; units: string[] }> = {};
  for (const [cat, def] of Object.entries(LINEAR_UNITS) as [LinearCategory, { base: string; units: Record<string, number> }][]) {
    categories[cat] = { base: def.base, units: Object.keys(def.units) };
  }
  categories['temperature'] = { base: 'C', units: [...TEMPERATURE_UNITS] };
  return categories;
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createUnitsRouter() {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /units/convert
  router.post('/convert', requireScope('units:use'), zv('json', ConvertSchema), (c) => {
    const { value, from_unit, to_unit } = c.req.valid('json');

    // Temperature branch
    if (isTempUnit(from_unit) && isTempUnit(to_unit)) {
      const result = convertTemperature(value, from_unit, to_unit);
      return ok(c, {
        value,
        from_unit,
        to_unit,
        result,
        category: 'temperature',
      });
    }

    if (isTempUnit(from_unit) || isTempUnit(to_unit)) {
      throw Errors.validation(`Cannot convert between temperature unit (${from_unit} / ${to_unit}) and non-temperature unit`);
    }

    // Linear branch
    if (!isLinearUnit(from_unit)) {
      throw Errors.validation(`Unknown unit: "${from_unit}". Call POST /v1/units/list to see all supported units.`);
    }
    if (!isLinearUnit(to_unit)) {
      throw Errors.validation(`Unknown unit: "${to_unit}". Call POST /v1/units/list to see all supported units.`);
    }

    const fromCat = UNIT_TO_CATEGORY.get(from_unit)!;
    const toCat = UNIT_TO_CATEGORY.get(to_unit)!;

    if (fromCat !== toCat) {
      throw Errors.validation(
        `Cannot convert between incompatible categories: "${from_unit}" is ${fromCat}, "${to_unit}" is ${toCat}`,
      );
    }

    const result = convertLinear(value, from_unit, to_unit, fromCat);
    return ok(c, {
      value,
      from_unit,
      to_unit,
      result,
      category: fromCat,
    });
  });

  // POST /units/list
  router.post('/list', requireScope('units:use'), (c) => {
    return ok(c, { categories: buildCategoryList() });
  });

  return router;
}

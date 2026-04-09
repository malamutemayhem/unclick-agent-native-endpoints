// Universal unit converter.
// No API required -- pure computation.

// ─── convert_length ───────────────────────────────────────────────────────────

const LENGTH_TO_M: Record<string, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  km: 1000,
  in: 0.0254,
  ft: 0.3048,
  yd: 0.9144,
  mi: 1609.344,
};

export function convertLength(args: Record<string, unknown>): unknown {
  return convertUnit(args, LENGTH_TO_M, "m", ["mm", "cm", "m", "km", "in", "ft", "yd", "mi"]);
}

// ─── convert_weight ───────────────────────────────────────────────────────────

const WEIGHT_TO_KG: Record<string, number> = {
  mg: 0.000001,
  g: 0.001,
  kg: 1,
  tonne: 1000,
  lb: 0.45359237,
  oz: 0.028349523,
  stone: 6.35029318,
};

export function convertWeight(args: Record<string, unknown>): unknown {
  return convertUnit(args, WEIGHT_TO_KG, "kg", ["mg", "g", "kg", "tonne", "lb", "oz", "stone"]);
}

// ─── convert_temperature ──────────────────────────────────────────────────────

export function convertTemperature(args: Record<string, unknown>): unknown {
  const value = Number(args.value ?? NaN);
  const from = String(args.from_unit ?? "").toUpperCase().replace(/\s/g, "");
  const to = String(args.to_unit ?? "").toUpperCase().replace(/\s/g, "");
  const supported = ["C", "F", "K", "R"];

  if (isNaN(value)) return { error: "value must be a number." };
  if (!supported.includes(from)) return unitError("from_unit", from, supported);
  if (!supported.includes(to)) return unitError("to_unit", to, supported);

  // Convert to Celsius first
  let celsius: number;
  switch (from) {
    case "C": celsius = value; break;
    case "F": celsius = (value - 32) * 5 / 9; break;
    case "K": celsius = value - 273.15; break;
    case "R": celsius = (value - 491.67) * 5 / 9; break;
    default: celsius = value;
  }

  // Convert from Celsius to target
  let result: number;
  switch (to) {
    case "C": result = celsius; break;
    case "F": result = celsius * 9 / 5 + 32; break;
    case "K": result = celsius + 273.15; break;
    case "R": result = (celsius + 273.15) * 9 / 5; break;
    default: result = celsius;
  }

  return {
    value,
    from_unit: from,
    to_unit: to,
    result: round6(result),
    all_units: {
      C: round6(celsius),
      F: round6(celsius * 9 / 5 + 32),
      K: round6(celsius + 273.15),
      R: round6((celsius + 273.15) * 9 / 5),
    },
  };
}

// ─── convert_volume ───────────────────────────────────────────────────────────

const VOLUME_TO_L: Record<string, number> = {
  mL: 0.001,
  L: 1,
  m3: 1000,
  gallon_us: 3.785411784,
  gallon_uk: 4.54609,
  fl_oz: 0.0295735295625,
  cup: 0.2365882365,
  pint: 0.473176473,
  quart: 0.946352946,
};

export function convertVolume(args: Record<string, unknown>): unknown {
  return convertUnit(args, VOLUME_TO_L, "L", Object.keys(VOLUME_TO_L));
}

// ─── convert_speed ────────────────────────────────────────────────────────────

const SPEED_TO_MS: Record<string, number> = {
  "m/s": 1,
  "km/h": 1 / 3.6,
  mph: 0.44704,
  knots: 0.514444,
  "ft/s": 0.3048,
};

export function convertSpeed(args: Record<string, unknown>): unknown {
  return convertUnit(args, SPEED_TO_MS, "m/s", Object.keys(SPEED_TO_MS));
}

// ─── convert_area ─────────────────────────────────────────────────────────────

const AREA_TO_M2: Record<string, number> = {
  "m2": 1,
  "km2": 1e6,
  ha: 10000,
  acre: 4046.8564224,
  "ft2": 0.09290304,
  "mi2": 2589988.110336,
  "cm2": 0.0001,
  "in2": 0.00064516,
};

export function convertArea(args: Record<string, unknown>): unknown {
  return convertUnit(args, AREA_TO_M2, "m2", Object.keys(AREA_TO_M2));
}

// ─── convert_data_storage ─────────────────────────────────────────────────────

const DATA_TO_BYTES: Record<string, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
  PB: 1024 ** 5,
};

export function convertDataStorage(args: Record<string, unknown>): unknown {
  return convertUnit(args, DATA_TO_BYTES, "B", Object.keys(DATA_TO_BYTES));
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function convertUnit(
  args: Record<string, unknown>,
  table: Record<string, number>,
  baseUnit: string,
  supported: string[],
): unknown {
  const value = Number(args.value ?? NaN);
  const from = String(args.from_unit ?? "").trim();
  const to = String(args.to_unit ?? "").trim();

  if (isNaN(value)) return { error: "value must be a number." };

  // Case-insensitive lookup
  const fromKey = Object.keys(table).find((k) => k.toLowerCase() === from.toLowerCase());
  const toKey = Object.keys(table).find((k) => k.toLowerCase() === to.toLowerCase());

  if (!fromKey) return unitError("from_unit", from, supported);
  if (!toKey) return unitError("to_unit", to, supported);

  const base = value * table[fromKey];
  const result = base / table[toKey];

  return {
    value,
    from_unit: fromKey,
    to_unit: toKey,
    result: round6(result),
    base_unit: baseUnit,
    base_value: round6(base),
  };
}

function unitError(param: string, got: string, supported: string[]): unknown {
  return {
    error: `"${got}" is not a supported ${param}. Supported: ${supported.join(", ")}.`,
  };
}

function round6(n: number): number {
  if (Math.abs(n) >= 0.001 || n === 0) return parseFloat(n.toPrecision(7));
  return parseFloat(n.toExponential(5));
}
